import { NextRequest } from "next/server";

// --- DeepSeek AI sentiment scoring ---

interface DeepSeekSentimentResult {
  articles: { index: number; score: number }[];
  overall: number;
  label: string;
  summary: string;
}

async function scoreWithDeepSeek(
  symbol: string,
  headlines: string[],
  apiKey: string,
): Promise<DeepSeekSentimentResult | null> {
  const prompt = `You are a financial news sentiment analyzer for Indian stock markets.
Analyze the following news headlines about ${symbol} and return ONLY a valid JSON object.

Headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Return this exact JSON structure (no other text):
{
  "articles": [{"index": 0, "score": 0.0}, ...],
  "overall": 0.0,
  "label": "Bullish|Mildly Bullish|Neutral|Mildly Bearish|Bearish",
  "summary": "1-2 sentence summary of the news environment for this stock"
}

Rules:
- score range: -1.0 (very bearish) to +1.0 (very bullish), 0 = neutral
- index is 0-based matching the headline list
- overall is a weighted average across all articles
- label must be one of: Bullish, Mildly Bullish, Neutral, Mildly Bearish, Bearish`;

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
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as DeepSeekSentimentResult;
  } catch {
    return null;
  }
}

// Google News RSS — free, no API key needed
// We parse the RSS XML, extract headlines, and run keyword-based sentiment analysis

const POSITIVE_WORDS = new Set([
  "surge", "surges", "rally", "rallies", "gain", "gains", "soar", "soars", "jump", "jumps",
  "rise", "rises", "rising", "climb", "climbs", "boost", "boosts", "profit", "profits",
  "growth", "grow", "grows", "strong", "bullish", "upgrade", "upgrades", "outperform",
  "beat", "beats", "record", "high", "highs", "optimistic", "optimism", "positive",
  "recovery", "recover", "recovers", "upbeat", "expand", "expands", "expansion",
  "buy", "buying", "bought", "demand", "breakout", "momentum", "dividend", "bonus",
  "approval", "approved", "deal", "partnership", "launch", "innovation", "success",
  "exceed", "exceeds", "exceeded", "expectations", "surprise", "upside", "rebound",
  "recommend", "overweight", "accumulate", "target", "raised", "upgrade",
]);

const NEGATIVE_WORDS = new Set([
  "fall", "falls", "falling", "drop", "drops", "decline", "declines", "crash", "crashes",
  "plunge", "plunges", "sink", "sinks", "loss", "losses", "lose", "loses", "bearish",
  "downgrade", "downgrades", "underperform", "miss", "misses", "weak", "weakness",
  "concern", "concerns", "worried", "worry", "risk", "risks", "risky", "volatile",
  "sell", "selling", "sold", "selloff", "warning", "warns", "caution", "fear", "fears",
  "debt", "default", "bankruptcy", "layoff", "layoffs", "cut", "cuts", "slash",
  "slashes", "probe", "investigation", "fraud", "scandal", "penalty", "fine", "fined",
  "downside", "recession", "slowdown", "contraction", "inflation", "overvalued",
  "underweight", "reduce", "target", "lowered", "negative", "pressure", "headwind",
]);

const INTENSITY_WORDS: Record<string, number> = {
  "very": 1.5, "extremely": 2, "significantly": 1.5, "sharply": 1.8,
  "massive": 2, "huge": 1.8, "major": 1.5, "slightly": 0.5, "marginally": 0.5,
  "strongly": 1.5, "dramatically": 2, "heavily": 1.8, "record": 1.8,
};

interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment: number; // -1 to 1
}

interface SentimentResult {
  symbol: string;
  articles: NewsArticle[];
  overallSentiment: number; // -1 to 1
  sentimentLabel: string;
  articleCount: number;
  suggestedVolatilityAdjustment: number; // multiplier, e.g. 1.1 means +10%
  aiPowered: boolean;
  aiSummary?: string;
  timestamp: string;
}

function analyzeSentiment(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
  let score = 0;
  let multiplier = 1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Check for intensity modifier
    if (INTENSITY_WORDS[word]) {
      multiplier = INTENSITY_WORDS[word];
      continue;
    }

    if (POSITIVE_WORDS.has(word)) {
      score += 1 * multiplier;
      multiplier = 1;
    } else if (NEGATIVE_WORDS.has(word)) {
      score -= 1 * multiplier;
      multiplier = 1;
    } else {
      multiplier = 1; // reset if no sentiment word follows modifier
    }
  }

  // Normalize to [-1, 1] using tanh-like scaling
  const normalized = score / (1 + Math.abs(score));
  return Math.max(-1, Math.min(1, normalized));
}

