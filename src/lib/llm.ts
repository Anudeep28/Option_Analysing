// Optional LLM pass for richer macro analysis. Falls back to rule-based output when the API key is missing or the call fails.
import type { LatticeworkAnalysis, MentalModelLayer } from "@/lib/macro-impact";

// ─── Full LLM-driven Latticework ─────────────────────────────

export interface LLMLatticeworkInput {
  symbol: string;
  sector: string;
  spotPrice?: number;
  headlines: string[];   // raw news headlines
  eventName: string;     // e.g. "An oil price spike"
  eventChannel: string;  // e.g. "higher crude raises energy costs"
}

const MENTAL_MODEL_DEFINITIONS = `
The nine mental models and what each one asks:

1. mechanics (weight guidance: 20-25%)
   First-order causality. How does this macro event directly change this company's revenue, costs, or cash flows? Think like a physicist tracing cause → effect before second-order reactions.

2. incentives (weight guidance: 12-16%)
   Charlie Munger: "Show me the incentive and I'll show you the outcome." How does this event change what management, investors, regulators, and competitors are now motivated to do?

3. feedback_loop (weight guidance: 12-16%)
   Second-order amplification or dampening. Does the initial shock trigger a reinforcing loop (positive → more positive, negative → more negative) or a self-correcting loop?

4. competitive (weight guidance: 9-13%)
   Porter-style. Does this event tilt the playing field between this company and its domestic or global rivals? Relative performance matters as much as absolute impact.

5. mean_reversion (weight guidance: 6-10%)
   Economic variables and market prices tend to revert to long-run equilibria. How far is this shock from its historical mean, and how quickly is it likely to revert?

6. inversion (weight guidance: 4-7%)
   Munger's inversion: instead of asking what can go right, ask what must go wrong to destroy the thesis. Identifies the contrarian signal or hidden landmine.

7. fiscal_policy (weight guidance: 9-13%)
   Indian government and RBI response. Will the government announce subsidies, duty changes, capex, or will the RBI adjust rates or intervene in FX? How does that policy response affect this sector?

8. liquidity_flows (weight guidance: 7-11%)
   How does this event shift FII/DII allocation, RBI open-market operations, credit growth, and broad market liquidity? Liquidity is the water level that lifts or sinks all boats.

9. rural_demand (weight guidance: 3-7%)
   India-specific. Rural India (~65% of population) drives FMCG, two-wheelers, agri-inputs. Does this event affect monsoon, MSP, rural wages, or crop prices? Note if irrelevant for non-rural sectors.
`;

