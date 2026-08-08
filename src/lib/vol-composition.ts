// ============================================================
// Volatility Composition
// ============================================================
// Combines the calculated base volatility (GARCH / historical / preset)
// with the news-sentiment adjustment and the macro-latticework adjustment
// into a single "effective" volatility used for pricing and probabilities.
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

export interface VolComposition {
  baseVol: number;            // decimal, e.g. 0.1534
  baseSource: BaseVolSource;
  sentimentAdjPct: number;    // e.g. 0.05 = +5%
  macroAdjPct: number;        // e.g. 0.03 = +3%
  effectiveVol: number;       // decimal, after composing all adjustments
}

export function composeVolatility(
  baseVol: number,
  baseSource: BaseVolSource,
  sentimentAdjPct: number,
  macroAdjPct: number,
): VolComposition {
  const effectiveVol = baseVol * (1 + sentimentAdjPct) * (1 + macroAdjPct);
  return { baseVol, baseSource, sentimentAdjPct, macroAdjPct, effectiveVol };
}
