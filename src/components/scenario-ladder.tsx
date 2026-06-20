"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buildScenarioLadder } from "@/lib/vol-surface";
import type { MarketData, OptionType } from "@/lib/types";

interface ScenarioLadderProps {
  market: MarketData;
  optionType: OptionType;
  entryPrice: number;
  currency: string;
}

export function ScenarioLadder({ market, optionType, entryPrice, currency }: ScenarioLadderProps) {
  const ladder = useMemo(
    () => buildScenarioLadder(market, optionType, entryPrice),
    [market, optionType, entryPrice],
  );

  const flatVolIdx = ladder.volMoves.indexOf(0);

  function cellColor(pnl: number): string {
    if (pnl > entryPrice * 0.5) return "bg-emerald-600 text-white";
    if (pnl > entryPrice * 0.1) return "bg-emerald-500/80 text-white";
    if (pnl > 0) return "bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200";
    if (pnl > -entryPrice * 0.1) return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300";
    if (pnl > -entryPrice * 0.5) return "bg-red-300 dark:bg-red-900/70 text-red-900 dark:text-red-100";
    return "bg-red-600 text-white";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Scenario P&L Ladder</CardTitle>
        <CardDescription>
          How your position P&L changes across spot moves and vol shifts — investment bank style risk matrix
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left p-1.5 font-semibold text-muted-foreground border border-border/50 bg-muted/30 whitespace-nowrap">
                  Spot ↓ / Vol →
                </th>
                {ladder.volMoves.map((v) => (
                  <th
                    key={v}
                    className={`p-1.5 font-semibold text-center border border-border/50 whitespace-nowrap ${v === 0 ? "bg-blue-50 dark:bg-blue-950" : "bg-muted/30"}`}
                  >
                    {v > 0 ? "+" : ""}{v}% vol
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ladder.spotMoves.map((spot, si) => (
                <tr key={spot}>
                  <td className={`p-1.5 font-semibold border border-border/50 whitespace-nowrap ${spot === 0 ? "bg-blue-50 dark:bg-blue-950" : "bg-muted/20"}`}>
                    {spot > 0 ? "+" : ""}{spot}% spot
                  </td>
                  {ladder.volMoves.map((vol, vi) => {
                    const cell = ladder.matrix[si][vi];
                    const isFlat = vi === flatVolIdx;
                    return (
                      <td
                        key={vol}
                        className={`p-1.5 text-center border border-border/50 font-mono font-semibold transition-colors ${cellColor(cell.pnl)} ${isFlat ? "ring-1 ring-inset ring-blue-400" : ""}`}
                        title={`New price: ${currency}${cell.newPrice.toFixed(2)} | P&L: ${cell.pnl >= 0 ? "+" : ""}${cell.pnl.toFixed(2)}`}
                      >
                        {cell.pnl >= 0 ? "+" : ""}{cell.pnl.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Entry premium: <strong className="text-foreground">{currency}{entryPrice.toFixed(2)}</strong></span>
          {ladder.breakEvenSpotMoves.up !== null && (
            <span>Break-even up: <strong className="text-emerald-600">+{ladder.breakEvenSpotMoves.up.toFixed(1)}%</strong></span>
          )}
          {ladder.breakEvenSpotMoves.down !== null && (
            <span>Break-even down: <strong className="text-red-500">{ladder.breakEvenSpotMoves.down.toFixed(1)}%</strong></span>
          )}
          <span className="ml-auto">Blue column = current vol | Highlighted border = flat-vol column</span>
        </div>
      </CardContent>
    </Card>
  );
}
