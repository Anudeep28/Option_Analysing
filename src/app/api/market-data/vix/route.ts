import { NextRequest } from "next/server";

// Fetch India VIX from Yahoo Finance (^INDIAVIX)
export async function GET(request: NextRequest) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EINDIAVIX?interval=1d&range=1d`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance returned ${res.status}`);
    }

    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta;

    if (!meta) {
      throw new Error("No VIX data returned");
    }

    return Response.json({
      vixLevel: meta.regularMarketPrice ?? 0,
      previousClose: meta.chartPreviousClose ?? 0,
      change: (meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? 0),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch VIX";
    return Response.json({ error: msg }, { status: 502 });
  }
}
