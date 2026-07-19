"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Brain, Scale, Users, Target, Activity, CheckCircle2, Trash2, Building2, CalendarClock } from "lucide-react";
import { runForecast, type ForecastResult } from "@/lib/forecast/engine";
import type { TechnicalIndicators } from "@/lib/technicals";
import {
  logPrediction, resolveMatured, computeScoreboard, clearAllPredictions,
  type Scoreboard,
} from "@/lib/forecast/prediction-store";
import { fetchCompanyProfile, type CompanyProfile } from "@/lib/forecast/fundamentals";

interface SuperforecasterProps {
  closes: number[];
  spotPrice: number;
  technicals: TechnicalIndicators | null;
  garchVol: number | null;
  historicalVol: number;
  sentimentScore?: number;
  macroScore?: number;
  vixLevel?: number;
  symbol?: string;
  currency?: string;
}

const HORIZONS = [5, 10, 21, 42, 63];

function probColor(p: number): string {
  if (p >= 0.56) return "text-emerald-600 dark:text-emerald-400";
  if (p <= 0.44) return "text-red-500";
  return "text-amber-500";
}

function regimeBadgeCls(regime: string): string {
  switch (regime) {
    case "trending_bull": return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300";
    case "trending_bear": return "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300";
    case "high_vol_crisis": return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300";
    case "mean_reverting": return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300";
    default: return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300";
  }
}

function ProbBar({ p }: { p: number }) {
  return (
    <div className="h-2 bg-muted rounded-full relative overflow-hidden">
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <div
        className={`absolute top-0 bottom-0 ${p >= 0.5 ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500"} rounded-full`}
        style={{ width: `${Math.abs(p - 0.5) * 100}%` }}
      />
    </div>
  );
}

