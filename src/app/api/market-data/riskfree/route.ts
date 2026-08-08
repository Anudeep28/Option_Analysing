import { NextRequest } from "next/server";

// Live risk-free rate benchmark.
//
// US: Yahoo Finance ^IRX (13-Week Treasury Bill discount rate) — free, no key.
// India: there is no free, no-key, live 10Y G-Sec yield feed reachable from
// this app (RBI does not publish a JSON API; FRED's India series requires
// network access this deployment does not have). We are honest about that
// gap instead of inventing a number — India requests return unavailable and
// the caller should fall back to the documented static RBI repo-rate proxy.

interface RiskFreeRateResult {
  rate: number | null;   // percent, e.g. 5.25
  source: string | null; // human-readable source label
  live: boolean;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  const market = (request.nextUrl.searchParams.get("market") || "US").toUpperCase();

  if (market === "IN") {
    // No reliable free live source available — caller falls back to the
    // static RBI repo-rate assumption documented in the UI.
    return Response.json({
      rate: null,
      source: null,
      live: false,
      timestamp: new Date().toISOString(),
    } satisfies RiskFreeRateResult);
  }

  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EIRX?interval=1d&range=5d",
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);

    const data = await res.json();
    const rate = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof rate !== "number" || rate <= 0) throw new Error("No rate in response");

    return Response.json({
      rate,
      source: "US 13-Week Treasury Bill (^IRX)",
      live: true,
      timestamp: new Date().toISOString(),
    } satisfies RiskFreeRateResult);
  } catch {
    return Response.json({
      rate: null,
      source: null,
      live: false,
      timestamp: new Date().toISOString(),
    } satisfies RiskFreeRateResult);
  }
}
