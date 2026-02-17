import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

// --- Symbol Mapping ---

const EXCHANGE_SUFFIX: Record<string, string> = {
  xnas: "",
  xnys: "",
  arcx: "",
  xlon: ".L",
  xses: ".SI",
  xhkg: ".HK",
  xpar: ".PA",
  xfra: ".DE",
  xams: ".AS",
  xtse: ".TO",
  xasx: ".AX",
};

/**
 * Convert a Saxo-style symbol ("CSPX:xlon") to a Yahoo Finance ticker ("CSPX.L").
 * Returns null if the exchange is not mapped.
 */
export function saxoToYahooSymbol(saxoSymbol: string): string | null {
  const [raw, exchange] = saxoSymbol.split(":");
  if (!raw) return null;

  // Trailing lowercase letter → dash-uppercase (BRKb → BRK-B)
  const ticker = raw.replace(/([A-Z0-9])([a-z])$/, (_, head: string, tail: string) => `${head}-${tail.toUpperCase()}`);

  if (!exchange) return ticker; // No exchange suffix, assume US
  const suffix = EXCHANGE_SUFFIX[exchange.toLowerCase()];
  if (suffix === undefined) return null; // Unknown exchange
  return `${ticker}${suffix}`;
}

// --- Quote ---

export async function fetchYahooQuote(yahooSymbol: string) {
  const result = await yf.quote(yahooSymbol);

  return {
    PriceInfo: {
      High: result.regularMarketDayHigh ?? null,
      Low: result.regularMarketDayLow ?? null,
      PercentChange: result.regularMarketChangePercent ?? null,
    },
    PriceInfoDetails: {
      Open: result.regularMarketOpen ?? null,
      LastClose: result.regularMarketPreviousClose ?? null,
      Volume: result.regularMarketVolume ?? null,
      High52Week: result.fiftyTwoWeekHigh ?? null,
      Low52Week: result.fiftyTwoWeekLow ?? null,
    },
    Quote: {
      Mid: result.regularMarketPrice ?? null,
      Bid: result.bid ?? null,
      Ask: result.ask ?? null,
      PriceTypeAsk: "Tradable",
    },
  };
}

// --- Chart ---

type ChartRange = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y";

const RANGE_DAYS: Record<ChartRange, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "6M": 180,
  "1Y": 365,
  "5Y": 1825,
};

const RANGE_INTERVAL: Record<ChartRange, "5m" | "1h" | "1d" | "1wk"> = {
  "1D": "5m",
  "1W": "1h",
  "1M": "1d",
  "6M": "1d",
  "1Y": "1d",
  "5Y": "1wk",
};

export async function fetchYahooChart(yahooSymbol: string, range: ChartRange) {
  const daysAgo = RANGE_DAYS[range];
  const period1 = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  const result = await yf.chart(yahooSymbol, {
    period1,
    interval: RANGE_INTERVAL[range],
  });

  const data = result.quotes
    .filter((q) => q.close != null)
    .map((q) => ({
      Time: q.date.toISOString(),
      Close: q.close!,
    }));

  return { Data: data };
}

// --- Fundamentals ---

export async function fetchYahooFundamentals(yahooSymbol: string) {
  const result = await yf.quoteSummary(yahooSymbol, {
    modules: ["defaultKeyStatistics", "financialData", "summaryDetail"],
  });

  const stats = result.defaultKeyStatistics;
  const financial = result.financialData;
  const summary = result.summaryDetail;

  return {
    FundamentalData: {
      PriceEarningsRatio: stats?.trailingEps && financial?.currentPrice
        ? financial.currentPrice / stats.trailingEps
        : summary?.trailingPE ?? null,
      MarketCapitalization: summary?.marketCap ?? null,
      DividendYield: summary?.dividendYield != null
        ? summary.dividendYield * 100
        : null,
      EarningsPerShare: stats?.trailingEps ?? null,
    },
  };
}
