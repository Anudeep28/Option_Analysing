// Technical analysis utilities — IV analysis, indicators, behavioral signals

// --- IV Analysis ---

export interface IVAnalysis {
  currentIV: number;
  historicalVol: number;
  ivRank: number;
  ivPercentile: number;
  ivHvSpread: number;
  volRegime: "low" | "normal" | "elevated" | "extreme";
  interpretation: string;
}

export function computeIVAnalysis(
  currentIV: number,
  historicalVol: number,
  ivHistory?: number[],
): IVAnalysis {
  const ivHist = ivHistory && ivHistory.length > 10
    ? ivHistory
    : estimateIVHistory(historicalVol);

  const ivMin = Math.min(...ivHist);
  const ivMax = Math.max(...ivHist);
  const range = ivMax - ivMin;

  const ivRank = range > 0 ? ((currentIV - ivMin) / range) * 100 : 50;
  const ivPercentile = (ivHist.filter((v) => v < currentIV).length / ivHist.length) * 100;
  const ivHvSpread = currentIV - historicalVol;

  let volRegime: IVAnalysis["volRegime"];
  if (ivRank < 20) volRegime = "low";
  else if (ivRank < 60) volRegime = "normal";
  else if (ivRank < 85) volRegime = "elevated";
  else volRegime = "extreme";

  let interpretation: string;
  if (volRegime === "low") {
    interpretation = `IV is near 1-year lows (rank ${ivRank.toFixed(0)}%). Options are cheap — good time to BUY options.`;
  } else if (volRegime === "normal") {
    interpretation = `IV is in a normal range (rank ${ivRank.toFixed(0)}%). No strong edge from vol alone.`;
  } else if (volRegime === "elevated") {
    interpretation = `IV is elevated (rank ${ivRank.toFixed(0)}%). Options are expensive — consider SELLING or using spreads.`;
  } else {
    interpretation = `IV is at extremes (rank ${ivRank.toFixed(0)}%). Premium is very high — use defined-risk strategies only.`;
  }

  if (ivHvSpread > 0.05) {
    interpretation += ` IV exceeds HV by ${(ivHvSpread * 100).toFixed(1)}pp — options are richly priced.`;
  } else if (ivHvSpread < -0.03) {
    interpretation += ` IV is below HV by ${(Math.abs(ivHvSpread) * 100).toFixed(1)}pp — options may be underpriced.`;
  }

  return {
    currentIV: Math.max(0, currentIV),
    historicalVol: Math.max(0, historicalVol),
    ivRank: Math.max(0, Math.min(100, ivRank)),
    ivPercentile: Math.max(0, Math.min(100, ivPercentile)),
    ivHvSpread,
    volRegime,
    interpretation,
  };
}

function estimateIVHistory(hv: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 252; i++) {
    const noise = (Math.random() - 0.5) * 0.6;
    points.push(hv * (1 + noise));
  }
  return points;
}

// --- Option Chain Analytics ---

export interface OIAnalysis {
  putCallRatio: number;
  pcrInterpretation: string;
  maxPainStrike: number;
  maxPainInterpretation: string;
  topCallOIStrikes: { strike: number; oi: number }[];
  topPutOIStrikes: { strike: number; oi: number }[];
  unusualOI: { strike: number; type: "call" | "put"; oi: number; reason: string }[];
}

interface OIEntry {
  strikePrice: number;
  callOI: number;
  putOI: number;
}

