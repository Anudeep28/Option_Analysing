// ============================================================
// Superforecaster Engine — orchestration
// ============================================================
// Ties the four pillars together into one probabilistic forecast:
//   1. Regime detection                  (regime.ts)
//   2. Empirical base-rate prior + tails  (base-rates.ts)
//   3. Bayesian likelihood-ratio fusion   (bayesian.ts)
//   4. Dialectic personas + disagreement  (personas.ts)
//
// Output is a PROBABILITY with honest uncertainty, an empirical
// (fat-tailed) price cone, and a strategy recommendation — not a
// single opaque -100..+100 score.

import { detectRegime, type RegimeResult } from "./regime";
import { computeBaseRates, type BaseRateResult } from "./base-rates";
import { fuseBayesian, type BayesianResult, type EvidenceInput } from "./bayesian";
import { runDialectic, type DialecticResult } from "./personas";
import {
  computeFundamentalTilts, earningsWithinHorizon,
  type CompanyProfile, type EarningsFlag,
} from "./fundamentals";
import type { TechnicalIndicators } from "../technicals";

export interface ForecastInput {
  closes: number[];
  spotPrice: number;
  horizonDays: number;
  technicals: TechnicalIndicators | null;
  garchVol: number | null;
  historicalVol: number;
  sentimentScore?: number;   // -100..100
  macroScore?: number;       // -100..100
  vixLevel?: number;
  profile?: CompanyProfile | null;
}

export interface ConePoint {
  day: number;
  mid: number;
  low68: number;
  high68: number;
  low95: number;
  high95: number;
}

export interface ForecastResult {
  horizonDays: number;
  regime: RegimeResult;
  baseRates: BaseRateResult;
  bayesian: BayesianResult;
  dialectic: DialecticResult;
  // Headline numbers
  probUp: number;            // final fused P(up)
  conviction: number;        // 0..100, accounts for edge, agreement, sample size
  direction: "bullish" | "bearish" | "neutral";
  expectedMovePct: number;   // base-rate median move over horizon
  // Empirical, fat-tailed price cone (from historical return distribution)
  empiricalCone: ConePoint[];
  // Fundamental / earnings awareness
  earnings: EarningsFlag;
  earningsWarning: string | null;
  summary: string;
}

