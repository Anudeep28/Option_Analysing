"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, LineChart, Newspaper, Activity } from "lucide-react";
import { forecastStockMovement } from "@/lib/trade-decision";

interface StockForecastProps {
  spotPrice: number;
  volatility: number;     // decimal
  riskFreeRate: number;   // decimal
  dividendYield: number;  // decimal
  days: number;           // horizon
  currency: string;
  symbol?: string;
  sentimentScore?: number;
  technicalScore?: number;
  sentimentActive?: boolean;
  technicalsActive?: boolean;
}

export function StockForecast({
  spotPrice, volatility, riskFreeRate, dividendYield, days, currency,
  symbol, sentimentScore, technicalScore, sentimentActive, technicalsActive,
}: StockForecastProps) {
  const f = useMemo(
    () => forecastStockMovement({
      spotPrice, volatility, days, riskFreeRate, dividendYield, sentimentScore, technicalScore,
    }),
    [spotPrice, volatility, days, riskFreeRate, dividendYield, sentimentScore, technicalScore],
  );

  const biasStyle =
    f.bias === "bullish" ? "text-emerald-600 dark:text-emerald-400"
    : f.bias === "bearish" ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";
  const BiasIcon = f.bias === "bullish" ? TrendingUp : f.bias === "bearish" ? TrendingDown : Minus;

  const fmt = (n: number) => `${currency}${n.toLocaleString(undefined, { maximumFractionDigits: n > 1000 ? 0 : 2 })}`;

  // position of expected price within 2-sigma band (for the bar marker)
  const range = f.twoSigmaHigh - f.twoSigmaLow;
  const spotPos = range > 0 ? ((spotPrice - f.twoSigmaLow) / range) * 100 : 50;
  const expPos = range > 0 ? ((f.expectedPrice - f.twoSigmaLow) / range) * 100 : 50;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <LineChart className="size-5" />
          Stock Movement Forecast
          {symbol && <Badge variant="outline" className="text-xs ml-1">{symbol}</Badge>}
        </CardTitle>
        <CardDescription>
          Where the underlying is likely to be in {days} day{days > 1 ? "s" : ""} (log-normal model + sentiment)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Signal sources powering the forecast */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-0.5">Forecast uses:</span>
          <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400">
            <Activity className="size-3" /> Volatility {(volatility * 100).toFixed(1)}%
          </Badge>
          {sentimentActive ? (
            <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400">
              <Newspaper className="size-3" /> News {sentimentScore !== undefined ? (sentimentScore > 0.1 ? "Bullish" : sentimentScore < -0.1 ? "Bearish" : "Neutral") : "On"}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground opacity-70">
              <Newspaper className="size-3" /> News: off
            </Badge>
          )}
          {technicalsActive ? (
            <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="size-3" /> Technicals {technicalScore !== undefined ? (technicalScore > 15 ? "Bullish" : technicalScore < -15 ? "Bearish" : "Neutral") : "On"}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground opacity-70">
              <TrendingUp className="size-3" /> Technicals: off
            </Badge>
          )}
        </div>

        {/* Bias */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BiasIcon className={`size-5 ${biasStyle}`} />
            <span className={`font-bold ${biasStyle}`}>{f.bias.toUpperCase()}</span>
            {f.biasStrength > 0 && (
              <span className="text-xs text-muted-foreground">({f.biasStrength.toFixed(0)}% conviction)</span>
            )}
          </div>
          <div className="text-right text-sm">
            <span className="text-muted-foreground">Expected: </span>
            <span className="font-mono font-semibold">{fmt(f.expectedPrice)}</span>
          </div>
        </div>

        {/* Probability split */}
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 p-2 text-center">
            <div className="text-xs text-muted-foreground">Prob. UP</div>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{(f.probUp * 100).toFixed(0)}%</div>
          </div>
          <div className="flex-1 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-2 text-center">
            <div className="text-xs text-muted-foreground">Prob. DOWN</div>
            <div className="text-lg font-bold font-mono text-red-600 dark:text-red-400">{(f.probDown * 100).toFixed(0)}%</div>
          </div>
        </div>

        {/* Range visualization */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Expected price range</div>
          <div className="relative h-8 rounded-md bg-gradient-to-r from-red-200 via-amber-100 to-emerald-200 dark:from-red-950 dark:via-amber-950 dark:to-emerald-950">
            {/* spot marker */}
            <div className="absolute top-0 h-8 w-0.5 bg-foreground" style={{ left: `${Math.max(0, Math.min(100, spotPos))}%` }} title="Current spot" />
            {/* expected marker */}
            <div className="absolute top-0 h-8 w-0.5 bg-blue-500" style={{ left: `${Math.max(0, Math.min(100, expPos))}%` }} title="Expected price" />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{fmt(f.twoSigmaLow)}</span>
            <span>spot {fmt(spotPrice)}</span>
            <span>{fmt(f.twoSigmaHigh)}</span>
          </div>
        </div>

        {/* Range table */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">Likely range (68% / 1σ)</div>
            <div className="font-mono font-semibold">{fmt(f.oneSigmaLow)} – {fmt(f.oneSigmaHigh)}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">Wide range (95% / 2σ)</div>
            <div className="font-mono font-semibold">{fmt(f.twoSigmaLow)} – {fmt(f.twoSigmaHigh)}</div>
          </div>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Typical daily move: ±{f.dailySigmaPct.toFixed(2)}%</span>
          <span>Over {days}d: ±{f.horizonSigmaPct.toFixed(2)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