export async function computeLatticeworkWithLLM(
  input: LLMLatticeworkInput,
): Promise<LatticeworkAnalysis | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const headlineList = input.headlines.slice(0, 24).map((h, i) => `${i + 1}. ${h}`).join("\n");
  const spotNote = input.spotPrice ? `Current spot price: ₹${input.spotPrice.toFixed(2)}` : "Spot price: not provided";

  const prompt = `You are a senior India-focused equity analyst applying Charlie Munger's latticework of mental models to analyse the macro impact on a specific stock.

STOCK CONTEXT:
- Stock: ${input.symbol}
- Sector: ${input.sector}
- ${spotNote}
- News synthesis scope: ${input.eventName}
- Analysis objective: ${input.eventChannel}

LIVE NEWS HEADLINES (the [Global], [India], and [Company] labels identify each headline's scope):
${headlineList}

MENTAL MODEL DEFINITIONS:
${MENTAL_MODEL_DEFINITIONS}

Your task:
For each of the 9 mental models, reason carefully about the combined impact of the live headlines on ${input.symbol} (${input.sector} sector). Do not force the news into predefined event categories. Then output:
- score: integer from -100 to +100. Positive = bullish for the stock. Negative = bearish. 0 = neutral. Use the full range — do not cluster everything near zero.
- weight: decimal 0.00–1.00 representing how much THIS model matters for THIS specific event+sector combination. All 9 weights MUST sum to exactly 1.00.
- reasoning: ONE precise sentence (max 35 words) explaining the specific impact on ${input.symbol} through this model's lens. Be concrete, cite the transmission mechanism.

Also compute:
- netScore: sum of (score × weight) for all 9 models, clamped to -100 to +100, rounded to 1 decimal
- direction: "bullish" if netScore > 15, "bearish" if netScore < -15, "mixed" if |netScore| <= 15 but max score > 30 and min score < -30, else "neutral"
- narrativeSummary: 2-3 sentence investor-ready paragraph combining the dominant model signals into a stock view
- inversionSignal: one sentence on the contrarian case — what would make the consensus wrong
- optionsImplication: one sentence on what this means for options IV and strategy on ${input.symbol}
- durationOutlook: one sentence on how long this macro impact is likely to persist

Respond ONLY with this JSON (no extra text):
{
  "layers": [
    { "model": "mechanics",      "label": "Mechanics (first-order effect)",             "score": <int>, "weight": <decimal>, "reasoning": "..." },
    { "model": "incentives",     "label": "Incentives (who wins / loses)",              "score": <int>, "weight": <decimal>, "reasoning": "..." },
    { "model": "feedback_loop",  "label": "Feedback loops (second-order amplification)","score": <int>, "weight": <decimal>, "reasoning": "..." },
    { "model": "competitive",    "label": "Competitive dynamics",                       "score": <int>, "weight": <decimal>, "reasoning": "..." },
    { "model": "mean_reversion", "label": "Mean reversion",                             "score": <int>, "weight": <decimal>, "reasoning": "..." },
    { "model": "inversion",      "label": "Inversion (contrarian signal)",              "score": <int>, "weight": <decimal>, "reasoning": "..." },
    { "model": "fiscal_policy",  "label": "Fiscal policy / Government response",        "score": <int>, "weight": <decimal>, "reasoning": "..." },
    { "model": "liquidity_flows","label": "Liquidity & capital flows",                  "score": <int>, "weight": <decimal>, "reasoning": "..." },
    { "model": "rural_demand",   "label": "Rural demand / Monsoon linkage",             "score": <int>, "weight": <decimal>, "reasoning": "..." }
  ],
  "netScore": <number>,
  "direction": "bullish" | "bearish" | "neutral" | "mixed",
  "narrativeSummary": "...",
  "inversionSignal": "...",
  "optionsImplication": "...",
  "durationOutlook": "..."
}`;

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1800,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.warn("DeepSeek latticework LLM failed:", res.status);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content as string | undefined;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      layers: Array<{
        model: string; label: string; score: number; weight: number; reasoning: string;
      }>;
      netScore: number;
      direction: string;
      narrativeSummary: string;
      inversionSignal: string;
      optionsImplication: string;
      durationOutlook: string;
    };

    if (!parsed.layers || parsed.layers.length !== 9) return null;
    const expectedModels = [
      "mechanics", "incentives", "feedback_loop", "competitive", "mean_reversion",
      "inversion", "fiscal_policy", "liquidity_flows", "rural_demand",
    ];
    if (!expectedModels.every((m) => parsed.layers.some((l) => l.model === m))) return null;

    const layers: MentalModelLayer[] = parsed.layers.map((l) => ({
      model: l.model as MentalModelLayer["model"],
      label: l.label,
      score: Math.round(Math.max(-100, Math.min(100, l.score))),
      weight: Math.max(0, Math.min(1, l.weight)),
      reasoning: l.reasoning,
      direction: l.score > 5 ? "bullish" : l.score < -5 ? "bearish" : "neutral",
    }));

    // Normalise weights so they always sum to 1
    const weightSum = layers.reduce((s, l) => s + l.weight, 0);
    if (weightSum > 0) layers.forEach((l) => { l.weight = Math.round((l.weight / weightSum) * 100) / 100; });

    const rawScore = layers.reduce((s, l) => s + l.score, 0);
    const netScore = Math.max(-100, Math.min(100, parsed.netScore ?? layers.reduce((s, l) => s + l.score * l.weight, 0)));

    const direction = ((): LatticeworkAnalysis["direction"] => {
      if (parsed.direction === "bullish" || parsed.direction === "bearish" ||
          parsed.direction === "neutral" || parsed.direction === "mixed") {
        return parsed.direction as LatticeworkAnalysis["direction"];
      }
      if (netScore > 15) return "bullish";
      if (netScore < -15) return "bearish";
      return "neutral";
    })();

    return {
      layers,
      rawScore,
      netScore,
      direction,
      narrativeSummary: parsed.narrativeSummary ?? "",
      inversionSignal: parsed.inversionSignal ?? "",
      optionsImplication: parsed.optionsImplication ?? "",
      durationOutlook: parsed.durationOutlook ?? "",
    };
  } catch (e) {
    console.warn("DeepSeek latticework LLM error:", e);
    return null;
  }
}

export interface LLMLayerReasoning {
  mechanics: string;
  incentives: string;
  feedback_loop: string;
  competitive: string;
  mean_reversion: string;
  inversion: string;
  fiscal_policy: string;
  liquidity_flows: string;
  rural_demand: string;
}

export interface LLMLayerInput {
  symbol: string;
  sector: string;
  eventType: string;
  eventName: string;
  eventChannel: string;
  headline: string;
  layers: Array<{
    model: string;
    label: string;
    score: number;
    direction: string;
  }>;
}

