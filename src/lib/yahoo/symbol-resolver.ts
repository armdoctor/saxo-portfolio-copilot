import { prisma } from "@/lib/prisma";
import { saxoToYahooSymbol } from "./client";

/**
 * Look up the Saxo symbol from the most recent HoldingSnapshot and convert it
 * to a Yahoo Finance ticker. Returns null if not found or exchange unmapped.
 */
export async function resolveYahooSymbol(
  userId: string,
  uic: number,
  saxoAssetType: string
): Promise<string | null> {
  const holding = await prisma.holdingSnapshot.findFirst({
    where: {
      uic,
      saxoAssetType,
      snapshot: { userId },
    },
    orderBy: { createdAt: "desc" },
    select: { symbol: true },
  });

  if (!holding) return null;
  return saxoToYahooSymbol(holding.symbol);
}
