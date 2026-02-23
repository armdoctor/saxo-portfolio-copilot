"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatTimestamp,
} from "@/lib/portfolio/formatters";

interface Props {
  totalValue: number;
  cashBalance: number;
  unrealizedPnl: number;
  currency: string;
  snapshotAt: string;
}

interface Insight {
  headline: string;
  detail: string;
}

export function PortfolioSummary({
  totalValue,
  cashBalance,
  unrealizedPnl,
  currency,
  snapshotAt,
}: Props) {
  const AUTO_REFRESH_MS = 30_000;

  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshingRef = useRef(false);

  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadInsight = useCallback(async (forceRefresh = false) => {
    setInsightLoading(true);
    try {
      const url = forceRefresh
        ? "/api/portfolio/summary?refresh=1"
        : "/api/portfolio/summary";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.headline) {
        setInsight({ headline: data.headline, detail: data.detail ?? "" });
      }
    } catch {
      // insight is optional — fail silently
    } finally {
      setInsightLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsight();
  }, [loadInsight]);

  const doRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Refresh failed");
      }
      router.refresh();
      loadInsight(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [router, loadInsight]);

  useEffect(() => {
    const id = setInterval(doRefresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [doRefresh]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Portfolio Overview</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              As of {formatTimestamp(snapshotAt)}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={doRefresh}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-3xl font-bold sm:text-4xl">
              {formatCurrency(totalValue, currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cash Balance</p>
            <p className="text-2xl font-semibold sm:text-3xl">
              {formatCurrency(cashBalance, currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Unrealized P&L</p>
            <p
              className={`text-xl font-semibold sm:text-2xl ${
                unrealizedPnl >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {unrealizedPnl >= 0 ? "+" : ""}
              {formatCurrency(unrealizedPnl, currency)}
            </p>
          </div>
        </div>

        {/* AI insight */}
        {insightLoading ? (
          <div className="border-t border-border pt-3">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : insight ? (
          <div className="border-t border-border pt-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground">{insight.headline}</p>
              {insight.detail && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="shrink-0 text-xs text-muted-foreground/60 underline-offset-2 hover:text-foreground hover:underline"
                >
                  {expanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
            {expanded && insight.detail && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground/80">
                {insight.detail}
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
