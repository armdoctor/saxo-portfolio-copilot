"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RANGES = ["1D", "1W", "1M", "6M", "1Y", "5Y"] as const;
type Range = (typeof RANGES)[number];

interface ChartPoint {
  date: string;
  close: number;
}

interface Props {
  uic: number;
  assetType: string;
}

function formatTooltipDate(dateStr: string, range: Range) {
  const d = new Date(dateStr);
  if (range === "1D") {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: range === "5Y" || range === "1Y" ? "numeric" : undefined,
  });
}

function formatXAxis(dateStr: string, range: Range) {
  const d = new Date(dateStr);
  if (range === "1D") {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  if (range === "1W" || range === "1M") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function PriceChart({ uic, assetType }: Props) {
  const [range, setRange] = useState<Range>("1M");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChart = useCallback(async (r: Range) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/holdings/${uic}/${encodeURIComponent(assetType)}/chart?range=${r}`
      );
      if (res.status === 403) {
        setData([]);
        setError("Chart data not available — your Saxo app may not include chart API access");
        return;
      }
      if (!res.ok) throw new Error("Failed to load chart data");
      const json = await res.json();

      const dataPoints: ChartPoint[] = (json.Data || []).map(
        (d: { Time: string; Close: number; CloseAsk?: number }) => ({
          date: d.Time,
          close: d.Close ?? d.CloseAsk ?? 0,
        })
      );
      setData(dataPoints);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chart error");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [uic, assetType]);

  useEffect(() => {
    fetchChart(range);
  }, [range, fetchChart]);

  const isUp =
    data.length >= 2 ? data[data.length - 1].close >= data[0].close : true;
  const color = isUp ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Price Chart</CardTitle>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-2 sm:py-1 sm:text-xs",
                r === range
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[200px] w-full sm:h-[300px]" />
        ) : error ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground sm:h-[300px]">
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground sm:h-[300px]">
            No chart data available
          </div>
        ) : (
          <div className="h-[200px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatXAxis(v, range)}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v.toLocaleString()}
                width={60}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as ChartPoint;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                      <p className="text-muted-foreground">
                        {formatTooltipDate(point.date, range)}
                      </p>
                      <p className="font-medium">
                        {point.close.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={color}
                strokeWidth={2}
                fill="url(#chartGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
