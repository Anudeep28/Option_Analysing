// ============================================================
// Empirical Base Rates — the "Outside View"
// ============================================================
// Before any narrative, anchor on history: over this stock's own past,
// how often did it move up over the next K sessions, and how big were
// the moves? Uses the EMPIRICAL distribution of K-day forward returns,
// which is naturally fat-tailed (unlike GBM) — solving the thin-tail
// problem in the existing price cone.
//
// We also compute an "analog" base rate conditioned on the current
// momentum state (Kahneman's reference class), so the prior reflects
// "stocks that looked like this one, historically".

export interface BaseRateResult {
  horizonDays: number;
  sampleSize: number;
  // Unconditional (whole-history) outside view
  probUp: number;             // P(K-day forward return > 0)
  medianMovePct: number;
  // Conditioned on current momentum sign (reference class)
  analogProbUp: number | null;
  analogSampleSize: number;
  // Empirical move distribution (% terminal return), fat-tailed
  quantiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  meanMovePct: number;
  // Skew/kurtosis flags for honesty about tails
  downsideTailPct: number;    // average of worst 5% outcomes
  upsideTailPct: number;      // average of best 5% outcomes
  prior: number;              // blended prior P(up), 0..1 — feeds Bayes
  note: string;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Compute empirical base rates for a K-day horizon.
 * @param closes daily closes, oldest first
 * @param horizonDays forward horizon K
 */
export function computeBaseRates(closes: number[], horizonDays: number): BaseRateResult {
  const K = Math.max(1, Math.round(horizonDays));
  const n = closes.length;

  const forwardReturns: number[] = [];     // % terminal return over K days
  const precedingMomentum: number[] = [];   // 20d momentum sign just before window

  for (let i = 0; i + K < n; i++) {
    if (closes[i] > 0 && closes[i + K] > 0) {
      forwardReturns.push((closes[i + K] / closes[i] - 1) * 100);
      const back = i - 20 >= 0 ? (closes[i] / closes[i - 20] - 1) : 0;
      precedingMomentum.push(back);
    }
  }

  const sampleSize = forwardReturns.length;

  // Current momentum sign for the analog reference class
  const currentMomentum = n > 21 ? closes[n - 1] / closes[n - 21] - 1 : 0;
  const currentUp = currentMomentum >= 0;

  if (sampleSize < 30) {
    // Not enough history — fall back to a weak symmetric prior.
    return {
      horizonDays: K,
      sampleSize,
      probUp: 0.5,
      medianMovePct: 0,
      analogProbUp: null,
      analogSampleSize: 0,
      quantiles: { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
      meanMovePct: 0,
      downsideTailPct: 0,
      upsideTailPct: 0,
      prior: 0.5,
      note: "Insufficient price history for reliable base rates — using a neutral 50% prior.",
    };
  }

  const sorted = [...forwardReturns].sort((a, b) => a - b);
  const probUp = forwardReturns.filter((r) => r > 0).length / sampleSize;
  const meanMovePct = forwardReturns.reduce((s, x) => s + x, 0) / sampleSize;

  const tailCount = Math.max(1, Math.floor(sampleSize * 0.05));
  const downsideTailPct = sorted.slice(0, tailCount).reduce((s, x) => s + x, 0) / tailCount;
  const upsideTailPct = sorted.slice(-tailCount).reduce((s, x) => s + x, 0) / tailCount;

  // Analog reference class: only windows whose preceding momentum had the same sign
  const analog = forwardReturns.filter((_r, idx) => (precedingMomentum[idx] >= 0) === currentUp);
  const analogSampleSize = analog.length;
  const analogProbUp = analogSampleSize >= 20
    ? analog.filter((r) => r > 0).length / analogSampleSize
    : null;

  // Blended prior: anchor on the outside view, tilt toward the analog class.
  // Shrink toward 0.5 to avoid over-fitting a single stock's history.
  const rawPrior = analogProbUp !== null ? 0.5 * probUp + 0.5 * analogProbUp : probUp;
  const prior = 0.5 + (rawPrior - 0.5) * 0.7; // 30% shrinkage toward 50%

  const quantiles = {
    p5: quantile(sorted, 0.05),
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.50),
    p75: quantile(sorted, 0.75),
    p95: quantile(sorted, 0.95),
  };

  const note = analogProbUp !== null
    ? `Over ${sampleSize} historical ${K}-day windows, this stock rose ${(probUp * 100).toFixed(0)}% of the time. In the ${analogSampleSize} windows that followed ${currentUp ? "positive" : "negative"} 20-day momentum like now, it rose ${(analogProbUp * 100).toFixed(0)}% of the time.`
    : `Over ${sampleSize} historical ${K}-day windows, this stock rose ${(probUp * 100).toFixed(0)}% of the time (outside view).`;

  return {
    horizonDays: K,
    sampleSize,
    probUp,
    medianMovePct: quantiles.p50,
    analogProbUp,
    analogSampleSize,
    quantiles,
    meanMovePct,
    downsideTailPct,
    upsideTailPct,
    prior: Math.max(0.05, Math.min(0.95, prior)),
    note,
  };
}
