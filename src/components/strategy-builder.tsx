"use client";

import { useState } from "react";

interface StrategyLeg {
  type: "call" | "put";
  position: "buy" | "sell";
  strike: number;
  premium: number;
  quantity: number;
}

interface StrategyResult {
  name: string;
  legs: StrategyLeg[];
  maxProfit: number | "unlimited";
  maxLoss: number | "unlimited";
  breakevens: number[];
  netPremium: number;
  combinedGreeks: { delta: number; gamma: number; theta: number; vega: number };
}

const PRESET_STRATEGIES = [
  { name: "Bull Call Spread", legs: 2 },
  { name: "Bear Put Spread", legs: 2 },
  { name: "Long Straddle", legs: 2 },
  { name: "Short Straddle", legs: 2 },
  { name: "Long Strangle", legs: 2 },
  { name: "Iron Condor", legs: 4 },
  { name: "Covered Call", legs: 2 },
  { name: "Protective Put", legs: 2 },
  { name: "Custom", legs: 0 },
];

interface StrategyBuilderProps {
  spotPrice: number;
  optionChainData?: { strikePrice: number; callLTP: number; putLTP: number; callIV: number; putIV: number }[];
}

export function StrategyBuilder({ spotPrice, optionChainData }: StrategyBuilderProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [result, setResult] = useState<StrategyResult | null>(null);

  if (!spotPrice) return null;

  function applyPreset(name: string) {
    setSelectedPreset(name);
    const atm = spotPrice;
    const step = atm * 0.02; // ~2% OTM for spreads

    const findPremium = (strike: number, type: "call" | "put") => {
      if (!optionChainData) return type === "call" ? Math.max(atm - strike, 0) + atm * 0.02 : Math.max(strike - atm, 0) + atm * 0.02;
      const row = optionChainData.reduce((best, r) =>
        Math.abs(r.strikePrice - strike) < Math.abs(best.strikePrice - strike) ? r : best
      , optionChainData[0]);
      return type === "call" ? row.callLTP : row.putLTP;
    };

    let newLegs: StrategyLeg[] = [];
    switch (name) {
      case "Bull Call Spread":
        newLegs = [
          { type: "call", position: "buy", strike: Math.round(atm), premium: findPremium(atm, "call"), quantity: 1 },
          { type: "call", position: "sell", strike: Math.round(atm + step), premium: findPremium(atm + step, "call"), quantity: 1 },
        ];
        break;
      case "Bear Put Spread":
        newLegs = [
          { type: "put", position: "buy", strike: Math.round(atm), premium: findPremium(atm, "put"), quantity: 1 },
          { type: "put", position: "sell", strike: Math.round(atm - step), premium: findPremium(atm - step, "put"), quantity: 1 },
        ];
        break;
      case "Long Straddle":
        newLegs = [
          { type: "call", position: "buy", strike: Math.round(atm), premium: findPremium(atm, "call"), quantity: 1 },
          { type: "put", position: "buy", strike: Math.round(atm), premium: findPremium(atm, "put"), quantity: 1 },
        ];
        break;
      case "Short Straddle":
        newLegs = [
          { type: "call", position: "sell", strike: Math.round(atm), premium: findPremium(atm, "call"), quantity: 1 },
          { type: "put", position: "sell", strike: Math.round(atm), premium: findPremium(atm, "put"), quantity: 1 },
        ];
        break;
      case "Long Strangle":
        newLegs = [
          { type: "call", position: "buy", strike: Math.round(atm + step), premium: findPremium(atm + step, "call"), quantity: 1 },
          { type: "put", position: "buy", strike: Math.round(atm - step), premium: findPremium(atm - step, "put"), quantity: 1 },
        ];
        break;
      case "Iron Condor":
        newLegs = [
          { type: "put", position: "buy", strike: Math.round(atm - step * 2), premium: findPremium(atm - step * 2, "put"), quantity: 1 },
          { type: "put", position: "sell", strike: Math.round(atm - step), premium: findPremium(atm - step, "put"), quantity: 1 },
          { type: "call", position: "sell", strike: Math.round(atm + step), premium: findPremium(atm + step, "call"), quantity: 1 },
          { type: "call", position: "buy", strike: Math.round(atm + step * 2), premium: findPremium(atm + step * 2, "call"), quantity: 1 },
        ];
        break;
      case "Covered Call":
        newLegs = [
          { type: "call", position: "sell", strike: Math.round(atm + step), premium: findPremium(atm + step, "call"), quantity: 1 },
        ];
        break;
      case "Protective Put":
        newLegs = [
          { type: "put", position: "buy", strike: Math.round(atm - step), premium: findPremium(atm - step, "put"), quantity: 1 },
        ];
        break;
      default:
        newLegs = [{ type: "call", position: "buy", strike: Math.round(atm), premium: 0, quantity: 1 }];
    }
    setLegs(newLegs);
    setResult(null);
  }

  function updateLeg(index: number, field: keyof StrategyLeg, value: string | number) {
    const updated = legs.map((leg, i) => i === index ? { ...leg, [field]: value } : leg);
    setLegs(updated);
    setResult(null);
  }

  function addLeg() {
    setLegs([...legs, { type: "call", position: "buy", strike: Math.round(spotPrice), premium: 0, quantity: 1 }]);
  }

  function removeLeg(index: number) {
    setLegs(legs.filter((_, i) => i !== index));
    setResult(null);
  }

  function calculate() {
    if (legs.length === 0) return;

    const netPremium = legs.reduce((sum, leg) => {
      const sign = leg.position === "buy" ? -1 : 1;
      return sum + sign * leg.premium * leg.quantity;
    }, 0);

    // Calculate P&L at various spot prices
    const priceRange = spotPrice * 0.3;
    const prices = Array.from({ length: 100 }, (_, i) => spotPrice - priceRange + (i * priceRange * 2) / 99);

    const pnls = prices.map((price) => {
      let pnl = 0;
      for (const leg of legs) {
        const intrinsic = leg.type === "call"
          ? Math.max(price - leg.strike, 0)
          : Math.max(leg.strike - price, 0);
        const sign = leg.position === "buy" ? 1 : -1;
        pnl += sign * (intrinsic - leg.premium) * leg.quantity;
      }
      return pnl;
    });

    const maxProfit = Math.max(...pnls);
    const maxLoss = Math.min(...pnls);

    // Find breakevens (where P&L crosses zero)
    const breakevens: number[] = [];
    for (let i = 1; i < pnls.length; i++) {
      if ((pnls[i - 1] <= 0 && pnls[i] >= 0) || (pnls[i - 1] >= 0 && pnls[i] <= 0)) {
        const ratio = Math.abs(pnls[i - 1]) / (Math.abs(pnls[i - 1]) + Math.abs(pnls[i]));
        breakevens.push(parseFloat((prices[i - 1] + ratio * (prices[i] - prices[i - 1])).toFixed(2)));
      }
    }

    // Approximate combined Greeks (simplified)
    const combinedGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };
    for (const leg of legs) {
      const sign = leg.position === "buy" ? 1 : -1;
      const moneyness = (spotPrice - leg.strike) / spotPrice;
      const approxDelta = leg.type === "call"
        ? 0.5 + moneyness * 2
        : -0.5 + moneyness * 2;
      combinedGreeks.delta += sign * Math.max(-1, Math.min(1, approxDelta)) * leg.quantity;
      combinedGreeks.theta += sign * (-leg.premium * 0.05) * leg.quantity;
      combinedGreeks.vega += sign * (leg.premium * 0.15) * leg.quantity;
    }

    setResult({
      name: selectedPreset || "Custom",
      legs,
      maxProfit: pnls[pnls.length - 1] > maxProfit * 0.9 && maxProfit > spotPrice * 0.2 ? "unlimited" : maxProfit,
      maxLoss: pnls[0] < maxLoss * 0.9 && Math.abs(maxLoss) > spotPrice * 0.2 ? "unlimited" : maxLoss,
      breakevens,
      netPremium,
      combinedGreeks,
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span className="text-indigo-400">🏗️</span> Strategy Builder
      </h3>

      {/* Preset Selection */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESET_STRATEGIES.map((s) => (
          <button
            key={s.name}
            onClick={() => applyPreset(s.name)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              selectedPreset === s.name
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Legs Editor */}
      {legs.length > 0 && (
        <div className="space-y-2 mb-3">
          {legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-2 rounded bg-white/5 p-2">
              <select
                value={leg.position}
                onChange={(e) => updateLeg(i, "position", e.target.value)}
                className="bg-white/10 border border-white/20 rounded text-xs text-white px-1.5 py-1"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
              <select
                value={leg.type}
                onChange={(e) => updateLeg(i, "type", e.target.value)}
                className="bg-white/10 border border-white/20 rounded text-xs text-white px-1.5 py-1"
              >
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
              <input
                type="number"
                value={leg.strike}
                onChange={(e) => updateLeg(i, "strike", parseFloat(e.target.value) || 0)}
                className="bg-white/10 border border-white/20 rounded text-xs text-white px-2 py-1 w-20"
                placeholder="Strike"
              />
              <input
                type="number"
                value={leg.premium}
                onChange={(e) => updateLeg(i, "premium", parseFloat(e.target.value) || 0)}
                className="bg-white/10 border border-white/20 rounded text-xs text-white px-2 py-1 w-16"
                placeholder="Premium"
              />
              <input
                type="number"
                value={leg.quantity}
                onChange={(e) => updateLeg(i, "quantity", parseInt(e.target.value) || 1)}
                className="bg-white/10 border border-white/20 rounded text-xs text-white px-2 py-1 w-12"
                placeholder="Qty"
              />
              <button
                onClick={() => removeLeg(i)}
                className="text-red-400 hover:text-red-300 text-xs px-1"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={addLeg}
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded px-2 py-1"
            >
              + Add Leg
            </button>
            <button
              onClick={calculate}
              className="text-xs text-white bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-500/50 rounded px-3 py-1 font-medium"
            >
              Calculate
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <div className="text-xs font-semibold text-indigo-300 mb-2">{result.name} — Results</div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="rounded bg-white/5 p-2">
              <div className="text-xs text-white/50">Max Profit</div>
              <div className="text-sm font-bold text-green-400">
                {result.maxProfit === "unlimited" ? "Unlimited" : `₹${(result.maxProfit as number).toFixed(2)}`}
              </div>
            </div>
            <div className="rounded bg-white/5 p-2">
              <div className="text-xs text-white/50">Max Loss</div>
              <div className="text-sm font-bold text-red-400">
                {result.maxLoss === "unlimited" ? "Unlimited" : `₹${(result.maxLoss as number).toFixed(2)}`}
              </div>
            </div>
            <div className="rounded bg-white/5 p-2">
              <div className="text-xs text-white/50">Net Premium</div>
              <div className={`text-sm font-bold ${result.netPremium >= 0 ? "text-green-400" : "text-red-400"}`}>
                {result.netPremium >= 0 ? "Credit" : "Debit"} ₹{Math.abs(result.netPremium).toFixed(2)}
              </div>
            </div>
            <div className="rounded bg-white/5 p-2">
              <div className="text-xs text-white/50">Breakeven(s)</div>
              <div className="text-sm font-bold text-white">
                {result.breakevens.length > 0
                  ? result.breakevens.map((b) => `₹${b.toLocaleString()}`).join(", ")
                  : "N/A"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 text-center">
            <div className="rounded bg-white/5 p-1">
              <div className="text-[10px] text-white/40">Net Δ</div>
              <div className="text-xs font-medium text-white">{result.combinedGreeks.delta.toFixed(3)}</div>
            </div>
            <div className="rounded bg-white/5 p-1">
              <div className="text-[10px] text-white/40">Net Θ</div>
              <div className="text-xs font-medium text-white">{result.combinedGreeks.theta.toFixed(2)}</div>
            </div>
            <div className="rounded bg-white/5 p-1">
              <div className="text-[10px] text-white/40">Net ν</div>
              <div className="text-xs font-medium text-white">{result.combinedGreeks.vega.toFixed(2)}</div>
            </div>
            <div className="rounded bg-white/5 p-1">
              <div className="text-[10px] text-white/40">Risk/Reward</div>
              <div className="text-xs font-medium text-white">
                {result.maxProfit !== "unlimited" && result.maxLoss !== "unlimited"
                  ? `1:${Math.abs((result.maxProfit as number) / (result.maxLoss as number)).toFixed(1)}`
                  : "∞"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
