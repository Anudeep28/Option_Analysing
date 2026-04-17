import type { PricingInput, PricingResult } from "../types";
import { priceEuropeanBS } from "./black-scholes";
import { binomialTreePrice } from "./binomial-tree";
import { monteCarloPrice } from "./monte-carlo";

export function priceOption(input: PricingInput): PricingResult {
  const { optionStyle, optionType, pricingMethod, market, simulation, barrier, asian } = input;

  // Black-Scholes: only valid for European options without exotic features
  if (pricingMethod === "black-scholes") {
    if (optionStyle !== "european") {
      throw new Error("Black-Scholes is only valid for European options. Use Binomial Tree or Monte Carlo.");
    }
    if (barrier || asian) {
      throw new Error("Black-Scholes does not support barrier or Asian features. Use Monte Carlo.");
    }
    return priceEuropeanBS(market, optionType);
  }

  // Binomial Tree: European and American (no exotic features)
  if (pricingMethod === "binomial-tree") {
    if (optionStyle === "asian" || optionStyle === "barrier" || optionStyle === "lookback") {
      throw new Error("Binomial Tree does not support exotic options. Use Monte Carlo.");
    }
    return binomialTreePrice(market, optionType, optionStyle, simulation.binomialSteps);
  }

  // Monte Carlo: supports all option styles
  if (pricingMethod === "monte-carlo") {
    return monteCarloPrice({
      market,
      optionType,
      optionStyle,
      simulation,
      barrier: optionStyle === "barrier" ? barrier : undefined,
      asian: optionStyle === "asian" ? asian : undefined,
    });
  }

  throw new Error(`Unknown pricing method: ${pricingMethod}`);
}

export function getAvailableMethods(optionStyle: string): string[] {
  switch (optionStyle) {
    case "european":
      return ["black-scholes", "binomial-tree", "monte-carlo"];
    case "american":
      return ["binomial-tree", "monte-carlo"];
    case "asian":
    case "barrier":
    case "lookback":
      return ["monte-carlo"];
    default:
      return ["monte-carlo"];
  }
}
