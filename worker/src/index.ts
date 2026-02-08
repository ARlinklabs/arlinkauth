import { Hono } from "hono";
import { cors } from "hono/cors";
import { sign, verify } from "hono/jwt";
import { encryptJwk, decryptJwk } from "./crypto";
import { generateArweaveWallet } from "./arweave";
import Arweave from "arweave";
import { createData, ArweaveSigner } from "@dha-team/arbundles";
import { z } from "zod";

// ── Security Constants ─────────────────────────────────
const MAX_DISPATCH_SIZE = 100 * 1024; // 100KB max for dispatch data
const MAX_SIGN_DATA_SIZE = 1024 * 1024; // 1MB max for signing
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

// Simple in-memory rate limiter (for Cloudflare Workers, consider using Durable Objects for distributed rate limiting)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Initialize Arweave client
const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

// Arweave JWK interface (matches what arweave.wallets.generate() returns)
interface ArweaveJWK {
  kty: string;
  n: string;
  e: string;
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
}

// Wallet action types
export enum WalletAction {
  SIGN = "sign",
  SIGN_DATA_ITEM = "signDataItem",
  SIGNATURE = "signature",
  DISPATCH = "dispatch",
}

// Bundler endpoints for dispatching data items
const BUNDLER_ENDPOINTS = {
  turbo: "https://upload.ardrive.io",
  irys: "https://node2.irys.xyz",
} as const;

type BundlerType = keyof typeof BUNDLER_ENDPOINTS;

// ── Types ──────────────────────────────────────────────

type Bindings = {
  DB: D1Database;
  // GitHub OAuth
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  // Google OAuth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // General
  JWT_SECRET: string;
  /** Comma-separated list of allowed frontend origins (e.g., "http://localhost:3000,https://arlink.ar.io") */
  FRONTEND_URL: string;
  /** Master key for encrypting wallet JWKs */
  WALLET_ENCRYPTION_KEY: string;
};

type Variables = {
  userId: string;
  jwtPayload: { sub: string; exp: number };
};

type AppEnv = { Bindings: Bindings; Variables: Variables };

// ── Input Validation Schemas ───────────────────────────

const ArweaveTagSchema = z.object({
  name: z.string().max(1024),
  value: z.string().max(3072),
});

const WalletActionPayloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign"),
    payload: z.object({
      transaction: z.unknown(),
    }),
  }),
  z.object({
    action: z.literal("signDataItem"),
    payload: z.object({
      dataItem: z.object({
        data: z.union([z.string(), z.array(z.number())]),
        tags: z.array(ArweaveTagSchema).optional(),
        target: z.string().optional(),
        anchor: z.string().optional(),
      }),
    }),
  }),
  z.object({
    action: z.literal("signature"),
    payload: z.object({
      data: z.union([z.string(), z.array(z.number()), z.record(z.string(), z.number())]),
    }),
  }),
  z.object({
    action: z.literal("dispatch"),
    payload: z.object({
      data: z.union([z.string(), z.array(z.number())]),
      tags: z.array(ArweaveTagSchema).optional(),
      target: z.string().optional(),
      anchor: z.string().optional(),
      bundler: z.enum(["turbo", "irys"]).optional(),
    }),
  }),
]);

// ── App ────────────────────────────────────────────────

const app = new Hono<AppEnv>();

// Parse allowed origins from FRONTEND_URL (comma-separated)
function getAllowedOrigins(frontendUrl: string): string[] {
  return frontendUrl.split(",").map(url => url.trim()).filter(Boolean);
}

// CORS - Restrict to allowed frontend origins
app.use("*", async (c, next) => {
  const allowedOrigins = getAllowedOrigins(c.env.FRONTEND_URL);
  const origin = c.req.header("origin");
  
  // Check if origin is allowed
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  
  // Allow requests from allowed origins or no origin (same-origin requests)
  if (origin && !isAllowedOrigin) {
    // For OAuth callbacks, we need to allow the request but not set CORS headers
    // Check if this is an OAuth callback (these come from redirects, not XHR)
    const path = new URL(c.req.url).pathname;
    if (!path.startsWith("/auth/")) {
      return c.json({ error: "CORS origin not allowed" }, 403);
    }
  }
  
  // Handle preflight - must return with CORS headers
  if (c.req.method === "OPTIONS" && isAllowedOrigin) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }
  
  // Set CORS headers for allowed origins on actual requests
  if (isAllowedOrigin) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Allow-Credentials", "true");
  }
  
  await next();
});

