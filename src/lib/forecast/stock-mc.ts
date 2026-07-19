// ============================================================
// Stock Path Monte Carlo Engine
// ============================================================
// Runs GBM paths with GARCH-adjusted vol and a multi-signal
// drift:  risk-neutral base + sentiment + technicals + macro
// (including LLM mental-model net score when available).
//
// Variance-reduction: antithetic variates (pairs) + Sobol QMC.
// Output: simulation-derived distribution, price bands, VaR,
// tail skew, and sample paths for visualisation.
// ============================================================

import { randomNormal, sobolNormalPair } from "../math";

// ─── Input ──────────────────────────────────────────────────

export interface StockMCInput {
  spotPrice: number;
  annualVol: number;       // base historical/GARCH vol (decimal)
  garchVol?: number | null; // GARCH(1,1) current vol — takes priority over annualVol
  riskFreeRate: number;    // annual (decimal)
  dividendYield: number;   // annual (decimal)
  horizonDays: number;     // forecast horizon in calendar days

  // Signal inputs — each is optional; missing = 0 contribution
  sentimentScore?: number;   // -100..+100 (news sentiment)
  technicalScore?: number;   // -100..+100 (consolidated technical signal)
  macroScore?: number;       // -100..+100 (macro latticework net score)
  mentalModelNetScore?: number; // -100..+100 (LLM latticework net score, if available)

  // Simulation config
  numSimulations?: number;   // default 2 000 (fast & accurate enough for UI)
  timeSteps?: number;        // default min(horizonDays, 252) daily steps
  seed?: number;             // deterministic Sobol start index
}

// ─── Output ─────────────────────────────────────────────────

export interface MCPercentileBand {
  day: number;
  p5: number;
  p25: number;
  p50: number;   // median (not mean) — more robust to fat tails
  p75: number;
  p95: number;
  mean: number;  // arithmetic mean across paths at this day
}

export interface MCSamplePath {
  prices: number[];   // length = timeSteps + 1
  isBull: boolean;    // terminal price > spot
}

export interface StockMCResult {
  horizonDays: number;
  numSimulations: number;
  effectiveSigma: number;       // vol actually used for paths
  effectiveDrift: number;       // annualised drift used (risk-neutral + bias)
  driftBreakdown: {
    riskNeutral: number;
    sentimentAdj: number;
    technicalAdj: number;
    macroAdj: number;
    mentalModelAdj: number;
    total: number;
  };

  // Terminal price distribution
  terminalPrices: number[];     // sorted ascending (all sims)
  terminalMean: number;
  terminalMedian: number;
  terminalStd: number;
  probUp: number;               // P(S_T > S_0)
  probUp5pct: number;           // P(S_T > 1.05 * S_0)
  probDown5pct: number;         // P(S_T < 0.95 * S_0)

  // Confidence bands: array of {day, p5, p25, p50, p75, p95, mean}
  // Sampled at ≤60 evenly-spaced time points for rendering
  bands: MCPercentileBand[];

  // Risk metrics on terminal distribution
  varP5: number;    // Value-at-Risk at 5th percentile (terminal price)
  cvarP5: number;   // Conditional VaR: mean of worst-5% terminal prices
  tailSkew: number; // (mean_upside_5% - spot) / (spot - mean_downside_5%)
                    //  >1 right-skewed, <1 left-skewed

  // Sample paths for sparkline visualisation (first 50 kept)
  samplePaths: MCSamplePath[];

  // Expected price from drift (analytical cross-check)
  analyticalExpectedPrice: number;
}

// ─── Percentile helper ──────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * sorted.length)));
  return sorted[idx];
}

// ─── Main engine ────────────────────────────────────────────

