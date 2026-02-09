"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Account {
  accountId: string;
  accountName: string | null;
  currency: string;
}

interface Props {
  isConnected: boolean;
  accounts: Account[];
  lastSnapshot: string | null;
  tokenExpiry: string | null;
  environment: string;
}

export function SaxoSettingsClient({
  isConnected,
  accounts,
  lastSnapshot,
  tokenExpiry,
  environment,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const successMsg = searchParams.get("success");
  const errorMsg = searchParams.get("error");

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect your Saxo account?"))
      return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/saxo/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Refresh failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const isTokenExpired = tokenExpiry
    ? new Date(tokenExpiry) < new Date()
    : false;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Saxo Bank Connection</h2>
        <p className="text-muted-foreground">
          Connect your Saxo Bank account to view your portfolio
        </p>
      </div>

      {(successMsg || errorMsg) && (
        <div
          className={`rounded-md p-3 text-sm ${
            successMsg
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {successMsg === "connected"
            ? "Successfully connected to Saxo Bank!"
            : errorMsg === "oauth_denied"
              ? "Authorization was denied."
              : errorMsg === "missing_verifier"
                ? "OAuth flow error. Please try again."
                : errorMsg === "token_exchange_failed"
                  ? "Failed to exchange tokens. Please try again."
                  : errorMsg}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connection Status</CardTitle>
              <CardDescription>
                Environment: {environment.toUpperCase()}
              </CardDescription>
            </div>
            <Badge variant={isConnected && !isTokenExpired ? "default" : "secondary"}>
              {isConnected
                ? isTokenExpired
                  ? "Session Expired"
                  : "Connected"
                : "Not Connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected && accounts.length > 0 && (
            <>
              <div>
                <h4 className="mb-2 text-sm font-medium">Accounts</h4>
                <div className="space-y-1">
                  {accounts.map((acct) => (
                    <div
                      key={acct.accountId}
                      className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                    >
                      <span>{acct.accountName || acct.accountId}</span>
                      <Badge variant="outline">{acct.currency}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {lastSnapshot && (
            <div className="text-sm text-muted-foreground">
              Last refresh:{" "}
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(lastSnapshot))}
            </div>
          )}

          <div className="flex gap-3">
            {isConnected ? (
              <>
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing || isTokenExpired}
                >
                  {refreshing ? "Refreshing..." : "Refresh Portfolio"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </>
            ) : (
              <Button asChild>
                <a href="/api/saxo/start">Connect Saxo Account</a>
              </Button>
            )}

            {isTokenExpired && (
              <Button asChild variant="outline">
                <a href="/api/saxo/start">Reconnect</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