export function computeOIAnalysis(entries: OIEntry[], spotPrice: number): OIAnalysis {
  if (entries.length === 0) {
    return {
      putCallRatio: 1,
      pcrInterpretation: "No data available.",
      maxPainStrike: spotPrice,
      maxPainInterpretation: "No data available.",
      topCallOIStrikes: [],
      topPutOIStrikes: [],
      unusualOI: [],
    };
  }

  const totalCallOI = entries.reduce((s, e) => s + e.callOI, 0);
  const totalPutOI = entries.reduce((s, e) => s + e.putOI, 0);
  const putCallRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 1;

  let pcrInterpretation: string;
  if (putCallRatio > 1.5) {
    pcrInterpretation = `PCR is very high (${putCallRatio.toFixed(2)}) — heavy put activity. Contrarian bullish signal.`;
  } else if (putCallRatio > 1.1) {
    pcrInterpretation = `PCR is moderately high (${putCallRatio.toFixed(2)}) — mildly bullish undertone.`;
  } else if (putCallRatio > 0.7) {
    pcrInterpretation = `PCR is balanced (${putCallRatio.toFixed(2)}) — no strong positioning bias.`;
  } else if (putCallRatio > 0.5) {
    pcrInterpretation = `PCR is low (${putCallRatio.toFixed(2)}) — call-heavy. Contrarian bearish signal.`;
  } else {
    pcrInterpretation = `PCR is very low (${putCallRatio.toFixed(2)}) — extreme call accumulation. Be cautious.`;
  }

  // Max Pain: strike where total loss to option writers is minimum
  let minPain = Infinity;
  let maxPainStrike = spotPrice;

  for (const entry of entries) {
    let pain = 0;
    for (const other of entries) {
      if (entry.strikePrice > other.strikePrice) {
        pain += other.callOI * (entry.strikePrice - other.strikePrice);
      }
      if (entry.strikePrice < other.strikePrice) {
        pain += other.putOI * (other.strikePrice - entry.strikePrice);
      }
    }
    if (pain < minPain) {
      minPain = pain;
      maxPainStrike = entry.strikePrice;
    }
  }

  const maxPainDist = ((maxPainStrike - spotPrice) / spotPrice) * 100;
  let maxPainInterpretation: string;
  if (Math.abs(maxPainDist) < 1) {
    maxPainInterpretation = `Max Pain at ₹${maxPainStrike} — near spot. Market likely stays range-bound till expiry.`;
  } else if (maxPainDist > 0) {
    maxPainInterpretation = `Max Pain at ₹${maxPainStrike} (+${maxPainDist.toFixed(1)}% above spot). Bullish positioning bias.`;
  } else {
    maxPainInterpretation = `Max Pain at ₹${maxPainStrike} (${maxPainDist.toFixed(1)}% below spot). Bearish positioning bias.`;
  }

  const sortedByCallOI = [...entries].sort((a, b) => b.callOI - a.callOI);
  const sortedByPutOI = [...entries].sort((a, b) => b.putOI - a.putOI);
  const topCallOIStrikes = sortedByCallOI.slice(0, 5).map((e) => ({ strike: e.strikePrice, oi: e.callOI }));
  const topPutOIStrikes = sortedByPutOI.slice(0, 5).map((e) => ({ strike: e.strikePrice, oi: e.putOI }));

  const avgCallOI = totalCallOI / entries.length;
  const avgPutOI = totalPutOI / entries.length;
  const unusualOI: OIAnalysis["unusualOI"] = [];

  for (const e of entries) {
    if (e.callOI > avgCallOI * 3) {
      unusualOI.push({
        strike: e.strikePrice, type: "call", oi: e.callOI,
        reason: `${(e.callOI / avgCallOI).toFixed(1)}x avg — strong resistance level`,
      });
    }
    if (e.putOI > avgPutOI * 3) {
      unusualOI.push({
        strike: e.strikePrice, type: "put", oi: e.putOI,
        reason: `${(e.putOI / avgPutOI).toFixed(1)}x avg — strong support level`,
      });
    }
  }

  return {
    putCallRatio,
    pcrInterpretation,
    maxPainStrike,
    maxPainInterpretation,
    topCallOIStrikes,
    topPutOIStrikes,
    unusualOI: unusualOI.slice(0, 6),
  };
}

// --- Technical Indicators ---

export interface TechnicalIndicators {
  rsi14: number;
  rsiSignal: "oversold" | "neutral" | "overbought";
  macd: { macd: number; signal: number; histogram: number };
  macdSignal: "bullish" | "neutral" | "bearish";
  bollingerBands: { upper: number; middle: number; lower: number; percentB: number };
  bbSignal: "oversold" | "neutral" | "overbought";
  sma50: number;
  sma200: number;
  trendDirection: "strong_uptrend" | "uptrend" | "sideways" | "downtrend" | "strong_downtrend";
  supportLevels: number[];
  resistanceLevels: number[];
  overallSignal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  overallScore: number;
  interpretation: string;
}

