import { NextRequest } from "next/server";

export interface ReportRequest {
  symbol?: string;
  optionType: "call" | "put";
  optionStyle: string;
  spotPrice: number;
  strikePrice: number;
  volatilityPct: number;
  timeToExpiryDays: number;
  riskFreeRatePct: number;
  theoreticalPrice: number;
  marketLTP?: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  };
  probabilityOfProfitPct: number;
  breakEven: number;
  moveNeededPct: number;
  sentimentScore?: number;
  sentimentLabel?: string;
  newsHeadlines?: string[];
  macroContext?: {
    macroSignal: string;
    macroScore: number;
    primaryEvent?: string;
    narrativeSummary?: string;
    layers: Array<{
      model: string;
      label: string;
      score: number;
      direction: string;
      reasoning: string;
      weight: number;
    }>;
    inversionSignal?: string;
    optionsImplication?: string;
  };
}

export interface StockAnalysis {
  verdict: "BUY" | "ACCUMULATE" | "HOLD" | "AVOID" | "SELL";
  verdictColor: "green" | "yellow" | "red";
  rationale: string;
  mentalModelSynthesis?: string;
  mathSignals?: string;
  entryZone: string;
  targetPrice: string;
  stopLoss: string;
  timeHorizon: string;
  keyRisks: string[];
}

