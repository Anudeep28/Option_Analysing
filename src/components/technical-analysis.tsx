"use client";

import { computeTechnicals, type TechnicalIndicators } from "@/lib/technicals";

interface TechnicalAnalysisPanelProps {
  closes: number[];
  symbol?: string;
}

export function TechnicalAnalysisPanel({ closes, symbol }: TechnicalAnalysisPanelProps) {
  if (!closes || closes.length < 50) return null;

  const tech = computeTechnicals(closes);
  if (!tech) return null;

  const signalColor = {
    strong_buy: "text-green-400",
    buy: "text-green-300",
    neutral: "text-blue-300",
    sell: "text-red-300",
    strong_sell: "text-red-400",
  }[tech.overallSignal];

  const signalBg = {
    strong_buy: "bg-green-500/10 border-green-500/30",
    buy: "bg-green-500/10 border-green-500/20",
    neutral: "bg-blue-500/10 border-blue-500/20",
    sell: "bg-red-500/10 border-red-500/20",
    strong_sell: "bg-red-500/10 border-red-500/30",
  }[tech.overallSignal];

  const trendIcon = {
    strong_uptrend: "🚀",
    uptrend: "📈",
    sideways: "➡️",
    downtrend: "📉",
    strong_downtrend: "💥",
  }[tech.trendDirection];

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span className="text-cyan-400">📐</span> Technical Analysis
        {symbol && <span className="text-xs text-white/40">({symbol})</span>}
      </h3>

      {/* Overall Signal */}
      <div className={`rounded-md border p-3 mb-3 ${signalBg}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-white/50">Technical Signal</span>
            <div className={`text-lg font-bold uppercase ${signalColor}`}>
              {tech.overallSignal.replace("_", " ")}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-white/50">Score</span>
            <div className="text-lg font-bold text-white">{tech.overallScore > 0 ? "+" : ""}{tech.overallScore}</div>
          </div>
        </div>
        <p className="text-xs text-white/70 mt-2">{tech.interpretation}</p>
      </div>

      {/* Indicators Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* RSI */}
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">RSI (14)</div>
          <div className={`text-sm font-bold ${
            tech.rsiSignal === "oversold" ? "text-green-400" :
            tech.rsiSignal === "overbought" ? "text-red-400" : "text-white"
          }`}>
            {tech.rsi14.toFixed(1)}
          </div>
          <div className="text-xs text-white/40 capitalize">{tech.rsiSignal}</div>
        </div>

        {/* MACD */}
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">MACD</div>
          <div className={`text-sm font-bold ${
            tech.macdSignal === "bullish" ? "text-green-400" :
            tech.macdSignal === "bearish" ? "text-red-400" : "text-white"
          }`}>
            {tech.macd.histogram > 0 ? "+" : ""}{tech.macd.histogram.toFixed(2)}
          </div>
          <div className="text-xs text-white/40 capitalize">{tech.macdSignal}</div>
        </div>

        {/* Bollinger */}
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">%B (Bollinger)</div>
          <div className={`text-sm font-bold ${
            tech.bbSignal === "oversold" ? "text-green-400" :
            tech.bbSignal === "overbought" ? "text-red-400" : "text-white"
          }`}>
            {(tech.bollingerBands.percentB * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-white/40 capitalize">{tech.bbSignal}</div>
        </div>
      </div>

      {/* Trend & MAs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">Trend</div>
          <div className="text-sm font-semibold text-white">
            {trendIcon} {tech.trendDirection.replace(/_/g, " ")}
          </div>
        </div>
        <div className="rounded bg-white/5 p-2">
          <div className="text-xs text-white/50">50 / 200 DMA</div>
          <div className="text-sm text-white">
            ₹{tech.sma50.toFixed(0)} / ₹{tech.sma200.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Support & Resistance */}
      {(tech.supportLevels.length > 0 || tech.resistanceLevels.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-white/50 mb-1">Support Levels</div>
            {tech.supportLevels.map((s) => (
              <div key={s} className="text-xs text-green-300">₹{s.toLocaleString()}</div>
            ))}
          </div>
          <div>
            <div className="text-xs text-white/50 mb-1">Resistance Levels</div>
            {tech.resistanceLevels.map((r) => (
              <div key={r} className="text-xs text-red-300">₹{r.toLocaleString()}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
