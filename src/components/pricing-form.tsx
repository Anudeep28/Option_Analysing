"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, Activity, BarChart3, Settings2,
  Play, Loader2, Info, Globe, IndianRupee, Wifi,
} from "lucide-react";
import type {
  OptionStyle, OptionType, PricingMethod, PricingInput,
  PricingResult, BarrierType, AsianAverageType,
} from "@/lib/types";

function sliderVal(v: number | readonly number[]): number {
  return Array.isArray(v) ? v[0] : (v as number);
}
import { getAvailableMethods, priceOption } from "@/lib/pricing";
import {
  ALL_PRESETS, INDIAN_MARKET_PRESETS, GLOBAL_PRESETS,
  fetchLiveData, fetchNSEOptionChain,
  type YahooQuote, type YahooHistorical, type NSEOptionChainResponse,
} from "@/lib/market-data";
import { ResultsPanel } from "./results-panel";

const OPTION_STYLES: { value: OptionStyle; label: string; description: string }[] = [
  { value: "european", label: "European", description: "Exercise at expiry only" },
  { value: "american", label: "American", description: "Exercise anytime before expiry" },
  { value: "asian", label: "Asian", description: "Payoff based on average price" },
  { value: "barrier", label: "Barrier", description: "Activated/deactivated at barrier level" },
  { value: "lookback", label: "Lookback", description: "Payoff based on extreme price" },
];

const METHOD_LABELS: Record<PricingMethod, string> = {
  "black-scholes": "Black-Scholes (Analytical)",
  "binomial-tree": "Binomial Tree",
  "monte-carlo": "Monte Carlo Simulation",
};

