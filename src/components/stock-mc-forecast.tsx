"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, Minus, Cpu, Newspaper,
  Globe, Brain, Activity, ChevronDown, ChevronUp,
} from "lucide-react";
import { runStockMC, type StockMCResult } from "@/lib/forecast/stock-mc";
import type { MacroImpactResult } from "@/lib/macro-impact";

// ─── Props ──────────────────────────────────────────────────

interface StockMCForecastProps {
  spotPrice: number;
  annualVol: number;
  garchVol?: number | null;
  riskFreeRate: number;
  dividendYield: number;
  horizonDays: number;
  currency?: string;
  symbol?: string;
  sentimentScore?: number;
  technicalScore?: number;
  macroScore?: number;
  macroData?: MacroImpactResult | null;
}

// ─── SVG Path Chart ─────────────────────────────────────────

const W = 480;
const H = 180;
const PAD = { top: 12, right: 8, bottom: 28, left: 52 };

function PathChart({ mc, currency }: { mc: StockMCResult; currency: string }) {
  const spot = mc.bands[0]?.p50 ?? 0;

  // y-axis domain: p5 of first band to p95 of last band, with 5% padding
  const allLow = Math.min(...mc.bands.map((b) => b.p5));
  const allHigh = Math.max(...mc.bands.map((b) => b.p95));
  const pad = (allHigh - allLow) * 0.05;
  const yMin = allLow - pad;
  const yMax = allHigh + pad;

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xScale = (day: number) =>
    PAD.left + (day / mc.horizonDays) * chartW;
  const yScale = (price: number) =>
    PAD.top + chartH - ((price - yMin) / (yMax - yMin)) * chartH;

  const toPath = (points: Array<[number, number]>) =>
    points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // Confidence bands as SVG polygon fills
  const band95Points: string = [
    ...mc.bands.map((b) => `${xScale(b.day).toFixed(1)},${yScale(b.p95).toFixed(1)}`),
    ...mc.bands.slice().reverse().map((b) => `${xScale(b.day).toFixed(1)},${yScale(b.p5).toFixed(1)}`),
  ].join(" ");

  const band50Points: string = [
    ...mc.bands.map((b) => `${xScale(b.day).toFixed(1)},${yScale(b.p75).toFixed(1)}`),
    ...mc.bands.slice().reverse().map((b) => `${xScale(b.day).toFixed(1)},${yScale(b.p25).toFixed(1)}`),
  ].join(" ");

  const medianPath = toPath(mc.bands.map((b) => [xScale(b.day), yScale(b.p50)]));
  const meanPath = toPath(mc.bands.map((b) => [xScale(b.day), yScale(b.mean)]));

  // Y-axis ticks (4 ticks)
  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const price = yMin + ((i + 0.5) / 4) * (yMax - yMin);
    return { price, y: yScale(price) };
  });

  // Format price compactly
  const fmt = (p: number) =>
    p >= 10000
      ? `${currency}${(p / 1000).toFixed(1)}k`
      : `${currency}${p.toFixed(0)}`;

  // Spot line
  const spotY = yScale(spot);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full overflow-visible"
      style={{ maxHeight: H }}
    >
      {/* 90% confidence band */}
      <polygon points={band95Points} fill="currentColor" className="text-blue-400/20" />
      {/* 50% IQR band */}
      <polygon points={band50Points} fill="currentColor" className="text-blue-400/35" />

      {/* Spot reference line */}
      <line
        x1={PAD.left} y1={spotY} x2={W - PAD.right} y2={spotY}
        stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 2"
        className="text-muted-foreground/50"
      />

      {/* Sample paths (first 40, faded) */}
      {mc.samplePaths.slice(0, 40).map((sp, i) => {
        const pts = sp.prices.map((price, k) => {
          const day = (k / (sp.prices.length - 1)) * mc.horizonDays;
          return [xScale(day), yScale(price)] as [number, number];
        });
        return (
          <path
            key={i}
            d={toPath(pts)}
            fill="none"
            strokeWidth="0.5"
            stroke={sp.isBull ? "#10b981" : "#ef4444"}
            opacity="0.18"
          />
        );
      })}

      {/* Mean path */}
      <path d={meanPath} fill="none" strokeWidth="1.2" stroke="#60a5fa" strokeDasharray="4 2" />

      {/* Median path */}
      <path d={medianPath} fill="none" strokeWidth="2" stroke="#3b82f6" />

      {/* Y-axis ticks */}
      {yTicks.map(({ price, y }) => (
        <g key={price}>
          <line x1={PAD.left - 3} y1={y} x2={PAD.left} y2={y} stroke="currentColor" strokeWidth="0.8" className="text-border" />
          <text x={PAD.left - 5} y={y + 3.5} textAnchor="end" fontSize="9" fill="currentColor" className="text-muted-foreground/70">
            {fmt(price)}
          </text>
        </g>
      ))}

      {/* X-axis ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const day = Math.round(frac * mc.horizonDays);
        const x = xScale(day);
        return (
          <g key={frac}>
            <line x1={x} y1={H - PAD.bottom} x2={x} y2={H - PAD.bottom + 3} stroke="currentColor" strokeWidth="0.8" className="text-border" />
            <text x={x} y={H - PAD.bottom + 12} textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground/70">
              {day}d
            </text>
          </g>
        );
      })}

      {/* Axis lines */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="currentColor" strokeWidth="0.8" className="text-border" />
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="currentColor" strokeWidth="0.8" className="text-border" />

      {/* Legend */}
      <g>
        <rect x={PAD.left + 4} y={PAD.top} width={6} height={6} fill="#3b82f6" />
        <text x={PAD.left + 12} y={PAD.top + 6} fontSize="8" fill="#3b82f6">Median</text>
        <rect x={PAD.left + 52} y={PAD.top} width={6} height={6} fill="#60a5fa" />
        <text x={PAD.left + 60} y={PAD.top + 6} fontSize="8" fill="#60a5fa">Mean</text>
        <rect x={PAD.left + 92} y={PAD.top} width={6} height={6} fill="rgba(96,165,250,0.35)" />
        <text x={PAD.left + 100} y={PAD.top + 6} fontSize="8" fill="currentColor" opacity={0.6}>IQR</text>
        <rect x={PAD.left + 122} y={PAD.top} width={6} height={6} fill="rgba(96,165,250,0.20)" />
        <text x={PAD.left + 130} y={PAD.top + 6} fontSize="8" fill="currentColor" opacity={0.6}>90%</text>
      </g>
    </svg>
  );
}

