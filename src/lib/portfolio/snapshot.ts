import { prisma } from "@/lib/prisma";
import {
  fetchClientInfo,
  fetchAccounts,
  fetchBalances,
  fetchPositions,
} from "@/lib/saxo/client";

function mapAssetClass(assetType: string): string {
  const normalized = assetType.toLowerCase();
  if (normalized === "stock" || normalized === "cfdonstock") return "Stocks";
  if (normalized === "etf" || normalized === "cfdonetf" || normalized === "etcetf")
    return "ETFs";
  if (normalized === "bond" || normalized === "cfdonbond") return "Bonds";
  if (normalized === "mutualfund") return "Funds";
  if (normalized === "fxspot" || normalized === "fxforwards") return "Forex";
  return "Other";
}

function mapAssetType(saxoAssetType: string): string {
  const normalized = saxoAssetType.toLowerCase();
  if (normalized === "stock" || normalized === "cfdonstock") return "Stock";
  if (normalized === "etf" || normalized === "cfdonetf" || normalized === "etcetf")
    return "ETF";
  if (normalized === "bond" || normalized === "cfdonbond") return "Bond";
  if (normalized === "mutualfund") return "Fund";
  if (normalized === "fxspot" || normalized === "fxforwards") return "Forex";
  return "Other";
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
    const view = pos.PositionView;
    const base = pos.PositionBase;
    const assetClass = mapAssetClass(base.AssetType);
    const assetType = mapAssetType(base.AssetType);
    const currency =
      pos.DisplayAndFormat?.Currency ||
      view?.ExposureCurrency ||
      "USD";

    // Market value in position currency.
    // Saxo returns 0 for CurrentPrice/MarketValue when prices are delayed,
    // so fall back to |MarketValueOpen| + ProfitLossOnTrade (cost + P&L = current value).
    let marketValue = view?.MarketValue || 0;
    if (!marketValue && view?.MarketValueOpen) {
      marketValue = Math.abs(view.MarketValueOpen) + (view.ProfitLossOnTrade || 0);
    }
    if (!marketValue) {
      marketValue = base.Amount * (view?.CurrentPrice || base.OpenPrice || 0);
    }

    // Market value in base currency (for aggregation)
    let marketValueBase = view?.MarketValueInBaseCurrency || 0;
    if (!marketValueBase && view?.MarketValueOpenInBaseCurrency) {
      marketValueBase =
        Math.abs(view.MarketValueOpenInBaseCurrency) +
        (view.ProfitLossOnTradeInBaseCurrency || 0);
    }
    if (!marketValueBase) {
      marketValueBase = marketValue * (view?.ConversionRateCurrent || 1);
    }

    const currentPrice =
      view?.CurrentPrice ||
      (marketValue && base.Amount ? marketValue / base.Amount : 0);

    const pnl = view?.ProfitLossOnTrade || 0;

    // Accumulate asset breakdown (in base currency)
    assetBreakdown[assetClass] = (assetBreakdown[assetClass] || 0) + marketValueBase;

    // Accumulate currency exposure (in position currency)
    currencyExposure[currency] = (currencyExposure[currency] || 0) + marketValue;

    totalUnrealizedPnl += pnl;

    return {
      symbol:
        pos.DisplayAndFormat?.Symbol || `UIC-${base.Uic}`,
      name:
        pos.DisplayAndFormat?.Description ||
        pos.DisplayAndFormat?.Symbol ||
        "Unknown",
      assetType,
      assetClass,
      quantity: base.Amount,
      currentPrice,
      marketValue: marketValueBase,
      currency,
      unrealizedPnl: pnl,
      uic: base.Uic,
      saxoAssetType: base.AssetType,
    };
  });

  // Consolidate tranches of the same instrument by symbol
  const consolidated = new Map<
    string,
    (typeof holdingsData)[number]
  >();
  for (const h of holdingsData) {
    const existing = consolidated.get(h.symbol);
    if (existing) {
      existing.quantity += h.quantity;
      existing.marketValue += h.marketValue;
      existing.unrealizedPnl += h.unrealizedPnl;
      // Recalculate average price from total value / total quantity
      existing.currentPrice =
        existing.quantity > 0 ? existing.marketValue / existing.quantity : 0;
    } else {
      consolidated.set(h.symbol, { ...h });
    }
  }
  const mergedHoldings = [...consolidated.values()];

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

  const holdingsWithWeights = mergedHoldings.map((h) => ({
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
