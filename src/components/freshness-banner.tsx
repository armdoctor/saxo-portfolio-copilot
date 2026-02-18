"use client";

import { formatTimestamp } from "@/lib/portfolio/formatters";

interface Props {
  snapshotAt: string | null;
}

type Freshness = "fresh" | "stale" | "expired" | "none";

function getFreshness(snapshotAt: string | null): Freshness {
  if (!snapshotAt) return "none";
  const ageMs = Date.now() - new Date(snapshotAt).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 6) return "fresh";
  if (hours < 24) return "stale";
  return "expired";
}

const config: Record<
  Freshness,
  { bg: string; text: string; label: string; detail: string }
> = {
  fresh: {
    bg: "bg-primary/10",
    text: "text-primary",
    label: "Data is up to date",
    detail: "",
  },
  stale: {
    bg: "bg-amber-900/20",
    text: "text-amber-400",
    label: "Data may be stale",
    detail: " — refresh recommended",
  },
  expired: {
    bg: "bg-red-900/20",
    text: "text-red-400",
    label: "Data is outdated",
    detail: " — please refresh your portfolio",
  },
  none: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    label: "No portfolio data",
    detail: " — connect your Saxo account and refresh",
  },
};

export function FreshnessBanner({ snapshotAt }: Props) {
  const freshness = getFreshness(snapshotAt);
  const c = config[freshness];

  return (
    <div className={`rounded-md px-4 py-2 text-sm ${c.bg} ${c.text}`}>
      <span className="font-medium">{c.label}</span>
      {snapshotAt && (
        <span>
          {" "}
          &middot; As of {formatTimestamp(snapshotAt)}
        </span>
      )}
      {c.detail && <span>{c.detail}</span>}
    </div>
  );
}
