// ============================================================
// Value-Chain Component Impact Engine — Option A
// ============================================================
// Per-node impact vectors are aggregated into stock-level mental
// model scores. A node can be a business segment, product, component,
// supplier, geography, or customer. Each node carries P&L weights so
// the aggregation is economically meaningful, not a naive average.

import type { LatticeworkAnalysis, MentalModelLayer, MentalModelName } from "./macro-impact";

export type ValueChainNodeType =
  | "segment"
  | "product"
  | "component"
  | "supplier"
  | "geography"
  | "customer";

export interface ValueChainNode {
  id: string;
  name: string;
  type: ValueChainNodeType;
  parentId?: string;
  // P&L and exposure weights — should sum to sensible totals per type
  revenueShare?: number;       // 0..1 share of company revenue
  costShare?: number;          // 0..1 share of company COGS/opex
  importShare?: number;        // 0..1 of this node that is imported
  marginSensitivity?: number;  // 0..1 how much company margin moves with this node
  geographies?: string[];
  supplierRegions?: string[];
  customers?: string[];
  tags?: string[];             // e.g. ["rural", "export", "imported", "china"]
  notes?: string;
  confidence?: "high" | "medium" | "low";
  source?: string;
}

export interface ValueChain {
  symbol: string;
  generatedAt: string;
  source?: string;
  nodes: ValueChainNode[];
}

export interface NodeImpactVector {
  costShock: number;         // -1..1  input cost / supply-price shock
  demandShock: number;       // -1..1  end-demand shock
  supplyRisk: number;        // -1..1  availability / disruption risk
  competitiveEffect: number; // -1..1  relative advantage vs peers
  policyEffect: number;      // -1..1  duties, subsidies, local-content rules
  reversion: number;         // -1..1  is the shock temporary / mean-reverting
  inversion: number;         // -1..1  contrarian / hidden risk signal
  reasoning?: string;
  confidence?: "high" | "medium" | "low";
}

export interface NewsNodeImpact {
  headline: string;
  headlineIndex: number;
  nodeId: string;
  nodeName?: string;
  vector: NodeImpactVector;
}

export interface ComponentImpactAggregation {
  modelScores: Record<MentalModelName, number>;
  netScore: number;
  topAffectedNodes: string[];
}

const MENTAL_MODELS: MentalModelName[] = [
  "mechanics",
  "incentives",
  "feedback_loop",
  "competitive",
  "mean_reversion",
  "inversion",
  "fiscal_policy",
  "liquidity_flows",
  "rural_demand",
];

const DEFAULT_WEIGHTS: Record<MentalModelName, number> = {
  mechanics: 0.22,
  incentives: 0.14,
  feedback_loop: 0.14,
  competitive: 0.10,
  mean_reversion: 0.08,
  inversion: 0.06,
  fiscal_policy: 0.10,
  liquidity_flows: 0.10,
  rural_demand: 0.06,
};

const valueChainCache = new Map<string, ValueChain>();

export function getCachedValueChain(symbol: string): ValueChain | undefined {
  return valueChainCache.get(symbol.toUpperCase());
}

export function setCachedValueChain(symbol: string, chain: ValueChain): void {
  valueChainCache.set(symbol.toUpperCase(), chain);
}

function isRural(node: ValueChainNode): boolean {
  if (node.tags?.some((t) => /rural|monsoon|msp|agri|farmer/i.test(t))) return true;
  const text = `${node.name} ${node.notes ?? ""}`;
  return /rural|monsoon|msp|agri|farmer/i.test(text);
}

