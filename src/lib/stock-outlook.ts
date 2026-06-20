// ============================================================
// Stock Outlook Engine
// ============================================================
// Combines GARCH volatility, technicals, and GBM probability
// to produce a unified directional signal + price cone.

import { normalCDF } from "./math";
import type { TechnicalIndicators } from "./technicals";

// ─── Price Cone (GARCH-based confidence bands) ─────────────────────────────

export interface PriceConePoint {
  day: number;
  mid: number;      // GBM expected price (drift-adjusted)
  low68: number;    // 1-sigma lower band (68% CI)
  high68: number;   // 1-sigma upper band
  low95: number;    // 2-sigma lower band (95% CI)
  high95: number;   // 2-sigma upper band
}

/**
 * Build a GBM price cone using GARCH current vol as σ.
 * μ is the risk-neutral drift (r - q) — we add a technical bias.
 */
export function buildPriceCone(
  spot: number,
  annualVol: number,
  riskFreeRate: number,
  dividendYield: number,
  horizonDays: number,
  technicalScore: number, // -100 to +100
): PriceConePoint[] {
  const points: PriceConePoint[] = [];

  // Convert technical score to a small annualised drift adjustment
  // Score +100 → +5% extra drift, Score -100 → -5%
  const techDrift = (technicalScore / 100) * 0.05;
  const mu = riskFreeRate - dividendYield + techDrift;

  for (let d = 0; d <= horizonDays; d++) {
    const t = d / 365;
    const mid = spot * Math.exp(mu * t);
    const sigma_sqrt_t = annualVol * Math.sqrt(t);
    // Log-normal distribution: quantiles of S_t
    const low68  = spot * Math.exp((mu - 0.5 * annualVol ** 2) * t - sigma_sqrt_t);
    const high68 = spot * Math.exp((mu - 0.5 * annualVol ** 2) * t + sigma_sqrt_t);
    const low95  = spot * Math.exp((mu - 0.5 * annualVol ** 2) * t - 2 * sigma_sqrt_t);
    const high95 = spot * Math.exp((mu - 0.5 * annualVol ** 2) * t + 2 * sigma_sqrt_t);
    points.push({ day: d, mid, low68, high68, low95, high95 });
  }
  return points;
}

// ─── Price Target Probability ──────────────────────────────────────────────

export interface TargetProbability {
  targetPrice: number;
  horizonDays: number;
  probAbove: number;  // P(S_T > target) at horizon
  probBelow: number;
  probTouchUp: number;  // first-passage: P(touches target any time before T) — upward
  probTouchDown: number;
  expectedMove: number; // expected % move from spot to target
}

export function computeTargetProbability(
  spot: number,
  targetPrice: number,
  annualVol: number,
  riskFreeRate: number,
  dividendYield: number,
  horizonDays: number,
  technicalScore: number,
): TargetProbability {
  const techDrift = (technicalScore / 100) * 0.05;
  const mu = riskFreeRate - dividendYield + techDrift;
  const t = Math.max(horizonDays / 365, 1 / 365);
  const sqrtT = Math.sqrt(t);

  // Log-normal terminal probability P(S_T > target)
  const d2 = (Math.log(spot / targetPrice) + (mu - 0.5 * annualVol ** 2) * t) / (annualVol * sqrtT);
  const probAbove = normalCDF(d2);
  const probBelow = 1 - probAbove;

  // First-passage probability (reflection principle)
  // P(max_{0..T} S_t >= H) for H > spot (barrier above)
  const logRatio = Math.log(targetPrice / spot);
  let probTouchUp = 0;
  let probTouchDown = 0;

  if (targetPrice > spot) {
    // Upward barrier
    const drift = mu - 0.5 * annualVol ** 2;
    const a = (logRatio - drift * t) / (annualVol * sqrtT);
    const b = (-logRatio - drift * t) / (annualVol * sqrtT);
    probTouchUp = normalCDF(-a) + Math.exp(2 * drift * logRatio / (annualVol ** 2)) * normalCDF(-b);
    probTouchUp = Math.min(probTouchUp, 1);
    probTouchDown = 0;
  } else {
    // Downward barrier
    const absLog = Math.abs(logRatio);
    const drift = mu - 0.5 * annualVol ** 2;
    const a = (absLog + drift * t) / (annualVol * sqrtT);
    const b = (absLog - drift * t) / (annualVol * sqrtT);
    probTouchDown = normalCDF(-a) + Math.exp(-2 * drift * absLog / (annualVol ** 2)) * normalCDF(-b);
    probTouchDown = Math.min(Math.max(probTouchDown, 0), 1);
    probTouchUp = 0;
  }

  return {
    targetPrice,
    horizonDays,
    probAbove: Math.max(0, Math.min(1, probAbove)),
    probBelow: Math.max(0, Math.min(1, probBelow)),
    probTouchUp: Math.max(0, Math.min(1, probTouchUp)),
    probTouchDown: Math.max(0, Math.min(1, probTouchDown)),
    expectedMove: ((targetPrice - spot) / spot) * 100,
  };
}

