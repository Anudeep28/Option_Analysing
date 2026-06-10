"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PositionTrackerProps {
  theoreticalPrice: number;
  optionType: "call" | "put";
  spotPrice: number;
  strikePrice: number;
  currency: string;
  lotSize: number;
  marketLTP?: number;
  symbol?: string;
}

export function PositionTracker({
  theoreticalPrice,
  optionType,
  spotPrice,
  strikePrice,
  currency,
  lotSize,
  marketLTP,
  symbol,
}: PositionTrackerProps) {
  const [entryPremium, setEntryPremium] = useState<number | "">(marketLTP ?? "");
  const [lots, setLots] = useState(1);
  const [customLotSize, setCustomLotSize] = useState(lotSize);

  // Current premium: use market LTP if available, else theoretical
  const currentPremium = marketLTP ?? theoreticalPrice;
  const entry = typeof entryPremium === "number" ? entryPremium : 0;
  const hasEntry = typeof entryPremium === "number" && entryPremium > 0;

  // P&L calculations
  const pnlPerUnit = currentPremium - entry;
  const totalQuantity = customLotSize * lots;
  const totalPnL = pnlPerUnit * totalQuantity;
  const pnlPercent = entry > 0 ? (pnlPerUnit / entry) * 100 : 0;
  const totalInvestment = entry * totalQuantity;

  // Intrinsic value at current spot
  const intrinsic = optionType === "call"
    ? Math.max(spotPrice - strikePrice, 0)
    : Math.max(strikePrice - spotPrice, 0);
  const timeValueInPremium = currentPremium - intrinsic;

  // Breakeven stock price for the position
  const breakeven = optionType === "call"
    ? strikePrice + entry
    : strikePrice - entry;

  // Distance from spot to breakeven
  const breakevenDist = spotPrice > 0 ? ((breakeven - spotPrice) / spotPrice) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-lg">💼</span>
          Demat Position Tracker
          {symbol && <Badge variant="outline" className="text-xs ml-1">{symbol}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Position Inputs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Entry Premium ({currency})</Label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 150"
              value={entryPremium}
              onChange={(e) => {
                const v = e.target.value;
                setEntryPremium(v === "" ? "" : parseFloat(v) || 0);
              }}
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Price you paid for the option</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lot Size</Label>
            <Input
              type="number"
              min={1}
              value={customLotSize}
              onChange={(e) => setCustomLotSize(parseInt(e.target.value) || 1)}
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Units per lot</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">No. of Lots</Label>
            <Input
              type="number"
              min={1}
              value={lots}
              onChange={(e) => setLots(parseInt(e.target.value) || 1)}
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Quantity: {totalQuantity} units</p>
          </div>
        </div>

        {/* Current vs Entry */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Underlying (Spot)</span>
              <p className="font-mono font-semibold">{currency}{spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Strike Price</span>
              <p className="font-mono font-semibold">{currency}{strikePrice.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Entry Premium (Your Price)</span>
              <p className="font-mono font-semibold">
                {hasEntry ? `${currency}${entry.toFixed(2)}` : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Current Premium {marketLTP ? "(Market)" : "(Theoretical)"}</span>
              <p className="font-mono font-semibold">{currency}{currentPremium.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* P&L Display */}
        {hasEntry && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="text-sm font-medium">Profit & Loss</div>

              <div className="grid grid-cols-2 gap-3">
                {/* Per-unit P&L */}
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">P&L per Unit</div>
                  <div className={`text-lg font-bold font-mono ${pnlPerUnit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {pnlPerUnit >= 0 ? "+" : ""}{currency}{pnlPerUnit.toFixed(2)}
                  </div>
                  <div className={`text-xs font-mono ${pnlPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                  </div>
                </div>

                {/* Total P&L */}
                <div className={`rounded-lg border p-3 ${totalPnL >= 0 ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"}`}>
                  <div className="text-xs text-muted-foreground">Total P&L ({lots} lot{lots > 1 ? "s" : ""} × {customLotSize})</div>
                  <div className={`text-xl font-bold font-mono ${totalPnL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {totalPnL >= 0 ? "+" : ""}{currency}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Position Details */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded border bg-muted/30 p-2">
                  <div className="text-muted-foreground">Investment</div>
                  <div className="font-mono font-semibold">{currency}{totalInvestment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="rounded border bg-muted/30 p-2">
                  <div className="text-muted-foreground">Breakeven (Spot)</div>
                  <div className="font-mono font-semibold">{currency}{breakeven.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {breakevenDist >= 0 ? "+" : ""}{breakevenDist.toFixed(1)}% from spot
                  </div>
                </div>
                <div className="rounded border bg-muted/30 p-2">
                  <div className="text-muted-foreground">Time Value</div>
                  <div className="font-mono font-semibold">
                    {timeValueInPremium >= 0 ? `${currency}${timeValueInPremium.toFixed(2)}` : "0.00"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">in current premium</div>
                </div>
              </div>

              {/* Quick P&L scenarios at different spot levels */}
              <div className="text-xs">
                <div className="font-medium mb-1 text-muted-foreground">P&L at Different Spot Levels (at expiry)</div>
                <div className="grid grid-cols-5 gap-1">
                  {[-5, -2, 0, 2, 5].map((pct) => {
                    const futureSpot = spotPrice * (1 + pct / 100);
                    const futureIntrinsic = optionType === "call"
                      ? Math.max(futureSpot - strikePrice, 0)
                      : Math.max(strikePrice - futureSpot, 0);
                    const futurePayoff = (futureIntrinsic - entry) * totalQuantity;
                    return (
                      <div key={pct} className="rounded bg-muted/30 p-1.5 text-center">
                        <div className="text-[10px] text-muted-foreground">{pct >= 0 ? "+" : ""}{pct}%</div>
                        <div className="font-mono text-[10px]">{currency}{futureSpot.toFixed(0)}</div>
                        <div className={`font-mono font-semibold ${futurePayoff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {futurePayoff >= 0 ? "+" : ""}{currency}{futurePayoff.toFixed(0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {!hasEntry && (
          <p className="text-xs text-muted-foreground italic">
            Enter your entry premium (the price you paid for the option in your demat account) to see P&L analysis.
            {marketLTP ? " Or click an option chain row — LTP will auto-fill." : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
