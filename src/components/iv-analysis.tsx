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
    low: "text-green-400",
    normal: "text-blue-400",
    elevated: "text-yellow-400",
    extreme: "text-red-400",
  }[analysis.volRegime];

  const regimeBg = {
    low: "bg-green-500/10 border-green-500/30",
    normal: "bg-blue-500/10 border-blue-500/30",
    elevated: "bg-yellow-500/10 border-yellow-500/30",
    extreme: "bg-red-500/10 border-red-500/30",
  }[analysis.volRegime];

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span className="text-purple-400">📊</span> Volatility Analysis
      </h3>

      <div className={`rounded-md border p-3 mb-3 ${regimeBg}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/60">Vol Regime</span>
          <span className={`text-sm font-bold uppercase ${regimeColor}`}>
            {analysis.volRegime}
          </span>
        </div>
        <p className="text-xs text-white/70 mt-1">{analysis.interpretation}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-md bg-white/5 p-2">
          <div className="text-xs text-white/50">IV Rank</div>
          <div className="text-lg font-bold text-white">{analysis.ivRank.toFixed(0)}%</div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400"
              style={{ width: `${analysis.ivRank}%` }}
            />
          </div>
        </div>
        <div className="rounded-md bg-white/5 p-2">
          <div className="text-xs text-white/50">IV Percentile</div>
          <div className="text-lg font-bold text-white">{analysis.ivPercentile.toFixed(0)}%</div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
            <div
              className="h-1.5 rounded-full bg-purple-400"
              style={{ width: `${analysis.ivPercentile}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">Current IV</div>
          <div className="text-sm font-semibold text-white">{(analysis.currentIV * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">Historical Vol</div>
          <div className="text-sm font-semibold text-white">{(analysis.historicalVol * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">IV-HV Spread</div>
          <div className={`text-sm font-semibold ${analysis.ivHvSpread > 0 ? "text-red-400" : "text-green-400"}`}>
            {analysis.ivHvSpread > 0 ? "+" : ""}{(analysis.ivHvSpread * 100).toFixed(1)}pp
          </div>
        </div>
      </div>
    </div>
  );
}
