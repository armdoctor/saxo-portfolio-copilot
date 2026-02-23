"use client";

import { useCallback, useEffect, useState } from "react";

type State = "loading" | "unlocked" | "locked";

const VERIFIED_KEY = "bio-verified-at";
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours

function sessionValid() {
  try {
    const raw = sessionStorage.getItem(VERIFIED_KEY);
    if (!raw) return false;
    return Date.now() - parseInt(raw, 10) < SESSION_MS;
  } catch {
    return false;
  }
}

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionValid()) {
      setState("unlocked");
      return;
    }
    fetch("/api/webauthn/status")
      .then((r) => r.json())
      .then((d) => setState(d.hasCredential ? "locked" : "unlocked"))
      .catch(() => setState("unlocked")); // fail open
  }, []);

  const unlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const optRes = await fetch("/api/webauthn/authenticate/options", { method: "POST" });
      if (!optRes.ok) throw new Error("Failed to start verification");
      const options = await optRes.json();

      const { startAuthentication } = await import("@simplewebauthn/browser");
      const response = await startAuthentication({ optionsJSON: options });

      const verRes = await fetch("/api/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });
      const verData = await verRes.json();
      if (!verRes.ok || !verData.verified) throw new Error(verData.error ?? "Verification failed");

      sessionStorage.setItem(VERIFIED_KEY, Date.now().toString());
      setState("unlocked");
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Biometric check was cancelled.");
      } else {
        setError(err instanceof Error ? err.message : "Verification failed");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === "loading") {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (state === "locked") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-8 bg-background p-8">
        {/* Lock icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <svg
            className="h-9 w-9 text-muted-foreground"
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
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-semibold">Portfolio Copilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify your identity to continue
          </p>
        </div>

        {error && (
          <p className="max-w-xs text-center text-sm text-destructive">{error}</p>
        )}

        <button
          onClick={unlock}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
              />
            </svg>
          )}
          {busy ? "Verifying…" : "Unlock with Face ID / Touch ID"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
