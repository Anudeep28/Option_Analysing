// ============================================================
// Volatility Composition
// ============================================================
// Combines the calculated base volatility (GARCH / historical / preset)
// with the news-sentiment adjustment, the macro-latticework adjustment,
// and a decayed mental-model shock into a single "effective" volatility used
// for pricing and probabilities.
//
// This makes the adjustment chain explicit and inspectable instead of
// collapsing everything into one mutable slider value with no provenance.

export type BaseVolSource = "garch" | "historical" | "preset";

// Macro events carry a severity (how structurally important the driver is)
// and a net directional score (-100..+100). Bigger events and stronger
// scores widen the expected volatility regardless of direction — an
// uncertain macro backdrop raises IV expectations whether the move is
// ultimately bullish or bearish.
const MACRO_SEVERITY_WEIGHT: Record<"high" | "medium" | "low", number> = {
  high: 0.15,
  medium: 0.08,
  low: 0.03,
};

export function computeMacroVolAdjustment(
  macroScore: number | undefined,
  primarySeverity: "high" | "medium" | "low" | undefined,
): number {
  if (macroScore === undefined || primarySeverity === undefined) return 0;
  const weight = MACRO_SEVERITY_WEIGHT[primarySeverity];
  return weight * (Math.abs(macroScore) / 100);
}

// Mental-model shocks are short-lived and decay with option expiry — a
// strong model conviction may spike realised vol today but should have little
// impact on a 30-day option.
const MENTAL_MODEL_MAX_VOL_SHOCK = 0.08; // max extra vol (±8%) at full conviction, same-day
const MENTAL_MODEL_VOL_HALF_LIFE_DAYS = 7; // decay half-life in calendar days

export function computeMentalModelVolAdjustment(
  mentalModelNetScore: number | undefined,
  daysToExpiry: number,
): number {
  if (mentalModelNetScore === undefined || daysToExpiry <= 0) return 0;
  const shock = (Math.abs(mentalModelNetScore) / 100) * MENTAL_MODEL_MAX_VOL_SHOCK;
  const decay = Math.exp(-daysToExpiry / MENTAL_MODEL_VOL_HALF_LIFE_DAYS);
  return shock * decay;
}

export interface VolComposition {
  baseVol: number;                 // decimal, e.g. 0.1534
  baseSource: BaseVolSource;
  sentimentAdjPct: number;       // e.g. 0.05 = +5%
  macroAdjPct: number;            // e.g. 0.03 = +3%
  mentalModelVolAdjPct: number;    // e.g. 0.05 = +5%
  effectiveVol: number;            // decimal, after composing all adjustments
}

export function composeVolatility(
  baseVol: number,
  baseSource: BaseVolSource,
  sentimentAdjPct: number,
  macroAdjPct: number,
  mentalModelVolAdjPct = 0,
): VolComposition {
  const effectiveVol = baseVol
    * (1 + sentimentAdjPct)
    * (1 + macroAdjPct)
    * (1 + mentalModelVolAdjPct);
  return {
    baseVol, baseSource, sentimentAdjPct, macroAdjPct, mentalModelVolAdjPct, effectiveVol,
  };
}
