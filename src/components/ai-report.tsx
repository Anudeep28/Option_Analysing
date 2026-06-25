"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Brain, Loader2, CheckCircle2, XCircle, AlertTriangle, TrendingUp,
  ShieldAlert, Lightbulb, RefreshCw, TrendingDown, Target, StopCircle, Clock, BarChart3,
  Scale, FlaskConical,
} from "lucide-react";
import type { ReportRequest, ReportResponse, StockAnalysis } from "@/app/api/ai/report/route";

interface AIReportProps {
  reportInput: Omit<ReportRequest, "newsHeadlines"> & { newsHeadlines?: string[] };
}

export function AIReport({ reportInput }: AIReportProps) {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateReport() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportInput),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setReport(data as ReportResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setIsLoading(false);
    }
  }

  const verdictConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
    green: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800" },
    yellow: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" },
    red: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" },
  };

  const cfg = report ? (verdictConfig[report.verdictColor] ?? verdictConfig.yellow) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="size-5" />
          AI Investment Report
          <Badge variant="secondary" className="text-[10px] ml-1">DeepSeek</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!report && !isLoading && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate a structured investment report using DeepSeek AI. It will analyze all
              pricing data, Greeks, news sentiment, and probability metrics to give you a
              concrete buy/avoid recommendation.
            </p>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                {error.includes("DEEPSEEK_API_KEY")
                  ? "DeepSeek API key not configured. Add DEEPSEEK_API_KEY to your .env.local file."
                  : error}
              </div>
            )}
            <Button onClick={generateReport} className="w-full" variant="outline">
              <Brain className="size-4 mr-2" />
              Generate AI Report
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm">DeepSeek is analyzing your option...</p>
          </div>
        )}

        {report && cfg && (
          <div className="space-y-4">
            {/* Verdict */}
            <div className={`rounded-lg border p-4 ${cfg.bg}`}>
              <div className="flex items-center gap-3">
                <cfg.icon className={`size-8 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xl font-bold ${cfg.color}`}>{report.verdict}</div>
                  <div className="text-sm text-muted-foreground">
                    Confidence: {report.confidence}/100
                  </div>
                </div>
                <div className="w-16 h-16 relative shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" strokeWidth="3"
                      strokeDasharray={`${report.confidence}, 100`}
                      className={
                        report.verdictColor === "green" ? "stroke-emerald-500"
                        : report.verdictColor === "yellow" ? "stroke-amber-500"
                        : "stroke-red-500"
                      }
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {report.confidence}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-sm leading-relaxed">{report.summary}</p>
            </div>

            <Separator />

            {/* Key Factors & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <TrendingUp className="size-3.5" /> Key Factors
                </div>
                <ul className="space-y-1.5">
                  {report.keyFactors.map((f, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-muted-foreground">
                      <span className="text-emerald-500 shrink-0 mt-0.5">•</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
                  <AlertTriangle className="size-3.5" /> Risks
                </div>
                <ul className="space-y-1.5">
                  {report.risks.map((r, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-muted-foreground">
                      <span className="text-red-500 shrink-0 mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Separator />

            {/* Recommendation */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <ShieldAlert className="size-4" /> Recommendation
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{report.recommendation}</p>
            </div>

            {/* Position Sizing */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Lightbulb className="size-4 text-amber-500" /> Position Sizing
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{report.positionSizing}</p>
            </div>

            {/* Stock Buying Analysis */}
            {report.stockAnalysis && (
              <StockAnalysisSection data={report.stockAnalysis} />
            )}

            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
              <span>Generated by DeepSeek AI · {new Date(report.timestamp).toLocaleString()}</span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={generateReport}>
                <RefreshCw className="size-3" /> Regenerate
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const stockVerdictConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  green: { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  yellow: { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800", icon: AlertTriangle },
  red: { color: "text-red-600", bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800", icon: XCircle },
};

function StockAnalysisSection({ data }: { data: StockAnalysis }) {
  const cfg = stockVerdictConfig[data.verdictColor] ?? stockVerdictConfig.yellow;
  const VerdictIcon = cfg.icon;

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <BarChart3 className="size-4 text-blue-600" /> Should You Buy the Stock?
      </div>

      {/* Stock Verdict */}
      <div className={`rounded-lg border p-3 flex items-center gap-3 ${cfg.bg}`}>
        <VerdictIcon className={`size-6 shrink-0 ${cfg.color}`} />
        <div>
          <div className={`text-base font-bold ${cfg.color}`}>{data.verdict}</div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{data.rationale}</p>
        </div>
      </div>

      {/* Mental Model Synthesis */}
      {data.mentalModelSynthesis && (
        <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
            <Scale className="size-3.5" /> Mental Model Synthesis
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.mentalModelSynthesis}</p>
        </div>
      )}

      {/* Math Signals */}
      {data.mathSignals && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <FlaskConical className="size-3.5" /> Mathematical Signals
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.mathSignals}</p>
        </div>
      )}

      {/* Price Levels */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border bg-muted/30 p-2.5 space-y-0.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
            <TrendingUp className="size-3" /> Entry Zone
          </div>
          <p className="text-xs font-semibold">{data.entryZone}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-2.5 space-y-0.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
            <Target className="size-3" /> Target
          </div>
          <p className="text-xs font-semibold text-emerald-600">{data.targetPrice}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-2.5 space-y-0.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
            <StopCircle className="size-3" /> Stop Loss
          </div>
          <p className="text-xs font-semibold text-red-600">{data.stopLoss}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-2.5 space-y-0.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
            <Clock className="size-3" /> Horizon
          </div>
          <p className="text-xs font-semibold">{data.timeHorizon}</p>
        </div>
      </div>

      {/* Key Risks */}
      {data.keyRisks.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <TrendingDown className="size-3.5" /> Stock-Level Risks
          </div>
          <ul className="space-y-1">
            {data.keyRisks.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-muted-foreground">
                <span className="text-red-500 shrink-0 mt-0.5">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
