import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { refreshAccessToken, storeTokens } from "./oauth";
import { getSaxoConfig } from "./config";

async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await prisma.saxoConnection.findUnique({
    where: { userId },
    include: { token: true },
  });

  if (!connection?.token) {
    throw new Error("No Saxo connection found. Please connect your account.");
  }

  const token = connection.token;
  const now = new Date();

  // Check if access token is still valid (with 60-second buffer)
  if (token.accessTokenExpiresAt > new Date(now.getTime() + 60_000)) {
    return decrypt({
      ciphertext: token.accessTokenEncrypted,
      iv: token.iv,
      authTag: token.authTag,
    });
  }

  // Access token expired -- try refresh
  if (token.refreshTokenExpiresAt < now) {
    throw new Error("Saxo session expired. Please reconnect your account.");
  }

  const refreshToken = decrypt({
    ciphertext: token.refreshTokenEncrypted,
    iv: token.refreshIv,
    authTag: token.refreshAuthTag,
  });

  if (!token.codeVerifier) {
    throw new Error("Missing code verifier for token refresh.");
  }

  console.log(`[Saxo] Refreshing access token for user ${userId}`);
  const newTokens = await refreshAccessToken(refreshToken, token.codeVerifier);
  await storeTokens(connection.id, newTokens, token.codeVerifier);

  return newTokens.access_token;
}

async function saxoFetch<T>(userId: string, path: string): Promise<T> {
  const config = getSaxoConfig();
  const accessToken = await getValidAccessToken(userId);
  const url = `${config.apiBaseUrl}${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new Error(
      "Saxo API returned 401. Your session may have expired. Please reconnect."
    );
  }

  if (res.status === 429) {
    throw new Error("Saxo API rate limited. Please try again shortly.");
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Saxo API] ${res.status} ${path}: ${body}`);
    throw new Error(`Saxo API error ${res.status}: ${body}`);
  }

  return res.json();
}

// --- Typed API Methods ---

export interface SaxoClientInfo {
  ClientKey: string;
  DefaultAccountKey: string;
  DefaultCurrency: string;
  ClientId: string;
  Name: string;
}

export async function fetchClientInfo(
  userId: string
): Promise<SaxoClientInfo> {
  return saxoFetch(userId, "/port/v1/clients/me");
}

export interface SaxoAccountData {
  AccountKey: string;
  AccountId: string;
  DisplayName: string;
  Currency: string;
  AccountType: string;
}

export interface SaxoAccountsResponse {
  Data: SaxoAccountData[];
}

export async function fetchAccounts(
  userId: string
): Promise<SaxoAccountsResponse> {
  return saxoFetch(userId, "/port/v1/accounts/me");
}

export interface SaxoBalance {
  CashBalance: number;
  TotalValue: number;
  Currency: string;
  UnrealizedPositionsValue: number;
  CostToClosePositions: number;
  NonMarginPositionsValue: number;
  OpenPositionsCount: number;
}

export async function fetchBalances(
  userId: string,
  clientKey: string
): Promise<SaxoBalance> {
  return saxoFetch(
    userId,
    `/port/v1/balances?ClientKey=${encodeURIComponent(clientKey)}`
  );
}

export interface SaxoPosition {
  PositionId: string;
  NetPositionId: string;
  PositionBase: {
    AccountId: string;
    Amount: number;
    AssetType: string;
    Uic: number;
    Status: string;
    OpenPrice?: number;
  };
  PositionView: {
    CurrentPrice: number;
    Exposure: number;
    ExposureCurrency: string;
    ExposureInBaseCurrency: number;
    ProfitLossOnTrade: number;
    ProfitLossOnTradeInBaseCurrency: number;
    MarketValue: number;
    MarketValueInBaseCurrency: number;
    MarketValueOpen: number;
    MarketValueOpenInBaseCurrency: number;
    InstrumentPriceDayPercentChange: number;
    ConversionRateCurrent: number;
  };
  DisplayAndFormat?: {
    Symbol: string;
    Description: string;
    Currency: string;
  };
}

export interface SaxoPositionsResponse {
  Data: SaxoPosition[];
  __count: number;
}

