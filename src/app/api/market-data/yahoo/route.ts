import { NextRequest } from "next/server";
import { fetchYahooQuote, fetchYahooHistorical } from "@/lib/yahoo-finance";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const type = request.nextUrl.searchParams.get("type") || "quote";

  if (!symbol) {
    return Response.json({ error: "symbol parameter is required" }, { status: 400 });
  }

  try {
    if (type === "quote") {
      return Response.json(await fetchYahooQuote(symbol));
    } else if (type === "historical") {
      return Response.json(await fetchYahooHistorical(symbol));
    } else {
      return Response.json({ error: "type must be 'quote' or 'historical'" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch data";
    return Response.json({ error: msg }, { status: 502 });
  }
}
