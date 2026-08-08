import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { insertForecast, listForecasts, type ForecastInsertInput } from "@/lib/db";
import { forecastStockMovement } from "@/lib/trade-decision";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Compute the predicted stock price using the same forecast engine as the
    // top-level StockForecast component.
    const predicted = forecastStockMovement({
      spotPrice: body.spot_price,
      volatility: body.volatility,
      days: body.time_to_expiry_days,
      riskFreeRate: body.risk_free_rate,
      dividendYield: body.dividend_yield,
      sentimentScore: body.sentiment_score ?? 0,
      technicalScore: body.technical_score ?? 0,
      macroScore: body.macro_score ?? 0,
    });

    const input: ForecastInsertInput = {
      symbol: body.symbol,
      spot_price: body.spot_price,
      strike_price: body.strike_price,
      option_type: body.option_type,
      option_style: body.option_style,
      pricing_method: body.pricing_method,
      risk_free_rate: body.risk_free_rate,
      dividend_yield: body.dividend_yield,
      time_to_expiry_days: body.time_to_expiry_days,
      volatility: body.volatility,
      base_vol_source: body.base_vol_source,
      sentiment_vol_adj_pct: body.sentiment_vol_adj_pct ?? 0,
      macro_vol_adj_pct: body.macro_vol_adj_pct ?? 0,
      mental_model_vol_adj_pct: body.mental_model_vol_adj_pct ?? 0,
      calculated_vol_decimal: body.calculated_vol_decimal,
      user_id: userId,
      theoretical_price: body.theoretical_price,
      market_ltp: body.market_ltp,
      sentiment_score: body.sentiment_score,
      technical_score: body.technical_score,
      macro_score: body.macro_score,
      predicted_stock_price: predicted.expectedPrice,
      input_snapshot: body.input_snapshot,
      result_snapshot: body.result_snapshot,
    };

    const id = await insertForecast(input);
    return Response.json({ id, predicted_stock_price: predicted.expectedPrice }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save forecast";
    console.error("POST /api/forecasts error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const symbol = request.nextUrl.searchParams.get("symbol");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "100", 10);
    const rows = await listForecasts(userId, symbol, isNaN(limit) ? 100 : limit);
    return Response.json(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch forecasts";
    console.error("GET /api/forecasts error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
