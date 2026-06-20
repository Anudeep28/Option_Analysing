"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Trash2, TrendingUp, TrendingDown, BarChart3, BookOpen } from "lucide-react";
import { computePortfolio, newLeg, type OptionLeg, type PortfolioResult } from "@/lib/portfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2): string { return n.toFixed(d); }
function fmtSign(n: number, d = 2): string { return (n >= 0 ? "+" : "") + fmt(n, d); }
function fmtCcy(n: number, ccy: string, d = 0): string {
  return (n >= 0 ? "+" : "") + ccy + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function pnlColor(n: number): string {
  return n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

// ─── Leg Editor Row ───────────────────────────────────────────────────────────

function LegRow({
  leg, index, onChange, onRemove, currency,
}: {
  leg: OptionLeg; index: number;
  onChange: (id: string, patch: Partial<OptionLeg>) => void;
  onRemove: (id: string) => void;
  currency: string;
}) {
  const field = (patch: Partial<OptionLeg>) => onChange(leg.id, patch);

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leg {index + 1}</span>
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-red-500"
          onClick={() => onRemove(leg.id)}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Primary inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Symbol */}
        <div className="space-y-1">
          <Label className="text-[10px]">Underlying</Label>
          <Input className="h-7 text-xs" value={leg.symbol}
            onChange={(e) => field({ symbol: e.target.value.toUpperCase() })} />
        </div>

        {/* Option Type */}
        <div className="space-y-1">
          <Label className="text-[10px]">Type</Label>
          <Select value={leg.optionType} onValueChange={(v) => field({ optionType: v as "call" | "put" })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="call">Call (CE)</SelectItem>
              <SelectItem value="put">Put (PE)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Side */}
        <div className="space-y-1">
          <Label className="text-[10px]">Buy / Sell</Label>
          <Select value={leg.side} onValueChange={(v) => field({ side: v as "buy" | "sell" })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">Buy (Long)</SelectItem>
              <SelectItem value="sell">Sell (Short)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Strike */}
        <div className="space-y-1">
          <Label className="text-[10px]">Strike</Label>
          <Input className="h-7 text-xs" type="number" min={0} step="any" value={leg.strike}
            onChange={(e) => field({ strike: parseFloat(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Secondary inputs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {/* Entry Premium */}
        <div className="space-y-1 col-span-1">
          <Label className="text-[10px]">Entry ({currency})</Label>
          <Input className="h-7 text-xs" type="number" min={0} step="any"
            placeholder="e.g. 150"
            value={leg.entryPremium || ""}
            onChange={(e) => field({ entryPremium: parseFloat(e.target.value) || 0 })} />
        </div>

        {/* Lots */}
        <div className="space-y-1">
          <Label className="text-[10px]">Lots</Label>
          <Input className="h-7 text-xs" type="number" min={1} step={1} value={leg.lots}
            onChange={(e) => field({ lots: parseInt(e.target.value) || 1 })} />
        </div>

        {/* Lot Size */}
        <div className="space-y-1">
          <Label className="text-[10px]">Lot Size</Label>
          <Input className="h-7 text-xs" type="number" min={1} step={1} value={leg.lotSize}
            onChange={(e) => field({ lotSize: parseInt(e.target.value) || 1 })} />
        </div>

        {/* Days to Expiry */}
        <div className="space-y-1">
          <Label className="text-[10px]">Days to Expiry</Label>
          <Input className="h-7 text-xs" type="number" min={1} step={1} value={leg.expiryDays}
            onChange={(e) => field({ expiryDays: parseInt(e.target.value) || 1 })} />
        </div>

        {/* Spot Price */}
        <div className="space-y-1">
          <Label className="text-[10px]">Spot ({currency})</Label>
          <Input className="h-7 text-xs" type="number" min={0} step="any" value={leg.spotPrice}
            onChange={(e) => field({ spotPrice: parseFloat(e.target.value) || 0 })} />
        </div>

        {/* IV % */}
        <div className="space-y-1">
          <Label className="text-[10px]">IV (%)</Label>
          <Input className="h-7 text-xs" type="number" min={1} max={500} step="0.5"
            value={(leg.volatility * 100).toFixed(1)}
            onChange={(e) => field({ volatility: (parseFloat(e.target.value) || 15) / 100 })} />
        </div>
      </div>
    </div>
  );
}

// ─── Greeks Summary Row ───────────────────────────────────────────────────────

function GreekCell({ label, value, decimals = 4 }: { label: string; value: number; decimals?: number }) {
  return (
    <div className="text-center rounded border bg-muted/30 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-semibold ${value >= 0 ? "text-foreground" : "text-red-500"}`}>
        {fmtSign(value, decimals)}
      </div>
    </div>
  );
}

// ─── Scenario Chart (SVG sparkline) ──────────────────────────────────────────

function ScenarioChart({ scenarios, currency }: {
  scenarios: { spotChangePct: number; netPnL: number }[];
  currency: string;
}) {
  const max = Math.max(...scenarios.map((s) => Math.abs(s.netPnL)), 1);
  const h = 80;
  const w = scenarios.length;
  const zero = h / 2;
  const scale = (v: number) => zero - (v / max) * (zero * 0.9);

  return (
    <div className="space-y-1">
      <div className="relative h-20 rounded border bg-muted/20 overflow-hidden">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
          {/* Zero line */}
          <line x1="0" y1={zero} x2={w} y2={zero} stroke="currentColor"
            className="text-border" strokeWidth="0.3" />
          {/* Fill area */}
          <polyline
            points={scenarios.map((s, i) => `${i + 0.5},${scale(s.netPnL)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            className={scenarios[Math.floor(scenarios.length / 2)]?.netPnL >= 0 ? "text-emerald-500" : "text-red-500"}
            strokeWidth="1.5"
          />
          {/* Dots for current (0%) */}
          {scenarios.map((s, i) => s.spotChangePct === 0 && (
            <circle key={i} cx={i + 0.5} cy={scale(s.netPnL)} r="1.5"
              className={s.netPnL >= 0 ? "fill-emerald-500" : "fill-red-500"} />
          ))}
        </svg>
      </div>
      {/* Labels */}
      <div className="grid text-center text-[9px] text-muted-foreground"
        style={{ gridTemplateColumns: `repeat(${scenarios.length}, 1fr)` }}>
        {scenarios.map((s) => (
          <div key={s.spotChangePct}>
            <div>{s.spotChangePct >= 0 ? "+" : ""}{s.spotChangePct}%</div>
            <div className={pnlColor(s.netPnL)}>{fmtCcy(s.netPnL, currency, 0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PortfolioManagerProps {
  currency?: string;
  defaultSpot?: number;
  defaultVol?: number;
  defaultRfr?: number;
}

export function PortfolioManager({
  currency = "₹",
  defaultSpot = 25000,
  defaultVol = 0.15,
  defaultRfr = 0.065,
}: PortfolioManagerProps) {
  const [legs, setLegs] = useState<OptionLeg[]>([]);

  const addLeg = useCallback(() => {
    setLegs((prev) => [
      ...prev,
      newLeg({
        spotPrice: defaultSpot,
        volatility: defaultVol,
        riskFreeRate: defaultRfr,
        // Copy last leg's symbol/spot/vol for convenience
        ...(prev.length > 0 ? {
          symbol: prev[prev.length - 1].symbol,
          spotPrice: prev[prev.length - 1].spotPrice,
          volatility: prev[prev.length - 1].volatility,
          riskFreeRate: prev[prev.length - 1].riskFreeRate,
          lotSize: prev[prev.length - 1].lotSize,
        } : {}),
      }),
    ]);
  }, [defaultSpot, defaultVol, defaultRfr]);

  const updateLeg = useCallback((id: string, patch: Partial<OptionLeg>) => {
    setLegs((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const removeLeg = useCallback((id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearAll = useCallback(() => setLegs([]), []);

  const portfolio: PortfolioResult | null = useMemo(() => {
    if (legs.length === 0) return null;
    // Only price legs that have valid entry premium
    const priceable = legs.filter((l) => l.spotPrice > 0 && l.strike > 0 && l.volatility > 0);
    if (priceable.length === 0) return null;
    return computePortfolio(priceable);
  }, [legs]);

  const hasLegs = legs.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="size-5" />
            Options Portfolio
            {legs.length > 0 && (
              <Badge variant="secondary">{legs.length} leg{legs.length !== 1 ? "s" : ""}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Enter all your existing option positions. The app will price each leg using Black-Scholes and compute your combined exposure, Greeks, and P&L scenarios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Legs */}
          {legs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2">
              <BarChart3 className="size-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No positions added yet.</p>
              <p className="text-xs text-muted-foreground/70">
                Click "Add Leg" to enter an option from your demat account.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {legs.map((leg, i) => (
                <LegRow key={leg.id} leg={leg} index={i} onChange={updateLeg} onRemove={removeLeg} currency={currency} />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addLeg} className="gap-1.5">
              <PlusCircle className="size-4" />
              Add Leg
            </Button>
            {hasLegs && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground gap-1.5">
                <Trash2 className="size-4" />
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {portfolio && (
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="legs">Per-Leg Details</TabsTrigger>
            <TabsTrigger value="scenarios">Spot Scenarios</TabsTrigger>
            <TabsTrigger value="greeks">Portfolio Greeks</TabsTrigger>
          </TabsList>

          {/* ── Summary ── */}
          <TabsContent value="summary" className="mt-4">
            <Card>
              <CardContent className="pt-5 space-y-4">
                {/* Net P&L banner */}
                <div className={`rounded-lg border p-4 ${portfolio.netPnL >= 0 ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"}`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Portfolio P&L (current)</p>
                      <p className={`text-3xl font-bold font-mono mt-0.5 ${pnlColor(portfolio.netPnL)}`}>
                        {fmtCcy(portfolio.netPnL, currency, 2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Return</p>
                      <p className={`text-xl font-bold font-mono ${pnlColor(portfolio.netPnLPercent)}`}>
                        {fmtSign(portfolio.netPnLPercent, 1)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        on {currency}{Math.abs(portfolio.totalInvestment).toLocaleString(undefined, { maximumFractionDigits: 0 })} deployed
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Greeks */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  <GreekCell label="Net Δ Delta" value={portfolio.netDelta} />
                  <GreekCell label="Net Γ Gamma" value={portfolio.netGamma} decimals={6} />
                  <GreekCell label="Net Θ Theta/day" value={portfolio.netTheta} />
                  <GreekCell label="Net ν Vega/1%" value={portfolio.netVega} />
                  <GreekCell label="Net ρ Rho/1%" value={portfolio.netRho} />
                </div>

                {/* Interpretation */}
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-xs">
                  <p className="font-medium">Position Interpretation</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>
                      <span className="font-semibold text-foreground">Delta {fmtSign(portfolio.netDelta, 2)}</span>
                      {" — "}
                      {Math.abs(portfolio.netDelta) < 0.1
                        ? "Near delta-neutral. Limited directional exposure."
                        : portfolio.netDelta > 0
                          ? `Bullish bias. Portfolio gains ~${currency}${fmt(portfolio.netDelta, 0)} per ₹1 rise in underlying.`
                          : `Bearish bias. Portfolio gains ~${currency}${fmt(-portfolio.netDelta, 0)} per ₹1 fall in underlying.`}
                    </li>
                    <li>
                      <span className="font-semibold text-foreground">Theta {fmtSign(portfolio.netTheta, 2)}</span>
                      {" — "}
                      {portfolio.netTheta < 0
                        ? `Losing ${currency}${fmt(-portfolio.netTheta, 2)} per day to time decay (long options dominate).`
                        : `Earning ${currency}${fmt(portfolio.netTheta, 2)} per day from time decay (short options dominate).`}
                    </li>
                    <li>
                      <span className="font-semibold text-foreground">Vega {fmtSign(portfolio.netVega, 2)}</span>
                      {" — "}
                      {portfolio.netVega > 0
                        ? "Long volatility — gains if IV rises."
                        : "Short volatility — gains if IV falls."}
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Per-Leg Details ── */}
          <TabsContent value="legs" className="mt-4 space-y-3">
            {portfolio.legs.map((lr, i) => {
              const { leg } = lr;
              return (
                <Card key={leg.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">Leg {i + 1}</Badge>
                        <Badge variant={leg.side === "buy" ? "default" : "secondary"}>{leg.side.toUpperCase()}</Badge>
                        <Badge variant={leg.optionType === "call" ? "default" : "destructive"} className="text-xs">
                          {leg.symbol} {leg.strike} {leg.optionType.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{leg.expiryDays}d to expiry</span>
                      </div>
                      <div className={`text-lg font-bold font-mono ${pnlColor(lr.totalPnL)}`}>
                        {fmtCcy(lr.totalPnL, currency, 2)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="text-muted-foreground">Entry Premium</div>
                        <div className="font-mono font-semibold">{currency}{fmt(leg.entryPremium, 2)}</div>
                      </div>
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="text-muted-foreground">Current (Theoretical)</div>
                        <div className="font-mono font-semibold">{currency}{fmt(lr.currentPremium, 2)}</div>
                      </div>
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="text-muted-foreground">P&L / Unit</div>
                        <div className={`font-mono font-semibold ${pnlColor(lr.pnlPerUnit)}`}>
                          {fmtSign(lr.pnlPerUnit, 2)} {currency}
                        </div>
                      </div>
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="text-muted-foreground">Quantity</div>
                        <div className="font-mono font-semibold">{lr.quantity} ({leg.lots}L × {leg.lotSize})</div>
                      </div>
                    </div>

                    <Separator className="my-3" />
                    <div className="grid grid-cols-5 gap-2">
                      <GreekCell label="Δ Delta" value={lr.netGreeks.delta} />
                      <GreekCell label="Γ Gamma" value={lr.netGreeks.gamma} decimals={5} />
                      <GreekCell label="Θ Theta" value={lr.netGreeks.theta} />
                      <GreekCell label="ν Vega" value={lr.netGreeks.vega} />
                      <GreekCell label="ρ Rho" value={lr.netGreeks.rho} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ── Spot Scenarios ── */}
          <TabsContent value="scenarios" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Net P&L at Different Spot Levels</CardTitle>
                <CardDescription>
                  Each leg re-priced using Black-Scholes at the shifted spot. All other params (vol, time, rates) held constant.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScenarioChart scenarios={portfolio.spotScenarios} currency={currency} />

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-center">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-2 text-left font-medium text-muted-foreground">Spot Move</th>
                        {portfolio.spotScenarios.map((s) => (
                          <th key={s.spotChangePct} className="pb-2 font-mono text-muted-foreground">
                            {s.spotChangePct >= 0 ? "+" : ""}{s.spotChangePct}%
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1.5 text-left text-muted-foreground">Net P&L</td>
                        {portfolio.spotScenarios.map((s) => (
                          <td key={s.spotChangePct} className={`py-1.5 font-mono font-semibold ${pnlColor(s.netPnL)}`}>
                            {fmtCcy(s.netPnL, currency, 0)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Break-even note */}
                {(() => {
                  const beZone = portfolio.spotScenarios.filter((s) => Math.abs(s.netPnL) < Math.abs(portfolio.netPnL) * 0.05);
                  if (beZone.length > 0) {
                    return (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Break-even zone</span>{" "}
                        near {beZone.map((s) => `${s.spotChangePct >= 0 ? "+" : ""}${s.spotChangePct}%`).join(", ")} spot move.
                      </p>
                    );
                  }
                  return null;
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Portfolio Greeks ── */}
          <TabsContent value="greeks" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Aggregated Portfolio Greeks</CardTitle>
                <CardDescription>
                  Net exposure across all legs (buy legs add, sell legs subtract, scaled by quantity).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Net Delta (Δ)", val: portfolio.netDelta, d: 4, desc: "₹ gain per ₹1 spot move" },
                    { label: "Net Gamma (Γ)", val: portfolio.netGamma, d: 6, desc: "Delta change per ₹1 spot move" },
                    { label: "Net Theta (Θ/day)", val: portfolio.netTheta, d: 2, desc: "P&L per calendar day" },
                    { label: "Net Vega (ν/1%)", val: portfolio.netVega, d: 2, desc: "P&L per 1% vol change" },
                    { label: "Net Rho (ρ/1%)", val: portfolio.netRho, d: 2, desc: "P&L per 1% rate change" },
                    ...(portfolio.netVanna !== undefined ? [{ label: "Net Vanna", val: portfolio.netVanna, d: 4, desc: "Delta drift per 1% vol" }] : []),
                    ...(portfolio.netVolga !== undefined ? [{ label: "Net Volga", val: portfolio.netVolga, d: 4, desc: "Vega convexity" }] : []),
                  ].map(({ label, val, d, desc }) => (
                    <div key={label} className="rounded-lg border p-3 space-y-0.5">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`text-xl font-bold font-mono ${pnlColor(val)}`}>{fmtSign(val, d)}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>

                {/* Hedge suggestion */}
                <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
                  <p className="font-medium">Quick Hedge Insight</p>
                  <p className="text-muted-foreground">
                    {Math.abs(portfolio.netDelta) < 0.05
                      ? "Portfolio is approximately delta-neutral — good for volatility plays."
                      : portfolio.netDelta > 0
                        ? `Long ${fmt(portfolio.netDelta, 2)} delta. To hedge directional risk: sell futures or add put options worth ~${fmt(portfolio.netDelta, 2)} delta.`
                        : `Short ${fmt(-portfolio.netDelta, 2)} delta. To hedge: buy futures or add call options worth ~${fmt(-portfolio.netDelta, 2)} delta.`}
                  </p>
                  {Math.abs(portfolio.netTheta) > 10 && (
                    <p className="text-muted-foreground">
                      {portfolio.netTheta < 0
                        ? `⚠ Significant theta bleed: losing ~${currency}${fmt(-portfolio.netTheta * 7, 0)} per week if spot stays flat.`
                        : `✓ Collecting ~${currency}${fmt(portfolio.netTheta * 7, 0)} per week in theta if spot stays flat.`}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Empty state instructions */}
      {!hasLegs && (
        <Card className="border-dashed">
          <CardContent className="pt-5">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How to use:</p>
              <ol className="space-y-1 list-decimal list-inside text-xs">
                <li>Click <strong>Add Leg</strong> for each option in your demat account</li>
                <li>Enter the <strong>strike, call/put, buy/sell, lots, lot size</strong></li>
                <li>Enter the <strong>entry premium</strong> — the price you originally paid/received</li>
                <li>Set the current <strong>spot price, IV, and days to expiry</strong></li>
                <li>The app prices each leg with Black-Scholes and shows <strong>combined P&L, Greeks, and scenarios</strong></li>
              </ol>
              <p className="text-[11px] text-muted-foreground/70 pt-1">
                Tip: For NSE options, standard lot sizes are NIFTY=25, BANKNIFTY=15, SENSEX=10. IV is the implied volatility — use the main pricer to solve for it from the current market LTP.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
