// ============================================================
// Global Macro Impact Engine — Munger Latticework Edition
// ============================================================
import type { NewsNodeImpact, ValueChain } from "./value-chain";

export type MacroEventType =
  | "oil_spike" | "oil_drop" | "rate_hike" | "rate_cut"
  | "geopolitical_risk" | "currency_inr_fall" | "currency_inr_rise"
  | "global_recession" | "china_slowdown" | "us_market_crash"
  | "global_rally" | "inflation_spike" | "none";

export type SectorName =
  | "it_services" | "banking" | "oil_gas" | "airlines"
  | "pharma" | "metals" | "auto" | "fmcg"
  | "realestate" | "defence" | "index" | "other";

export type MentalModelName =
  | "mechanics" | "incentives" | "feedback_loop"
  | "competitive" | "mean_reversion" | "inversion"
  | "fiscal_policy" | "liquidity_flows" | "rural_demand";

export interface MacroEvent {
  type: MacroEventType;
  severity: "high" | "medium" | "low";
  headline: string;
  detected: string;
}

export interface MentalModelLayer {
  model: MentalModelName;
  label: string;
  score: number;
  direction: "bullish" | "bearish" | "neutral";
  reasoning: string;
  weight: number;
}

export interface LatticeworkAnalysis {
  layers: MentalModelLayer[];
  rawScore: number;
  netScore: number;
  direction: "bullish" | "bearish" | "neutral" | "mixed";
  narrativeSummary: string;
  durationOutlook: string;
  optionsImplication: string;
  inversionSignal: string;
}

export interface EventImpact {
  event: MacroEvent;
  latticework: LatticeworkAnalysis;
  chain: string;
  rank: number;
}

export interface MacroImpactResult {
  events: MacroEvent[];
  primaryEvent: MacroEvent | null;
  topEvents: EventImpact[];
  latticework: LatticeworkAnalysis | null;
  sectorImpact: SectorImpact;
  macroScore: number;
  macroSignal: "bullish" | "bearish" | "neutral" | "mixed";
  summary: string;
  llm?: {
    summary: string;
    inversionSignal: string;
    model: string;
  };
  // Value-chain decomposition and per-node news impacts (Option A)
  valueChain?: ValueChain;
  componentImpacts?: NewsNodeImpact[];
}

export interface SectorImpact {
  direction: "bullish" | "bearish" | "neutral";
  score: number;
  reason: string;
  chain: string;
}

// ─── Sector Map ───────────────────────────────────────────────
const SECTOR_MAP: Record<string, SectorName> = {
  TCS: "it_services", INFY: "it_services", WIPRO: "it_services",
  HCLTECH: "it_services", TECHM: "it_services", LTIM: "it_services", NIFTYIT: "it_services",
  HDFCBANK: "banking", ICICIBANK: "banking", SBIN: "banking",
  KOTAKBANK: "banking", AXISBANK: "banking", BANKNIFTY: "banking",
  INDUSINDBK: "banking", FEDERALBNK: "banking",
  RELIANCE: "oil_gas", ONGC: "oil_gas", OIL: "oil_gas",
  BPCL: "oil_gas", IOC: "oil_gas", GAIL: "oil_gas", MGL: "oil_gas",
  INDIGO: "airlines", SPICEJET: "airlines",
  SUNPHARMA: "pharma", DRREDDY: "pharma", CIPLA: "pharma",
  DIVISLAB: "pharma", AUROPHARMA: "pharma",
  TATASTEEL: "metals", HINDALCO: "metals", JSWSTEEL: "metals",
  COALINDIA: "metals", NMDC: "metals", SAIL: "metals",
  MARUTI: "auto", TATAMOTORS: "auto", M_M: "auto",
  BAJAJ_AUTO: "auto", HEROMOTOCO: "auto", EICHERMOT: "auto",
  HINDUNILVR: "fmcg", ITC: "fmcg", NESTLEIND: "fmcg",
  BRITANNIA: "fmcg", DABUR: "fmcg", MARICO: "fmcg",
  DLF: "realestate", GODREJPROP: "realestate", PRESTIGE: "realestate",
  HAL: "defence", BEL: "defence", BHEL: "defence",
  NIFTY: "index", FINNIFTY: "index", MIDCPNIFTY: "index",
  AAPL: "it_services", MSFT: "it_services", GOOGL: "it_services", SPX: "index",
};

export function getSector(symbol: string): SectorName {
  const clean = symbol.replace(/[.\-]/g, "_").toUpperCase();
  return SECTOR_MAP[clean] ?? "other";
}

// ─── Helpers ──────────────────────────────────────────────────
export function L(
  model: MentalModelName, label: string,
  score: number, weight: number, reasoning: string,
): MentalModelLayer {
  return { model, label, score, weight, reasoning,
    direction: score > 5 ? "bullish" : score < -5 ? "bearish" : "neutral" };
}

export function pick<T>(
  map: Partial<Record<SectorName | "other", T>>, s: SectorName,
): T {
  return (map[s] ?? map["other"]) as T;
}

export const EVENT_META: Record<MacroEventType, { duration: string; optionsImpl: string }> = {
  oil_spike:         { duration: "Medium-term (2-6 weeks) unless conflict persists",
    optionsImpl: "IV spikes on importers. Buy puts while IV is rising; avoid selling premium into the spike." },
  oil_drop:          { duration: "Short-to-medium term (1-3 weeks)",
    optionsImpl: "IV falls. Sell premium on importers. Buy calls on airlines/FMCG at depressed IV." },
  rate_hike:         { duration: "Persistent repricing - weeks to months",
    optionsImpl: "Real estate/banking IV spikes. Sell calls into the spike; long puts on real estate." },
  rate_cut:          { duration: "Persistent re-rating tailwind - weeks to months",
    optionsImpl: "IV compresses as market rallies. Buy calls before IV falls. Bull call spreads preferred." },
  geopolitical_risk: { duration: "Short spike (3-7 days) then ~60% mean reversion historically",
    optionsImpl: "Market-wide IV spike. Buy straddles on indices at open; exit within 3-5 days." },
  currency_inr_fall: { duration: "Medium-term (2-4 weeks) unless macro driver reverses",
    optionsImpl: "IT/pharma calls cheap post-move. OMC puts viable. Watch INR stabilisation as exit signal." },
  currency_inr_rise: { duration: "Short-to-medium term",
    optionsImpl: "IT/pharma headwind - reduce calls. OMC/auto calls justified. IV broadly suppressed." },
  global_recession:  { duration: "Long-term regime change (months to years)",
    optionsImpl: "Sustained high IV. Buy longer-dated puts on cyclicals. Long FMCG/pharma calls as defensive rotation." },
  china_slowdown:    { duration: "Medium-to-long term (months)",
    optionsImpl: "Metals IV spikes. Buy puts on metal stocks. Pharma/IT calls relatively safe." },
  us_market_crash:   { duration: "Short-to-medium term (1-4 weeks); India often decouples after initial shock",
    optionsImpl: "VIX spikes - buy straddles on Nifty. Watch for India decoupling within 5-7 sessions." },
  global_rally:      { duration: "Short-to-medium term (1-3 weeks)",
    optionsImpl: "IV compresses. Sell premium. Bull call spreads on IT/metals/banking." },
  inflation_spike:   { duration: "Persistent until RBI policy response - weeks to months",
    optionsImpl: "Rate hike risk dominates. Avoid real estate longs. Bear put spreads on FMCG viable." },
  none:              { duration: "N/A", optionsImpl: "No macro event - focus on technicals and stock-specific signals." },
};

// ─── Event Classifier ─────────────────────────────────────────
interface RawHeadline { title: string; pubDate: string }

