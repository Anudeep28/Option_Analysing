// ============================================================
// Volatility Surface: SVI Parametrization + GARCH(1,1)
// ============================================================
// SVI (Stochastic Volatility Inspired) by Gatheral (2004):
//   w(k) = a + b * { rho*(k-m) + sqrt((k-m)^2 + sigma^2) }
// where k = log(K/F) is log-moneyness, w = total implied variance = IV^2 * T
// and a, b, rho, m, sigma are the 5 SVI parameters.
//
// GARCH(1,1):
//   sigma_t^2 = omega + alpha * epsilon_{t-1}^2 + beta * sigma_{t-1}^2

import { blackScholesPrice } from "./pricing/black-scholes";
import type { OptionType, MarketData } from "./types";

// --- SVI Parameters ---
export interface SVIParams {
  a: number;     // overall level of variance
  b: number;     // slope / curvature
  rho: number;   // skew parameter (-1 < rho < 1)
  m: number;     // ATM shift
  sigma: number; // smile curvature (> 0)
}

// Default SVI calibrated roughly to Indian equity (Nifty) skew
export const DEFAULT_SVI_PARAMS: SVIParams = {
  a: 0.04,
  b: 0.08,
  rho: -0.6,
  m: 0.0,
  sigma: 0.15,
};

// Evaluate total implied variance w(k) from SVI
export function sviTotalVariance(k: number, p: SVIParams): number {
  const { a, b, rho, m, sigma } = p;
  const inner = Math.sqrt((k - m) * (k - m) + sigma * sigma);
  return a + b * (rho * (k - m) + inner);
}

// Get implied volatility at given (K, T) from SVI surface
export function sviImpliedVol(K: number, F: number, T: number, p: SVIParams): number {
  if (T <= 0 || K <= 0 || F <= 0) return Math.sqrt(Math.max(p.a, 0.0001));
  const k = Math.log(K / F);
  const w = Math.max(sviTotalVariance(k, p), 1e-8);
  return Math.sqrt(w / T);
}

// --- Smile data point (from option chain) ---
export interface SmilePoint {
  strike: number;
  expiry: number;     // T in years
  forward: number;    // F = S * exp((r-q)*T)
  marketIV: number;   // observed IV (decimal)
  optionType: OptionType;
}

// --- SVI Calibration via Nelder-Mead simplex (in-browser, no deps) ---
// Minimises sum of squared IV errors across smile points.
export function calibrateSVI(points: SmilePoint[], T: number): SVIParams {
  if (points.length < 3) return DEFAULT_SVI_PARAMS;

  // Convert to (k, marketW) pairs for a single expiry
  const data = points.map((p) => ({
    k: Math.log(p.strike / p.forward),
    w: p.marketIV * p.marketIV * T,
  }));

  function loss(params: number[]): number {
    const [a, b, rho, m, sigma] = params;
    if (b < 0 || sigma <= 0 || Math.abs(rho) >= 1 || a < 0) return 1e9;
    let sum = 0;
    for (const { k, w } of data) {
      const inner = Math.sqrt((k - m) * (k - m) + sigma * sigma);
      const wHat = a + b * (rho * (k - m) + inner);
      sum += (wHat - w) * (wHat - w);
    }
    return sum;
  }

  // Nelder-Mead initialisation
  let best: number[] = [
    DEFAULT_SVI_PARAMS.a,
    DEFAULT_SVI_PARAMS.b,
    DEFAULT_SVI_PARAMS.rho,
    DEFAULT_SVI_PARAMS.m,
    DEFAULT_SVI_PARAMS.sigma,
  ];

  const result = nelderMead(loss, best, 300);

  return {
    a: Math.max(result[0], 0.0001),
    b: Math.max(result[1], 0.0001),
    rho: Math.max(-0.999, Math.min(0.999, result[2])),
    m: result[3],
    sigma: Math.max(result[4], 0.001),
  };
}

