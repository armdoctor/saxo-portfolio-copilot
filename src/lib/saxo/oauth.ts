import { getSaxoConfig } from "./config";
import { generateCodeChallenge } from "./pkce";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export function buildAuthorizationUrl(
  codeVerifier: string,
  state: string
): string {
  const config = getSaxoConfig();
  const challenge = generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.appKey,
    redirect_uri: config.redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  return `${config.authBaseUrl}/authorize?${params.toString()}`;
}

export interface SaxoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<SaxoTokenResponse> {
  const config = getSaxoConfig();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.appKey,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });

  // Add client_secret if provided
  if (config.appSecret) {
    body.set("client_secret", config.appSecret);
  }

  const res = await fetch(`${config.authBaseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${error}`);
  }

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  codeVerifier: string
): Promise<SaxoTokenResponse> {
  const config = getSaxoConfig();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.appKey,
    refresh_token: refreshToken,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });

  if (config.appSecret) {
    body.set("client_secret", config.appSecret);
  }

  const res = await fetch(`${config.authBaseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${error}`);
  }

  return res.json();
}

export async function storeTokens(
  connectionId: string,
  tokens: SaxoTokenResponse,
  codeVerifier: string
) {
  const accessEncrypted = encrypt(tokens.access_token);
  const refreshEncrypted = encrypt(tokens.refresh_token);
  const now = new Date();

  await prisma.saxoToken.upsert({
    where: { connectionId },
    create: {
      connectionId,
      accessTokenEncrypted: accessEncrypted.ciphertext,
      iv: accessEncrypted.iv,
      authTag: accessEncrypted.authTag,
      refreshTokenEncrypted: refreshEncrypted.ciphertext,
      refreshIv: refreshEncrypted.iv,
      refreshAuthTag: refreshEncrypted.authTag,
      accessTokenExpiresAt: new Date(
        now.getTime() + tokens.expires_in * 1000
      ),
      refreshTokenExpiresAt: new Date(
        now.getTime() + tokens.refresh_token_expires_in * 1000
      ),
      codeVerifier,
    },
    update: {
      accessTokenEncrypted: accessEncrypted.ciphertext,
      iv: accessEncrypted.iv,
      authTag: accessEncrypted.authTag,
      refreshTokenEncrypted: refreshEncrypted.ciphertext,
      refreshIv: refreshEncrypted.iv,
      refreshAuthTag: refreshEncrypted.authTag,
      accessTokenExpiresAt: new Date(
        now.getTime() + tokens.expires_in * 1000
      ),
      refreshTokenExpiresAt: new Date(
        now.getTime() + tokens.refresh_token_expires_in * 1000
      ),
      codeVerifier,
    },
  });
}
