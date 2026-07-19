// ============================================================
// Fundamental / Company-Profile Layer (Pillar 5)
// ============================================================
// Gives the engine an understanding of WHAT the company is, not just how
// its price has behaved. Pulls a business profile + valuation/quality/
// growth fundamentals + the next earnings date, then converts them into:
//   - modest Bayesian evidence (valuation/quality/growth/analyst),
//   - a "Value Investor" persona in the council,
//   - earnings-in-horizon awareness (the biggest scheduled vol event for
//     options — IV crush risk).
//
// Honesty note: fundamentals are WEAK short-horizon predictors of price,
// so their likelihood ratios are deliberately small. Their biggest payoff
// here is the earnings-date awareness and richer context, not direction.

export interface CompanyProfile {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  longBusinessSummary: string | null;
  country: string | null;
  employees: number | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  profitMargins: number | null;    // decimal (0.15 = 15%)
  returnOnEquity: number | null;    // decimal
  revenueGrowth: number | null;     // decimal yoy
  earningsGrowth: number | null;    // decimal yoy
  debtToEquity: number | null;      // ratio (50 = 50%)
  recommendationKey: string | null; // strong_buy | buy | hold | sell | strong_sell
  targetMeanPrice: number | null;
  currentPrice: number | null;
  nextEarningsDate: string | null;  // ISO date
  fetchedAt: string;
}

export interface FundamentalTilts {
  valuation: number; // -1..1  cheap => +bullish, expensive => -bearish (slow mean reversion)
  quality: number;   // -1..1  high ROE/margins/low debt => +bullish
  growth: number;    // -1..1  revenue/earnings growth => +bullish
  analyst: number;   // -1..1  consensus + price target vs spot
  available: boolean;
  notes: string[];
}

function clampTilt(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

/** Convert a company profile into directional tilts in [-1, 1]. */
export function computeFundamentalTilts(
  profile: CompanyProfile | null,
  spotPrice: number,
): FundamentalTilts {
  if (!profile) {
    return { valuation: 0, quality: 0, growth: 0, analyst: 0, available: false, notes: [] };
  }

  const notes: string[] = [];

  // ── Valuation (slow mean reversion of multiples) ──
  let valuation = 0;
  const pe = profile.forwardPE ?? profile.trailingPE;
  if (pe !== null && pe > 0) {
    // ~20x is treated as fair; cheap below, expensive above (capped).
    valuation = clampTilt((20 - pe) / 25);
    notes.push(`${profile.forwardPE !== null ? "Forward" : "Trailing"} P/E ${pe.toFixed(1)} (${pe < 15 ? "cheap" : pe > 30 ? "rich" : "fair"}).`);
  } else if (pe !== null && pe <= 0) {
    valuation = -0.2;
    notes.push("Negative earnings — no valuation support.");
  }

  // ── Quality (ROE, margins, leverage) ──
  const qParts: number[] = [];
  if (profile.returnOnEquity !== null) {
    qParts.push(clampTilt((profile.returnOnEquity - 0.12) / 0.18));
  }
  if (profile.profitMargins !== null) {
    qParts.push(clampTilt((profile.profitMargins - 0.08) / 0.15));
  }
  if (profile.debtToEquity !== null) {
    qParts.push(clampTilt((80 - profile.debtToEquity) / 120));
  }
  const quality = qParts.length ? clampTilt(qParts.reduce((s, x) => s + x, 0) / qParts.length) : 0;
  if (qParts.length) {
    notes.push(`Quality: ROE ${profile.returnOnEquity !== null ? (profile.returnOnEquity * 100).toFixed(0) + "%" : "—"}, margin ${profile.profitMargins !== null ? (profile.profitMargins * 100).toFixed(0) + "%" : "—"}, D/E ${profile.debtToEquity !== null ? profile.debtToEquity.toFixed(0) : "—"}.`);
  }

  // ── Growth ──
  const gParts: number[] = [];
  if (profile.revenueGrowth !== null) gParts.push(clampTilt(profile.revenueGrowth / 0.25));
  if (profile.earningsGrowth !== null) gParts.push(clampTilt(profile.earningsGrowth / 0.30));
  const growth = gParts.length ? clampTilt(gParts.reduce((s, x) => s + x, 0) / gParts.length) : 0;
  if (gParts.length) {
    notes.push(`Growth: revenue ${profile.revenueGrowth !== null ? (profile.revenueGrowth * 100).toFixed(0) + "%" : "—"}, earnings ${profile.earningsGrowth !== null ? (profile.earningsGrowth * 100).toFixed(0) + "%" : "—"} yoy.`);
  }

  // ── Analyst consensus + price target ──
  let analyst = 0;
  const recMap: Record<string, number> = {
    strong_buy: 1, buy: 0.5, hold: 0, underperform: -0.5, sell: -0.7, strong_sell: -1,
  };
  const recTilt = profile.recommendationKey ? (recMap[profile.recommendationKey] ?? 0) : 0;
  let targetTilt = 0;
  if (profile.targetMeanPrice !== null && spotPrice > 0) {
    targetTilt = clampTilt((profile.targetMeanPrice / spotPrice - 1) * 4);
  }
  analyst = clampTilt(0.5 * recTilt + 0.5 * targetTilt);
  if (profile.recommendationKey || profile.targetMeanPrice !== null) {
    const upside = profile.targetMeanPrice !== null && spotPrice > 0
      ? ((profile.targetMeanPrice / spotPrice - 1) * 100).toFixed(0) + "% to target"
      : "no target";
    notes.push(`Analysts: ${profile.recommendationKey ?? "n/a"}, ${upside}.`);
  }

  return { valuation, quality, growth, analyst, available: true, notes };
}

export interface EarningsFlag {
  hasDate: boolean;
  date: string | null;
  daysAway: number | null;
  withinHorizon: boolean;
}

/** Is the next earnings report inside the forecast horizon? */
export function earningsWithinHorizon(
  profile: CompanyProfile | null,
  horizonDays: number,
): EarningsFlag {
  if (!profile?.nextEarningsDate) {
    return { hasDate: false, date: null, daysAway: null, withinHorizon: false };
  }
  const now = Date.now();
  const eDate = new Date(profile.nextEarningsDate).getTime();
  const daysAway = Math.round((eDate - now) / (24 * 60 * 60 * 1000));
  return {
    hasDate: true,
    date: profile.nextEarningsDate,
    daysAway,
    withinHorizon: daysAway >= 0 && daysAway <= horizonDays,
  };
}

// ─── Client fetch ───────────────────────────────────────────────────────────
export async function fetchCompanyProfile(symbol: string): Promise<CompanyProfile> {
  const res = await fetch(`/api/market-data/profile?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