export function runStockMC(input: StockMCInput): StockMCResult {
  const {
    spotPrice,
    riskFreeRate,
    dividendYield,
    horizonDays,
    garchVol,
    numSimulations = 2000,
    seed = 1,
  } = input;

  const effectiveSigma = (garchVol && garchVol > 0 ? garchVol : input.annualVol) || 0.25;
  const T = Math.max(horizonDays / 365, 1 / 365);
  const timeSteps = input.timeSteps ?? Math.min(Math.max(horizonDays, 1), 252);
  const dt = T / timeSteps;

  // ── Drift decomposition ─────────────────────────────────
  // Risk-neutral base (mu_rn):
  const riskNeutral = riskFreeRate - dividendYield;

  // Sentiment: -100..+100 → max ±8% annualised drift adjustment
  // Rationale: strong positive sentiment historically adds ~4-8% annualised
  // alpha for trending stocks; we use half range to avoid overfitting.
  const sentAdj = ((input.sentimentScore ?? 0) / 100) * 0.08;

  // Technical: -100..+100 → max ±6% annualised
  const techAdj = ((input.technicalScore ?? 0) / 100) * 0.06;

  // Macro latticework: -100..+100 → max ±5% annualised
  // Macro is a slower-moving signal, so we discount it more.
  const macroAdj = ((input.macroScore ?? 0) / 100) * 0.05;

  // LLM mental model net score: -100..+100 → max ±4% annualised
  // This is the most uncertain signal; small weight.
  const mmAdj = ((input.mentalModelNetScore ?? 0) / 100) * 0.04;

  const totalDrift = riskNeutral + sentAdj + techAdj + macroAdj + mmAdj;

  // Log-space drift per step (Ito correction)
  const logDrift = (totalDrift - 0.5 * effectiveSigma * effectiveSigma) * dt;
  const logDiffusion = effectiveSigma * Math.sqrt(dt);

  // ── Path simulation ─────────────────────────────────────
  // Antithetic variates: generate pairs (z, -z) to halve variance.
  // Sobol QMC numbers for the first half of sims; pseudo-random for the rest.
  const halfSims = Math.ceil(numSimulations / 2);
  const actualSims = halfSims * 2; // always even

  // We store only terminal prices for stats and the full path matrix only
  // for the first 50 paths (for visualisation).
  const terminalPrices: number[] = new Array(actualSims);

  // For bands we need cross-section prices at each time step.
  // Memory-efficient: store a Float64Array per time step (actualSims values).
  const stepPrices: Float64Array[] = Array.from(
    { length: timeSteps + 1 },
    () => new Float64Array(actualSims),
  );

  for (let s = 0; s < halfSims; s++) {
    // Sobol pair for s < half, pure random for overflow
    const [z0, z1] = s < halfSims ? sobolNormalPair(seed + s) : [randomNormal(), randomNormal()];
    const zPairs: [number, number][] = [];
    // We need timeSteps randoms per path. Seed a sequence using sobol index
    // for the first 2 and fill the rest pseudo-randomly.
    const zsFwd: number[] = new Array(timeSteps);
    const zsAnti: number[] = new Array(timeSteps);
    // First two steps from Sobol pair, rest pseudo-random (fast)
    zsFwd[0] = z0;
    zsAnti[0] = -z0;
    if (timeSteps > 1) { zsFwd[1] = z1; zsAnti[1] = -z1; }
    for (let k = 2; k < timeSteps; k++) {
      const z = randomNormal();
      zsFwd[k] = z;
      zsAnti[k] = -z;
    }

    const idxFwd = s;
    const idxAnti = s + halfSims;

    let pFwd = spotPrice;
    let pAnti = spotPrice;
    stepPrices[0][idxFwd] = spotPrice;
    stepPrices[0][idxAnti] = spotPrice;

    for (let k = 1; k <= timeSteps; k++) {
      pFwd = pFwd * Math.exp(logDrift + logDiffusion * zsFwd[k - 1]);
      pAnti = pAnti * Math.exp(logDrift + logDiffusion * zsAnti[k - 1]);
      stepPrices[k][idxFwd] = pFwd;
      stepPrices[k][idxAnti] = pAnti;
    }

    terminalPrices[idxFwd] = pFwd;
    terminalPrices[idxAnti] = pAnti;
    void zPairs; // suppress lint
  }

  // ── Terminal distribution stats ─────────────────────────
  const sorted = [...terminalPrices].sort((a, b) => a - b);
  const terminalMean = terminalPrices.reduce((s, v) => s + v, 0) / actualSims;
  const terminalMedian = percentile(sorted, 0.5);
  const variance = terminalPrices.reduce((s, v) => s + (v - terminalMean) ** 2, 0) / actualSims;
  const terminalStd = Math.sqrt(variance);

  const probUp = sorted.filter((p) => p > spotPrice).length / actualSims;
  const probUp5pct = sorted.filter((p) => p > spotPrice * 1.05).length / actualSims;
  const probDown5pct = sorted.filter((p) => p < spotPrice * 0.95).length / actualSims;

  // VaR / CVaR
  const varIdx = Math.floor(0.05 * actualSims);
  const varP5 = sorted[Math.max(0, varIdx)];
  const cvarP5 = sorted.slice(0, varIdx + 1).reduce((s, v) => s + v, 0) / (varIdx + 1);

  // Tail skew: ratio of upside tail gain to downside tail loss
  const upTail5 = sorted.slice(Math.floor(0.95 * actualSims));
  const downTail5 = sorted.slice(0, varIdx + 1);
  const meanUpTail = upTail5.reduce((s, v) => s + v, 0) / upTail5.length;
  const meanDownTail = downTail5.reduce((s, v) => s + v, 0) / downTail5.length;
  const upGain = meanUpTail - spotPrice;
  const downLoss = spotPrice - meanDownTail;
  const tailSkew = downLoss > 0 ? upGain / downLoss : 1;

  // ── Price bands at sampled time steps ───────────────────
  const renderSteps = Math.min(timeSteps, 60);
  const bands: MCPercentileBand[] = [];
  for (let r = 0; r <= renderSteps; r++) {
    const step = Math.round((r / renderSteps) * timeSteps);
    const col = Array.from(stepPrices[step]);
    col.sort((a, b) => a - b);
    const mean = col.reduce((s, v) => s + v, 0) / col.length;
    const day = Math.round((step / timeSteps) * horizonDays);
    bands.push({
      day,
      p5: percentile(col, 0.05),
      p25: percentile(col, 0.25),
      p50: percentile(col, 0.50),
      p75: percentile(col, 0.75),
      p95: percentile(col, 0.95),
      mean,
    });
  }

  // ── Sample paths for sparklines (first 50) ───────────────
  const MAX_SAMPLE = 50;
  const samplePaths: MCSamplePath[] = [];
  for (let i = 0; i < Math.min(MAX_SAMPLE, actualSims); i++) {
    const prices: number[] = new Array(timeSteps + 1);
    for (let k = 0; k <= timeSteps; k++) prices[k] = stepPrices[k][i];
    samplePaths.push({ prices, isBull: prices[timeSteps] > spotPrice });
  }

  return {
    horizonDays,
    numSimulations: actualSims,
    effectiveSigma,
    effectiveDrift: totalDrift,
    driftBreakdown: {
      riskNeutral,
      sentimentAdj: sentAdj,
      technicalAdj: techAdj,
      macroAdj: macroAdj,
      mentalModelAdj: mmAdj,
      total: totalDrift,
    },
    terminalPrices: sorted,
    terminalMean,
    terminalMedian,
    terminalStd,
    probUp,
    probUp5pct,
    probDown5pct,
    bands,
    varP5,
    cvarP5,
    tailSkew,
    samplePaths,
    analyticalExpectedPrice: spotPrice * Math.exp(totalDrift * T),
  };
}
