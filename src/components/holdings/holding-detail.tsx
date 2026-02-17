"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceChart } from "./price-chart";
import { KeyStats } from "./key-stats";
import {
  formatCurrency,
  formatWeight,
  formatNumber,
} from "@/lib/portfolio/formatters";

interface HoldingInfo {
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  currency: string;
  weight: number;
  unrealizedPnl: number | null;
  uic: number;
  saxoAssetType: string;
}

interface Props {
  holding: HoldingInfo;
  portfolioCurrency: string;
}

export function HoldingDetail({ holding, portfolioCurrency }: Props) {
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const basePath = `/api/holdings/${holding.uic}/${encodeURIComponent(holding.saxoAssetType)}`;

    Promise.allSettled([
      fetch(`${basePath}/quote`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${basePath}/details`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([quoteResult, detailsResult]) => {
      if (quoteResult.status === "fulfilled") setQuote(quoteResult.value);
      if (detailsResult.status === "fulfilled") setDetails(detailsResult.value);
      setLoading(false);
    });
  }, [holding.uic, holding.saxoAssetType]);

  const pnl = holding.unrealizedPnl ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{holding.symbol}</h1>
              <Badge variant="outline">{holding.assetType}</Badge>
            </div>
            <p className="text-muted-foreground">{holding.name}</p>
          </div>

          <div className="text-right">
            <p className="text-2xl font-bold">
              {formatCurrency(holding.marketValue, portfolioCurrency)}
            </p>
            <div className="flex items-center justify-end gap-3 text-sm">
              <span className="text-muted-foreground">
                {formatNumber(holding.quantity)} shares
              </span>
              <span className="text-muted-foreground">
                {formatWeight(holding.weight)} of portfolio
              </span>
              <span
                className={pnl >= 0 ? "text-green-600" : "text-red-600"}
              >
                {pnl >= 0 ? "+" : ""}
                {formatCurrency(pnl, portfolioCurrency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <PriceChart uic={holding.uic} assetType={holding.saxoAssetType} />

      {/* Stats */}
      <KeyStats
        holding={holding}
        portfolioCurrency={portfolioCurrency}
        quote={quote}
        details={details}
        loading={loading}
      />
    </div>
  );
}