export function computeTechnicals(closes: number[]): TechnicalIndicators | null {
  if (closes.length < 50) return null;

  const current = closes[closes.length - 1];
  const rsi14 = computeRSI(closes, 14);
  const rsiSignal: TechnicalIndicators["rsiSignal"] =
    rsi14 < 30 ? "oversold" : rsi14 > 70 ? "overbought" : "neutral";

  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  const macdValues = ema12.slice(-50).map((v, i) => v - ema26[ema26.length - 50 + i]);
  const signalLine = computeEMAFromValues(macdValues, 9);
  const macdSignalVal = signalLine[signalLine.length - 1];
  const histogram = macdLine - macdSignalVal;
  const macdSignal: TechnicalIndicators["macdSignal"] =
    histogram > 0 && macdLine > 0 ? "bullish" : histogram < 0 && macdLine < 0 ? "bearish" : "neutral";

  const sma20 = computeSMA(closes, 20);
  const stdDev20 = computeStdDev(closes.slice(-20));
  const bbUpper = sma20 + 2 * stdDev20;
  const bbLower = sma20 - 2 * stdDev20;
  const percentB = bbUpper !== bbLower ? (current - bbLower) / (bbUpper - bbLower) : 0.5;
  const bbSignal: TechnicalIndicators["bbSignal"] =
    percentB < 0.1 ? "oversold" : percentB > 0.9 ? "overbought" : "neutral";

  const sma50 = computeSMA(closes, 50);
  const sma200 = closes.length >= 200 ? computeSMA(closes, 200) : sma50 * 0.98;

  let trendDirection: TechnicalIndicators["trendDirection"];
  if (current > sma50 && sma50 > sma200 && current > sma200 * 1.05) trendDirection = "strong_uptrend";
  else if (current > sma50 && current > sma200) trendDirection = "uptrend";
  else if (current < sma50 && sma50 < sma200 && current < sma200 * 0.95) trendDirection = "strong_downtrend";
  else if (current < sma50 && current < sma200) trendDirection = "downtrend";
  else trendDirection = "sideways";

  const { supports, resistances } = findPivotLevels(closes);

  let score = 0;
  if (rsi14 < 30) score += 20;
  else if (rsi14 < 40) score += 10;
  else if (rsi14 > 70) score -= 20;
  else if (rsi14 > 60) score -= 10;
  if (macdSignal === "bullish") score += 20;
  else if (macdSignal === "bearish") score -= 20;
  if (percentB < 0.1) score += 15;
  else if (percentB > 0.9) score -= 15;
  if (trendDirection === "strong_uptrend") score += 30;
  else if (trendDirection === "uptrend") score += 15;
  else if (trendDirection === "strong_downtrend") score -= 30;
  else if (trendDirection === "downtrend") score -= 15;
  if (current > sma50) score += 10;
  else score -= 10;
  score = Math.max(-100, Math.min(100, score));

  let overallSignal: TechnicalIndicators["overallSignal"];
  if (score >= 50) overallSignal = "strong_buy";
  else if (score >= 20) overallSignal = "buy";
  else if (score <= -50) overallSignal = "strong_sell";
  else if (score <= -20) overallSignal = "sell";
  else overallSignal = "neutral";

  const parts: string[] = [];
  if (trendDirection.includes("uptrend")) parts.push(`Stock in ${trendDirection.replace("_", " ")} — above 50 & 200 DMA.`);
  else if (trendDirection.includes("downtrend")) parts.push(`Stock in ${trendDirection.replace("_", " ")} — below 50 & 200 DMA.`);
  else parts.push("Stock trading sideways — between moving averages.");
  if (rsiSignal === "oversold") parts.push(`RSI ${rsi14.toFixed(0)} — oversold, potential bounce.`);
  else if (rsiSignal === "overbought") parts.push(`RSI ${rsi14.toFixed(0)} — overbought, momentum may fade.`);
  if (macdSignal === "bullish") parts.push("MACD positive — bullish momentum.");
  else if (macdSignal === "bearish") parts.push("MACD negative — bearish momentum.");

  return {
    rsi14, rsiSignal,
    macd: { macd: macdLine, signal: macdSignalVal, histogram },
    macdSignal,
    bollingerBands: { upper: bbUpper, middle: sma20, lower: bbLower, percentB },
    bbSignal, sma50, sma200, trendDirection,
    supportLevels: supports, resistanceLevels: resistances,
    overallSignal, overallScore: score,
    interpretation: parts.join(" "),
  };
}

// --- Behavioral / Fear & Greed ---

export interface BehavioralSignals {
  vixLevel?: number;
  vixInterpretation?: string;
  fiftyTwoWeekPosition: number;
  fiftyTwoWeekSignal: string;
  volumeSurge: boolean;
  volumeSurgeRatio?: number;
  fearGreedScore: number;
  fearGreedLabel: string;
  interpretation: string;
}

