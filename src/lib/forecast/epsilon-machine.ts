// ============================================================
// Epsilon-Machine Forecaster (Computational Mechanics)
// ============================================================
// Reconstructs the minimal causal model of the return process
// directly from data — no assumed distribution, no drift/vol
// split. This is the CSSR algorithm (Shalizi & Klinkner, 2004):
//
//   1. Discretize returns into a small alphabet using a CLT-based
//      binning of standardized returns (as in Zavala-Díaz et al.,
//      2020, Physica A, "Short-term prediction of the closing
//      price of financial series using a ϵ-machine model").
//   2. Grow a set of CAUSAL STATES: histories are merged into the
//      same state when their empirical next-symbol distributions
//      are statistically indistinguishable (G-test), and split
//      into a new state otherwise.
//   3. Determinize: split states further until every (state,
//      symbol) pair maps to exactly one successor state — the
//      defining "unifilar" property of an epsilon-machine.
//
// From the resulting hidden-Markov-like machine we report:
//   - statistical complexity Cμ  (bits of memory the process keeps)
//   - entropy rate hμ            (bits/step of irreducible randomness)
//   - the current causal state and its next-symbol distribution
//   - a forward Monte-Carlo simulation over the machine's own
//     transition probabilities, giving a price cone comparable to
//     the GBM Monte Carlo engine.
// ============================================================

import { normalInvCDF, normalCDF } from "../math";
import type { MCPercentileBand, MCSamplePath } from "./stock-mc";

// ─── Input / Output ─────────────────────────────────────────

export interface EpsilonMachineInput {
  closes: number[];         // daily closes, oldest first
  spotPrice: number;
  horizonDays: number;      // forecast horizon, in trading days
  alphabetSize?: number;    // default 4
  maxHistoryLength?: number; // default: auto from data size
  significance?: number;    // G-test alpha, default 0.05
  numSimulations?: number;  // default 1500
}

export interface CausalState {
  id: number;
  historyCount: number;         // how many distinct histories map here
  total: number;                // total next-symbol observations
  transitionProbs: number[];    // P(symbol | state), length = alphabetSize
  nextState: (number | null)[]; // deterministic successor state per symbol
  stationaryProb: number;       // long-run P(being in this state)
}

export interface EpsilonMachineResult {
  alphabetSize: number;
  maxHistoryLength: number;
  numCausalStates: number;
  states: CausalState[];
  statisticalComplexity: number; // Cμ, bits
  entropyRate: number;           // hμ, bits/step
  maxEntropyRate: number;        // log2(alphabetSize) — the IID benchmark
  currentStateId: number | null;
  currentStateResolved: boolean; // false if we had to fall back to the modal state
  nextSymbolProbs: number[];
  probNextUp: number;            // P(next day's return > 0) from current state
  probUp: number;                // P(terminal simulated price > spot)
  terminalPrices: number[];      // sorted
  terminalMean: number;
  terminalMedian: number;
  bands: MCPercentileBand[];
  samplePaths: MCSamplePath[];
  binEdges: number[];            // z-score bin edges used for symbolization
  symbolMeanReturns: number[];   // empirical mean log return per symbol
  efficiencyNote: string;
}

// ─── Statistics helpers ─────────────────────────────────────