export async function enhanceLayersWithLLM(input: LLMLayerInput): Promise<LLMLayerReasoning | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const layerList = input.layers
    .map((l) => `- ${l.model} (${l.label}): score=${l.score > 0 ? "+" : ""}${l.score}, direction=${l.direction}`)
    .join("\n");

  const prompt = `You are a senior India-focused equity analyst applying Charlie Munger's latticework of mental models.

Context:
- Stock: ${input.symbol} (sector: ${input.sector})
- Macro event: ${input.eventName}
- Transmission channel: ${input.eventChannel}
- Representative headline: "${input.headline}"

A rule-based engine has scored this event across 9 mental models for ${input.symbol}:
${layerList}

For EACH of the 9 mental models below, write ONE precise sentence (max 30 words) explaining the SPECIFIC impact of this event on ${input.symbol} through that model's lens. Be concrete — reference the actual transmission mechanism, not generic placeholders. Scores tell you direction and magnitude; your job is to explain WHY with specificity.

Mental models to cover (use exactly these keys):
1. mechanics — direct first-order cash-flow / P&L impact
2. incentives — how management, investors, regulators are incentivised to respond
3. feedback_loop — second-order amplification or dampening effects
4. competitive — relative positioning vs sector peers
5. mean_reversion — where does this shock normalise over time
6. inversion — what would prove the consensus wrong
7. fiscal_policy — Indian government / RBI policy response
8. liquidity_flows — FII/DII flows, RBI stance, credit conditions
9. rural_demand — rural income, agrarian linkage, monsoon effect (even if indirect, note if irrelevant)

Respond ONLY with this JSON (no extra text):
{
  "mechanics": "...",
  "incentives": "...",
  "feedback_loop": "...",
  "competitive": "...",
  "mean_reversion": "...",
  "inversion": "...",
  "fiscal_policy": "...",
  "liquidity_flows": "...",
  "rural_demand": "..."
}`;

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.warn("DeepSeek layer enhancement failed:", res.status);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content as string | undefined;
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<LLMLayerReasoning>;
    const required: (keyof LLMLayerReasoning)[] = [
      "mechanics", "incentives", "feedback_loop", "competitive",
      "mean_reversion", "inversion", "fiscal_policy", "liquidity_flows", "rural_demand",
    ];
    if (required.some((k) => !parsed[k])) return null;

    return parsed as LLMLayerReasoning;
  } catch (e) {
    console.warn("DeepSeek layer enhancement error:", e);
    return null;
  }
}

export interface LLMEnhancement {
  summary: string;
  inversionSignal: string;
  model: string;
}

export interface LLMMacroInput {
  symbol: string;
  sector: string;
  macroScore: number;
  macroSignal: "bullish" | "bearish" | "neutral" | "mixed";
  topEvents: Array<{
    rank: number;
    type: string;
    headline: string;
    severity: "high" | "medium" | "low";
    netScore: number;
    direction: "bullish" | "bearish" | "neutral" | "mixed";
    narrativeSummary: string;
    transmissionChain: string;
  }>;
}

export async function enhanceMacroWithLLM(input: LLMMacroInput): Promise<LLMEnhancement | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const eventText = input.topEvents
    .map(
      (e) =>
        `${e.rank}. ${e.type} | headline: "${e.headline}" | severity: ${e.severity} | ` +
        `latticework score: ${e.netScore} (${e.direction}) | summary: ${e.narrativeSummary} | ` +
        `transmission: ${e.transmissionChain}`,
    )
    .join("\n");

  const prompt = `You are a senior India-focused equity analyst. A rule-based macro engine has scanned recent global headlines and identified the top ${input.topEvents.length} global macro drivers for the stock ${input.symbol} in the ${input.sector} sector.

Combined rule-based macro score: ${input.macroScore} / 100 (${input.macroSignal}).

Drivers:
${eventText}

Write a concise, investor-ready paragraph (3-5 sentences) that explains the *combined* impact of these drivers on ${input.symbol} specifically. Mention second-order effects where relevant. Do not hedge every sentence.

Then write one sentence for the contrarian / inversion case: what would make the market wrong about ${input.symbol} here?

Respond ONLY in this JSON format:
{
  "summary": "...",
  "inversionSignal": "..."
}`;

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown");
      console.warn("DeepSeek macro enhancement failed:", res.status, body);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content as string | undefined;
    if (!content) return null;

    const parsed = JSON.parse(content) as { summary?: string; inversionSignal?: string };
    if (!parsed.summary || !parsed.inversionSignal) return null;

    return {
      summary: parsed.summary,
      inversionSignal: parsed.inversionSignal,
      model: json.model ?? "deepseek-chat",
    };
  } catch (e) {
    console.warn("DeepSeek macro enhancement error:", e);
    return null;
  }
}