export function computeBehavioralSignals(
  currentPrice: number,
  high52w: number,
  low52w: number,
  currentVolume: number,
  avgVolume: number,
  rsi: number,
  ivRank: number,
  pcr: number,
  vixLevel?: number,
): BehavioralSignals {
  const range52w = high52w - low52w;
  const fiftyTwoWeekPosition = range52w > 0 ? ((currentPrice - low52w) / range52w) * 100 : 50;

  let fiftyTwoWeekSignal: string;
  if (fiftyTwoWeekPosition > 90) fiftyTwoWeekSignal = "Near 52-week high — strong momentum but overextension risk.";
  else if (fiftyTwoWeekPosition > 70) fiftyTwoWeekSignal = "Upper range — healthy uptrend territory.";
  else if (fiftyTwoWeekPosition > 30) fiftyTwoWeekSignal = "Mid range — no strong signal from price level.";
  else if (fiftyTwoWeekPosition > 10) fiftyTwoWeekSignal = "Lower range — potential value zone if fundamentals intact.";
  else fiftyTwoWeekSignal = "Near 52-week low — distressed or capitulation zone.";

  const volumeSurgeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  const volumeSurge = volumeSurgeRatio > 2;

  // Fear & Greed composite (0 = extreme fear, 100 = extreme greed)
  let fgScore = 50;
  // RSI contribution (30-70 maps to 0-100)
  fgScore += ((rsi - 50) / 50) * 20;
  // IV Rank contribution (inverted — high IV = fear)
  fgScore -= ((ivRank - 50) / 50) * 15;
  // PCR contribution (high PCR = fear, but contrarian bullish)
  if (pcr > 1.3) fgScore -= 10;
  else if (pcr < 0.7) fgScore += 10;
  // 52-week position
  fgScore += ((fiftyTwoWeekPosition - 50) / 50) * 10;
  // VIX
  if (vixLevel !== undefined) {
    if (vixLevel > 25) fgScore -= 15;
    else if (vixLevel > 18) fgScore -= 5;
    else if (vixLevel < 12) fgScore += 10;
  }
  fgScore = Math.max(0, Math.min(100, fgScore));

  let fearGreedLabel: string;
  if (fgScore < 20) fearGreedLabel = "Extreme Fear";
  else if (fgScore < 40) fearGreedLabel = "Fear";
  else if (fgScore < 60) fearGreedLabel = "Neutral";
  else if (fgScore < 80) fearGreedLabel = "Greed";
  else fearGreedLabel = "Extreme Greed";

  let vixInterpretation: string | undefined;
  if (vixLevel !== undefined) {
    if (vixLevel > 30) vixInterpretation = `VIX at ${vixLevel.toFixed(1)} — extreme fear. Options very expensive.`;
    else if (vixLevel > 20) vixInterpretation = `VIX at ${vixLevel.toFixed(1)} — elevated uncertainty.`;
    else if (vixLevel > 14) vixInterpretation = `VIX at ${vixLevel.toFixed(1)} — normal conditions.`;
    else vixInterpretation = `VIX at ${vixLevel.toFixed(1)} — extreme complacency. Cheap options.`;
  }

  const parts: string[] = [];
  parts.push(`Fear & Greed: ${fearGreedLabel} (${fgScore.toFixed(0)}/100).`);
  if (volumeSurge) parts.push(`Volume ${volumeSurgeRatio.toFixed(1)}x average — institutional activity.`);
  if (vixInterpretation) parts.push(vixInterpretation);
  parts.push(fiftyTwoWeekSignal);

  return {
    vixLevel, vixInterpretation,
    fiftyTwoWeekPosition, fiftyTwoWeekSignal,
    volumeSurge, volumeSurgeRatio,
    fearGreedScore: fgScore, fearGreedLabel,
    interpretation: parts.join(" "),
  };
}

// --- Helper functions ---

function computeRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function computeEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    ema.push(closes[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeEMAFromValues(values: number[], period: number): number[] {
  if (values.length === 0) return [0];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeSMA(closes: number[], period: number): number {
  const slice = closes.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function computeStdDev(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function findPivotLevels(closes: number[]): { supports: number[]; resistances: number[] } {
  const supports: number[] = [];
  const resistances: number[] = [];
  const lookback = Math.min(closes.length, 120);
  const data = closes.slice(-lookback);
  const current = data[data.length - 1];

  for (let i = 5; i < data.length - 5; i++) {
    const window = data.slice(i - 5, i + 6);
    const val = data[i];
    if (val === Math.min(...window) && val < current) supports.push(parseFloat(val.toFixed(2)));
    if (val === Math.max(...window) && val > current) resistances.push(parseFloat(val.toFixed(2)));
  }

  const dedup = (arr: number[]) => {
    const result: number[] = [];
    const sorted = [...arr].sort((a, b) => a - b);
    for (const v of sorted) {
      if (result.length === 0 || Math.abs(v - result[result.length - 1]) / result[result.length - 1] > 0.01) {
        result.push(v);
      }
    }
    return result;
  };

  return { supports: dedup(supports).slice(-3), resistances: dedup(resistances).slice(0, 3) };
}
