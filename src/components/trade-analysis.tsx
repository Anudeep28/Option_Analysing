"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle,
  ShieldAlert, Clock, Gauge, ArrowUpDown,
} from "lucide-react";
import type { Greeks, PricingResult, OptionType, OptionStyle } from "@/lib/types";

interface TradeAnalysisProps {
  result: PricingResult;
  optionType: OptionType;
  optionStyle: OptionStyle;
  spotPrice: number;
  strikePrice: number;
  volatility: number; // as decimal e.g. 0.25
  timeToExpiry: number; // in years
  riskFreeRate: number; // as decimal
  sentimentScore?: number; // -1 to 1
}

// --- Greek interpretation helpers ---

function deltaInterpretation(delta: number, optionType: OptionType): string {
  const absDelta = Math.abs(delta);
  const dir = optionType === "call" ? "up" : "down";
  if (absDelta > 0.8) return `Deep in-the-money. Behaves almost like the underlying stock. ~${(absDelta * 100).toFixed(0)}% chance of expiring ITM. High directional exposure — moves almost 1:1 with the stock going ${dir}.`;
  if (absDelta > 0.6) return `In-the-money. Good directional bet. ~${(absDelta * 100).toFixed(0)}% probability of expiring ITM. The option moves ~₹${absDelta.toFixed(2)} for every ₹1 move ${dir} in the stock.`;
  if (absDelta > 0.4) return `Near-the-money. Balanced risk/reward. ~${(absDelta * 100).toFixed(0)}% chance of expiring ITM. Moderate sensitivity to price movement.`;
  if (absDelta > 0.2) return `Out-of-the-money. Lower probability (~${(absDelta * 100).toFixed(0)}%) of expiring ITM. Cheaper premium but needs a significant move to be profitable.`;
  return `Deep out-of-the-money. Very low probability (~${(absDelta * 100).toFixed(0)}%) of expiring ITM. Speculative trade — most of these expire worthless.`;
}

function gammaInterpretation(gamma: number, spotPrice: number): string {
  const gammaPercent = gamma * spotPrice / 100;
  if (gamma > 0.05) return `Very high gamma. Delta changes rapidly — this option is highly sensitive to small price moves. Good for scalping but risk of large P&L swings. A 1% move in stock changes delta by ~${gammaPercent.toFixed(3)}.`;
  if (gamma > 0.02) return `Moderate gamma. Delta adjusts meaningfully with price movement. Good balance of sensitivity and stability. Position needs active monitoring.`;
  if (gamma > 0.005) return `Low gamma. Delta is relatively stable. The option's directional exposure won't change dramatically with small price moves. Easier to manage.`;
  return `Very low gamma. Delta is almost flat — the option's sensitivity to the underlying barely changes. Typical of deep ITM/OTM or long-dated options.`;
}

function thetaInterpretation(theta: number, price: number): string {
  const dailyDecay = Math.abs(theta);
  const percentDecay = price > 0 ? (dailyDecay / price) * 100 : 0;
  if (percentDecay > 2) return `Severe time decay! You're losing ~${percentDecay.toFixed(1)}% of the option's value per day (₹${dailyDecay.toFixed(2)}/day). Time is your biggest enemy. Avoid holding this as expiry approaches unless you have strong conviction.`;
  if (percentDecay > 0.5) return `Significant time decay at ₹${dailyDecay.toFixed(2)}/day (~${percentDecay.toFixed(1)}% of premium). The clock is ticking — you need the stock to move in your favor soon to overcome this erosion.`;
  if (percentDecay > 0.1) return `Moderate time decay at ₹${dailyDecay.toFixed(2)}/day. Manageable if you have a clear timeframe for your trade thesis.`;
  return `Minimal time decay at ₹${dailyDecay.toFixed(2)}/day. Long-dated option or deep ITM — time erosion is not a major concern right now.`;
}

function vegaInterpretation(vega: number, volatility: number): string {
  if (vega > 0.5) return `High vega — this option is very sensitive to volatility changes. A 1% increase in IV adds ~₹${vega.toFixed(2)} to the price. At current IV of ${(volatility * 100).toFixed(1)}%, consider whether vol is cheap or expensive relative to historical levels. Buying when IV is low (before events) and selling when IV is high (after events) is the edge.`;
  if (vega > 0.1) return `Moderate vega sensitivity. Volatility changes matter. Current IV: ${(volatility * 100).toFixed(1)}%. If you expect a big move (earnings, news), higher IV could boost your option's value even before the stock moves.`;
  return `Low vega. Volatility changes have minimal impact. This is either deep ITM/OTM or near expiry. Price movement matters more than vol at this point.`;
}

