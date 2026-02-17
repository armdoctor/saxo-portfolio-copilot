import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { HoldingDetail } from "@/components/holdings/holding-detail";

export default async function HoldingDetailPage({
  params,
}: {
  params: Promise<{ uic: string; assetType: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { uic, assetType } = await params;
  const uicNum = parseInt(uic, 10);

  if (isNaN(uicNum)) notFound();

  // Get the latest snapshot with this holding
  const snapshot = await prisma.portfolioSnapshot.findFirst({
    where: { userId: session.user.id },
    orderBy: { snapshotAt: "desc" },
    include: {
      holdings: {
        where: { uic: uicNum, saxoAssetType: assetType },
        take: 1,
      },
    },
  });

  const holding = snapshot?.holdings[0];
  if (!holding) notFound();

  return (
    <HoldingDetail
      holding={{
        symbol: holding.symbol,
        name: holding.name,
        assetType: holding.assetType,
        quantity: holding.quantity,
        currentPrice: holding.currentPrice,
        marketValue: holding.marketValue,
        currency: holding.currency,
        weight: holding.weight,
        unrealizedPnl: holding.unrealizedPnl,
        uic: uicNum,
        saxoAssetType: assetType,
      }}
      portfolioCurrency={snapshot!.currency}
    />
  );
}
