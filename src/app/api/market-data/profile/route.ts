import { NextRequest } from "next/server";
import type { CompanyProfile } from "@/lib/forecast/fundamentals";

// Maps app symbols to Yahoo tickers (mirrors the yahoo quote route).
const SYMBOL_MAP: Record<string, string> = {
  RELIANCE: "RELIANCE.NS",
  TCS: "TCS.NS",
  HDFCBANK: "HDFCBANK.NS",
  INFY: "INFY.NS",
  ICICIBANK: "ICICIBANK.NS",
  BHARTIARTL: "BHARTIARTL.NS",
  SBIN: "SBIN.NS",
  AAPL: "AAPL",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Cache the Yahoo auth (cookie + crumb) at module scope to avoid re-fetching
// on every request. quoteSummary requires a valid crumb tied to the cookie.
let cachedAuth: { cookie: string; crumb: string; ts: number } | null = null;
const AUTH_TTL = 30 * 60 * 1000; // 30 min

async function getYahooAuth(): Promise<{ cookie: string; crumb: string }> {
  if (cachedAuth && Date.now() - cachedAuth.ts < AUTH_TTL) {
    return { cookie: cachedAuth.cookie, crumb: cachedAuth.crumb };
  }

  // 1. Hit the consent/landing page to receive a session cookie.
  const cookieRes = await fetch("https://fc.yahoo.com/", {
    headers: { "User-Agent": UA },
  });
  const setCookie = cookieRes.headers.get("set-cookie") ?? "";
  // Keep just the name=value pairs.
  const cookie = setCookie
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

  if (!cookie) throw new Error("Could not obtain Yahoo session cookie");

  // 2. Exchange the cookie for a crumb.
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.includes("<")) throw new Error("Could not obtain Yahoo crumb");

  cachedAuth = { cookie, crumb, ts: Date.now() };
  return { cookie, crumb };
}

function raw(node: unknown): number | null {
  if (node && typeof node === "object" && "raw" in node) {
    const v = (node as { raw: unknown }).raw;
    return typeof v === "number" && isFinite(v) ? v : null;
  }
  return typeof node === "number" && isFinite(node) ? node : null;
}

function str(node: unknown): string | null {
  return typeof node === "string" && node.trim() ? node.trim() : null;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return Response.json({ error: "symbol parameter is required" }, { status: 400 });
  }
  const yahooSymbol = SYMBOL_MAP[symbol.toUpperCase()] || `${symbol}.NS`;

  try {
    const { cookie, crumb } = await getYahooAuth();
    const modules = [
      "assetProfile", "summaryProfile", "financialData",
      "defaultKeyStatistics", "calendarEvents", "price", "summaryDetail",
    ].join(",");
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

    const res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: cookie },
      next: { revalidate: 3600 }, // fundamentals change slowly — cache 1h
    });

    if (res.status === 401 || res.status === 403) {
      cachedAuth = null; // force re-auth next time
      throw new Error("Yahoo auth expired — retry");
    }
    if (!res.ok) throw new Error(`Yahoo quoteSummary returned ${res.status}`);

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) throw new Error("No fundamental data returned for symbol");

    const assetProfile = result.assetProfile ?? result.summaryProfile ?? {};
    const financialData = result.financialData ?? {};
    const keyStats = result.defaultKeyStatistics ?? {};
    const summaryDetail = result.summaryDetail ?? {};
    const price = result.price ?? {};
    const calendar = result.calendarEvents ?? {};

    // Next earnings date (first future date in the array).
    let nextEarningsDate: string | null = null;
    const earningsDates = calendar?.earnings?.earningsDate;
    if (Array.isArray(earningsDates) && earningsDates.length > 0) {
      const epoch = raw(earningsDates[0]);
      if (epoch) nextEarningsDate = new Date(epoch * 1000).toISOString();
    }

    const profile: CompanyProfile = {
      symbol: symbol.toUpperCase(),
      name: str(price.longName) ?? str(price.shortName) ?? symbol.toUpperCase(),
      sector: str(assetProfile.sector),
      industry: str(assetProfile.industry),
      longBusinessSummary: str(assetProfile.longBusinessSummary),
      country: str(assetProfile.country),
      employees: raw(assetProfile.fullTimeEmployees),
      marketCap: raw(price.marketCap) ?? raw(summaryDetail.marketCap),
      trailingPE: raw(summaryDetail.trailingPE) ?? raw(keyStats.trailingPE),
      forwardPE: raw(summaryDetail.forwardPE) ?? raw(keyStats.forwardPE),
      priceToBook: raw(keyStats.priceToBook),
      profitMargins: raw(financialData.profitMargins) ?? raw(keyStats.profitMargins),
      returnOnEquity: raw(financialData.returnOnEquity),
      revenueGrowth: raw(financialData.revenueGrowth),
      earningsGrowth: raw(financialData.earningsGrowth) ?? raw(keyStats.earningsQuarterlyGrowth),
      debtToEquity: raw(financialData.debtToEquity),
      recommendationKey: str(financialData.recommendationKey),
      targetMeanPrice: raw(financialData.targetMeanPrice),
      currentPrice: raw(financialData.currentPrice) ?? raw(price.regularMarketPrice),
      nextEarningsDate,
      fetchedAt: new Date().toISOString(),
    };

    return Response.json(profile);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch company profile";
    return Response.json({ error: msg }, { status: 502 });
  }
}
