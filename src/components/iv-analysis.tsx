"use client";

import { computeIVAnalysis, type IVAnalysis } from "@/lib/technicals";

interface IVAnalysisPanelProps {
  currentIV: number;
  historicalVol: number;
  ivHistory?: number[];
}

export function IVAnalysisPanel({ currentIV, historicalVol, ivHistory }: IVAnalysisPanelProps) {
  if (!currentIV || !historicalVol) return null;

  const analysis = computeIVAnalysis(currentIV, historicalVol, ivHistory);

  const regimeColor = {
    low: "text-emerald-600 dark:text-emerald-400",
    normal: "text-blue-600 dark:text-blue-400",
    elevated: "text-amber-600 dark:text-amber-400",
    extreme: "text-red-600 dark:text-red-400",
  }[analysis.volRegime];

  const regimeBg = {
    low: "bg-emerald-500/10 border-emerald-500/30",
    normal: "bg-blue-500/10 border-blue-500/30",
    elevated: "bg-amber-500/10 border-amber-500/30",
    extreme: "bg-red-500/10 border-red-500/30",
  }[analysis.volRegime];

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="text-purple-600 dark:text-purple-400">📊</span> Volatility Analysis
      </h3>

      <div className={`rounded-md border p-3 mb-3 ${regimeBg}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Vol Regime</span>
          <span className={`text-sm font-bold uppercase ${regimeColor}`}>
            {analysis.volRegime}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{analysis.interpretation}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-md bg-muted p-2">
          <div className="text-xs text-muted-foreground">IV Rank</div>
          <div className="text-lg font-bold text-foreground">{analysis.ivRank.toFixed(0)}%</div>
          <div className="w-full bg-muted-foreground/20 rounded-full h-1.5 mt-1">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400"
              style={{ width: `${analysis.ivRank}%` }}
            />
          </div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-xs text-muted-foreground">IV Percentile</div>
          <div className="text-lg font-bold text-foreground">{analysis.ivPercentile.toFixed(0)}%</div>
          <div className="w-full bg-muted-foreground/20 rounded-full h-1.5 mt-1">
            <div
              className="h-1.5 rounded-full bg-purple-400"
              style={{ width: `${analysis.ivPercentile}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-muted p-2">
          <div className="text-xs text-muted-foreground">Current IV</div>
          <div className="text-sm font-semibold text-foreground">{(analysis.currentIV * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded bg-muted p-2">
          <div className="text-xs text-muted-foreground">Historical Vol</div>
          <div className="text-sm font-semibold text-foreground">{(analysis.historicalVol * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded bg-muted p-2">
          <div className="text-xs text-muted-foreground">IV-HV Spread</div>
          <div className={`text-sm font-semibold ${analysis.ivHvSpread > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {analysis.ivHvSpread > 0 ? "+" : ""}{(analysis.ivHvSpread * 100).toFixed(1)}pp
          </div>
        </div>
      </div>
    </div>
  );
}
