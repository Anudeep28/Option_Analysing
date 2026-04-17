import { randomNormal } from "../math";
import type {
  MarketData, OptionType, OptionStyle, SimulationParams,
  BarrierParams, AsianParams, Greeks, PricingResult, SimulationPath,
} from "../types";

interface MonteCarloOptions {
  market: MarketData;
  optionType: OptionType;
  optionStyle: OptionStyle;
  simulation: SimulationParams;
  barrier?: BarrierParams;
  asian?: AsianParams;
}

function simulatePath(
  S: number, r: number, q: number, sigma: number, T: number, steps: number
): number[] {
  const dt = T / steps;
  const drift = (r - q - 0.5 * sigma * sigma) * dt;
  const diffusion = sigma * Math.sqrt(dt);

  const path = new Array(steps + 1);
  path[0] = S;
  for (let i = 1; i <= steps; i++) {
    const z = randomNormal();
    path[i] = path[i - 1] * Math.exp(drift + diffusion * z);
  }
  return path;
}

function payoff(
  path: number[],
  K: number,
  optionType: OptionType,
  optionStyle: OptionStyle,
  barrier?: BarrierParams,
  asian?: AsianParams,
  r?: number,
  q?: number,
  T?: number,
): number {
  const steps = path.length - 1;

  // Barrier check
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

  // Asian option: use average price
  if (asian) {
    const freq = asian.observationFrequency;
    const interval = Math.max(1, Math.floor(steps / freq));
    const observations: number[] = [];
    for (let i = interval; i <= steps; i += interval) {
      observations.push(path[i]);
    }
    if (observations.length === 0) observations.push(path[steps]);

    let avgPrice: number;
    if (asian.averageType === "geometric") {
      const logSum = observations.reduce((s, p) => s + Math.log(p), 0);
      avgPrice = Math.exp(logSum / observations.length);
    } else {
      avgPrice = observations.reduce((s, p) => s + p, 0) / observations.length;
    }

    return optionType === "call" ? Math.max(avgPrice - K, 0) : Math.max(K - avgPrice, 0);
  }

  // American option: Longstaff-Schwartz (simplified)
  if (optionStyle === "american" && r !== undefined && T !== undefined) {
    const dt = T / steps;
    let exerciseValue = 0;
    // Simple approach: check each step for early exercise
    for (let i = 1; i <= steps; i++) {
      const ev = optionType === "call"
        ? Math.max(path[i] - K, 0)
        : Math.max(K - path[i], 0);
      if (ev > 0) {
        const discounted = ev * Math.exp(-r * i * dt);
        if (discounted > exerciseValue) {
          exerciseValue = discounted;
        }
      }
    }
    // Also check terminal
    const terminal = optionType === "call"
      ? Math.max(path[steps] - K, 0)
      : Math.max(K - path[steps], 0);
    const discountedTerminal = terminal * Math.exp(-r * T);
    return Math.max(exerciseValue, discountedTerminal) * Math.exp(r * T); // un-discount for later
  }

  // Lookback option
  if (optionStyle === "lookback") {
    if (optionType === "call") {
      const minPrice = Math.min(...path);
      return Math.max(path[steps] - minPrice, 0);
    } else {
      const maxPrice = Math.max(...path);
      return Math.max(maxPrice - path[steps], 0);
    }
  }

  // European (default)
  const finalPrice = path[steps];
  return optionType === "call" ? Math.max(finalPrice - K, 0) : Math.max(K - finalPrice, 0);
}

export function monteCarloPrice(opts: MonteCarloOptions): PricingResult {
  const start = performance.now();
  const { market, optionType, optionStyle, simulation, barrier, asian } = opts;
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, volatility: sigma, timeToExpiry: T, dividendYield: q } = market;
  const { numSimulations, timeSteps } = simulation;

  const discount = Math.exp(-r * T);
  let sumPayoff = 0;
  let sumPayoffSq = 0;
  const samplePaths: SimulationPath[] = [];
  const numSamplePaths = Math.min(20, numSimulations);

  for (let i = 0; i < numSimulations; i++) {
    const path = simulatePath(S, r, q, sigma, T, timeSteps);
    const pv = payoff(path, K, optionType, optionStyle, barrier, asian, r, q, T);
    sumPayoff += pv;
    sumPayoffSq += pv * pv;

    if (i < numSamplePaths) {
      const dt = T / timeSteps;
      samplePaths.push({
        timePoints: Array.from({ length: timeSteps + 1 }, (_, j) => j * dt),
        prices: path,
      });
    }
  }

  const meanPayoff = sumPayoff / numSimulations;
  const price = discount * meanPayoff;

  // Confidence interval (95%)
  const variance = (sumPayoffSq / numSimulations) - (meanPayoff * meanPayoff);
  const stdErr = Math.sqrt(variance / numSimulations) * discount;
  const ci: [number, number] = [price - 1.96 * stdErr, price + 1.96 * stdErr];

  // Numerical Greeks
  const bump = S * 0.01;
  const bumpSigma = 0.01;
  const bumpR = 0.001;
  const bumpT = 1 / 365;

  const priceUp = mcPriceOnly({ ...opts, market: { ...market, spotPrice: S + bump } });
  const priceDown = mcPriceOnly({ ...opts, market: { ...market, spotPrice: S - bump } });
  const delta = (priceUp - priceDown) / (2 * bump);
  const gamma = (priceUp - 2 * price + priceDown) / (bump * bump);

  const priceThetaBump = mcPriceOnly({ ...opts, market: { ...market, timeToExpiry: Math.max(T - bumpT, 0.001) } });
  const theta = (priceThetaBump - price) / bumpT / 365;

  const priceVolUp = mcPriceOnly({ ...opts, market: { ...market, volatility: sigma + bumpSigma } });
  const vega = (priceVolUp - price) / (bumpSigma * 100);

  const priceRateUp = mcPriceOnly({ ...opts, market: { ...market, riskFreeRate: r + bumpR } });
  const rho = (priceRateUp - price) / (bumpR * 100);

  const executionTimeMs = performance.now() - start;

  const intrinsicValue = optionType === "call"
    ? Math.max(S - K, 0)
    : Math.max(K - S, 0);

  return {
    price,
    greeks: { delta, gamma, theta, vega, rho },
    confidenceInterval: ci,
    samplePaths,
    executionTimeMs,
    method: "monte-carlo",
    intrinsicValue,
    timeValue: price - intrinsicValue,
  };
}

function mcPriceOnly(opts: MonteCarloOptions): number {
  const { market, optionType, optionStyle, simulation, barrier, asian } = opts;
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, volatility: sigma, timeToExpiry: T, dividendYield: q } = market;
  // Use fewer simulations for bumped Greeks
  const reducedSims = Math.min(simulation.numSimulations, 5000);
  const discount = Math.exp(-r * T);
  let sumPayoff = 0;

  for (let i = 0; i < reducedSims; i++) {
    const path = simulatePath(S, r, q, sigma, T, simulation.timeSteps);
    sumPayoff += payoff(path, K, optionType, optionStyle, barrier, asian, r, q, T);
  }

  return discount * sumPayoff / reducedSims;
}