// Minimal Nelder-Mead simplex optimizer (5D)
function nelderMead(f: (x: number[]) => number, x0: number[], maxIter: number): number[] {
  const n = x0.length;
  const alpha = 1.0, gamma = 2.0, rho = 0.5, sigma = 0.5;
  const step = 0.1;

  // Init simplex
  let simplex: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] = p[i] + step;
    simplex.push(p);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    // Sort by function value
    simplex.sort((a, b) => f(a) - f(b));
    const best = simplex[0];
    const worst = simplex[n];
    const secondWorst = simplex[n - 1];

    // Centroid of all but worst
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    }

    // Reflect
    const reflected = centroid.map((c, j) => c + alpha * (c - worst[j]));
    const fr = f(reflected);

    if (f(best) <= fr && fr < f(secondWorst)) {
      simplex[n] = reflected;
      continue;
    }

    if (fr < f(best)) {
      // Expand
      const expanded = centroid.map((c, j) => c + gamma * (reflected[j] - c));
      simplex[n] = f(expanded) < fr ? expanded : reflected;
      continue;
    }

    // Contract
    const contracted = centroid.map((c, j) => c + rho * (worst[j] - c));
    if (f(contracted) < f(worst)) {
      simplex[n] = contracted;
      continue;
    }

    // Shrink
    for (let i = 1; i <= n; i++) {
      simplex[i] = best.map((b, j) => b + sigma * (simplex[i][j] - b));
    }
  }

  simplex.sort((a, b) => f(a) - f(b));
  return simplex[0];
}

// --- Build smile points from NSE option chain data ---
export interface OptionChainEntry {
  strikePrice: number;
  callLTP: number;
  putLTP: number;
  callIV: number;
  putIV: number;
}

export function buildSmileFromChain(
  entries: OptionChainEntry[],
  spotPrice: number,
  riskFreeRate: number,
  dividendYield: number,
  T: number,
): SmilePoint[] {
  const F = spotPrice * Math.exp((riskFreeRate - dividendYield) * T);
  const points: SmilePoint[] = [];

  for (const e of entries) {
    if (e.callIV > 0.01) {
      points.push({
        strike: e.strikePrice, expiry: T, forward: F,
        marketIV: e.callIV / 100, optionType: "call",
      });
    }
    if (e.putIV > 0.01) {
      points.push({
        strike: e.strikePrice, expiry: T, forward: F,
        marketIV: e.putIV / 100, optionType: "put",
      });
    }
  }

  return points;
}

// --- Skew metrics for display ---
export interface SkewMetrics {
  atmIV: number;          // ATM implied vol
  skew25d: number;        // 25-delta risk reversal (call - put IV)
  butterfly25d: number;   // 25-delta butterfly (strangle - ATM)
  slopePerStrike: number; // dIV/dK at ATM (vol per 1% strike move)
  interpretation: string;
}

export function computeSkewMetrics(
  sviParams: SVIParams,
  spotPrice: number,
  T: number,
  riskFreeRate: number,
  dividendYield: number,
): SkewMetrics {
  const F = spotPrice * Math.exp((riskFreeRate - dividendYield) * T);
  const atmIV = sviImpliedVol(F, F, T, sviParams);

  // Approx 25-delta strikes using BSM delta ≈ 0.25
  const sig = atmIV;
  const sqrtT = Math.sqrt(T);
  // 25-delta call strike: K_25c = F * exp(z * sig * sqrtT) where z ≈ 0.674
  const K25c = F * Math.exp(0.674 * sig * sqrtT);
  const K25p = F * Math.exp(-0.674 * sig * sqrtT);

  const iv25c = sviImpliedVol(K25c, F, T, sviParams);
  const iv25p = sviImpliedVol(K25p, F, T, sviParams);

  const skew25d = iv25c - iv25p;
  const butterfly25d = (iv25c + iv25p) / 2 - atmIV;

  // Local slope at ATM
  const dK = F * 0.001;
  const ivUp = sviImpliedVol(F + dK, F, T, sviParams);
  const ivDn = sviImpliedVol(F - dK, F, T, sviParams);
  const slopePerStrike = (ivUp - ivDn) / (2 * dK / F * 100); // dIV per 1% strike

  let interpretation = `ATM IV: ${(atmIV * 100).toFixed(1)}%. `;
  if (skew25d < -0.02) {
    interpretation += `Steep put skew (${(skew25d * 100).toFixed(1)}pp) — market pricing downside protection heavily. `;
  } else if (skew25d > 0.01) {
    interpretation += `Positive skew (${(skew25d * 100).toFixed(1)}pp) — calls relatively expensive. `;
  } else {
    interpretation += `Roughly symmetric smile. `;
  }
  if (butterfly25d > 0.01) {
    interpretation += `Elevated butterfly (${(butterfly25d * 100).toFixed(1)}pp) — fat tails priced in.`;
  }

  return { atmIV, skew25d, butterfly25d, slopePerStrike, interpretation };
}

