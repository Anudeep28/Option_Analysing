// Shared Yahoo Finance v8 helpers. Used by /api/market-data/yahoo and by
// the forecast comparison endpoint so they can fetch real prices server-side.

const SYMBOL_MAP: Record<string, string> = {
  RELIANCE: "RELIANCE.NS",
  TCS: "TCS.NS",
  HDFCBANK: "HDFCBANK.NS",
  INFY: "INFY.NS",
  ICICIBANK: "ICICIBANK.NS",
  BHARTIARTL: "BHARTIARTL.NS",
  SBIN: "SBIN.NS",
  NIFTY: "%5ENSEI",
  BANKNIFTY: "%5ENSEBANK",
  NIFTYIT: "%5ECNXIT",
  SPX: "%5EGSPC",
  AAPL: "AAPL",
  GC: "GC=F",
  CL: "CL=F",
  EURUSD: "EURUSD=X",
};

export interface YahooQuoteResult {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  name: string;
  timestamp: string;
}

export interface YahooHistoricalResult {
  dates: string[];
  closes: number[];
  annualizedVolatility: number;
  dividendYield: number;
}

export function toYahooSymbol(originalSymbol: string): string {
  return SYMBOL_MAP[originalSymbol.toUpperCase()] || `${originalSymbol}.NS`;
}

export async function fetchYahooQuote(originalSymbol: string): Promise<YahooQuoteResult> {
  const yahooSymbol = toYahooSymbol(originalSymbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance returned ${res.status}`);
  }

  const data = await res.json();
  const meta = data.chart?.result?.[0]?.meta;

  if (!meta) {
    throw new Error("No data returned for symbol");
  }

  return {
    symbol: originalSymbol,
    lastPrice: meta.regularMarketPrice ?? 0,
    change: (meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? 0),
    changePercent: meta.chartPreviousClose
      ? (((meta.regularMarketPrice ?? 0) - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
      : 0,
    volume: meta.regularMarketVolume ?? 0,
    previousClose: meta.chartPreviousClose ?? 0,
    dayHigh: meta.regularMarketDayHigh ?? meta.regularMarketPrice ?? 0,
    dayLow: meta.regularMarketDayLow ?? meta.regularMarketPrice ?? 0,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
    marketCap: 0,
    name: meta.shortName ?? meta.symbol ?? originalSymbol,
    timestamp: new Date().toISOString(),
  };
}

export async function fetchYahooHistorical(originalSymbol: string): Promise<YahooHistoricalResult> {
  const yahooSymbol = toYahooSymbol(originalSymbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1y`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance returned ${res.status}`);
  }

  const data = await res.json();
  const result = data.chart?.result?.[0];

  if (!result) {
    throw new Error("No historical data returned");
  }

  const timestamps: number[] = result.timestamp || [];
  const closes: number[] = result.indicators?.quote?.[0]?.close || [];
  const dividends = result.events?.dividends || {};

  const validCloses = closes.filter((c: number | null) => c !== null && c !== undefined) as number[];

  const logReturns: number[] = [];
  for (let i = 1; i < validCloses.length; i++) {
    if (validCloses[i] > 0 && validCloses[i - 1] > 0) {
      logReturns.push(Math.log(validCloses[i] / validCloses[i - 1]));
    }
  }

  let annualizedVolatility = 0;
  if (logReturns.length > 1) {
    const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
    const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
    annualizedVolatility = Math.sqrt(variance) * Math.sqrt(252);
  }

  let totalDividends = 0;
  for (const key of Object.keys(dividends)) {
    totalDividends += dividends[key].amount || 0;
  }
  const currentPrice = validCloses[validCloses.length - 1] || 1;
  const dividendYield = totalDividends / currentPrice;

  const dates = timestamps.map((t: number) => new Date(t * 1000).toISOString().slice(0, 10));

  return {
    dates,
    closes: validCloses,
    annualizedVolatility,
    dividendYield,
  };
}
