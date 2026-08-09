// Optional LLM pass for richer macro analysis. Falls back to rule-based output when the API key is missing or the call fails.
import type { LatticeworkAnalysis, MentalModelLayer } from "@/lib/macro-impact";
import type { NewsNodeImpact, ValueChain, ValueChainNode } from "@/lib/value-chain";

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

Return valid JSON only. Do not use placeholders, comments, Markdown fences, or pipe characters. Use numeric values for every score, weight, and netScore. The direction value must be exactly one of bullish, bearish, neutral, or mixed.

Use this valid JSON structure:
{
  "layers": [
    { "model": "mechanics", "label": "Mechanics (first-order effect)", "score": 0, "weight": 0.22, "reasoning": "Specific impact." },
    { "model": "incentives", "label": "Incentives (who wins / loses)", "score": 0, "weight": 0.14, "reasoning": "Specific impact." },
    { "model": "feedback_loop", "label": "Feedback loops (second-order amplification)", "score": 0, "weight": 0.14, "reasoning": "Specific impact." },
    { "model": "competitive", "label": "Competitive dynamics", "score": 0, "weight": 0.10, "reasoning": "Specific impact." },
    { "model": "mean_reversion", "label": "Mean reversion", "score": 0, "weight": 0.08, "reasoning": "Specific impact." },
    { "model": "inversion", "label": "Inversion (contrarian signal)", "score": 0, "weight": 0.06, "reasoning": "Specific impact." },
    { "model": "fiscal_policy", "label": "Fiscal policy / Government response", "score": 0, "weight": 0.10, "reasoning": "Specific impact." },
    { "model": "liquidity_flows", "label": "Liquidity & capital flows", "score": 0, "weight": 0.10, "reasoning": "Specific impact." },
    { "model": "rural_demand", "label": "Rural demand / Monsoon linkage", "score": 0, "weight": 0.06, "reasoning": "Specific impact." }
  ],
  "netScore": 0,
  "direction": "neutral",
  "narrativeSummary": "Investor-ready synthesis.",
  "inversionSignal": "Contrarian case.",
  "optionsImplication": "Options implication.",
  "durationOutlook": "Expected duration."
}`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1800,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("DeepSeek latticework LLM failed:", res.status, err);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content as string | undefined;
    if (!content) {
      console.warn("DeepSeek latticework returned empty content:", json.choices?.[0]?.finish_reason);
      return null;
    }

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

    if (!parsed.layers || parsed.layers.length !== 9) {
      console.warn("DeepSeek latticework layers invalid:", parsed.layers?.length);
      return null;
    }
    const expectedModels = [
      "mechanics", "incentives", "feedback_loop", "competitive", "mean_reversion",
      "inversion", "fiscal_policy", "liquidity_flows", "rural_demand",
    ];
    const missingModels = expectedModels.filter((m) => !parsed.layers.some((l) => l.model === m));
    if (missingModels.length > 0) {
      console.warn("DeepSeek latticework missing models:", missingModels);
      return null;
    }

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
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("DeepSeek latticework LLM error:", msg);
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
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 700,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("DeepSeek layer enhancement failed:", res.status, err);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content as string | undefined;
    if (!content) {
      console.warn("DeepSeek layer enhancement returned empty content:", json.choices?.[0]?.finish_reason);
      return null;
    }

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
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 512,
        thinking: { type: "disabled" },
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
    if (!content) {
      console.warn("DeepSeek macro enhancement returned empty content:", json.choices?.[0]?.finish_reason);
      return null;
    }

    const parsed = JSON.parse(content) as { summary?: string; inversionSignal?: string };
    if (!parsed.summary || !parsed.inversionSignal) return null;

    return {
      summary: parsed.summary,
      inversionSignal: parsed.inversionSignal,
      model: json.model ?? "deepseek-v4-pro",
    };
  } catch (e) {
    console.warn("DeepSeek macro enhancement error:", e);
    return null;
  }
}

// ─── Value-chain generation and news tagging (Option A) ─────

export interface LLMValueChainInput {
  symbol: string;
  sector: string;
  spotPrice?: number;
}

const VALUE_CHAIN_NODE_TYPES: ValueChainNode["type"][] = [
  "segment", "product", "component", "supplier", "geography", "customer",
];

export async function generateValueChainWithLLM(
  input: LLMValueChainInput,
): Promise<ValueChain | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are a senior equity analyst building a detailed value-chain decomposition for ${input.symbol} (${input.sector} sector).

Break the company into a tree of nodes using these types. Use stable, lowercase kebab-case ids. The goal is to capture enough granularity that a news headline about a specific input, part, supplier country, or customer type can be mapped to the correct node.

Node types (exact strings only):
- segment: major business segments (revenue share)
- product: key products / platforms under each segment
- component: critical raw materials, parts, sub-assemblies or inputs for each product — BE GRANULAR. For a drone maker this means airframe, motors/ESCs, battery packs, flight controller, cameras/gimbals, GPS/INS, datalink, propellers, ground station, etc.
- supplier: actual supplier clusters, manufacturing companies, or supplier countries for each component (e.g., "China-based motor suppliers", "Israeli camera suppliers", "domestic battery pack assemblers").
- geography: key end-markets / manufacturing geographies.
- customer: key customer types / channels.

Depth rules:
1. Start with 1-2 segments.
2. Under each segment list 2-4 key products.
3. Under each product list 4-10 critical components/parts. Be specific: if it is a car, list battery cells, semiconductors, steel, aluminium, tyres, etc. If it is a drone, list carbon-fibre airframe, BLDC motors, Li-Po batteries, flight controller board, camera module, gimbal, GPS/INS, datalink, etc.
4. Under each component, list 1-3 supplier/geography nodes identifying where it is sourced, which companies make it, and whether it is imported.
5. Add 1-2 customer nodes and 1-2 geography nodes.

Return a MINIMUM of 25 nodes and a MAXIMUM of 40 nodes. Do not be lazy: every product must have 4-8 component children, and every component with importShare > 0.2 should have a supplier child identifying the source country and major manufacturers. Nodes should be economically significant: revenue shares across segments should sum to ~1.0, cost shares across top components should not exceed ~0.7. Use 0.02 as a minimum for any node.

For each node include:
- id, name, type (one of the allowed strings exactly)
- parentId: id of parent, if any
- revenueShare: 0.0–1.0 (for segment/product/customer)
- costShare: 0.0–1.0 (for component/supplier)
- importShare: 0.0–1.0 — share of this input that is imported
- marginSensitivity: 0.0–1.0 — how sensitive company margin is to this node
- geographies: array of key country/region strings (e.g., ["China", "India", "USA"])
- supplierRegions: array of key supplier country/region strings
- customers: array of key customer types
- tags: optional, from ["rural", "export", "imported", "china", "government", "make-in-india"]
- notes: one short phrase with the major manufacturers, import dependency, or source countries
- confidence: "high" | "medium" | "low"

Return ONLY compact valid JSON (no markdown, no code fences, no explanatory text). The JSON must be parseable and complete:
{"symbol":"${input.symbol}","generatedAt":"${new Date().toISOString()}","source":"llm-generated","nodes":[{"id":"switch-uav","name":"Switch UAV","type":"product","parentId":"defence-uavs","revenueShare":0.45,"costShare":0,"importShare":0,"marginSensitivity":0.15,"geographies":["India"],"tags":["government"],"notes":"Fixed-wing military UAV","confidence":"high"}]}`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 10000,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown");
      console.warn("DeepSeek value-chain generation failed:", res.status, body);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content as string | undefined;
    if (!content) {
      console.warn("DeepSeek value-chain generation returned empty content");
      return null;
    }

    const parsed = JSON.parse(content) as ValueChain;
    if (!parsed.symbol || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      console.warn("DeepSeek value-chain generation returned invalid structure");
      return null;
    }

    // Normalise and validate node types
    parsed.nodes = parsed.nodes
      .filter((n) => n.id && n.name && VALUE_CHAIN_NODE_TYPES.includes(n.type))
      .map((n) => ({
        ...n,
        revenueShare: Math.max(0, Math.min(1, n.revenueShare ?? 0)),
        costShare: Math.max(0, Math.min(1, n.costShare ?? 0)),
        importShare: Math.max(0, Math.min(1, n.importShare ?? 0)),
        marginSensitivity: Math.max(0, Math.min(1, n.marginSensitivity ?? 0)),
      }));

    if (parsed.nodes.length === 0) {
      console.warn("DeepSeek value-chain generation returned no valid nodes");
      return null;
    }

    return parsed;
  } catch (e) {
    console.warn("DeepSeek value-chain generation error:", e);
    return null;
  }
}

