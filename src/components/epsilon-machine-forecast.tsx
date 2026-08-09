"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, GitBranch, ChevronDown, ChevronUp, Info } from "lucide-react";
import { runEpsilonMachine, type EpsilonMachineResult } from "@/lib/forecast/epsilon-machine";

interface EpsilonMachineForecastProps {
  closes: number[];
  spotPrice: number;
  horizonDays: number;
  currency?: string;
  symbol?: string;
}

// ─── Compact price-cone chart (mirrors the Monte Carlo card's visual language) ──

const W = 480;
const H = 160;
const PAD = { top: 10, right: 8, bottom: 24, left: 52 };

function PathChart({ em, currency }: { em: EpsilonMachineResult; currency: string }) {
  const allLow = Math.min(...em.bands.map((b) => b.p5));
  const allHigh = Math.max(...em.bands.map((b) => b.p95));
  const pad = (allHigh - allLow) * 0.05 || 1;
  const yMin = allLow - pad;
  const yMax = allHigh + pad;
  const horizonDays = em.bands[em.bands.length - 1]?.day || 1;

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const xScale = (day: number) => PAD.left + (day / horizonDays) * chartW;
  const yScale = (price: number) => PAD.top + chartH - ((price - yMin) / (yMax - yMin)) * chartH;
  const toPath = (points: Array<[number, number]>) =>
    points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const band95Points = [
    ...em.bands.map((b) => `${xScale(b.day).toFixed(1)},${yScale(b.p95).toFixed(1)}`),
    ...em.bands.slice().reverse().map((b) => `${xScale(b.day).toFixed(1)},${yScale(b.p5).toFixed(1)}`),
  ].join(" ");
  const band50Points = [
    ...em.bands.map((b) => `${xScale(b.day).toFixed(1)},${yScale(b.p75).toFixed(1)}`),
    ...em.bands.slice().reverse().map((b) => `${xScale(b.day).toFixed(1)},${yScale(b.p25).toFixed(1)}`),
  ].join(" ");
  const medianPath = toPath(em.bands.map((b) => [xScale(b.day), yScale(b.p50)]));

  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const price = yMin + ((i + 0.5) / 4) * (yMax - yMin);
    return { price, y: yScale(price) };
  });
  const fmt = (p: number) => (p >= 10000 ? `${currency}${(p / 1000).toFixed(1)}k` : `${currency}${p.toFixed(0)}`);
  const spotY = yScale(em.bands[0]?.p50 ?? 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ maxHeight: H }}>
      <polygon points={band95Points} fill="currentColor" className="text-violet-400/20" />
      <polygon points={band50Points} fill="currentColor" className="text-violet-400/35" />
      <line x1={PAD.left} y1={spotY} x2={W - PAD.right} y2={spotY} stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 2" className="text-muted-foreground/50" />
      {em.samplePaths.slice(0, 40).map((sp, i) => {
        const pts = sp.prices.map((price, k) => [xScale((k / (sp.prices.length - 1)) * horizonDays), yScale(price)] as [number, number]);
        return <path key={i} d={toPath(pts)} fill="none" strokeWidth="0.5" stroke={sp.isBull ? "#10b981" : "#ef4444"} opacity="0.18" />;
      })}
      <path d={medianPath} fill="none" strokeWidth="2" stroke="#8b5cf6" />
      {yTicks.map(({ price, y }) => (
        <g key={price}>
          <line x1={PAD.left - 3} y1={y} x2={PAD.left} y2={y} stroke="currentColor" strokeWidth="0.8" className="text-border" />
          <text x={PAD.left - 5} y={y + 3.5} textAnchor="end" fontSize="9" fill="currentColor" className="text-muted-foreground/70">{fmt(price)}</text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const day = Math.round(frac * horizonDays);
        const x = xScale(day);
        return (
          <g key={frac}>
            <line x1={x} y1={H - PAD.bottom} x2={x} y2={H - PAD.bottom + 3} stroke="currentColor" strokeWidth="0.8" className="text-border" />
            <text x={x} y={H - PAD.bottom + 12} textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground/70">{day}d</text>
          </g>
        );
      })}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="currentColor" strokeWidth="0.8" className="text-border" />
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="currentColor" strokeWidth="0.8" className="text-border" />
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────

