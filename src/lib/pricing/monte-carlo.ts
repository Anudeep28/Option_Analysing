import { randomNormal, laguerreBasis, ols3, sobolNormalPair } from "../math";
import { blackScholesPrice } from "./black-scholes";
import type {
  MarketData, OptionType, OptionStyle, SimulationParams,
  BarrierParams, AsianParams, PricingResult, SimulationPath,
} from "../types";

export interface MonteCarloOptions {
  market: MarketData;
  optionType: OptionType;
  optionStyle: OptionStyle;
  simulation: SimulationParams;
  barrier?: BarrierParams;
  asian?: AsianParams;
  garchVol?: number; // GARCH(1,1) current vol — used as effective sigma for paths
}

// --- GBM path simulation (with antithetic variate option) ---
function simulateGBMPath(
  S: number, r: number, q: number, sigma: number, T: number, steps: number,
  zs?: number[],
): number[] {
  const dt = T / steps;
  const drift = (r - q - 0.5 * sigma * sigma) * dt;
  const diffusion = sigma * Math.sqrt(dt);
  const path = new Array(steps + 1);
  path[0] = S;
  for (let i = 1; i <= steps; i++) {
    const z = zs ? zs[i - 1] : randomNormal();
    path[i] = path[i - 1] * Math.exp(drift + diffusion * z);
  }
  return path;
}

// --- Exotic payoffs (barrier, asian, lookback) ---
function exoticPayoff(
  path: number[],
  K: number,
  optionType: OptionType,
  optionStyle: OptionStyle,
  barrier?: BarrierParams,
  asian?: AsianParams,
): number | null {
  const steps = path.length - 1;

  if (barrier) {
    const { barrierType, barrierLevel } = barrier;
    let crossed = false;
    for (let i = 0; i <= steps; i++) {
      if (barrierType.startsWith("up") && path[i] >= barrierLevel) { crossed = true; break; }
      if (barrierType.startsWith("down") && path[i] <= barrierLevel) { crossed = true; break; }
    }
    const isKnockIn = barrierType.endsWith("in");
    if (isKnockIn && !crossed) return 0;
    if (!isKnockIn && crossed) return 0;
  }

  if (asian) {
    const freq = asian.observationFrequency;
    const interval = Math.max(1, Math.floor(steps / freq));
    const obs: number[] = [];
    for (let i = interval; i <= steps; i += interval) obs.push(path[i]);
    if (obs.length === 0) obs.push(path[steps]);
    let avg: number;
    if (asian.averageType === "geometric") {
      avg = Math.exp(obs.reduce((s, p) => s + Math.log(p), 0) / obs.length);
    } else {
      avg = obs.reduce((s, p) => s + p, 0) / obs.length;
    }
    return optionType === "call" ? Math.max(avg - K, 0) : Math.max(K - avg, 0);
  }

  if (optionStyle === "lookback") {
    return optionType === "call"
      ? Math.max(path[steps] - Math.min(...path), 0)
      : Math.max(Math.max(...path) - path[steps], 0);
  }

  return null; // not an exotic — caller handles European/American
}

// ============================================================
// LONGSTAFF-SCHWARTZ (2001) — Proper regression-based American
// ============================================================
// Takes a pre-simulated matrix of paths (numSims × steps+1).
// Returns the LSM price (already discounted to t=0).
function longstaffSchwartzPrice(
  paths: number[][],
  K: number,
  r: number,
  T: number,
  optionType: OptionType,
  S0: number,
): number {
  const numSims = paths.length;
  const steps = paths[0].length - 1;
  const dt = T / steps;
  const discountFactor = Math.exp(-r * dt);

  // cashFlow[i] = present value of optimal exercise cashflow for path i
  // Initialise at terminal payoff
  const cashFlow = new Array(numSims);
  for (let i = 0; i < numSims; i++) {
    const S = paths[i][steps];
    cashFlow[i] = optionType === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  }

  // Backward induction from step steps-1 down to step 1
  for (let t = steps - 1; t >= 1; t--) {
    // Discount all future cashflows back one step
    for (let i = 0; i < numSims; i++) cashFlow[i] *= discountFactor;

    // Identify in-the-money paths at this time step
    const itmIdx: number[] = [];
    for (let i = 0; i < numSims; i++) {
      const S = paths[i][t];
      const intrinsic = optionType === "call" ? S - K : K - S;
      if (intrinsic > 0) itmIdx.push(i);
    }

    if (itmIdx.length < 10) continue; // need enough points for regression

    // Build design matrix X (Laguerre basis) and response y (discounted continuation)
    const X: [number, number, number][] = [];
    const y: number[] = [];
    for (const i of itmIdx) {
      const x = paths[i][t] / S0; // normalize spot
      X.push(laguerreBasis(x));
      y.push(cashFlow[i]); // continuation value (discounted future payoff)
    }

    const beta = ols3(X, y);

    // Compare estimated continuation with immediate exercise
    for (const i of itmIdx) {
      const S = paths[i][t];
      const intrinsic = optionType === "call" ? S - K : K - S;
      const x = S / S0;
      const basis = laguerreBasis(x);
      const continuation = beta[0] * basis[0] + beta[1] * basis[1] + beta[2] * basis[2];
      if (intrinsic > continuation && intrinsic > 0) {
        // Exercise now: replace future cashflow with today's intrinsic (un-discounted yet)
        cashFlow[i] = intrinsic;
      }
    }
  }

  // Price = average of (discounted) cashflows, discounted back from t=1 to t=0
  for (let i = 0; i < numSims; i++) cashFlow[i] *= discountFactor;
  const price = cashFlow.reduce((s, v) => s + v, 0) / numSims;
  return Math.max(price, 0);
}