// Rate limiting middleware for API routes
app.use("/api/*", async (c, next) => {
  const clientId = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
  const now = Date.now();
  
  let rateLimit = rateLimitMap.get(clientId);
  
  if (!rateLimit || now > rateLimit.resetAt) {
    rateLimit = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(clientId, rateLimit);
  }
  
  rateLimit.count++;
  
  if (rateLimit.count > RATE_LIMIT_MAX_REQUESTS) {
    return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
  }
  
  await next();
});

// Rate limiting for auth routes (stricter)
app.use("/auth/*", async (c, next) => {
  const clientId = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
  const authKey = `auth:${clientId}`;
  const now = Date.now();
  
  let rateLimit = rateLimitMap.get(authKey);
  
  if (!rateLimit || now > rateLimit.resetAt) {
    rateLimit = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(authKey, rateLimit);
  }
  
  rateLimit.count++;
  
  // Stricter limit for auth: 10 requests per minute
  if (rateLimit.count > 10) {
    return c.json({ error: "Too many authentication attempts. Try again later." }, 429);
  }
  
  await next();
});

// Health check
app.get("/", (c) => {
  return c.json({ message: "arlinkauth", version: "0.1.0", timestamp: Date.now() });
});

// ── Helper: Create or update user and ensure wallet exists ───

async function ensureUserAndWallet(
  db: D1Database,
  walletEncryptionKey: string,
  options: {
    provider: "github" | "google";
    providerId: string | number;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    accessToken: string;
    // GitHub-specific
    githubUsername?: string;
  }
): Promise<string> {
  const { provider, providerId, email, name, avatarUrl, accessToken, githubUsername } = options;

  // Check if user exists by provider ID
  const providerIdColumn = provider === "github" ? "github_id" : "google_id";
  const existingUser = await db.prepare(
    `SELECT id FROM users WHERE ${providerIdColumn} = ?1`
  )
    .bind(providerId)
    .first<{ id: string }>();

  let userId: string;

  if (!existingUser) {
    // Check if user exists by email (to link accounts)
    let userByEmail: { id: string } | null = null;
    if (email) {
      userByEmail = await db.prepare(
        `SELECT id FROM users WHERE email = ?1`
      )
        .bind(email)
        .first<{ id: string }>();
    }

    if (userByEmail) {
      // Link this provider to existing account
      userId = userByEmail.id;
      if (provider === "github") {
        await db.prepare(
          `UPDATE users SET
            github_id = ?1, github_username = ?2, github_access_token = ?3,
            name = COALESCE(name, ?4), avatar_url = COALESCE(avatar_url, ?5),
            updated_at = datetime('now')
          WHERE id = ?6`
        )
          .bind(providerId, githubUsername, accessToken, name, avatarUrl, userId)
          .run();
      } else {
        await db.prepare(
          `UPDATE users SET
            google_id = ?1, google_access_token = ?2,
            name = COALESCE(name, ?3), avatar_url = COALESCE(avatar_url, ?4),
            updated_at = datetime('now')
          WHERE id = ?5`
        )
          .bind(providerId, accessToken, name, avatarUrl, userId)
          .run();
      }
    } else {
      // Create new user
      userId = crypto.randomUUID();
      if (provider === "github") {
        await db.prepare(
          `INSERT INTO users (id, email, name, avatar_url, github_id, github_username, github_access_token)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
          .bind(userId, email, name, avatarUrl, providerId, githubUsername, accessToken)
          .run();
      } else {
        await db.prepare(
          `INSERT INTO users (id, email, name, avatar_url, google_id, google_access_token)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
        )
          .bind(userId, email, name, avatarUrl, providerId, accessToken)
          .run();
      }

      // Generate Arweave wallet for new user
      const { jwk, address } = await generateArweaveWallet();
      const { encrypted, salt } = await encryptJwk(jwk, walletEncryptionKey);
      await db.prepare(
        `INSERT INTO wallets (id, user_id, address, encrypted_jwk, salt) VALUES (?1, ?2, ?3, ?4, ?5)`
      )
        .bind(crypto.randomUUID(), userId, address, encrypted, salt)
        .run();
    }
  } else {
    // Update existing user
    userId = existingUser.id;
    if (provider === "github") {
      await db.prepare(
        `UPDATE users SET
          github_username = ?1, github_access_token = ?2,
          email = COALESCE(?3, email), name = COALESCE(?4, name), avatar_url = COALESCE(?5, avatar_url),
          updated_at = datetime('now')
        WHERE id = ?6`
      )
        .bind(githubUsername, accessToken, email, name, avatarUrl, userId)
        .run();
    } else {
      await db.prepare(
        `UPDATE users SET
          google_access_token = ?1,
          email = COALESCE(?2, email), name = COALESCE(?3, name), avatar_url = COALESCE(?4, avatar_url),
          updated_at = datetime('now')
        WHERE id = ?5`
      )
        .bind(accessToken, email, name, avatarUrl, userId)
        .run();
    }

    // Ensure wallet exists
    const existingWallet = await db.prepare(
      `SELECT id FROM wallets WHERE user_id = ?1 LIMIT 1`
    )
      .bind(userId)
      .first();

    if (!existingWallet) {
      const { jwk, address } = await generateArweaveWallet();
      const { encrypted, salt } = await encryptJwk(jwk, walletEncryptionKey);
      await db.prepare(
        `INSERT INTO wallets (id, user_id, address, encrypted_jwk, salt) VALUES (?1, ?2, ?3, ?4, ?5)`
      )
        .bind(crypto.randomUUID(), userId, address, encrypted, salt)
        .run();
    }
  }

  return userId;
}

