"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, Timer, TrendingUp, TrendingDown, BarChart3, Zap,
} from "lucide-react";
import type { PricingResult, OptionType, OptionStyle } from "@/lib/types";
import type { NewsSentimentResult } from "@/lib/market-data";
import { normalCDF } from "@/lib/math";
import { SimulationChart } from "./simulation-chart";
import { PayoffChart } from "./payoff-chart";
import { GreeksDisplay } from "./greeks-display";
import { TradeAnalysis } from "./trade-analysis";
import { ProfitProbability } from "./profit-probability";
import { AIReport } from "./ai-report";
import { IVAnalysisPanel } from "./iv-analysis";
import { OIAnalysisPanel } from "./oi-analysis";
import { TechnicalAnalysisPanel } from "./technical-analysis";
import { BehavioralSignalsPanel } from "./behavioral-signals";
import { StrategyBuilder } from "./strategy-builder";
import { PositionTracker } from "./position-tracker";
import { ScenarioLadder } from "./scenario-ladder";
import { GARCHVolForecast } from "./garch-vol-forecast";
import { StockOutlook } from "./stock-outlook";
import type { TechnicalIndicators } from "@/lib/technicals";

interface ResultsPanelProps {
  result: PricingResult | null;
  optionType: OptionType;
  optionStyle: OptionStyle;
  spotPrice: number;
  strikePrice: number;
  volatility: number;
  timeToExpiry: number;
  riskFreeRate: number;
  dividendYield: number;
  sentimentScore?: number;
  marketLTP?: number;
  onMarketLTPChange?: (v: number | undefined) => void;
  symbol?: string;
  sentimentData?: NewsSentimentResult | null;
  // New analytics props
  historicalVol?: number;
  historicalCloses?: number[];
  optionChainData?: { strikePrice: number; callOI: number; putOI: number; callLTP: number; putLTP: number; callIV: number; putIV: number }[];
  liveQuote?: { volume: number; fiftyTwoWeekHigh: number; fiftyTwoWeekLow: number } | null;
  vixLevel?: number;
  currency?: string;
  lotSize?: number;
  garchVol?: number;
  technicals?: TechnicalIndicators | null;
}

function fmt(n: number, decimals = 4): string {
  if (Math.abs(n) < 0.00005 && decimals <= 4) return "0.0000";
  return n.toFixed(decimals);
}

function computeBreakEvenPoP(
  optionType: OptionType,
  spot: number, strike: number, vol: number, t: number, r: number, q: number,
  premium: number,
): number {
  if (vol <= 0 || t <= 0 || spot <= 0 || strike <= 0) return 0;
  const breakEven = optionType === "call" ? strike + premium : strike - premium;
  if (breakEven <= 0) return 0;
  const sqrtT = Math.sqrt(t);
  const d2Be = (Math.log(spot / breakEven) + (r - q - 0.5 * vol * vol) * t) / (vol * sqrtT);
  return optionType === "call" ? normalCDF(d2Be) * 100 : normalCDF(-d2Be) * 100;
}

