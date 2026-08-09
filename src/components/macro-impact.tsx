"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Globe, TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight,
  Brain, Scale, Lightbulb, Clock, ShieldAlert, Sparkles, ChevronDown, ChevronUp,
  Sigma, Percent,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { MacroImpactResult, MacroEvent, MentalModelLayer } from "@/lib/macro-impact";
import type { NewsNodeImpact, ValueChain, ValueChainNode } from "@/lib/value-chain";

// ─── Helpers ──────────────────────────────────────────────────

function eventLabel(type: MacroEvent["type"]): string {
  const map: Record<string, string> = {
    oil_spike:         "Oil Price Spike",
    oil_drop:          "Oil Price Drop",
    rate_hike:         "Interest Rate Hike",
    rate_cut:          "Interest Rate Cut",
    geopolitical_risk: "Geopolitical Conflict",
    currency_inr_fall: "INR Depreciation",
    currency_inr_rise: "INR Appreciation",
    global_recession:  "Global Recession Risk",
    china_slowdown:    "China Economic Slowdown",
    us_market_crash:   "US Market Crash",
    global_rally:      "Global Market Rally",
    inflation_spike:   "Inflation Spike",
    none:              "No Event",
  };
  return map[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function DirectionBadge({ direction, score }: { direction: MacroImpactResult["macroSignal"]; score: number }) {
  if (direction === "bullish") return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 text-sm font-bold">
      <TrendingUp className="size-3.5" /> Macro Bullish ({score >= 0 ? "+" : ""}{score})
    </span>
  );
  if (direction === "bearish") return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-300 dark:bg-red-950 dark:text-red-300 text-sm font-bold">
      <TrendingDown className="size-3.5" /> Macro Bearish ({score})
    </span>
  );
  if (direction === "mixed") return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 text-sm font-bold">
      <Minus className="size-3.5" /> Mixed Impact ({score >= 0 ? "+" : ""}{score})
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 text-sm font-bold">
      <Minus className="size-3.5" /> Macro Neutral
    </span>
  );
}

function LayerDirectionBadge({ direction }: { direction: MentalModelLayer["direction"] }) {
  if (direction === "bullish") return <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Bullish</span>;
  if (direction === "bearish") return <span className="text-[10px] font-bold uppercase tracking-wide text-red-600">Bearish</span>;
  return <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Neutral</span>;
}

function LayerIcon({ model }: { model: MentalModelLayer["model"] }) {
  const iconMap: Record<MentalModelLayer["model"], string> = {
    mechanics: "⚙️",
    incentives: "🎯",
    feedback_loop: "🔄",
    competitive: "⚔️",
    mean_reversion: "📈",
    inversion: "🪞",
    fiscal_policy: "🏛️",
    liquidity_flows: "💧",
    rural_demand: "🌾",
  };
  return <span className="text-base" aria-hidden="true">{iconMap[model]}</span>;
}

