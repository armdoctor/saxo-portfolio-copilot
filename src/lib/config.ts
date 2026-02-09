const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "TOKEN_ENCRYPTION_KEY",
  "SAXO_APP_KEY",
  "SAXO_REDIRECT_URI",
  "APP_USER_EMAIL",
  "APP_USER_PASSWORD",
] as const;

const OPTIONAL_ENV_VARS = [
  "OPENAI_API_KEY",
  "SAXO_APP_SECRET",
  "SAXO_ENV",
] as const;

let validated = false;

export function validateEnv() {
  if (validated) return;

  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}\n\nCopy .env.example to .env and fill in all required values.`
    );
  }

  // Validate TOKEN_ENCRYPTION_KEY is 32 bytes base64
  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY!;
  try {
    const buf = Buffer.from(tokenKey, "base64");
    if (buf.length !== 32) {
      throw new Error(
        `TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (got ${buf.length}). Generate with:\n  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("32 bytes")) throw e;
    throw new Error("TOKEN_ENCRYPTION_KEY must be a valid base64 string.");
  }

  validated = true;
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