function extractSource(html: string): string {
  // Google News RSS includes source in <source> tag or in the title after " - "
  const dashIdx = html.lastIndexOf(" - ");
  if (dashIdx > 0) {
    return html.slice(dashIdx + 3).trim();
  }
  return "Unknown";
}

function parseRSSItems(xml: string): { title: string; link: string; pubDate: string }[] {
  const items: { title: string; link: string; pubDate: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") || "";
    const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || "";
    const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || "";
    if (title) {
      items.push({ title: title.trim(), link, pubDate });
    }
  }

  return items;
}

function computeVolatilityAdjustment(sentiment: number, articleCount: number): number {
  // Strong sentiment (positive or negative) with many articles = higher uncertainty = higher vol
  // Negative sentiment increases vol more than positive decreases it (asymmetric)
  const magnitude = Math.abs(sentiment);
  const newsIntensity = Math.min(articleCount / 10, 1.5); // cap at 1.5x for lots of news

  if (sentiment < -0.3) {
    // Bad news → vol increases significantly
    return 1 + (magnitude * 0.3 * newsIntensity);
  } else if (sentiment < -0.1) {
    // Mildly negative → slight vol increase
    return 1 + (magnitude * 0.15 * newsIntensity);
  } else if (sentiment > 0.3) {
    // Strong positive → slight vol decrease (markets are calmer on good news)
    return 1 - (magnitude * 0.1 * newsIntensity);
  } else {
    // Neutral → no adjustment
    return 1;
  }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "symbol parameter is required" }, { status: 400 });
  }

  try {
    // Build search query — include exchange context for better results
    const searchQuery = `${symbol} stock`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-IN&gl=IN&ceid=IN:en`;

    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!res.ok) {
      throw new Error(`Google News returned ${res.status}`);
    }

    const xml = await res.text();
    const rssItems = parseRSSItems(xml);

    const rawArticles = rssItems.slice(0, 20).map((item) => {
      const source = extractSource(item.title);
      const cleanTitle = item.title.replace(/ - [^-]+$/, "").trim();
      return { title: cleanTitle, link: item.link, pubDate: item.pubDate, source };
    });

    const headlines = rawArticles.map((a) => a.title);

    // Try DeepSeek AI scoring first, fall back to keyword scoring
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const aiResult = deepseekKey ? await scoreWithDeepSeek(symbol, headlines, deepseekKey) : null;

    const articles: NewsArticle[] = rawArticles.map((a, i) => ({
      ...a,
      sentiment: aiResult
        ? (aiResult.articles.find((x) => x.index === i)?.score ?? analyzeSentiment(a.title))
        : analyzeSentiment(a.title),
    }));

    let overallSentiment: number;
    let sentimentLabel: string;
    let aiSummary: string | undefined;

    if (aiResult) {
      overallSentiment = Math.max(-1, Math.min(1, aiResult.overall));
      sentimentLabel = aiResult.label;
      aiSummary = aiResult.summary;
    } else {
      // Weighted average: recent articles matter more
      let totalWeight = 0;
      let weightedSum = 0;
      articles.forEach((a, i) => {
        const weight = 1 / (1 + i * 0.15);
        weightedSum += a.sentiment * weight;
        totalWeight += weight;
      });
      overallSentiment = totalWeight > 0 ? weightedSum / totalWeight : 0;
      sentimentLabel = overallSentiment > 0.2 ? "Bullish"
        : overallSentiment > 0.05 ? "Mildly Bullish"
        : overallSentiment < -0.2 ? "Bearish"
        : overallSentiment < -0.05 ? "Mildly Bearish"
        : "Neutral";
    }

    const result: SentimentResult = {
      symbol: symbol.toUpperCase(),
      articles,
      overallSentiment,
      sentimentLabel,
      articleCount: articles.length,
      suggestedVolatilityAdjustment: computeVolatilityAdjustment(overallSentiment, articles.length),
      aiPowered: !!aiResult,
      aiSummary,
      timestamp: new Date().toISOString(),
    };

    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch news";
    return Response.json({ error: msg }, { status: 502 });
  }
}