const MODEL_DESCRIPTIONS: Record<MentalModelLayer["model"], {
  definition: string;
  measures: string;
  scoring: string;
}> = {
  mechanics: {
    definition: "First-order causality — how the macro event directly alters the company's revenue, cost structure, or cash flows. Borrowed from physics: a cause produces a predictable mechanical effect before second-order reactions set in.",
    measures: "Direct P&L impact: does the event raise input costs, compress margins, or boost top-line revenue for this sector? A rate hike mechanically raises borrowing costs for leveraged businesses; an oil drop mechanically cuts fuel bills for airlines.",
    scoring: "Score range −100 to +100. Positive when the direct cash-flow effect is beneficial (revenue up or costs down). Negative when margins are squeezed. Weight: 20% of the net latticework score — it is the anchor layer.",
  },
  incentives: {
    definition: "Charlie Munger's 'Show me the incentive and I'll show you the outcome.' Asks: how does this event change what management, investors, regulators, and competitors are motivated to do? Incentives drive behaviour, which drives stock price.",
    measures: "Alignment of interests: does the macro shock incentivise management to accelerate capex, return cash, cut costs, or lobby for protection? Does it push FIIs to overweight or underweight the sector? Misaligned incentives create latent risk.",
    scoring: "Score range −100 to +100. Positive when the event aligns key stakeholders behind actions that benefit shareholders (e.g. tax cuts incentivise buybacks). Weight: 15% — important but slower-acting than mechanics.",
  },
  feedback_loop: {
    definition: "Second-order amplification or dampening. A macro event sets off a chain: the first effect changes behaviour, which changes prices, which changes more behaviour. Positive loops amplify; negative loops self-correct.",
    measures: "Does the initial shock get amplified (e.g. INR fall → higher import costs → inflation → rate hike → weaker growth → further INR fall) or dampened (e.g. oil spike → demand destruction → price normalises)? Identifies non-linear risk.",
    scoring: "Score range −100 to +100. Strongly negative when a reinforcing bearish loop is active; strongly positive when a virtuous cycle is in motion. Weight: 15% — high-impact during crisis or boom phases.",
  },
  competitive: {
    definition: "Porter-style competitive analysis: does the macro event tilt the playing field between this company/sector and its rivals — domestic or global? Relative performance matters as much as absolute impact.",
    measures: "Relative cost advantage or disadvantage versus peers. An INR depreciation hurts importers but boosts exporters vs global competition. A China slowdown reduces supply-chain competition for Indian manufacturers.",
    scoring: "Score range −100 to +100. Positive when the event advantages this sector vs alternatives. Weight: 10% — useful for sector-rotation decisions.",
  },
  mean_reversion: {
    definition: "Markets and economic variables tend to revert to long-run equilibria. Extreme macro events create overshoots that eventually correct. This model asks: how far is the current shock from the mean, and how fast will it revert?",
    measures: "Distance from historical average (e.g. oil at $120 vs $70 long-run mean). Reversion probability rises with the magnitude of the overshoot. Also captures whether the stock itself is trading at an extreme relative to fundamentals.",
    scoring: "Score range −100 to +100. Positive when a bearish shock is near a historical extreme (reversion = stock bounce). Negative when a bullish shock may have already been over-discounted. Weight: 10%.",
  },
  inversion: {
    definition: "Munger's inversion principle: instead of asking 'what could go right?', ask 'what would need to go wrong to destroy my thesis?' Then assess how likely that is. Pre-mortem thinking to surface hidden risks.",
    measures: "Identifies the scenario where the consensus narrative fails — the event that the market is not pricing. If everyone is bearish, what would flip sentiment? If the macro setup looks perfect, what asymmetric risk is being ignored?",
    scoring: "Score range −100 to +100. Positive when inversion reveals a contrarian tailwind (over-discounted bad news = buying opportunity). Negative when inversion reveals a hidden landmine in an apparently bullish setup. Weight: 10%.",
  },
  fiscal_policy: {
    definition: "The Indian government's and RBI's policy response to the macro event. Fiscal stimulus, interest-rate actions, currency intervention, sector-specific subsidies, and import/export duties all shape the second-order environment for stocks.",
    measures: "Likelihood and direction of policy reaction: will RBI cut/hike rates, will the government announce relief packages or tighten fiscal stance? Sectors with high policy sensitivity (banking, defence, FMCG, auto) are most affected.",
    scoring: "Derived from primary model scores: if mechanics and incentives are both negative, policy is likely to be stimulative (adds positive score); if both are positive, policy may tighten to prevent overheating (subtracts). Weight: 10%.",
  },
  liquidity_flows: {
    definition: "Tracks how the macro event shifts FII/DII allocation, RBI's open-market operations, credit growth, and broader liquidity conditions. Liquidity is the 'water level' that lifts or sinks all boats in the market.",
    measures: "FII risk-on/risk-off positioning, RBI repo rate stance, credit spreads, and banking-sector liquidity. A global risk-off event drains FII flows from EMs; a rate cut floods the system with cheap money.",
    scoring: "Derived from mechanics + feedback loop scores. Strong bearish mechanics in banking triggers a negative liquidity signal. Strong bullish feedback loops in IT/exports triggers positive flow signals. Weight: 5%.",
  },
  rural_demand: {
    definition: "India-specific model: rural India (~65% of population) drives demand for FMCG, auto (two-wheelers), fertilisers, and agri-inputs. Macro events that affect monsoon, MSP, rural wages, or crop prices have an outsized India-specific transmission channel.",
    measures: "Monsoon outlook, kharif/rabi crop yield expectations, rural wage growth (MGNREGA data), fertiliser subsidy, and farm-income proxies. Sectors like FMCG, Hero MotoCorp, and M&M are most sensitive.",
    scoring: "Derived from the incentives score modified by rural-sector exposure. High rural-demand sectors see amplified incentive effects when agri income rises. For non-rural sectors (IT, banking) this layer is typically near-zero. Weight: 5%.",
  },
};