// Upper-tail p-value for a chi-squared statistic via the
// Wilson-Hilferty cube-root normal approximation (no incomplete
// gamma function needed — reuses the normalCDF already in math.ts).
function chiSquaredUpperP(x: number, df: number): number {
  if (x <= 0) return 1;
  const z = (Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return 1 - normalCDF(z);
}

// Two-sample G-test (log-likelihood ratio) comparing two categorical
// count vectors over the same alphabet. Returns a p-value: high p-value
// means "statistically indistinguishable" (safe to merge into one state).
function gTestPValue(counts1: number[], counts2: number[]): number {
  const n1 = counts1.reduce((a, b) => a + b, 0);
  const n2 = counts2.reduce((a, b) => a + b, 0);
  if (n1 === 0 || n2 === 0) return 1;
  const k = counts1.length;
  let G = 0;
  for (let i = 0; i < k; i++) {
    const pooled = (counts1[i] + counts2[i]) / (n1 + n2);
    const e1 = pooled * n1;
    const e2 = pooled * n2;
    if (counts1[i] > 0 && e1 > 0) G += 2 * counts1[i] * Math.log(counts1[i] / e1);
    if (counts2[i] > 0 && e2 > 0) G += 2 * counts2[i] * Math.log(counts2[i] / e2);
  }
  return chiSquaredUpperP(Math.max(G, 0), Math.max(k - 1, 1));
}

// ─── Symbolization (CLT-based binning) ──────────────────────

function computeLogReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) r.push(Math.log(closes[i] / closes[i - 1]));
  }
  return r;
}

interface Symbolization {
  symbols: number[];
  binEdges: number[];
  symbolMeanReturns: number[];
  symbolReturns: number[][]; // raw returns observed in each bin, for realistic resampling
}

function symbolize(returns: number[], k: number): Symbolization {
  const n = returns.length;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1e-8;

  // By the CLT, standardized returns are approximately N(0,1); cut that
  // distribution into k equiprobable bins using its inverse-CDF quantiles.
  const binEdges: number[] = [];
  for (let i = 1; i < k; i++) binEdges.push(normalInvCDF(i / k));

  const symbols: number[] = new Array(n);
  const symbolReturns: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) {
    const z = (returns[i] - mean) / std;
    let bin = 0;
    while (bin < binEdges.length && z > binEdges[bin]) bin++;
    symbols[i] = bin;
    symbolReturns[bin].push(returns[i]);
  }
  const symbolMeanReturns = symbolReturns.map((arr) =>
    arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0,
  );
  return { symbols, binEdges, symbolMeanReturns, symbolReturns };
}

// ─── History/count tables ───────────────────────────────────

// Map: history string (comma-joined symbols, length L) -> next-symbol counts
function historyCounts(symbols: number[], L: number, k: number): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let i = L; i < symbols.length; i++) {
    const hist = symbols.slice(i - L, i).join(",");
    let counts = map.get(hist);
    if (!counts) { counts = new Array(k).fill(0); map.set(hist, counts); }
    counts[symbols[i]]++;
  }
  return map;
}

function dropOldest(hist: string): string {
  if (hist === "") return "";
  const parts = hist.split(",");
  return parts.slice(1).join(",");
}

// ─── Phase I+II: grow causal states via sufficiency (G-)tests ──

interface GrowResult {
  stateOfHistory: Map<string, number>; // length-Lmax history -> state id
  stateCounts: Map<number, number[]>;  // state id -> aggregated next-symbol counts
}

function growCausalStates(
  symbols: number[], k: number, Lmax: number, alpha: number, minCount: number,
): GrowResult {
  // L=0: a single root state holding the global next-symbol distribution.
  let stateOfPrev = new Map<string, number>([["", 0]]);
  let countsById = new Map<number, number[]>([[0, historyCounts(symbols, 0, k).get("") ?? new Array(k).fill(0)]]);

  for (let L = 1; L <= Lmax; L++) {
    const histMap = historyCounts(symbols, L, k);
    const newStateOf = new Map<string, number>();
    const newCounts = new Map<number, number[]>();
    let nextId = Math.max(-1, ...Array.from(countsById.keys())) + 1;

    const addTo = (id: number, counts: number[]) => {
      let acc = newCounts.get(id);
      if (!acc) { acc = new Array(k).fill(0); newCounts.set(id, acc); }
      for (let i = 0; i < k; i++) acc[i] += counts[i];
    };

    for (const [hist, counts] of histMap) {
      const total = counts.reduce((a, b) => a + b, 0);
      const parentState = stateOfPrev.get(dropOldest(hist)) ?? 0;

      let assigned = parentState;
      if (total >= minCount) {
        const parentCounts = countsById.get(parentState) ?? new Array(k).fill(0);
        if (gTestPValue(counts, parentCounts) < alpha) {
          // Doesn't belong with its parent's state — look for a better home
          // among the OTHER existing states before minting a new one.
          let bestId = -1;
          let bestP = alpha;
          for (const [sid, sCounts] of countsById) {
            if (sid === parentState) continue;
            const p = gTestPValue(counts, sCounts);
            if (p >= alpha && p > bestP) { bestP = p; bestId = sid; }
          }
          assigned = bestId >= 0 ? bestId : nextId++;
        }
      }
      newStateOf.set(hist, assigned);
      addTo(assigned, counts);
    }

    stateOfPrev = newStateOf;
    countsById = newCounts;
  }

  return { stateOfHistory: stateOfPrev, stateCounts: countsById };
}