// ============================================================
// GARCH(1,1) Volatility Forecasting
// ============================================================
// Model: sigma_t^2 = omega + alpha * r_{t-1}^2 + beta * sigma_{t-1}^2
// Unconditional variance: omega / (1 - alpha - beta)
// Long-run vol: sqrt(unconditional variance)

export interface GARCHParams {
  omega: number;   // baseline variance
  alpha: number;   // ARCH coefficient (shock persistence)
  beta: number;    // GARCH coefficient (variance persistence)
}

export interface GARCHResult {
  params: GARCHParams;
  conditionalVol: number[];     // daily sigma_t for each historical day
  currentVol: number;           // latest sigma_t (annualized)
  forecastVol: number[];        // annualized vol forecast for next N days
  longRunVol: number;           // unconditional (steady-state) annualized vol
  halfLife: number;             // days for shock to decay to half
  persistence: number;          // alpha + beta
  interpretation: string;
}

// Compute log returns from price series
function logReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  return returns;
}

// Maximum Likelihood Estimation of GARCH(1,1) via grid search + refinement
export function fitGARCH(closes: number[], forecastDays = 30): GARCHResult {
  const returns = logReturns(closes);
  const n = returns.length;
  if (n < 30) {
    const hv = computeHistoricalVol(returns);
    return fallbackGARCH(hv, forecastDays);
  }

  // Sample variance as starting sigma^2
  const meanRet = returns.reduce((s, r) => s + r, 0) / n;
  const sampleVar = returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / n;

  // Negative log-likelihood for GARCH(1,1)
  function negLogLikelihood(omega: number, alpha: number, beta: number): number {
    if (omega <= 0 || alpha < 0 || beta < 0 || alpha + beta >= 0.9999) return 1e12;
    let sigma2 = sampleVar;
    let ll = 0;
    for (const r of returns) {
      sigma2 = omega + alpha * r * r + beta * sigma2;
      if (sigma2 <= 0) return 1e12;
      ll += Math.log(sigma2) + (r * r) / sigma2;
    }
    return ll;
  }

  // Grid search over typical GARCH parameter space
  let bestOmega = sampleVar * 0.05;
  let bestAlpha = 0.1;
  let bestBeta = 0.85;
  let bestLL = negLogLikelihood(bestOmega, bestAlpha, bestBeta);

  const omegaGrid = [sampleVar * 0.01, sampleVar * 0.05, sampleVar * 0.1];
  const alphaGrid = [0.05, 0.10, 0.15, 0.20];
  const betaGrid = [0.70, 0.80, 0.85, 0.88, 0.90];

  for (const omega of omegaGrid) {
    for (const alpha of alphaGrid) {
      for (const beta of betaGrid) {
        if (alpha + beta >= 0.9999) continue;
        const ll = negLogLikelihood(omega, alpha, beta);
        if (ll < bestLL) { bestLL = ll; bestOmega = omega; bestAlpha = alpha; bestBeta = beta; }
      }
    }
  }

  // Refine with coordinate descent
  for (let iter = 0; iter < 50; iter++) {
    const stepO = bestOmega * 0.1, stepA = 0.01, stepB = 0.01;
    for (const [dO, dA, dB] of [[stepO, 0, 0], [-stepO, 0, 0], [0, stepA, 0], [0, -stepA, 0], [0, 0, stepB], [0, 0, -stepB]]) {
      const ll = negLogLikelihood(bestOmega + dO, bestAlpha + dA, bestBeta + dB);
      if (ll < bestLL) { bestLL = ll; bestOmega += dO; bestAlpha += dA; bestBeta += dB; }
    }
  }

  const params: GARCHParams = { omega: bestOmega, alpha: bestAlpha, beta: bestBeta };

  // Compute conditional variance series
  const sigma2Series: number[] = [];
  let sigma2 = sampleVar;
  for (const r of returns) {
    sigma2 = params.omega + params.alpha * r * r + params.beta * sigma2;
    sigma2Series.push(Math.max(sigma2, 1e-10));
  }

  const currentSigma2 = sigma2Series[sigma2Series.length - 1];
  const lastReturn = returns[returns.length - 1];

  // Multi-step forecast: E[sigma^2_{t+h}] = omega/(1-alpha-beta) + (alpha+beta)^h * (sigma_t^2 - LRV)
  const persistence = params.alpha + params.beta;
  const lrv = persistence < 1 ? params.omega / (1 - persistence) : sampleVar;
  const forecastVol: number[] = [];
  for (let h = 1; h <= forecastDays; h++) {
    const forecastVar = lrv + Math.pow(persistence, h) * (currentSigma2 - lrv);
    forecastVol.push(Math.sqrt(Math.max(forecastVar, 1e-10)) * Math.sqrt(252));
  }

  const longRunVol = Math.sqrt(lrv) * Math.sqrt(252);
  const halfLife = persistence > 0 && persistence < 1 ? Math.log(0.5) / Math.log(persistence) : Infinity;
  const currentVol = Math.sqrt(currentSigma2) * Math.sqrt(252);

  let interpretation = `GARCH(1,1): α=${params.alpha.toFixed(3)}, β=${params.beta.toFixed(3)}, persistence=${persistence.toFixed(3)}. `;
  interpretation += `Current vol: ${(currentVol * 100).toFixed(1)}%, long-run: ${(longRunVol * 100).toFixed(1)}%. `;
  if (currentVol > longRunVol * 1.2) {
    interpretation += `Vol is elevated above long-run — expect mean reversion downward. Use lower vol for longer-dated options.`;
  } else if (currentVol < longRunVol * 0.8) {
    interpretation += `Vol is compressed below long-run — expect expansion. Use higher vol for longer-dated options.`;
  } else {
    interpretation += `Vol near long-run equilibrium. Half-life of shocks: ${isFinite(halfLife) ? halfLife.toFixed(0) : "∞"} days.`;
  }

  return {
    params,
    conditionalVol: sigma2Series.map((v) => Math.sqrt(v) * Math.sqrt(252)),
    currentVol,
    forecastVol,
    longRunVol,
    halfLife,
    persistence,
    interpretation,
  };
}

