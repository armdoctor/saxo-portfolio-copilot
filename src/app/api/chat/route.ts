import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod/v4";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isOpenAIConfigured } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import {
  fetchAccountPerformance,
  fetchOrderActivities,
} from "@/lib/saxo/client";

function buildSystemPrompt(portfolioContext: string): string {
  return `You are an expert portfolio analyst copilot for a Saxo Bank investor. You provide deep, actionable analysis grounded in the user's ACTUAL holdings. You think like a personal financial analyst — every answer must reference specific positions, numbers, and facts from the portfolio data below.

PORTFOLIO CONTEXT (always available — use this in EVERY response):
${portfolioContext}

CORE BEHAVIOR:
- EVERY response must reference the user's specific holdings by name, ticker, and numbers. Never give generic market commentary without tying it back to their actual positions.
- When the user asks about market events, sectors, or themes, immediately identify which of their holdings are affected and by how much (by weight, P&L, exposure).
- Example: if asked "how does the tech drawdown affect me?", identify their tech-exposed positions (e.g. AMZN, NVDA, SMH), state their combined weight, unrealized P&L, and what it means for their portfolio.
- Use the tools for ADDITIONAL data beyond what's in the portfolio context: getAccountPerformance for historical returns over time, getOrderHistory for recent trades.
- When presenting data, include "As of <timestamp>" from the snapshot.
- If the snapshot data includes a staleWarning, mention it.
- Format currency values with appropriate symbols and 2 decimal places. Format percentages with 1-2 decimal places.
- You are read-only — you cannot execute trades.
- Use tables when comparing multiple holdings.

ANALYSIS APPROACH:
- Always ground analysis in the specific positions: name the tickers, state the weights, cite the P&L.
- Classify holdings by sector/industry using your knowledge (e.g. AMZN = Consumer Discretionary/Tech, DBS = Financials/Singapore Banks, CSPX = Broad US Market ETF).
- When discussing market themes, map them to the user's actual exposure: "You have X% in tech through NVDA, AMZN, and SMH", "Your Singapore bank exposure (DBS, OCBC, UOB) makes up Y%".
- Analyze concentration risk, currency exposure, sector tilts, and geographic diversification using the real data.
- Be proactive — surface risks and observations the user didn't ask about if they're material.

INVESTMENT RECOMMENDATIONS:
- Give SPECIFIC, actionable recommendations naming concrete instruments. Not "consider diversifying" but "you're 40% in Singapore financials — consider trimming DBS by X shares and adding VWRA for broader exposure."
- Base recommendations on actual gaps: missing sectors, geographic concentration, currency imbalance.
- If you need more context (risk tolerance, horizon, goals), ASK directly.
- End recommendations with a brief disclaimer that these are suggestions, not financial advice.
- Do NOT refuse to give opinions. Be opinionated but transparent about reasoning.`;
}