export function PricingForm() {
  // Option configuration
  const [optionStyle, setOptionStyle] = useState<OptionStyle>("european");
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>("black-scholes");

  // Market data
  const [spotPrice, setSpotPrice] = useState(100);
  const [strikePrice, setStrikePrice] = useState(100);
  const [riskFreeRate, setRiskFreeRate] = useState(6.5); // India ~6.5%
  const [volatility, setVolatility] = useState(25);
  const [timeToExpiry, setTimeToExpiry] = useState(90); // days
  const [dividendYield, setDividendYield] = useState(1.0);

  // Simulation params
  const [numSimulations, setNumSimulations] = useState(10000);
  const [timeSteps, setTimeSteps] = useState(252);
  const [binomialSteps, setBinomialSteps] = useState(200);

  // Barrier params
  const [barrierType, setBarrierType] = useState<BarrierType>("up-and-out");
  const [barrierLevel, setBarrierLevel] = useState(120);

  // Asian params
  const [asianAvgType, setAsianAvgType] = useState<AsianAverageType>("arithmetic");
  const [observationFreq, setObservationFreq] = useState(12);

  // Selected symbol for live data
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Live data state
  const [liveQuote, setLiveQuote] = useState<YahooQuote | null>(null);
  const [liveHistorical, setLiveHistorical] = useState<YahooHistorical | null>(null);
  const [optionChain, setOptionChain] = useState<NSEOptionChainResponse | null>(null);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Results
  const [result, setResult] = useState<PricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const availableMethods = getAvailableMethods(optionStyle);

  const handleStyleChange = useCallback((style: OptionStyle) => {
    setOptionStyle(style);
    const methods = getAvailableMethods(style);
    if (!methods.includes(pricingMethod)) {
      setPricingMethod(methods[0] as PricingMethod);
    }
    setResult(null);
    setError(null);
  }, [pricingMethod]);

  const handlePresetSelect = useCallback((symbol: string) => {
    const preset = ALL_PRESETS.find((p) => p.symbol === symbol);
    if (!preset) return;
    setSelectedSymbol(symbol);
    setSpotPrice(preset.spotPrice);
    setStrikePrice(Math.round(preset.spotPrice));
    setVolatility(preset.volatility * 100);
    setDividendYield(preset.dividendYield * 100);
    if (optionStyle === "barrier") {
      setBarrierLevel(Math.round(preset.spotPrice * 1.2));
    }
  }, [optionStyle]);

  const handleFetchLive = useCallback(async () => {
    if (!selectedSymbol) return;
    setIsFetchingLive(true);
    setLiveError(null);
    setOptionChain(null);

    try {
      const { quote, historical } = await fetchLiveData(selectedSymbol);
      setLiveQuote(quote);
      setLiveHistorical(historical);

      // Auto-fill form with live data
      setSpotPrice(parseFloat(quote.lastPrice.toFixed(2)));
      setStrikePrice(Math.round(quote.lastPrice));
      if (historical.annualizedVolatility > 0) {
        setVolatility(parseFloat((historical.annualizedVolatility * 100).toFixed(1)));
      }
      if (historical.dividendYield > 0) {
        setDividendYield(parseFloat((historical.dividendYield * 100).toFixed(2)));
      }
      if (optionStyle === "barrier") {
        setBarrierLevel(Math.round(quote.lastPrice * 1.2));
      }

      // Try fetching NSE option chain (may fail for non-Indian/non-optionable symbols)
      try {
        const chain = await fetchNSEOptionChain(selectedSymbol);
        setOptionChain(chain);
      } catch {
        // NSE option chain is optional — don't treat as error
      }
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : "Failed to fetch live data");
    } finally {
      setIsFetchingLive(false);
    }
  }, [selectedSymbol, optionStyle]);

  const runPricing = useCallback(() => {
    setIsRunning(true);
    setError(null);

    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      try {
        const input: PricingInput = {
          optionStyle,
          optionType,
          pricingMethod,
          market: {
            spotPrice,
            strikePrice,
            riskFreeRate: riskFreeRate / 100,
            volatility: volatility / 100,
            timeToExpiry: timeToExpiry / 365,
            dividendYield: dividendYield / 100,
          },
          simulation: {
            numSimulations,
            timeSteps,
            binomialSteps,
          },
          barrier: optionStyle === "barrier" ? { barrierType, barrierLevel } : undefined,
          asian: optionStyle === "asian" ? { averageType: asianAvgType, observationFrequency: observationFreq } : undefined,
        };

        const res = priceOption(input);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Pricing failed");
        setResult(null);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  }, [
    optionStyle, optionType, pricingMethod, spotPrice, strikePrice,
    riskFreeRate, volatility, timeToExpiry, dividendYield,
    numSimulations, timeSteps, binomialSteps,
    barrierType, barrierLevel, asianAvgType, observationFreq,
  ]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
      {/* Left: Configuration Panel */}
      <div className="space-y-6">
        {/* Option Style Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="size-5" />
              Option Configuration
            </CardTitle>
            <CardDescription>Select option style, type, and pricing method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Style */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Option Style</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {OPTION_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => handleStyleChange(style.value)}
                    className={`relative rounded-lg border p-3 text-left transition-all hover:border-foreground/30 ${
                      optionStyle === style.value
                        ? "border-foreground bg-foreground/5 shadow-sm"
                        : "border-border"
                    }`}
                  >
                    <div className="font-medium text-sm">{style.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{style.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Option Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setOptionType("call"); setResult(null); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 transition-all hover:border-foreground/30 ${
                    optionType === "call"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border"
                  }`}
                >
                  <TrendingUp className="size-4" />
                  <span className="font-medium text-sm">Call</span>
                </button>
                <button
                  onClick={() => { setOptionType("put"); setResult(null); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 transition-all hover:border-foreground/30 ${
                    optionType === "put"
                      ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400"
                      : "border-border"
                  }`}
                >
                  <TrendingDown className="size-4" />
                  <span className="font-medium text-sm">Put</span>
                </button>
              </div>
            </div>

            {/* Pricing Method */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pricing Method</Label>
              <Select value={pricingMethod} onValueChange={(v) => { setPricingMethod(v as PricingMethod); setResult(null); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMethods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {METHOD_LABELS[m as PricingMethod]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableMethods.length < 3 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="size-3" />
                  Some methods unavailable for {optionStyle} options
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Market Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="size-5" />
              Market Data & Risk Factors
            </CardTitle>
            <CardDescription>Define the underlying asset and market parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Asset Presets */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quick Load Asset</Label>
              <Tabs defaultValue="india">
                <TabsList>
                  <TabsTrigger value="india">
                    <IndianRupee className="size-3 mr-1" /> India
                  </TabsTrigger>
                  <TabsTrigger value="global">
                    <Globe className="size-3 mr-1" /> Global
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="india" className="mt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {INDIAN_MARKET_PRESETS.map((p) => (
                      <Badge
                        key={p.symbol}
                        variant="outline"
                        className="cursor-pointer hover:bg-foreground/5 transition-colors"
                        onClick={() => handlePresetSelect(p.symbol)}
                      >
                        {p.symbol}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="global" className="mt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {GLOBAL_PRESETS.map((p) => (
                      <Badge
                        key={p.symbol}
                        variant="outline"
                        className="cursor-pointer hover:bg-foreground/5 transition-colors"
                        onClick={() => handlePresetSelect(p.symbol)}
                      >
                        {p.symbol}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Fetch Live Data Button */}
              {selectedSymbol && (
                <div className="mt-3 space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchLive}
                    disabled={isFetchingLive}
                    className="w-full"
                  >
                    {isFetchingLive ? (
                      <><Loader2 className="size-3 mr-2 animate-spin" /> Fetching live data for {selectedSymbol}...</>
                    ) : (
                      <><Wifi className="size-3 mr-2" /> Fetch Live Data for {selectedSymbol}</>
                    )}
                  </Button>

                  {liveError && (
                    <p className="text-xs text-red-500">{liveError}</p>
                  )}

                  {liveQuote && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{liveQuote.name}</span>
                        <Badge variant={liveQuote.change >= 0 ? "default" : "destructive"} className="text-xs">
                          {liveQuote.change >= 0 ? "+" : ""}{liveQuote.change.toFixed(2)} ({liveQuote.changePercent.toFixed(2)}%)
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">LTP</span>
                          <p className="font-mono font-semibold">{liveQuote.lastPrice.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Prev Close</span>
                          <p className="font-mono">{liveQuote.previousClose.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Volume</span>
                          <p className="font-mono">{liveQuote.volume.toLocaleString()}</p>
                        </div>
                      </div>
                      {liveHistorical && (
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
                          <div>
                            <span className="text-muted-foreground">1Y Historical Vol</span>
                            <p className="font-mono font-semibold">{(liveHistorical.annualizedVolatility * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Dividend Yield</span>
                            <p className="font-mono font-semibold">{(liveHistorical.dividendYield * 100).toFixed(2)}%</p>
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        Source: Yahoo Finance &bull; {new Date(liveQuote.timestamp).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {optionChain && optionChain.data.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">NSE Option Chain</span>
                        <span className="text-xs text-muted-foreground">
                          Underlying: {optionChain.underlyingValue.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Expiries: {optionChain.expiryDates.slice(0, 3).join(", ")}
                        {optionChain.expiryDates.length > 3 && ` +${optionChain.expiryDates.length - 3} more`}
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="text-left py-1">Call IV</th>
                              <th className="text-left py-1">Call LTP</th>
                              <th className="text-center py-1 font-bold">Strike</th>
                              <th className="text-right py-1">Put LTP</th>
                              <th className="text-right py-1">Put IV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {optionChain.data
                              .filter((d) => d.expiryDate === optionChain.expiryDates[0])
                              .filter((d) => Math.abs(d.strikePrice - optionChain.underlyingValue) < optionChain.underlyingValue * 0.1)
                              .slice(0, 15)
                              .map((d, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
                                  onClick={() => { setStrikePrice(d.strikePrice); if (d.callIV > 0) setVolatility(d.callIV); }}
                                >
                                  <td className="py-0.5 font-mono">{d.callIV > 0 ? d.callIV.toFixed(1) + "%" : "-"}</td>
                                  <td className="py-0.5 font-mono">{d.callLTP > 0 ? d.callLTP.toFixed(2) : "-"}</td>
                                  <td className="py-0.5 font-mono text-center font-bold">{d.strikePrice}</td>
                                  <td className="py-0.5 font-mono text-right">{d.putLTP > 0 ? d.putLTP.toFixed(2) : "-"}</td>
                                  <td className="py-0.5 font-mono text-right">{d.putIV > 0 ? d.putIV.toFixed(1) + "%" : "-"}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Click a row to use that strike &amp; IV &bull; Source: NSE India
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Core Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="spot" className="text-sm">Spot Price (S)</Label>
                <Input id="spot" type="number" min={0.01} step="any" value={spotPrice}
                  onChange={(e) => setSpotPrice(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="strike" className="text-sm">Strike Price (K)</Label>
                <Input id="strike" type="number" min={0.01} step="any" value={strikePrice}
                  onChange={(e) => setStrikePrice(parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            {/* Volatility Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Volatility (σ)</Label>
                <span className="text-sm font-mono text-muted-foreground">{volatility.toFixed(1)}%</span>
              </div>
              <Slider
                value={[volatility]}
                onValueChange={(v) => setVolatility(sliderVal(v))}
                min={1} max={150} step={0.5}
              />
            </div>

            {/* Risk-Free Rate Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Risk-Free Rate (r)</Label>
                <span className="text-sm font-mono text-muted-foreground">{riskFreeRate.toFixed(2)}%</span>
              </div>
              <Slider
                value={[riskFreeRate]}
                onValueChange={(v) => setRiskFreeRate(sliderVal(v))}
                min={0} max={20} step={0.1}
              />
            </div>

            {/* Dividend Yield Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Dividend Yield (q)</Label>
                <span className="text-sm font-mono text-muted-foreground">{dividendYield.toFixed(2)}%</span>
              </div>
              <Slider
                value={[dividendYield]}
                onValueChange={(v) => setDividendYield(sliderVal(v))}
                min={0} max={15} step={0.1}
              />
            </div>

            {/* Time to Expiry */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Time to Expiry</Label>
                <span className="text-sm font-mono text-muted-foreground">{timeToExpiry} days ({(timeToExpiry / 365).toFixed(3)} yrs)</span>
              </div>
              <Slider
                value={[timeToExpiry]}
                onValueChange={(v) => setTimeToExpiry(sliderVal(v))}
                min={1} max={1825} step={1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Exotic Parameters (conditional) */}
        {optionStyle === "barrier" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Barrier Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Barrier Type</Label>
                <Select value={barrierType} onValueChange={(v) => setBarrierType(v as BarrierType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up-and-in">Up-and-In</SelectItem>
                    <SelectItem value="up-and-out">Up-and-Out</SelectItem>
                    <SelectItem value="down-and-in">Down-and-In</SelectItem>
                    <SelectItem value="down-and-out">Down-and-Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Barrier Level</Label>
                <Input type="number" min={0.01} step="any" value={barrierLevel}
                  onChange={(e) => setBarrierLevel(parseFloat(e.target.value) || 0)} />
              </div>
            </CardContent>
          </Card>
        )}

        {optionStyle === "asian" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Asian Option Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Average Type</Label>
                <Select value={asianAvgType} onValueChange={(v) => setAsianAvgType(v as AsianAverageType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arithmetic">Arithmetic Average</SelectItem>
                    <SelectItem value="geometric">Geometric Average</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Observation Points</Label>
                  <span className="text-sm font-mono text-muted-foreground">{observationFreq}</span>
                </div>
                <Slider
                  value={[observationFreq]}
                  onValueChange={(v) => setObservationFreq(sliderVal(v))}
                  min={2} max={252} step={1}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Simulation Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="size-5" />
              Simulation Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(pricingMethod === "monte-carlo") && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Number of Simulations</Label>
                    <span className="text-sm font-mono text-muted-foreground">{numSimulations.toLocaleString()}</span>
                  </div>
                  <Slider
                    value={[numSimulations]}
                    onValueChange={(v) => setNumSimulations(sliderVal(v))}
                    min={1000} max={100000} step={1000}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Time Steps (discrete path)</Label>
                    <span className="text-sm font-mono text-muted-foreground">{timeSteps}</span>
                  </div>
                  <Slider
                    value={[timeSteps]}
                    onValueChange={(v) => setTimeSteps(sliderVal(v))}
                    min={10} max={1000} step={10}
                  />
                </div>
              </>
            )}
            {pricingMethod === "binomial-tree" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Binomial Tree Steps</Label>
                  <span className="text-sm font-mono text-muted-foreground">{binomialSteps}</span>
                </div>
                <Slider
                  value={[binomialSteps]}
                  onValueChange={(v) => setBinomialSteps(sliderVal(v))}
                  min={10} max={1000} step={10}
                />
              </div>
            )}
            {pricingMethod === "black-scholes" && (
              <p className="text-sm text-muted-foreground">
                Black-Scholes uses an analytical formula — no simulation parameters needed.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Run Button */}
        <Button
          onClick={runPricing}
          disabled={isRunning}
          size="lg"
          className="w-full h-12 text-base font-semibold"
        >
          {isRunning ? (
            <>
              <Loader2 className="size-5 mr-2 animate-spin" />
              Computing...
            </>
          ) : (
            <>
              <Play className="size-5 mr-2" />
              Price Option
            </>
          )}
        </Button>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Right: Results Panel */}
      <div>
        <ResultsPanel
          result={result}
          optionType={optionType}
          optionStyle={optionStyle}
          spotPrice={spotPrice}
          strikePrice={strikePrice}
        />
      </div>
    </div>
  );
}
