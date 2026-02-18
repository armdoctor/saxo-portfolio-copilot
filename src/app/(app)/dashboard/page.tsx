import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { AssetBreakdown } from "@/components/dashboard/asset-breakdown";
import { CurrencyExposure } from "@/components/dashboard/currency-exposure";
import { TopHoldings } from "@/components/dashboard/top-holdings";
import { NewsFeed } from "@/components/dashboard/news-feed";
import { FreshnessBanner } from "@/components/freshness-banner";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const snapshot = await prisma.portfolioSnapshot.findFirst({
    where: { userId: session.user.id },
    orderBy: { snapshotAt: "desc" },
    include: {
      holdings: {
        orderBy: { marketValue: "desc" },
      },
    },
  });

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <h2 className="text-2xl font-bold">No portfolio data yet</h2>
        <p className="max-w-md text-muted-foreground">
          Connect your Saxo Bank account in Settings and refresh your portfolio
          to see your dashboard.
        </p>
        <Button asChild>
          <Link href="/settings/saxo">Go to Settings</Link>
        </Button>
      </div>
    );
  }

  const assetBreakdown = snapshot.assetBreakdown as Record<string, number>;
  const currencyExposure = snapshot.currencyExposure as Record<string, number>;

  return (
    <div className="space-y-6">
      <FreshnessBanner snapshotAt={snapshot.snapshotAt.toISOString()} />

      <PortfolioSummary
        totalValue={snapshot.totalValue}
        cashBalance={snapshot.cashBalance}
        unrealizedPnl={snapshot.unrealizedPnl}
        currency={snapshot.currency}
        snapshotAt={snapshot.snapshotAt.toISOString()}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <AssetBreakdown
          breakdown={assetBreakdown}
          totalValue={snapshot.totalValue}
          currency={snapshot.currency}
        />
        <CurrencyExposure
          exposure={currencyExposure}
          totalValue={snapshot.totalValue}
        />
      </div>

      <TopHoldings
        holdings={snapshot.holdings.map((h) => ({
          symbol: h.symbol,
          name: h.name,
          assetType: h.assetType,
          quantity: h.quantity,
          currentPrice: h.currentPrice,
          marketValue: h.marketValue,
          currency: h.currency,
          weight: h.weight,
          unrealizedPnl: h.unrealizedPnl,
          uic: h.uic,
          saxoAssetType: h.saxoAssetType,
        }))}
        portfolioCurrency={snapshot.currency}
      />

      <NewsFeed />
    </div>
  );
}
