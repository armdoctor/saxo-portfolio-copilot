"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface HoldingData {
  currentPrice: number;
  marketValue: number;
  quantity: number;
  currency: string;
  unrealizedPnl: number | null;
  weight: number;
}

interface Props {
  holding?: HoldingData | null;
  portfolioCurrency: string;
  quote: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  loading: boolean;
}

function Stat({ label, value }: { label: string; value: string | number | undefined | null }) {
  const display =
    value != null && value !== ""
      ? typeof value === "number"
        ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(value)
      : "—";

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${display === "—" ? "text-muted-foreground" : ""}`}>
        {display}
      </p>
    </div>
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function KeyStats({ holding, portfolioCurrency, quote, details, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Extract live quote stats (may be empty on SIM)
  const priceInfo = (quote?.PriceInfo ?? {}) as Record<string, unknown>;
  const quoteData = (quote?.Quote ?? {}) as Record<string, unknown>;
  const priceInfoDetails = (quote?.PriceInfoDetails ?? {}) as Record<string, unknown>;

  const hasNoAccess =
    quoteData.PriceTypeAsk === "NoAccess" || quoteData.PriceTypeBid === "NoAccess";
  const hasLiveQuote =
    !hasNoAccess &&
    (priceInfo.High != null || quoteData.Bid != null || priceInfoDetails.Open != null);

  // Use live price if available, otherwise snapshot price
  const displayPrice = hasLiveQuote && quoteData.Mid
    ? (quoteData.Mid as number)
    : (holding?.currentPrice ?? null);

  // Extract instrument details
  const fundamentals = details
    ? {
        pe: getNestedValue(details, "FundamentalData.PriceEarningsRatio") as number | undefined,
        marketCap: getNestedValue(details, "FundamentalData.MarketCapitalization") as number | undefined,
        dividendYield: getNestedValue(details, "FundamentalData.DividendYield") as number | undefined,
        eps: getNestedValue(details, "FundamentalData.EarningsPerShare") as number | undefined,
      }
    : null;

  const hasFundamentals =
    fundamentals &&
    (fundamentals.pe || fundamentals.marketCap || fundamentals.dividendYield || fundamentals.eps);

  const pnl = holding?.unrealizedPnl ?? 0;

  return (
    <div className="space-y-4">
      {/* Position data — only shown when viewing a portfolio holding */}
      {holding && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              <Stat label="Price" value={displayPrice} />
              <Stat label="Market Value" value={`${portfolioCurrency} ${holding.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              <Stat label="Quantity" value={holding.quantity} />
              <Stat
                label="Unrealized P&L"
                value={`${pnl >= 0 ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
              <Stat label="Weight" value={`${holding.weight.toFixed(1)}%`} />
              <Stat label="Currency" value={holding.currency} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live quote — only shown when SIM provides real-time data */}
      {hasLiveQuote && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live Quote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              <Stat label="Open" value={priceInfoDetails.Open as number} />
              <Stat label="Close" value={priceInfoDetails.LastClose as number} />
              <Stat label="High" value={priceInfo.High as number} />
              <Stat label="Low" value={priceInfo.Low as number} />
              <Stat label="Bid" value={quoteData.Bid as number} />
              <Stat label="Ask" value={quoteData.Ask as number} />
              <Stat label="Volume" value={priceInfoDetails.Volume as number} />
              <Stat
                label="Day Change"
                value={
                  priceInfo.PercentChange != null
                    ? `${(priceInfo.PercentChange as number) >= 0 ? "+" : ""}${(priceInfo.PercentChange as number).toFixed(2)}%`
                    : undefined
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instrument details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instrument Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            <Stat label="Exchange" value={getNestedValue(details ?? {}, "Exchange.Name") as string} />
            <Stat label="Price Currency" value={details?.CurrencyCode as string} />
            <Stat label="Tradable" value={details?.IsTradable ? "Yes" : details ? "No" : undefined} />
            <Stat label="Lot Size" value={details?.MinimumLotSize as number} />
            {hasLiveQuote && (
              <>
                <Stat label="52W High" value={priceInfoDetails.High52Week as number} />
                <Stat label="52W Low" value={priceInfoDetails.Low52Week as number} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fundamentals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fundamentals</CardTitle>
        </CardHeader>
        <CardContent>
          {hasFundamentals ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              <Stat label="P/E Ratio" value={fundamentals.pe} />
              <Stat
                label="Market Cap"
                value={
                  fundamentals.marketCap
                    ? fundamentals.marketCap >= 1e9
                      ? `${(fundamentals.marketCap / 1e9).toFixed(1)}B`
                      : fundamentals.marketCap >= 1e6
                        ? `${(fundamentals.marketCap / 1e6).toFixed(1)}M`
                        : fundamentals.marketCap.toLocaleString()
                    : undefined
                }
              />
              <Stat
                label="Dividend Yield"
                value={
                  fundamentals.dividendYield != null
                    ? `${fundamentals.dividendYield.toFixed(2)}%`
                    : undefined
                }
              />
              <Stat label="EPS" value={fundamentals.eps} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Fundamentals not available via current data source
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
