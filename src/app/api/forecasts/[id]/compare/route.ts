import { NextRequest } from "next/server";
import { auth } from "@/lib/session-server";
import { getForecastById, updateForecastComparison, upsertRealPrice } from "@/lib/db";
import { fetchYahooQuote } from "@/lib/yahoo-finance";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    return Response.json({ error: "Invalid forecast id" }, { status: 400 });
  }

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const forecast = await getForecastById(id, userId);
    if (!forecast) {
      return Response.json({ error: "Forecast not found" }, { status: 404 });
    }
    if (!forecast.symbol) {
      return Response.json(
        { error: "Forecast has no symbol to compare against" },
        { status: 400 },
      );
    }

    const quote = await fetchYahooQuote(forecast.symbol);
    const actualPrice = quote.lastPrice;
    const priceDate = quote.timestamp.slice(0, 10);

    await upsertRealPrice(forecast.symbol, priceDate, actualPrice, "yahoo");

    const errorPct =
      forecast.predicted_stock_price && forecast.predicted_stock_price !== 0
        ? ((actualPrice - forecast.predicted_stock_price) / forecast.predicted_stock_price) * 100
        : null;

    if (errorPct !== null) {
      await updateForecastComparison(id, actualPrice, errorPct);
    }

    return Response.json({
      id,
      actual_stock_price: actualPrice,
      predicted_stock_price: forecast.predicted_stock_price,
      error_pct: errorPct,
      price_date: priceDate,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Comparison failed";
    console.error(`POST /api/forecasts/${id}/compare error:`, message);
    return Response.json({ error: message }, { status: 502 });
  }
}
