import { normalCDF, normalPDF } from "../math";
import type { MarketData, OptionType, Greeks, PricingResult } from "../types";

/**
 * Solve for the implied volatility that makes the Black-Scholes price equal
 * `premium`. Uses Newton-Raphson with a bisection fallback for robustness.
 * Returns null if the premium is outside no-arbitrage bounds.
 */
export function impliedVolatility(
  premium: number,
  market: Omit<MarketData, "volatility">,
  optionType: OptionType,
): number | null {
  const { spotPrice: S, strikePrice: K, riskFreeRate: r, timeToExpiry: T, dividendYield: q } = market;

  if (premium <= 0 || T <= 0 || S <= 0 || K <= 0) return null;

  const intrinsic = optionType === "call"
    ? Math.max(S - K, 0)
    : Math.max(K - S, 0);
  if (premium < intrinsic) return null;

  // Vega is S * sqrt(T) * pdf(d1) * exp(-qT) / 100
  function vegaAt(sigma: number): number {
    if (sigma <= 0) return 0;
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    return (S * Math.exp(-q * T) * Math.sqrt(T) * normalPDF(d1)) / 100;
  }

  function priceAt(sigma: number): number {
    return blackScholesPrice({ ...market, volatility: sigma }, optionType);
  }

  // Bracket the root
  let lo = 0.001;
  let hi = 5.0;
  let pLo = priceAt(lo);
  let pHi = priceAt(hi);

  if (premium > Math.max(pLo, pHi)) return null;

  // If premium is above hi, expand; if below lo, return null
  if (premium > pHi) {
    hi = 10.0;
    pHi = priceAt(hi);
    if (premium > pHi) return null;
  }

  let sigma = Math.sqrt(2 * Math.PI / T) * (premium / S); // rough initial guess
  sigma = Math.max(lo, Math.min(hi, sigma));

  for (let i = 0; i < 100; i++) {
    const price = priceAt(sigma);
    const diff = price - premium;
    if (Math.abs(diff) < 1e-6) return sigma;

    const v = vegaAt(sigma);
    let sigmaNew = sigma;
    if (v > 1e-10) {
      sigmaNew = sigma - diff / v;
    }

    // Fall back to bisection if Newton steps outside bracket or vega too small
    if (sigmaNew <= lo || sigmaNew >= hi || v <= 1e-10) {
      const mid = (lo + hi) / 2;
      const pMid = priceAt(mid);
      if ((pMid - premium) * (pLo - premium) > 0) {
        lo = mid;
        pLo = pMid;
      } else {
        hi = mid;
        pHi = pMid;
      }
      sigmaNew = (lo + hi) / 2;
    }

    sigma = sigmaNew;
  }

  return sigma;
}

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

  // --- Higher-order Greeks (analytical closed-form) ---
  // Vanna: ∂²V/∂S∂σ = -expQT * pdfD1 * D2 / sigma  (per 1% vol move: /100)
  const vanna = -expQT * pdfD1 * (D2 / sigma) / 100;

  // Volga (Vomma): ∂²V/∂σ² = vega * D1 * D2 / sigma  (per 1% vol move: /100)
  const volga = (vega * D1 * D2) / (sigma * 100);

  // Charm: ∂²V/∂S∂t (delta decay per day)
  // call:  -expQT * pdfD1 * (2*(r-q)*T - D2*sigma*sqrtT) / (2*T*sigma*sqrtT) + q*expQT*N(D1)
  // put:   same first term - q*expQT*N(-D1)
  let charm: number;
  if (optionType === "call") {
    charm = -expQT * (pdfD1 * ((2 * (r - q) * T - D2 * sigma * sqrtT) / (2 * T * sigma * sqrtT)) - q * normalCDF(D1)) / 365;
  } else {
    charm = -expQT * (pdfD1 * ((2 * (r - q) * T - D2 * sigma * sqrtT) / (2 * T * sigma * sqrtT)) + q * normalCDF(-D1)) / 365;
  }

  // Speed: ∂³V/∂S³ = -gamma/S * (D1/(sigma*sqrtT) + 1)
  const speed = -(gamma / S) * (D1 / (sigma * sqrtT) + 1);

  return { delta, gamma, theta: thetaPerDay, vega, rho, vanna, volga, charm, speed };
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
