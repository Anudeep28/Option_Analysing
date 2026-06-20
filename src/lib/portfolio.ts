// ============================================================
// Portfolio Engine
// ============================================================
// Prices each option leg independently using Black-Scholes,
// then aggregates Greeks and computes net P&L across all legs.

import { blackScholesPrice, blackScholesGreeks } from "./pricing/black-scholes";
import type { OptionType, MarketData, Greeks } from "./types";

export type TradeSide = "buy" | "sell";

export interface OptionLeg {
  id: string;
  symbol: string;
  optionType: OptionType;
  strike: number;
  expiryDays: number;      // days to expiry from today
  entryPremium: number;    // price you paid/received per unit
  lots: number;
  lotSize: number;
  side: TradeSide;         // buy = long, sell = short
  // Shared market params (underlying-level, same for all legs on same underlying)
  spotPrice: number;
  riskFreeRate: number;    // decimal e.g. 0.065
  dividendYield: number;   // decimal
  volatility: number;      // decimal — will be overridden by GARCH if available
}

export interface LegResult {
  leg: OptionLeg;
  currentPremium: number;   // theoretical price right now
  greeks: Greeks;           // per-unit Greeks (signed for buy/sell)
  netGreeks: Greeks;        // greeks scaled by quantity and sign
  pnlPerUnit: number;       // current - entry (sell flips sign)
  totalPnL: number;         // pnlPerUnit × quantity
  quantity: number;         // lots × lotSize
  intrinsicValue: number;
  timeValue: number;
}

export interface PortfolioResult {
  legs: LegResult[];
  netPnL: number;
  netDelta: number;
  netGamma: number;
  netTheta: number;         // per day
  netVega: number;          // per 1% vol move
  netRho: number;
  netVanna?: number;
  netVolga?: number;
  totalInvestment: number;  // capital deployed (premiums paid net of received)
  netPnLPercent: number;
  // Scenario: net P&L of portfolio at spot ± n%
  spotScenarios: { spotChangePct: number; netPnL: number }[];
}

function marketFromLeg(leg: OptionLeg): MarketData {
  return {
    spotPrice: leg.spotPrice,
    strikePrice: leg.strike,
    riskFreeRate: leg.riskFreeRate,
    volatility: leg.volatility,
    timeToExpiry: Math.max(leg.expiryDays / 365, 1 / 365),
    dividendYield: leg.dividendYield,
  };
}

function scaleGreeks(g: Greeks, quantity: number, sign: number): Greeks {
  return {
    delta: g.delta * quantity * sign,
    gamma: g.gamma * quantity * sign,
    theta: (g.theta ?? 0) * quantity * sign,
    vega: (g.vega ?? 0) * quantity * sign,
    rho: (g.rho ?? 0) * quantity * sign,
    vanna: g.vanna !== undefined ? g.vanna * quantity * sign : undefined,
    volga: g.volga !== undefined ? g.volga * quantity * sign : undefined,
    charm: g.charm !== undefined ? g.charm * quantity * sign : undefined,
    speed: g.speed !== undefined ? g.speed * quantity * sign : undefined,
  };
}

function sumGreek(legs: LegResult[], key: keyof Greeks): number {
  return legs.reduce((s, l) => s + ((l.netGreeks[key] as number) ?? 0), 0);
}

const SPOT_MOVES = [-20, -15, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3, 5, 7, 10, 15, 20];

export function computePortfolio(legs: OptionLeg[]): PortfolioResult {
  const legResults: LegResult[] = legs.map((leg) => {
    const market = marketFromLeg(leg);
    const sign = leg.side === "buy" ? 1 : -1;
    const quantity = leg.lots * leg.lotSize;

    const currentPremium = blackScholesPrice(market, leg.optionType);
    const greeks = blackScholesGreeks(market, leg.optionType);
    const netGreeks = scaleGreeks(greeks, quantity, sign);

    // For a buy: P&L = (currentPremium - entryPremium) × qty
    // For a sell: P&L = (entryPremium - currentPremium) × qty (you received entry, you owe current)
    const pnlPerUnit = sign * (currentPremium - leg.entryPremium);
    const totalPnL = pnlPerUnit * quantity;

    const intrinsicValue = leg.optionType === "call"
      ? Math.max(leg.spotPrice - leg.strike, 0)
      : Math.max(leg.strike - leg.spotPrice, 0);

    return {
      leg,
      currentPremium,
      greeks,
      netGreeks,
      pnlPerUnit,
      totalPnL,
      quantity,
      intrinsicValue,
      timeValue: Math.max(currentPremium - intrinsicValue, 0),
    };
  });

  const netPnL = legResults.reduce((s, l) => s + l.totalPnL, 0);
  // Investment = net premium outflow (buys cost money, sells receive money)
  const totalInvestment = legResults.reduce((s, l) => {
    const q = l.quantity;
    return s + (l.leg.side === "buy" ? l.leg.entryPremium * q : -l.leg.entryPremium * q);
  }, 0);

  // Net Greeks
  const netDelta = sumGreek(legResults, "delta");
  const netGamma = sumGreek(legResults, "gamma");
  const netTheta = sumGreek(legResults, "theta");
  const netVega = sumGreek(legResults, "vega");
  const netRho = sumGreek(legResults, "rho");
  const netVanna = legResults.some((l) => l.netGreeks.vanna !== undefined)
    ? sumGreek(legResults, "vanna") : undefined;
  const netVolga = legResults.some((l) => l.netGreeks.volga !== undefined)
    ? sumGreek(legResults, "volga") : undefined;

  const netPnLPercent = totalInvestment !== 0 ? (netPnL / Math.abs(totalInvestment)) * 100 : 0;

  // Spot scenarios: re-price each leg at shifted spot
  const spotScenarios = SPOT_MOVES.map((pct) => {
    const scenarioPnL = legResults.reduce((s, lr) => {
      const futureSpot = lr.leg.spotPrice * (1 + pct / 100);
      const shiftedMarket: MarketData = { ...marketFromLeg(lr.leg), spotPrice: futureSpot };
      const futurePrice = blackScholesPrice(shiftedMarket, lr.leg.optionType);
      const sign = lr.leg.side === "buy" ? 1 : -1;
      const pnl = sign * (futurePrice - lr.leg.entryPremium) * lr.quantity;
      return s + pnl;
    }, 0);
    return { spotChangePct: pct, netPnL: scenarioPnL };
  });

  return {
    legs: legResults,
    netPnL, netDelta, netGamma, netTheta, netVega, netRho,
    netVanna, netVolga,
    totalInvestment, netPnLPercent,
    spotScenarios,
  };
}

export function newLeg(overrides: Partial<OptionLeg> = {}): OptionLeg {
  return {
    id: Math.random().toString(36).slice(2),
    symbol: "NIFTY",
    optionType: "call",
    strike: 25000,
    expiryDays: 30,
    entryPremium: 0,
    lots: 1,
    lotSize: 25,
    side: "buy",
    spotPrice: 25000,
    riskFreeRate: 0.065,
    dividendYield: 0,
    volatility: 0.15,
    ...overrides,
  };
}