// ─── Consolidated Signal ──────────────────────────────────────────────────

export type SignalStrength = "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";

export interface ConsolidatedSignal {
  signal: SignalStrength;
  score: number;              // -100 to +100
  confidence: number;         // 0-100% how strongly signals agree
  components: {
    label: string;
    signal: "bullish" | "bearish" | "neutral";
    weight: number;
    contribution: number;
    detail: string;
  }[];
  summary: string;
  keyRisk: string;
}

export function buildConsolidatedSignal(
  technicals: TechnicalIndicators | null,
  garchVol: number | null,
  historicalVol: number,
  sentimentScore: number | undefined,
  vixLevel: number | undefined,
): ConsolidatedSignal {
  const components: ConsolidatedSignal["components"] = [];
  let totalScore = 0;
  let totalWeight = 0;

  // 1. Trend (weight 35)
  if (technicals) {
    const trendScore =
      technicals.trendDirection === "strong_uptrend" ? 35 :
      technicals.trendDirection === "uptrend" ? 20 :
      technicals.trendDirection === "strong_downtrend" ? -35 :
      technicals.trendDirection === "downtrend" ? -20 : 0;
    components.push({
      label: "Trend (SMA 50/200)",
      signal: trendScore > 0 ? "bullish" : trendScore < 0 ? "bearish" : "neutral",
      weight: 35,
      contribution: trendScore,
      detail: technicals.trendDirection.replace(/_/g, " "),
    });
    totalScore += trendScore; totalWeight += 35;
  }

  // 2. RSI (weight 15)
  if (technicals) {
    const rsiScore =
      technicals.rsiSignal === "oversold" ? 15 :
      technicals.rsiSignal === "overbought" ? -15 : 0;
    components.push({
      label: "RSI-14",
      signal: rsiScore > 0 ? "bullish" : rsiScore < 0 ? "bearish" : "neutral",
      weight: 15,
      contribution: rsiScore,
      detail: `RSI ${technicals.rsi14.toFixed(1)} — ${technicals.rsiSignal}`,
    });
    totalScore += rsiScore; totalWeight += 15;
  }

  // 3. MACD (weight 20)
  if (technicals) {
    const macdScore =
      technicals.macdSignal === "bullish" ? 20 :
      technicals.macdSignal === "bearish" ? -20 : 0;
    components.push({
      label: "MACD",
      signal: technicals.macdSignal === "bullish" ? "bullish" : technicals.macdSignal === "bearish" ? "bearish" : "neutral",
      weight: 20,
      contribution: macdScore,
      detail: `Histogram ${technicals.macd.histogram >= 0 ? "+" : ""}${technicals.macd.histogram.toFixed(2)}`,
    });
    totalScore += macdScore; totalWeight += 20;
  }

  // 4. Bollinger (weight 10)
  if (technicals) {
    const bbScore =
      technicals.bbSignal === "oversold" ? 10 :
      technicals.bbSignal === "overbought" ? -10 : 0;
    components.push({
      label: "Bollinger Bands",
      signal: bbScore > 0 ? "bullish" : bbScore < 0 ? "bearish" : "neutral",
      weight: 10,
      contribution: bbScore,
      detail: `%B = ${(technicals.bollingerBands.percentB * 100).toFixed(0)}%`,
    });
    totalScore += bbScore; totalWeight += 10;
  }

  // 5. News Sentiment (weight 15)
  if (sentimentScore !== undefined) {
    const sentScore = Math.round((sentimentScore / 100) * 15);
    components.push({
      label: "News Sentiment",
      signal: sentScore > 3 ? "bullish" : sentScore < -3 ? "bearish" : "neutral",
      weight: 15,
      contribution: sentScore,
      detail: `Score ${sentimentScore > 0 ? "+" : ""}${sentimentScore.toFixed(0)}/100`,
    });
    totalScore += sentScore; totalWeight += 15;
  }

  // 6. Vol Regime (weight 5) — compressed vol → directionally neutral, elevated → caution
  if (garchVol !== null) {
    const volRatio = garchVol / Math.max(historicalVol, 0.01);
    const volScore = volRatio > 1.3 ? -5 : volRatio < 0.8 ? 3 : 0;
    components.push({
      label: "Volatility Regime",
      signal: volScore < 0 ? "bearish" : volScore > 0 ? "bullish" : "neutral",
      weight: 5,
      contribution: volScore,
      detail: `GARCH vol ${(garchVol * 100).toFixed(1)}% vs HVol ${(historicalVol * 100).toFixed(1)}%`,
    });
    totalScore += volScore; totalWeight += 5;
  }

  // Normalise score to -100..+100 range
  const maxPossible = totalWeight;
  const normScore = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;

  // Confidence = how much signals agree (low disagreement = high confidence)
  const bullCount = components.filter((c) => c.signal === "bullish").length;
  const bearCount = components.filter((c) => c.signal === "bearish").length;
  const totalSig = components.length;
  const agreement = totalSig > 0 ? Math.max(bullCount, bearCount) / totalSig : 0.5;
  const confidence = Math.round(agreement * 100);

  let signal: SignalStrength;
  if (normScore >= 50) signal = "strong_buy";
  else if (normScore >= 20) signal = "buy";
  else if (normScore <= -50) signal = "strong_sell";
  else if (normScore <= -20) signal = "sell";
  else signal = "neutral";

  // Summary sentence
  const trendText = technicals?.trendDirection.replace(/_/g, " ") ?? "unknown trend";
  const sentText = sentimentScore !== undefined
    ? sentimentScore > 20 ? "positive news sentiment" : sentimentScore < -20 ? "negative news sentiment" : "neutral sentiment"
    : "no sentiment data";

  const summary =
    signal === "strong_buy" ? `Strong bullish setup: ${trendText}, ${sentText}. High conviction long trade.` :
    signal === "buy" ? `Mild bullish bias: ${trendText}, ${sentText}. Favour calls or bull spreads.` :
    signal === "strong_sell" ? `Strong bearish setup: ${trendText}, ${sentText}. High conviction short.` :
    signal === "sell" ? `Mild bearish bias: ${trendText}, ${sentText}. Favour puts or bear spreads.` :
    `Mixed signals: ${trendText}, ${sentText}. No clear directional edge — neutral/volatility strategies preferred.`;

  const keyRisk =
    vixLevel !== undefined && vixLevel > 20
      ? `India VIX at ${vixLevel.toFixed(1)} — elevated market fear. Expect wider price swings.`
      : garchVol !== null && garchVol > historicalVol * 1.3
        ? "Current GARCH vol is significantly above long-run average — vol mean-reversion risk."
        : "Signals can lag actual price moves. Always use a stop loss.";

  return { signal, score: normScore, confidence, components, summary, keyRisk };
}