function computeHistoricalVol(returns: number[]): number {
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance * 252);
}

/**
 * Convenience wrapper: fit GARCH(1,1) on closes and return only the
 * current conditional annualized vol (the most actionable single number).
 * Returns null if fewer than 30 closes (insufficient data).
 */
export function computeGARCHVol(closes: number[]): number | null {
  if (closes.length < 30) return null;
  return fitGARCH(closes, 1).currentVol;
}

function fallbackGARCH(hv: number, forecastDays: number): GARCHResult {
  const dailyVar = (hv / Math.sqrt(252)) ** 2;
  const params: GARCHParams = { omega: dailyVar * 0.05, alpha: 0.1, beta: 0.85 };
  return {
    params,
    conditionalVol: [hv],
    currentVol: hv,
    forecastVol: Array(forecastDays).fill(hv),
    longRunVol: hv,
    halfLife: Math.log(0.5) / Math.log(0.95),
    persistence: 0.95,
    interpretation: `Insufficient data for GARCH fit. Using historical vol: ${(hv * 100).toFixed(1)}%.`,
  };
}

// ============================================================
// SCENARIO P&L LADDER
// ============================================================
// Shows how the option position P&L changes across a grid of
// spot moves (±1% to ±10%) and vol moves (±5% to ±20% IV).

export interface ScenarioPoint {
  spotChangePct: number;
  volChangePct: number;
  newPrice: number;
  pnl: number;           // P&L per unit (new price - entry price)
  pnlPct: number;        // P&L as % of entry price
}