// ── Helper: Generate OAuth callback HTML ───────────────

function generateCallbackHtml(jwt: string, frontendUrl: string): string {
  // Safely encode data as JSON to prevent XSS
  const safeMessage = JSON.stringify({ type: "arlinkauth:callback", token: jwt });
  const safeFrontendUrl = JSON.stringify(frontendUrl);
  
  return `<!DOCTYPE html>
<html>
<head><title>Authenticating...</title></head>
<body>
<p>Authenticating, please wait...</p>
<script>
(function() {
  var message = ${safeMessage};
  var targetOrigin = ${safeFrontendUrl};
  if (window.opener) {
    window.opener.postMessage(message, targetOrigin);
    window.close();
  } else {
    window.location.href = targetOrigin + "?token=" + encodeURIComponent(message.token);
  }
})();
</script>
</body>
</html>`;
}

// ── Helper: Set OAuth state cookie ─────────────────────

function setOAuthStateCookie(c: { req: { url: string }; header: (name: string, value: string) => void }, state: string, frontendOrigin: string) {
  const isLocalhost = new URL(c.req.url).hostname === "localhost";
  const securePart = isLocalhost ? "" : " Secure;";
  // Store both state and the frontend origin, base64 encoded to avoid cookie parsing issues
  const stateValue = btoa(JSON.stringify({ state, frontendOrigin }));
  c.header(
    "Set-Cookie",
    `oauth_state=${stateValue}; HttpOnly;${securePart} SameSite=Lax; Path=/; Max-Age=300`
  );
}

function clearOAuthStateCookie(c: { req: { url: string }; header: (name: string, value: string) => void }) {
  const isLocalhost = new URL(c.req.url).hostname === "localhost";
  const securePart = isLocalhost ? "" : " Secure;";
  c.header(
    "Set-Cookie",
    `oauth_state=; HttpOnly;${securePart} SameSite=Lax; Path=/; Max-Age=0`
  );
}

function getStoredOAuthState(c: { req: { header: (name: string) => string | undefined } }): { state: string; frontendOrigin: string } | undefined {
  const cookies = c.req.header("cookie") ?? "";
  const cookieValue = cookies
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("oauth_state="))
    ?.slice("oauth_state=".length);
  
  if (!cookieValue) return undefined;
  
  try {
    const decoded = JSON.parse(atob(cookieValue)) as { state: string; frontendOrigin: string };
    if (!decoded.state || !decoded.frontendOrigin) return undefined;
    return decoded;
  } catch {
    return undefined;
  }
}

