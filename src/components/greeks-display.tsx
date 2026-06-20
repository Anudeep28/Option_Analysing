"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Greeks } from "@/lib/types";

interface GreeksDisplayProps {
  greeks: Greeks;
}


const HIGHER_ORDER_INFO: { key: keyof Greeks; label: string; symbol: string; description: string }[] = [
  { key: "vanna", label: "Vanna", symbol: "∂²Δ/∂σ", description: "Delta change per 1% vol move — hedge drift" },
  { key: "volga", label: "Volga", symbol: "∂²ν/∂σ", description: "Vega convexity — vol-of-vol exposure" },
  { key: "charm", label: "Charm", symbol: "∂Δ/∂t", description: "Delta decay per day — rebalancing need" },
  { key: "speed", label: "Speed", symbol: "∂Γ/∂S", description: "Gamma sensitivity to spot — 3rd order" },
];

function fmt(n: number): string {
  if (Math.abs(n) < 0.000005) return "0.0000";
  if (Math.abs(n) >= 1000) return n.toFixed(1);
  if (Math.abs(n) >= 0.01) return n.toFixed(4);
  return n.toExponential(3);
}

function barWidth(value: number, max: number): number {
  return Math.min(Math.abs(value) / Math.max(max, 1e-10) * 100, 100);
}

function GreekRow({ symbol, label, description, value, normalizedMax }: {
  symbol: string; label: string; description: string; value: number; normalizedMax: number;
}) {
  const isPositive = value >= 0;
  const color = isPositive ? "bg-emerald-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-muted-foreground w-16 text-center shrink-0">
            {symbol}
          </span>
          <div>
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{description}</span>
          </div>
        </div>
        <span className={`font-mono text-sm font-semibold shrink-0 ml-2 ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
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
}

export function GreeksDisplay({ greeks }: GreeksDisplayProps) {
  const maxFirstOrder = Math.max(
    Math.abs(greeks.delta),
    Math.abs(greeks.gamma) * 100,
    Math.abs(greeks.theta) * 100,
    Math.abs(greeks.vega) * 10,
    Math.abs(greeks.rho) * 10,
    0.001
  );

  const hasHigherOrder = greeks.vanna !== undefined || greeks.volga !== undefined ||
    greeks.charm !== undefined || greeks.speed !== undefined;

  const maxHigherOrder = hasHigherOrder ? Math.max(
    Math.abs(greeks.vanna ?? 0) * 100,
    Math.abs(greeks.volga ?? 0) * 100,
    Math.abs(greeks.charm ?? 0) * 1000,
    Math.abs(greeks.speed ?? 0) * 10000,
    0.001
  ) : 0.001;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Greeks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* First-order Greeks */}
        <GreekRow label="Delta" symbol="Δ" description="Price sensitivity to underlying" value={greeks.delta} normalizedMax={1} />
        <GreekRow label="Gamma" symbol="Γ" description="Rate of change of delta" value={greeks.gamma} normalizedMax={maxFirstOrder / 100} />
        <GreekRow label="Theta" symbol="Θ" description="Time decay per day" value={greeks.theta} normalizedMax={maxFirstOrder / 100} />
        <GreekRow label="Vega" symbol="ν" description="Sensitivity to 1% vol change" value={greeks.vega} normalizedMax={maxFirstOrder / 10} />
        <GreekRow label="Rho" symbol="ρ" description="Sensitivity to 1% rate change" value={greeks.rho} normalizedMax={maxFirstOrder / 10} />

        {/* Higher-order Greeks (only shown when available) */}
        {hasHigherOrder && (
          <>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Higher-Order Greeks (Investment Bank Standard)
            </p>
            {HIGHER_ORDER_INFO.map(({ key, label, symbol, description }) => {
              const value = greeks[key];
              if (value === undefined) return null;
              return (
                <GreekRow
                  key={key}
                  label={label}
                  symbol={symbol}
                  description={description}
                  value={value}
                  normalizedMax={maxHigherOrder / 100}
                />
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
