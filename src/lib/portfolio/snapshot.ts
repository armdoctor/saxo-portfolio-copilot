import { prisma } from "@/lib/prisma";
import {
  fetchClientInfo,
  fetchAccounts,
  fetchBalances,
  fetchPositions,
} from "@/lib/saxo/client";

function mapAssetClass(assetType: string): string {
  switch (assetType) {
    case "Stock":
    case "CfdOnStock":
      return "Stocks";
    case "ETF":
    case "CfdOnEtf":
      return "ETFs";
    case "Bond":
    case "CfdOnBond":
      return "Bonds";
    case "MutualFund":
      return "Funds";
    case "FxSpot":
    case "FxForwards":
      return "Forex";
    default:
      return "Other";
  }
}

function mapAssetType(saxoAssetType: string): string {
  const mapping: Record<string, string> = {
    Stock: "Stock",
    CfdOnStock: "Stock",
    ETF: "ETF",
    CfdOnEtf: "ETF",
    Bond: "Bond",
    CfdOnBond: "Bond",
    MutualFund: "Fund",
    FxSpot: "Forex",
    FxForwards: "Forex",
  };
  return mapping[saxoAssetType] || "Other";
}

export interface SnapshotResult {
  snapshotId: string;
  totalValue: number;
  cashBalance: number;
  unrealizedPnl: number;
  currency: string;
  assetBreakdown: Record<string, number>;
  currencyExposure: Record<string, number>;
  holdingsCount: number;
  snapshotAt: Date;
}

export async function buildSnapshot(userId: string): Promise<SnapshotResult> {
  const startTime = Date.now();

  // 1. Fetch client info to get ClientKey
  const clientInfo = await fetchClientInfo(userId);

  // 2. Update SaxoConnection with ClientKey
  await prisma.saxoConnection.update({
    where: { userId },
    data: { clientKey: clientInfo.ClientKey },
  });

  // 3. Fetch accounts and store them
  const accountsRes = await fetchAccounts(userId);
  const connection = await prisma.saxoConnection.findUnique({
    where: { userId },
  });

  if (!connection) throw new Error("No Saxo connection found");

  for (const acct of accountsRes.Data) {
    await prisma.saxoAccount.upsert({
      where: {
        connectionId_accountKey: {
          connectionId: connection.id,
          accountKey: acct.AccountKey,
        },
      },
      create: {
        connectionId: connection.id,
        accountKey: acct.AccountKey,
        accountId: acct.AccountId,
        accountName: acct.DisplayName,
        currency: acct.Currency,
      },
      update: {
        accountName: acct.DisplayName,
        currency: acct.Currency,
      },
    });
  }

  // 4. Fetch balances
  const balances = await fetchBalances(userId, clientInfo.ClientKey);

  // 5. Fetch positions
  const positionsRes = await fetchPositions(userId, clientInfo.ClientKey);
  const positions = positionsRes.Data || [];

  // 6. Calculate breakdowns
  const assetBreakdown: Record<string, number> = {};
  const currencyExposure: Record<string, number> = {};
  let totalUnrealizedPnl = 0;

  const holdingsData = positions.map((pos) => {
    const assetClass = mapAssetClass(pos.PositionBase.AssetType);
    const assetType = mapAssetType(pos.PositionBase.AssetType);
    const marketValue =
      pos.PositionView?.ExposureInBaseCurrency ||
      pos.PositionView?.Exposure ||
      pos.PositionBase.Amount * (pos.PositionView?.CurrentPrice || 0);
    const currency =
      pos.DisplayAndFormat?.Currency ||
      pos.PositionView?.ExposureCurrency ||
      "USD";
    const pnl = pos.PositionView?.ProfitLossOnTrade || 0;

    // Accumulate asset breakdown
    assetBreakdown[assetClass] = (assetBreakdown[assetClass] || 0) + marketValue;

    // Accumulate currency exposure
    const exposureValue = pos.PositionView?.Exposure || marketValue;
    currencyExposure[currency] =
      (currencyExposure[currency] || 0) + exposureValue;

    totalUnrealizedPnl += pnl;

    return {
      symbol:
        pos.DisplayAndFormat?.Symbol || `UIC-${pos.PositionBase.Uic}`,
      name:
        pos.DisplayAndFormat?.Description ||
        pos.DisplayAndFormat?.Symbol ||
        "Unknown",
      assetType,
      assetClass,
      quantity: pos.PositionBase.Amount,
      currentPrice: pos.PositionView?.CurrentPrice || 0,
      marketValue,
      currency,
      unrealizedPnl: pnl,
    };
  });

  // Add cash to asset breakdown
  assetBreakdown["Cash"] = balances.CashBalance;

  // Add cash to currency exposure (in base currency)
  const baseCurrency =
    balances.Currency || clientInfo.DefaultCurrency || "USD";
  currencyExposure[baseCurrency] =
    (currencyExposure[baseCurrency] || 0) + balances.CashBalance;

  // Calculate total and weights
  const totalValue =
    balances.TotalValue ||
    Object.values(assetBreakdown).reduce((a, b) => a + b, 0);

  const holdingsWithWeights = holdingsData.map((h) => ({
    ...h,
    weight: totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0,
  }));

  // 7. Persist snapshot
  const snapshotAt = new Date();
  const snapshot = await prisma.portfolioSnapshot.create({
    data: {
      userId,
      totalValue,
      cashBalance: balances.CashBalance,
      unrealizedPnl: totalUnrealizedPnl,
      currency: baseCurrency,
      assetBreakdown,
      currencyExposure,
      snapshotAt,
      holdings: {
        create: holdingsWithWeights,
      },
    },
  });

  const elapsed = Date.now() - startTime;
  console.log(
    `[Snapshot] Built snapshot for user ${userId} in ${elapsed}ms (${holdingsWithWeights.length} holdings)`
  );

  return {
    snapshotId: snapshot.id,
    totalValue,
    cashBalance: balances.CashBalance,
    unrealizedPnl: totalUnrealizedPnl,
    currency: baseCurrency,
    assetBreakdown,
    currencyExposure,
    holdingsCount: holdingsWithWeights.length,
    snapshotAt,
  };
}
