import type { AssetPreset } from "./types";

// Indian market presets with representative data
// Future integration: NSE India API, BSE StAR MF, Yahoo Finance (India)
export const INDIAN_MARKET_PRESETS: AssetPreset[] = [
  { name: "Reliance Industries", symbol: "RELIANCE", exchange: "NSE", spotPrice: 2950, volatility: 0.25, dividendYield: 0.003 },
  { name: "TCS", symbol: "TCS", exchange: "NSE", spotPrice: 3800, volatility: 0.22, dividendYield: 0.012 },
  { name: "HDFC Bank", symbol: "HDFCBANK", exchange: "NSE", spotPrice: 1650, volatility: 0.20, dividendYield: 0.011 },
  { name: "Infosys", symbol: "INFY", exchange: "NSE", spotPrice: 1550, volatility: 0.24, dividendYield: 0.022 },
  { name: "ICICI Bank", symbol: "ICICIBANK", exchange: "NSE", spotPrice: 1250, volatility: 0.22, dividendYield: 0.008 },
  { name: "Bharti Airtel", symbol: "BHARTIARTL", exchange: "NSE", spotPrice: 1700, volatility: 0.28, dividendYield: 0.004 },
  { name: "State Bank of India", symbol: "SBIN", exchange: "NSE", spotPrice: 820, volatility: 0.30, dividendYield: 0.015 },
  { name: "Nifty 50 Index", symbol: "NIFTY", exchange: "NSE", spotPrice: 23500, volatility: 0.15, dividendYield: 0.013 },
  { name: "Bank Nifty", symbol: "BANKNIFTY", exchange: "NSE", spotPrice: 50500, volatility: 0.18, dividendYield: 0.010 },
  { name: "Nifty IT", symbol: "NIFTYIT", exchange: "NSE", spotPrice: 35000, volatility: 0.22, dividendYield: 0.015 },
];

export const GLOBAL_PRESETS: AssetPreset[] = [
  { name: "S&P 500 Index", symbol: "SPX", exchange: "CBOE", spotPrice: 5200, volatility: 0.15, dividendYield: 0.014 },
  { name: "Apple Inc.", symbol: "AAPL", exchange: "NASDAQ", spotPrice: 195, volatility: 0.25, dividendYield: 0.005 },
  { name: "Gold (COMEX)", symbol: "GC", exchange: "COMEX", spotPrice: 2350, volatility: 0.16, dividendYield: 0 },
  { name: "Crude Oil (WTI)", symbol: "CL", exchange: "NYMEX", spotPrice: 78, volatility: 0.35, dividendYield: 0 },
  { name: "EUR/USD", symbol: "EURUSD", exchange: "FOREX", spotPrice: 1.08, volatility: 0.08, dividendYield: 0.03 },
];

export const ALL_PRESETS = [...INDIAN_MARKET_PRESETS, ...GLOBAL_PRESETS];

// Free Indian market data sources for future integration:
//
// 1. NSE India (https://www.nseindia.com/api/)
//    - Real-time quotes, option chain data, historical data
//    - Free but requires session management (cookies)
//    - Endpoints: /api/option-chain-indices?symbol=NIFTY
//                 /api/option-chain-equities?symbol=RELIANCE
//                 /api/quote-equity?symbol=RELIANCE
//
// 2. BSE India (https://api.bseindia.com/)
//    - Equity quotes, corporate actions
//    - /BseIndiaAPI/api/StockTrading/GetStockPrice?scripCode=500325
//
// 3. Yahoo Finance (via yfinance or direct)
//    - Indian stocks with .NS suffix (e.g., RELIANCE.NS)
//    - Historical data, dividends, options chains for US stocks
//
// 4. RBI Data (https://rbi.org.in/)
//    - Risk-free rate proxy: India 10Y government bond yield
//    - Available as CSV/Excel downloads
//
// 5. Alpha Vantage (https://www.alphavantage.co/)
//    - Free tier: 25 API calls/day
//    - Supports BSE/NSE stocks
//
// To integrate, create API route handlers in /src/app/api/market-data/
// that proxy requests to these sources and normalize the response format.

export interface LiveQuote {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export interface OptionChainEntry {
  strikePrice: number;
  expiryDate: string;
  callOI: number;
  callLTP: number;
  callIV: number;
  putOI: number;
  putLTP: number;
  putIV: number;
}

// --- Live data client functions ---

export interface YahooQuote {
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
  name: string;
  timestamp: string;
}

export interface YahooHistorical {
  dates: string[];
  closes: number[];
  annualizedVolatility: number;
  dividendYield: number;
}

export interface NSEOptionChainResponse {
  symbol: string;
  underlyingValue: number;
  expiryDates: string[];
  data: OptionChainEntry[];
  timestamp: string;
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const res = await fetch(`/api/market-data/yahoo?symbol=${encodeURIComponent(symbol)}&type=quote`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchYahooHistorical(symbol: string): Promise<YahooHistorical> {
  const res = await fetch(`/api/market-data/yahoo?symbol=${encodeURIComponent(symbol)}&type=historical`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchNSEOptionChain(symbol: string): Promise<NSEOptionChainResponse> {
  const res = await fetch(`/api/market-data/nse?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchLiveData(symbol: string): Promise<{
  quote: YahooQuote;
  historical: YahooHistorical;
}> {
  const [quote, historical] = await Promise.all([
    fetchYahooQuote(symbol),
    fetchYahooHistorical(symbol),
  ]);
  return { quote, historical };
}

// --- News Sentiment ---

export interface NewsSentimentArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment: number;
}

export interface NewsSentimentResult {
  symbol: string;
  articles: NewsSentimentArticle[];
  overallSentiment: number;
  sentimentLabel: string;
  articleCount: number;
  suggestedVolatilityAdjustment: number;
  timestamp: string;
}

export async function fetchNewsSentiment(symbol: string): Promise<NewsSentimentResult> {
  const res = await fetch(`/api/market-data/news?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
