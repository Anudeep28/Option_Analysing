// ============================================================
// Dialectic Personas — wisdom of diverse independent estimators
// ============================================================
// Instead of one consensus number, we run several independent
// "forecasters", each with a different worldview and prior, over the
// SAME evidence. When they agree, conviction is high. When they
// violently disagree, THAT is the signal: the honest move is to stay
// flat or buy volatility, not to pick a direction. Disagreement becomes
// a tradeable output rather than something a weighted average hides.

import type { EvidenceInput } from "./bayesian";
import type { RegimeResult } from "./regime";

export interface PersonaView {
  name: string;
  probUp: number;          // this persona's P(up), 0..1
  stance: "bullish" | "bearish" | "neutral";
  rationale: string;
}

export interface DialecticResult {
  views: PersonaView[];
  consensusProbUp: number;     // mean of persona probabilities
  disagreement: number;        // std-dev of persona probUp (0..~0.5)
  disagreementLabel: "tight" | "moderate" | "wide";
  recommendation: string;
  preferVolatilityPlay: boolean;
}

const logistic = (x: number) => 1 / (1 + Math.exp(-x));

function stanceOf(p: number): PersonaView["stance"] {
  if (p >= 0.56) return "bullish";
  if (p <= 0.44) return "bearish";
  return "neutral";
}

interface PersonaCtx {
  ev: EvidenceInput;
  regime: RegimeResult;
  prior: number;             // empirical base-rate prior
  expectedMovePct: number;   // base-rate median absolute move over horizon
}

// Each persona maps the shared evidence into log-odds with its own biases.
function momentumTrader(c: PersonaCtx): PersonaView {
  const momo = 0.5 * c.ev.trendTilt + 0.3 * c.ev.macdTilt + 0.2 * c.ev.priceVsSma;
  const p = logistic(2.2 * momo);
  return {
    name: "Momentum Trader",
    probUp: p,
    stance: stanceOf(p),
    rationale: "Trades with the trend, ignores mean reversion. 'The trend is your friend until it bends.'",
  };
}

function contrarian(c: PersonaCtx): PersonaView {
  // Fades stretch (overbought => bearish) AND fades very strong momentum.
  const stretch = 0.6 * c.ev.rsiStretch + 0.4 * c.ev.bollingerStretch;
  const momo = 0.5 * c.ev.trendTilt + 0.3 * c.ev.macdTilt + 0.2 * c.ev.priceVsSma;
  const p = logistic(1.8 * stretch - 0.8 * momo);
  return {
    name: "Contrarian",
    probUp: p,
    stance: stanceOf(p),
    rationale: "Fades crowded extremes and overbought rallies. 'Be greedy when others are fearful.'",
  };
}

function macroTourist(c: PersonaCtx): PersonaView {
  const p = logistic(2.0 * c.ev.macroTilt + 1.3 * c.ev.sentimentTilt);
  return {
    name: "Macro Tourist",
    probUp: p,
    stance: stanceOf(p),
    rationale: "Top-down: trades the macro latticework and news narrative, not the chart.",
  };
}

function volQuant(c: PersonaCtx): PersonaView {
  // Direction-agnostic: stays near the prior, only nudged by risk-off vol.
  const tilt = 0.4 * (c.prior - 0.5) * 2 + 0.4 * c.ev.volExpansionTilt;
  const p = logistic(0.8 * tilt);
  return {
    name: "Vol Quant",
    probUp: p,
    stance: stanceOf(p),
    rationale: "Skeptical of direction; focuses on whether implied vol is mispriced vs realized.",
  };
}

function baseRateStatistician(c: PersonaCtx): PersonaView {
  const p = c.prior;
  return {
    name: "Base-Rate Statistician",
    probUp: p,
    stance: stanceOf(p),
    rationale: "Pure outside view: ignores the story, quotes only this stock's historical odds.",
  };
}

function valueInvestor(c: PersonaCtx): PersonaView {
  // Buffett-style: rewards cheap, high-quality, growing businesses with
  // analyst support; indifferent to charts. Only meaningful with fundamentals.
  const f = c.ev.fundamentals;
  if (!f || !f.available) {
    return {
      name: "Value Investor",
      probUp: 0.5,
      stance: "neutral",
      rationale: "No fundamental data available — abstains.",
    };
  }
  const p = logistic(1.4 * f.valuation + 1.3 * f.quality + 0.9 * f.growth + 1.1 * f.analyst);
  return {
    name: "Value Investor",
    probUp: p,
    stance: stanceOf(p),
    rationale: "Buys quality businesses at fair prices; ignores the chart. 'Price is what you pay, value is what you get.'",
  };
}

export function runDialectic(
  ev: EvidenceInput,
  regime: RegimeResult,
  prior: number,
  expectedMovePct: number,
): DialecticResult {
  const ctx: PersonaCtx = { ev, regime, prior, expectedMovePct };
  const views = [
    momentumTrader(ctx),
    contrarian(ctx),
    macroTourist(ctx),
    volQuant(ctx),
    baseRateStatistician(ctx),
  ];
  // The Value Investor only joins the council when fundamentals are available.
  if (ev.fundamentals?.available) views.push(valueInvestor(ctx));

  const probs = views.map((v) => v.probUp);
  const consensusProbUp = probs.reduce((s, x) => s + x, 0) / probs.length;
  const variance = probs.reduce((s, x) => s + (x - consensusProbUp) ** 2, 0) / probs.length;
  const disagreement = Math.sqrt(variance);

  const disagreementLabel: DialecticResult["disagreementLabel"] =
    disagreement < 0.08 ? "tight" : disagreement < 0.16 ? "moderate" : "wide";

  const preferVolatilityPlay = disagreement >= 0.16 || regime.regime === "high_vol_crisis";

  let recommendation: string;
  if (preferVolatilityPlay) {
    recommendation = `Forecasters disagree ${disagreementLabel === "wide" ? "sharply" : "materially"} (σ=${disagreement.toFixed(2)}). The honest edge is in volatility, not direction — consider a straddle/strangle or a defined-risk vol structure rather than a directional bet.`;
  } else if (disagreementLabel === "tight") {
    recommendation = `Strong consensus (σ=${disagreement.toFixed(2)}) around ${(consensusProbUp * 100).toFixed(0)}% up. High-conviction directional setup — a clean ${consensusProbUp >= 0.5 ? "bullish" : "bearish"} expression is justified.`;
  } else {
    recommendation = `Moderate agreement (σ=${disagreement.toFixed(2)}). Take a directional position but size it down and keep a tight stop.`;
  }

  return {
    views,
    consensusProbUp,
    disagreement,
    disagreementLabel,
    recommendation,
    preferVolatilityPlay,
  };
}
