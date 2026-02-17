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
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatWeight,
  formatNumber,
} from "@/lib/portfolio/formatters";

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

export function TopHoldings({ holdings, portfolioCurrency }: Props) {
  const top = holdings.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Top Holdings{" "}
          {holdings.length > 10 && (
            <span className="text-sm font-normal text-muted-foreground">
              (showing 10 of {holdings.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="hidden md:table-cell">Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.map((h) => (
              <TableRow key={h.symbol}>
                <TableCell className="font-medium">
                  {h.uic && h.saxoAssetType ? (
                    <Link
                      href={`/holdings/${h.uic}/${encodeURIComponent(h.saxoAssetType)}`}
                      className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                    >
                      {h.symbol}
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  ) : (
                    h.symbol
                  )}
                </TableCell>
                <TableCell className="hidden max-w-[200px] truncate md:table-cell">
                  {h.name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {h.assetType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(h.quantity)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(h.currentPrice, h.currency)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(h.marketValue, portfolioCurrency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatWeight(h.weight)}
                </TableCell>
                <TableCell
                  className={`text-right ${
                    (h.unrealizedPnl || 0) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {h.unrealizedPnl != null
                    ? `${h.unrealizedPnl >= 0 ? "+" : ""}${formatCurrency(h.unrealizedPnl, portfolioCurrency)}`
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
