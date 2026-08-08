-- Schema for forecast tracking and real-world price comparison.
-- Run this SQL against your Railway Postgres database before using the
-- /history dashboard or saving forecasts.

CREATE TABLE IF NOT EXISTS pricing_runs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  symbol TEXT,
  spot_price NUMERIC NOT NULL,
  strike_price NUMERIC NOT NULL,
  option_type TEXT NOT NULL,
  option_style TEXT NOT NULL,
  pricing_method TEXT NOT NULL,

  risk_free_rate NUMERIC NOT NULL,
  dividend_yield NUMERIC NOT NULL,
  time_to_expiry_days NUMERIC NOT NULL,

  volatility NUMERIC NOT NULL,
  base_vol_source TEXT,
  sentiment_vol_adj_pct NUMERIC DEFAULT 0,
  macro_vol_adj_pct NUMERIC DEFAULT 0,
  mental_model_vol_adj_pct NUMERIC DEFAULT 0,
  calculated_vol_decimal NUMERIC,

  theoretical_price NUMERIC,
  market_ltp NUMERIC,

  sentiment_score NUMERIC,
  technical_score NUMERIC,
  macro_score NUMERIC,

  -- Predicted stock price at the horizon, using the same composed vol + drift
  -- signals that the UI forecast uses.
  predicted_stock_price NUMERIC,

  -- Comparison with real market data
  actual_stock_price NUMERIC,
  error_pct NUMERIC,
  compared_at TIMESTAMPTZ,

  -- Full snapshots for debugging / future analysis
  input_snapshot JSONB,
  result_snapshot JSONB
);

CREATE INDEX IF NOT EXISTS idx_pricing_runs_symbol ON pricing_runs(symbol);
CREATE INDEX IF NOT EXISTS idx_pricing_runs_created_at ON pricing_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS real_prices (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  price_date DATE NOT NULL,
  price NUMERIC NOT NULL,
  source TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(symbol, price_date)
);

CREATE INDEX IF NOT EXISTS idx_real_prices_symbol_date ON real_prices(symbol, price_date DESC);
