import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SaxoSettingsClient } from "./client";
import { FreshnessBanner } from "@/components/freshness-banner";
import { BiometricSettings } from "@/components/settings/biometric-settings";

export default async function SaxoSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const connection = await prisma.saxoConnection.findUnique({
    where: { userId: session.user.id },
    include: {
      token: {
        select: {
          accessTokenExpiresAt: true,
          refreshTokenExpiresAt: true,
        },
      },
      accounts: true,
    },
  });

  const latestSnapshot = await prisma.portfolioSnapshot.findFirst({
    where: { userId: session.user.id },
    orderBy: { snapshotAt: "desc" },
    select: { snapshotAt: true },
  });

  const isConnected =
    !!connection?.token &&
    connection.token.accessTokenExpiresAt > new Date(0);

  return (
    <div className="space-y-6">
      <BiometricSettings />
      <FreshnessBanner
        snapshotAt={latestSnapshot?.snapshotAt?.toISOString() || null}
      />
      <Suspense>
        <SaxoSettingsClient
          isConnected={isConnected}
          accounts={connection?.accounts.map((a) => ({
            accountId: a.accountId,
            accountName: a.accountName,
            currency: a.currency,
          })) || []}
          lastSnapshot={latestSnapshot?.snapshotAt?.toISOString() || null}
          tokenExpiry={
            connection?.token?.refreshTokenExpiresAt?.toISOString() || null
          }
          environment={connection?.environment || "sim"}
        />
      </Suspense>
    </div>
  );
}
