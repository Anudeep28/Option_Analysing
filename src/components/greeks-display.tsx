"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Greeks } from "@/lib/types";

interface GreeksDisplayProps {
  greeks: Greeks;
}

const GREEK_INFO: Record<keyof Greeks, { label: string; symbol: string; description: string }> = {
  delta: { label: "Delta", symbol: "Δ", description: "Price sensitivity to underlying" },
  gamma: { label: "Gamma", symbol: "Γ", description: "Rate of change of delta" },
  theta: { label: "Theta", symbol: "Θ", description: "Time decay per day" },
  vega: { label: "Vega", symbol: "ν", description: "Sensitivity to 1% vol change" },
  rho: { label: "Rho", symbol: "ρ", description: "Sensitivity to 1% rate change" },
};

function fmt(n: number): string {
  if (Math.abs(n) < 0.00005) return "0.0000";
  return n.toFixed(4);
}

function barWidth(value: number, max: number): number {
  return Math.min(Math.abs(value) / max * 100, 100);
}

export function GreeksDisplay({ greeks }: GreeksDisplayProps) {
  const maxAbs = Math.max(
    Math.abs(greeks.delta),
    Math.abs(greeks.gamma) * 100,
    Math.abs(greeks.theta) * 100,
    Math.abs(greeks.vega) * 10,
    Math.abs(greeks.rho) * 10,
    0.001
  );

  const entries: { key: keyof Greeks; value: number; normalizedMax: number }[] = [
    { key: "delta", value: greeks.delta, normalizedMax: 1 },
    { key: "gamma", value: greeks.gamma, normalizedMax: maxAbs / 100 },
    { key: "theta", value: greeks.theta, normalizedMax: maxAbs / 100 },
    { key: "vega", value: greeks.vega, normalizedMax: maxAbs / 10 },
    { key: "rho", value: greeks.rho, normalizedMax: maxAbs / 10 },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Greeks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map(({ key, value, normalizedMax }) => {
          const info = GREEK_INFO[key];
          const isPositive = value >= 0;
          const color = isPositive ? "bg-emerald-500" : "bg-red-500";

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-serif font-bold text-muted-foreground w-5 text-center">
                    {info.symbol}
                  </span>
                  <div>
                    <span className="text-sm font-medium">{info.label}</span>
                    <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                      {info.description}
                    </span>
                  </div>
                </div>
                <span className={`font-mono text-sm font-semibold ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
                  {isPositive ? "+" : ""}{fmt(value)}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${barWidth(value, normalizedMax)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