export async function fetchPositions(
  userId: string,
  clientKey: string
): Promise<SaxoPositionsResponse> {
  return saxoFetch(
    userId,
    `/port/v1/positions?ClientKey=${encodeURIComponent(clientKey)}&FieldGroups=PositionBase,PositionView,DisplayAndFormat`
  );
}

// --- Closed Positions (Trade History) ---

export interface SaxoClosedPosition {
  ClosedPosition: {
    AccountId: string;
    Amount: number;
    AssetType: string;
    BuyPrice: number;
    SellPrice: number;
    ClosedProfitLoss: number;
    ClosedProfitLossInBaseCurrency: number;
    ExecutionTimeOpen: string;
    ExecutionTimeClose: string;
    OpenPrice: number;
    ClosingPrice: number;
    Uic: number;
  };
  ClosedPositionUniqueId: string;
  DisplayAndFormat?: {
    Symbol: string;
    Description: string;
    Currency: string;
  };
  NetPositionId: string;
}

export interface SaxoClosedPositionsResponse {
  Data: SaxoClosedPosition[];
  __count: number;
}

// --- Account Performance ---

export async function fetchAccountPerformance(
  userId: string,
  clientKey: string,
  accountKey?: string,
  fromDate?: string,
  toDate?: string
): Promise<Record<string, unknown>> {
  let params = "";
  if (accountKey) params += `&AccountKey=${encodeURIComponent(accountKey)}`;
  if (fromDate) params += `&FromDate=${fromDate}`;
  if (toDate) params += `&ToDate=${toDate}`;
  if (!fromDate && !toDate) params += `&StandardPeriod=Year`;
  return saxoFetch(
    userId,
    `/hist/v3/perf/${encodeURIComponent(clientKey)}?FieldGroups=AccountSummary,TimeWeightedPerformance,BenchmarkPerformance,TradeActivity${params}`
  );
}

// --- Order Activities (Trade History) ---

export async function fetchOrderActivities(
  userId: string,
  top: number = 500
): Promise<Record<string, unknown>> {
  return saxoFetch(
    userId,
    `/cs/v1/audit/orderactivities?EntryType=Last&FieldGroups=DisplayAndFormat&$top=${top}`
  );
}

export async function fetchClosedPositions(
  userId: string,
  clientKey: string,
  accountKey?: string
): Promise<SaxoClosedPositionsResponse> {
  let params = `ClientKey=${encodeURIComponent(clientKey)}`;
  if (accountKey) {
    params += `&AccountKey=${encodeURIComponent(accountKey)}`;
  }
  return saxoFetch(
    userId,
    `/port/v1/closedpositions?${params}&FieldGroups=ClosedPosition,DisplayAndFormat`
  );
}

// --- Chart Data ---

export type ChartRange = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y";

const CHART_RANGE_CONFIG: Record<ChartRange, { horizon: number; count: number }> = {
  "1D": { horizon: 5, count: 78 },
  "1W": { horizon: 60, count: 40 },
  "1M": { horizon: 1440, count: 22 },
  "6M": { horizon: 1440, count: 130 },
  "1Y": { horizon: 1440, count: 260 },
  "5Y": { horizon: 1440, count: 1300 },
};

export async function fetchChartData(
  userId: string,
  uic: number,
  assetType: string,
  range: ChartRange = "1M"
): Promise<Record<string, unknown>> {
  const { horizon, count } = CHART_RANGE_CONFIG[range];
  return saxoFetch(
    userId,
    `/chart/v3/charts?Uic=${uic}&AssetType=${encodeURIComponent(assetType)}&Horizon=${horizon}&Count=${count}`
  );
}

// --- Info Price (Live Quote) ---

export async function fetchInfoPrice(
  userId: string,
  uic: number,
  assetType: string
): Promise<Record<string, unknown>> {
  return saxoFetch(
    userId,
    `/trade/v1/infoprices?Uic=${uic}&AssetType=${encodeURIComponent(assetType)}&FieldGroups=PriceInfo,Quote,PriceInfoDetails,DisplayAndFormat`
  );
}

// --- Instrument Details ---

export async function fetchInstrumentDetails(
  userId: string,
  uic: number,
  assetType: string
): Promise<Record<string, unknown>> {
  return saxoFetch(
    userId,
    `/ref/v1/instruments/details/${uic}/${encodeURIComponent(assetType)}`
  );
}