const EVENT_KEYWORDS: { type: MacroEventType; keywords: string[]; severity: "high" | "medium" | "low" }[] = [
  { type: "geopolitical_risk", severity: "high",   keywords: ["war", "attack", "strike", "missile", "iran", "conflict", "tension", "invasion", "military", "bomb", "explosion", "sanction", "threat", "escalat", "houthi", "naval", "hostage"] },
  { type: "oil_spike",         severity: "high",   keywords: ["oil surges", "crude surges", "oil spikes", "oil rally", "oil soars", "crude rises", "brent rises", "wti rises", "oil above", "oil price surge", "supply cut", "opec cut", "opec reduces"] },
  { type: "oil_drop",          severity: "medium", keywords: ["oil falls", "crude falls", "oil drops", "oil plunge", "oil decline", "brent falls", "wti falls", "oil below", "opec hike", "opec increases output"] },
  { type: "rate_hike",         severity: "high",   keywords: ["rate hike", "raises rate", "fed hike", "rbi hike", "interest rate increase", "hawkish", "tightening", "rate raised"] },
  { type: "rate_cut",          severity: "high",   keywords: ["rate cut", "rate cuts", "fed cut", "rbi cut", "interest rate cut", "dovish", "easing", "rate lowered", "rate reduced"] },
  { type: "us_market_crash",   severity: "high",   keywords: ["dow crash", "nasdaq crash", "market crash", "dow plunge", "wall street crash", "circuit breaker", "market meltdown"] },
  { type: "global_recession",  severity: "high",   keywords: ["recession", "economic contraction", "gdp shrinks", "gdp negative", "depression", "economic crisis", "global slowdown"] },
  { type: "china_slowdown",    severity: "medium", keywords: ["china slowdown", "china gdp miss", "china economy slows", "china contraction", "pmi china", "chinese economy falls"] },
  { type: "global_rally",      severity: "medium", keywords: ["market rally", "stocks surge", "bull market", "risk-on", "global stocks rise", "dow rises", "nasdaq hits record", "s&p record high"] },
  { type: "inflation_spike",   severity: "medium", keywords: ["inflation surge", "cpi rises", "inflation hits", "inflation high", "price surge", "inflation above", "hot inflation", "core inflation rises"] },
  { type: "currency_inr_fall", severity: "medium", keywords: ["rupee falls", "rupee weakens", "inr falls", "rupee hits low", "rupee depreciation", "dollar strengthens against rupee"] },
  { type: "currency_inr_rise", severity: "low",    keywords: ["rupee rises", "rupee strengthens", "inr rises", "rupee gains", "rupee appreciation"] },
];

function classifyHeadlines(headlines: RawHeadline[]): MacroEvent[] {
  const events: MacroEvent[] = [];
  for (const h of headlines) {
    const lower = h.title.toLowerCase();
    for (const { type, keywords, severity } of EVENT_KEYWORDS) {
      if (keywords.some((kw) => lower.includes(kw))) {
        events.push({ type, severity, headline: h.title, detected: h.pubDate });
        break;
      }
    }
  }
  return events;
}

// ─── Latticework Layer Data ────────────────────────────────────

// Score matrices for each mental model across sectors. Values are raw
// sentiment points (-100 to +100). computeLatticework applies these weights:
// mechanics 0.30, incentives 0.20, feedback_loop 0.20,
// competitive 0.15, mean_reversion 0.10, inversion 0.05

const SCORES: Record<MacroEventType, Record<string, Partial<Record<SectorName | "other", number>>>> = {
  oil_spike: {
    mechanics:    { oil_gas:55,airlines:-68,auto:-22,fmcg:-18,it_services:8,metals:-20,pharma:0,defence:30,banking:-12,realestate:-10,index:-22,other:-15 },
    incentives:   { oil_gas:18,airlines:-14,auto:-8,fmcg:-7,it_services:2,metals:-4,pharma:2,defence:15,banking:-5,realestate:-5,index:-8,other:-7 },
    feedback_loop:{ oil_gas:8,airlines:-12,auto:-7,fmcg:-5,it_services:5,metals:-5,pharma:3,defence:5,banking:-5,realestate:-8,index:-10,other:-6 },
    competitive:  { oil_gas:10,airlines:-4,auto:-4,fmcg:-3,it_services:2,metals:3,pharma:2,defence:5,banking:-3,realestate:-3,index:-5,other:-3 },
    mean_reversion:{ airlines:18,auto:8,fmcg:6,banking:5,oil_gas:-15,defence:-8,index:10,other:5 },
    inversion:    { oil_gas:10,airlines:-5,auto:-5,defence:5,other:0 },
  },
  oil_drop: {
    mechanics:    { oil_gas:-50,airlines:65,auto:22,fmcg:18,it_services:-5,metals:12,pharma:5,defence:-15,banking:18,realestate:20,index:25,other:15 },
    incentives:   { oil_gas:-12,airlines:12,auto:8,fmcg:8,it_services:-2,metals:5,pharma:3,defence:-10,banking:10,realestate:10,index:8,other:7 },
    feedback_loop:{ oil_gas:-5,airlines:10,auto:5,fmcg:6,it_services:-4,metals:3,pharma:-2,defence:-5,banking:8,realestate:10,index:10,other:5 },
    competitive:  { oil_gas:-8,airlines:4,auto:3,fmcg:3,it_services:-2,metals:-3,pharma:2,defence:-5,banking:3,realestate:4,index:4,other:2 },
    mean_reversion:{ oil_gas:15,airlines:-12,auto:-5,fmcg:-4,banking:-5,index:-8,other:-4 },
    inversion:    { oil_gas:-8,airlines:5,auto:3,index:4,other:2 },
  },
  rate_hike: {
    mechanics:    { banking:5,realestate:-60,it_services:-18,fmcg:-5,auto:-20,pharma:-5,metals:-18,oil_gas:-5,airlines:-12,defence:5,index:-25,other:-18 },
    incentives:   { banking:-8,realestate:-12,it_services:-8,fmcg:-3,auto:-10,pharma:-3,metals:-10,oil_gas:-3,airlines:-8,defence:3,index:-10,other:-8 },
    feedback_loop:{ banking:-10,realestate:-10,it_services:-5,fmcg:-3,auto:-8,pharma:-2,metals:-8,oil_gas:-3,airlines:-5,defence:3,index:-8,other:-6 },
    competitive:  { banking:-3,realestate:-3,it_services:-3,fmcg:-2,auto:-3,pharma:2,metals:-3,oil_gas:-2,airlines:-3,defence:2,index:-4,other:-3 },
    mean_reversion:{ realestate:15,auto:10,it_services:8,banking:-5,index:8,other:7 },
    inversion:    { banking:8,defence:8,realestate:-5,other:3 },
  },
  rate_cut: {
    mechanics:    { banking:30,realestate:55,it_services:20,fmcg:15,auto:28,pharma:8,metals:15,oil_gas:8,airlines:18,defence:5,index:30,other:20 },
    incentives:   { banking:10,realestate:15,it_services:8,fmcg:8,auto:10,pharma:5,metals:8,oil_gas:5,airlines:10,defence:3,index:10,other:8 },
    feedback_loop:{ banking:10,realestate:12,it_services:5,fmcg:5,auto:8,pharma:2,metals:5,oil_gas:3,airlines:6,defence:2,index:8,other:6 },
    competitive:  { banking:3,realestate:4,it_services:3,fmcg:2,auto:3,pharma:2,metals:2,oil_gas:2,airlines:3,defence:2,index:3,other:2 },
    mean_reversion:{ realestate:-12,banking:-5,auto:-5,it_services:-4,index:-6,other:-4 },
    inversion:    { other:5 },
  },
  geopolitical_risk: {
    mechanics:    { defence:70,oil_gas:40,fmcg:15,pharma:12,airlines:-50,banking:-20,metals:0,it_services:-10,auto:-15,realestate:-20,index:-30,other:-18 },
    incentives:   { defence:20,oil_gas:10,fmcg:5,pharma:5,airlines:-15,banking:-10,metals:-5,it_services:-8,auto:-10,realestate:-12,index:-12,other:-10 },
    feedback_loop:{ defence:10,oil_gas:15,fmcg:3,pharma:3,airlines:-12,banking:-8,metals:-5,it_services:-5,auto:-5,realestate:-8,index:-10,other:-7 },
    competitive:  { defence:10,oil_gas:5,fmcg:3,pharma:2,airlines:-5,banking:-5,metals:5,it_services:-3,auto:-3,realestate:-3,index:-5,other:-4 },
    mean_reversion:{ defence:-15,oil_gas:-10,airlines:20,auto:12,banking:12,index:18,other:12 },
    inversion:    { defence:10,airlines:5,banking:5,other:0 },
  },
  currency_inr_fall: {
    mechanics:    { it_services:50,pharma:35,oil_gas:-25,auto:-20,banking:-15,fmcg:-10,metals:-10,realestate:-5,airlines:-30,defence:10,index:-15,other:-5 },
    incentives:   { it_services:12,pharma:10,oil_gas:-8,auto:-8,banking:-8,fmcg:-5,metals:-4,realestate:-3,airlines:-10,defence:5,index:-8,other:-4 },
    feedback_loop:{ it_services:8,pharma:5,oil_gas:-10,auto:-5,banking:-10,fmcg:-3,metals:-3,realestate:-3,airlines:-8,defence:3,index:-10,other:-4 },
    competitive:  { it_services:5,pharma:4,oil_gas:-3,auto:-3,banking:-2,fmcg:-2,metals:-2,realestate:-1,airlines:-3,defence:3,index:-3,other:-2 },
    mean_reversion:{ it_services:-8,pharma:-5,oil_gas:8,airlines:12,banking:8,index:8,other:4 },
    inversion:    { it_services:8,pharma:8,airlines:-5,other:0 },
  },
  currency_inr_rise: {
    mechanics:    { it_services:-30,pharma:-20,oil_gas:20,auto:15,banking:10,fmcg:8,metals:5,realestate:8,airlines:20,defence:-5,index:10,other:0 },
    incentives:   { it_services:-10,pharma:-8,oil_gas:5,auto:5,banking:5,fmcg:3,metals:2,realestate:3,airlines:6,defence:-3,index:5,other:-2 },
    feedback_loop:{ it_services:-5,pharma:-2,oil_gas:4,banking:4,airlines:3,index:3,other:2 },
    competitive:  { it_services:-4,pharma:-3,airlines:3,other:1 },
    mean_reversion:{ it_services:8,pharma:5,other:-4 },
    inversion:    { it_services:-5,airlines:5,other:0 },
  },
  global_recession: {
    mechanics:    { it_services:-60,metals:-55,pharma:20,fmcg:15,banking:-40,auto:-40,realestate:-35,oil_gas:-20,airlines:-35,defence:15,index:-40,other:-35 },
    incentives:   { it_services:-15,metals:-12,pharma:8,fmcg:5,banking:-15,auto:-15,realestate:-12,oil_gas:-8,airlines:-15,defence:8,index:-12,other:-12 },
    feedback_loop:{ it_services:-10,metals:-10,pharma:5,fmcg:5,banking:-12,auto:-10,realestate:-10,oil_gas:-5,airlines:-10,defence:3,index:-12,other:-8 },
    competitive:  { it_services:-5,metals:-5,pharma:5,fmcg:5,banking:-5,auto:-5,realestate:-3,oil_gas:-3,airlines:-5,defence:5,index:-5,other:-3 },
    mean_reversion:{ pharma:-8,fmcg:-6,defence:-5,other:10 },
    inversion:    { pharma:8,fmcg:8,defence:5,other:-5 },
  },
  china_slowdown: {
    mechanics:    { metals:-55,it_services:5,pharma:15,auto:-20,banking:-15,fmcg:-5,oil_gas:-15,airlines:-10,realestate:-10,defence:5,index:-20,other:-20 },
    incentives:   { metals:-10,it_services:3,pharma:8,auto:-8,banking:-5,fmcg:-3,oil_gas:-5,airlines:-5,realestate:-5,defence:3,index:-8,other:-8 },
    feedback_loop:{ metals:-10,it_services:2,pharma:5,auto:-5,banking:-5,fmcg:-3,oil_gas:-5,airlines:-3,index:-8,other:-6 },
    competitive:  { metals:-5,pharma:5,it_services:3,auto:-3,other:-2 },
    mean_reversion:{ metals:12,auto:8,index:10,other:8 },
    inversion:    { pharma:8,it_services:5,metals:-5,other:0 },
  },
  us_market_crash: {
    mechanics:    { it_services:-50,index:-45,pharma:-10,fmcg:5,defence:10,banking:-30,metals:-25,auto:-20,airlines:-20,oil_gas:-10,realestate:-15,other:-30 },
    incentives:   { it_services:-12,index:-12,pharma:-3,fmcg:2,defence:5,banking:-10,other:-8 },
    feedback_loop:{ it_services:-8,index:-10,banking:-8,metals:-5,other:-6 },
    competitive:  { it_services:-3,fmcg:3,defence:3,other:-2 },
    mean_reversion:{ index:18,it_services:12,pharma:8,auto:8,other:12 },
    inversion:    { fmcg:8,defence:5,pharma:5,other:-5 },
  },
  global_rally: {
    mechanics:    { it_services:30,banking:25,metals:35,index:30,auto:20,realestate:20,fmcg:10,pharma:5,airlines:15,oil_gas:15,defence:5,other:20 },
    incentives:   { it_services:10,banking:8,metals:10,index:8,auto:8,realestate:8,other:5 },
    feedback_loop:{ it_services:5,banking:5,metals:5,index:8,auto:3,other:4 },
    competitive:  { it_services:3,metals:3,banking:3,index:3,other:2 },
    mean_reversion:{ it_services:-8,metals:-8,banking:-6,index:-8,other:-6 },
    inversion:    { metals:5,it_services:3,other:2 },
  },
  inflation_spike: {
    mechanics:    { fmcg:-25,banking:-20,realestate:-30,oil_gas:20,it_services:-5,metals:10,auto:-15,pharma:-5,airlines:-20,defence:5,index:-20,other:-15 },
    incentives:   { fmcg:-8,banking:-8,realestate:-10,oil_gas:8,it_services:-3,metals:5,auto:-8,other:-6 },
    feedback_loop:{ fmcg:-5,banking:-8,realestate:-8,oil_gas:5,it_services:-2,index:-8,other:-5 },
    competitive:  { fmcg:-3,banking:-3,realestate:-3,oil_gas:3,metals:3,other:-2 },
    mean_reversion:{ realestate:12,banking:8,fmcg:6,index:8,other:6 },
    inversion:    { oil_gas:8,metals:5,other:-3 },
  },
  none: {
    mechanics: { other: 0 }, incentives: { other: 0 }, feedback_loop: { other: 0 },
    competitive: { other: 0 }, mean_reversion: { other: 0 }, inversion: { other: 0 },
  },
};

