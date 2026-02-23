export function getWebAuthnConfig() {
  const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
  const origin = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";
  return { rpID, rpName: "Portfolio Copilot", origin };
}
