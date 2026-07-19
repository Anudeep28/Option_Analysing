// ============================================================
// Prediction Store — the feedback loop nobody builds
// ============================================================
// Logs every forecast with its probability, then scores it once the
// horizon elapses. This is what separates a forecaster from a fortune-
// teller: a Brier score and a calibration curve that prove (or disprove)
// the model's edge over time. Persisted in localStorage (no backend).
//
// Resolution is opportunistic: whenever fresh live data for a symbol
// loads, resolveMatured() settles any of that symbol's matured bets.

const STORAGE_KEY = "superforecaster_predictions_v1";

export interface PredictionRecord {
  id: string;
  symbol: string;
  createdAt: string;        // ISO
  resolveAt: string;        // ISO (createdAt + horizon)
  horizonDays: number;
  spotAtPrediction: number;
  probUp: number;           // 0..1
  direction: "bullish" | "bearish" | "neutral";
  conviction: number;       // 0..100
  regime: string;
  // Resolution
  resolved: boolean;
  outcomeUp: boolean | null;
  spotAtResolve: number | null;
  actualMovePct: number | null;
  resolvedAt: string | null;
}

export interface CalibrationBucket {
  rangeLabel: string;       // e.g. "60–70%"
  predictedAvg: number;     // mean forecast prob in bucket
  actualFreq: number;       // observed up-frequency
  count: number;
}

export interface Scoreboard {
  total: number;
  resolved: number;
  pending: number;
  brier: number | null;         // 0 (perfect) .. 1 (worst); 0.25 = coin flip
  skillVsCoinFlip: number | null; // % improvement over 0.25 baseline
  hitRate: number | null;       // directional accuracy on non-neutral calls
  avgConviction: number;
  calibration: CalibrationBucket[];
  highConvictionHitRate: number | null; // hit rate when conviction >= 60
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadPredictions(): PredictionRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PredictionRecord[]) : [];
  } catch {
    return [];
  }
}

function save(records: PredictionRecord[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* quota or serialization error — ignore */
  }
}

export interface LogPredictionInput {
  symbol: string;
  horizonDays: number;
  spotAtPrediction: number;
  probUp: number;
  direction: "bullish" | "bearish" | "neutral";
  conviction: number;
  regime: string;
}

export function logPrediction(input: LogPredictionInput): PredictionRecord {
  const now = new Date();
  const resolve = new Date(now.getTime() + input.horizonDays * 24 * 60 * 60 * 1000);
  const record: PredictionRecord = {
    id: `${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    symbol: input.symbol,
    createdAt: now.toISOString(),
    resolveAt: resolve.toISOString(),
    horizonDays: input.horizonDays,
    spotAtPrediction: input.spotAtPrediction,
    probUp: input.probUp,
    direction: input.direction,
    conviction: input.conviction,
    regime: input.regime,
    resolved: false,
    outcomeUp: null,
    spotAtResolve: null,
    actualMovePct: null,
    resolvedAt: null,
  };
  const all = loadPredictions();
  all.push(record);
  save(all);
  return record;
}

/**
 * Settle any matured, unresolved predictions for a symbol using the
 * current spot. Call this when fresh live data loads. Returns count resolved.
 */
export function resolveMatured(symbol: string, currentSpot: number): number {
  if (currentSpot <= 0) return 0;
  const all = loadPredictions();
  const now = Date.now();
  let resolvedCount = 0;
  for (const r of all) {
    if (
      !r.resolved &&
      r.symbol.toUpperCase() === symbol.toUpperCase() &&
      new Date(r.resolveAt).getTime() <= now
    ) {
      r.resolved = true;
      r.spotAtResolve = currentSpot;
      r.actualMovePct = (currentSpot / r.spotAtPrediction - 1) * 100;
      r.outcomeUp = currentSpot >= r.spotAtPrediction;
      r.resolvedAt = new Date().toISOString();
      resolvedCount++;
    }
  }
  if (resolvedCount > 0) save(all);
  return resolvedCount;
}

export function deletePrediction(id: string): void {
  save(loadPredictions().filter((r) => r.id !== id));
}

export function clearAllPredictions(): void {
  save([]);
}

const BUCKETS: [number, number][] = [
  [0.0, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.4], [0.4, 0.5],
  [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.0001],
];

export function computeScoreboard(records?: PredictionRecord[]): Scoreboard {
  const all = records ?? loadPredictions();
  const resolved = all.filter((r) => r.resolved && r.outcomeUp !== null);
  const pending = all.length - resolved.length;

  if (resolved.length === 0) {
    return {
      total: all.length,
      resolved: 0,
      pending,
      brier: null,
      skillVsCoinFlip: null,
      hitRate: null,
      avgConviction: all.length ? all.reduce((s, r) => s + r.conviction, 0) / all.length : 0,
      calibration: [],
      highConvictionHitRate: null,
    };
  }

  const brier = resolved.reduce((s, r) => {
    const outcome = r.outcomeUp ? 1 : 0;
    return s + (r.probUp - outcome) ** 2;
  }, 0) / resolved.length;

  const skillVsCoinFlip = ((0.25 - brier) / 0.25) * 100;

  const directional = resolved.filter((r) => r.direction !== "neutral");
  const hits = directional.filter((r) =>
    (r.direction === "bullish" && r.outcomeUp) || (r.direction === "bearish" && !r.outcomeUp),
  ).length;
  const hitRate = directional.length ? hits / directional.length : null;

  const highConv = directional.filter((r) => r.conviction >= 60);
  const highConvHits = highConv.filter((r) =>
    (r.direction === "bullish" && r.outcomeUp) || (r.direction === "bearish" && !r.outcomeUp),
  ).length;
  const highConvictionHitRate = highConv.length ? highConvHits / highConv.length : null;

  const calibration: CalibrationBucket[] = BUCKETS.map(([lo, hi]) => {
    const inBucket = resolved.filter((r) => r.probUp >= lo && r.probUp < hi);
    return {
      rangeLabel: `${Math.round(lo * 100)}–${Math.round(Math.min(hi, 1) * 100)}%`,
      predictedAvg: inBucket.length ? inBucket.reduce((s, r) => s + r.probUp, 0) / inBucket.length : 0,
      actualFreq: inBucket.length ? inBucket.filter((r) => r.outcomeUp).length / inBucket.length : 0,
      count: inBucket.length,
    };
  }).filter((b) => b.count > 0);

  return {
    total: all.length,
    resolved: resolved.length,
    pending,
    brier,
    skillVsCoinFlip,
    hitRate,
    avgConviction: all.reduce((s, r) => s + r.conviction, 0) / all.length,
    calibration,
    highConvictionHitRate,
  };
}