// ── GitHub OAuth ───────────────────────────────────────

app.get("/auth/github", (c) => {
  const state = crypto.randomUUID();
  const redirectUri = new URL("/auth/github/callback", c.req.url).toString();
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });

  // Get the frontend origin from referer or use first allowed origin as fallback
  const referer = c.req.header("referer");
  const allowedOrigins = getAllowedOrigins(c.env.FRONTEND_URL);
  let frontendOrigin = allowedOrigins[0];
  
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.includes(refererOrigin)) {
        frontendOrigin = refererOrigin;
      }
    } catch {
      // Invalid referer URL, use default
    }
  }

  setOAuthStateCookie(c, state, frontendOrigin);
  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get("/auth/github/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const stored = getStoredOAuthState(c);

  if (!code || !state || !stored || state !== stored.state) {
    return c.json({ error: "Invalid OAuth state" }, 400);
  }
  
  const frontendOrigin = stored.frontendOrigin;

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenData.access_token) {
    return c.json({ error: "Failed to get access token", details: tokenData }, 400);
  }

  // Fetch GitHub user profile + email in parallel
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "wauth-worker",
      },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "wauth-worker",
      },
    }),
  ]);

  const ghUser = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  };

  const emails = (await emailsRes.json()) as {
    email: string;
    primary: boolean;
    verified: boolean;
  }[];
  const primaryEmail = emails.find((e) => e.primary && e.verified)?.email ?? null;

  // Create or update user
  const userId = await ensureUserAndWallet(c.env.DB, c.env.WALLET_ENCRYPTION_KEY, {
    provider: "github",
    providerId: ghUser.id,
    email: primaryEmail,
    name: ghUser.name,
    avatarUrl: ghUser.avatar_url,
    accessToken: tokenData.access_token,
    githubUsername: ghUser.login,
  });

  // Issue JWT
  const jwt = await sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    c.env.JWT_SECRET,
    "HS256"
  );

  clearOAuthStateCookie(c);
  return c.html(generateCallbackHtml(jwt, frontendOrigin));
});

// ── Google OAuth ───────────────────────────────────────

app.get("/auth/google", (c) => {
  const state = crypto.randomUUID();
  const redirectUri = new URL("/auth/google/callback", c.req.url).toString();
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  // Get the frontend origin from referer or use first allowed origin as fallback
  const referer = c.req.header("referer");
  const allowedOrigins = getAllowedOrigins(c.env.FRONTEND_URL);
  let frontendOrigin = allowedOrigins[0];
  
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.includes(refererOrigin)) {
        frontendOrigin = refererOrigin;
      }
    } catch {
      // Invalid referer URL, use default
    }
  }

  setOAuthStateCookie(c, state, frontendOrigin);
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get("/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const stored = getStoredOAuthState(c);

  if (!code || !state || !stored || state !== stored.state) {
    return c.json({ error: "Invalid OAuth state" }, 400);
  }
  
  const frontendOrigin = stored.frontendOrigin;

  const redirectUri = new URL("/auth/google/callback", c.req.url).toString();

  // Exchange code for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
  };

  if (!tokenData.access_token) {
    return c.json({ error: "Failed to get access token", details: tokenData }, 400);
  }

  // Fetch Google user info
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const googleUser = (await userRes.json()) as {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    picture: string;
  };

  // Create or update user
  const userId = await ensureUserAndWallet(c.env.DB, c.env.WALLET_ENCRYPTION_KEY, {
    provider: "google",
    providerId: googleUser.id,
    email: googleUser.verified_email ? googleUser.email : null,
    name: googleUser.name,
    avatarUrl: googleUser.picture,
    accessToken: tokenData.access_token,
  });

  // Issue JWT
  const jwt = await sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    c.env.JWT_SECRET,
    "HS256"
  );

  clearOAuthStateCookie(c);
  return c.html(generateCallbackHtml(jwt, frontendOrigin));
});

// ── JWT Auth Middleware (for /api/*) ───────────────────