export interface LLMTagNewsInput {
  symbol: string;
  valueChain: ValueChain;
  headlines: string[];
}

export async function tagNewsToValueChainWithLLM(
  input: LLMTagNewsInput,
): Promise<NewsNodeImpact[] | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const nodeList = input.valueChain.nodes
    .map((n, i) => `${i + 1}. id="${n.id}" | type="${n.type}" | name="${n.name}" | parent="${n.parentId ?? ""}" | revenueShare=${n.revenueShare ?? 0} | costShare=${n.costShare ?? 0} | importShare=${n.importShare ?? 0} | marginSensitivity=${n.marginSensitivity ?? 0} | tags=[${(n.tags ?? []).join(", ")}]`)
    .join("\n");

  const headlineList = input.headlines.map((h, i) => `${i}. ${h}`).join("\n");

  const prompt = `You are a senior equity analyst mapping live news headlines to specific value-chain nodes for ${input.symbol}.

VALUE-CHAIN NODES:
${nodeList}

LIVE HEADLINES (index 0-based):
${headlineList}

For each headline that clearly affects one or more of the above nodes, return an entry with:
- headlineIndex: the 0-based index from the headline list
- nodeId: the exact id of the affected value-chain node
- nodeName: the node name
- costShock, demandShock, supplyRisk, competitiveEffect, policyEffect, reversion, inversion: each a number from -1.0 to +1.0
  * costShock: does this raise (+) or lower (-) the node's input cost?
  * demandShock: does this raise (+) or lower (-) end-demand for the node?
  * supplyRisk: disruption / availability risk (+ = worse, - = better)
  * competitiveEffect: does this advantage (+) or disadvantage (-) this node vs peers?
  * policyEffect: does this help (+) or hurt (-) due to government / RBI action?
  * reversion: +1 if the shock is likely temporary / mean-reverting, -1 if structural / persistent
  * inversion: +1 if the market is under-pricing the good side, -1 if over-pricing the bad side
- reasoning: one precise sentence explaining the link
- confidence: "high" | "medium" | "low"

Only include headlines that clearly map to a node. If a headline is generic or irrelevant, skip it. Do not force a mapping.

Return ONLY valid JSON in this exact shape:
{
  "impacts": [
    {
      "headlineIndex": 0,
      "nodeId": "ev-battery-cells",
      "nodeName": "EV battery cells",
      "costShock": 0.6,
      "demandShock": 0,
      "supplyRisk": 0.4,
      "competitiveEffect": 0,
      "policyEffect": 0,
      "reversion": -0.3,
      "inversion": 0.2,
      "reasoning": "Lithium export restrictions raise battery cell costs for the EV platform.",
      "confidence": "medium"
    }
  ]
}`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 4000,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown");
      console.warn("DeepSeek value-chain news tagging failed:", res.status, body);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content as string | undefined;
    if (!content) {
      console.warn("DeepSeek value-chain news tagging returned empty content");
      return null;
    }

    const parsed = JSON.parse(content) as { impacts: Array<Partial<NewsNodeImpact> & { headlineIndex: number; nodeId: string; nodeName?: string; costShock?: number; demandShock?: number; supplyRisk?: number; competitiveEffect?: number; policyEffect?: number; reversion?: number; inversion?: number; reasoning?: string; confidence?: string }> };
    if (!Array.isArray(parsed.impacts)) {
      console.warn("DeepSeek value-chain news tagging returned invalid structure");
      return null;
    }

    const nodeIds = new Set(input.valueChain.nodes.map((n) => n.id));
    const validHeadlines = input.headlines;

    const rawImpacts = parsed.impacts
      .filter((i) =>
        nodeIds.has(i.nodeId) &&
        i.headlineIndex >= 0 &&
        i.headlineIndex < validHeadlines.length,
      )
      .map((i) => ({
        headline: validHeadlines[i.headlineIndex],
        headlineIndex: i.headlineIndex,
        nodeId: i.nodeId,
        nodeName: i.nodeName,
        vector: {
          costShock: clamp(i.costShock ?? 0, -1, 1),
          demandShock: clamp(i.demandShock ?? 0, -1, 1),
          supplyRisk: clamp(i.supplyRisk ?? 0, -1, 1),
          competitiveEffect: clamp(i.competitiveEffect ?? 0, -1, 1),
          policyEffect: clamp(i.policyEffect ?? 0, -1, 1),
          reversion: clamp(i.reversion ?? 0, -1, 1),
          inversion: clamp(i.inversion ?? 0, -1, 1),
          reasoning: i.reasoning ?? "",
          confidence: (i.confidence as NewsNodeImpact["vector"]["confidence"]) ?? "medium",
        },
      }));

    // Drop mappings that have no directional signal and low confidence
    const impacts: NewsNodeImpact[] = rawImpacts.filter((i) => {
      const v = i.vector;
      const magnitude =
        Math.abs(v.costShock) + Math.abs(v.demandShock) + Math.abs(v.supplyRisk) +
        Math.abs(v.competitiveEffect) + Math.abs(v.policyEffect) +
        Math.abs(v.reversion) + Math.abs(v.inversion);
      return magnitude > 0.05 || v.confidence === "high";
    });

    return impacts;
  } catch (e) {
    console.warn("DeepSeek value-chain news tagging error:", e);
    return null;
  }
}

function clamp(x: number, lo = -1, hi = 1): number {
  return Math.max(lo, Math.min(hi, x));
}