// ─── Phase III: determinize (partition refinement) ──────────
// Splits states until, for every state and every symbol, all member
// histories agree on which state comes next — the unifilar property
// that makes this a genuine epsilon-machine rather than a plain HMM.

function determinize(
  stateOfHistory: Map<string, number>, k: number,
): Map<string, number> {
  let current = new Map(stateOfHistory);

  for (let iter = 0; iter < 25; iter++) {
    const groups = new Map<string, string[]>(); // "origState|signature" -> histories
    for (const [hist, sid] of current) {
      const sig: string[] = [];
      for (let a = 0; a < k; a++) {
        // successor history = drop oldest symbol, append `a`
        const succHist = hist === "" ? String(a) : `${dropOldest(hist)},${a}`;
        sig.push(current.has(succHist) ? String(current.get(succHist)) : "?");
      }
      const key = `${sid}|${sig.join(":")}`;
      groups.set(key, [...(groups.get(key) ?? []), hist]);
    }

    const byOriginal = new Map<number, number>();
    for (const key of groups.keys()) {
      const orig = Number(key.split("|")[0]);
      byOriginal.set(orig, (byOriginal.get(orig) ?? 0) + 1);
    }
    const anySplit = Array.from(byOriginal.values()).some((c) => c > 1);
    if (!anySplit) break;

    const next = new Map<string, number>();
    let id = 0;
    for (const hists of groups.values()) {
      for (const h of hists) next.set(h, id);
      id++;
    }
    current = next;
  }

  return current;
}

// ─── Build the final machine ─────────────────────────────────

function buildMachine(
  stateOfHistory: Map<string, number>, histMap: Map<string, number[]>, k: number,
): CausalState[] {
  const numStates = new Set(stateOfHistory.values()).size;
  const counts = new Map<number, number[]>();
  for (const [hist, sid] of stateOfHistory) {
    const c = histMap.get(hist) ?? new Array(k).fill(0);
    let acc = counts.get(sid);
    if (!acc) { acc = new Array(k).fill(0); counts.set(sid, acc); }
    for (let i = 0; i < k; i++) acc[i] += c[i];
  }
  const histCountBySid = new Map<number, number>();
  for (const sid of stateOfHistory.values()) histCountBySid.set(sid, (histCountBySid.get(sid) ?? 0) + 1);

  const nextStateOf = new Map<number, (number | null)[]>();
  for (const [hist, sid] of stateOfHistory) {
    if (!nextStateOf.has(sid)) nextStateOf.set(sid, new Array(k).fill(null));
    const arr = nextStateOf.get(sid)!;
    for (let a = 0; a < k; a++) {
      if (arr[a] !== null) continue;
      const succHist = hist === "" ? String(a) : `${dropOldest(hist)},${a}`;
      const succSid = stateOfHistory.get(succHist);
      if (succSid !== undefined) arr[a] = succSid;
    }
  }

  const states: CausalState[] = [];
  for (const sid of Array.from(counts.keys()).sort((a, b) => a - b)) {
    const c = counts.get(sid)!;
    const total = c.reduce((a, b) => a + b, 0);
    states.push({
      id: sid,
      historyCount: histCountBySid.get(sid) ?? 0,
      total,
      transitionProbs: c.map((x) => (total > 0 ? x / total : 1 / k)),
      nextState: nextStateOf.get(sid) ?? new Array(k).fill(null),
      stationaryProb: 0, // filled in below
    });
  }
  void numStates;

  // Stationary distribution over states via power iteration on the
  // symbol-marginalized transition matrix.
  const n = states.length;
  const idx = new Map(states.map((s, i) => [s.id, i]));
  const T: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  states.forEach((s, i) => {
    s.nextState.forEach((ns, a) => {
      if (ns !== null && idx.has(ns)) T[i][idx.get(ns)!] += s.transitionProbs[a];
    });
  });
  let pi = new Array(n).fill(1 / n);
  for (let it = 0; it < 500; it++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) next[j] += pi[i] * T[i][j];
    const sum = next.reduce((a, b) => a + b, 0);
    // Rows with no outgoing mass (dead ends) leak probability — patch by
    // keeping the process where it is, which keeps π a valid distribution.
    for (let i = 0; i < n; i++) {
      const outMass = T[i].reduce((a, b) => a + b, 0);
      if (outMass < 1e-9) next[i] += pi[i];
    }
    const total = sum > 0 ? next.reduce((a, b) => a + b, 0) : 1;
    pi = next.map((x) => x / total);
  }
  states.forEach((s, i) => { s.stationaryProb = pi[i]; });

  return states;
}

