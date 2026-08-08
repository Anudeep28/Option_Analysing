import { normalCDF } from "./math";
import { blackScholesPrice, impliedVolatility } from "./pricing/black-scholes";
import type { MarketData, OptionType } from "./types";

// Position direction relative to the option
export type TradeSide = "buy" | "sell";

export interface TradeDecisionInput {
  optionType: OptionType;
  spotPrice: number;        // current underlying price
  strikePrice: number;
  entryPremium: number;     // price you pay (buy) / receive (sell) per unit
  targetPremium: number;    // premium at which you exit for profit
  stopLossPremium?: number; // optional premium-based stop loss
  quantity: number;         // total units (lotSize * lots)
  volatility: number;       // annualized, decimal (e.g. 0.15) — historical fallback
  marketIV?: number;        // optional market implied vol (decimal) from option chain
  daysToOptionExpiry: number;
  holdingDays: number;      // how long you intend to hold (intraday = 1)
  riskFreeRate: number;     // decimal
  dividendYield: number;    // decimal
  // Optional contextual signals (each roughly -1..+1, positive = bullish on underlying)
  sentimentScore?: number;
  technicalScore?: number;  // -100..+100
  macroScore?: number;      // -100..+100, from the macro latticework engine
}

/**
 * Auto-infer whether the trade is a buy (long) or sell (short) from entry/target.
 * - Long: you profit when premium RISES  -> target > entry
 * - Short: you profit when premium FALLS -> target < entry
 */
export function inferSide(entryPremium: number, targetPremium: number): TradeSide {
  return targetPremium >= entryPremium ? "buy" : "sell";
}

/**
 * First-passage (barrier hit) probability for a GBM underlying.
 * Returns P(the underlying touches `barrier` at any time within `t` years).
 * Uses the reflection-principle closed form.
 */
export function firstPassageProbability(
  S0: number,
  barrier: number,
  sigma: number,
  t: number,
  drift: number, // continuous drift of the underlying (e.g. r - q)
): number {
  if (S0 <= 0 || barrier <= 0 || sigma <= 0 || t <= 0) return 0;
  if (S0 === barrier) return 1;

  const b = Math.log(barrier / S0);          // log-distance to barrier
  const m = drift - 0.5 * sigma * sigma;     // drift in log space
  const vol = sigma * Math.sqrt(t);

  if (barrier > S0) {
    // Upward barrier: P(max_{0..t} X >= b)
    const term1 = normalCDF((-b + m * t) / vol);
    const term2 = Math.exp((2 * m * b) / (sigma * sigma)) * normalCDF((-b - m * t) / vol);
    return Math.min(1, Math.max(0, term1 + term2));
  } else {
    // Downward barrier: P(min_{0..t} X <= b)
    const term1 = normalCDF((b - m * t) / vol);
    const term2 = Math.exp((2 * m * b) / (sigma * sigma)) * normalCDF((b + m * t) / vol);
    return Math.min(1, Math.max(0, term1 + term2));
  }
}

/**
 * Numerically find the underlying spot price at which the option's
 * Black-Scholes premium equals `targetPremium`, given remaining time T.
 * Uses bisection. Returns null if not solvable within bounds.
 */
export function findSpotForPremium(
  targetPremium: number,
  base: MarketData,
  optionType: OptionType,
): number | null {
  if (targetPremium <= 0) {
    // Premium ~0 means deep OTM. Approximate by a far OTM spot.
    return optionType === "call" ? base.strikePrice * 0.5 : base.strikePrice * 1.5;
  }

  const priceAt = (S: number) =>
    blackScholesPrice({ ...base, spotPrice: S }, optionType);

  // For a call, premium increases with spot; for a put, premium decreases with spot.
  // Establish search bounds.
  let lo = Math.max(0.01, base.strikePrice * 0.2);
  let hi = base.strikePrice * 3;

  // Ensure target is within [price(lo), price(hi)] range
  const pLo = priceAt(lo);
  const pHi = priceAt(hi);
  const minP = Math.min(pLo, pHi);
  const maxP = Math.max(pLo, pHi);
  if (targetPremium < minP || targetPremium > maxP) {
    // Expand high bound for very high targets
    if (targetPremium > maxP) hi = base.strikePrice * 10;
  }

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const pMid = priceAt(mid);
    const diff = pMid - targetPremium;
    if (Math.abs(diff) < 0.001) return mid;

    // Monotonic: call increasing in S, put decreasing in S
    if (optionType === "call") {
      if (pMid < targetPremium) lo = mid; else hi = mid;
    } else {
      if (pMid < targetPremium) hi = mid; else lo = mid;
    }
  }
  return (lo + hi) / 2;
}

