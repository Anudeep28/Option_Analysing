"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, CheckCircle2, XCircle, AlertTriangle, Target, Scale, Newspaper, Activity } from "lucide-react";
import type { OptionType } from "@/lib/types";
import { evaluateTrade, inferSide, type Verdict } from "@/lib/trade-decision";

interface TradeDecisionProps {
  spotPrice: number;
  volatility: number;        // decimal
  riskFreeRate: number;      // decimal
  dividendYield: number;     // decimal
  currency: string;
  defaultStrike: number;
  defaultLotSize: number;
  symbol?: string;           // underlying symbol (e.g. NIFTY)
  isLiveData?: boolean;      // true if spot/vol came from a live fetch
  sentimentScore?: number;   // -1..1
  technicalScore?: number;   // -100..100
  sentimentActive?: boolean; // true if news sentiment was fetched
  technicalsActive?: boolean;// true if historical data is loaded for technicals
  optionChainData?: { strikePrice: number; callLTP: number; putLTP: number; callIV: number; putIV: number }[];
}

const VERDICT_STYLES: Record<Verdict, { color: string; bg: string; icon: typeof CheckCircle2; label: string }> = {
  GO: { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800", icon: CheckCircle2, label: "GO FOR IT" },
  FAVORABLE: { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-900", icon: CheckCircle2, label: "FAVORABLE" },
  NEUTRAL: { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900", icon: AlertTriangle, label: "NEUTRAL / 50-50" },
  RISKY: { color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-900", icon: AlertTriangle, label: "RISKY" },
  AVOID: { color: "text-red-700 dark:text-red-400", bg: "bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-800", icon: XCircle, label: "AVOID" },
};

export function TradeDecision({
  spotPrice, volatility, riskFreeRate, dividendYield, currency,
  defaultStrike, defaultLotSize, symbol, isLiveData, sentimentScore, technicalScore,
  sentimentActive, technicalsActive, optionChainData,
}: TradeDecisionProps) {
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [strike, setStrike] = useState<number | "">(defaultStrike || "");
  const [marketIV, setMarketIV] = useState<number | undefined>(undefined);
  const [entry, setEntry] = useState<number | "">("");
  const [target, setTarget] = useState<number | "">("");
  const [stopLoss, setStopLoss] = useState<number | "">("");
  const [lotSize, setLotSize] = useState(defaultLotSize || 1);
  const [lots, setLots] = useState(1);
  const [holdingDays, setHoldingDays] = useState(1);
  const [daysToExpiry, setDaysToExpiry] = useState(7);

  const num = (v: number | "") => (typeof v === "number" ? v : 0);
  const ready = typeof strike === "number" && strike > 0
    && typeof entry === "number" && entry > 0
    && typeof target === "number" && target > 0;

  const side = ready ? inferSide(num(entry), num(target)) : "buy";

  const result = useMemo(() => {
    if (!ready) return null;
    return evaluateTrade({
      optionType,
      spotPrice,
      strikePrice: num(strike),
      entryPremium: num(entry),
      targetPremium: num(target),
      stopLossPremium: typeof stopLoss === "number" && stopLoss > 0 ? stopLoss : undefined,
      quantity: lotSize * lots,
      volatility,
      marketIV,
      daysToOptionExpiry: daysToExpiry,
      holdingDays,
      riskFreeRate,
      dividendYield,
      sentimentScore,
      technicalScore,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, optionType, spotPrice, strike, entry, target, stopLoss, lotSize, lots,
      volatility, marketIV, daysToExpiry, holdingDays, riskFreeRate, dividendYield, sentimentScore, technicalScore]);

  const vStyle = result ? VERDICT_STYLES[result.verdict] : null;
  const VIcon = vStyle?.icon ?? AlertTriangle;

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="size-5" />
          Should I Take This Trade?
          {symbol && (
            <Badge variant="secondary" className="ml-1">Underlying: {symbol}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Enter the option exactly as shown in your demat account. We&apos;ll tell you if it&apos;s worth it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Underlying status banner */}
        {!symbol ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-xs">
            <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              <strong>No underlying stock selected.</strong> This analysis is using a placeholder spot price of {currency}{spotPrice}.
              Go to <strong>Live Market Data</strong> below, pick your stock (e.g. NIFTY), and click <strong>Fetch Live Data</strong> so the verdict reflects the real underlying price &amp; volatility.
            </span>
          </div>
        ) : !isLiveData ? (
          <div className="flex items-start gap-2 rounded-lg border border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3 text-xs">
            <AlertTriangle className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              Using <strong>{symbol}</strong> with preset values (spot {currency}{spotPrice}). Click <strong>Fetch Live Data</strong> below for the real-time price &amp; volatility.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950 p-2.5 text-xs">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <span>
              Analyzing options on <strong>{symbol}</strong> at live spot <strong>{currency}{spotPrice.toLocaleString()}</strong> (volatility {(volatility * 100).toFixed(1)}%).
            </span>
          </div>
        )}

        {/* Signal sources powering the verdict */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-0.5">Verdict uses:</span>
          <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400">
            <Activity className="size-3" /> Volatility {(volatility * 100).toFixed(1)}%
          </Badge>
          {sentimentActive ? (
            <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400">
              <Newspaper className="size-3" /> News {sentimentScore !== undefined ? (sentimentScore > 0.1 ? "Bullish" : sentimentScore < -0.1 ? "Bearish" : "Neutral") : "On"}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground opacity-70">
              <Newspaper className="size-3" /> News: off
            </Badge>
          )}
          {technicalsActive ? (
            <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="size-3" /> Technicals {technicalScore !== undefined ? (technicalScore > 15 ? "Bullish" : technicalScore < -15 ? "Bearish" : "Neutral") : "On"}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground opacity-70">
              <TrendingUp className="size-3" /> Technicals: off
            </Badge>
          )}
        </div>
        {(!sentimentActive || !technicalsActive) && (
          <p className="text-[10px] text-muted-foreground -mt-2">
            {!sentimentActive && !technicalsActive
              ? "Only volatility is active. Fetch Live Data + News Sentiment below to factor in trend & news."
              : !sentimentActive
              ? "News sentiment is off — click Fetch News Sentiment below to include it."
              : "Technicals are off — click Fetch Live Data below to include trend signals."}
          </p>
        )}

        {/* Option type */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setOptionType("call"); setMarketIV(undefined); }}
            className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 transition-all ${
              optionType === "call"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <TrendingUp className="size-4" /> <span className="font-medium text-sm">Call (CE)</span>
          </button>
          <button
            onClick={() => { setOptionType("put"); setMarketIV(undefined); }}
            className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 transition-all ${
              optionType === "put"
                ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <TrendingDown className="size-4" /> <span className="font-medium text-sm">Put (PE)</span>
          </button>
        </div>

        {/* Live strike picker from option chain */}
        {optionChainData && optionChainData.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Activity className="size-3" /> Pick your strike from the live {symbol} option chain (most accurate)
            </Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={typeof strike === "number" ? strike : ""}
              onChange={(e) => {
                const sp = parseFloat(e.target.value);
                if (Number.isNaN(sp)) return;
                const row = optionChainData.find((r) => r.strikePrice === sp);
                if (!row) return;
                setStrike(sp);
                const iv = optionType === "call" ? row.callIV : row.putIV;
                setMarketIV(iv > 0 ? iv / 100 : undefined);
                const ltp = optionType === "call" ? row.callLTP : row.putLTP;
                if (ltp > 0 && entry === "") setEntry(ltp);
              }}
            >
              <option value="">— select strike —</option>
              {optionChainData.map((r) => {
                const ltp = optionType === "call" ? r.callLTP : r.putLTP;
                const iv = optionType === "call" ? r.callIV : r.putIV;
                return (
                  <option key={r.strikePrice} value={r.strikePrice}>
                    {r.strikePrice} {optionType === "call" ? "CE" : "PE"} — LTP {currency}{ltp.toFixed(1)}{iv > 0 ? ` · IV ${iv.toFixed(1)}%` : ""}
                  </option>
                );
              })}
            </select>
            <p className="text-[10px] text-muted-foreground">Selecting a strike pulls its live IV for accurate probabilities and suggests its premium.</p>
          </div>
        )}

        {/* Core inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Strike Price ({currency})</Label>
            <Input type="number" step="any" placeholder="e.g. 18100" value={strike}
              onChange={(e) => setStrike(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{symbol ?? "Underlying"} Spot ({currency})</Label>
            <Input type="number" value={spotPrice} disabled className="h-9 opacity-70" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entry Premium ({currency})</Label>
            <Input type="number" step="any" placeholder="e.g. 133" value={entry}
              onChange={(e) => setEntry(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Target Premium ({currency})</Label>
            <Input type="number" step="any" placeholder="e.g. 85" value={target}
              onChange={(e) => setTarget(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stop Loss ({currency}) <span className="text-muted-foreground">opt.</span></Label>
            <Input type="number" step="any" placeholder="optional" value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Lot Size × Lots</Label>
            <div className="flex gap-1">
              <Input type="number" value={lotSize} onChange={(e) => setLotSize(parseInt(e.target.value) || 1)} className="h-9" />
              <span className="self-center text-muted-foreground">×</span>
              <Input type="number" value={lots} onChange={(e) => setLots(parseInt(e.target.value) || 1)} className="h-9 w-16" />
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Holding Period (days)</Label>
            <Input type="number" min={1} value={holdingDays}
              onChange={(e) => setHoldingDays(parseInt(e.target.value) || 1)} className="h-9" />
            <p className="text-[10px] text-muted-foreground">Intraday = 1</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Days to Option Expiry</Label>
            <Input type="number" min={1} value={daysToExpiry}
              onChange={(e) => setDaysToExpiry(parseInt(e.target.value) || 1)} className="h-9" />
          </div>
        </div>

        {ready && result && vStyle && (
          <>
            {/* Inferred side */}
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className={side === "buy" ? "text-emerald-600" : "text-blue-600"}>
                {side === "buy" ? "BUYING (Long)" : "SELLING (Short)"} {optionType.toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {side === "buy"
                  ? "Profit if premium rises"
                  : "Profit if premium falls (you collect & buy back cheaper)"}
              </span>
            </div>

            {/* VERDICT */}
            <div className={`rounded-lg border-2 p-4 ${vStyle.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <VIcon className={`size-6 ${vStyle.color}`} />
                  <span className={`text-xl font-bold ${vStyle.color}`}>{vStyle.label}</span>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold font-mono ${vStyle.color}`}>{result.confidence.toFixed(0)}</div>
                  <div className="text-[10px] text-muted-foreground">confidence /100</div>
                </div>
              </div>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg border p-2">
                <div className="text-[10px] text-muted-foreground">If Target Hit</div>
                <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  +{currency}{result.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-muted-foreground">{currency}{result.profitPerUnit.toFixed(2)}/unit</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-[10px] text-muted-foreground">Max Loss</div>
                <div className="font-bold font-mono text-red-600 dark:text-red-400">
                  -{currency}{result.totalMaxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-muted-foreground">{currency}{result.maxLossPerUnit.toFixed(2)}/unit</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5"><Scale className="size-3" />Risk:Reward</div>
                <div className="font-bold font-mono">
                  {result.riskReward === Infinity ? "∞" : result.riskReward.toFixed(2)}:1
                </div>
                <div className="text-[10px] text-muted-foreground">reward per ₹ risk</div>
              </div>
            </div>

            {/* Probability + move */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Volatility used</span>
                <span className="font-mono">
                  {(result.impliedVolUsed * 100).toFixed(1)}%
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({result.volSource === "market" ? "live IV" : result.volSource === "implied" ? "implied from premium" : "historical"})
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Probability of hitting target</span>
                <span className={`font-mono font-bold ${result.probTarget >= 0.5 ? "text-emerald-600 dark:text-emerald-400" : result.probTarget >= 0.35 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                  {(result.probTarget * 100).toFixed(0)}%
                </span>
              </div>
              {result.requiredMovePct !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Underlying move needed</span>
                  <span className="font-mono">
                    {result.underlyingBiasNeeded === "up" ? "▲" : "▼"} {Math.abs(result.requiredMovePct).toFixed(2)}%
                    {result.requiredSpotForTarget && <span className="text-muted-foreground"> → {currency}{result.requiredSpotForTarget.toFixed(0)}</span>}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expected value (probability-weighted)</span>
                <span className={`font-mono font-bold ${result.expectedValue >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {result.expectedValue >= 0 ? "+" : ""}{currency}{result.expectedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              {stopLoss !== "" && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Probability of hitting stop-loss</span>
                  <span className="font-mono text-red-600 dark:text-red-400">{(result.probStopLoss * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>

            {/* Reasons / warnings */}
            {(result.reasons.length > 0 || result.warnings.length > 0) && (
              <div className="space-y-2">
                {result.reasons.length > 0 && (
                  <div className="space-y-1">
                    {result.reasons.map((r, i) => (
                      <div key={`r${i}`} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.warnings.length > 0 && (
                  <div className="space-y-1">
                    {result.warnings.map((w, i) => (
                      <div key={`w${i}`} className="flex items-start gap-2 text-xs">
                        <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Separator />
            <p className="text-[10px] text-muted-foreground italic">
              Estimates use Black-Scholes pricing, your inputs, and current volatility/sentiment.
              Not financial advice — markets can move unexpectedly. Always use a stop-loss.
            </p>
          </>
        )}

        {!ready && (
          <p className="text-xs text-muted-foreground italic">
            Fill in <strong>strike</strong>, <strong>entry premium</strong>, and <strong>target premium</strong> to get a verdict.
            Whether you&apos;re buying or selling is inferred automatically (target &gt; entry = buying; target &lt; entry = selling).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
