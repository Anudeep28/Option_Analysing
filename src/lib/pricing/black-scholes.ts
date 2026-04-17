import { normalCDF, normalPDF } from "../math";
import type { MarketData, OptionType, Greeks, PricingResult } from "../types";

function d1(S: number, K: number, r: number, q: number, sigma: number, T: number): number {
  return (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
}

function d2(S: number, K: number, r: number, q: number, sigma: number, T: number): number {
  return d1(S, K, r, q, sigma, T) - sigma * Math.sqrt(T);
}

export function blackScholesPrice(market: MarketData, optionType: OptionType): number {
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, volatility: sigma, timeToExpiry: T, dividendYield: q } = market;

  if (T <= 0) {
    return optionType === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  }

  const D1 = d1(S, K, r, q, sigma, T);
  const D2 = d2(S, K, r, q, sigma, T);

  if (optionType === "call") {
    return S * Math.exp(-q * T) * normalCDF(D1) - K * Math.exp(-r * T) * normalCDF(D2);
  } else {
    return K * Math.exp(-r * T) * normalCDF(-D2) - S * Math.exp(-q * T) * normalCDF(-D1);
  }
}

export function blackScholesGreeks(market: MarketData, optionType: OptionType): Greeks {
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, volatility: sigma, timeToExpiry: T, dividendYield: q } = market;

  if (T <= 0) {
    const itm = optionType === "call" ? S > K : K > S;
    return { delta: itm ? (optionType === "call" ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }

  const D1 = d1(S, K, r, q, sigma, T);
  const D2 = d2(S, K, r, q, sigma, T);
  const sqrtT = Math.sqrt(T);
  const expQT = Math.exp(-q * T);
  const expRT = Math.exp(-r * T);
  const pdfD1 = normalPDF(D1);

  let delta: number;
  let theta: number;
  let rho: number;

  if (optionType === "call") {
    delta = expQT * normalCDF(D1);
    theta = (-S * pdfD1 * sigma * expQT / (2 * sqrtT))
      - r * K * expRT * normalCDF(D2)
      + q * S * expQT * normalCDF(D1);
    rho = K * T * expRT * normalCDF(D2) / 100;
  } else {
    delta = -expQT * normalCDF(-D1);
    theta = (-S * pdfD1 * sigma * expQT / (2 * sqrtT))
      + r * K * expRT * normalCDF(-D2)
      - q * S * expQT * normalCDF(-D1);
    rho = -K * T * expRT * normalCDF(-D2) / 100;
  }

  const gamma = pdfD1 * expQT / (S * sigma * sqrtT);
  const vega = S * sqrtT * pdfD1 * expQT / 100;

  // Theta per day
  const thetaPerDay = theta / 365;

  return { delta, gamma, theta: thetaPerDay, vega, rho };
}

export function priceEuropeanBS(market: MarketData, optionType: OptionType): PricingResult {
  const start = performance.now();
  const price = blackScholesPrice(market, optionType);
  const greeks = blackScholesGreeks(market, optionType);
  const executionTimeMs = performance.now() - start;

  const intrinsicValue = optionType === "call"
    ? Math.max(market.spotPrice - market.strikePrice, 0)
    : Math.max(market.strikePrice - market.spotPrice, 0);

  return {
    price,
    greeks,
    executionTimeMs,
    method: "black-scholes",
    intrinsicValue,
    timeValue: price - intrinsicValue,
  };
}
