import { NextRequest } from "next/server";
import { getSector, SECTOR_LABELS, computeMacroImpact, type MacroImpactResult, type LatticeworkAnalysis } from "@/lib/macro-impact";
import {
  computeLatticeworkWithLLM,
  generateValueChainWithLLM,
  tagNewsToValueChainWithLLM,
  type LLMLatticeworkInput,
} from "@/lib/llm";
import {
  getCachedValueChain,
  setCachedValueChain,
  aggregateNodeImpacts,
  mergeLatticeworkWithComponentAnalysis,
  buildLatticeworkFromComponentAnalysis,
  type NewsNodeImpact,
  type ValueChain,
} from "@/lib/value-chain";

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

type NewsScope = "Global" | "India" | "Company";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "NIFTY";
  const spotPrice = parseFloat(request.nextUrl.searchParams.get("spot") ?? "0") || undefined;

  try {
    const fetchRSS = async (query: string, scope: NewsScope, locale: "IN" | "US") => {
      const isIndia = locale === "IN";
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-${locale}&gl=${locale}&ceid=${locale}:en`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        next: { revalidate: 300 },
      });
      if (!res.ok) return [];
      return parseRSSItems(await res.text())
        .slice(0, isIndia ? 10 : 8)
        .map((item) => ({ ...item, scope }));
    };

    const [globalItems, indiaItems, companyItems] = await Promise.all([
      fetchRSS("top market moving global business news", "Global", "US"),
      fetchRSS("top India stock market economy business news", "India", "IN"),
      fetchRSS(`${symbol} stock company news`, "Company", "IN"),
    ]);
    console.warn("Macro headlines fetched:", {
      global: globalItems.length,
      india: indiaItems.length,
      company: companyItems.length,
    });
    const seen = new Set<string>();
    const headlines = [...globalItems, ...indiaItems, ...companyItems]
      .filter((item) => {
        const key = item.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => `[${item.scope}] ${item.title}`);

    if (headlines.length === 0) {
      return Response.json({
        events: [], primaryEvent: null, topEvents: [], latticework: null,
        sectorImpact: { direction: "neutral", score: 0, reason: "No headlines fetched", chain: "—" },
        macroScore: 0, macroSignal: "neutral",
        summary: "No live global, India, or company headlines are available.",
      } satisfies MacroImpactResult);
    }

    const sector = getSector(symbol);

    // ─── Option A: stock-specific value chain + component-level news tagging ───
    // The value chain is slow-moving, so cache it per symbol. News tagging is
    // per request and runs in parallel with the main latticework LLM.
    let valueChain: ValueChain | undefined = getCachedValueChain(symbol);
    if (!valueChain) {
      valueChain = await generateValueChainWithLLM({
        symbol,
        sector: SECTOR_LABELS[sector],
        spotPrice,
      }) ?? undefined;
      if (valueChain) setCachedValueChain(symbol, valueChain);
    }

    const latticeworkInput: LLMLatticeworkInput = {
      symbol,
      sector: SECTOR_LABELS[sector],
      spotPrice,
      headlines,
      eventName: "Live global, India, and company news synthesis",
      eventChannel: "Assess the combined direct, second-order, and market-expectation effects from the labelled live headlines; do not force them into predefined event categories.",
    };

    let latticework: LatticeworkAnalysis | null = null;
    let componentImpacts: NewsNodeImpact[] | undefined;

    if (valueChain) {
      const [latticeworkResult, impactsResult] = await Promise.all([
        computeLatticeworkWithLLM(latticeworkInput),
        tagNewsToValueChainWithLLM({ symbol, valueChain, headlines }),
      ]);
      latticework = latticeworkResult;
      componentImpacts = impactsResult ?? undefined;

      if (componentImpacts && componentImpacts.length > 0) {
        const aggregation = aggregateNodeImpacts(valueChain, componentImpacts);
        if (latticework) {
          latticework = mergeLatticeworkWithComponentAnalysis(latticework, aggregation, 0.5);
        } else {
          latticework = buildLatticeworkFromComponentAnalysis(aggregation);
        }
      }
    } else {
      latticework = await computeLatticeworkWithLLM(latticeworkInput);
    }

    if (!latticework) {
      console.warn("computeLatticeworkWithLLM returned null for", symbol, "falling back to rule-based macro impact");
      const rawHeadlines = [...globalItems, ...indiaItems, ...companyItems].map((item) => ({
        title: item.title,
        pubDate: item.pubDate,
      }));
      const fallback = computeMacroImpact(rawHeadlines, symbol);
      if (fallback.events.length > 0) {
        return Response.json({
          ...fallback,
          valueChain,
          componentImpacts,
          llm: {
            summary: "Live-news synthesis is using the deterministic rule-based latticework because the DeepSeek API key is not configured or the LLM call failed.",
            inversionSignal: fallback.latticework?.inversionSignal ?? "",
            model: "rule-based fallback",
          },
        } satisfies MacroImpactResult);
      }
      return Response.json({
        events: [], primaryEvent: null, topEvents: [], latticework: null,
        sectorImpact: { direction: "neutral", score: 0, reason: "News analysis is unavailable.", chain: "—" },
        macroScore: 0, macroSignal: "neutral",
        summary: "Live news was fetched, but dynamic mental-model analysis is unavailable.",
        valueChain,
        componentImpacts,
      } satisfies MacroImpactResult);
    }

    const event = {
      type: "none" as const,
      severity: "low" as const,
      headline: `Live global, India, and ${symbol} news synthesis`,
      detected: new Date().toISOString(),
    };
    const chain = "Global news → India market context → Company-specific developments → Value-chain nodes → P&L impact → Price expectations";
    const macroScore = latticework.netScore;
    const macroSignal = latticework.direction;

    return Response.json({
      events: [event],
      primaryEvent: event,
      topEvents: [{ event, latticework, chain, rank: 1 }],
      latticework,
      sectorImpact: {
        direction: macroSignal === "mixed" ? "neutral" : macroSignal,
        score: macroScore,
        reason: latticework.narrativeSummary,
        chain,
      },
      macroScore,
      macroSignal,
      summary: latticework.narrativeSummary,
      valueChain,
      componentImpacts,
    } satisfies MacroImpactResult);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch macro news";
    return Response.json({ error: msg }, { status: 502 });
  }
}
