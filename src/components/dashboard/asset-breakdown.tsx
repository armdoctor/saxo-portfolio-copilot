import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatWeight } from "@/lib/portfolio/formatters";

const COLORS: Record<string, string> = {
  Stocks: "bg-blue-500",
  ETFs: "bg-emerald-500",
  Bonds: "bg-amber-500",
  Funds: "bg-purple-500",
  Forex: "bg-cyan-500",
  Cash: "bg-gray-400",
  Other: "bg-gray-300",
};

interface Props {
  breakdown: Record<string, number>;
  totalValue: number;
  currency: string;
}

export function AssetBreakdown({ breakdown, totalValue, currency }: Props) {
  const entries = Object.entries(breakdown)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Class Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        <div className="flex h-4 overflow-hidden rounded-full">
          {entries.map(([assetClass, value]) => {
            const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
            return (
              <div
                key={assetClass}
                className={`${COLORS[assetClass] || "bg-gray-300"}`}
                style={{ width: `${pct}%` }}
                title={`${assetClass}: ${formatWeight(pct)}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {entries.map(([assetClass, value]) => {
            const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
            return (
              <div key={assetClass} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${COLORS[assetClass] || "bg-gray-300"}`}
                  />
                  <span>{assetClass}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-muted-foreground">
                    {formatWeight(pct)}
                  </span>
                  <span className="text-right font-medium">
                    {formatCurrency(value, currency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