// ─── Latticework Reasoning Engine ─────────────────────────────

const MODEL_WEIGHTS: Record<MentalModelName, number> = {
  mechanics: 0.22,
  incentives: 0.14,
  feedback_loop: 0.14,
  competitive: 0.11,
  mean_reversion: 0.08,
  inversion: 0.05,
  fiscal_policy: 0.12,
  liquidity_flows: 0.09,
  rural_demand: 0.05,
};

export const SECTOR_LABELS: Record<SectorName, string> = {
  it_services: "IT services", banking: "banking & financials", oil_gas: "oil & gas",
  airlines: "airlines", pharma: "pharma", metals: "metals & mining", auto: "automobiles",
  fmcg: "FMCG", realestate: "real estate", defence: "defence", index: "broader index",
  other: "this sector",
};

export const EVENT_DESCRIPTIONS: Record<MacroEventType, { name: string; channel: string }> = {
  oil_spike:        { name: "An oil price spike", channel: "higher crude raises energy and input costs across the economy" },
  oil_drop:         { name: "An oil price drop", channel: "lower crude reduces energy costs and the import bill" },
  rate_hike:        { name: "A rate hike", channel: "higher interest rates lift borrowing costs and tighten liquidity" },
  rate_cut:         { name: "A rate cut", channel: "lower interest rates reduce borrowing costs and improve liquidity" },
  geopolitical_risk:{ name: "Geopolitical risk", channel: "uncertainty drives safe-haven flows, defence spending, and risk-off sentiment" },
  currency_inr_fall:{ name: "INR depreciation", channel: "a weaker rupline raises import costs and changes export competitiveness" },
  currency_inr_rise:{ name: "INR appreciation", channel: "a stronger rupline lowers import costs and compresses export margins" },
  global_recession: { name: "Global recession risk", channel: "falling global demand and risk appetite hurt cyclical earnings" },
  china_slowdown:   { name: "A China slowdown", channel: "slower Chinese demand weighs on commodities and global trade" },
  us_market_crash:  { name: "A US market crash", channel: "US-led risk-off spills into emerging markets and IT exports" },
  global_rally:     { name: "A global market rally", channel: "improved risk appetite lifts capital flows and cyclical earnings" },
  inflation_spike:  { name: "An inflation spike", channel: "higher prices squeeze margins and raise the odds of policy tightening" },
  none:             { name: "No macro event", channel: "no identifiable macro driver" },
};

const MODEL_LABELS: Record<MentalModelName, string> = {
  mechanics: "Mechanics (first-order effect)",
  incentives: "Incentives (who wins / loses)",
  feedback_loop: "Feedback loops (second-order amplification)",
  competitive: "Competitive dynamics",
  mean_reversion: "Mean reversion",
  inversion: "Inversion (contrarian signal)",
  fiscal_policy: "Fiscal policy / Government response",
  liquidity_flows: "Liquidity & capital flows",
  rural_demand: "Rural demand / Monsoon linkage",
};

function genericReasoning(
  model: MentalModelName,
  sector: SectorName,
  eventType: MacroEventType,
  score: number,
): string {
  const s = SECTOR_LABELS[sector];
  const e = EVENT_DESCRIPTIONS[eventType];
  const dir = score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
  switch (model) {
    case "mechanics":
      return `${e.name} changes the direct mechanical cash-flow path for ${s}: ${e.channel}. The immediate read-through is ${dir} for this stock.`;
    case "incentives":
      return `Management, investor, and policy incentives shift: ${e.channel} in ${s} means the reward for risk-taking vs. capital discipline tilts ${dir}.`;
    case "feedback_loop":
      return `Second-order loops matter: ${e.channel} sets off follow-on effects (demand, funding, sentiment) that tend to amplify the initial ${dir} impulse in ${s}.`;
    case "competitive":
      return `Relative positioning within ${s} changes. Stronger balance sheets and natural hedges tend to outperform when ${e.channel}.`;
    case "mean_reversion":
      return `Once the headline is priced in, markets often mean-revert. The current ${dir} shock in ${s} may fade as the cycle normalises.`;
    case "inversion":
      return `Invert the problem: if the crowd overreacts to ${e.channel}, the opposite case becomes interesting. Watch for an overshoot in ${s}.`;
    case "fiscal_policy":
      return `Government response matters in India: ${e.channel} changes the fiscal calculus for ${s} through subsidies, taxation, capex, or regulatory pressure.`;
    case "liquidity_flows":
      return `Liquidity transmission: ${e.channel} shifts FII/DII flows, RBI stance, and credit availability — all of which affect ${s} valuations and financing costs.`;
    case "rural_demand":
      return `Rural linkage: ${e.channel} affects rural incomes, monsoon-linked spending, and FMCG/auto demand — a key micro driver for ${s}.`;
  }
}