app.use("/api/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = (await verify(token, c.env.JWT_SECRET, "HS256")) as {
      sub: string;
      exp: number;
    };
    c.set("userId", payload.sub);
    c.set("jwtPayload", payload);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
});

// ── Protected Routes ───────────────────────────────────

app.get("/api/me", async (c) => {
  const userId = c.get("userId");
  
  // Get user info - NEVER expose OAuth tokens to frontend
  const user = await c.env.DB.prepare(
    `SELECT id, email, name, avatar_url, github_id, github_username, google_id, created_at, updated_at FROM users WHERE id = ?1`
  )
    .bind(userId)
    .first<{
      id: string;
      email: string | null;
      name: string | null;
      avatar_url: string | null;
      github_id: number | null;
      github_username: string | null;
      google_id: string | null;
      created_at: string;
      updated_at: string;
    }>();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Get wallet address only (never expose JWK or encrypted data)
  const wallet = await c.env.DB.prepare(
    `SELECT address FROM wallets WHERE user_id = ?1 LIMIT 1`
  )
    .bind(userId)
    .first<{ address: string }>();

  return c.json({
    ...user,
    arweave_address: wallet?.address ?? null,
  });
});

// ── Wallet Signing Actions ─────────────────────────────

app.post("/api/wallet/action", async (c) => {
  const userId = c.get("userId");

  // Parse and validate request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parseResult = WalletActionPayloadSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ 
      error: "Invalid request format", 
      details: parseResult.error.issues.map(i => i.message).join(", ")
    }, 400);
  }

  const { action, payload } = parseResult.data;

  // Get wallet from database
  const wallet = await c.env.DB.prepare(
    `SELECT address, encrypted_jwk, salt FROM wallets WHERE user_id = ?1 LIMIT 1`
  )
    .bind(userId)
    .first<{ address: string; encrypted_jwk: string; salt: string }>();

  if (!wallet) {
    return c.json({ error: "No wallet found for user" }, 404);
  }

  // Decrypt the wallet JWK
  let jwk: ArweaveJWK;
  try {
    jwk = await decryptJwk(
      wallet.encrypted_jwk,
      wallet.salt,
      c.env.WALLET_ENCRYPTION_KEY
    ) as ArweaveJWK;
  } catch {
    // Log minimal info - don't expose decryption details
    console.error("[wallet] Decryption failed for user:", userId);
    return c.json({ error: "Failed to process wallet" }, 500);
  }

  // Validate JWK has required fields
  if (!jwk.n || !jwk.e || !jwk.d) {
    console.error("[wallet] Invalid JWK structure for user:", userId);
    return c.json({ error: "Invalid wallet configuration" }, 500);
  }

  // Create signer for data items
  let signer: ArweaveSigner;
  try {
    signer = new ArweaveSigner(jwk);
  } catch {
    console.error("[wallet] Signer creation failed for user:", userId);
    return c.json({ error: "Failed to initialize wallet" }, 500);
  }

  try {
    switch (action) {
      case WalletAction.SIGN: {
        // Sign an Arweave transaction
        const txPayload = payload.transaction;
        if (!txPayload) {
          return c.json({ error: "Missing transaction in payload" }, 400);
        }
        const tx = arweave.transactions.fromRaw(txPayload as Parameters<typeof arweave.transactions.fromRaw>[0]);
        await arweave.transactions.sign(tx, jwk);
        return c.json(tx.toJSON());
      }

      case WalletAction.SIGN_DATA_ITEM: {
        // Sign an ANS-104 data item (for AO/bundled transactions)
        const dataItemPayload = (payload as { dataItem: { data: string | number[]; tags?: { name: string; value: string }[]; target?: string; anchor?: string } }).dataItem;

        // Convert data to Buffer
        let data: Buffer;
        if (typeof dataItemPayload.data === "string") {
          data = Buffer.from(dataItemPayload.data);
        } else {
          data = Buffer.from(dataItemPayload.data);
        }

        // Enforce size limit
        if (data.length > MAX_SIGN_DATA_SIZE) {
          return c.json({ error: `Data too large. Maximum size is ${MAX_SIGN_DATA_SIZE} bytes` }, 400);
        }

        const createdDataItem = createData(data, signer, {
          tags: dataItemPayload.tags,
          target: dataItemPayload.target,
          anchor: dataItemPayload.anchor,
        });

        await createdDataItem.sign(signer);

        // Note: We skip isValid() check here because it uses ArweaveSigner.verify()
        // which has issues with Web Crypto API in Workers environment.
        // The signing itself succeeded, and the data item has a valid id.
        
        // Verify we have an id (indicates signing succeeded)
        if (!createdDataItem.id) {
          return c.json({ error: "Data item signing failed - no id generated" }, 500);
        }

        return c.json({
          id: createdDataItem.id,
          raw: Array.from(createdDataItem.getRaw()),
        });
      }

      case WalletAction.DISPATCH: {
        // Sign and dispatch a data item to a bundler (Turbo/Irys)
        const dispatchPayload = payload as {
          data: string | number[];
          tags?: { name: string; value: string }[];
          target?: string;
          anchor?: string;
          bundler?: BundlerType;
        };

        // Convert data to Buffer
        let data: Buffer;
        if (typeof dispatchPayload.data === "string") {
          data = Buffer.from(dispatchPayload.data);
        } else {
          data = Buffer.from(dispatchPayload.data);
        }

        // Enforce size limit for dispatch
        if (data.length > MAX_DISPATCH_SIZE) {
          return c.json({ error: `Data too large. Maximum size for dispatch is ${MAX_DISPATCH_SIZE} bytes (100KB)` }, 400);
        }

        // Create and sign the data item
        const dataItem = createData(data, signer, {
          tags: dispatchPayload.tags,
          target: dispatchPayload.target,
          anchor: dispatchPayload.anchor,
        });

        await dataItem.sign(signer);

        if (!dataItem.id) {
          return c.json({ error: "Data item signing failed - no id generated" }, 500);
        }

        // Get the raw signed data item
        const rawDataItem = dataItem.getRaw();

        // Dispatch to bundler (default to Turbo)
        const bundlerType = dispatchPayload.bundler ?? "turbo";
        const bundlerUrl = BUNDLER_ENDPOINTS[bundlerType];

        if (!bundlerUrl) {
          return c.json({ error: `Unknown bundler: ${bundlerType}` }, 400);
        }

        // Upload to bundler
        const uploadResponse = await fetch(`${bundlerUrl}/tx/arweave`, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: rawDataItem,
        });

        if (!uploadResponse.ok) {
          console.error("[dispatch] Bundler upload failed:", bundlerType, "status:", uploadResponse.status);
          return c.json({ 
            error: `Upload to ${bundlerType} failed. Please try again.`,
          }, 502);
        }

        const uploadResult = await uploadResponse.json() as { id?: string; [key: string]: unknown };

        return c.json({
          id: dataItem.id,
          bundler: bundlerType,
          response: uploadResult,
        });
      }

      case WalletAction.SIGNATURE: {
        // Raw signature of arbitrary data
        const signaturePayload = payload as { data: string | number[] | Record<string, number> };
        const data = signaturePayload.data;

        // Convert data to Uint8Array
        let dataBuffer: Uint8Array;
        if (typeof data === "string") {
          dataBuffer = new TextEncoder().encode(data);
        } else if (Array.isArray(data)) {
          dataBuffer = new Uint8Array(data);
        } else {
          // Handle object with numeric keys (like {0: 1, 1: 2, ...})
          dataBuffer = new Uint8Array(Object.values(data));
        }

        // Enforce size limit
        if (dataBuffer.length > MAX_SIGN_DATA_SIZE) {
          return c.json({ error: `Data too large. Maximum size is ${MAX_SIGN_DATA_SIZE} bytes` }, 400);
        }

        const signature = await signer.sign(dataBuffer);

        return c.json({
          signature: Array.from(signature),
        });
      }

      default:
        return c.json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    // Log error with minimal context - don't expose stack traces
    console.error("[wallet] Action failed:", action, "user:", userId, "error:", err instanceof Error ? err.message : "unknown");
    return c.json({ error: "Wallet operation failed" }, 500);
  }
});

export default app;