export function Superforecaster({
  closes, spotPrice, technicals, garchVol, historicalVol,
  sentimentScore, macroScore, vixLevel, symbol, currency = "₹",
}: SuperforecasterProps) {
  const [horizonDays, setHorizonDays] = useState(21);
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [justLogged, setJustLogged] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch the company profile (business + fundamentals + earnings date) when
  // the symbol changes. Fundamentals are optional — failures degrade silently.
  useEffect(() => {
    let cancelled = false;
    // Reset stale profile state when the symbol input changes, then kick off
    // the async fetch — an intentional sync with an external data source.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(null);
    if (!symbol) return;
    setProfileLoading(true);
    fetchCompanyProfile(symbol)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setProfile(null); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

  const forecast = useMemo<ForecastResult | null>(() => {
    if (!closes || closes.length < 30 || spotPrice <= 0) return null;
    return runForecast({
      closes, spotPrice, horizonDays, technicals,
      garchVol, historicalVol, sentimentScore, macroScore, vixLevel, profile,
    });
  }, [closes, spotPrice, horizonDays, technicals, garchVol, historicalVol, sentimentScore, macroScore, vixLevel, profile]);

  // Resolve matured predictions when fresh data loads, then refresh scoreboard.
  // This is an intentional sync from an external system (localStorage), not
  // derived render state.
  useEffect(() => {
    if (symbol && spotPrice > 0) resolveMatured(symbol, spotPrice);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScoreboard(computeScoreboard());
  }, [symbol, spotPrice]);

  if (!forecast) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Fetch a symbol with enough price history (50+ sessions) to run the Superforecaster engine.
        </CardContent>
      </Card>
    );
  }

  const { regime, baseRates, bayesian, dialectic, probUp, conviction, direction, expectedMovePct, earnings, earningsWarning } = forecast;

  const fmtPct = (v: number | null) => (v !== null ? `${(v * 100).toFixed(0)}%` : "—");
  const fmtNum = (v: number | null, d = 1) => (v !== null ? v.toFixed(d) : "—");
  const targetUpside = profile?.targetMeanPrice && spotPrice > 0
    ? (profile.targetMeanPrice / spotPrice - 1) * 100 : null;

  const handleLog = () => {
    if (!symbol) return;
    logPrediction({
      symbol,
      horizonDays,
      spotAtPrediction: spotPrice,
      probUp,
      direction,
      conviction,
      regime: regime.regime,
    });
    setScoreboard(computeScoreboard());
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 2500);
  };

  const handleClear = () => {
    clearAllPredictions();
    setScoreboard(computeScoreboard());
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="size-5" />
          Superforecaster
          {symbol && <Badge variant="outline" className="text-xs">{symbol}</Badge>}
          <Badge className={`text-xs border ${regimeBadgeCls(regime.regime)}`}>{regime.label}</Badge>
        </CardTitle>
        <CardDescription>
          Self-calibrating Bayesian ensemble: empirical base rates → likelihood-ratio fusion → regime conditioning → dialectic personas, with a live track record.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Horizon + Headline probability ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Horizon</Label>
            <select
              className="text-xs border rounded px-2 py-1 bg-background"
              value={horizonDays}
              onChange={(e) => setHorizonDays(parseInt(e.target.value))}
            >
              {HORIZONS.map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold font-mono ${probColor(probUp)}`}>
              {(probUp * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">P(up) • conviction {conviction}/100</div>
          </div>
        </div>
        <ProbBar p={probUp} />
        <p className="text-xs text-muted-foreground">{forecast.summary}</p>

        {/* ── Earnings-in-horizon warning ── */}
        {earningsWarning && (
          <div className="rounded px-3 py-2 text-xs border bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900 text-orange-800 dark:text-orange-300 flex items-start gap-2">
            <CalendarClock className="size-4 mt-0.5 shrink-0" />
            <span>{earningsWarning}</span>
          </div>
        )}

        <Separator />

        {/* ── Company profile + fundamentals (Pillar 5) ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Building2 className="size-4" /> Company & fundamentals
            {profileLoading && <span className="text-[10px] text-muted-foreground font-normal">loading…</span>}
          </p>
          {profile ? (
            <>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold text-foreground">{profile.name}</span>
                {profile.sector && <Badge variant="outline" className="text-[10px]">{profile.sector}</Badge>}
                {profile.industry && <Badge variant="outline" className="text-[10px]">{profile.industry}</Badge>}
              </div>
              {profile.longBusinessSummary && (
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4">
                  {profile.longBusinessSummary}
                </p>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs pt-1">
                <div className="rounded border bg-muted/20 p-1.5">
                  <p className="text-[9px] text-muted-foreground">Fwd P/E</p>
                  <p className="font-mono font-semibold">{fmtNum(profile.forwardPE ?? profile.trailingPE)}</p>
                </div>
                <div className="rounded border bg-muted/20 p-1.5">
                  <p className="text-[9px] text-muted-foreground">ROE</p>
                  <p className="font-mono font-semibold">{fmtPct(profile.returnOnEquity)}</p>
                </div>
                <div className="rounded border bg-muted/20 p-1.5">
                  <p className="text-[9px] text-muted-foreground">Margin</p>
                  <p className="font-mono font-semibold">{fmtPct(profile.profitMargins)}</p>
                </div>
                <div className="rounded border bg-muted/20 p-1.5">
                  <p className="text-[9px] text-muted-foreground">Rev growth</p>
                  <p className="font-mono font-semibold">{fmtPct(profile.revenueGrowth)}</p>
                </div>
                <div className="rounded border bg-muted/20 p-1.5">
                  <p className="text-[9px] text-muted-foreground">Analyst</p>
                  <p className="font-mono font-semibold capitalize">{profile.recommendationKey?.replace(/_/g, " ") ?? "—"}</p>
                </div>
                <div className="rounded border bg-muted/20 p-1.5">
                  <p className="text-[9px] text-muted-foreground">Target</p>
                  <p className={`font-mono font-semibold ${targetUpside !== null ? (targetUpside >= 0 ? "text-emerald-600" : "text-red-500") : ""}`}>
                    {targetUpside !== null ? `${targetUpside >= 0 ? "+" : ""}${targetUpside.toFixed(0)}%` : "—"}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="size-3" />
                {earnings.hasDate && earnings.date
                  ? `Next earnings: ${new Date(earnings.date).toLocaleDateString()} (~${earnings.daysAway}d)${earnings.withinHorizon ? " — inside horizon" : ""}`
                  : "Next earnings date unavailable"}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {profileLoading
                ? "Fetching company profile…"
                : "Fundamentals unavailable for this symbol — the forecast runs on price, sentiment, and macro evidence only."}
            </p>
          )}
        </div>

        <Separator />

        {/* ── Outside view → Inside view ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><Target className="size-4" /> Base rate → posterior</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded border bg-muted/20 p-2">
              <p className="text-[10px] text-muted-foreground">Prior (history)</p>
              <p className="font-mono font-bold text-base">{(baseRates.prior * 100).toFixed(0)}%</p>
            </div>
            <div className="rounded border bg-muted/20 p-2">
              <p className="text-[10px] text-muted-foreground">Evidence shift</p>
              <p className={`font-mono font-bold text-base ${bayesian.netLogOdds >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {bayesian.netLogOdds >= 0 ? "+" : ""}{(bayesian.netLogOdds).toFixed(2)}
              </p>
            </div>
            <div className="rounded border bg-blue-50 dark:bg-blue-950/30 p-2">
              <p className="text-[10px] text-muted-foreground">Posterior</p>
              <p className="font-mono font-bold text-base text-blue-600">{(bayesian.posterior * 100).toFixed(0)}%</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{baseRates.note}</p>
          <p className="text-[11px] text-muted-foreground">
            Typical {horizonDays}-day move ±{expectedMovePct.toFixed(1)}%. Historical tails: worst-5% avg {baseRates.downsideTailPct.toFixed(1)}%, best-5% avg +{baseRates.upsideTailPct.toFixed(1)}%.
          </p>
        </div>

        <Separator />

        {/* ── Evidence ledger (Bayesian) ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><Scale className="size-4" /> Evidence ledger (likelihood ratios)</p>
          <div className="space-y-1.5">
            {bayesian.ledger.map((l) => {
              const favorsUp = l.likelihoodRatio >= 1;
              return (
                <div key={l.factor} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground flex-1 truncate" title={l.rationale}>{l.factor}</span>
                  <span className="text-[10px] text-muted-foreground/70 w-16 text-right">trust {(l.trust * 100).toFixed(0)}%</span>
                  <span className={`font-mono font-semibold w-16 text-right ${favorsUp ? "text-emerald-600" : "text-red-500"}`}>
                    {favorsUp ? "▲" : "▼"} {l.likelihoodRatio.toFixed(2)}×
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">Price-derived signals are decorrelated into one momentum vote to avoid double-counting. LR &gt; 1 favors up.</p>
        </div>

        <Separator />

        {/* ── Dialectic personas ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><Users className="size-4" /> Forecaster council</p>
          <div className="space-y-1.5">
            {dialectic.views.map((v) => (
              <div key={v.name} className="flex items-center gap-2 text-xs">
                <span className="w-40 shrink-0 text-muted-foreground" title={v.rationale}>{v.name}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full relative overflow-hidden">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  <div
                    className={`absolute top-0 bottom-0 ${v.probUp >= 0.5 ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500"}`}
                    style={{ width: `${Math.abs(v.probUp - 0.5) * 100}%` }}
                  />
                </div>
                <span className={`font-mono w-10 text-right ${probColor(v.probUp)}`}>{(v.probUp * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div className={`rounded px-3 py-2 text-xs border ${dialectic.preferVolatilityPlay
            ? "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900 text-purple-800 dark:text-purple-300"
            : "bg-muted/40 border-border text-muted-foreground"}`}>
            <span className="font-semibold">Disagreement: {dialectic.disagreementLabel} (σ={dialectic.disagreement.toFixed(2)}).</span> {dialectic.recommendation}
          </div>
        </div>

        <Separator />

        {/* ── Scoreboard ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2"><Activity className="size-4" /> Track record (self-calibration)</p>
            {symbol && (
              <Button size="sm" variant={justLogged ? "secondary" : "default"} className="h-7 text-xs gap-1" onClick={handleLog}>
                {justLogged ? <><CheckCircle2 className="size-3.5" /> Logged</> : "Log this prediction"}
              </Button>
            )}
          </div>

          {scoreboard && scoreboard.resolved > 0 ? (
            <>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded border bg-muted/20 p-2">
                  <p className="text-[10px] text-muted-foreground">Brier</p>
                  <p className="font-mono font-bold">{scoreboard.brier!.toFixed(3)}</p>
                </div>
                <div className="rounded border bg-muted/20 p-2">
                  <p className="text-[10px] text-muted-foreground">Skill vs coin</p>
                  <p className={`font-mono font-bold ${scoreboard.skillVsCoinFlip! >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {scoreboard.skillVsCoinFlip! >= 0 ? "+" : ""}{scoreboard.skillVsCoinFlip!.toFixed(0)}%
                  </p>
                </div>
                <div className="rounded border bg-muted/20 p-2">
                  <p className="text-[10px] text-muted-foreground">Hit rate</p>
                  <p className="font-mono font-bold">{scoreboard.hitRate !== null ? `${(scoreboard.hitRate * 100).toFixed(0)}%` : "—"}</p>
                </div>
                <div className="rounded border bg-muted/20 p-2">
                  <p className="text-[10px] text-muted-foreground">High-conv hit</p>
                  <p className="font-mono font-bold">{scoreboard.highConvictionHitRate !== null ? `${(scoreboard.highConvictionHitRate * 100).toFixed(0)}%` : "—"}</p>
                </div>
              </div>

              {/* Calibration curve */}
              <div className="space-y-1 pt-1">
                <p className="text-[11px] text-muted-foreground">Calibration — predicted vs actual up-frequency:</p>
                {scoreboard.calibration.map((b) => (
                  <div key={b.rangeLabel} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 text-muted-foreground">{b.rangeLabel}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                      <div className="absolute top-0 bottom-0 left-0 bg-blue-400/60" style={{ width: `${b.predictedAvg * 100}%` }} />
                      <div className="absolute top-0 bottom-0 left-0 border-r-2 border-emerald-600" style={{ width: `${b.actualFreq * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono text-muted-foreground">n={b.count}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                <span>{scoreboard.resolved} resolved • {scoreboard.pending} pending</span>
                <button onClick={handleClear} className="inline-flex items-center gap-1 hover:text-red-500">
                  <Trash2 className="size-3" /> Reset
                </button>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {scoreboard && scoreboard.pending > 0
                ? `${scoreboard.pending} prediction(s) pending — they resolve automatically once the horizon elapses and you refetch the symbol. Brier score and calibration appear after the first resolution.`
                : "No predictions logged yet. Log a prediction to start building a verifiable track record (Brier score + calibration curve)."}
            </p>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/70">
          Educational use. Probabilities are model estimates, not guarantees. The point of the scoreboard is honesty: it will tell you if the model is actually calibrated. Currency: {currency}.
        </p>
      </CardContent>
    </Card>
  );
}