export type Verdict = "GO" | "FAVORABLE" | "NEUTRAL" | "RISKY" | "AVOID";

export interface TradeDecisionResult {
  side: TradeSide;
  // Money
  profitPerUnit: number;
  totalProfit: number;
  maxLossPerUnit: number;
  totalMaxLoss: number;
  riskReward: number;          // reward / risk
  investment: number;          // capital deployed (long) or margin proxy (short)
  // Probabilities
  requiredSpotForTarget: number | null;
  requiredMovePct: number | null;       // % move in underlying to hit target
  probTarget: number;          // probability of hitting target (0..1)
  probStopLoss: number;        // probability of hitting stop (0..1)
  expectedValue: number;       // EV in currency over the position
  // Direction
  underlyingBiasNeeded: "up" | "down";
  // Volatility actually used
  impliedVolUsed: number;      // decimal volatility used for pricing/probabilities
  volSource: "implied" | "market" | "historical";
  // Verdict
  verdict: Verdict;
  confidence: number;          // 0..100
  reasons: string[];
  warnings: string[];
}

export function evaluateTrade(input: TradeDecisionInput): TradeDecisionResult {
  const {
    optionType, spotPrice, strikePrice, entryPremium, targetPremium, stopLossPremium,
    quantity, volatility: historicalVol, marketIV, daysToOptionExpiry, holdingDays,
    riskFreeRate, dividendYield, sentimentScore = 0, technicalScore = 0, macroScore = 0,
  } = input;

  const side = inferSide(entryPremium, targetPremium);
  const reasons: string[] = [];
  const warnings: string[] = [];

  // --- Effective volatility ---
  // Most accurate: the IV implied by the premium you actually paid.
  // Priority: provided market IV (option chain) > IV solved from entry premium > historical.
  const optionT = Math.max(daysToOptionExpiry / 365, 1 / 365);
  let volatility = historicalVol;
  let volSource: "implied" | "market" | "historical" = "historical";
  if (marketIV !== undefined && marketIV > 0.005) {
    volatility = marketIV;
    volSource = "market";
  } else {
    const iv = impliedVolatility(
      entryPremium,
      { spotPrice, strikePrice, riskFreeRate, dividendYield, timeToExpiry: optionT },
      optionType,
    );
    if (iv !== null && iv > 0.005 && iv < 4.9) {
      volatility = iv;
      volSource = "implied";
    }
  }

  // --- P&L ---
  // Long: profit = target - entry. Short: profit = entry - target.
  const profitPerUnit = side === "buy"
    ? targetPremium - entryPremium
    : entryPremium - targetPremium;
  const totalProfit = profitPerUnit * quantity;

  // Max loss:
  // Long: lose entire premium if it expires worthless (or to stop)
  // Short: theoretically large; use stop if given, else estimate at a 2-sigma adverse move
  let maxLossPerUnit: number;
  if (stopLossPremium !== undefined && stopLossPremium > 0) {
    maxLossPerUnit = side === "buy"
      ? Math.max(0, entryPremium - stopLossPremium)
      : Math.max(0, stopLossPremium - entryPremium);
  } else if (side === "buy") {
    maxLossPerUnit = entryPremium; // premium can go to zero
  } else {
    // Short without stop: estimate adverse premium at +2 sigma move against you
    const holdingT = Math.max(holdingDays / 365, 1 / 365);
    const sigmaMove = volatility * Math.sqrt(holdingT);
    const adverseSpot = optionType === "call"
      ? spotPrice * Math.exp(2 * sigmaMove)   // call short hurt by spot up
      : spotPrice * Math.exp(-2 * sigmaMove);  // put short hurt by spot down
    const tRemain = Math.max((daysToOptionExpiry - holdingDays) / 365, 1 / 365);
    const adversePremium = blackScholesPrice(
      { spotPrice: adverseSpot, strikePrice, riskFreeRate, volatility, timeToExpiry: tRemain, dividendYield },
      optionType,
    );
    maxLossPerUnit = Math.max(0, adversePremium - entryPremium);
  }
  const totalMaxLoss = maxLossPerUnit * quantity;

  const riskReward = maxLossPerUnit > 0 ? profitPerUnit / maxLossPerUnit : Infinity;
  const investment = side === "buy" ? entryPremium * quantity : entryPremium * quantity; // premium received as proxy

  // --- Probability of hitting target ---
  const holdingT = Math.max(holdingDays / 365, 1 / 365);
  const tRemainAtExit = Math.max((daysToOptionExpiry - holdingDays) / 365, 1 / 365);

  const baseMarket: MarketData = {
    spotPrice, strikePrice, riskFreeRate, volatility,
    timeToExpiry: tRemainAtExit, dividendYield,
  };
  const requiredSpotForTarget = findSpotForPremium(targetPremium, baseMarket, optionType);

  let requiredMovePct: number | null = null;
  let probTarget = 0;
  const underlyingBiasNeeded: "up" | "down" =
    (optionType === "call") === (side === "buy") ? "up" : "down";

  // Real-world drift: blend risk-neutral with sentiment/technical/macro bias
  const biasAdj = (sentimentScore * 0.15) + (technicalScore / 100) * 0.15 + (macroScore / 100) * 0.08; // annualized drift tilt
  const drift = (riskFreeRate - dividendYield) + biasAdj;

  if (requiredSpotForTarget !== null && requiredSpotForTarget > 0) {
    requiredMovePct = ((requiredSpotForTarget - spotPrice) / spotPrice) * 100;
    probTarget = firstPassageProbability(spotPrice, requiredSpotForTarget, volatility, holdingT, drift);
  }

  // --- Probability of hitting stop loss ---
  let probStopLoss = 0;
  if (stopLossPremium !== undefined && stopLossPremium > 0) {
    const stopSpot = findSpotForPremium(stopLossPremium, baseMarket, optionType);
    if (stopSpot !== null && stopSpot > 0) {
      probStopLoss = firstPassageProbability(spotPrice, stopSpot, volatility, holdingT, drift);
    }
  }

  // --- Expected value ---
  // EV = P(target)*profit - P(stop)*loss - (residual)*partialLoss
  const pTarget = probTarget;
  const pStop = stopLossPremium ? probStopLoss : (1 - pTarget);
  const lossUsed = stopLossPremium ? totalMaxLoss : totalMaxLoss * 0.5; // if no stop, assume avg adverse = half max
  const expectedValue = (pTarget * totalProfit) - (pStop * lossUsed);

  // --- Verdict scoring ---
  let score = 50;

  // Probability of target
  if (pTarget >= 0.6) { score += 20; reasons.push(`High probability (${(pTarget * 100).toFixed(0)}%) of reaching target premium`); }
  else if (pTarget >= 0.45) { score += 10; reasons.push(`Moderate probability (${(pTarget * 100).toFixed(0)}%) of reaching target`); }
  else if (pTarget >= 0.3) { score -= 5; warnings.push(`Low probability (${(pTarget * 100).toFixed(0)}%) of reaching target`); }
  else { score -= 20; warnings.push(`Very low probability (${(pTarget * 100).toFixed(0)}%) of reaching target premium`); }

  // Risk-reward
  if (riskReward >= 2) { score += 15; reasons.push(`Excellent risk-reward of ${riskReward.toFixed(1)}:1`); }
  else if (riskReward >= 1) { score += 5; reasons.push(`Acceptable risk-reward of ${riskReward.toFixed(1)}:1`); }
  else if (riskReward >= 0.5) { score -= 5; warnings.push(`Below-par risk-reward of ${riskReward.toFixed(1)}:1`); }
  else { score -= 15; warnings.push(`Poor risk-reward of ${riskReward.toFixed(2)}:1 — risking a lot for little`); }

  // Expected value
  if (expectedValue > 0) { score += 10; reasons.push(`Positive expected value of ${expectedValue >= 0 ? "+" : ""}${expectedValue.toFixed(0)}`); }
  else { score -= 10; warnings.push(`Negative expected value (${expectedValue.toFixed(0)}) — odds not in your favor`); }

  // Directional alignment with sentiment/technicals/macro
  const combinedBias = (sentimentScore * 50) + (technicalScore / 2) + (macroScore / 2.5); // ~ -100..100
  const wantsUp = underlyingBiasNeeded === "up";
  if (wantsUp && combinedBias > 15) { score += 10; reasons.push("News, technicals & macro lean bullish, aligned with this trade"); }
  else if (!wantsUp && combinedBias < -15) { score += 10; reasons.push("News, technicals & macro lean bearish, aligned with this trade"); }
  else if (wantsUp && combinedBias < -15) { score -= 12; warnings.push("News, technicals & macro lean bearish but trade needs an UP move"); }
  else if (!wantsUp && combinedBias > 15) { score -= 12; warnings.push("News, technicals & macro lean bullish but trade needs a DOWN move"); }
  if (macroScore !== 0 && Math.abs(macroScore) > 30) {
    warnings.push(`Macro latticework score is ${macroScore > 0 ? "+" : ""}${macroScore.toFixed(0)} — a strong macro headwind/tailwind is in play`);
  }

  // Time-decay caution for option BUYERS on short holds
  if (side === "buy" && holdingDays <= 1 && daysToOptionExpiry <= 7) {
    warnings.push("Buying short-dated options for intraday — theta decay works against you fast");
    score -= 5;
  }
  // Premium-selling reminder for SHORT trades
  if (side === "sell") {
    reasons.push("Selling premium — time decay (theta) works in your favor");
    if (stopLossPremium === undefined) {
      warnings.push("No stop-loss set on a short option — losses can escalate quickly");
      score -= 8;
    }
  }

  // Required move sanity
  if (requiredMovePct !== null && Math.abs(requiredMovePct) > (volatility * Math.sqrt(holdingT) * 100 * 2)) {
    warnings.push(`Target needs a ${Math.abs(requiredMovePct).toFixed(1)}% ${requiredMovePct > 0 ? "rise" : "fall"} — larger than a typical 2σ move for this horizon`);
    score -= 8;
  }

  // Volatility source note
  if (volSource === "market") reasons.push(`Using live market IV of ${(volatility * 100).toFixed(1)}% for accuracy`);
  else if (volSource === "implied") reasons.push(`Using IV of ${(volatility * 100).toFixed(1)}% implied by your entry premium`);
  else warnings.push("Using historical volatility (couldn't derive IV from premium) — pick the real strike for accuracy");

  score = Math.max(0, Math.min(100, score));

  let verdict: Verdict;
  if (score >= 75) verdict = "GO";
  else if (score >= 60) verdict = "FAVORABLE";
  else if (score >= 45) verdict = "NEUTRAL";
  else if (score >= 30) verdict = "RISKY";
  else verdict = "AVOID";

  return {
    side,
    profitPerUnit, totalProfit, maxLossPerUnit, totalMaxLoss, riskReward, investment,
    requiredSpotForTarget, requiredMovePct, probTarget, probStopLoss, expectedValue,
    underlyingBiasNeeded,
    impliedVolUsed: volatility, volSource,
    verdict, confidence: score, reasons, warnings,
  };
}