// Specific notes for high-impact (event, sector) pairs. Falls back to genericReasoning.
const SECTOR_EVENT_NOTES: Partial<
  Record<MacroEventType, Partial<Record<SectorName, Partial<Record<MentalModelName, string>>>>>
> = {
  oil_spike: {
    airlines: {
      mechanics: "Fuel (ATF) is 35–40% of airline operating costs. A crude spike immediately raises input costs and compresses EBITDA margins.",
      incentives: "Airlines are incentivised to raise fares, but price elasticity limits pass-through; low-cost carriers face the toughest trade-off.",
      feedback_loop: "Higher fares → lower load factors → revenue decline → weaker cash flow → multiple compression.",
      competitive: "Hedged carriers and premium-route airlines gain relative share; unhedged budget airlines lose.",
      mean_reversion: "Oil spikes are often mean-reverting once geopolitical tension fades; airline stocks can rebound sharply.",
      inversion: "If the spike triggers broad risk-off, even well-hedged airlines get sold — a potential overshoot opportunity.",
    },
    oil_gas: {
      mechanics: "Upstream producers benefit directly from higher realisations; refiners and OMCs face margin squeeze unless pass-through is full.",
      incentives: "Upstream boards are incentivised to ramp output and capex; OMCs face political pressure to absorb prices.",
      feedback_loop: "Higher oil revenues → more government dividends → rerating, but sustained high prices eventually destroy demand.",
      competitive: "Low-cost producers and companies with domestic acreage win against import-dependent refiners.",
      mean_reversion: "Crude often mean-reverts; producers should be careful not to extrapolate spot cash flows into long-term capex.",
      inversion: "If oil is spiking on war risk, the contrarian case is a peace dividend — but timing is hard.",
    },
    auto: {
      mechanics: "Higher oil raises the total cost of vehicle ownership and raises input costs for tyres, plastics, and logistics.",
      incentives: "Consumers tilt toward fuel-efficient and EV models; OEMs push discounts to protect volumes.",
      feedback_loop: "Higher fuel costs → lower vehicle demand → inventory build → discounting → margin compression.",
      competitive: "Two-wheelers and EV players gain relative share; SUV/premium diesel makers are more resilient.",
      mean_reversion: "Oil shocks are usually temporary; auto demand normalises once fuel prices stabilise.",
      inversion: "If auto stocks sell off on oil fears, quality OEMs may become contrarian buys.",
    },
    fmcg: {
      mechanics: "Crude derivatives are inputs for packaging and freight. Margins face pressure unless price hikes stick.",
      incentives: "Companies with pricing power and premium brands are incentivised to push through price hikes.",
      feedback_loop: "Higher product prices → volume slowdown in rural markets → earnings miss for mass-market players.",
      competitive: "Premium and organised brands pass costs through; smaller competitors lose share.",
      mean_reversion: "Input costs eventually cool, and pricing power allows margin recovery.",
      inversion: "If valuations compress on margin fears, market leaders can become attractive.",
    },
    index: {
      mechanics: "Oil spike raises inflation and import bill, tightening the macro screws on the broad market.",
      incentives: "RBI's incentive shifts toward hawkish policy; foreign investors reduce risk exposure.",
      feedback_loop: "Higher oil → higher CPI → rate-hike expectations → multiple compression across the index.",
      competitive: "Cyclical exporters and commodity producers outperform rate-sensitive and consumption names.",
      mean_reversion: "Geopolitical risk premium often fades; the index tends to recover once oil stabilises.",
      inversion: "If VIX spikes and breadth collapses, a tactical overshoot is possible.",
    },
  },
  oil_drop: {
    airlines: {
      mechanics: "Lower ATF prices directly reduce operating costs and expand EBITDA margins.",
      incentives: "Airlines may pocket the savings or use them to discount and win market share.",
      feedback_loop: "Lower fuel costs → higher load factors and margins → earnings upgrades → rerating.",
      competitive: "Unhedged carriers gain the most; hedged airlines see less upside but more stability.",
      mean_reversion: "Oil falls rarely last forever; airlines should not be valued on structurally low fuel costs.",
      inversion: "If oil is falling because of recession fears, demand destruction can offset the fuel benefit.",
    },
    oil_gas: {
      mechanics: "Upstream realisations fall; refiners and OMCs benefit from lower working capital and possibly better cracks.",
      incentives: "Upstream boards cut capex and dividends; OMCs gain political room to pass lower prices.",
      feedback_loop: "Lower oil revenues → lower government receipts → potential fiscal tightening or divestment pressure.",
      competitive: "Low-cost producers survive; high-cost players and leveraged exploration names suffer.",
      mean_reversion: "OPEC+ cuts often put a floor; oil tends to mean-revert from demand-driven drops.",
      inversion: "If oil crashes on recession, cyclical demand can fall faster than the stock price reflects.",
    },
    auto: {
      mechanics: "Cheaper fuel lowers total cost of ownership and supports vehicle demand.",
      incentives: "OEMs may reduce discounts and improve realisations as consumer affordability improves.",
      feedback_loop: "Lower fuel costs → higher demand → inventory drawdown → better margins and earnings.",
      competitive: "Mass-market and SUV makers gain; EV transition may slow slightly on cheaper fuel.",
      mean_reversion: "Fuel prices mean-revert; auto stocks should not be priced for permanently cheap oil.",
      inversion: "If oil falls due to a demand collapse, auto sales may still disappoint.",
    },
    fmcg: {
      mechanics: "Lower crude reduces packaging and freight costs, supporting gross margins.",
      incentives: "Companies may reinvest savings into volume-driving promotions or let them flow to profit.",
      feedback_loop: "Lower input costs → price cuts or stable prices → rural volume recovery → earnings upgrade.",
      competitive: "Organised players with scale gain versus smaller competitors that cannot negotiate lower costs.",
      mean_reversion: "Input-cost relief often proves temporary; margin expansion can reverse.",
      inversion: "If FMCG stocks rally on cost relief while demand is weak, the move may be fragile.",
    },
    banking: {
      mechanics: "Lower oil reduces inflation and improves consumer disposable income, supporting credit quality.",
      incentives: "Lower inflation reduces the odds of aggressive rate hikes, helping credit growth.",
      feedback_loop: "Lower oil → lower CPI → stable rates → better loan demand → lower NPA formation.",
      competitive: "Retail and consumer banks outperform corporate banks exposed to stressed commodity borrowers.",
      mean_reversion: "Oil-driven relief is cyclical; loan growth and asset quality remain the long-term drivers.",
      inversion: "If oil is falling due to recession, credit costs can rise and hurt banks anyway.",
    },
    realestate: {
      mechanics: "Lower oil reduces construction material and logistics costs, supporting project margins.",
      incentives: "Lower inflation and stable rates improve homebuyer affordability and developer launches.",
      feedback_loop: "Lower oil → lower input costs + lower rates → higher sales → better cash flows → rerating.",
      competitive: "Developers with low leverage and ready inventory win; leveraged players benefit less.",
      mean_reversion: "Oil and construction costs are volatile; margin expansion often reverses.",
      inversion: "If oil falls because demand is collapsing, property sales may still weaken.",
    },
  },
  rate_hike: {
    realestate: {
      mechanics: "Higher rates raise mortgage EMIs and construction-finance costs, directly hurting demand and margins.",
      incentives: "Developers are incentivised to cut prices and clear inventory rather than hold out for margins.",
      feedback_loop: "Higher EMIs → lower demand → price cuts → weaker cash flows → leveraged developer stress.",
      competitive: "Low-leverage developers with ready inventory gain; leveraged and speculative projects lose.",
      mean_reversion: "Rate cycles turn; real estate often bounces when the RBI pauses or cuts.",
      inversion: "If the market prices in a deep real-estate crash, quality developers can become contrarian buys.",
    },
    banking: {
      mechanics: "Rate hikes improve net interest margins initially, but can slow credit growth and raise defaults.",
      incentives: "Banks are incentivised to reprice loans faster than deposits; this helps margins but hurts depositors.",
      feedback_loop: "Higher rates → slower corporate borrowing → fee income pressure → asset quality risk.",
      competitive: "Banks with low-cost deposits and strong retail franchises outperform rate-sensitive lenders.",
      mean_reversion: "Hiking cycles eventually end; banking multiples recover when the terminal rate is visible.",
      inversion: "If banks sell off on recession fears, the entry point can be attractive for long-term holders.",
    },
    auto: {
      mechanics: "Higher rates raise vehicle-loan EMIs, cooling demand for cars and two-wheelers.",
      incentives: "OEMs and NBFCs push subvented schemes to protect volumes at the cost of margins.",
      feedback_loop: "Higher EMIs → lower demand → inventory build → higher discounts → margin compression.",
      competitive: "Mass-market brands reliant on financing lose share; premium/cash buyers are more resilient.",
      mean_reversion: "Rate cycles are temporary; auto demand rebounds when rates stabilise or cut.",
      inversion: "If auto stocks crash on rate fears, quality franchises may be oversold.",
    },
    it_services: {
      mechanics: "Higher global rates reduce tech spending and startup valuations, hurting IT demand.",
      incentives: "Clients are incentivised to cut discretionary projects and move to offshore cost arbitrage.",
      feedback_loop: "Lower tech spend → lower deal wins → slower revenue growth → multiple compression.",
      competitive: "Large offshore players with cost discipline gain versus smaller niche vendors.",
      mean_reversion: "Rate cycles turn; tech spending and IT multiples recover when liquidity returns.",
      inversion: "If IT sells off on recession fears, high-quality exporters can be attractive on INR weakness too.",
    },
  },
  rate_cut: {
    realestate: {
      mechanics: "Lower mortgage rates improve affordability and reduce developer finance costs, lifting demand and margins.",
      incentives: "Developers are incentivised to launch new projects and raise prices as buyer confidence returns.",
      feedback_loop: "Lower rates → higher affordability → higher sales → stronger cash flows → rerating.",
      competitive: "Low-leverage developers with land banks win; leveraged players still carry risk.",
      mean_reversion: "Rate cuts are often front-run; the rerating can fade if earnings do not follow.",
      inversion: "If the RBI is cutting because growth is collapsing, real-estate demand may not respond.",
    },
    banking: {
      mechanics: "Rate cuts can compress margins but stimulate credit growth and improve asset quality.",
      incentives: "Banks are incentivised to grow retail and SME loans as borrowing appetite rises.",
      feedback_loop: "Lower rates → higher demand → better growth → lower NPAs → rerating.",
      competitive: "Banks with strong deposit franchises and digital distribution win the credit growth.",
      mean_reversion: "Rate-cut rallies in banks can reverse if credit costs surprise on the upside.",
      inversion: "If banks rally purely on rate-cut hope while deposit growth is weak, margins may compress.",
    },
    auto: {
      mechanics: "Lower EMIs improve vehicle affordability and support demand for cars and two-wheelers.",
      incentives: "OEMs reduce subvention and improve realisations as financing-driven demand returns.",
      feedback_loop: "Lower rates → higher demand → inventory drawdown → better margins → earnings upgrades.",
      competitive: "Mass-market and two-wheeler brands benefit most; premium players are relatively less sensitive.",
      mean_reversion: "Rate-cut demand boosts can fade if the economy itself does not improve.",
      inversion: "If auto stocks price in a full demand recovery, there may be little room for error.",
    },
    it_services: {
      mechanics: "Lower rates improve tech budgets and startup funding, supporting IT deal flows.",
      incentives: "Clients are incentivised to resume discretionary and transformation projects.",
      feedback_loop: "Higher tech spend → larger deal wins → faster revenue growth → multiple expansion.",
      competitive: "Large offshore players with AI and cloud capabilities capture the recovery.",
      mean_reversion: "IT multiples can overshoot on rate-cut optimism; earnings must catch up.",
      inversion: "If the Fed is cutting because of recession, tech budgets may still be cut despite lower rates.",
    },
  },
  geopolitical_risk: {
    defence: {
      mechanics: "Defence spending and order flows typically rise during geopolitical tensions, directly lifting revenues.",
      incentives: "Governments are incentivised to fast-track procurement and indigenisation programs.",
      feedback_loop: "Higher orders → revenue visibility → rerating → more capex → sustained growth.",
      competitive: "Domestic defence companies with proven platforms and order books win import share.",
      mean_reversion: "Geopolitical spikes fade; defence orders remain but the rerating may normalise.",
      inversion: "If valuations price in a permanent war premium, the risk is a de-escalation correction.",
    },
    oil_gas: {
      mechanics: "War risk premium in crude raises realisations for upstream producers and creates supply uncertainty.",
      incentives: "Governments may release strategic reserves or cap prices, limiting the upside for producers.",
      feedback_loop: "Higher oil → fiscal and inflation pressure → demand destruction or policy response.",
      competitive: "Domestic producers and gas players benefit; refiners face margin and policy risk.",
      mean_reversion: "Geopolitical premia often deflate once the conflict becomes stale or resolves.",
      inversion: "If oil rallies on war headlines but demand is weak, the move can reverse quickly.",
    },
    airlines: {
      mechanics: "War risk raises fuel prices and can disrupt air routes, hurting operating costs and revenue.",
      incentives: "Airlines are incentivised to reroute and hedge fuel exposure to limit losses.",
      feedback_loop: "Higher fuel + lower travel confidence → load factor drop → earnings downgrade.",
      competitive: "Domestic carriers with limited international exposure fare better than global airlines.",
      mean_reversion: "Once the conflict is priced in, travel demand and airline stocks often recover.",
      inversion: "If airline stocks sell off indiscriminately, well-capitalised carriers can be oversold.",
    },
    index: {
      mechanics: "Geopolitical risk raises the equity risk premium and pushes foreign investors to reduce exposure.",
      incentives: "Domestic investors are incentivised to rotate toward defensives and gold as uncertainty rises.",
      feedback_loop: "FII outflows → INR weakness → higher imported inflation → RBI hawkishness → multiple compression.",
      competitive: "Defensive and domestic sectors outperform rate-sensitive and global cyclicals.",
      mean_reversion: "Historically, geopolitical shocks cause short-term spikes and then ~60% mean reversion.",
      inversion: "If the index falls sharply on war news, it often becomes a buying opportunity within 1–2 weeks.",
    },
  },
  currency_inr_fall: {
    it_services: {
      mechanics: "A weaker rupee improves USD-revenue conversion and raises reported earnings for exporters.",
      incentives: "IT companies are incentivised to increase offshore delivery to protect margins.",
      feedback_loop: "INR fall → higher reported earnings → upgrades → rerating, though hedges may cap gains.",
      competitive: "Firms with high offshore mix and natural hedges outperform those with large US costs.",
      mean_reversion: "RBI intervention and capital flows often stabilise the rupee; exporter gains can reverse.",
      inversion: "If INR weakness signals macro stress, the market can fall and drag IT with it.",
    },
    pharma: {
      mechanics: "A weaker rupee lifts export realisations and makes Indian generics more competitive globally.",
      incentives: "Pharma companies are incentivised to push exports and US filings to capture the currency tailwind.",
      feedback_loop: "INR fall → better margins → earnings upgrades → multiple expansion.",
      competitive: "Export-oriented API and formulation players gain; import-dependent companies face API cost pressure.",
      mean_reversion: "RBI intervention can reverse INR weakness; hedge gains are limited.",
      inversion: "If INR falls due to a crisis, FDA risk-off can still hurt pharma stocks.",
    },
    airlines: {
      mechanics: "A weaker rupee raises dollar-denominated fuel, aircraft lease, and maintenance costs.",
      incentives: "Airlines are incentivised to raise fares and reduce international exposure.",
      feedback_loop: "Higher dollar costs → higher fares → lower demand → margin squeeze.",
      competitive: "Domestic-focused carriers with rupee revenue fare better than international operators.",
      mean_reversion: "The rupee often stabilises; the cost shock can be temporary.",
      inversion: "If airlines are sold off on rupee fears, the move can be overdone if the fall is shallow.",
    },
    oil_gas: {
      mechanics: "A weaker rupee raises the landed cost of imported crude and LNG, worsening the import bill.",
      incentives: "Upstream producers gain from higher rupee realisations; OMCs face margin and policy risk.",
      feedback_loop: "INR fall → higher fuel prices → inflation → RBI response → demand pressure.",
      competitive: "Domestic producers benefit; import-dependent refiners and gas distributors face pressure.",
      mean_reversion: "RBI intervention and capital flows often stabilise the currency.",
      inversion: "If INR weakness is driven by strong FII equity inflows, the market may actually rise.",
    },
  },
  global_recession: {
    it_services: {
      mechanics: "Global recession cuts technology spending, discretionary projects, and IT deal wins.",
      incentives: "Clients are incentivised to cut costs and offshore more work, partially cushioning demand.",
      feedback_loop: "Lower tech spend → slower revenue growth → margin pressure → multiple compression.",
      competitive: "Large offshore cost leaders gain share; niche and high-cost vendors lose.",
      mean_reversion: "Recessions end; IT demand and multiples recover when the cycle turns.",
      inversion: "If IT stocks price in a deep recession but the cycle is shallow, they can bounce hard.",
    },
    metals: {
      mechanics: "Recession destroys industrial demand for steel, copper, and aluminium, crashing prices and volumes.",
      incentives: "Producers are incentivised to cut output and protect cash rather than chase market share.",
      feedback_loop: "Lower demand → price drops → earnings collapse → deleveraging → capex cuts.",
      competitive: "Low-cost miners and integrated producers survive; high-cost leveraged players face distress.",
      mean_reversion: "Commodity cycles are brutal but cyclical; demand eventually returns when stimulus arrives.",
      inversion: "If metal stocks price in recession but China stimulates, the sector can rerate sharply.",
    },
    banking: {
      mechanics: "Recession raises unemployment and corporate defaults, lifting credit costs and NPAs.",
      incentives: "Banks tighten underwriting and build provisions, sacrificing growth for stability.",
      feedback_loop: "Rising defaults → higher provisions → lower earnings → lower capital → slower growth.",
      competitive: "Retail banks with granular books outperform corporate lenders with large exposures.",
      mean_reversion: "Credit cycles are cyclical; bank recoveries can be sharp once provisions peak.",
      inversion: "If banks sell off on recession fears but the downturn is mild, they become contrarian buys.",
    },
    auto: {
      mechanics: "Recession reduces discretionary spending and vehicle demand, hitting volumes and margins.",
      incentives: "OEMs and financiers push discounts and easy credit to keep volumes from collapsing.",
      feedback_loop: "Lower demand → inventory pile-up → discounting → margin compression → earnings miss.",
      competitive: "Affordable brands and two-wheelers with financing reach fare better than premium players.",
      mean_reversion: "Auto demand rebounds once incomes and credit availability improve.",
      inversion: "If auto stocks crash ahead of a mild recession, quality names can be oversold.",
    },
    fmcg: {
      mechanics: "Recession pressures volumes, especially in rural and discretionary categories.",
      incentives: "Companies trade margins for volume via promotions and smaller pack sizes.",
      feedback_loop: "Lower volumes → operating deleverage → earnings decline → multiple compression.",
      competitive: "Essential and value brands gain share; premium and discretionary categories lose.",
      mean_reversion: "FMCG is defensive; demand normalises as the economy recovers.",
      inversion: "If FMCG valuations remain elevated despite recession, they can underperform.",
    },
  },
  china_slowdown: {
    metals: {
      mechanics: "China consumes ~50% of global metals. A slowdown crushes steel, copper, and iron-ore demand.",
      incentives: "Chinese producers are incentivised to export surplus, dumping prices globally.",
      feedback_loop: "Lower Chinese demand → surplus → price collapse → margin squeeze → production cuts.",
      competitive: "Low-cost global miners and Indian steel exporters with cost advantage survive.",
      mean_reversion: "China usually stimulates its way out of slowdowns; metals demand rebounds.",
      inversion: "If metal stocks price in a hard China landing, stimulus can trigger a sharp rally.",
    },
    auto: {
      mechanics: "China is the largest auto market; a slowdown hurts global component and luxury demand.",
      incentives: "Chinese OEMs may export excess inventory, pressuring global pricing.",
      feedback_loop: "Lower China demand → excess global supply → price pressure on components.",
      competitive: "Indian component makers with domestic and global cost advantage are more resilient.",
      mean_reversion: "China's auto cycle is policy-driven; stimulus can reignite demand.",
      inversion: "If auto stocks fall on China slowdown fears, stimulus expectations can drive a rebound.",
    },
    pharma: {
      mechanics: "China is a large pharma market and API supplier; slowdown affects both demand and supply chains.",
      incentives: "Chinese API producers may cut prices, lowering input costs for Indian generics.",
      feedback_loop: "Lower China demand → global API price pressure → margin relief for Indian formulations.",
      competitive: "Indian API players face cheaper Chinese imports; formulation exporters gain on input costs.",
      mean_reversion: "China's pharma demand normalises as its economy stabilises.",
      inversion: "If India-pharma stocks fall on China fears, the input-cost relief may be underappreciated.",
    },
  },
  us_market_crash: {
    it_services: {
      mechanics: "US clients cut tech budgets and startup funding dries up, hurting IT demand and valuations.",
      incentives: "Clients offshore more to cut costs, partially offsetting lower total spend.",
      feedback_loop: "US slowdown → lower deal wins → revenue deceleration → multiple compression.",
      competitive: "Large offshore players win share; smaller US-centric vendors face the biggest hit.",
      mean_reversion: "US tech spending and valuations recover after the crash; IT follows.",
      inversion: "If IT stocks fall in line with Nasdaq, the India-specific cost arbitrage can be undervalued.",
    },
    index: {
      mechanics: "A US crash triggers FII outflows and risk-off across emerging markets, including India.",
      incentives: "Domestic investors rotate from cyclicals to defensives and fixed income.",
      feedback_loop: "FII selling → INR weakness → higher rates risk → broad multiple compression.",
      competitive: "Domestic-demand sectors outperform export-oriented and global cyclicals.",
      mean_reversion: "India often decouples within 1–2 weeks after the initial shock; recoveries can be sharp.",
      inversion: "If the index falls sharply with the US, it is often a tactical buying opportunity.",
    },
  },
  global_rally: {
    it_services: {
      mechanics: "A global rally lifts tech spending, startup valuations, and FII appetite for IT exporters.",
      incentives: "Clients resume discretionary projects and digital transformation spend.",
      feedback_loop: "Higher tech spend → larger deal wins → earnings upgrades → multiple expansion.",
      competitive: "Large offshore players with AI/cloud exposure capture the most upside.",
      mean_reversion: "Rally-driven rerating can overshoot; earnings must deliver to sustain it.",
      inversion: "If IT rallies on global liquidity while domestic demand is weak, the move is vulnerable.",
    },
    metals: {
      mechanics: "A global rally implies better industrial demand and higher commodity prices.",
      incentives: "Producers are incentivised to restart idle capacity and expand output.",
      feedback_loop: "Higher demand → higher prices → earnings surge → capex expansion → sustained cycle.",
      competitive: "Low-cost producers and exporters gain the most; high-cost players lag.",
      mean_reversion: "Commodity rallies often overshoot and correct once supply responds.",
      inversion: "If metals rally purely on liquidity without demand, the correction can be sharp.",
    },
    banking: {
      mechanics: "A global rally improves credit growth, asset quality, and capital-market fees for banks.",
      incentives: "Banks are incentivised to lend more and raise capital at better valuations.",
      feedback_loop: "Higher growth → lower NPAs → earnings upgrades → rerating.",
      competitive: "Banks with strong corporate and retail franchises capture the cycle.",
      mean_reversion: "Rally-driven rerating can reverse if global growth disappoints.",
      inversion: "If banks rally on global liquidity while local credit quality is weak, be cautious.",
    },
  },
  inflation_spike: {
    fmcg: {
      mechanics: "Higher input costs and logistics expenses squeeze FMCG gross margins.",
      incentives: "Companies with pricing power are incentivised to push through price hikes; others absorb costs.",
      feedback_loop: "Higher prices → volume slowdown, especially rural → earnings miss.",
      competitive: "Premium and organised brands pass on costs; smaller players lose share.",
      mean_reversion: "Input costs eventually cool and margins recover for leaders.",
      inversion: "If FMCG stocks sell off on margin fears, market leaders may be oversold.",
    },
    realestate: {
      mechanics: "Higher inflation and rates reduce affordability and raise construction costs for developers.",
      incentives: "Developers are incentivised to launch smaller units and offer subvention to move inventory.",
      feedback_loop: "Higher costs + lower affordability → slower sales → cash-flow stress → price cuts.",
      competitive: "Low-leverage developers with ready inventory survive; leveraged players face stress.",
      mean_reversion: "Inflation cycles are mean-reverting; real estate recovers when rates peak.",
      inversion: "If real estate crashes on inflation fears, quality developers can be attractive.",
    },
    banking: {
      mechanics: "Inflation pushes the RBI toward rate hikes, lifting credit costs and slowing loan growth.",
      incentives: "Banks reprice loans faster than deposits to protect margins in the near term.",
      feedback_loop: "Higher rates → slower demand → rising defaults → earnings pressure.",
      competitive: "Retail banks with low-cost deposits outperform corporate lenders exposed to cyclical borrowers.",
      mean_reversion: "Inflation and rate cycles turn; banks recover when the terminal rate is in sight.",
      inversion: "If banks sell off on inflation fears, the entry may be attractive for long-term holders.",
    },
    oil_gas: {
      mechanics: "Upstream oil and gas producers benefit from higher energy prices during an inflation spike.",
      incentives: "Producers are incentivised to raise output and realisations while the cycle lasts.",
      feedback_loop: "Higher oil prices → fiscal revenue → government dividend → rerating.",
      competitive: "Domestic producers and gas players gain; OMCs face political pricing caps.",
      mean_reversion: "Inflation-driven oil rallies often trigger demand destruction and policy response.",
      inversion: "If oil producers rerate on inflation, the move can reverse if the RBI tightens aggressively.",
    },
  },
};

