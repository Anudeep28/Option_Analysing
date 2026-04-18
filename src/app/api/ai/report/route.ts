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
    sentimentScore, sentimentLabel, newsHeadlines,
  } = body;

  const premiumUsed = marketLTP ?? theoreticalPrice;
  const pricingNote = marketLTP
    ? `Market LTP (actual price on exchange): ₹${marketLTP.toFixed(2)}. Theoretical (model) price: ₹${theoreticalPrice.toFixed(2)}. The option appears ${marketLTP > theoreticalPrice ? "overpriced" : "underpriced"} by ₹${Math.abs(marketLTP - theoreticalPrice).toFixed(2)}.`
    : `Theoretical price (model): ₹${theoreticalPrice.toFixed(2)}. No market LTP provided.`;

  const newsSection = newsHeadlines && newsHeadlines.length > 0
    ? `\nRecent news headlines (${sentimentLabel ?? "N/A"}, score ${((sentimentScore ?? 0) * 100).toFixed(0)}%):\n${newsHeadlines.slice(0, 8).map((h, i) => `${i + 1}. ${h}`).join("\n")}`
    : "\nNo news data available.";

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

Write a structured investment report. Return ONLY a valid JSON object with exactly these fields:
{
  "verdict": "BUY" | "CONSIDER BUYING" | "NEUTRAL" | "AVOID" | "DO NOT BUY",
  "verdictColor": "green" | "yellow" | "red",
  "confidence": <integer 0-100>,
  "summary": "<2-3 sentence plain English summary of this option's risk/reward for a retail investor>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "recommendation": "<3-5 sentence concrete actionable recommendation including entry/exit logic>",
  "positionSizing": "<1-2 sentence advice on how much capital to risk, mentioning lot sizes if relevant>"
}

Rules:
- Use Indian Rupee (₹) for all monetary values
- Reference real NSE lot sizes where relevant (e.g. NIFTY = 75 units/lot)
- Be direct and honest — if the trade is bad, say so clearly
- Assume the investor is a retail trader with moderate experience
- Do NOT add any text before or after the JSON`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
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
      return Response.json({ error: "Empty response from DeepSeek" }, { status: 502 });
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
