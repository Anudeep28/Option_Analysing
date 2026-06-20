"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fitGARCH } from "@/lib/vol-surface";

interface GARCHVolForecastProps {
  historicalCloses: number[];
  currentVol: number; // user-input vol (annualized decimal)
}

export function GARCHVolForecast({ historicalCloses, currentVol }: GARCHVolForecastProps) {
  const result = useMemo(() => fitGARCH(historicalCloses, 30), [historicalCloses]);

  const volDiff = result.currentVol - currentVol;
  const volDiffPct = currentVol > 0 ? (volDiff / currentVol) * 100 : 0;

  const forecastMax = Math.max(...result.forecastVol, result.currentVol, result.longRunVol);
  const forecastMin = Math.min(...result.forecastVol, result.currentVol, result.longRunVol);
  const range = Math.max(forecastMax - forecastMin, 0.01);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          GARCH(1,1) Volatility Forecast
          <Badge variant="secondary" className="text-[10px]">Quant</Badge>
        </CardTitle>
        <CardDescription>
          Maximum-likelihood fitted volatility model — used by investment banks for vol forecasting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current GARCH Vol</p>
            <p className="text-lg font-mono font-bold text-foreground mt-0.5">
              {(result.currentVol * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Long-Run Vol</p>
            <p className="text-lg font-mono font-bold text-foreground mt-0.5">
              {(result.longRunVol * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Persistence α+β</p>
            <p className={`text-lg font-mono font-bold mt-0.5 ${result.persistence > 0.95 ? "text-amber-500" : "text-foreground"}`}>
              {result.persistence.toFixed(3)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Shock Half-Life</p>
            <p className="text-lg font-mono font-bold text-foreground mt-0.5">
              {isFinite(result.halfLife) ? `${result.halfLife.toFixed(0)}d` : "∞"}
            </p>
          </div>
        </div>

        {/* Vol comparison vs user input */}
        <div className={`rounded-lg border p-3 text-sm ${Math.abs(volDiffPct) > 10 ? "border-amber-300 bg-amber-50 dark:bg-amber-950/40" : "border-border bg-muted/20"}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-medium">vs Your Input Vol ({(currentVol * 100).toFixed(1)}%)</span>
            <Badge variant={Math.abs(volDiffPct) > 10 ? "destructive" : "secondary"}>
              {volDiff >= 0 ? "+" : ""}{(volDiff * 100).toFixed(1)}pp ({volDiffPct >= 0 ? "+" : ""}{volDiffPct.toFixed(0)}%)
            </Badge>
          </div>
          {Math.abs(volDiffPct) > 10 && (
            <p className="text-xs text-muted-foreground mt-1">
              {result.currentVol > currentVol
                ? "GARCH estimates higher vol than your input — consider raising vol for more conservative pricing."
                : "GARCH estimates lower vol than your input — your pricing may be conservative (good for option sellers)."}
            </p>
          )}
        </div>

        {/* 30-day forecast chart (sparkline) */}
        <div>
          <p className="text-xs font-medium mb-2">30-Day Vol Forecast</p>
          <div className="relative h-20 bg-muted/20 rounded border border-border/50 overflow-hidden">
            <svg viewBox={`0 0 ${result.forecastVol.length} 100`} className="w-full h-full" preserveAspectRatio="none">
              {/* Long-run vol reference line */}
              <line
                x1="0" y1={100 - ((result.longRunVol - forecastMin) / range) * 100}
                x2={result.forecastVol.length} y2={100 - ((result.longRunVol - forecastMin) / range) * 100}
                stroke="currentColor" strokeDasharray="2 2" className="text-blue-400" strokeWidth="0.5"
              />
              {/* Forecast line */}
              <polyline
                points={result.forecastVol.map((v, i) =>
                  `${i + 0.5},${100 - ((v - forecastMin) / range) * 100}`
                ).join(" ")}
                fill="none"
                stroke="currentColor"
                className="text-emerald-500"
                strokeWidth="1.5"
              />
            </svg>
            <div className="absolute top-1 right-2 text-[9px] text-muted-foreground">
              {(forecastMax * 100).toFixed(1)}%
            </div>
            <div className="absolute bottom-1 right-2 text-[9px] text-muted-foreground">
              {(forecastMin * 100).toFixed(1)}%
            </div>
            <div className="absolute top-1 left-2 text-[9px] text-blue-400">
              — Long-run: {(result.longRunVol * 100).toFixed(1)}%
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>Today</span>
            <span>15 days</span>
            <span>30 days</span>
          </div>
        </div>

        {/* GARCH params */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <p className="text-muted-foreground">ω (omega)</p>
            <p className="font-mono font-semibold">{result.params.omega.toExponential(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">α (ARCH)</p>
            <p className="font-mono font-semibold">{result.params.alpha.toFixed(3)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">β (GARCH)</p>
            <p className="font-mono font-semibold">{result.params.beta.toFixed(3)}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{result.interpretation}</p>
      </CardContent>
    </Card>
  );
}
