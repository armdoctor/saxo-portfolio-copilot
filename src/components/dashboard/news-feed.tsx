"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Article {
  id: number;
  datetime: number;
  headline: string;
  image: string;
  source: string;
  summary: string;
  url: string;
}

function formatRelativeTime(unixTs: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function LeadArticle({ article }: { article: Article }) {
  return (
    <Link
      href={`/news/read?url=${encodeURIComponent(article.url)}`}
      className="group block"
    >
      <h3 className="text-xl font-semibold leading-tight tracking-tight transition-colors group-hover:text-primary sm:text-2xl">
        {article.headline}
      </h3>
      {article.summary && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {article.summary}
        </p>
      )}
      <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground/70">
        {article.source} &middot; {formatRelativeTime(article.datetime)}
      </p>
    </Link>
  );
}

function ArticleRow({ article }: { article: Article }) {
  return (
    <Link
      href={`/news/read?url=${encodeURIComponent(article.url)}`}
      className="group block"
    >
      <h4 className="font-medium leading-snug tracking-tight transition-colors group-hover:text-primary">
        {article.headline}
      </h4>
      <p className="mt-1.5 text-xs uppercase tracking-widest text-muted-foreground/70">
        {article.source} &middot; {formatRelativeTime(article.datetime)}
      </p>
    </Link>
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

  const lead = articles[0];
  const rest = articles.slice(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Portfolio News
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-7 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <div className="border-t border-border" />
            <div className="grid gap-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {lead && <LeadArticle article={lead} />}

            {rest.length > 0 && (
              <>
                <div className="border-t border-border" />
                <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {rest.map((article) => (
                    <ArticleRow key={article.id} article={article} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