export interface ScenarioLadder {
  spotMoves: number[];   // e.g. [-10, -5, -3, -1, 0, 1, 3, 5, 10]
  volMoves: number[];    // e.g. [-20, -10, 0, 10, 20]
  matrix: ScenarioPoint[][];   // [spotIdx][volIdx]
  entryPrice: number;
  breakEvenSpotMoves: { up: number | null; down: number | null };
}

export function buildScenarioLadder(
  market: MarketData,
  optionType: import("./types").OptionType,
  entryPrice: number,
  spotMovesPct: number[] = [-10, -7, -5, -3, -1, 0, 1, 3, 5, 7, 10],
  volMovesPct: number[] = [-20, -10, -5, 0, 5, 10, 20],
): ScenarioLadder {
  const { spotPrice: S, volatility: sigma } = market;
  const matrix: ScenarioPoint[][] = [];

  for (const spotPct of spotMovesPct) {
    const row: ScenarioPoint[] = [];
    for (const volPct of volMovesPct) {
      const newS = S * (1 + spotPct / 100);
      const newSigma = Math.max(0.01, sigma * (1 + volPct / 100));
      const newPrice = blackScholesPrice({ ...market, spotPrice: newS, volatility: newSigma }, optionType);
      const pnl = newPrice - entryPrice;
      row.push({
        spotChangePct: spotPct,
        volChangePct: volPct,
        newPrice,
        pnl,
        pnlPct: entryPrice > 0 ? (pnl / entryPrice) * 100 : 0,
      });
    }
    matrix.push(row);
  }

  // Break-even: spot move (at flat vol) where P&L = 0
  const flatVolIdx = volMovesPct.indexOf(0);
  let breakEvenUp: number | null = null;
  let breakEvenDown: number | null = null;

  if (flatVolIdx >= 0) {
    for (let i = spotMovesPct.indexOf(0); i < spotMovesPct.length - 1; i++) {
      if (matrix[i][flatVolIdx].pnl <= 0 && matrix[i + 1][flatVolIdx].pnl >= 0) {
        breakEvenUp = (spotMovesPct[i] + spotMovesPct[i + 1]) / 2;
      }
    }
    for (let i = spotMovesPct.indexOf(0); i > 0; i--) {
      if (matrix[i][flatVolIdx].pnl >= 0 && matrix[i - 1][flatVolIdx].pnl <= 0) {
        breakEvenDown = (spotMovesPct[i] + spotMovesPct[i - 1]) / 2;
      }
    }
  }

  return {
    spotMoves: spotMovesPct,
    volMoves: volMovesPct,
    matrix,
    entryPrice,
    breakEvenSpotMoves: { up: breakEvenUp, down: breakEvenDown },
  };
}

// Put-Call Parity check
export interface PutCallParityCheck {
  theoreticalDiff: number;  // C - P should equal S*e^(-qT) - K*e^(-rT)
  marketDiff: number;       // actual C - P from market prices
  arbitragePnl: number;     // |marketDiff - theoreticalDiff|
  hasArbitrage: boolean;
  interpretation: string;
}

export function checkPutCallParity(
  callPrice: number,
  putPrice: number,
  market: MarketData,
): PutCallParityCheck {
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, dividendYield: q, timeToExpiry: T } = market;
  const theoreticalDiff = S * Math.exp(-q * T) - K * Math.exp(-r * T);
  const marketDiff = callPrice - putPrice;
  const arbitragePnl = Math.abs(marketDiff - theoreticalDiff);
  const threshold = S * 0.002; // 0.2% of spot = transaction cost proxy
  const hasArbitrage = arbitragePnl > threshold;

  let interpretation: string;
  if (!hasArbitrage) {
    interpretation = `Put-call parity holds (deviation: ${arbitragePnl.toFixed(2)} < threshold ${threshold.toFixed(2)}). No arbitrage.`;
  } else if (marketDiff > theoreticalDiff + threshold) {
    interpretation = `Call overpriced vs put by ${arbitragePnl.toFixed(2)}. Arbitrage: sell call, buy put, buy stock, borrow PV(K).`;
  } else {
    interpretation = `Put overpriced vs call by ${arbitragePnl.toFixed(2)}. Arbitrage: buy call, sell put, short stock, lend PV(K).`;
  }

  return { theoreticalDiff, marketDiff, arbitragePnl, hasArbitrage, interpretation };
}
