export function getSaxoConfig() {
  const env = process.env.SAXO_ENV || "sim";
  const isLive = env === "live";

  return {
    appKey: process.env.SAXO_APP_KEY!,
    appSecret: process.env.SAXO_APP_SECRET || "",
    redirectUri: process.env.SAXO_REDIRECT_URI!,
    authBaseUrl: isLive
      ? "https://live.logonvalidation.net"
      : "https://sim.logonvalidation.net",
    apiBaseUrl: isLive
      ? "https://gateway.saxobank.com/openapi"
      : "https://gateway.saxobank.com/sim/openapi",
    environment: env,
  };
}
