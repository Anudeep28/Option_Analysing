import { NextRequest } from "next/server";

// NSE India API — free, requires session/cookie management
// We first hit the main page to get cookies, then use them for API calls

const NSE_BASE = "https://www.nseindia.com";
const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Referer": "https://www.nseindia.com/",
};

// Index symbols that use the indices endpoint
const INDEX_SYMBOLS = new Set(["NIFTY", "BANKNIFTY", "NIFTYIT", "NIFTYNEXT50", "NIFTY50"]);

interface OptionChainEntry {
  strikePrice: number;
  expiryDate: string;
  callOI: number;
  callLTP: number;
  callIV: number;
  callVolume: number;
  callBidPrice: number;
  callAskPrice: number;
  putOI: number;
  putLTP: number;
  putIV: number;
  putVolume: number;
  putBidPrice: number;
  putAskPrice: number;
}

interface NSEOptionChainResponse {
  symbol: string;
  underlyingValue: number;
  expiryDates: string[];
  data: OptionChainEntry[];
  timestamp: string;
}

async function getNSECookies(): Promise<string> {
  const res = await fetch(NSE_BASE, {
    headers: NSE_HEADERS,
    redirect: "follow",
  });

  const setCookieHeaders = res.headers.getSetCookie?.() || [];
  const cookies = setCookieHeaders
    .map((c: string) => c.split(";")[0])
    .join("; ");

  return cookies;
}

async function fetchNSEAPI(path: string, cookies: string): Promise<unknown> {
  const res = await fetch(`${NSE_BASE}${path}`, {
    headers: {
      ...NSE_HEADERS,
      Cookie: cookies,
    },
  });

  if (!res.ok) {
    throw new Error(`NSE API returned ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

function parseOptionChain(data: Record<string, unknown>): NSEOptionChainResponse {
  const records = data.records as Record<string, unknown>;
  const filtered = data.filtered as Record<string, unknown>;
  const rawData = (filtered?.data || records?.data) as Array<Record<string, unknown>>;
  const expiryDates = (records?.expiryDates || []) as string[];
  const underlyingValue = (records?.underlyingValue || (filtered as Record<string, unknown>)?.underlyingValue || 0) as number;
  const strikePrices = (records?.strikePrices || []) as number[];

  const entries: OptionChainEntry[] = [];

  if (Array.isArray(rawData)) {
    for (const row of rawData) {
      const ce = (row.CE || {}) as Record<string, unknown>;
      const pe = (row.PE || {}) as Record<string, unknown>;

      entries.push({
        strikePrice: (row.strikePrice || ce.strikePrice || pe.strikePrice || 0) as number,
        expiryDate: (ce.expiryDate || pe.expiryDate || "") as string,
        callOI: (ce.openInterest || 0) as number,
        callLTP: (ce.lastPrice || 0) as number,
        callIV: (ce.impliedVolatility || 0) as number,
        callVolume: (ce.totalTradedVolume || 0) as number,
        callBidPrice: (ce.bidprice || 0) as number,
        callAskPrice: (ce.askPrice || 0) as number,
        putOI: (pe.openInterest || 0) as number,
        putLTP: (pe.lastPrice || 0) as number,
        putIV: (pe.impliedVolatility || 0) as number,
        putVolume: (pe.totalTradedVolume || 0) as number,
        putBidPrice: (pe.bidprice || 0) as number,
        putAskPrice: (pe.askPrice || 0) as number,
      });
    }
  }

  return {
    symbol: (data.symbol || (records as Record<string, unknown>)?.symbol || "") as string,
    underlyingValue,
    expiryDates,
    data: entries,
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "symbol parameter is required" }, { status: 400 });
  }

  try {
    const cookies = await getNSECookies();

    const isIndex = INDEX_SYMBOLS.has(symbol.toUpperCase());
    const path = isIndex
      ? `/api/option-chain-indices?symbol=${encodeURIComponent(symbol.toUpperCase())}`
      : `/api/option-chain-equities?symbol=${encodeURIComponent(symbol.toUpperCase())}`;

    const data = await fetchNSEAPI(path, cookies) as Record<string, unknown>;
    const parsed = parseOptionChain(data);

    return Response.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch NSE data";
    return Response.json({ error: msg }, { status: 502 });
  }
}
