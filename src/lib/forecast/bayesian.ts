// ============================================================
// Bayesian Fusion — likelihood ratios, not addition
// ============================================================
// The existing consolidator ADDS correlated price signals (trend, RSI,
// MACD, Bollinger), which systematically over-weights momentum. Here we:
//   1. Collapse the price-derived signals into ONE momentum factor and
//      ONE mean-reversion/stretch factor (decorrelation), so they vote
//      once each, not four times.
//   2. Treat sentiment, macro, and vol-regime as separate quasi-
//      independent evidence.
//   3. Combine everything with Bayes: posterior odds = prior odds × ∏ LR.
//   4. Modulate each factor's strength by the market regime, so mean
//      reversion is trusted in choppy markets and momentum in trends.
//
// LR strengths are deliberately capped (a strong factor gives LR ~2.5,
// not infinity) to stay calibrated and avoid overconfidence.

import type { RegimeResult } from "./regime";
import type { FundamentalTilts } from "./fundamentals";

export interface EvidenceInput {
  // Momentum factor inputs (all price-derived → decorrelated into one)
  trendTilt: number;        // -1..1  (strong_downtrend..strong_uptrend)
  macdTilt: number;         // -1..1
  priceVsSma: number;       // -1..1  (below..above 50DMA)
  // Mean-reversion / stretch factor (oversold => +bullish, overbought => -)
  rsiStretch: number;       // -1..1
  bollingerStretch: number; // -1..1
  // Independent evidence
  sentimentTilt: number;    // -1..1  (news sentiment / 100)
  macroTilt: number;        // -1..1  (latticework macro score / 100)
  volExpansionTilt: number; // -1..1  (vol expanding => mildly risk-off)
  // Fundamental evidence (optional — only when a company profile is available)
  fundamentals?: FundamentalTilts;
}

export interface EvidenceLedgerItem {
  factor: string;
  tilt: number;             // -1..1 net direction of this factor
  likelihoodRatio: number;  // >1 favors up, <1 favors down
  trust: number;            // 0..1 regime-conditioned weight applied
  rationale: string;
}

export interface BayesianResult {
  prior: number;            // P(up) before evidence
  posterior: number;        // P(up) after evidence
  ledger: EvidenceLedgerItem[];
  netLogOdds: number;       // sum of log-LRs (evidence strength)
}

// Map a tilt in [-1,1] and a max-strength to a likelihood ratio.
// strength is the natural-log of the max LR at |tilt|=1.
function tiltToLR(tilt: number, strength: number): number {
  const t = Math.max(-1, Math.min(1, tilt));
  return Math.exp(strength * t);
}

function clamp01(x: number): number {
  return Math.max(0.02, Math.min(0.98, x));
}

/**
 * Fuse evidence into a posterior probability of an UP move.
 * @param prior empirical base-rate prior P(up), 0..1
 * @param ev decorrelated evidence tilts
 * @param regime regime result (modulates momentum vs mean-reversion trust)
 */
export function fuseBayesian(
  prior: number,
  ev: EvidenceInput,
  regime: RegimeResult,
): BayesianResult {
  const ledger: EvidenceLedgerItem[] = [];

  // 1. Momentum factor: weighted average of the three correlated price signals.
  const momentumTilt =
    0.5 * ev.trendTilt + 0.3 * ev.macdTilt + 0.2 * ev.priceVsSma;
  // Trust momentum more in trending regimes, less in choppy ones.
  const momoTrust = regime.momentumTrust;
  // Max ln-LR of ~0.92 => LR up to ~2.5 at full strength & full trust.
  const momoLR = tiltToLR(momentumTilt, 0.92 * momoTrust);
  ledger.push({
    factor: "Momentum (trend + MACD + 50DMA, decorrelated)",
    tilt: momentumTilt,
    likelihoodRatio: momoLR,
    trust: momoTrust,
    rationale: `Price-derived signals collapsed into one vote (avoids double-counting). Regime "${regime.label}" sets momentum trust to ${(momoTrust * 100).toFixed(0)}%.`,
  });

  // 2. Mean-reversion / stretch factor (RSI + Bollinger). In a trending
  //    regime an "overbought" reading is NOT bearish, so trust is low.
  const stretchTilt = 0.6 * ev.rsiStretch + 0.4 * ev.bollingerStretch;
  const mrTrust = regime.meanReversionTrust;
  const mrLR = tiltToLR(stretchTilt, 0.7 * mrTrust);
  ledger.push({
    factor: "Mean-reversion stretch (RSI + Bollinger)",
    tilt: stretchTilt,
    likelihoodRatio: mrLR,
    trust: mrTrust,
    rationale: `Oversold favors a bounce, overbought a fade — but only trusted in mean-reverting markets. Regime trust ${(mrTrust * 100).toFixed(0)}%.`,
  });

  // 3. News sentiment (independent evidence).
  const sentLR = tiltToLR(ev.sentimentTilt, 0.5);
  ledger.push({
    factor: "News sentiment",
    tilt: ev.sentimentTilt,
    likelihoodRatio: sentLR,
    trust: 1,
    rationale: "Independent of price action; modest predictive strength.",
  });

  // 4. Macro latticework (independent evidence).
  const macroLR = tiltToLR(ev.macroTilt, 0.55);
  ledger.push({
    factor: "Macro latticework",
    tilt: ev.macroTilt,
    likelihoodRatio: macroLR,
    trust: 1,
    rationale: "Munger-style multi-model macro read on the sector.",
  });

  // 5. Volatility expansion (mild directional risk-off signal).
  const volLR = tiltToLR(ev.volExpansionTilt, 0.25);
  ledger.push({
    factor: "Volatility regime",
    tilt: ev.volExpansionTilt,
    likelihoodRatio: volLR,
    trust: 1,
    rationale: "Expanding vol skews returns mildly negative (risk-off); a small tilt only.",
  });

  // 6. Fundamentals (optional). Weak short-horizon predictors, so small
  //    strengths. Valuation reverts slowly; quality/growth persist; the
  //    analyst target is the strongest near-term tell.
  const f = ev.fundamentals;
  if (f && f.available) {
    const fundTilt = 0.30 * f.valuation + 0.25 * f.quality + 0.25 * f.growth + 0.20 * f.analyst;
    const fundLR = tiltToLR(fundTilt, 0.45);
    ledger.push({
      factor: "Fundamentals (valuation + quality + growth + analysts)",
      tilt: fundTilt,
      likelihoodRatio: fundLR,
      trust: 1,
      rationale: f.notes.length ? f.notes.join(" ") : "Company profile evidence; modest short-horizon strength.",
    });
  }

  // Combine: posterior odds = prior odds × ∏ LR.
  const p = clamp01(prior);
  const priorOdds = p / (1 - p);
  const netLR = ledger.reduce((acc, l) => acc * l.likelihoodRatio, 1);
  const postOdds = priorOdds * netLR;
  const posterior = postOdds / (1 + postOdds);

  return {
    prior: p,
    posterior: clamp01(posterior),
    ledger,
    netLogOdds: Math.log(netLR),
  };
}
