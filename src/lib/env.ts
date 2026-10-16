import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "TOKEN_ENCRYPTION_KEY must be at least 32 characters (used to derive a 256-bit AES key)"),

  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  SHOPIFY_API_KEY: z.string().optional(),
  SHOPIFY_API_SECRET: z.string().optional(),
  SHOPIFY_APP_URL: z.string().url().optional(),
  SHOPIFY_API_VERSION: z.string().default("2026-07"),
  SHOPIFY_SCOPES: z.string().default("read_products,read_orders,read_customers,write_discounts"),

  CRON_SECRET: z.string().optional(),

  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_MODEL: z.string().default("nvidia/nemotron-3.5-lightning-30b-a3b"),
  NVIDIA_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/**
 * Lazily validates and caches process.env against the server schema.
 * Throws with a readable (but secret-free) message on first use rather than at import time,
 * so build-time analysis of client bundles never touches this.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment configuration:\n${issues}\n\nCheck .env.example for the full list of required variables.`
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Returns true only if every Shopify-related env var needed for OAuth is present. */
export function isShopifyConfigured(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.SHOPIFY_API_KEY && env.SHOPIFY_API_SECRET && env.SHOPIFY_APP_URL);
}

/** Returns true only if the NVIDIA API key is present. */
export function isAiConfigured(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.NVIDIA_API_KEY);
}

/** Returns true only if SMTP credentials are present; otherwise email falls back to console logging. */
export function isEmailConfigured(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM);
}
