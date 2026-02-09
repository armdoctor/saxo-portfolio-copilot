"use client";

import { useState } from "react";
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

export function PortfolioSummary({
  totalValue,
  cashBalance,
  unrealizedPnl,
  currency,
  snapshotAt,
}: Props) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Refresh failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Portfolio Overview</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              As of {formatTimestamp(snapshotAt)}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-3xl font-bold">
              {formatCurrency(totalValue, currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cash Balance</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(cashBalance, currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Unrealized P&L</p>
            <p
              className={`text-2xl font-semibold ${
                unrealizedPnl >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {unrealizedPnl >= 0 ? "+" : ""}
              {formatCurrency(unrealizedPnl, currency)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
