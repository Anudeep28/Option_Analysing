export type OptionStyle = "european" | "american" | "asian" | "barrier" | "lookback";
export type OptionType = "call" | "put";
export type PricingMethod = "black-scholes" | "binomial-tree" | "monte-carlo";
export type BarrierType = "up-and-in" | "up-and-out" | "down-and-in" | "down-and-out";
export type AsianAverageType = "arithmetic" | "geometric";

export interface MarketData {
  spotPrice: number;
  strikePrice: number;
  riskFreeRate: number; // annualized, e.g. 0.05 for 5%
  volatility: number; // annualized, e.g. 0.20 for 20%
  timeToExpiry: number; // in years
  dividendYield: number; // annualized, e.g. 0.02 for 2%
}

export interface SimulationParams {
  numSimulations: number; // Monte Carlo paths
  timeSteps: number; // discrete time steps
  binomialSteps: number; // steps for binomial tree
}

export interface BarrierParams {
  barrierType: BarrierType;
  barrierLevel: number;
}

export interface AsianParams {
  averageType: AsianAverageType;
  observationFrequency: number; // number of observation points
}

export interface PricingInput {
  optionStyle: OptionStyle;
  optionType: OptionType;
  pricingMethod: PricingMethod;
  market: MarketData;
  simulation: SimulationParams;
  barrier?: BarrierParams;
  asian?: AsianParams;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface SimulationPath {
  timePoints: number[];
  prices: number[];
}

export interface PricingResult {
  price: number;
  greeks: Greeks;
  confidenceInterval?: [number, number]; // for Monte Carlo
  samplePaths?: SimulationPath[]; // for visualization
  executionTimeMs: number;
  method: PricingMethod;
  intrinsicValue: number;
  timeValue: number;
}

export interface AssetPreset {
  name: string;
  symbol: string;
  exchange: string;
  spotPrice: number;
  volatility: number;
  dividendYield: number;
}
