import { NextRequest } from "next/server";
import {
  computeMacroImpact, computeLatticework, getSector, SECTOR_LABELS,
  EVENT_DESCRIPTIONS, type MacroImpactResult, type MacroEventType,
} from "@/lib/macro-impact";
import {
  computeLatticeworkWithLLM, enhanceMacroWithLLM,
  type LLMLatticeworkInput, type LLMMacroInput,
} from "@/lib/llm";

function parseRSSItems(xml: string): { title: string; pubDate: string }[] {
  const items: { title: string; pubDate: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")?.trim() ?? "";
    const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    if (title) items.push({ title: title.replace(/ - [^-]+$/, "").trim(), pubDate });
  }
  return items;
}

const MACRO_QUERIES = [
  "global markets oil price war geopolitical",
  "US Federal Reserve interest rate economy",
  "Iran conflict crude oil sanctions",
  "global recession inflation central bank",
  "China economy slowdown GDP",
];

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "NIFTY";
  const spotPrice = parseFloat(request.nextUrl.searchParams.get("spot") ?? "0") || undefined;

  try {
    const query1 = MACRO_QUERIES[Math.floor(Math.random() * 3)];
    const query2 = "stock market economy India global";

    const fetchRSS = async (q: string) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        next: { revalidate: 600 },
      });
      if (!res.ok) return [];
      return parseRSSItems(await res.text()).slice(0, 15);
    };

    const [items1, items2] = await Promise.all([fetchRSS(query1), fetchRSS(query2)]);
    const allItems = [...items1, ...items2];

    if (allItems.length === 0) {
      return Response.json({
        events: [], primaryEvent: null, topEvents: [], latticework: null,
        sectorImpact: { direction: "neutral", score: 0, reason: "No headlines fetched", chain: "—" },
        macroScore: 0, macroSignal: "neutral",
        summary: "No macro headlines available.",
      } satisfies MacroImpactResult);
    }

    // Run the rule-based engine to classify events and determine the primary event type.
    // We use computeMacroImpact for event detection, ranking, and aggregation logic —
    // then replace the primary event's latticework with a fully LLM-reasoned one.
    const result = computeMacroImpact(allItems, symbol);
    const sector = getSector(symbol);
    const headlines = allItems.map((i) => i.title);

    // ── Primary event: ask DeepSeek to reason from scratch ──────────────────
    const primaryEventImpact = result.topEvents[0];
    if (primaryEventImpact) {
      const eventDesc = EVENT_DESCRIPTIONS[primaryEventImpact.event.type as MacroEventType];
      const llmLatticeworkInput: LLMLatticeworkInput = {
        symbol,
        sector: SECTOR_LABELS[sector],
        spotPrice,
        headlines,
        eventName: eventDesc.name,
        eventChannel: eventDesc.channel,
      };

      // Run LLM latticework + narrative enhancement in parallel.
      // If LLM latticework fails, we keep the rule-based one already in result.
      const [llmLatticework, llm] = await Promise.all([
        computeLatticeworkWithLLM(llmLatticeworkInput),
        enhanceMacroWithLLM({
          symbol,
          sector: SECTOR_LABELS[sector],
          macroScore: result.macroScore,
          macroSignal: result.macroSignal,
          topEvents: result.topEvents.map((te) => ({
            rank: te.rank,
            type: te.event.type,
            headline: te.event.headline,
            severity: te.event.severity,
            netScore: te.latticework.netScore,
            direction: te.latticework.direction,
            narrativeSummary: te.latticework.narrativeSummary,
            transmissionChain: te.chain,
          })),
        } satisfies LLMMacroInput),
      ]);

      if (llmLatticework) {
        // Replace the primary event's latticework (and the root latticework) with the LLM version
        result.topEvents[0].latticework = llmLatticework;
        result.latticework = llmLatticework;

        // Recompute the aggregate macroScore now that the primary latticework has changed.
        // Primary event gets 60% weight; secondary events share 40%.
        const n = result.topEvents.length;
        result.macroScore = Math.max(-100, Math.min(100,
          result.topEvents.reduce((sum, te, idx) => {
            const w = idx === 0 ? 0.6 : n > 1 ? 0.4 / (n - 1) : 0;
            return sum + te.latticework.netScore * w;
          }, 0),
        ));
        result.macroSignal = llmLatticework.direction;

        // Secondary events (rank 2, 3) keep their rule-based latticeworks —
        // those are lower-impact and calling LLM for each would add latency.
      }

      if (llm) {
        return Response.json({ ...result, llm });
      }
    }

    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch macro news";
    return Response.json({ error: msg }, { status: 502 });
  }
}
