import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWeight, formatNumber } from "@/lib/portfolio/formatters";

const COLORS: Record<string, string> = {
  USD: "bg-blue-500",
  EUR: "bg-emerald-500",
  GBP: "bg-amber-500",
  SGD: "bg-purple-500",
  HKD: "bg-cyan-500",
  JPY: "bg-rose-500",
  AUD: "bg-orange-500",
  CHF: "bg-teal-500",
};

interface Props {
  exposure: Record<string, number>;
  totalValue: number;
}

export function CurrencyExposure({ exposure, totalValue }: Props) {
  const entries = Object.entries(exposure)
    .filter(([, value]) => Math.abs(value) > 0.01)
    .sort(([, a], [, b]) => b - a);

  const totalExposure = entries.reduce((sum, [, val]) => sum + val, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Currency Exposure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        <div className="flex h-4 overflow-hidden rounded-full">
          {entries.map(([currency, value]) => {
            const pct =
              totalExposure > 0 ? (value / totalExposure) * 100 : 0;
            return (
              <div
                key={currency}
                className={`${COLORS[currency] || "bg-gray-400"}`}
                style={{ width: `${Math.max(pct, 1)}%` }}
                title={`${currency}: ${formatWeight(pct)}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {entries.map(([currency, value]) => {
            const pct =
              totalExposure > 0 ? (value / totalExposure) * 100 : 0;
            return (
              <div
                key={currency}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${COLORS[currency] || "bg-gray-400"}`}
                  />
                  <span>{currency}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-muted-foreground">
                    {formatWeight(pct)}
                  </span>
                  <span className="text-right font-medium">
                    {formatNumber(value)}
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
