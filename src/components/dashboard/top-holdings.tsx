"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatWeight,
  formatNumber,
} from "@/lib/portfolio/formatters";
import { cn } from "@/lib/utils";

interface Holding {
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  currency: string;
  weight: number;
  unrealizedPnl: number | null;
  uic: number | null;
  saxoAssetType: string | null;
}

interface Props {
  holdings: Holding[];
  portfolioCurrency: string;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  Stock: "Stocks",
  ETF: "ETFs",
  EtfEc: "ETFs",
  EtcEtc: "ETCs",
  Bond: "Bonds",
  MutualFund: "Funds",
  StockIndex: "Indices",
  Cash: "Cash",
  CfdOnStock: "CFDs",
  FxSpot: "FX",
};

function typeLabel(assetType: string) {
  return ASSET_TYPE_LABELS[assetType] ?? assetType;
}

function HoldingGroup({
  assetType,
  holdings,
  portfolioCurrency,
  defaultOpen,
}: {
  assetType: string;
  holdings: Holding[];
  portfolioCurrency: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const totalPnl = holdings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0);

  return (
    <>
      {/* Group header */}
      <TableRow
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer select-none bg-muted/40 hover:bg-muted/60"
      >
        <TableCell colSpan={7} className="py-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
                  open && "rotate-90"
                )}
              />
              <span className="font-semibold">{typeLabel(assetType)}</span>
              <span className="text-xs text-muted-foreground">
                {holdings.length} position{holdings.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <span className="hidden sm:block text-muted-foreground">
                {formatWeight(totalWeight)}
              </span>
              <span className="font-medium">
                {formatCurrency(totalValue, portfolioCurrency)}
              </span>
              <span
                className={cn(
                  "hidden sm:block font-medium",
                  totalPnl >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {totalPnl >= 0 ? "+" : ""}
                {formatCurrency(totalPnl, portfolioCurrency)}
              </span>
            </div>
          </div>
        </TableCell>
      </TableRow>

      {/* Holding rows */}
      {open &&
        holdings.map((h) => (
          <TableRow key={`${h.symbol}-${h.uic}`} className="hover:bg-muted/20">
            <TableCell className="pl-8 font-medium">
              {h.uic && h.saxoAssetType ? (
                <Link
                  href={`/holdings/${h.uic}/${encodeURIComponent(h.saxoAssetType)}`}
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  {h.symbol}
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </Link>
              ) : (
                h.symbol
              )}
            </TableCell>
            <TableCell className="hidden max-w-[180px] truncate md:table-cell text-muted-foreground">
              {h.name}
            </TableCell>
            <TableCell className="hidden sm:table-cell text-right text-muted-foreground">
              {formatNumber(h.quantity)}
            </TableCell>
            <TableCell className="hidden sm:table-cell text-right text-muted-foreground">
              {formatCurrency(h.currentPrice, h.currency)}
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(h.marketValue, portfolioCurrency)}
            </TableCell>
            <TableCell className="hidden sm:table-cell text-right text-muted-foreground">
              {formatWeight(h.weight)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right",
                (h.unrealizedPnl ?? 0) >= 0 ? "text-green-600" : "text-red-600"
              )}
            >
              {h.unrealizedPnl != null
                ? `${h.unrealizedPnl >= 0 ? "+" : ""}${formatCurrency(h.unrealizedPnl, portfolioCurrency)}`
                : "—"}
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}

export function TopHoldings({ holdings, portfolioCurrency }: Props) {
  // Group by assetType, preserving value-descending order within each group
  const groupMap = new Map<string, Holding[]>();
  for (const h of holdings) {
    const key = h.assetType;
    const existing = groupMap.get(key);
    if (existing) existing.push(h);
    else groupMap.set(key, [h]);
  }

  // Sort groups by total market value descending
  const groups = [...groupMap.entries()].sort(
    (a, b) =>
      b[1].reduce((s, h) => s + h.marketValue, 0) -
      a[1].reduce((s, h) => s + h.marketValue, 0)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-8">Symbol</TableHead>
              <TableHead className="hidden md:table-cell">Name</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Qty</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Price</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Weight</TableHead>
              <TableHead className="text-right">P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(([assetType, groupHoldings], i) => (
              <HoldingGroup
                key={assetType}
                assetType={assetType}
                holdings={groupHoldings}
                portfolioCurrency={portfolioCurrency}
                defaultOpen={i === 0}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
