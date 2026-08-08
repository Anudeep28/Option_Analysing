import { Pool, QueryResult } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const connectionString = process.env.DATABASE_URL;
const SCHEMA_PATH = join(process.cwd(), "scripts/schema.sql");

if (!connectionString) {
  // Don't throw during build — the route handlers/server components that use
  // the DB will fail at runtime with a clearer message if DATABASE_URL is missing.
  console.warn("DATABASE_URL is not set. Database features will be unavailable.");
}

// Re-use the same pool across hot reloads in development.
const globalForPg = globalThis as unknown as { __pgPool?: Pool };

export const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString,
    // Railway Postgres (and most managed Postgres) handles SSL termination at
    // the edge; rely on the DATABASE_URL for SSL settings. Fallback to
    // require/rejectUnauthorized if the host is not localhost.
    ssl:
      !connectionString || connectionString.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.__pgPool = pool;
}

let initPromise: Promise<void> | null = null;

async function runSchema(): Promise<void> {
  const sql = readFileSync(SCHEMA_PATH, "utf8");
  await pool.query(sql);
}

export async function initDb(): Promise<void> {
  if (initPromise) return initPromise;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  initPromise = runSchema().catch((err) => {
    console.error("Failed to ensure database schema:", err);
    initPromise = null;
    throw err;
  });
  return initPromise;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  await initDb();
  return pool.query<T>(text, params);
}

// ─── Forecast persistence helpers ───────────────────────────

export interface ForecastRow {
  [key: string]: unknown;
  id: number;
  created_at: string;
  symbol: string | null;
  spot_price: number;
  strike_price: number;
  option_type: string;
  option_style: string;
  pricing_method: string;
  risk_free_rate: number;
  dividend_yield: number;
  time_to_expiry_days: number;
  volatility: number;
  base_vol_source: string | null;
  sentiment_vol_adj_pct: number;
  macro_vol_adj_pct: number;
  mental_model_vol_adj_pct: number;
  calculated_vol_decimal: number | null;
  theoretical_price: number | null;
  market_ltp: number | null;
  sentiment_score: number | null;
  technical_score: number | null;
  macro_score: number | null;
  predicted_stock_price: number | null;
  actual_stock_price: number | null;
  error_pct: number | null;
  compared_at: string | null;
}

export interface ForecastInsertInput {
  symbol?: string | null;
  spot_price: number;
  strike_price: number;
  option_type: string;
  option_style: string;
  pricing_method: string;
  risk_free_rate: number;
  dividend_yield: number;
  time_to_expiry_days: number;
  volatility: number;
  base_vol_source?: string | null;
  sentiment_vol_adj_pct?: number;
  macro_vol_adj_pct?: number;
  mental_model_vol_adj_pct?: number;
  calculated_vol_decimal?: number | null;
  theoretical_price?: number | null;
  market_ltp?: number | null;
  sentiment_score?: number | null;
  technical_score?: number | null;
  macro_score?: number | null;
  predicted_stock_price?: number | null;
  input_snapshot?: Record<string, unknown>;
  result_snapshot?: Record<string, unknown>;
}

export async function insertForecast(input: ForecastInsertInput): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO pricing_runs (
      symbol, spot_price, strike_price, option_type, option_style, pricing_method,
      risk_free_rate, dividend_yield, time_to_expiry_days,
      volatility, base_vol_source, sentiment_vol_adj_pct, macro_vol_adj_pct, mental_model_vol_adj_pct,
      calculated_vol_decimal, theoretical_price, market_ltp,
      sentiment_score, technical_score, macro_score, predicted_stock_price,
      input_snapshot, result_snapshot
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    RETURNING id`,
    [
      input.symbol ?? null,
      input.spot_price,
      input.strike_price,
      input.option_type,
      input.option_style,
      input.pricing_method,
      input.risk_free_rate,
      input.dividend_yield,
      input.time_to_expiry_days,
      input.volatility,
      input.base_vol_source ?? null,
      input.sentiment_vol_adj_pct ?? 0,
      input.macro_vol_adj_pct ?? 0,
      input.mental_model_vol_adj_pct ?? 0,
      input.calculated_vol_decimal ?? null,
      input.theoretical_price ?? null,
      input.market_ltp ?? null,
      input.sentiment_score ?? null,
      input.technical_score ?? null,
      input.macro_score ?? null,
      input.predicted_stock_price ?? null,
      input.input_snapshot ? JSON.stringify(input.input_snapshot) : null,
      input.result_snapshot ? JSON.stringify(input.result_snapshot) : null,
    ],
  );
  return result.rows[0].id;
}

export async function listForecasts(
  symbol?: string | null,
  limit = 100,
): Promise<ForecastRow[]> {
  const sql = symbol
    ? `SELECT * FROM pricing_runs WHERE symbol = $1 ORDER BY created_at DESC LIMIT $2`
    : `SELECT * FROM pricing_runs ORDER BY created_at DESC LIMIT $1`;
  const params = symbol ? [symbol, limit] : [limit];
  const result = await query<ForecastRow>(sql, params);
  return result.rows;
}

export async function getForecastById(id: number): Promise<ForecastRow | null> {
  const result = await query<ForecastRow>("SELECT * FROM pricing_runs WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function upsertRealPrice(
  symbol: string,
  priceDate: string,
  price: number,
  source: string,
): Promise<void> {
  await query(
    `INSERT INTO real_prices (symbol, price_date, price, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (symbol, price_date) DO UPDATE
     SET price = EXCLUDED.price, source = EXCLUDED.source, fetched_at = NOW()`,
    [symbol, priceDate, price, source],
  );
}

export async function updateForecastComparison(
  id: number,
  actualStockPrice: number,
  errorPct: number,
): Promise<void> {
  await query(
    `UPDATE pricing_runs
     SET actual_stock_price = $1, error_pct = $2, compared_at = NOW()
     WHERE id = $3`,
    [actualStockPrice, errorPct, id],
  );
}