function ModelDepthPanel({ layer }: { layer: MentalModelLayer }) {
  const desc = MODEL_DESCRIPTIONS[layer.model];
  const weightedContrib = layer.score * layer.weight;
  const barWidth = Math.min(Math.abs(layer.score), 100);
  const isPositive = layer.score >= 0;

  return (
    <div className="mt-2 pt-2 border-t border-dashed space-y-3">
      {/* Definition */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">What This Model Asks</p>
        <p className="text-xs leading-relaxed text-foreground/80">{desc.definition}</p>
      </div>

      {/* What it measures */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">What It Measures Here</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{desc.measures}</p>
      </div>

      {/* Scoring explanation + visual */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Score Breakdown</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{desc.scoring}</p>

        <div className="grid grid-cols-2 gap-2">
          {/* Raw score bar */}
          <div className="rounded border bg-muted/30 p-2 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Sigma className="size-3" /> Raw Score
            </div>
            <div className="h-1.5 bg-muted rounded-full relative overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={`absolute top-0 bottom-0 rounded-full ${
                  isPositive ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500"
                }`}
                style={{ width: `${barWidth / 2}%` }}
              />
            </div>
            <div className={`text-xs font-mono font-bold ${
              isPositive ? "text-emerald-600" : layer.score < 0 ? "text-red-600" : "text-slate-500"
            }`}>
              {isPositive ? "+" : ""}{layer.score}
            </div>
          </div>

          {/* Weighted contribution */}
          <div className="rounded border bg-muted/30 p-2 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Percent className="size-3" /> Weighted Contribution
            </div>
            <div className="h-1.5 bg-muted rounded-full relative overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={`absolute top-0 bottom-0 rounded-full ${
                  weightedContrib >= 0 ? "left-1/2 bg-blue-500" : "right-1/2 bg-orange-500"
                }`}
                style={{ width: `${Math.min(Math.abs(weightedContrib), 50)}%` }}
              />
            </div>
            <div className={`text-xs font-mono font-bold ${
              weightedContrib >= 0 ? "text-blue-600" : "text-orange-600"
            }`}>
              {weightedContrib >= 0 ? "+" : ""}{weightedContrib.toFixed(1)}
              <span className="text-[10px] text-muted-foreground font-normal ml-1">(weight {(layer.weight * 100).toFixed(0)}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chain Visualiser ─────────────────────────────────────────

function TransmissionChain({ chain }: { chain: string }) {
  const steps = chain.split("→").map((s) => s.trim()).filter(Boolean);
  if (steps.length <= 1) return <span className="text-xs text-muted-foreground">{chain}</span>;
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {steps.map((step, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className={`px-2 py-0.5 rounded border text-[10px] font-mono ${
            i === 0 ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" :
            i === steps.length - 1 ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 font-semibold" :
            "bg-muted/60 border-border text-muted-foreground"
          }`}>
            {step}
          </span>
          {i < steps.length - 1 && <ArrowRight className="size-3 text-muted-foreground/60 shrink-0" />}
        </span>
      ))}
    </div>
  );
}

// ─── Mental Model Layers Component ────────────────────────────

function MentalModelLayers({ layers }: { layers: MentalModelLayer[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (model: string) =>
    setExpanded((prev) => (prev === model ? null : model));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Scale className="size-3.5" /> Nine Mental Models
        <span className="text-[10px] text-muted-foreground font-normal ml-1">— click any model to expand its full analysis</span>
      </div>
      <div className="space-y-2">
        {layers.map((layer) => {
          const isOpen = expanded === layer.model;
          return (
            <div
              key={layer.model}
              className="rounded-lg border bg-muted/20 overflow-hidden"
            >
              {/* Header row — always visible */}
              <button
                type="button"
                className="w-full p-3 text-left"
                onClick={() => toggle(layer.model)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <LayerIcon model={layer.model} />
                    <span className="text-xs font-semibold">{layer.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <LayerDirectionBadge direction={layer.direction} />
                    <span className={`text-xs font-mono font-bold ${
                      layer.score > 0 ? "text-emerald-600" : layer.score < 0 ? "text-red-600" : "text-slate-500"
                    }`}>
                      {layer.score > 0 ? "+" : ""}{layer.score}
                    </span>
                    <span className="text-[10px] text-muted-foreground">({(layer.weight * 100).toFixed(0)}%)</span>
                    {isOpen
                      ? <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
                      : <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                    }
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">
                  {layer.reasoning}
                </p>
              </button>

              {/* Depth panel — visible when expanded */}
              {isOpen && (
                <div className="px-3 pb-3">
                  <ModelDepthPanel layer={layer} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Value-Chain Component Impact ─────────────────────────────

function nodeColor(type: ValueChainNode["type"]): string {
  const map: Record<ValueChainNode["type"], string> = {
    segment: "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
    product: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    component: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    supplier: "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
    geography: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    customer: "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
  };
  return map[type];
}

function ValueChainImpact({
  valueChain,
  componentImpacts,
}: {
  valueChain: ValueChain;
  componentImpacts?: NewsNodeImpact[];
}) {
  const nodeById = new Map(valueChain.nodes.map((n) => [n.id, n]));
  const impactsByNode = new Map<string, NewsNodeImpact[]>();
  if (componentImpacts) {
    for (const impact of componentImpacts) {
      const list = impactsByNode.get(impact.nodeId) ?? [];
      list.push(impact);
      impactsByNode.set(impact.nodeId, list);
    }
  }

  const topNodes = valueChain.nodes
    .filter((n) => impactsByNode.has(n.id))
    .sort((a, b) => {
      const aImpacts = impactsByNode.get(a.id) ?? [];
      const bImpacts = impactsByNode.get(b.id) ?? [];
      const aMax = Math.max(...aImpacts.map((i) => Math.abs(i.vector.costShock) + Math.abs(i.vector.demandShock) + Math.abs(i.vector.supplyRisk)));
      const bMax = Math.max(...bImpacts.map((i) => Math.abs(i.vector.costShock) + Math.abs(i.vector.demandShock) + Math.abs(i.vector.supplyRisk)));
      return bMax - aMax;
    })
    .slice(0, 6);

  if (topNodes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Value-chain decomposition is available, but no live headline mapped to a specific node.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Sigma className="size-3.5" /> Component-Level News Impact
        <span className="text-[10px] text-muted-foreground font-normal ml-1">value-chain tagged news</span>
      </div>
      <div className="space-y-2">
        {topNodes.map((node) => {
          const impacts = impactsByNode.get(node.id) ?? [];
          const parent = node.parentId ? nodeById.get(node.parentId) : undefined;
          return (
            <div key={node.id} className="rounded-lg border bg-muted/20 overflow-hidden">
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={`text-[10px] ${nodeColor(node.type)}`}>
                      {node.type}
                    </Badge>
                    <span className="text-xs font-semibold truncate">{node.name}</span>
                    {parent && <span className="text-[10px] text-muted-foreground truncate">under {parent.name}</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    r{(node.revenueShare ?? 0).toFixed(2)} / c{(node.costShare ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {impacts.slice(0, 2).map((impact, i) => (
                    <div key={i} className="text-xs text-muted-foreground leading-relaxed">
                      <span className={`font-mono font-bold ${
                        (impact.vector.costShock + impact.vector.demandShock + impact.vector.supplyRisk) > 0
                          ? "text-emerald-600"
                          : (impact.vector.costShock + impact.vector.demandShock + impact.vector.supplyRisk) < 0
                            ? "text-red-600"
                            : "text-slate-500"
                      }`}>
                        {impact.vector.costShock !== 0 && `cost ${impact.vector.costShock > 0 ? "+" : ""}${impact.vector.costShock.toFixed(1)} `}
                        {impact.vector.demandShock !== 0 && `demand ${impact.vector.demandShock > 0 ? "+" : ""}${impact.vector.demandShock.toFixed(1)} `}
                        {impact.vector.supplyRisk !== 0 && `supply ${impact.vector.supplyRisk > 0 ? "+" : ""}${impact.vector.supplyRisk.toFixed(1)} `}
                      </span>
                      {impact.vector.reasoning}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Full Value-Chain Tree ────────────────────────────────────

function ValueChainTree({ valueChain }: { valueChain: ValueChain }) {
  const [expanded, setExpanded] = useState(false);
  const childrenByParent = new Map<string, ValueChainNode[]>();
  for (const node of valueChain.nodes) {
    if (!node.parentId) continue;
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(node);
    childrenByParent.set(node.parentId, list);
  }
  const roots = valueChain.nodes.filter((n) => !n.parentId).sort((a, b) => (b.revenueShare ?? 0) - (a.revenueShare ?? 0));

  function renderNode(node: ValueChainNode, depth: number): React.ReactNode {
    const children = childrenByParent.get(node.id) ?? [];
    return (
      <div key={node.id} className="space-y-1.5">
        <div className="flex items-start gap-2" style={{ paddingLeft: depth * 14 }}>
          <Badge variant="outline" className={`text-[10px] shrink-0 mt-0.5 ${nodeColor(node.type)}`}>
            {node.type}
          </Badge>
          <div className="min-w-0">
            <div className="text-xs font-medium">{node.name}</div>
            <div className="text-[10px] text-muted-foreground leading-relaxed">
              {[
                node.revenueShare ? `rev ${(node.revenueShare * 100).toFixed(0)}%` : null,
                node.costShare ? `cost ${(node.costShare * 100).toFixed(0)}%` : null,
                node.importShare ? `import ${(node.importShare * 100).toFixed(0)}%` : null,
                node.confidence ? `${node.confidence} conf` : null,
                node.notes,
              ].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        {children.length > 0 && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-muted-foreground transition-colors"
      >
        <Sigma className="size-3.5" />
        Full Value-Chain Decomposition
        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        <span className="text-[10px] text-muted-foreground font-normal">{valueChain.nodes.length} nodes</span>
      </button>
      {expanded && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2 max-h-80 overflow-y-auto">
          {roots.map((root) => renderNode(root, 0))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

interface MacroImpactPanelProps {
  data: MacroImpactResult;
  symbol?: string;
  isLoading?: boolean;
}

export function MacroImpactPanel({ data, symbol, isLoading }: MacroImpactPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4 animate-pulse text-muted-foreground" />
            Live News Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground animate-pulse">Scanning global, India, and company news…</p>
        </CardContent>
      </Card>
    );
  }

  const { primaryEvent, sectorImpact, latticework, macroScore, macroSignal, topEvents } = data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="size-4" />
          Live News Impact
          {symbol && <Badge variant="outline" className="text-xs">{symbol}</Badge>}
        </CardTitle>
        <CardDescription>
          Live global, India, and company news analysed through Charlie Munger&apos;s latticework for this stock.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!primaryEvent ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Live news analysis is currently unavailable.
          </div>
        ) : (
          <>
            {/* ── Primary Event & Direction ── */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">News-driven price impact</span>
                    <Badge variant="outline" className="text-[10px]">Live synthesis</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground italic max-w-md">
                    Global market, India market, and {symbol ?? "company"}-specific headlines are analysed together.
                  </p>
                </div>
                <DirectionBadge direction={macroSignal} score={macroScore} />
              </div>

              <Separator />

              {/* Latticework Narrative */}
              {latticework && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Brain className="size-3.5" /> Munger Latticework Summary
                  </div>
                  <p className="text-sm leading-relaxed">{latticework.narrativeSummary}</p>
                </div>
              )}

              {/* LLM-enhanced Narrative */}
              {data.llm && (
                <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <Sparkles className="size-3.5" /> LLM-Enhanced Summary
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{data.llm.summary}</p>
                </div>
              )}

              {/* Transmission chain */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Transmission chain</p>
                <TransmissionChain chain={sectorImpact.chain} />
              </div>

              {/* Score bar */}
              {macroScore !== 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground flex justify-between">
                    <span>Bearish -100</span><span>Neutral 0</span><span>Bullish +100</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full relative overflow-hidden">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <div
                      className={`absolute top-0 bottom-0 rounded-full ${
                        macroScore >= 0 ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500"
                      }`}
                      style={{ width: `${Math.abs(macroScore) / 2}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Mental Model Layers ── */}
            {latticework && (
              <MentalModelLayers layers={latticework.layers} />
            )}

            {/* ── Component-Level News Impact (Option A) ── */}
            {data.valueChain && (
              <ValueChainImpact valueChain={data.valueChain} componentImpacts={data.componentImpacts} />
            )}

            {/* ── Full Value-Chain Tree ── */}
            {data.valueChain && (
              <ValueChainTree valueChain={data.valueChain} />
            )}

            {/* ── Second-Order Implications ── */}
            {latticework && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 space-y-1.5 bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <Clock className="size-3.5" /> Duration Outlook
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{latticework.durationOutlook}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1.5 bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <Lightbulb className="size-3.5" /> Options Implication
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{latticework.optionsImplication}</p>
                </div>
              </div>
            )}

            {/* ── Inversion Signal ── */}
            {latticework && (
              <div className="flex items-start gap-2 rounded-lg border p-3 bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900">
                <ShieldAlert className="size-4 text-purple-600 dark:text-purple-300 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Inversion / Contrarian Signal</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {data.llm?.inversionSignal ?? latticework.inversionSignal}
                  </p>
                </div>
              </div>
            )}

            {/* ── Top 3 Global Drivers ── */}
            {topEvents.length > 1 && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                  Additional news drivers
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {topEvents.map((te) => (
                    <div
                      key={te.event.type}
                      className={`rounded-lg border p-2.5 space-y-1 ${
                        te.event.type === primaryEvent?.type
                          ? "bg-muted/40 border-foreground/20"
                          : "bg-muted/20 border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{eventLabel(te.event.type)}</span>
                        <span className={`text-xs font-mono font-bold ${
                          te.latticework.netScore > 0 ? "text-emerald-600" : te.latticework.netScore < 0 ? "text-red-600" : "text-slate-500"
                        }`}>
                          {te.latticework.netScore > 0 ? "+" : ""}{te.latticework.netScore}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {te.latticework.narrativeSummary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Disclaimer ── */}
            <div className="flex items-start gap-2 rounded bg-muted/40 border px-3 py-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="size-3 mt-0.5 shrink-0" />
              <span>
                News impact is AI-generated from current global, India, and company headlines. It is directional analysis, not a precise price forecast.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
