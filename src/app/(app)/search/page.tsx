"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface InstrumentResult {
  uic: number;
  symbol: string;
  name: string;
  assetType: string;
  currency: string;
  exchange: string;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  Stock: "Stock",
  ETF: "ETF",
  EtfEc: "ETF",
  EtcEtc: "ETC",
  Bond: "Bond",
  MutualFund: "Fund",
  StockIndex: "Index",
  CfdOnStock: "CFD",
  CfdOnIndex: "CFD",
  FxSpot: "FX",
  ContractFutures: "Futures",
  StockOption: "Option",
};

function assetLabel(type: string) {
  return ASSET_TYPE_LABELS[type] ?? type;
}

function ResultCard({ r }: { r: InstrumentResult }) {
  return (
    <Link
      href={`/holdings/${r.uic}/${r.assetType}`}
      className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold">{r.symbol}</span>
          <span className="truncate text-xs text-muted-foreground">{r.name}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground/60">
          {r.exchange} · {r.currency}
        </div>
      </div>
      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {assetLabel(r.assetType)}
      </span>
    </Link>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InstrumentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setResults(data.results ?? []);
        setSearched(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Search Instruments</h1>

      {/* Search input */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ticker, company name, ISIN…"
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-4 text-sm outline-none ring-offset-background transition focus:border-primary focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {results.map((r) => (
              <ResultCard key={`${r.uic}-${r.assetType}`} r={r} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && results.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No instruments found for &ldquo;{query}&rdquo;.
        </p>
      )}

      {/* Idle state */}
      {!searched && !loading && query.trim().length === 0 && (
        <p className="text-sm text-muted-foreground">
          Search across stocks, ETFs, bonds, funds, and more.
        </p>
      )}
    </div>
  );
}
