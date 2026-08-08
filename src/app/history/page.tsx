export const dynamic = "force-dynamic";
export const revalidate = 0;

import { auth } from "@clerk/nextjs/server";
import { listForecasts } from "@/lib/db";
import { ForecastCompareButton } from "@/components/forecast-compare-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function ErrorBadge({ error }: { error: number | null | undefined }) {
  if (error === null || error === undefined) return <span className="text-muted-foreground">—</span>;
  const isPos = error >= 0;
  const Icon = isPos ? TrendingUp : TrendingDown;
  return (
    <Badge variant="outline" className={`gap-1 ${isPos ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-600"}`}>
      <Icon className="size-3" /> {fmtPct(error)}
    </Badge>
  );
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view your forecast history.</p>
      </div>
    );
  }

  const params = await searchParams;
  const forecasts = await listForecasts(userId, params.symbol, 200);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-5" />
            <h1 className="text-lg font-bold tracking-tight">Forecast History</h1>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to pricer
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="size-5" />
              Saved forecasts vs. real prices
            </CardTitle>
            <CardDescription>
              Every pricing run you run is persisted here. Click <strong>Compare</strong> to fetch the latest real price for that symbol and see how the prediction performed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forecasts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No saved forecasts yet.</p>
                <p className="text-sm">Run a pricing calculation on the main page to start tracking.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Symbol</th>
                      <th className="px-3 py-2 font-medium">Horizon</th>
                      <th className="px-3 py-2 font-medium text-right">Spot</th>
                      <th className="px-3 py-2 font-medium text-right">Predicted</th>
                      <th className="px-3 py-2 font-medium text-right">Actual</th>
                      <th className="px-3 py-2 font-medium text-right">Error</th>
                      <th className="px-3 py-2 font-medium text-right">Option premium</th>
                      <th className="px-3 py-2 font-medium text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {forecasts.map((f) => (
                      <tr key={f.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {new Date(f.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-medium">{f.symbol ?? "—"}</td>
                        <td className="px-3 py-2">{f.time_to_expiry_days}d</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtCurrency(f.spot_price)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtCurrency(f.predicted_stock_price)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtCurrency(f.actual_stock_price)}</td>
                        <td className="px-3 py-2 text-right">
                          <ErrorBadge error={f.error_pct} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {f.theoretical_price !== null ? fmtCurrency(f.theoretical_price) : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <ForecastCompareButton id={f.id} disabled={!f.symbol} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