function getReasoning(model: MentalModelName, sector: SectorName, eventType: MacroEventType, score: number): string {
  const specific = SECTOR_EVENT_NOTES[eventType]?.[sector]?.[model];
  if (specific) return specific;
  return genericReasoning(model, sector, eventType, score);
}

function transmissionChain(eventType: MacroEventType, sector: SectorName): string {
  const chains: Record<MacroEventType, string> = {
    oil_spike: "Oil Price → Energy Costs → Input Costs → Margins → Cash Flow → Stock Price",
    oil_drop: "Oil Price → Lower Energy Costs → Margin Expansion → Earnings → Stock Price",
    rate_hike: "Policy Rate → Borrowing Costs → Capex & Consumption → Earnings → Stock Price",
    rate_cut: "Policy Rate → Cheaper Credit → Demand & Investment → Earnings → Stock Price",
    geopolitical_risk: "Conflict Risk → Risk Premium → Safe-Haven Flows → Multiple → Stock Price",
    currency_inr_fall: "INR Weakness → Import Costs / Export Revenues → Margins → Stock Price",
    currency_inr_rise: "INR Strength → Import Relief / Export Pressure → Margins → Stock Price",
    global_recession: "Global Demand → Exports & Commodities → Earnings → Stock Price",
    china_slowdown: "China Demand → Commodities & Trade → Global Growth → Stock Price",
    us_market_crash: "US Risk-Off → FII Outflows → INR & Multiples → Stock Price",
    global_rally: "Global Liquidity → Risk Appetite → Capital Flows → Stock Price",
    inflation_spike: "Inflation → Input Costs / Policy Response → Margins → Stock Price",
    none: "No Macro Driver → Focus on Stock-Specifics",
  };
  const sectorFactor = sector === "index" ? " (market-wide)" : ` (sector: ${SECTOR_LABELS[sector]})`;
  return chains[eventType] + sectorFactor;
}