export function EpsilonMachineForecast({ closes, spotPrice, horizonDays, currency = "₹", symbol }: EpsilonMachineForecastProps) {
  const [showChart, setShowChart] = useState(true);

  const em = useMemo<EpsilonMachineResult | null>(() => {
    if (!closes || closes.length < 80 || spotPrice <= 0) return null;
    return runEpsilonMachine({ closes, spotPrice, horizonDays });
  }, [closes, spotPrice, horizonDays]);

  if (!em) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Need at least ~80 sessions of price history to reconstruct an ε-machine.
        </CardContent>
      </Card>
    );
  }

  const bias = em.probUp >= 0.56 ? "bullish" : em.probUp <= 0.44 ? "bearish" : "neutral";
  const BiasIcon = bias === "bullish" ? TrendingUp : bias === "bearish" ? TrendingDown : Minus;
  const biasStyle =
    bias === "bullish" ? "text-emerald-600 dark:text-emerald-400"
    : bias === "bearish" ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";

  const fmt = (n: number) => `${currency}${n.toLocaleString(undefined, { maximumFractionDigits: n > 1000 ? 0 : 2 })}`;
  const medianChangePct = ((em.terminalMedian - spotPrice) / spotPrice) * 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <GitBranch className="size-5" />
          Epsilon-Machine Forecast
          {symbol && <Badge variant="outline" className="text-xs ml-1">{symbol}</Badge>}
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            {em.numCausalStates} causal state{em.numCausalStates === 1 ? "" : "s"} · L={em.maxHistoryLength} · k={em.alphabetSize}
          </Badge>
        </CardTitle>
        <CardDescription>
          Computational-mechanics (CSSR) model — reconstructs the minimal causal states of the return
          process directly from data, with no assumed distribution or drift/vol split.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Complexity / entropy readout */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-lg border bg-muted/20 p-2">
            <div className="text-[10px] text-muted-foreground">Statistical complexity Cμ</div>
            <div className="text-base font-bold font-mono">{em.statisticalComplexity.toFixed(2)} bits</div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-2">
            <div className="text-[10px] text-muted-foreground">Entropy rate hμ</div>
            <div className="text-base font-bold font-mono">
              {em.entropyRate.toFixed(2)} <span className="text-muted-foreground font-normal">/ {em.maxEntropyRate.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          {em.efficiencyNote}
        </p>

        {/* Headline stats */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BiasIcon className={`size-5 ${biasStyle}`} />
            <span className={`font-bold ${biasStyle}`}>{bias.toUpperCase()}</span>
            <span className="text-xs text-muted-foreground">P(up) {(em.probUp * 100).toFixed(0)}%</span>
          </div>
          <div className="text-right text-sm">
            <span className="text-muted-foreground text-xs">Median @ {horizonDays}d: </span>
            <span className="font-mono font-semibold">{fmt(em.terminalMedian)}</span>
            <span className={`text-xs ml-1 font-mono ${medianChangePct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              ({medianChangePct >= 0 ? "+" : ""}{medianChangePct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Current causal state's next-step distribution */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Current causal state {em.currentStateId ?? "—"}{!em.currentStateResolved && " (unseen history, using modal state)"} — next-day symbol distribution
            </span>
            <span className={`font-mono ${em.probNextUp >= 0.5 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              P(next up) {(em.probNextUp * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex gap-1">
            {em.nextSymbolProbs.map((p, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="h-10 rounded bg-muted relative overflow-hidden flex items-end">
                  <div
                    className={`w-full ${em.symbolMeanReturns[i] >= 0 ? "bg-emerald-500/70" : "bg-red-400/70"}`}
                    style={{ height: `${Math.max(2, p * 100)}%` }}
                  />
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">{(p * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground text-center">
            {em.alphabetSize} return bins (left = most negative, right = most positive), CLT-standardized
          </p>
        </div>

        {/* Path chart toggle */}
        <div>
          <button
            onClick={() => setShowChart((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pb-1"
          >
            {showChart ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {showChart ? "Hide" : "Show"} machine-driven path simulation
          </button>
          {showChart && (
            <div className="rounded-lg border bg-card p-2">
              <PathChart em={em} currency={currency} />
              <p className="text-[9px] text-muted-foreground text-center mt-1">
                Paths sampled from the ε-machine&apos;s own causal-state transitions (green=up, red=down) · purple = median · bands = IQR / 5–95% CI
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
