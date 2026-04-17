import type { MarketData, OptionType, OptionStyle, Greeks, PricingResult } from "../types";

export function binomialTreePrice(
  market: MarketData,
  optionType: OptionType,
  optionStyle: OptionStyle,
  steps: number
): PricingResult {
  const start = performance.now();
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, volatility: sigma, timeToExpiry: T, dividendYield: q } = market;

  const dt = T / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const discount = Math.exp(-r * dt);
  const p = (Math.exp((r - q) * dt) - d) / (u - d); // risk-neutral probability

  // Build price tree at expiry
  const prices: number[] = new Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const price = S * Math.pow(u, steps - i) * Math.pow(d, i);
    if (optionType === "call") {
      prices[i] = Math.max(price - K, 0);
    } else {
      prices[i] = Math.max(K - price, 0);
    }
  }

  // Backward induction
  const canExerciseEarly = optionStyle === "american";

  for (let step = steps - 1; step >= 0; step--) {
    for (let i = 0; i <= step; i++) {
      const holdValue = discount * (p * prices[i] + (1 - p) * prices[i + 1]);

      if (canExerciseEarly) {
        const spotAtNode = S * Math.pow(u, step - i) * Math.pow(d, i);
        const exerciseValue = optionType === "call"
          ? Math.max(spotAtNode - K, 0)
          : Math.max(K - spotAtNode, 0);
        prices[i] = Math.max(holdValue, exerciseValue);
      } else {
        prices[i] = holdValue;
      }
    }
  }

  const price = prices[0];

  // Numerical Greeks via finite differences
  const dS = S * 0.01;
  const dSigma = 0.01;
  const dR = 0.001;
  const dT = 1 / 365;

  const priceUp = binomialPriceOnly({ ...market, spotPrice: S + dS }, optionType, optionStyle, steps);
  const priceDown = binomialPriceOnly({ ...market, spotPrice: S - dS }, optionType, optionStyle, steps);
  const delta = (priceUp - priceDown) / (2 * dS);
  const gamma = (priceUp - 2 * price + priceDown) / (dS * dS);

  const priceTimeDecay = binomialPriceOnly({ ...market, timeToExpiry: T - dT }, optionType, optionStyle, steps);
  const theta = (priceTimeDecay - price) / dT / 365;

  const priceVolUp = binomialPriceOnly({ ...market, volatility: sigma + dSigma }, optionType, optionStyle, steps);
  const vega = (priceVolUp - price) / (dSigma * 100);

  const priceRateUp = binomialPriceOnly({ ...market, riskFreeRate: r + dR }, optionType, optionStyle, steps);
  const rho = (priceRateUp - price) / (dR * 100);

  const executionTimeMs = performance.now() - start;

  const intrinsicValue = optionType === "call"
    ? Math.max(S - K, 0)
    : Math.max(K - S, 0);

  return {
    price,
    greeks: { delta, gamma, theta, vega, rho },
    executionTimeMs,
    method: "binomial-tree",
    intrinsicValue,
    timeValue: price - intrinsicValue,
  };
}

function binomialPriceOnly(
  market: MarketData,
  optionType: OptionType,
  optionStyle: OptionStyle,
  steps: number
): number {
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, volatility: sigma, timeToExpiry: T, dividendYield: q } = market;

  if (T <= 0) {
    return optionType === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  }

  const dt = T / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const discount = Math.exp(-r * dt);
  const p = (Math.exp((r - q) * dt) - d) / (u - d);

  const prices: number[] = new Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const price = S * Math.pow(u, steps - i) * Math.pow(d, i);
    prices[i] = optionType === "call" ? Math.max(price - K, 0) : Math.max(K - price, 0);
  }

  const canExerciseEarly = optionStyle === "american";

  for (let step = steps - 1; step >= 0; step--) {
    for (let i = 0; i <= step; i++) {
      const holdValue = discount * (p * prices[i] + (1 - p) * prices[i + 1]);
      if (canExerciseEarly) {
        const spotAtNode = S * Math.pow(u, step - i) * Math.pow(d, i);
        const exerciseValue = optionType === "call"
          ? Math.max(spotAtNode - K, 0)
          : Math.max(K - spotAtNode, 0);
        prices[i] = Math.max(holdValue, exerciseValue);
      } else {
        prices[i] = holdValue;
      }
    }
  }

  return prices[0];
}