// ─── Secondary Transmission Models ───────────────────────────

// Explicit scores for the three India-specific transmission models.
// Missing (event, sector) pairs fall back to a derivation from primary scores.
const SECONDARY_SCORES: Partial<
  Record<MentalModelName, Partial<Record<MacroEventType, Partial<Record<SectorName | "other", number>>>>>
> = {
  fiscal_policy: {
    oil_spike: { oil_gas: 35, airlines: -15, fmcg: -10, defence: 25, realestate: 15, index: -10, other: -5 },
    oil_drop: { oil_gas: -20, airlines: 10, fmcg: 8, defence: -5, realestate: 10, index: 5, other: 3 },
    rate_hike: { realestate: -30, banking: 10, auto: -15, fmcg: -8, oil_gas: -10, index: -15, other: -8 },
    rate_cut: { realestate: 35, banking: 15, auto: 20, fmcg: 10, oil_gas: 8, index: 15, other: 8 },
    geopolitical_risk: { defence: 45, oil_gas: 20, fmcg: -5, banking: -10, index: -15, other: -5 },
    currency_inr_fall: { oil_gas: -15, airlines: -10, fmcg: -8, it_services: 10, pharma: 8, other: -5 },
    currency_inr_rise: { oil_gas: 10, airlines: 8, fmcg: 5, it_services: -10, pharma: -5, other: 3 },
    global_recession: { banking: -25, fmcg: -10, oil_gas: -15, defence: 10, realestate: -15, other: -10 },
    china_slowdown: { metals: -20, auto: -10, fmcg: -5, defence: 5, other: -5 },
    us_market_crash: { it_services: -20, banking: -15, index: -15, defence: 10, other: -10 },
    global_rally: { banking: 15, it_services: 15, metals: 10, realestate: 10, oil_gas: 5, other: 8 },
    inflation_spike: { oil_gas: 25, fmcg: -20, banking: -15, realestate: -20, airlines: -10, other: -10 },
  },
  liquidity_flows: {
    rate_hike: { banking: 15, realestate: -35, auto: -20, it_services: -15, fmcg: -10, index: -20, other: -12 },
    rate_cut: { banking: 10, realestate: 30, auto: 18, it_services: 15, fmcg: 8, index: 18, other: 10 },
    geopolitical_risk: { index: -25, banking: -15, it_services: -15, fmcg: -5, defence: 5, other: -10 },
    currency_inr_fall: { it_services: 20, pharma: 15, banking: -10, oil_gas: -15, index: -10, other: -5 },
    currency_inr_rise: { it_services: -15, pharma: -10, banking: 8, oil_gas: 10, index: 8, other: 3 },
    us_market_crash: { index: -35, banking: -25, it_services: -25, fmcg: -5, other: -15 },
    global_rally: { index: 25, banking: 20, it_services: 20, metals: 10, other: 10 },
    global_recession: { banking: -20, it_services: -15, index: -15, realestate: -15, other: -10 },
    inflation_spike: { banking: -15, realestate: -20, fmcg: -8, auto: -10, other: -8 },
    oil_spike: { airlines: -10, oil_gas: 5, fmcg: -5, index: -10, other: -5 },
    oil_drop: { airlines: 10, oil_gas: -5, fmcg: 5, index: 5, other: 3 },
  },
  rural_demand: {
    inflation_spike: { fmcg: -25, auto: -15, banking: -10, realestate: -10, other: -8 },
    oil_drop: { fmcg: 12, auto: 10, other: 5 },
    oil_spike: { fmcg: -15, auto: -10, other: -5 },
    rate_cut: { fmcg: 10, auto: 12, realestate: 8, other: 5 },
    rate_hike: { fmcg: -12, auto: -15, realestate: -10, other: -6 },
    global_recession: { fmcg: -15, auto: -12, banking: -8, other: -8 },
    global_rally: { fmcg: 10, auto: 10, other: 5 },
    currency_inr_fall: { fmcg: -10, auto: -8, other: -5 },
    currency_inr_rise: { fmcg: 5, auto: 5, other: 3 },
  },
};

