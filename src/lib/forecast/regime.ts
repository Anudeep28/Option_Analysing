// ============================================================
// Market Regime Detector
// ============================================================
// Classifies the current market into one of five regimes from the
// price series + (optional) VIX. The regime conditions everything
// downstream: mental-model weights flip, mean-reversion signals get
// amplified in choppy markets and crushed in trending crises.

export type Regime =
  | "trending_bull"
  | "trending_bear"
  | "mean_reverting"
  | "high_vol_crisis"
  | "calm_range";

export interface RegimeResult {
  regime: Regime;
  label: string;
  shortVol: number;       // annualized realized vol, ~20d window
  longVol: number;        // annualized realized vol, ~60d window
  volRatio: number;       // shortVol / longVol (>1 => vol expanding)
  autocorr: number;       // lag-1 autocorrelation of daily returns
  trendSlope: number;     // % drift per day over the lookback (annualized %)
  momentum20: number;     // % return over last 20 sessions
  description: string;
  // How much to trust momentum vs mean-reversion in this regime (0..1).
  momentumTrust: number;
  meanReversionTrust: number;
}

function dailyLogReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) r.push(Math.log(closes[i] / closes[i - 1]));
  }
  return r;
}

function annualizedVol(returns: number[], window: number): number {
  const slice = returns.slice(-window);
  if (slice.length < 5) return 0;
  const mean = slice.reduce((s, x) => s + x, 0) / slice.length;
  const variance = slice.reduce((s, x) => s + (x - mean) ** 2, 0) / (slice.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

function lag1Autocorr(returns: number[], window = 60): number {
  const slice = returns.slice(-window);
  if (slice.length < 10) return 0;
  const mean = slice.reduce((s, x) => s + x, 0) / slice.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < slice.length; i++) {
    den += (slice[i] - mean) ** 2;
    if (i > 0) num += (slice[i] - mean) * (slice[i - 1] - mean);
  }
  return den > 0 ? num / den : 0;
}

/**
 * Detect the prevailing market regime.
 * @param closes daily close prices, oldest first
 * @param vixLevel optional fear gauge (India VIX / VIX)
 */
export function detectRegime(closes: number[], vixLevel?: number): RegimeResult {
  const returns = dailyLogReturns(closes);
  const shortVol = annualizedVol(returns, 20);
  const longVol = annualizedVol(returns, 60) || shortVol || 0.0001;
  const volRatio = shortVol / Math.max(longVol, 1e-4);
  const autocorr = lag1Autocorr(returns, 60);

  // 20-session momentum
  const n = closes.length;
  const momentum20 = n > 21 ? (closes[n - 1] / closes[n - 21] - 1) * 100 : 0;

  // Trend slope: average daily log return over last 60 sessions, annualized to %
  const recent = returns.slice(-60);
  const avgDaily = recent.length ? recent.reduce((s, x) => s + x, 0) / recent.length : 0;
  const trendSlope = avgDaily * 252 * 100;

  const crisis = (vixLevel !== undefined && vixLevel >= 25) || volRatio >= 1.6;
  const strongTrend = Math.abs(momentum20) > 4 && Math.abs(autocorr) >= 0.08;

  let regime: Regime;
  if (crisis) {
    regime = "high_vol_crisis";
  } else if (strongTrend && momentum20 > 0) {
    regime = "trending_bull";
  } else if (strongTrend && momentum20 < 0) {
    regime = "trending_bear";
  } else if (autocorr <= -0.05) {
    regime = "mean_reverting";
  } else {
    regime = "calm_range";
  }

  const meta: Record<Regime, { label: string; description: string; momentumTrust: number; meanReversionTrust: number }> = {
    trending_bull: {
      label: "Trending Bull",
      description: `Persistent uptrend (+${momentum20.toFixed(1)}% over 20d, positive autocorrelation). Momentum signals are reliable; fading the move is dangerous.`,
      momentumTrust: 0.9, meanReversionTrust: 0.15,
    },
    trending_bear: {
      label: "Trending Bear",
      description: `Persistent downtrend (${momentum20.toFixed(1)}% over 20d, positive autocorrelation). Momentum signals are reliable; catching the falling knife is dangerous.`,
      momentumTrust: 0.9, meanReversionTrust: 0.15,
    },
    mean_reverting: {
      label: "Mean-Reverting / Choppy",
      description: `Negative return autocorrelation (${autocorr.toFixed(2)}) — moves tend to reverse. Fade extremes; chasing breakouts gets whipsawed.`,
      momentumTrust: 0.25, meanReversionTrust: 0.9,
    },
    high_vol_crisis: {
      label: "High-Vol / Crisis",
      description: `Volatility expanding (short/long vol ${volRatio.toFixed(2)}${vixLevel !== undefined ? `, VIX ${vixLevel.toFixed(1)}` : ""}). Correlations spike, tails fatten — size down and prefer defined-risk / long-vol structures.`,
      momentumTrust: 0.5, meanReversionTrust: 0.35,
    },
    calm_range: {
      label: "Calm Range",
      description: `Low, stable volatility with no dominant trend. Weak directional edge; theta-selling and range strategies tend to work.`,
      momentumTrust: 0.5, meanReversionTrust: 0.55,
    },
  };

  const m = meta[regime];
  return {
    regime,
    label: m.label,
    shortVol,
    longVol,
    volRatio,
    autocorr,
    trendSlope,
    momentum20,
    description: m.description,
    momentumTrust: m.momentumTrust,
    meanReversionTrust: m.meanReversionTrust,
  };
}