function formatPortfolioContext(
  snapshot: {
    snapshotAt: Date;
    totalValue: number;
    cashBalance: number;
    unrealizedPnl: number;
    currency: string;
    assetBreakdown: Record<string, number>;
    currencyExposure: Record<string, number>;
    holdings: {
      symbol: string;
      name: string;
      assetType: string;
      assetClass: string;
      quantity: number;
      currentPrice: number;
      marketValue: number;
      currency: string;
      unrealizedPnl: number;
      weight: number;
    }[];
  } | null
): string {
  if (!snapshot) {
    return "No portfolio data available. The user needs to connect their Saxo account in Settings and refresh their portfolio.";
  }

  const ageMs = Date.now() - new Date(snapshot.snapshotAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const stale =
    ageHours > 24
      ? `\n⚠️ STALE DATA: ${Math.round(ageHours)} hours old. Recommend refresh.`
      : ageHours > 6
        ? `\n⚠️ Data is ${Math.round(ageHours)} hours old.`
        : "";

  const holdingsTable = snapshot.holdings
    .map(
      (h) =>
        `  ${h.symbol} | ${h.name} | ${h.assetType} | qty:${h.quantity} | price:${h.currentPrice.toFixed(2)} ${h.currency} | value:${h.marketValue.toFixed(2)} ${snapshot.currency} | P&L:${h.unrealizedPnl >= 0 ? "+" : ""}${h.unrealizedPnl.toFixed(2)} | weight:${h.weight.toFixed(1)}%`
    )
    .join("\n");

  const breakdown = Object.entries(
    snapshot.assetBreakdown as Record<string, number>
  )
    .map(([k, v]) => `  ${k}: ${v.toFixed(2)} ${snapshot.currency} (${((v / snapshot.totalValue) * 100).toFixed(1)}%)`)
    .join("\n");

  const currencies = Object.entries(
    snapshot.currencyExposure as Record<string, number>
  )
    .map(([k, v]) => `  ${k}: ${v.toFixed(2)}`)
    .join("\n");

  return `As of: ${snapshot.snapshotAt.toISOString()}${stale}
Total Value: ${snapshot.totalValue.toFixed(2)} ${snapshot.currency}
Cash Balance: ${snapshot.cashBalance.toFixed(2)} ${snapshot.currency}
Unrealized P&L: ${snapshot.unrealizedPnl >= 0 ? "+" : ""}${snapshot.unrealizedPnl.toFixed(2)} ${snapshot.currency}

Asset Breakdown:
${breakdown}

Currency Exposure:
${currencies}

Holdings (${snapshot.holdings.length} positions, sorted by value):
${holdingsTable}`;
}

export async function POST(req: Request) {
  if (!isOpenAIConfigured()) {
    return new Response(
      JSON.stringify({
        error:
          "Chat is disabled — OPENAI_API_KEY is not configured. Add it to your .env file.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  const rl = rateLimit(`chat:${userId}`, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages } = await req.json();

  // Fetch latest snapshot to inject into system prompt
  const snapshot = await prisma.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotAt: "desc" },
    include: {
      holdings: {
        orderBy: { marketValue: "desc" },
      },
    },
  });

  const portfolioContext = formatPortfolioContext(
    snapshot
      ? {
          ...snapshot,
          assetBreakdown: snapshot.assetBreakdown as Record<string, number>,
          currencyExposure: snapshot.currencyExposure as Record<string, number>,
          holdings: snapshot.holdings.map((h) => ({
            symbol: h.symbol,
            name: h.name,
            assetType: h.assetType,
            assetClass: h.assetClass ?? h.assetType,
            quantity: h.quantity,
            currentPrice: h.currentPrice,
            marketValue: h.marketValue,
            currency: h.currency,
            unrealizedPnl: h.unrealizedPnl ?? 0,
            weight: h.weight,
          })),
        }
      : null
  );

  const result = streamText({
    model: openai("gpt-4o"),
    system: buildSystemPrompt(portfolioContext),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {

      getAccountPerformance: tool({
        description:
          "Get historical performance metrics for the user's Saxo account over a time period. Returns time-weighted returns, account summary, and benchmark comparisons. Use this when the user asks about portfolio performance over time, returns, or how their investments have performed.",
        inputSchema: z.object({
          fromDate: z
            .string()
            .optional()
            .describe(
              "Start date in YYYY-MM-DD format. If omitted, defaults to 1 year."
            ),
          toDate: z
            .string()
            .optional()
            .describe(
              "End date in YYYY-MM-DD format. If omitted, defaults to today."
            ),
        }),
        execute: async (params): Promise<Record<string, unknown>> => {
          console.log(
            `[Chat] Tool call: getAccountPerformance for user ${userId}`
          );

          try {
            const connection = await prisma.saxoConnection.findUnique({
              where: { userId },
              include: { accounts: true },
            });

            if (!connection?.clientKey) {
              return {
                error:
                  "No Saxo connection found. The user needs to connect their account and refresh first.",
              };
            }

            const defaultAccount = connection.accounts[0];
            const perfData = await fetchAccountPerformance(
              userId,
              connection.clientKey,
              defaultAccount?.accountKey,
              params.fromDate,
              params.toDate
            );

            console.log(
              `[Chat] Performance data keys: ${Object.keys(perfData).join(", ")}`
            );

            // Trim time series to monthly samples to avoid token bloat
            const trimmed = { ...perfData };
            if (
              Array.isArray(trimmed.TimeWeightedPerformance) &&
              trimmed.TimeWeightedPerformance.length > 30
            ) {
              const series = trimmed.TimeWeightedPerformance as Record<string, unknown>[];
              const step = Math.ceil(series.length / 12);
              trimmed.TimeWeightedPerformance = series.filter(
                (_, i) => i % step === 0 || i === series.length - 1
              );
              trimmed._note = `Time series sampled to ~monthly from ${series.length} daily points`;
            }

            return {
              fetchedAt: new Date().toISOString(),
              ...trimmed,
            };
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[Chat] getAccountPerformance error: ${errMsg}`);
            return { error: errMsg };
          }
        },
      }),

      getOrderHistory: tool({
        description:
          "Get the user's recent executed orders/trades from Saxo Bank. Returns filled orders with prices, amounts, and timestamps. Use this when the user asks about their recent trades, order history, what they bought/sold, or transaction details.",
        inputSchema: z.object({}),
        execute: async (): Promise<Record<string, unknown>> => {
          console.log(
            `[Chat] Tool call: getOrderHistory for user ${userId}`
          );

          try {
            const orderData = await fetchOrderActivities(userId, 200);
            // Log first entry to debug available fields
            const data = orderData as Record<string, unknown>;
            if (Array.isArray(data.Data) && data.Data.length > 0) {
              console.log(`[Chat] Order activity sample keys: ${Object.keys(data.Data[0]).join(", ")}`);
            }
            // Trim to most recent 50 fills to avoid token bloat
            if (Array.isArray(data.Data) && data.Data.length > 50) {
              data._totalOrders = data.Data.length;
              data.Data = data.Data.slice(0, 50);
              data._note = "Showing 50 most recent orders. Ask for more if needed.";
            }
            return {
              fetchedAt: new Date().toISOString(),
              ...data,
            };
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[Chat] getOrderHistory error: ${errMsg}`);
            return { error: errMsg };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
