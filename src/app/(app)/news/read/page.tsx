"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ArticleData {
  title: string | null;
  content: string | null;
  author: string | null;
  published: string | null;
  source: string | null;
}

function ArticleReader() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) {
      setError(true);
      setLoading(false);
      return;
    }

    fetch(`/api/news/article?url=${encodeURIComponent(url)}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setArticle(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [url]);

  return (
    <>
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && (
        <div className="space-y-4 rounded-lg border p-6 text-center">
          <p className="text-muted-foreground">
            Could not load this article.
          </p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open original article
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      )}

      {article && (
        <>
          {article.title && (
            <h1 className="text-2xl font-bold">{article.title}</h1>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {article.source && <span>{article.source}</span>}
            {article.source && article.published && <span>&middot;</span>}
            {article.published && (
              <span>
                {new Date(article.published).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
            {article.author && (
              <>
                <span>&middot;</span>
                <span>{article.author}</span>
              </>
            )}
          </div>

          {article.content && (
            <article
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          )}

          {url && (
            <div className="border-t pt-4">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Open original article
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}
        </>
      )}
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function ArticleReaderPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <Suspense fallback={<LoadingFallback />}>
        <ArticleReader />
      </Suspense>
    </div>
  );
}
