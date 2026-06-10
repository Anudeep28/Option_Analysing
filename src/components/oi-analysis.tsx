"use client";

import { computeOIAnalysis, type OIAnalysis } from "@/lib/technicals";

interface OIAnalysisPanelProps {
  optionChainData: { strikePrice: number; callOI: number; putOI: number }[];
  spotPrice: number;
}

export function OIAnalysisPanel({ optionChainData, spotPrice }: OIAnalysisPanelProps) {
  if (!optionChainData || optionChainData.length === 0) return null;

  const analysis = computeOIAnalysis(optionChainData, spotPrice);

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span className="text-orange-400">🎯</span> Option Chain Intelligence
      </h3>

      {/* PCR & Max Pain */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-md bg-white/5 border border-white/10 p-3">
          <div className="text-xs text-white/50 mb-1">Put/Call Ratio</div>
          <div className={`text-xl font-bold ${
            analysis.putCallRatio > 1.2 ? "text-green-400" :
            analysis.putCallRatio < 0.7 ? "text-red-400" : "text-white"
          }`}>
            {analysis.putCallRatio.toFixed(2)}
          </div>
          <p className="text-xs text-white/60 mt-1">{analysis.pcrInterpretation}</p>
        </div>
        <div className="rounded-md bg-white/5 border border-white/10 p-3">
          <div className="text-xs text-white/50 mb-1">Max Pain</div>
          <div className="text-xl font-bold text-white">₹{analysis.maxPainStrike.toLocaleString()}</div>
          <p className="text-xs text-white/60 mt-1">{analysis.maxPainInterpretation}</p>
        </div>
      </div>

      {/* Top OI Strikes */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-white/50 mb-1">Top Call OI (Resistance)</div>
          {analysis.topCallOIStrikes.map((s) => (
            <div key={s.strike} className="flex justify-between text-xs py-0.5">
              <span className="text-red-300">₹{s.strike.toLocaleString()}</span>
              <span className="text-white/60">{(s.oi / 1000).toFixed(0)}K</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-xs text-white/50 mb-1">Top Put OI (Support)</div>
          {analysis.topPutOIStrikes.map((s) => (
            <div key={s.strike} className="flex justify-between text-xs py-0.5">
              <span className="text-green-300">₹{s.strike.toLocaleString()}</span>
              <span className="text-white/60">{(s.oi / 1000).toFixed(0)}K</span>
            </div>
          ))}
        </div>
      </div>

      {/* Unusual OI */}
      {analysis.unusualOI.length > 0 && (
        <div className="rounded-md bg-yellow-500/5 border border-yellow-500/20 p-2">
          <div className="text-xs font-semibold text-yellow-400 mb-1">⚡ Unusual Activity</div>
          {analysis.unusualOI.map((u, i) => (
            <div key={i} className="text-xs text-white/70 py-0.5">
              <span className={u.type === "call" ? "text-red-300" : "text-green-300"}>
                {u.type.toUpperCase()} ₹{u.strike.toLocaleString()}
              </span>{" "}
              — {u.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
