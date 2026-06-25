"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Minus, Target, Activity } from "lucide-react";
import {
  buildPriceCone, computeTargetProbability, buildConsolidatedSignal,
  type PriceConePoint, type ConsolidatedSignal, type TargetProbability,
} from "@/lib/stock-outlook";
import type { TechnicalIndicators } from "@/lib/technicals";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, d = 1) { return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`; }
function ccy(n: number, currency: string, d = 0) {
  return `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
function prob(n: number) { return `${(n * 100).toFixed(1)}%`; }

// ─── Signal Badge ──────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: ConsolidatedSignal["signal"] }) {
  const map = {
    strong_buy:  { label: "STRONG BUY",  cls: "bg-emerald-600 text-white border-emerald-600",  Icon: TrendingUp },
    buy:         { label: "BUY",         cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300", Icon: TrendingUp },
    neutral:     { label: "NEUTRAL",     cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",   Icon: Minus },
    sell:        { label: "SELL",        cls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300",         Icon: TrendingDown },
    strong_sell: { label: "STRONG SELL", cls: "bg-red-600 text-white border-red-600",           Icon: TrendingDown },
  } as const;
  const { label, cls, Icon } = map[signal];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-bold ${cls}`}>
      <Icon className="size-4" />
      {label}
    </span>
  );
}

// ─── Price Cone SVG Chart ──────────────────────────────────────────────────────

function PriceConeChart({ cone, spot, currency }: {
  cone: PriceConePoint[]; spot: number; currency: string;
}) {
  const allPrices = cone.flatMap((p) => [p.low95, p.high95]);
  const minP = Math.min(...allPrices) * 0.99;
  const maxP = Math.max(...allPrices) * 1.01;
  const maxDay = cone[cone.length - 1]?.day ?? 1;

  const W = 400; const H = 160;
  const px = (d: number) => (d / maxDay) * W;
  const py = (p: number) => H - ((p - minP) / (maxP - minP)) * H;

  const toPath = (vals: number[]) =>
    cone.map((pt, i) => `${i === 0 ? "M" : "L"}${px(pt.day)},${py(vals[i])}`).join(" ");

  const mid68 = cone.map((p) => p.mid);
  const hi68 = cone.map((p) => p.high68);
  const lo68 = cone.map((p) => p.low68);
  const hi95 = cone.map((p) => p.high95);
  const lo95 = cone.map((p) => p.low95);

  const areaPath = (tops: number[], bots: number[]) => {
    const fwd = cone.map((pt, i) => `${i === 0 ? "M" : "L"}${px(pt.day)},${py(tops[i])}`).join(" ");
    const bwd = cone.map((pt, i) => `L${px(pt.day)},${py(bots[i])}`).reverse().join(" ");
    return `${fwd} ${bwd} Z`;
  };

  const spotY = py(spot);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" preserveAspectRatio="none">
        {/* 95% band */}
        <path d={areaPath(hi95, lo95)} fill="currentColor" className="text-blue-200/40 dark:text-blue-900/40" />
        {/* 68% band */}
        <path d={areaPath(hi68, lo68)} fill="currentColor" className="text-blue-300/50 dark:text-blue-800/50" />
        {/* Mid line */}
        <path d={toPath(mid68)} fill="none" stroke="currentColor" className="text-blue-500" strokeWidth="1.5" />
        {/* Upper 68 */}
        <path d={toPath(hi68)} fill="none" stroke="currentColor" className="text-blue-400/70" strokeWidth="1" strokeDasharray="4 2" />
        {/* Lower 68 */}
        <path d={toPath(lo68)} fill="none" stroke="currentColor" className="text-blue-400/70" strokeWidth="1" strokeDasharray="4 2" />
        {/* Current spot line */}
        <line x1="0" y1={spotY} x2={W} y2={spotY} stroke="currentColor" className="text-foreground/30" strokeWidth="0.8" strokeDasharray="3 3" />
        {/* Start dot */}
        <circle cx={0} cy={py(spot)} r="3" fill="currentColor" className="text-blue-500" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>Today</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1 rounded bg-blue-400/60"></span>68% CI
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1 rounded bg-blue-200/60"></span>95% CI
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 rounded bg-blue-500"></span>Expected
          </span>
        </span>
        <span>Day {maxDay}</span>
      </div>
      {/* End values */}
      <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-center">
        <div className="rounded border bg-muted/20 p-1.5">
          <p className="text-[10px] text-muted-foreground">95% Low</p>
          <p className="font-mono font-semibold text-red-500">{ccy(cone[cone.length - 1]?.low95 ?? spot, currency)}</p>
        </div>
        <div className="rounded border bg-blue-50 dark:bg-blue-950/30 p-1.5">
          <p className="text-[10px] text-muted-foreground">Expected</p>
          <p className="font-mono font-semibold text-blue-600">{ccy(cone[cone.length - 1]?.mid ?? spot, currency)}</p>
        </div>
        <div className="rounded border bg-muted/20 p-1.5">
          <p className="text-[10px] text-muted-foreground">95% High</p>
          <p className="font-mono font-semibold text-emerald-500">{ccy(cone[cone.length - 1]?.high95 ?? spot, currency)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Signal Component Row ──────────────────────────────────────────────────────

function SignalRow({ label, signal, detail, contribution, weight }: {
  label: string; signal: "bullish" | "bearish" | "neutral";
  detail: string; contribution: number; weight: number;
}) {
  const color = signal === "bullish" ? "text-emerald-600 dark:text-emerald-400"
    : signal === "bearish" ? "text-red-500" : "text-amber-500";
  const barColor = signal === "bullish" ? "bg-emerald-500" : signal === "bearish" ? "bg-red-500" : "bg-amber-400";
  const barWidth = Math.abs(contribution / weight) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground w-36 shrink-0">{label}</span>
        <span className="flex-1 text-center text-muted-foreground/70 text-[10px] hidden sm:block">{detail}</span>
        <span className={`font-semibold ml-2 shrink-0 ${color}`}>
          {signal === "bullish" ? "▲ Bullish" : signal === "bearish" ? "▼ Bearish" : "— Neutral"}
        </span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface StockOutlookProps {
  spotPrice: number;
  garchVol: number | null;
  historicalVol: number;
  riskFreeRate: number;   // decimal
  dividendYield: number;  // decimal
  technicals: TechnicalIndicators | null;
  sentimentScore?: number;
  vixLevel?: number;
  currency?: string;
  symbol?: string;
  macroScore?: number;    // -100..+100 from macro-impact engine
}

export function StockOutlook({
  spotPrice, garchVol, historicalVol, riskFreeRate, dividendYield,
  technicals, sentimentScore, vixLevel, currency = "₹", symbol, macroScore,
}: StockOutlookProps) {
  const [horizonDays, setHorizonDays] = useState(21);
  const [targetPrice, setTargetPrice] = useState<number | "">(
    spotPrice > 0 ? Math.round(spotPrice * 1.05) : ""
  );

  const effectiveVol = garchVol ?? historicalVol;
  const techScore = technicals?.overallScore ?? 0;

  const signal = useMemo(() =>
    buildConsolidatedSignal(technicals, garchVol, historicalVol, sentimentScore, vixLevel, macroScore),
    [technicals, garchVol, historicalVol, sentimentScore, vixLevel, macroScore]
  );

  const cone = useMemo(() =>
    spotPrice > 0 && effectiveVol > 0
      ? buildPriceCone(spotPrice, effectiveVol, riskFreeRate, dividendYield, horizonDays, techScore)
      : [],
    [spotPrice, effectiveVol, riskFreeRate, dividendYield, horizonDays, techScore]
  );

  const targetProb = useMemo((): TargetProbability | null => {
    if (typeof targetPrice !== "number" || targetPrice <= 0 || spotPrice <= 0 || effectiveVol <= 0) return null;
    return computeTargetProbability(spotPrice, targetPrice, effectiveVol, riskFreeRate, dividendYield, horizonDays, techScore);
  }, [targetPrice, spotPrice, effectiveVol, riskFreeRate, dividendYield, horizonDays, techScore]);

  if (spotPrice <= 0 || effectiveVol <= 0) return null;

  const isAbove = typeof targetPrice === "number" && targetPrice > spotPrice;
  const touchProb = targetProb ? (isAbove ? targetProb.probTouchUp : targetProb.probTouchDown) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="size-5" />
          Stock Outlook
          {symbol && <Badge variant="outline" className="text-xs">{symbol}</Badge>}
        </CardTitle>
        <CardDescription>
          Directional signal, GARCH price cone, and target probability — based on {effectiveVol === garchVol ? "GARCH-fitted" : "historical"} volatility, technicals, and news sentiment.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Consolidated Signal ── */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <SignalBadge signal={signal.signal} />
              <p className="text-xs text-muted-foreground mt-1.5 max-w-md">{signal.summary}</p>
            </div>
            <div className="text-right space-y-1">
              <div className="text-2xl font-bold font-mono">
                {signal.score >= 0 ? "+" : ""}{signal.score}
                <span className="text-sm text-muted-foreground font-normal">/100</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Confidence: <span className="font-semibold text-foreground">{signal.confidence}%</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Score bar */}
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground flex justify-between">
              <span>Bearish -100</span><span>Neutral 0</span><span>Bullish +100</span>
            </div>
            <div className="h-2 bg-muted rounded-full relative overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={`absolute top-0 bottom-0 ${signal.score >= 0 ? "left-1/2" : "right-1/2"} ${signal.score >= 20 ? "bg-emerald-500" : signal.score <= -20 ? "bg-red-500" : "bg-amber-400"} rounded-full`}
                style={{ width: `${Math.abs(signal.score) / 2}%` }}
              />
            </div>
          </div>

          {/* Component signals */}
          <div className="space-y-2 pt-1">
            {signal.components.map((c) => (
              <SignalRow key={c.label} label={c.label} signal={c.signal}
                detail={c.detail} contribution={c.contribution} weight={c.weight} />
            ))}
          </div>

          {/* Key risk */}
          <div className="rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            ⚠ {signal.keyRisk}
          </div>
        </div>

        {/* ── GARCH Price Cone ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium">Price Range Forecast</p>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Horizon</Label>
              <select
                className="text-xs border rounded px-2 py-1 bg-background"
                value={horizonDays}
                onChange={(e) => setHorizonDays(parseInt(e.target.value))}
              >
                {[7, 14, 21, 30, 45, 60].map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            GBM price cone using {effectiveVol === garchVol ? "GARCH" : "historical"} σ = {(effectiveVol * 100).toFixed(1)}% + technical drift bias. 68% and 95% confidence bands.
          </p>
          {cone.length > 0 && <PriceConeChart cone={cone} spot={spotPrice} currency={currency} />}
        </div>

        <Separator />

        {/* ── Target Probability ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Price Target Probability</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter a target price to see the probability of the stock reaching it within your horizon.
          </p>

          <div className="flex items-center gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Target Price ({currency})</Label>
              <Input
                type="number" min={0} step="any"
                className="h-8 text-sm"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
              />
            </div>
            <div className="space-y-1 text-center">
              <Label className="text-xs">Current Spot</Label>
              <p className="font-mono text-sm font-semibold h-8 flex items-center">{ccy(spotPrice, currency)}</p>
            </div>
            <div className="space-y-1 text-center">
              <Label className="text-xs">Move Required</Label>
              <p className={`font-mono text-sm font-semibold h-8 flex items-center ${typeof targetPrice === "number" ? (targetPrice > spotPrice ? "text-emerald-600" : "text-red-500") : ""}`}>
                {typeof targetPrice === "number" && spotPrice > 0
                  ? pct(((targetPrice - spotPrice) / spotPrice) * 100)
                  : "—"}
              </p>
            </div>
          </div>

          {targetProb && (
            <div className="grid grid-cols-2 gap-3">
              {/* Terminal probability */}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">P(reaches target by day {horizonDays})</p>
                <p className={`text-2xl font-bold font-mono ${isAbove ? "text-emerald-600" : "text-red-500"}`}>
                  {prob(touchProb ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  First-passage probability — chance of touching {isAbove ? "above" : "below"} {ccy(targetPrice as number, currency)} at any point before day {horizonDays}
                </p>
              </div>

              {/* Terminal split */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">At expiry (day {horizonDays})</p>
                <div className="flex gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Above target</span>
                    <p className="font-mono font-bold text-emerald-600">{prob(targetProb.probAbove)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Below target</span>
                    <p className="font-mono font-bold text-red-500">{prob(targetProb.probBelow)}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Log-normal GBM with drift bias from technical score ({techScore >= 0 ? "+" : ""}{techScore})
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