export function ResultsPanel({
  result, optionType, optionStyle, spotPrice, strikePrice, volatility, timeToExpiry,
  riskFreeRate, dividendYield, sentimentScore, marketLTP, onMarketLTPChange, symbol, sentimentData,
  historicalVol, historicalCloses, optionChainData, liveQuote, vixLevel,
  currency = "₹", lotSize = 1, garchVol, technicals,
}: ResultsPanelProps) {
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
                {currency}{fmt(result.price, 4)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Option Premium</p>
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold font-mono">
                {currency}{fmt(result.intrinsicValue, 4)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Intrinsic Value</p>
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold font-mono">
                {currency}{fmt(result.timeValue, 4)}
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

      {/* Stock Outlook — directional signal, price cone, target probability */}
      {spotPrice > 0 && (historicalVol ?? 0) > 0 && (
        <StockOutlook
          spotPrice={spotPrice}
          garchVol={garchVol ?? null}
          historicalVol={historicalVol ?? volatility}
          riskFreeRate={riskFreeRate}
          dividendYield={dividendYield}
          technicals={technicals ?? null}
          sentimentScore={sentimentScore}
          vixLevel={vixLevel}
          currency={currency}
          symbol={symbol}
        />
      )}

      {/* Demat Position Tracker */}
      <PositionTracker
        theoreticalPrice={result.price}
        optionType={optionType}
        spotPrice={spotPrice}
        strikePrice={strikePrice}
        currency={currency}
        lotSize={lotSize}
        marketLTP={marketLTP}
        symbol={symbol}
      />

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

      {/* Probability of Profit */}
      <ProfitProbability
        optionType={optionType}
        spotPrice={spotPrice}
        strikePrice={strikePrice}
        volatility={volatility}
        timeToExpiry={timeToExpiry}
        riskFreeRate={riskFreeRate}
        dividendYield={dividendYield}
        theoreticalPrice={result.price}
        marketLTP={marketLTP}
        onMarketLTPChange={onMarketLTPChange}
      />

      {/* AI Investment Report */}
      <AIReport
        reportInput={{
          symbol,
          optionType,
          optionStyle,
          spotPrice,
          strikePrice,
          volatilityPct: volatility * 100,
          timeToExpiryDays: Math.round(timeToExpiry * 365),
          riskFreeRatePct: riskFreeRate * 100,
          theoreticalPrice: result.price,
          marketLTP,
          greeks: result.greeks,
          probabilityOfProfitPct: computeBreakEvenPoP(
            optionType, spotPrice, strikePrice, volatility, timeToExpiry,
            riskFreeRate, dividendYield, marketLTP ?? result.price,
          ),
          breakEven: optionType === "call"
            ? strikePrice + (marketLTP ?? result.price)
            : strikePrice - (marketLTP ?? result.price),
          moveNeededPct: ((optionType === "call"
            ? strikePrice + (marketLTP ?? result.price)
            : strikePrice - (marketLTP ?? result.price)) - spotPrice) / spotPrice * 100,
          sentimentScore: sentimentData?.overallSentiment,
          sentimentLabel: sentimentData?.sentimentLabel,
          newsHeadlines: sentimentData?.articles.slice(0, 8).map((a) => a.title),
        }}
      />

      {/* IV Analysis */}
      {volatility > 0 && historicalVol !== undefined && historicalVol > 0 && (
        <IVAnalysisPanel
          currentIV={volatility}
          historicalVol={historicalVol}
        />
      )}

      {/* Option Chain Intelligence */}
      {optionChainData && optionChainData.length > 0 && (
        <OIAnalysisPanel
          optionChainData={optionChainData}
          spotPrice={spotPrice}
        />
      )}

      {/* Technical Analysis */}
      {historicalCloses && historicalCloses.length >= 50 && (
        <TechnicalAnalysisPanel
          closes={historicalCloses}
          symbol={symbol}
        />
      )}

      {/* Behavioral Signals */}
      {liveQuote && historicalCloses && historicalCloses.length > 0 && (
        <BehavioralSignalsPanel
          currentPrice={spotPrice}
          high52w={liveQuote.fiftyTwoWeekHigh}
          low52w={liveQuote.fiftyTwoWeekLow}
          currentVolume={liveQuote.volume}
          avgVolume={liveQuote.volume * 0.8}
          rsi={50}
          ivRank={volatility > 0 && historicalVol ? Math.min(100, Math.max(0, ((volatility - historicalVol * 0.7) / (historicalVol * 0.6)) * 100)) : 50}
          pcr={1}
          vixLevel={vixLevel}
        />
      )}

      {/* Strategy Builder */}
      <StrategyBuilder
        spotPrice={spotPrice}
        optionChainData={optionChainData}
      />

      {/* Scenario P&L Ladder */}
      <ScenarioLadder
        market={{
          spotPrice,
          strikePrice,
          riskFreeRate,
          volatility,
          timeToExpiry,
          dividendYield,
        }}
        optionType={optionType}
        entryPrice={marketLTP ?? result.price}
        currency={currency}
      />

      {/* GARCH Volatility Forecast */}
      {historicalCloses && historicalCloses.length >= 60 && (
        <GARCHVolForecast
          historicalCloses={historicalCloses}
          currentVol={volatility}
        />
      )}

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
