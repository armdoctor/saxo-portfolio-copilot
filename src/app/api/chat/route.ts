import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod/v4";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isOpenAIConfigured } from "@/lib/config";

const SYSTEM_PROMPT = `You are a helpful portfolio copilot for a Saxo Bank investor. You help the user understand their portfolio, answer questions about their holdings, and provide insights.

RULES:
- Always use the getPortfolioSnapshot tool to get real portfolio data before answering questions about the user's portfolio. Never make up or guess portfolio data.
- When presenting data, always include the "As of <timestamp>" from the snapshot so the user knows how fresh the data is.
- If the snapshot data includes a staleWarning, mention it to the user (e.g. "Note: this data is X hours old, you may want to refresh.").
- Format currency values with appropriate symbols and 2 decimal places.
- Format percentages with 1-2 decimal places.
- You are read-only -- you cannot execute trades or modify the portfolio.
- If the portfolio data is unavailable or the Saxo account is not connected, tell the user to connect their account in Settings and refresh their portfolio first.
- Be concise but thorough. Use tables when presenting multiple holdings.
- If asked about trading advice, provide general educational information with a disclaimer that this is not financial advice.`;

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
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(3),
    tools: {
      getPortfolioSnapshot: tool({
        description:
          "Get the latest portfolio snapshot including total value, cash balance, asset breakdown, currency exposure, and individual holdings. Use this whenever the user asks about their portfolio, holdings, positions, or account.",
        inputSchema: z.object({}),
        execute: async (): Promise<Record<string, unknown>> => {
          console.log(
            `[Chat] Tool call: getPortfolioSnapshot for user ${userId}`
          );

          const snapshot = await prisma.portfolioSnapshot.findFirst({
            where: { userId },
            orderBy: { snapshotAt: "desc" },
            include: {
              holdings: {
                orderBy: { marketValue: "desc" },
              },
            },
          });

          if (!snapshot) {
            return {
              error:
                "No portfolio data available. The user needs to connect their Saxo account in Settings and click Refresh Portfolio first.",
            };
          }

          // Calculate staleness
          const ageMs =
            Date.now() - new Date(snapshot.snapshotAt).getTime();
          const ageHours = ageMs / (1000 * 60 * 60);
          const staleWarning =
            ageHours > 24
              ? `Data is ${Math.round(ageHours)} hours old. Recommend the user refreshes their portfolio.`
              : ageHours > 6
                ? `Data is ${Math.round(ageHours)} hours old. A refresh is recommended for the latest figures.`
                : null;

          return {
            snapshotAt: snapshot.snapshotAt.toISOString(),
            ...(staleWarning && { staleWarning }),
            totalValue: snapshot.totalValue,
            cashBalance: snapshot.cashBalance,
            unrealizedPnl: snapshot.unrealizedPnl,
            currency: snapshot.currency,
            assetBreakdown: snapshot.assetBreakdown as Record<string, number>,
            currencyExposure: snapshot.currencyExposure as Record<
              string,
              number
            >,
            holdings: snapshot.holdings.map((h) => ({
              symbol: h.symbol,
              name: h.name,
              assetType: h.assetType,
              assetClass: h.assetClass,
              quantity: h.quantity,
              currentPrice: h.currentPrice,
              marketValue: h.marketValue,
              currency: h.currency,
              unrealizedPnl: h.unrealizedPnl,
              weight: h.weight,
            })),
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