function rhoInterpretation(rho: number, riskFreeRate: number, optionType: OptionType): string {
  if (Math.abs(rho) < 0.01) return `Rho is negligible — interest rate changes won't meaningfully affect this option. Focus on other Greeks.`;
  const direction = rho > 0 ? "rising" : "falling";
  return `A 1% rate increase ${direction === "rising" ? "adds" : "subtracts"} ~₹${Math.abs(rho).toFixed(2)}. Current rate: ${(riskFreeRate * 100).toFixed(1)}%. ${optionType === "call" ? "Calls benefit from higher rates (higher cost of carry for the underlying)." : "Puts benefit from lower rates."} In India, watch RBI policy announcements.`;
}

// --- Overall trade signal ---

interface TradeSignal {
  label: string;
  color: string;
  icon: typeof CheckCircle2;
  confidence: number; // 0-100
  reasons: string[];
  risks: string[];
  strategy: string;
}

function generateTradeSignal(
  result: PricingResult,
  optionType: OptionType,
  optionStyle: OptionStyle,
  spotPrice: number,
  strikePrice: number,
  volatility: number,
  timeToExpiry: number,
  sentimentScore?: number,
): TradeSignal {
  const { greeks, price, intrinsicValue, timeValue } = result;
  const absDelta = Math.abs(greeks.delta);
  const isCall = optionType === "call";
  const moneyness = isCall ? spotPrice - strikePrice : strikePrice - spotPrice;
  const moneynessRatio = moneyness / spotPrice;
  const timeValueRatio = price > 0 ? timeValue / price : 0;
  const dailyThetaPercent = price > 0 ? (Math.abs(greeks.theta) / price) * 100 : 0;

  let score = 50; // start neutral
  const reasons: string[] = [];
  const risks: string[] = [];

  // Moneyness analysis
  if (moneynessRatio > 0.05) {
    score += 10;
    reasons.push("Option is comfortably in-the-money with built-in intrinsic value");
  } else if (moneynessRatio > 0) {
    score += 5;
    reasons.push("Slightly in-the-money — has some intrinsic value buffer");
  } else if (moneynessRatio > -0.03) {
    reasons.push("Near-the-money — balanced risk/reward zone");
  } else if (moneynessRatio > -0.1) {
    score -= 5;
    risks.push("Out-of-the-money — needs the stock to move meaningfully to profit");
  } else {
    score -= 15;
    risks.push("Deep out-of-the-money — very high probability of expiring worthless");
  }

  // Delta quality
  if (absDelta > 0.4 && absDelta < 0.7) {
    score += 8;
    reasons.push(`Good delta (${absDelta.toFixed(2)}) — reasonable probability of profit with leverage`);
  } else if (absDelta > 0.7) {
    score += 3;
    reasons.push("High delta — less leverage but higher probability of profit");
  } else if (absDelta < 0.2) {
    score -= 10;
    risks.push("Very low delta — this is a low-probability speculative bet");
  }

  // Time decay pressure
  if (dailyThetaPercent > 2) {
    score -= 15;
    risks.push(`Severe daily time decay of ${dailyThetaPercent.toFixed(1)}% — premium is eroding fast`);
  } else if (dailyThetaPercent > 0.8) {
    score -= 8;
    risks.push("Meaningful time decay — need a move soon or the position bleeds value");
  } else if (dailyThetaPercent < 0.2) {
    score += 5;
    reasons.push("Low time decay — comfortable holding period");
  }

  // Time to expiry
  if (timeToExpiry < 7 / 365) {
    score -= 12;
    risks.push("Less than 7 days to expiry — gamma risk is very high and theta accelerates");
  } else if (timeToExpiry < 30 / 365) {
    score -= 5;
    risks.push("Short-dated option — time decay accelerating as expiry approaches");
  } else if (timeToExpiry > 90 / 365) {
    score += 5;
    reasons.push("Plenty of time for the thesis to play out");
  }

  // Volatility consideration
  if (volatility > 0.5) {
    score -= 5;
    risks.push(`Very high implied volatility (${(volatility * 100).toFixed(0)}%) — premium is expensive, vol crush risk after events`);
  } else if (volatility < 0.15) {
    score += 5;
    reasons.push(`Low volatility (${(volatility * 100).toFixed(0)}%) — premium is relatively cheap, good entry if you expect a move`);
  }

  // Time value ratio
  if (timeValueRatio > 0.9 && moneynessRatio < 0) {
    score -= 8;
    risks.push("Almost entire premium is time value — all of it erodes by expiry if OTM");
  }

  // Sentiment adjustment
  if (sentimentScore !== undefined) {
    if (isCall && sentimentScore > 0.3) {
      score += Math.round(sentimentScore * 10);
      reasons.push(`Positive news sentiment (${(sentimentScore * 100).toFixed(0)}%) supports bullish call thesis`);
    } else if (isCall && sentimentScore < -0.3) {
      score -= Math.round(Math.abs(sentimentScore) * 10);
      risks.push(`Negative news sentiment (${(sentimentScore * 100).toFixed(0)}%) works against bullish call position`);
    } else if (!isCall && sentimentScore < -0.3) {
      score += Math.round(Math.abs(sentimentScore) * 10);
      reasons.push(`Negative news sentiment supports bearish put thesis`);
    } else if (!isCall && sentimentScore > 0.3) {
      score -= Math.round(sentimentScore * 10);
      risks.push(`Positive news sentiment works against bearish put position`);
    }
  }

  score = Math.max(0, Math.min(100, score));

  // Generate strategy recommendation
  let strategy = "";
  if (score >= 70) {
    strategy = isCall
      ? `Consider buying this ${optionStyle} call. Strong setup with favorable risk/reward. Position size: risk no more than 2-3% of capital. Set a stop-loss at 50% of premium paid.`
      : `Consider buying this ${optionStyle} put. Favorable conditions for a bearish/hedge position. Use as portfolio protection or directional bet. Risk no more than 2-3% of capital.`;
  } else if (score >= 55) {
    strategy = `Moderately favorable setup. ${isCall ? "Bullish" : "Bearish"} bias is supported but with caveats. Consider a spread strategy (buy this + sell a further OTM option) to reduce cost and theta exposure. Wait for a pullback/confirmation before entry.`;
  } else if (score >= 40) {
    strategy = `Neutral/mixed signals. The risk-reward is not compelling. Consider waiting for better entry or using a defined-risk spread. If you must trade, keep position size small (1% of capital max).`;
  } else {
    strategy = `Unfavorable conditions for this trade. High probability of losing the premium. ${timeToExpiry < 14 / 365 ? "Near-expiry theta is destroying value. " : ""}Consider selling this option instead (if you have the capital/margin), or look for better opportunities.`;
  }

  let label: string;
  let color: string;
  let icon: typeof CheckCircle2;
  if (score >= 70) {
    label = "Favorable";
    color = "text-emerald-600";
    icon = CheckCircle2;
  } else if (score >= 55) {
    label = "Moderately Favorable";
    color = "text-blue-600";
    icon = TrendingUp;
  } else if (score >= 40) {
    label = "Neutral";
    color = "text-amber-600";
    icon = AlertTriangle;
  } else {
    label = "Unfavorable";
    color = "text-red-600";
    icon = XCircle;
  }

  return { label, color, icon, confidence: score, reasons, risks, strategy };
}