// ============================================================
// PATH GENERATION with Antithetic Variates + Sobol QMC
// ============================================================
function generatePaths(
  S: number, r: number, q: number, sigma: number, T: number,
  steps: number, numSims: number,
): number[][] {
  const paths: number[][] = [];
  const halfSims = Math.floor(numSims / 2);

  for (let i = 0; i < halfSims; i++) {
    // Draw correlated standard normals for each step — use Sobol index for QMC
    const zs: number[] = [];
    for (let t = 0; t < steps; t++) {
      const [za] = sobolNormalPair(i * steps + t + 1);
      zs.push(za);
    }
    const antiZs = zs.map((z) => -z);

    paths.push(simulateGBMPath(S, r, q, sigma, T, steps, zs));
    paths.push(simulateGBMPath(S, r, q, sigma, T, steps, antiZs));
  }
  return paths;
}

// ============================================================
// MAIN PRICER
// ============================================================
export function monteCarloPrice(opts: MonteCarloOptions): PricingResult {
  const start = performance.now();
  const { market, optionType, optionStyle, simulation, barrier, asian, garchVol } = opts;
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, volatility: sigma, timeToExpiry: T, dividendYield: q } = market;
  const { numSimulations, timeSteps } = simulation;

  // GARCH vol is the best estimate of current realised vol — use it for path simulation.
  // Falls back to market sigma (historical std) if not available.
  const effectiveSigma = garchVol ?? sigma;

  // For American options, we need all paths stored for LS regression
  const needLS = optionStyle === "american";

  const allPaths = generatePaths(S, r, q, effectiveSigma, T, timeSteps, numSimulations);
  const actualSims = allPaths.length;
  const discount = Math.exp(-r * T);

  let price: number;
  let sumPayoffSq = 0;

  if (needLS) {
    // Longstaff-Schwartz: use full path matrix
    price = longstaffSchwartzPrice(allPaths, K, r, T, optionType, S);
    // Approximate variance via terminal payoffs for CI
    for (const path of allPaths) {
      const pv = discount * (optionType === "call"
        ? Math.max(path[timeSteps] - K, 0)
        : Math.max(K - path[timeSteps], 0));
      sumPayoffSq += pv * pv;
    }
  } else {
    // European / exotic: standard discounted payoff
    let sumPayoff = 0;

    // Control variate: for European vanilla, use BS as control
    const useControlVariate = (optionStyle === "european") && !barrier && !asian;
    const bsControlPrice = useControlVariate ? blackScholesPrice(market, optionType) : 0;
    let sumControlPayoff = 0;
    let sumControlPayoffSq = 0;

    for (const path of allPaths) {
      const exotic = exoticPayoff(path, K, optionType, optionStyle, barrier, asian);
      const pv = exotic !== null ? discount * exotic : discount * (
        optionType === "call"
          ? Math.max(path[timeSteps] - K, 0)
          : Math.max(K - path[timeSteps], 0)
      );
      sumPayoff += pv;
      sumPayoffSq += pv * pv;

      if (useControlVariate) {
        const rawPv = discount * (optionType === "call"
          ? Math.max(path[timeSteps] - K, 0)
          : Math.max(K - path[timeSteps], 0));
        sumControlPayoff += rawPv;
      }
    }

    let meanPayoff = sumPayoff / actualSims;

    if (useControlVariate && sumControlPayoff > 0) {
      // Control variate correction: price_cv = price_raw - c*(mean_control - bs_price)
      // Optimal c ≈ 1 for European (same payoff is the control)
      const meanControl = sumControlPayoff / actualSims;
      const correction = meanControl - bsControlPrice;
      meanPayoff = meanPayoff - correction;
    }

    price = meanPayoff;
  }

  // 95% Confidence interval
  const meanPvSq = sumPayoffSq / actualSims;
  const variance = Math.max(0, meanPvSq - price * price);
  const stdErr = Math.sqrt(variance / actualSims);
  const ci: [number, number] = [price - 1.96 * stdErr, price + 1.96 * stdErr];

  // Sample paths for visualisation (first 20)
  const samplePaths: SimulationPath[] = [];
  const dt = T / timeSteps;
  const timePoints = Array.from({ length: timeSteps + 1 }, (_, j) => j * dt);
  for (let i = 0; i < Math.min(20, allPaths.length); i++) {
    samplePaths.push({ timePoints, prices: allPaths[i] });
  }

  // Numerical Greeks (use fewer sims for speed — same seed via Sobol for stability)
  const bumpS = S * 0.01;
  const bumpSig = 0.01;
  const bumpR = 0.001;
  const bumpT = 1 / 365;

  const priceUp  = mcPriceOnly({ ...opts, market: { ...market, spotPrice: S + bumpS } });
  const priceDown = mcPriceOnly({ ...opts, market: { ...market, spotPrice: S - bumpS } });
  const delta = (priceUp - priceDown) / (2 * bumpS);
  const gamma = (priceUp - 2 * price + priceDown) / (bumpS * bumpS);

  const priceTheta = mcPriceOnly({ ...opts, market: { ...market, timeToExpiry: Math.max(T - bumpT, 0.001) } });
  const theta = (priceTheta - price) / bumpT / 365;

  const priceVolUp = mcPriceOnly({ ...opts, market: { ...market, volatility: sigma + bumpSig } });
  const priceVolDn = mcPriceOnly({ ...opts, market: { ...market, volatility: Math.max(sigma - bumpSig, 0.01) } });
  const vega = (priceVolUp - priceVolDn) / (2 * bumpSig * 100);

  const priceRateUp = mcPriceOnly({ ...opts, market: { ...market, riskFreeRate: r + bumpR } });
  const rho = (priceRateUp - price) / (bumpR * 100);

  // Higher-order Greeks
  const vanna = (priceUp - priceDown - mcPriceOnly({ ...opts, market: { ...market, spotPrice: S + bumpS, volatility: sigma + bumpSig } }) + mcPriceOnly({ ...opts, market: { ...market, spotPrice: S + bumpS, volatility: Math.max(sigma - bumpSig, 0.01) } })) / (2 * bumpS * bumpSig * 100);
  const volga = (priceVolUp - 2 * price + priceVolDn) / (bumpSig * bumpSig * 10000);

  const intrinsicValue = optionType === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);

  return {
    price,
    greeks: { delta, gamma, theta, vega, rho, vanna, volga },
    confidenceInterval: ci,
    samplePaths,
    executionTimeMs: performance.now() - start,
    method: "monte-carlo",
    intrinsicValue,
    timeValue: price - intrinsicValue,
  };
}

function mcPriceOnly(opts: MonteCarloOptions): number {
  const { market, optionType, optionStyle, simulation, barrier, asian, garchVol } = opts;
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, volatility: sigma, timeToExpiry: T, dividendYield: q } = market;
  const reducedSims = Math.min(simulation.numSimulations, 4000);
  const steps = simulation.timeSteps;
  const effectiveSigma = garchVol ?? sigma;

  const paths = generatePaths(S, r, q, effectiveSigma, T, steps, reducedSims);
  const discount = Math.exp(-r * T);

  if (optionStyle === "american") {
    return longstaffSchwartzPrice(paths, K, r, T, optionType, S);
  }

  let sum = 0;
  for (const path of paths) {
    const exotic = exoticPayoff(path, K, optionType, optionStyle, barrier, asian);
    sum += exotic !== null ? exotic : (
      optionType === "call"
        ? Math.max(path[steps] - K, 0)
        : Math.max(K - path[steps], 0)
    );
  }
  return discount * sum / paths.length;
}