// --- Stock Movement Forecast ---

export interface StockForecastInput {
  spotPrice: number;
  volatility: number;       // annualized decimal
  days: number;             // horizon in days
  riskFreeRate: number;
  dividendYield: number;
  sentimentScore?: number;  // -1..1
  technicalScore?: number;  // -100..100
  macroScore?: number;      // -100..+100
}

export interface StockForecastResult {
  horizonDays: number;
  expectedPrice: number;        // drift-adjusted expected close
  oneSigmaLow: number;
  oneSigmaHigh: number;
  twoSigmaLow: number;
  twoSigmaHigh: number;
  probUp: number;               // P(close > current)
  probDown: number;
  dailySigmaPct: number;        // expected daily move %
  horizonSigmaPct: number;      // expected move over horizon %
  bias: "bullish" | "bearish" | "neutral";
  biasStrength: number;         // 0..100
}

export function forecastStockMovement(input: StockForecastInput): StockForecastResult {
  const { spotPrice, volatility, days, riskFreeRate, dividendYield,
    sentimentScore = 0, technicalScore = 0, macroScore = 0 } = input;

  const t = Math.max(days / 365, 1 / 365);
  const sigmaT = volatility * Math.sqrt(t);

  // Blend risk-neutral drift with behavioral bias
  const biasAdj = (sentimentScore * 0.12) + (technicalScore / 100) * 0.12 + (macroScore / 100) * 0.06;
  const drift = (riskFreeRate - dividendYield) + biasAdj;
  const mu = (drift - 0.5 * volatility * volatility) * t; // log-space mean

  const expectedPrice = spotPrice * Math.exp(drift * t);
  const oneSigmaHigh = spotPrice * Math.exp(mu + sigmaT);
  const oneSigmaLow = spotPrice * Math.exp(mu - sigmaT);
  const twoSigmaHigh = spotPrice * Math.exp(mu + 2 * sigmaT);
  const twoSigmaLow = spotPrice * Math.exp(mu - 2 * sigmaT);

  // P(S_t > S0) = N(mu / sigmaT)
  const probUp = normalCDF(mu / sigmaT);
  const probDown = 1 - probUp;

  const combinedBias = (sentimentScore * 50) + (technicalScore / 2) + (macroScore / 2.5);
  let bias: "bullish" | "bearish" | "neutral";
  if (combinedBias > 15) bias = "bullish";
  else if (combinedBias < -15) bias = "bearish";
  else bias = "neutral";

  return {
    horizonDays: days,
    expectedPrice,
    oneSigmaLow, oneSigmaHigh, twoSigmaLow, twoSigmaHigh,
    probUp, probDown,
    dailySigmaPct: (volatility / Math.sqrt(252)) * 100,
    horizonSigmaPct: sigmaT * 100,
    bias,
    biasStrength: Math.min(100, Math.abs(combinedBias)),
  };
}
