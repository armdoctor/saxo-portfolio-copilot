"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function BiometricSettings() {
  const [hasCredential, setHasCredential] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/webauthn/status");
      const data = await res.json();
      setHasCredential(data.hasCredential);
    } catch {
      setHasCredential(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const optRes = await fetch("/api/webauthn/register/options", { method: "POST" });
      if (!optRes.ok) throw new Error("Failed to start registration");
      const options = await optRes.json();

      const { startRegistration } = await import("@simplewebauthn/browser");
      const response = await startRegistration({ optionsJSON: options });

      const verRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });
      const verData = await verRes.json();
      if (!verRes.ok || !verData.verified) throw new Error(verData.error ?? "Registration failed");

      // Mark session as verified so the gate doesn't immediately re-lock
      sessionStorage.setItem("bio-verified-at", Date.now().toString());
      setMessage("Biometric lock enabled.");
      setHasCredential(true);
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Registration was cancelled.");
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    if (!confirm("Remove biometric lock? Anyone with access to your account can view your portfolio without biometric verification.")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/webauthn/credentials", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove credentials");
      sessionStorage.removeItem("bio-verified-at");
      setMessage("Biometric lock removed.");
      setHasCredential(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          Biometric Lock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Require Face ID or Touch ID each time you open the app, even when already signed in.
        </p>

        {hasCredential === null ? (
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {hasCredential ? (
                <span className="text-green-600">Enabled</span>
              ) : (
                <span className="text-muted-foreground">Disabled</span>
              )}
            </span>
            <Button
              size="sm"
              variant={hasCredential ? "outline" : "default"}
              onClick={hasCredential ? disable : enable}
              disabled={busy}
            >
              {busy ? "Please wait…" : hasCredential ? "Remove" : "Enable"}
            </Button>
          </div>
        )}

        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
