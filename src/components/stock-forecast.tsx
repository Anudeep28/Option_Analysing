"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, LineChart, Newspaper, Activity, Briefcase } from "lucide-react";
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

  const [avgBuyPrice, setAvgBuyPrice] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");

  const biasStyle =
    f.bias === "bullish" ? "text-emerald-600 dark:text-emerald-400"
    : f.bias === "bearish" ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";
  const BiasIcon = f.bias === "bullish" ? TrendingUp : f.bias === "bearish" ? TrendingDown : Minus;

  const fmt = (n: number) => `${currency}${n.toLocaleString(undefined, { maximumFractionDigits: n > 1000 ? 0 : 2 })}`;

  const hasHolding = typeof avgBuyPrice === "number" && avgBuyPrice > 0
    && typeof quantity === "number" && quantity > 0;
  const costBasis = hasHolding ? avgBuyPrice * quantity : 0;
  const currentValue = hasHolding ? spotPrice * quantity : 0;
  const pnl = currentValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  let recommendation: "HOLD" | "SELL" | null = null;
  let recReason = "";
  if (hasHolding) {
    if (f.bias === "bearish" && f.biasStrength > 30) {
      recommendation = "SELL";
      recReason = pnl >= 0
        ? `Forecast is bearish (${f.biasStrength.toFixed(0)}% conviction) with only ${(f.probUp * 100).toFixed(0)}% chance of upside. Consider taking your +${pnlPct.toFixed(1)}% profit.`
        : `Forecast is bearish (${f.biasStrength.toFixed(0)}% conviction) with only ${(f.probUp * 100).toFixed(0)}% chance of recovery. Consider cutting the -${Math.abs(pnlPct).toFixed(1)}% loss.`;
    } else if (f.bias === "bullish" && f.biasStrength > 30) {
      recommendation = "HOLD";
      recReason = pnl >= 0
        ? `Forecast is bullish (${f.biasStrength.toFixed(0)}% conviction, ${(f.probUp * 100).toFixed(0)}% prob. up). Let winners run — expected price is ${fmt(f.expectedPrice)}.`
        : `Forecast is bullish (${f.biasStrength.toFixed(0)}% conviction, ${(f.probUp * 100).toFixed(1)}% prob. up). Hold for recovery toward expected price ${fmt(f.expectedPrice)}.`;
    } else {
      recommendation = "HOLD";
      recReason = `No strong directional edge (${f.bias} at ${f.biasStrength.toFixed(0)}% conviction). Avoid churning; hold and reassess.`;
    }
  }

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
        <p className="text-[10px] text-muted-foreground mt-1">
          Real-world directional forecast. Option pricing above uses the risk-neutral drift (r − q) regardless of these signals.
        </p>
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

        {/* Existing stock holding decision */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Briefcase className="size-4" />
            Already Own This Stock?
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Avg Buy Price ({currency})</Label>
              <Input
                type="number" step="any" min={0}
                placeholder="e.g. 18000"
                value={avgBuyPrice}
                onChange={(e) => setAvgBuyPrice(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantity Owned</Label>
              <Input
                type="number" min={1} step="1"
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === "" ? "" : parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {hasHolding && recommendation && (
            <div className={`rounded-lg border-2 p-3 space-y-2 ${recommendation === "SELL" ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950" : "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {recommendation === "SELL" ? (
                    <TrendingDown className={`size-5 ${recommendation === "SELL" ? "text-red-600 dark:text-red-400" : ""}`} />
                  ) : (
                    <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className={`text-lg font-bold ${recommendation === "SELL" ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {recommendation}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold font-mono ${pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {pnl >= 0 ? "+" : ""}{currency}{pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">unrealized P&L</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{recReason}</p>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded border bg-background/60 p-2">
                  <div className="text-muted-foreground">Cost Basis</div>
                  <div className="font-mono font-semibold">{currency}{costBasis.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                </div>
                <div className="rounded border bg-background/60 p-2">
                  <div className="text-muted-foreground">Current Value</div>
                  <div className="font-mono font-semibold">{currency}{currentValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            </div>
          )}

          {!hasHolding && (
            <p className="text-xs text-muted-foreground italic">
              Enter your average buy price and quantity to get a sell/hold recommendation for this stock.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