// ─── Main entry point ────────────────────────────────────────

export function runEpsilonMachine(input: EpsilonMachineInput): EpsilonMachineResult | null {
  const {
    closes, spotPrice, horizonDays,
    alphabetSize = 4,
    significance = 0.05,
    numSimulations = 1500,
  } = input;

  const returns = computeLogReturns(closes);
  const n = returns.length;
  if (n < 80 || spotPrice <= 0) return null;

  const k = Math.max(3, Math.min(6, alphabetSize));
  const Lmax = input.maxHistoryLength
    ?? Math.max(2, Math.min(6, Math.floor(Math.log(n) / Math.log(k)) - 1));
  const minCount = Math.max(10, 5 * k);

  const { symbols, binEdges, symbolMeanReturns, symbolReturns } = symbolize(returns, k);

  const grown = growCausalStates(symbols, k, Lmax, significance, minCount);
  const finalStateOf = determinize(grown.stateOfHistory, k);
  const histMapAtLmax = historyCounts(symbols, Lmax, k);
  const states = buildMachine(finalStateOf, histMapAtLmax, k);

  // Statistical complexity: entropy of the stationary state distribution.
  const statisticalComplexity = -states.reduce(
    (s, st) => s + (st.stationaryProb > 0 ? st.stationaryProb * Math.log2(st.stationaryProb) : 0), 0,
  );
  // Entropy rate: expected next-symbol uncertainty, averaged over states.
  const entropyRate = states.reduce((s, st) => {
    const h = -st.transitionProbs.reduce((a, p) => a + (p > 0 ? p * Math.log2(p) : 0), 0);
    return s + st.stationaryProb * h;
  }, 0);
  const maxEntropyRate = Math.log2(k);

  // ── Locate the current causal state from the most recent history ──
  const lastHist = symbols.slice(-Lmax).join(",");
  let currentStateId = finalStateOf.get(lastHist) ?? null;
  const currentStateResolved = currentStateId !== null;
  if (currentStateId === null) {
    // Fallback: the modal (highest stationary-probability) state.
    const modal = states.reduce((best, s) => (s.stationaryProb > best.stationaryProb ? s : best), states[0]);
    currentStateId = modal?.id ?? null;
  }
  const currentState = states.find((s) => s.id === currentStateId) ?? states[0];
  const nextSymbolProbs = currentState.transitionProbs;
  const probNextUp = symbolMeanReturns.reduce(
    (acc, meanR, a) => acc + (meanR > 0 ? nextSymbolProbs[a] : 0), 0,
  );

  // ── Forward simulation over the machine's own transitions ──
  const stateById = new Map(states.map((s) => [s.id, s]));
  const steps = Math.max(1, Math.min(horizonDays, 252));
  const actualSims = Math.max(200, numSimulations);
  const terminalPrices = new Float64Array(actualSims);
  const MAX_SAMPLE = 50;
  const stepPrices: Float64Array[] = Array.from({ length: steps + 1 }, () => new Float64Array(actualSims));

  for (let sim = 0; sim < actualSims; sim++) {
    let price = spotPrice;
    let state = currentState;
    stepPrices[0][sim] = price;
    for (let t = 1; t <= steps; t++) {
      const u = Math.random();
      let cum = 0;
      let symbol = state.transitionProbs.length - 1;
      for (let a = 0; a < state.transitionProbs.length; a++) {
        cum += state.transitionProbs[a];
        if (u <= cum) { symbol = a; break; }
      }
      const pool = symbolReturns[symbol];
      const r = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : symbolMeanReturns[symbol];
      price = price * Math.exp(r);
      stepPrices[t][sim] = price;
      const nextId = state.nextState[symbol];
      state = (nextId !== null ? stateById.get(nextId) : undefined) ?? state;
    }
    terminalPrices[sim] = price;
  }

  const sortedTerminal = Array.from(terminalPrices).sort((a, b) => a - b);
  const terminalMean = sortedTerminal.reduce((s, v) => s + v, 0) / actualSims;
  const terminalMedian = sortedTerminal[Math.floor(actualSims / 2)];
  const probUp = sortedTerminal.filter((p) => p > spotPrice).length / actualSims;

  const percentile = (sorted: number[], p: number) =>
    sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(p * sorted.length)))];

  const renderSteps = Math.min(steps, 60);
  const bands: MCPercentileBand[] = [];
  for (let r = 0; r <= renderSteps; r++) {
    const step = Math.round((r / renderSteps) * steps);
    const col = Array.from(stepPrices[step]).sort((a, b) => a - b);
    const mean = col.reduce((s, v) => s + v, 0) / col.length;
    bands.push({
      day: Math.round((step / steps) * horizonDays),
      p5: percentile(col, 0.05), p25: percentile(col, 0.25), p50: percentile(col, 0.5),
      p75: percentile(col, 0.75), p95: percentile(col, 0.95), mean,
    });
  }

  const samplePaths: MCSamplePath[] = [];
  for (let i = 0; i < Math.min(MAX_SAMPLE, actualSims); i++) {
    const prices: number[] = new Array(steps + 1);
    for (let t = 0; t <= steps; t++) prices[t] = stepPrices[t][i];
    samplePaths.push({ prices, isBull: prices[steps] > spotPrice });
  }

  const efficiencyNote = statisticalComplexity < 0.15 && entropyRate > 0.9 * maxEntropyRate
    ? `Low memory (Cμ=${statisticalComplexity.toFixed(2)} bits) and entropy rate near the maximum (hμ≈${(entropyRate / maxEntropyRate * 100).toFixed(0)}% of log2(k)) — the reconstructed process looks close to a random walk. Little exploitable structure was found; treat this as a weak-efficiency check on the other forecasts.`
    : `The machine found ${states.length} causal state${states.length === 1 ? "" : "s"} with Cμ=${statisticalComplexity.toFixed(2)} bits of memory and hμ=${entropyRate.toFixed(2)} bits/step (vs. ${maxEntropyRate.toFixed(2)} for pure noise) — there is some detectable short-memory structure in the return sequence.`;

  return {
    alphabetSize: k,
    maxHistoryLength: Lmax,
    numCausalStates: states.length,
    states,
    statisticalComplexity,
    entropyRate,
    maxEntropyRate,
    currentStateId,
    currentStateResolved,
    nextSymbolProbs,
    probNextUp,
    probUp,
    terminalPrices: sortedTerminal,
    terminalMean,
    terminalMedian,
    bands,
    samplePaths,
    binEdges,
    symbolMeanReturns,
    efficiencyNote,
  };
}