function deriveSecondaryScore(
  model: MentalModelName,
  eventType: MacroEventType,
  sector: SectorName,
  primary: Record<"mechanics" | "incentives" | "feedback_loop", number>,
): number {
  const explicit = SECONDARY_SCORES[model]?.[eventType]?.[sector] ?? SECONDARY_SCORES[model]?.[eventType]?.other;
  if (explicit !== undefined) return explicit;

  // Sector sensitivity buckets for each secondary model.
  const sensitivity: Partial<Record<MentalModelName, Set<SectorName>>> = {
    fiscal_policy: new Set(["defence", "oil_gas", "fmcg", "realestate", "metals", "banking"]),
    liquidity_flows: new Set(["banking", "realestate", "auto", "index", "it_services"]),
    rural_demand: new Set(["fmcg", "auto", "banking", "realestate"]),
  };

  const eventFiscalMultiplier: Record<MacroEventType, number> = {
    oil_spike: -0.6, oil_drop: 0.3, rate_hike: -0.8, rate_cut: 0.8,
    geopolitical_risk: 0.9, currency_inr_fall: -0.4, currency_inr_rise: 0.3,
    global_recession: -0.5, china_slowdown: -0.3, us_market_crash: -0.4,
    global_rally: 0.5, inflation_spike: -0.7, none: 0,
  };
  const eventLiquidityMultiplier: Record<MacroEventType, number> = {
    oil_spike: -0.3, oil_drop: 0.2, rate_hike: -0.9, rate_cut: 0.9,
    geopolitical_risk: -0.7, currency_inr_fall: -0.5, currency_inr_rise: 0.4,
    global_recession: -0.7, china_slowdown: -0.3, us_market_crash: -0.9,
    global_rally: 0.8, inflation_spike: -0.6, none: 0,
  };
  const eventRuralMultiplier: Record<MacroEventType, number> = {
    oil_spike: -0.5, oil_drop: 0.4, rate_hike: -0.6, rate_cut: 0.5,
    geopolitical_risk: -0.2, currency_inr_fall: -0.4, currency_inr_rise: 0.2,
    global_recession: -0.6, china_slowdown: -0.2, us_market_crash: -0.3,
    global_rally: 0.4, inflation_spike: -0.8, none: 0,
  };

  const isSensitive = sensitivity[model]?.has(sector) ?? false;
  const multiplier = isSensitive ? 1.5 : 0.7;
  const base = (primary.mechanics + primary.incentives + primary.feedback_loop) / 3;

  const eventMult =
    model === "fiscal_policy" ? eventFiscalMultiplier[eventType] ?? 0 :
    model === "liquidity_flows" ? eventLiquidityMultiplier[eventType] ?? 0 :
    eventRuralMultiplier[eventType] ?? 0;

  return clamp(base * multiplier + eventMult * 12, -50, 50);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function computeLatticework(
  eventType: MacroEventType,
  sector: SectorName,
  symbol?: string,
): LatticeworkAnalysis {
  const modelScores = SCORES[eventType];
  const models: MentalModelName[] = [
    "mechanics", "incentives", "feedback_loop", "competitive", "mean_reversion", "inversion",
    "fiscal_policy", "liquidity_flows", "rural_demand",
  ];

  const primary: Record<"mechanics" | "incentives" | "feedback_loop", number> = {
    mechanics: pick(modelScores?.mechanics ?? {}, sector) ?? 0,
    incentives: pick(modelScores?.incentives ?? {}, sector) ?? 0,
    feedback_loop: pick(modelScores?.feedback_loop ?? {}, sector) ?? 0,
  };

  const layers = models.map((model) => {
    let score: number;
    if (["fiscal_policy", "liquidity_flows", "rural_demand"].includes(model)) {
      score = deriveSecondaryScore(model, eventType, sector, primary);
    } else {
      const raw = modelScores?.[model] ?? {};
      score = pick(raw as Partial<Record<SectorName | "other", number>>, sector) ?? 0;
    }
    const weight = MODEL_WEIGHTS[model];
    const reasoning = getReasoning(model, sector, eventType, score);
    return L(model, MODEL_LABELS[model], score, weight, reasoning);
  });

  const rawScore = layers.reduce((sum, l) => sum + l.score, 0);
  const netScore = clamp(
    layers.reduce((sum, l) => sum + l.score * l.weight, 0),
    -100,
    100,
  );

  const maxPositive = Math.max(...layers.map((l) => l.score));
  const maxNegative = Math.min(...layers.map((l) => l.score));
  const hasConflict = maxPositive > 30 && maxNegative < -30;

  let direction: LatticeworkAnalysis["direction"];
  if (netScore > 15) direction = "bullish";
  else if (netScore < -15) direction = "bearish";
  else if (hasConflict) direction = "mixed";
  else direction = "neutral";

  const eventDesc = EVENT_DESCRIPTIONS[eventType];
  const sectorName = SECTOR_LABELS[sector];
  const stockRef = symbol ? `${symbol} (${sectorName})` : sectorName;
  const positiveModels = layers.filter(l => l.score > 0).map(l => l.model).join(", ");
  const negativeModels = layers.filter(l => l.score < 0).map(l => l.model).join(", ");

  const narrativeSummary = direction === "bullish"
    ? `${eventDesc.name} creates a net positive latticework for ${stockRef}. The first-order mechanics and reinforcing incentives (${positiveModels}) outweigh the counter-arguments, pointing to a bullish bias for ${symbol || "this stock"}.`
    : direction === "bearish"
    ? `${eventDesc.name} creates a net negative latticework for ${stockRef}. First-order mechanics and feedback loops (${negativeModels}) dominate, suggesting downside risk for ${symbol || "this stock"}.`
    : direction === "mixed"
    ? `${eventDesc.name} produces a mixed latticework for ${stockRef}. Strong positive and negative signals are pulling in opposite directions; the outcome depends on which second-order loop dominates.`
    : `${eventDesc.name} has a broadly neutral latticework for ${stockRef}. The positive and negative effects largely offset each other; stock-specific factors will drive the near-term move.`;

  const meta = EVENT_META[eventType];
  const optionsImplication = meta.optionsImpl;
  const durationOutlook = meta.duration;

  const inversionSignal = direction === "bullish"
    ? `Contrarian risk: if the market has already priced in the ${eventDesc.name.toLowerCase()} positives, the stock could be vulnerable to any negative surprise.`
    : direction === "bearish"
    ? `Contrarian opportunity: if the market over-discounts the ${eventDesc.name.toLowerCase()} negatives, a mean-reversion bounce or overshoot may create an entry point.`
    : `Contrarian watch: with mixed signals, wait for the market to overreact to one side before taking a directional position.`;

  return {
    layers,
    rawScore,
    netScore,
    direction,
    narrativeSummary,
    durationOutlook,
    optionsImplication,
    inversionSignal,
  };
}

export function computeMacroImpact(
  headlines: { title: string; pubDate: string }[],
  symbol: string,
): MacroImpactResult {
  const events = classifyHeadlines(headlines);
  const sector = getSector(symbol);

  if (events.length === 0) {
    return {
      events: [],
      primaryEvent: null,
      topEvents: [],
      latticework: null,
      sectorImpact: { direction: "neutral", score: 0, reason: "No macro events detected.", chain: "—" },
      macroScore: 0,
      macroSignal: "neutral",
      summary: "No significant macro events detected in recent headlines.",
    };
  }

  // Rank global drivers by frequency + severity so we are not hostage to a single headline.
  const severityWeight: Record<"high" | "medium" | "low", number> = { high: 3, medium: 2, low: 1 };
  const scoreByType: Record<MacroEventType, number> = {} as Record<MacroEventType, number>;
  const eventsByType: Record<MacroEventType, MacroEvent[]> = {} as Record<MacroEventType, MacroEvent[]>;
  for (const e of events) {
    scoreByType[e.type] = (scoreByType[e.type] ?? 0) + severityWeight[e.severity];
    eventsByType[e.type] = eventsByType[e.type] ?? [];
    eventsByType[e.type].push(e);
  }

  const rankedTypes = Object.entries(scoreByType)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([type]) => type as MacroEventType)
    .filter((t) => t !== "none")
    .slice(0, 3);

  if (rankedTypes.length === 0) {
    return {
      events: [],
      primaryEvent: null,
      topEvents: [],
      latticework: null,
      sectorImpact: { direction: "neutral", score: 0, reason: "No macro events detected.", chain: "—" },
      macroScore: 0,
      macroSignal: "neutral",
      summary: "No significant macro events detected in recent headlines.",
    };
  }

  const topEvents: EventImpact[] = rankedTypes.map((type, idx) => {
    const event = eventsByType[type][0];
    const latticework = computeLatticework(type, sector, symbol);
    const chain = transmissionChain(type, sector);
    return { event, latticework, chain, rank: idx + 1 };
  });

  const primaryEvent = topEvents[0].event;
  const primaryLatticework = topEvents[0].latticework;

  // Aggregate macro score: primary event gets 60% weight, the rest share 40%.
  const totalWeight = topEvents.reduce((sum, _te, idx) => sum + (idx === 0 ? 0.6 : 0.4 / (topEvents.length - 1)), 0);
  const macroScore = clamp(
    topEvents.reduce((sum, te, idx) => sum + te.latticework.netScore * (idx === 0 ? 0.6 : 0.4 / (topEvents.length - 1)) / totalWeight, 0),
    -100,
    100,
  );

  const sectorImpact: SectorImpact = {
    direction: primaryLatticework.direction === "mixed" ? "neutral" : primaryLatticework.direction,
    score: macroScore,
    reason: primaryLatticework.narrativeSummary,
    chain: topEvents[0].chain,
  };

  const driverList = topEvents.map((te) => `${eventLabel(te.event.type)} (${te.latticework.netScore >= 0 ? "+" : ""}${te.latticework.netScore})`).join(", ");
  const summary = `${topEvents.length} global driver(s) detected for ${symbol}: ${driverList}. The primary impact on ${SECTOR_LABELS[sector]} is ${primaryLatticework.direction} (score: ${macroScore >= 0 ? "+" : ""}${macroScore.toFixed(1)}). ${primaryLatticework.narrativeSummary} ${primaryLatticework.optionsImplication}`;

  return {
    events,
    primaryEvent,
    topEvents,
    latticework: primaryLatticework,
    sectorImpact,
    macroScore,
    macroSignal: primaryLatticework.direction,
    summary,
  };
}

function eventLabel(type: MacroEventType): string {
  const map: Record<string, string> = {
    oil_spike: "Oil spike", oil_drop: "Oil drop", rate_hike: "Rate hike", rate_cut: "Rate cut",
    geopolitical_risk: "Geopolitical risk", currency_inr_fall: "INR fall", currency_inr_rise: "INR rise",
    global_recession: "Recession risk", china_slowdown: "China slowdown", us_market_crash: "US crash",
    global_rally: "Global rally", inflation_spike: "Inflation spike", none: "No event",
  };
  return map[type] ?? type.replace(/_/g, " ");
}