function clamp(x: number, lo = -100, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Map a single node's impact vector to the nine mental-model scores.
 * Weights are driven by the node's P&L exposure so a cost shock on a
 * high-cost-share component matters more than the same shock on a fringe
 * line item.
 */
export function mapNodeVectorToModelScores(
  node: ValueChainNode,
  vector: NodeImpactVector,
): Record<MentalModelName, number> {
  const r = node.revenueShare ?? 0;
  const c = node.costShare ?? 0;
  const m = node.marginSensitivity ?? Math.max(r, c, 0.05);
  const exposure = Math.max(r, c, 0.05);

  const scores: Record<MentalModelName, number> = {
    mechanics: 100 * (vector.costShock * c + vector.demandShock * r + vector.supplyRisk * m),
    competitive: 100 * (vector.competitiveEffect * r),
    feedback_loop: 100 * (vector.supplyRisk * m + vector.costShock * c * 0.5),
    mean_reversion: 100 * (vector.reversion * exposure),
    inversion: 100 * (vector.inversion * exposure),
    fiscal_policy: 100 * (vector.policyEffect * exposure),
    incentives: 100 * ((vector.competitiveEffect * 0.4 + vector.policyEffect * 0.6) * exposure),
    liquidity_flows: 0,
    rural_demand: isRural(node) ? 100 * (vector.demandShock * r) : 0,
  };

  for (const model of MENTAL_MODELS) {
    scores[model] = clamp(scores[model]);
  }
  return scores;
}

/**
 * Aggregate per-node impact vectors into stock-level mental-model scores.
 * Each node's contribution is weighted by its P&L exposure, then the
 * resulting model scores are clamped and blended into a net score.
 */
export function aggregateNodeImpacts(
  valueChain: ValueChain,
  nodeImpacts: NewsNodeImpact[],
  weights?: Record<MentalModelName, number>,
): ComponentImpactAggregation {
  const nodeById = new Map(valueChain.nodes.map((n) => [n.id, n]));
  const totals: Record<MentalModelName, number> = {
    mechanics: 0,
    incentives: 0,
    feedback_loop: 0,
    competitive: 0,
    mean_reversion: 0,
    inversion: 0,
    fiscal_policy: 0,
    liquidity_flows: 0,
    rural_demand: 0,
  };

  for (const impact of nodeImpacts) {
    const node = nodeById.get(impact.nodeId);
    if (!node || !impact.vector) continue;
    const nodeScores = mapNodeVectorToModelScores(node, impact.vector);
    for (const model of MENTAL_MODELS) {
      totals[model] += nodeScores[model];
    }
  }

  const modelScores: Record<MentalModelName, number> = { ...totals };
  for (const model of MENTAL_MODELS) {
    modelScores[model] = clamp(modelScores[model]);
  }

  const w = weights ?? DEFAULT_WEIGHTS;
  let net = 0;
  for (const model of MENTAL_MODELS) {
    net += modelScores[model] * w[model];
  }
  net = clamp(net);

  const topAffected = [...new Set(nodeImpacts.map((i) => i.nodeName ?? i.nodeId))].slice(0, 5);

  return { modelScores, netScore: net, topAffectedNodes: topAffected };
}

function modelLabel(model: MentalModelName): string {
  const labels: Record<MentalModelName, string> = {
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
  return labels[model];
}

function layerDirection(score: number): MentalModelLayer["direction"] {
  if (score > 5) return "bullish";
  if (score < -5) return "bearish";
  return "neutral";
}

/**
 * Build a full LatticeworkAnalysis from a component impact aggregation.
 * Used as a fallback when the full LLM latticework is unavailable but
 * we have a value-chain + news-tagging result.
 */
export function buildLatticeworkFromComponentAnalysis(
  aggregation: ComponentImpactAggregation,
): LatticeworkAnalysis {
  const layers: MentalModelLayer[] = MENTAL_MODELS.map((model) => ({
    model,
    label: modelLabel(model),
    score: Math.round(aggregation.modelScores[model]),
    direction: layerDirection(aggregation.modelScores[model]),
    reasoning: `Aggregated from value-chain node impacts. Top affected: ${aggregation.topAffectedNodes.join(", ") || "none"}.`,
    weight: DEFAULT_WEIGHTS[model],
  }));

  const netScore = Math.round(aggregation.netScore);
  const direction: LatticeworkAnalysis["direction"] =
    netScore > 15
      ? "bullish"
      : netScore < -15
        ? "bearish"
        : Math.max(...layers.map((l) => l.score)) > 30 && Math.min(...layers.map((l) => l.score)) < -30
          ? "mixed"
          : "neutral";

  return {
    layers,
    rawScore: layers.reduce((s, l) => s + l.score, 0),
    netScore,
    direction,
    narrativeSummary: `Component-level news analysis points ${direction} with a net score of ${netScore}. Most affected nodes: ${aggregation.topAffectedNodes.join(", ") || "none"}.`,
    durationOutlook: "Duration depends on how persistent the component-specific shocks prove to be.",
    optionsImplication: `A ${direction} component tilt can shift implied vol on the affected input or end-market; watch for skew changes on ${aggregation.topAffectedNodes[0] || "key components"}.`,
    inversionSignal: `The contrarian case: the headline component shock may already be priced, or the real risk lies in a node not currently in the news.`,
  };
}

/**
 * Blend component-level model scores into an existing LLM latticework.
 * `blend` controls how much the value-chain evidence overrides the
 * top-down LLM view. Default 0.5 means equal weight.
 */
export function mergeLatticeworkWithComponentAnalysis(
  latticework: LatticeworkAnalysis,
  aggregation: ComponentImpactAggregation,
  blend = 0.5,
): LatticeworkAnalysis {
  const newLayers: MentalModelLayer[] = latticework.layers.map((layer) => {
    const comp = aggregation.modelScores[layer.model] ?? 0;
    const blended = layer.score * (1 - blend) + comp * blend;
    const score = Math.round(clamp(blended));
    return {
      ...layer,
      score,
      direction: layerDirection(score),
      reasoning:
        `${layer.reasoning} [Value-chain: ${aggregation.topAffectedNodes.slice(0, 3).join(", ") || "none"}]`,
    };
  });

  const netScore = Math.round(newLayers.reduce((s, l) => s + l.score * l.weight, 0));
  const direction: LatticeworkAnalysis["direction"] =
    netScore > 15
      ? "bullish"
      : netScore < -15
        ? "bearish"
        : Math.max(...newLayers.map((l) => l.score)) > 30 && Math.min(...newLayers.map((l) => l.score)) < -30
          ? "mixed"
          : "neutral";

  return {
    ...latticework,
    layers: newLayers,
    rawScore: newLayers.reduce((s, l) => s + l.score, 0),
    netScore,
    direction,
  };
}