// ─── Drift bar ───────────────────────────────────────────────

function DriftBar({ label, value, maxAbs, icon }: {
  label: string; value: number; maxAbs: number; icon: React.ReactNode;
}) {
  const pct = maxAbs > 0 ? Math.abs(value) / maxAbs : 0;
  const isPos = value >= 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-5">{icon}</span>
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <div
          className={`absolute top-0 bottom-0 rounded-full ${isPos ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-400"}`}
          style={{ width: `${(pct * 50).toFixed(1)}%` }}
        />
      </div>
      <span className={`font-mono w-14 text-right ${isPos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
        {isPos ? "+" : ""}{(value * 100).toFixed(2)}%
      </span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export function StockMCForecast({
  spotPrice, annualVol, garchVol, riskFreeRate, dividendYield,
  horizonDays, currency = "₹", symbol,
  sentimentScore, technicalScore, macroScore, macroData,
}: StockMCForecastProps) {
  const [showDrift, setShowDrift] = useState(false);
  const [showPaths, setShowPaths] = useState(true);

  // Extract LLM mental-model net score from macroData if available
  const mentalModelNetScore = useMemo(() => {
    if (!macroData?.latticework) return undefined;
    return macroData.latticework.netScore; // -100..+100
  }, [macroData]);

  const mc = useMemo<StockMCResult>(() => {
    return runStockMC({
      spotPrice,
      annualVol,
      garchVol,
      riskFreeRate,
      dividendYield,
      horizonDays,
      sentimentScore,
      technicalScore,
      macroScore,
      mentalModelNetScore,
      numSimulations: 2000,
    });
  }, [
    spotPrice, annualVol, garchVol, riskFreeRate, dividendYield,
    horizonDays, sentimentScore, technicalScore, macroScore, mentalModelNetScore,
  ]);

  const fmt = (n: number) =>
    `${currency}${n.toLocaleString(undefined, { maximumFractionDigits: n > 1000 ? 0 : 2 })}`;
  const fmtPct = (n: number, decimals = 1) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(decimals)}%`;

  const bias =
    mc.probUp >= 0.56 ? "bullish"
    : mc.probUp <= 0.44 ? "bearish"
    : "neutral";
  const BiasIcon = bias === "bullish" ? TrendingUp : bias === "bearish" ? TrendingDown : Minus;
  const biasStyle =
    bias === "bullish" ? "text-emerald-600 dark:text-emerald-400"
    : bias === "bearish" ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";

  const maxDriftAbs = Math.max(
    Math.abs(mc.driftBreakdown.riskNeutral),
    Math.abs(mc.driftBreakdown.sentimentAdj),
    Math.abs(mc.driftBreakdown.technicalAdj),
    Math.abs(mc.driftBreakdown.macroAdj),
    Math.abs(mc.driftBreakdown.mentalModelAdj),
    0.01,
  );

  const medianChangePct = ((mc.terminalMedian - spotPrice) / spotPrice) * 100;
  const meanChangePct = ((mc.terminalMean - spotPrice) / spotPrice) * 100;

  // Narrative from LLM latticework if present
  const llmNarrative = macroData?.llm?.summary ?? macroData?.latticework?.narrativeSummary;
  const llmInversion = macroData?.llm?.inversionSignal ?? macroData?.latticework?.inversionSignal;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cpu className="size-5" />
          Monte Carlo Path Forecast
          {symbol && <Badge variant="outline" className="text-xs ml-1">{symbol}</Badge>}
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            {mc.numSimulations.toLocaleString()} paths · {horizonDays}d
          </Badge>
        </CardTitle>
        <CardDescription>
          GBM simulation with GARCH vol + real-world multi-signal drift (sentiment, technicals, macro, mental models).
          Antithetic variates + Sobol QMC for variance reduction.
        </CardDescription>
        <p className="text-[10px] text-muted-foreground mt-1">
          This is a directional real-world forecast. Option pricing above always uses the risk-neutral drift (r − q) regardless of these signals.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Signal badges ── */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-0.5">Drift inputs:</span>
          <Badge variant="outline" className="gap-1 text-[10px] border-blue-300 text-blue-700 dark:text-blue-400">
            <Activity className="size-3" /> σ {(mc.effectiveSigma * 100).toFixed(1)}%{garchVol ? " (GARCH)" : ""}
          </Badge>
          {sentimentScore !== undefined && (
            <Badge variant="outline" className={`gap-1 text-[10px] ${sentimentScore > 10 ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : sentimentScore < -10 ? "border-red-300 text-red-600" : "text-muted-foreground"}`}>
              <Newspaper className="size-3" /> Sentiment {sentimentScore > 0 ? "+" : ""}{sentimentScore?.toFixed(0)}
            </Badge>
          )}
          {macroScore !== undefined && (
            <Badge variant="outline" className={`gap-1 text-[10px] ${macroScore > 10 ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : macroScore < -10 ? "border-red-300 text-red-600" : "text-muted-foreground"}`}>
              <Globe className="size-3" /> Macro {macroScore > 0 ? "+" : ""}{macroScore?.toFixed(0)}
            </Badge>
          )}
          {mentalModelNetScore !== undefined && (
            <Badge variant="outline" className={`gap-1 text-[10px] ${mentalModelNetScore > 10 ? "border-purple-300 text-purple-700 dark:text-purple-400" : mentalModelNetScore < -10 ? "border-red-300 text-red-600" : "text-muted-foreground"}`}>
              <Brain className="size-3" /> Models {mentalModelNetScore > 0 ? "+" : ""}{mentalModelNetScore?.toFixed(0)}
            </Badge>
          )}
        </div>

        {/* ── Headline stats ── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BiasIcon className={`size-5 ${biasStyle}`} />
            <span className={`font-bold ${biasStyle}`}>{bias.toUpperCase()}</span>
            <span className="text-xs text-muted-foreground">P(up) {(mc.probUp * 100).toFixed(0)}%</span>
          </div>
          <div className="text-right text-sm space-y-0.5">
            <div>
              <span className="text-muted-foreground text-xs">Median: </span>
              <span className="font-mono font-semibold">{fmt(mc.terminalMedian)}</span>
              <span className={`text-xs ml-1 font-mono ${medianChangePct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                ({medianChangePct >= 0 ? "+" : ""}{medianChangePct.toFixed(2)}%)
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Mean: </span>
              <span className="font-mono">{fmt(mc.terminalMean)}</span>
              <span className={`text-xs ml-1 font-mono ${meanChangePct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                ({meanChangePct >= 0 ? "+" : ""}{meanChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* ── P(up/down ±5%) ── */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 p-2">
            <div className="text-[10px] text-muted-foreground">P(&gt;+5%)</div>
            <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">{(mc.probUp5pct * 100).toFixed(0)}%</div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-2">
            <div className="text-[10px] text-muted-foreground">P(up)</div>
            <div className={`text-base font-bold font-mono ${biasStyle}`}>{(mc.probUp * 100).toFixed(0)}%</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-2">
            <div className="text-[10px] text-muted-foreground">P(&lt;-5%)</div>
            <div className="text-base font-bold font-mono text-red-600 dark:text-red-400">{(mc.probDown5pct * 100).toFixed(0)}%</div>
          </div>
        </div>

        {/* ── Path chart toggle ── */}
        <div>
          <button
            onClick={() => setShowPaths((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pb-1"
          >
            {showPaths ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {showPaths ? "Hide" : "Show"} path simulation
          </button>
          {showPaths && (
            <div className="rounded-lg border bg-card p-2">
              <PathChart mc={mc} currency={currency} />
              <p className="text-[9px] text-muted-foreground text-center mt-1">
                40 sample paths shown (green=up, red=down) · blue band = IQR (25–75%) · outer = 5–95% CI
              </p>
            </div>
          )}
        </div>

        {/* ── Price bands ── */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border p-2 space-y-0.5">
            <div className="text-[10px] text-muted-foreground">IQR range (25–75%)</div>
            <div className="font-mono font-semibold">
              {fmt(mc.bands[mc.bands.length - 1]?.p25 ?? 0)} – {fmt(mc.bands[mc.bands.length - 1]?.p75 ?? 0)}
            </div>
          </div>
          <div className="rounded-lg border p-2 space-y-0.5">
            <div className="text-[10px] text-muted-foreground">90% CI (5–95%)</div>
            <div className="font-mono font-semibold">
              {fmt(mc.bands[mc.bands.length - 1]?.p5 ?? 0)} – {fmt(mc.bands[mc.bands.length - 1]?.p95 ?? 0)}
            </div>
          </div>
        </div>

        {/* ── Risk metrics ── */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded border bg-muted/20 p-2">
            <p className="text-[10px] text-muted-foreground">VaR (5%)</p>
            <p className="font-mono font-semibold text-red-500">{fmt(mc.varP5)}</p>
            <p className="text-[9px] text-muted-foreground">{fmtPct((mc.varP5 - spotPrice) / spotPrice)}</p>
          </div>
          <div className="rounded border bg-muted/20 p-2">
            <p className="text-[10px] text-muted-foreground">CVaR (5%)</p>
            <p className="font-mono font-semibold text-red-600">{fmt(mc.cvarP5)}</p>
            <p className="text-[9px] text-muted-foreground">{fmtPct((mc.cvarP5 - spotPrice) / spotPrice)}</p>
          </div>
          <div className="rounded border bg-muted/20 p-2">
            <p className="text-[10px] text-muted-foreground">Tail skew</p>
            <p className={`font-mono font-semibold ${mc.tailSkew >= 1 ? "text-emerald-600" : "text-red-500"}`}>
              {mc.tailSkew.toFixed(2)}×
            </p>
            <p className="text-[9px] text-muted-foreground">{mc.tailSkew >= 1 ? "right" : "left"}-skewed</p>
          </div>
        </div>

        {/* ── Drift breakdown (collapsible) ── */}
        <div>
          <button
            onClick={() => setShowDrift((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDrift ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            Drift decomposition (total {fmtPct(mc.effectiveDrift)} p.a.)
          </button>
          {showDrift && (
            <div className="mt-2 space-y-1.5">
              <DriftBar label="Risk-neutral" value={mc.driftBreakdown.riskNeutral} maxAbs={maxDriftAbs} icon={<Activity className="size-3" />} />
              <DriftBar label="Sentiment" value={mc.driftBreakdown.sentimentAdj} maxAbs={maxDriftAbs} icon={<Newspaper className="size-3" />} />
              <DriftBar label="Technicals" value={mc.driftBreakdown.technicalAdj} maxAbs={maxDriftAbs} icon={<TrendingUp className="size-3" />} />
              <DriftBar label="Macro" value={mc.driftBreakdown.macroAdj} maxAbs={maxDriftAbs} icon={<Globe className="size-3" />} />
              <DriftBar label="Mental models" value={mc.driftBreakdown.mentalModelAdj} maxAbs={maxDriftAbs} icon={<Brain className="size-3" />} />
              <p className="text-[10px] text-muted-foreground pt-1">
                Drift inputs shift the GBM drift term. They do NOT widen/narrow the volatility cone — only σ does that. Total drift applied to path simulation: {fmtPct(mc.effectiveDrift, 2)} p.a.
              </p>
            </div>
          )}
        </div>

        {/* ── Mental model / LLM narrative ── */}
        {(llmNarrative || llmInversion) && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium flex items-center gap-2">
                <Brain className="size-3.5" /> Mental model analysis
                {macroData?.llm && (
                  <Badge variant="outline" className="text-[9px] text-purple-600 border-purple-300">LLM-enhanced</Badge>
                )}
              </p>
              {llmNarrative && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">{llmNarrative}</p>
              )}
              {llmInversion && (
                <div className="rounded border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">Inversion signal: </span>{llmInversion}
                </div>
              )}
              {macroData?.latticework && (
                <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center pt-1">
                  {macroData.latticework.layers.slice(0, 6).map((l) => (
                    <div key={l.model} className="rounded border bg-muted/20 p-1.5">
                      <p className="text-muted-foreground truncate" title={l.label}>{l.label.split("(")[0].trim()}</p>
                      <p className={`font-mono font-semibold ${l.score > 5 ? "text-emerald-600" : l.score < -5 ? "text-red-500" : "text-amber-500"}`}>
                        {l.score > 0 ? "+" : ""}{l.score}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <p className="text-[9px] text-muted-foreground/60 pt-1">
          GBM assumes log-normal returns; fat tails and regime breaks are not captured. Antithetic variates + Sobol QMC reduce MC error. Results are model estimates, not guarantees.
        </p>
      </CardContent>
    </Card>
  );
}
