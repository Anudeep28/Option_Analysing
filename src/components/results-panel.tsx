"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, Timer, TrendingUp, TrendingDown, BarChart3, Zap,
  Gauge, Activity, Globe, LineChart,
} from "lucide-react";
import type { PricingResult, OptionType, OptionStyle } from "@/lib/types";
import type { NewsSentimentResult } from "@/lib/market-data";
import { normalCDF } from "@/lib/math";
import { TradeAnalysis } from "./trade-analysis";
import { ProfitProbability } from "./profit-probability";
import { AIReport } from "./ai-report";
import { IVAnalysisPanel } from "./iv-analysis";
import { OIAnalysisPanel } from "./oi-analysis";
import { TechnicalAnalysisPanel } from "./technical-analysis";
import { StrategyBuilder } from "./strategy-builder";
import { PositionTracker } from "./position-tracker";
import { ScenarioLadder } from "./scenario-ladder";
import { GARCHVolForecast } from "./garch-vol-forecast";
import { StockOutlook } from "./stock-outlook";
import type { TechnicalIndicators } from "@/lib/technicals";
import type { MacroImpactResult } from "@/lib/macro-impact";

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
  macroScore?: number;
  macroData?: MacroImpactResult;
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
  historicalVol, historicalCloses, optionChainData, vixLevel,
  currency = "₹", lotSize = 1, garchVol, technicals, macroScore, macroData,
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

  const reportInput = {
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
    macroContext: macroData?.latticework ? {
      macroSignal: macroData.macroSignal,
      macroScore: macroData.macroScore,
      primaryEvent: macroData.primaryEvent?.type,
      narrativeSummary: macroData.latticework.narrativeSummary,
      layers: macroData.latticework.layers,
      inversionSignal: macroData.latticework.inversionSignal,
      optionsImplication: macroData.latticework.optionsImplication,
    } : undefined,
  };

  return (
    <div className="space-y-4">
      {/* ── Option Price Summary (always visible above tabs) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="size-5" />
              Option Price
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={moneynessColor}>{moneynessLabel}</Badge>
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

      {/* ── Main tabbed area ── */}
      <Tabs defaultValue="decision" className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-auto">
          <TabsTrigger value="decision" className="flex flex-col gap-0.5 py-2 text-[11px]">
            <Gauge className="size-3.5" /> Decision
          </TabsTrigger>
          <TabsTrigger value="greeks" className="flex flex-col gap-0.5 py-2 text-[11px]">
            <BarChart3 className="size-3.5" /> Greeks
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex flex-col gap-0.5 py-2 text-[11px]">
            <Activity className="size-3.5" /> Stock View
          </TabsTrigger>
          <TabsTrigger value="market" className="flex flex-col gap-0.5 py-2 text-[11px]">
            <Globe className="size-3.5" /> Market
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex flex-col gap-0.5 py-2 text-[11px]">
            <LineChart className="size-3.5" /> Advanced
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Decision ── */}
        <TabsContent value="decision" className="mt-4 space-y-4">
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
          <AIReport reportInput={reportInput} />
        </TabsContent>

        {/* ── Tab 2: Greeks & Pricing ── */}
        <TabsContent value="greeks" className="mt-4 space-y-4">
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
            samplePaths={result.samplePaths}
          />
          {volatility > 0 && historicalVol !== undefined && historicalVol > 0 && (
            <IVAnalysisPanel currentIV={volatility} historicalVol={historicalVol} />
          )}
          {historicalCloses && historicalCloses.length >= 60 && (
            <GARCHVolForecast historicalCloses={historicalCloses} currentVol={volatility} />
          )}
        </TabsContent>

        {/* ── Tab 3: Stock View ── */}
        <TabsContent value="stock" className="mt-4 space-y-4">
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
              macroScore={macroScore}
            />
          )}
          {historicalCloses && historicalCloses.length >= 50 && (
            <TechnicalAnalysisPanel closes={historicalCloses} symbol={symbol} />
          )}
        </TabsContent>

        {/* ── Tab 4: Market Context ── */}
        <TabsContent value="market" className="mt-4 space-y-4">
          {optionChainData && optionChainData.length > 0 && (
            <OIAnalysisPanel optionChainData={optionChainData} spotPrice={spotPrice} />
          )}
          {(!optionChainData || optionChainData.length === 0) && (
            <Card>
              <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                Fetch a live Indian symbol (e.g. NIFTY, RELIANCE) to see option chain OI data.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 5: Advanced ── */}
        <TabsContent value="advanced" className="mt-4 space-y-4">
          <StrategyBuilder spotPrice={spotPrice} optionChainData={optionChainData} />
          <ScenarioLadder
            market={{ spotPrice, strikePrice, riskFreeRate, volatility, timeToExpiry, dividendYield }}
            optionType={optionType}
            entryPrice={marketLTP ?? result.price}
            currency={currency}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
