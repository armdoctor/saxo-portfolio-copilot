"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Article {
  id: number;
  datetime: number;
  headline: string;
  source: string;
  summary: string;
  url: string;
  symbol: string;
  companyName: string;
  topic: string;
  industry: string;
}

function formatRelativeTime(unixTs: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const existing = map.get(k);
    if (existing) existing.push(item);
    else map.set(k, [item]);
  }
  return map;
}

// Preferred ordering for topics
const TOPIC_ORDER = ["Earnings", "Deals", "Analyst", "Products", "Regulation", "Leadership", "Markets"];

function sortedGroupKeys(map: Map<string, Article[]>, preferredOrder?: string[]): string[] {
  const keys = [...map.keys()];
  if (!preferredOrder) {
    // Sort by most recent article in each group
    return keys.sort((a, b) => {
      const latestA = Math.max(...(map.get(a)?.map((x) => x.datetime) ?? [0]));
      const latestB = Math.max(...(map.get(b)?.map((x) => x.datetime) ?? [0]));
      return latestB - latestA;
    });
  }
  return keys.sort((a, b) => {
    const ia = preferredOrder.indexOf(a);
    const ib = preferredOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

interface ArticleRowProps {
  article: Article;
  showCompany?: boolean;
}

function ArticleRow({ article, showCompany }: ArticleRowProps) {
  return (
    <Link
      href={`/news/read?url=${encodeURIComponent(article.url)}`}
      className="group flex items-baseline justify-between gap-3 py-1"
    >
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-sm transition-colors group-hover:text-primary">
          {article.headline}
        </span>
        {showCompany && (
          <span className="mt-0.5 block text-xs text-muted-foreground/60">
            {article.symbol} · {article.source}
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground/50">
        {formatRelativeTime(article.datetime)}
      </span>
    </Link>
  );
}

interface GroupSectionProps {
  title: string;
  articles: Article[];
  showCompany?: boolean;
}

function GroupSection({ title, articles, showCompany }: GroupSectionProps) {
  const lead = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>

      {/* Lead article */}
      <Link
        href={`/news/read?url=${encodeURIComponent(lead.url)}`}
        className="group block"
      >
        <h3 className="text-sm font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
          {lead.headline}
        </h3>
        {showCompany && (
          <p className="mt-0.5 text-xs text-muted-foreground/60">
            {lead.symbol} · {lead.source} · {formatRelativeTime(lead.datetime)}
          </p>
        )}
        {!showCompany && (
          <p className="mt-0.5 text-xs text-muted-foreground/60">
            {lead.source} · {formatRelativeTime(lead.datetime)}
          </p>
        )}
      </Link>

      {/* Secondary articles */}
      {rest.length > 0 && (
        <ul className="space-y-0.5 border-l border-border pl-3">
          {rest.map((a) => (
            <li key={a.id}>
              <ArticleRow article={a} showCompany={showCompany} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupedView({
  articles,
  groupKey,
  showCompany,
  preferredOrder,
}: {
  articles: Article[];
  groupKey: (a: Article) => string;
  showCompany?: boolean;
  preferredOrder?: string[];
}) {
  const grouped = groupBy(articles, groupKey);
  const keys = sortedGroupKeys(grouped, preferredOrder);

  if (keys.length === 0) {
    return <p className="text-sm text-muted-foreground">No articles found.</p>;
  }

  return (
    <div className="space-y-5">
      {keys.map((key, i) => (
        <div key={key}>
          {i > 0 && <div className="mb-5 border-t border-border" />}
          <GroupSection
            title={key}
            articles={grouped.get(key)!}
            showCompany={showCompany}
          />
        </div>
      ))}
    </div>
  );
}

export function NewsFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => res.json())
      .then((data) => setArticles(data.articles ?? []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && articles.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Portfolio News
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-4/6" />
                <Skeleton className="h-3 w-3/6" />
              </div>
            ))}
          </div>
        ) : (
          <Tabs defaultValue="topic">
            <TabsList className="mb-4 h-8">
              <TabsTrigger value="topic" className="text-xs">
                Topic
              </TabsTrigger>
              <TabsTrigger value="company" className="text-xs">
                Company
              </TabsTrigger>
              <TabsTrigger value="industry" className="text-xs">
                Industry
              </TabsTrigger>
            </TabsList>

            <TabsContent value="topic">
              <GroupedView
                articles={articles}
                groupKey={(a) => a.topic}
                showCompany
                preferredOrder={TOPIC_ORDER}
              />
            </TabsContent>

            <TabsContent value="company">
              <GroupedView
                articles={articles}
                groupKey={(a) => `${a.symbol} — ${a.companyName}`}
              />
            </TabsContent>

            <TabsContent value="industry">
              <GroupedView
                articles={articles}
                groupKey={(a) => a.industry}
                showCompany
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