export interface ReportResponse {
  verdict: string;
  verdictColor: "green" | "yellow" | "red";
  confidence: number;
  summary: string;
  keyFactors: string[];
  risks: string[];
  recommendation: string;
  positionSizing: string;
  stockAnalysis?: StockAnalysis;
  aiPowered: true;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "DEEPSEEK_API_KEY is not configured" }, { status: 503 });
  }

  let body: ReportRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    symbol, optionType, optionStyle, spotPrice, strikePrice,
    volatilityPct, timeToExpiryDays, riskFreeRatePct, theoreticalPrice,
    marketLTP, greeks, probabilityOfProfitPct, breakEven, moveNeededPct,
    sentimentScore, sentimentLabel, newsHeadlines, macroContext,
  } = body;

  const premiumUsed = marketLTP ?? theoreticalPrice;
  const pricingNote = marketLTP
    ? `Market LTP (actual price on exchange): ₹${marketLTP.toFixed(2)}. Theoretical (model) price: ₹${theoreticalPrice.toFixed(2)}. The option appears ${marketLTP > theoreticalPrice ? "overpriced" : "underpriced"} by ₹${Math.abs(marketLTP - theoreticalPrice).toFixed(2)}.`
    : `Theoretical price (model): ₹${theoreticalPrice.toFixed(2)}. No market LTP provided.`;

  const newsSection = newsHeadlines && newsHeadlines.length > 0
    ? `\nRecent news headlines (${sentimentLabel ?? "N/A"}, score ${((sentimentScore ?? 0) * 100).toFixed(0)}%):\n${newsHeadlines.slice(0, 8).map((h, i) => `${i + 1}. ${h}`).join("\n")}`
    : "\nNo news data available.";

  const macroSection = macroContext
    ? `\nMACRO LATTICEWORK (Charlie Munger's nine mental models):
- Overall macro signal: ${macroContext.macroSignal} (net score: ${macroContext.macroScore >= 0 ? "+" : ""}${macroContext.macroScore}/100)
- Primary event: ${macroContext.primaryEvent ?? "N/A"}
- Narrative: ${macroContext.narrativeSummary ?? "N/A"}
- Inversion signal: ${macroContext.inversionSignal ?? "N/A"}
- Options implication: ${macroContext.optionsImplication ?? "N/A"}
\nIndividual model scores (score × weight = contribution to net):
${macroContext.layers.map((l) => `  • ${l.label} (${l.model}): score=${l.score > 0 ? "+" : ""}${l.score}, weight=${(l.weight * 100).toFixed(0)}%, direction=${l.direction} — ${l.reasoning}`).join("\n")}`
    : "\nNo macro latticework data available.";

  const prompt = `You are an expert Indian options trader and financial analyst. A retail investor using a demat account (like ICICI iDirect or Zerodha) is analyzing the following option and wants a structured investment report to decide whether to buy this option.

OPTION DETAILS:
- Symbol: ${symbol ?? "Unknown"}
- Type: ${optionType.toUpperCase()} option (${optionStyle})
- Spot Price: ₹${spotPrice.toFixed(2)}
- Strike Price: ₹${strikePrice.toFixed(2)}
- Implied Volatility: ${volatilityPct.toFixed(1)}%
- Time to Expiry: ${timeToExpiryDays} days
- Risk-Free Rate: ${riskFreeRatePct.toFixed(2)}%
- ${pricingNote}
- Premium paid (for P&L calculation): ₹${premiumUsed.toFixed(2)}

GREEKS:
- Delta: ${greeks.delta.toFixed(4)} (${Math.abs(greeks.delta * 100).toFixed(0)}% probability-equivalent)
- Gamma: ${greeks.gamma.toFixed(4)}
- Theta: ₹${greeks.theta.toFixed(2)}/day (time decay)
- Vega: ₹${greeks.vega.toFixed(2)} per 1% IV change
- Rho: ${greeks.rho.toFixed(4)}

TRADE METRICS:
- Probability of expiring in-the-money (N(d2)): ${probabilityOfProfitPct.toFixed(1)}%
- Break-even price at expiry: ₹${breakEven.toFixed(2)}
- Required underlying move to break even: ${moveNeededPct > 0 ? "+" : ""}${moveNeededPct.toFixed(2)}%
${newsSection}
${macroSection}

Write a structured investment report. Return ONLY a valid JSON object with exactly these fields:
{
  "verdict": "BUY" | "CONSIDER BUYING" | "NEUTRAL" | "AVOID" | "DO NOT BUY",
  "verdictColor": "green" | "yellow" | "red",
  "confidence": <integer 0-100>,
  "summary": "<2-3 sentence plain English summary of this option's risk/reward for a retail investor>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "recommendation": "<3-5 sentence concrete actionable recommendation including entry/exit logic>",
  "positionSizing": "<1-2 sentence advice on how much capital to risk, mentioning lot sizes if relevant>",
  "stockAnalysis": {
    "verdict": "BUY" | "ACCUMULATE" | "HOLD" | "AVOID" | "SELL",
    "verdictColor": "green" | "yellow" | "red",
    "rationale": "<3-4 sentence assessment of the underlying stock (equity delivery, not the option). MUST synthesise: (1) the macro latticework net score and which mental models are dominant, (2) what the option Greeks (especially delta and implied volatility) signal about market expectations for the stock direction, (3) the break-even move required and what it implies about fair value, and (4) news sentiment. Be specific about model names and numbers.>",
    "mentalModelSynthesis": "<2-3 sentences explaining how the combination of the dominant mental model signals (e.g. mechanics bearish but mean-reversion bullish) resolves into a net view for the stock — where do the models agree and where do they conflict?>",
    "mathSignals": "<1-2 sentences translating the key mathematical outputs — delta, IV, probability of ITM, break-even move — into what they imply about where the market expects the stock to go over the option's life>",
    "entryZone": "<suggested price range to buy the stock, e.g. ₹2,400–₹2,450>",
    "targetPrice": "<12-month price target for the stock>",
    "stopLoss": "<recommended stop-loss level for a stock position>",
    "timeHorizon": "<suggested holding period, e.g. 3–6 months>",
    "keyRisks": ["<stock-level risk 1 with model reference>", "<stock-level risk 2>"]
  }
}

Rules:
- Use Indian Rupee (₹) for all monetary values
- Reference real NSE lot sizes where relevant (e.g. NIFTY = 75 units/lot)
- Be direct and honest — if the trade is bad, say so clearly
- Assume the investor is a retail trader with moderate experience
- The stockAnalysis section must focus on buying the UNDERLYING STOCK (equity delivery), completely separate from the option trade analysis
- In stockAnalysis.rationale explicitly reference the macro latticework net score and the 2-3 dominant mental model names
- In stockAnalysis.mathSignals cite specific numbers: delta value, IV%, probability of ITM%, and break-even % move
- Do NOT add any text before or after the JSON`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `DeepSeek API error: ${res.status} — ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      const finishReason = data.choices?.[0]?.finish_reason ?? "unknown";
      return Response.json({ error: `Empty response from DeepSeek (finish_reason: ${finishReason})` }, { status: 502 });
    }

    const parsed = JSON.parse(content) as Omit<ReportResponse, "aiPowered" | "timestamp">;
    const response: ReportResponse = {
      ...parsed,
      aiPowered: true,
      timestamp: new Date().toISOString(),
    };

    return Response.json(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to generate report";
    return Response.json({ error: msg }, { status: 502 });
  }
}
