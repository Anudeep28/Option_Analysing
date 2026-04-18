"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown, IndianRupee } from "lucide-react";
import { normalCDF } from "@/lib/math";
import type { OptionType } from "@/lib/types";

interface ProfitProbabilityProps {
  optionType: OptionType;
  spotPrice: number;
  strikePrice: number;
  volatility: number;    // decimal, e.g. 0.25
  timeToExpiry: number;  // years, e.g. 0.25
  riskFreeRate: number;  // decimal, e.g. 0.065
  dividendYield: number; // decimal
  theoreticalPrice: number;
  marketLTP?: number;
  onMarketLTPChange?: (v: number | undefined) => void;
}

function computeD2(
  spot: number, strike: number, vol: number, t: number, r: number, q: number,
): number {
  if (vol <= 0 || t <= 0 || spot <= 0 || strike <= 0) return 0;
  const d1 = (Math.log(spot / strike) + (r - q + 0.5 * vol * vol) * t) / (vol * Math.sqrt(t));
  return d1 - vol * Math.sqrt(t);
}

const MOVE_LEVELS = [-15, -10, -5, -3, 0, 3, 5, 10, 15];

export function ProfitProbability({
  optionType, spotPrice, strikePrice, volatility, timeToExpiry,
  riskFreeRate, dividendYield, theoreticalPrice, marketLTP, onMarketLTPChange,
}: ProfitProbabilityProps) {
  const [ltpInput, setLtpInput] = useState(marketLTP !== undefined ? String(marketLTP) : "");

  const isCall = optionType === "call";
  const d2 = computeD2(spotPrice, strikePrice, volatility, timeToExpiry, riskFreeRate, dividendYield);
  const popItm = isCall ? normalCDF(d2) : normalCDF(-d2);

  const premiumUsed = marketLTP ?? theoreticalPrice;
  const breakEven = isCall ? strikePrice + premiumUsed : strikePrice - premiumUsed;
  const moveNeededPct = ((breakEven - spotPrice) / spotPrice) * 100;

  // Break-even PoP: probability underlying exceeds break-even at expiry
  const d2Be = computeD2(spotPrice, breakEven, volatility, timeToExpiry, riskFreeRate, dividendYield);
  const popBreakEven = isCall ? normalCDF(d2Be) : normalCDF(-d2Be);

  const priceDiff = marketLTP !== undefined ? marketLTP - theoreticalPrice : null;

  function handleLtpChange(raw: string) {
    setLtpInput(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0) {
      onMarketLTPChange?.(parsed);
    } else if (raw === "" || raw === "0") {
      onMarketLTPChange?.(undefined);
    }
  }

  function pnlAtExpiry(spotAtExpiry: number): number {
    const intrinsic = isCall
      ? Math.max(0, spotAtExpiry - strikePrice)
      : Math.max(0, strikePrice - spotAtExpiry);
    return intrinsic - premiumUsed;
  }

  const tableRows = MOVE_LEVELS.map((pct) => {
    const spotAtExpiry = spotPrice * (1 + pct / 100);
    const pnl = pnlAtExpiry(spotAtExpiry);
    return { pct, spotAtExpiry, pnl };
  });

  const popColor = popBreakEven >= 0.5 ? "text-emerald-600" : popBreakEven >= 0.35 ? "text-amber-600" : "text-red-500";
  const itmColor = popItm >= 0.5 ? "text-emerald-600" : popItm >= 0.35 ? "text-amber-600" : "text-red-500";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="size-5" />
          Probability of Profit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Market LTP input */}
        <div className="space-y-1.5">
          <Label className="text-sm">
            Market LTP <span className="text-muted-foreground font-normal">(price you see on your demat account)</span>
          </Label>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-[180px]">
              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={0.01}
                step="0.05"
                placeholder={theoreticalPrice.toFixed(2)}
                value={ltpInput}
                onChange={(e) => handleLtpChange(e.target.value)}
                className="pl-7"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Model price: <span className="font-mono font-medium">₹{theoreticalPrice.toFixed(2)}</span>
            </div>
            {priceDiff !== null && (
              <Badge variant={priceDiff > 0.5 ? "destructive" : priceDiff < -0.5 ? "default" : "secondary"} className="text-xs">
                {priceDiff > 0.5 ? "Overpriced" : priceDiff < -0.5 ? "Underpriced" : "Fair"}{" "}
                {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(2)}
              </Badge>
            )}
          </div>
          {priceDiff !== null && Math.abs(priceDiff) > 0.5 && (
            <p className="text-xs text-muted-foreground">
              {priceDiff > 0
                ? "Market is charging more than model value — you're paying an IV premium. Consider if the extra cost is justified."
                : "Market price is below model value — potentially underpriced, but verify with live IV data."}
            </p>
          )}
        </div>

        <Separator />

        {/* Probability metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-center space-y-1">
            <div className={`text-2xl font-bold font-mono ${itmColor}`}>
              {(popItm * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Probability expires ITM</p>
            <p className="text-[10px] text-muted-foreground/70">N(d₂) — risk-neutral probability</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center space-y-1">
            <div className={`text-2xl font-bold font-mono ${popColor}`}>
              {(popBreakEven * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Probability of profit at expiry</p>
            <p className="text-[10px] text-muted-foreground/70">Based on ₹{premiumUsed.toFixed(2)} premium</p>
          </div>
        </div>

        {/* Break-even analysis */}
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {isCall ? <TrendingUp className="size-4 text-emerald-500" /> : <TrendingDown className="size-4 text-red-500" />}
            Break-Even Analysis
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Break-even price</span>
              <p className="font-mono font-bold">₹{breakEven.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Move needed from spot</span>
              <p className={`font-mono font-bold ${moveNeededPct > 0 ? "text-emerald-600" : "text-red-500"}`}>
                {moveNeededPct > 0 ? "+" : ""}{moveNeededPct.toFixed(2)}%
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isCall
              ? `${strikePrice} (strike) + ${premiumUsed.toFixed(2)} (premium) = ${breakEven.toFixed(2)}`
              : `${strikePrice} (strike) − ${premiumUsed.toFixed(2)} (premium) = ${breakEven.toFixed(2)}`}
          </p>
        </div>

        <Separator />

        {/* P&L at expiry table */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">P&amp;L at Expiry — Various Price Scenarios</p>
          <p className="text-xs text-muted-foreground">
            Based on premium paid: ₹{premiumUsed.toFixed(2)} · Spot: ₹{spotPrice.toFixed(2)}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5">Underlying at expiry</th>
                  <th className="text-right py-1.5">Move</th>
                  <th className="text-right py-1.5 font-semibold">P&amp;L per unit</th>
                  <th className="text-right py-1.5">Result</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(({ pct, spotAtExpiry, pnl }) => {
                  const isProfit = pnl > 0;
                  const isBreakEvenRow = pct === 0;
                  return (
                    <tr
                      key={pct}
                      className={`border-b border-border/40 ${isBreakEvenRow ? "bg-muted/30" : ""}`}
                    >
                      <td className="py-1 font-mono">₹{spotAtExpiry.toFixed(2)}</td>
                      <td className={`py-1 font-mono text-right ${pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {pct > 0 ? "+" : ""}{pct}%
                      </td>
                      <td className={`py-1 font-mono text-right font-semibold ${isProfit ? "text-emerald-600" : pnl < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {pnl > 0 ? "+" : ""}₹{pnl.toFixed(2)}
                      </td>
                      <td className="py-1 text-right">
                        <Badge variant={isProfit ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                          {isProfit ? "Profit" : "Loss"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground">
            * P&amp;L shown per unit. Multiply by lot size for actual P&amp;L (e.g. NIFTY = 75 units/lot).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
