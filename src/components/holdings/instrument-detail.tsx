"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceChart } from "./price-chart";
import { KeyStats } from "./key-stats";

interface Props {
  uic: number;
  assetType: string;
  symbol: string;
  saxoSymbol?: string;
  name: string;
}

export function InstrumentDetail({ uic, assetType, symbol, saxoSymbol, name }: Props) {
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const basePath = `/api/holdings/${uic}/${encodeURIComponent(assetType)}`;
    Promise.allSettled([
      fetch(`${basePath}/quote`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${basePath}/details`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([quoteResult, detailsResult]) => {
      if (quoteResult.status === "fulfilled") setQuote(quoteResult.value);
      if (detailsResult.status === "fulfilled") setDetails(detailsResult.value);
      setLoading(false);
    });
  }, [uic, assetType]);

  // Prefer name from fetched details if available
  const displayName = (details?.Description as string) || name;
  const displaySymbol = (details?.Symbol as string) || symbol;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/search">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Search
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{displaySymbol}</h1>
              <Badge variant="outline">{assetType}</Badge>
            </div>
            <p className="text-muted-foreground">{displayName}</p>
          </div>
        </div>
      </div>

      <PriceChart uic={uic} assetType={assetType} saxoSymbol={saxoSymbol} />

      <KeyStats
        holding={null}
        portfolioCurrency=""
        quote={quote}
        details={details}
        loading={loading}
      />
    </div>
  );
}
