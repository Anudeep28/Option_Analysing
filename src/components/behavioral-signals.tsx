"use client";

import { computeBehavioralSignals, type BehavioralSignals } from "@/lib/technicals";

interface BehavioralSignalsPanelProps {
  currentPrice: number;
  high52w: number;
  low52w: number;
  currentVolume: number;
  avgVolume: number;
  rsi: number;
  ivRank: number;
  pcr: number;
  vixLevel?: number;
}

export function BehavioralSignalsPanel(props: BehavioralSignalsPanelProps) {
  const { currentPrice, high52w, low52w } = props;
  if (!currentPrice || !high52w || !low52w) return null;

  const signals = computeBehavioralSignals(
    props.currentPrice, props.high52w, props.low52w,
    props.currentVolume, props.avgVolume,
    props.rsi, props.ivRank, props.pcr, props.vixLevel,
  );

  const fgColor =
    signals.fearGreedScore < 20 ? "text-red-400" :
    signals.fearGreedScore < 40 ? "text-orange-400" :
    signals.fearGreedScore < 60 ? "text-blue-300" :
    signals.fearGreedScore < 80 ? "text-green-300" : "text-green-400";

  const fgGradient =
    signals.fearGreedScore < 30 ? "from-red-500 to-orange-500" :
    signals.fearGreedScore < 50 ? "from-orange-400 to-yellow-400" :
    signals.fearGreedScore < 70 ? "from-yellow-400 to-green-400" :
    "from-green-400 to-emerald-500";

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span className="text-pink-400">🧠</span> Behavioral Finance Signals
      </h3>

      {/* Fear & Greed Gauge */}
      <div className="rounded-md bg-white/5 border border-white/10 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/50">Fear & Greed Index</span>
          <span className={`text-sm font-bold ${fgColor}`}>{signals.fearGreedLabel}</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3 relative">
          <div
            className={`h-3 rounded-full bg-gradient-to-r ${fgGradient} transition-all`}
            style={{ width: `${signals.fearGreedScore}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white drop-shadow">
              {signals.fearGreedScore.toFixed(0)}
            </span>
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-white/40 mt-1">
          <span>Extreme Fear</span>
          <span>Neutral</span>
          <span>Extreme Greed</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">52-Week Position</div>
          <div className="text-sm font-bold text-white">
            {signals.fiftyTwoWeekPosition.toFixed(0)}%
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
            <div
              className="h-1.5 rounded-full bg-blue-400"
              style={{ width: `${signals.fiftyTwoWeekPosition}%` }}
            />
          </div>
        </div>
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">Volume vs Avg</div>
          <div className={`text-sm font-bold ${signals.volumeSurge ? "text-yellow-400" : "text-white"}`}>
            {signals.volumeSurgeRatio?.toFixed(1)}x
            {signals.volumeSurge && <span className="text-xs ml-1">⚡</span>}
          </div>
        </div>
      </div>

      {signals.vixLevel !== undefined && (
        <div className="rounded bg-white/5 p-2 mb-3">
          <div className="text-xs text-white/50">India VIX</div>
          <div className={`text-sm font-bold ${
            signals.vixLevel > 25 ? "text-red-400" :
            signals.vixLevel > 18 ? "text-yellow-400" : "text-green-400"
          }`}>
            {signals.vixLevel.toFixed(2)}
          </div>
          {signals.vixInterpretation && (
            <p className="text-xs text-white/60 mt-1">{signals.vixInterpretation}</p>
          )}
        </div>
      )}

      <p className="text-xs text-white/70">{signals.interpretation}</p>
    </div>
  );
}