export function TradeAnalysis({
  result, optionType, optionStyle, spotPrice, strikePrice,
  volatility, timeToExpiry, riskFreeRate, sentimentScore,
}: TradeAnalysisProps) {
  const { greeks, price } = result;
  const signal = generateTradeSignal(
    result, optionType, optionStyle, spotPrice, strikePrice,
    volatility, timeToExpiry, sentimentScore,
  );
  const SignalIcon = signal.icon;

  return (
    <div className="space-y-6">
      {/* Trade Signal Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge className="size-5" />
            Trade Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <SignalIcon className={`size-8 ${signal.color}`} />
            <div>
              <div className={`text-xl font-bold ${signal.color}`}>
                {signal.label}
              </div>
              <div className="text-sm text-muted-foreground">
                Confidence Score: {signal.confidence}/100
              </div>
            </div>
            <div className="ml-auto">
              <div className="w-20 h-20 relative">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" strokeWidth="3" strokeDasharray={`${signal.confidence}, 100`}
                    className={signal.confidence >= 70 ? "stroke-emerald-500" : signal.confidence >= 55 ? "stroke-blue-500" : signal.confidence >= 40 ? "stroke-amber-500" : "stroke-red-500"}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                  {signal.confidence}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Strategy Recommendation */}
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldAlert className="size-4 text-foreground/70" />
              <span className="text-sm font-semibold">Strategy Recommendation</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{signal.strategy}</p>
          </div>

          {/* Pros & Cons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {signal.reasons.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Favorable Factors
                </span>
                <ul className="space-y-1">
                  {signal.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {signal.risks.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-semibold text-red-600 flex items-center gap-1">
                  <AlertTriangle className="size-3.5" /> Risk Factors
                </span>
                <ul className="space-y-1">
                  {signal.risks.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-red-500 mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {sentimentScore !== undefined && (
            <>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">News Sentiment Impact</span>
                <Badge variant={sentimentScore > 0.1 ? "default" : sentimentScore < -0.1 ? "destructive" : "secondary"}>
                  {sentimentScore > 0.1 ? "Bullish" : sentimentScore < -0.1 ? "Bearish" : "Neutral"} ({(sentimentScore * 100).toFixed(0)}%)
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detailed Greeks Interpretation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowUpDown className="size-5" />
            Greeks Deep Dive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Delta */}
          <GreekDetail
            symbol="Δ" name="Delta" value={greeks.delta}
            tagline={`${Math.abs(greeks.delta) > 0.5 ? "Strong" : "Weak"} directional exposure`}
            interpretation={deltaInterpretation(greeks.delta, optionType)}
            traderTip={
              Math.abs(greeks.delta) > 0.7
                ? "High delta means you're almost long/short the stock. Consider if you need this much exposure or if a lower-delta option gives better leverage."
                : Math.abs(greeks.delta) < 0.3
                ? "Low delta = low probability play. These are lottery tickets. Professional traders sell these to collect premium."
                : "The sweet spot for most directional trades. Good balance of probability and leverage."
            }
          />

          <Separator />

          {/* Gamma */}
          <GreekDetail
            symbol="Γ" name="Gamma" value={greeks.gamma}
            tagline={`Delta changes by ${greeks.gamma.toFixed(4)} per ₹1 move`}
            interpretation={gammaInterpretation(greeks.gamma, spotPrice)}
            traderTip={
              greeks.gamma > 0.03
                ? "High gamma near expiry = rapid delta changes. Great for day trading breakouts but dangerous if the stock chops sideways."
                : "Manageable gamma. Your delta exposure is relatively stable day-to-day."
            }
          />

          <Separator />

          {/* Theta */}
          <GreekDetail
            symbol="Θ" name="Theta" value={greeks.theta}
            tagline={`Losing ₹${Math.abs(greeks.theta).toFixed(4)}/day to time decay`}
            interpretation={thetaInterpretation(greeks.theta, price)}
            traderTip={
              price > 0 && (Math.abs(greeks.theta) / price) * 100 > 1
                ? "Time is your enemy. If you're buying this option, you need the stock to move fast enough to overcome daily decay. Consider selling options instead to collect theta."
                : "Theta is manageable. You have time on your side — but remember it accelerates as expiry nears."
            }
            icon={<Clock className="size-3.5 text-amber-500" />}
          />

          <Separator />

          {/* Vega */}
          <GreekDetail
            symbol="ν" name="Vega" value={greeks.vega}
            tagline={`₹${greeks.vega.toFixed(4)} per 1% IV change`}
            interpretation={vegaInterpretation(greeks.vega, volatility)}
            traderTip={
              volatility > 0.4
                ? "IV is elevated. Buying now means you're paying a high vol premium. If you expect IV to drop (after earnings, events), consider selling options or using spreads."
                : volatility < 0.2
                ? "IV is relatively low. Good time to buy options if you expect a move — you get the vol expansion tailwind."
                : "IV is in a normal range. Vega is a secondary consideration for this trade."
            }
          />

          <Separator />

          {/* Rho */}
          <GreekDetail
            symbol="ρ" name="Rho" value={greeks.rho}
            tagline={`₹${Math.abs(greeks.rho).toFixed(4)} per 1% rate change`}
            interpretation={rhoInterpretation(greeks.rho, riskFreeRate, optionType)}
            traderTip="Rho matters most for long-dated options (LEAPS). For short-term trades, it's usually irrelevant. Watch RBI policy dates if trading long-dated Indian options."
          />
        </CardContent>
      </Card>
    </div>
  );
}

// --- Greek detail sub-component ---

function GreekDetail({
  symbol, name, value, tagline, interpretation, traderTip, icon,
}: {
  symbol: string;
  name: string;
  value: number;
  tagline: string;
  interpretation: string;
  traderTip: string;
  icon?: React.ReactNode;
}) {
  const isPositive = value >= 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-serif font-bold text-muted-foreground w-6 text-center">{symbol}</span>
          <div>
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground ml-2">{tagline}</span>
          </div>
        </div>
        <span className={`font-mono text-sm font-bold ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
          {isPositive ? "+" : ""}{value.toFixed(4)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-8">{interpretation}</p>
      <div className="flex items-start gap-1.5 pl-8 mt-1">
        {icon || <TrendingUp className="size-3.5 text-blue-500 mt-0.5 shrink-0" />}
        <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
          <strong>Trader&apos;s take:</strong> {traderTip}
        </p>
      </div>
    </div>
  );
}