function clampTilt(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

function buildEvidence(input: ForecastInput, regime: RegimeResult): EvidenceInput {
  const t = input.technicals;

  const trendTilt = t
    ? ({
        strong_uptrend: 1, uptrend: 0.5, sideways: 0,
        downtrend: -0.5, strong_downtrend: -1,
      } as const)[t.trendDirection]
    : 0;

  const macdTilt = t
    ? t.macdSignal === "bullish" ? 0.7 : t.macdSignal === "bearish" ? -0.7 : 0
    : 0;

  const priceVsSma = t && t.sma50 > 0
    ? clampTilt((input.spotPrice / t.sma50 - 1) * 10)
    : 0;

  // RSI 30 => +1 (oversold/bullish), RSI 70 => -1 (overbought/bearish)
  const rsiStretch = t ? clampTilt((50 - t.rsi14) / 20) : 0;
  // percentB 0 => +1, percentB 1 => -1
  const bollingerStretch = t ? clampTilt((0.5 - t.bollingerBands.percentB) * 2) : 0;

  const sentimentTilt = input.sentimentScore !== undefined ? clampTilt(input.sentimentScore / 100) : 0;
  const macroTilt = input.macroScore !== undefined ? clampTilt(input.macroScore / 100) : 0;

  // Vol expansion => mild risk-off (negative directional tilt)
  const volExpansionTilt = clampTilt(-(regime.volRatio - 1) * 1.5);

  const fundamentals = computeFundamentalTilts(input.profile ?? null, input.spotPrice);

  return {
    trendTilt, macdTilt, priceVsSma,
    rsiStretch, bollingerStretch,
    sentimentTilt, macroTilt, volExpansionTilt,
    fundamentals,
  };
}

function buildEmpiricalCone(
  spot: number,
  base: BaseRateResult,
  horizonDays: number,
  tailBump = 1,
): ConePoint[] {
  // Scale the terminal empirical quantiles back along sqrt(t) so the cone
  // fans out realistically while preserving the fat-tailed terminal shape.
  // tailBump (>1) widens the 95% tails when a binary event (earnings) falls
  // inside the horizon.
  const K = Math.max(1, horizonDays);
  const q = base.quantiles;
  const points: ConePoint[] = [];
  const steps = Math.min(K, 60);
  for (let s = 0; s <= steps; s++) {
    const day = Math.round((s / steps) * K);
    const scale = Math.sqrt(day / K);
    const f = (retPct: number, bump = 1) => spot * (1 + (retPct / 100) * scale * bump);
    points.push({
      day,
      mid: f(q.p50),
      low68: f(q.p25),
      high68: f(q.p75),
      low95: f(q.p5, tailBump),
      high95: f(q.p95, tailBump),
    });
  }
  return points;
}

export function runForecast(input: ForecastInput): ForecastResult {
  const regime = detectRegime(input.closes, input.vixLevel);
  const baseRates = computeBaseRates(input.closes, input.horizonDays);
  const ev = buildEvidence(input, regime);
  const bayesian = fuseBayesian(baseRates.prior, ev, regime);

  const expectedMovePct = (Math.abs(baseRates.quantiles.p75) + Math.abs(baseRates.quantiles.p25)) / 2;
  const dialectic = runDialectic(ev, regime, baseRates.prior, expectedMovePct);

  // Final probability: anchor on the Bayesian posterior, lightly blend the
  // persona consensus (an independent ensemble estimate).
  const probUp = 0.7 * bayesian.posterior + 0.3 * dialectic.consensusProbUp;

  const direction: ForecastResult["direction"] =
    probUp >= 0.56 ? "bullish" : probUp <= 0.44 ? "bearish" : "neutral";

  // Earnings-in-horizon awareness — the biggest scheduled vol event for
  // options. A binary event inside the horizon means: wider tails, lower
  // directional conviction, and IV-crush risk for long-option holders.
  const earnings = earningsWithinHorizon(input.profile ?? null, input.horizonDays);
  const earningsWarning = earnings.withinHorizon
    ? `Earnings expected in ~${earnings.daysAway} day(s), inside this horizon. Expect a binary gap and elevated implied vol — long options face IV crush after the print. Prefer defined-risk or long-vol structures; trust direction less.`
    : null;

  // Conviction blends: distance from 50/50, forecaster agreement, and
  // how much history backs the prior. Disagreement and thin samples cut it.
  const edge = Math.abs(probUp - 0.5) * 2;                       // 0..1
  const agreement = 1 - Math.min(1, dialectic.disagreement / 0.25);
  const sampleConfidence = Math.min(1, baseRates.sampleSize / 250);
  let conviction = Math.round(
    100 * Math.max(0, Math.min(1, 0.5 * edge + 0.3 * agreement + 0.2 * sampleConfidence)),
  );
  // An earnings event inside the horizon makes the move more binary —
  // discount directional conviction.
  if (earnings.withinHorizon) conviction = Math.round(conviction * 0.8);

  const empiricalCone = buildEmpiricalCone(
    input.spotPrice, baseRates, input.horizonDays,
    earnings.withinHorizon ? 1.3 : 1,
  );

  const dirWord = direction === "bullish" ? "upside" : direction === "bearish" ? "downside" : "no clear directional";
  const summary =
    `${input.horizonDays}-day view: ${(probUp * 100).toFixed(0)}% probability of an up move (${dirWord} bias), conviction ${conviction}/100. ` +
    `Regime: ${regime.label}. Prior from history was ${(baseRates.prior * 100).toFixed(0)}%, evidence ${bayesian.netLogOdds >= 0 ? "raised" : "lowered"} it to ${(bayesian.posterior * 100).toFixed(0)}%. ${dialectic.recommendation}` +
    (earningsWarning ? ` ⚠ ${earningsWarning}` : "");

  return {
    horizonDays: input.horizonDays,
    regime,
    baseRates,
    bayesian,
    dialectic,
    probUp,
    conviction,
    direction,
    expectedMovePct,
    empiricalCone,
    earnings,
    earningsWarning,
    summary,
  };
}
