"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, Timer, TrendingUp, TrendingDown, BarChart3, Zap,
} from "lucide-react";
import type { PricingResult, OptionType, OptionStyle } from "@/lib/types";
import { SimulationChart } from "./simulation-chart";
import { PayoffChart } from "./payoff-chart";
import { GreeksDisplay } from "./greeks-display";
import { TradeAnalysis } from "./trade-analysis";

interface ResultsPanelProps {
  result: PricingResult | null;
  optionType: OptionType;
  optionStyle: OptionStyle;
  spotPrice: number;
  strikePrice: number;
  volatility: number;
  timeToExpiry: number;
  riskFreeRate: number;
  sentimentScore?: number;
}

function fmt(n: number, decimals = 4): string {
  if (Math.abs(n) < 0.00005 && decimals <= 4) return "0.0000";
  return n.toFixed(decimals);
}

export function ResultsPanel({ result, optionType, optionStyle, spotPrice, strikePrice, volatility, timeToExpiry, riskFreeRate, sentimentScore }: ResultsPanelProps) {
  if (!result) {
    return (
      <Card className="h-full min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-3 p-8">
          <BarChart3 className="size-12 mx-auto text-muted-foreground/40" />
          <div>
            <p className="font-medium text-muted-foreground">No Results Yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Configure your option parameters and click &quot;Price Option&quot; to see results.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const isCall = optionType === "call";
  const moneyness = isCall ? spotPrice - strikePrice : strikePrice - spotPrice;
  const moneynessLabel = moneyness > 0 ? "ITM" : moneyness < 0 ? "OTM" : "ATM";
  const moneynessColor = moneyness > 0 ? "text-emerald-600" : moneyness < 0 ? "text-red-500" : "text-amber-500";

  return (
    <div className="space-y-6">
      {/* Price Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="size-5" />
              Option Price
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={moneynessColor}>
                {moneynessLabel}
              </Badge>
              <Badge variant="outline">
                {isCall ? <TrendingUp className="size-3 mr-1" /> : <TrendingDown className="size-3 mr-1" />}
                {optionType.toUpperCase()}
              </Badge>
              <Badge variant="secondary">{optionStyle}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold font-mono tracking-tight">
                {fmt(result.price, 4)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Option Premium</p>
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold font-mono">
                {fmt(result.intrinsicValue, 4)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Intrinsic Value</p>
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold font-mono">
                {fmt(result.timeValue, 4)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Time Value</p>
            </div>
          </div>

          {result.confidenceInterval && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">95% Confidence Interval</span>
                <span className="font-mono">
                  [{fmt(result.confidenceInterval[0], 4)}, {fmt(result.confidenceInterval[1], 4)}]
                </span>
              </div>
            </>
          )}

          <Separator className="my-3" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Timer className="size-3" /> Execution Time
            </span>
            <span className="font-mono flex items-center gap-1">
              <Zap className="size-3 text-amber-500" />
              {result.executionTimeMs < 1 ? "<1" : result.executionTimeMs.toFixed(1)} ms
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-muted-foreground">Method</span>
            <span className="font-mono">{result.method}</span>
          </div>
        </CardContent>
      </Card>

      {/* Greeks */}
      <GreeksDisplay greeks={result.greeks} />

      {/* Trade Analysis & Greek Interpretation */}
      <TradeAnalysis
        result={result}
        optionType={optionType}
        optionStyle={optionStyle}
        spotPrice={spotPrice}
        strikePrice={strikePrice}
        volatility={volatility}
        timeToExpiry={timeToExpiry}
        riskFreeRate={riskFreeRate}
        sentimentScore={sentimentScore}
      />

      {/* Charts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Visualizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="payoff">
            <TabsList>
              <TabsTrigger value="payoff">Payoff Diagram</TabsTrigger>
              {result.samplePaths && result.samplePaths.length > 0 && (
                <TabsTrigger value="paths">Simulation Paths</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="payoff" className="mt-4">
              <PayoffChart
                optionType={optionType}
                strikePrice={strikePrice}
                premium={result.price}
                spotPrice={spotPrice}
              />
            </TabsContent>
            {result.samplePaths && result.samplePaths.length > 0 && (
              <TabsContent value="paths" className="mt-4">
                <SimulationChart paths={result.samplePaths} strikePrice={strikePrice} />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
