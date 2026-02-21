/**
 * Legacy user migration script.
 *
 * Reads users with unencrypted wallets from the PocketBase database
 * (users-port/data.db), encrypts their JWKs using the same AES-256-GCM
 * algorithm used by the Cloudflare Worker, and generates a SQL migration
 * file that can be applied via `wrangler d1 execute`.
 *
 * Usage:
 *   WALLET_ENCRYPTION_KEY="your-key" bun run scripts/migrate-legacy-users.ts
 *
 * Output:
 *   scripts/legacy-migration.sql
 */

import { Database } from "bun:sqlite";
import { resolve } from "path";

// ── Encryption (mirrors worker/src/crypto.ts exactly) ──

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

async function deriveKey(
  masterKey: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterKey),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptJwk(
  jwk: JsonWebKey,
  masterKey: string,
): Promise<{ encrypted: string; salt: string }> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(masterKey, salt);

  const plaintext = encoder.encode(JSON.stringify(jwk));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return {
    encrypted: btoa(String.fromCharCode(...combined)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

async function decryptJwk(
  encrypted: string,
  salt: string,
  masterKey: string,
): Promise<JsonWebKey> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const key = await deriveKey(masterKey, saltBytes);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as JsonWebKey;
}

// ── Key Validation ──

/**
 * Validates the encryption key by fetching an existing wallet from the
 * production D1 database and attempting to decrypt it. Also performs a
 * round-trip encrypt/decrypt self-test to ensure the crypto pipeline works.
 */
async function validateEncryptionKey(masterKey: string): Promise<void> {
  console.log("\nValidating encryption key...");

  // Step 1: Round-trip self-test
  console.log("  [1/2] Round-trip self-test...");
  const testJwk: JsonWebKey = { kty: "RSA", n: "test-n", e: "AQAB", d: "test-d" };
  try {
    const { encrypted, salt } = await encryptJwk(testJwk, masterKey);
    const decrypted = await decryptJwk(encrypted, salt, masterKey);
    if (decrypted.kty !== testJwk.kty || decrypted.n !== testJwk.n || decrypted.d !== testJwk.d) {
      throw new Error("Decrypted JWK does not match original");
    }
    console.log("        Round-trip self-test passed.");
  } catch (e) {
    console.error(
      `        Round-trip self-test FAILED: ${e instanceof Error ? e.message : e}`,
    );
    process.exit(1);
  }

  // Step 2: Validate against production D1 wallet
  console.log("  [2/2] Validating against production D1 database...");
  const workerDir = resolve(import.meta.dir, "../worker");

  try {
    const proc = Bun.spawn(
      [
        "npx",
        "wrangler",
        "d1",
        "execute",
        "arlinkauth-db",
        "--remote",
        "--json",
        "--command",
        "SELECT encrypted_jwk, salt, address FROM wallets LIMIT 1",
      ],
      {
        cwd: workerDir,
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      console.warn(
        `        Could not query production DB (exit code ${exitCode}).`,
      );
      if (stderr) console.warn(`        stderr: ${stderr.trim().split("\n").pop()}`);
      console.warn(
        "        Skipping production validation. Proceeding with self-test only.",
      );
      return;
    }

    // wrangler --json outputs a JSON array of results
    const results = JSON.parse(stdout);
    const rows = results?.[0]?.results;

    if (!rows || rows.length === 0) {
      console.warn(
        "        No wallets found in production DB. Skipping production validation.",
      );
      return;
    }

    const { encrypted_jwk, salt: walletSalt, address } = rows[0];
    const jwk = await decryptJwk(encrypted_jwk, walletSalt, masterKey);

    if (!jwk.kty || !jwk.n || !jwk.e || !jwk.d) {
      throw new Error("Decrypted production JWK is missing required fields");
    }

    console.log(
      `        Successfully decrypted production wallet (address: ${address}).`,
    );
    console.log("        Encryption key is valid.\n");
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("Unsupported state") ||
        e.message.includes("decrypt") ||
        e.message.includes("operation"))
    ) {
      console.error(
        "\n  ERROR: Encryption key does NOT match production.",
      );
      console.error(
        "  The provided WALLET_ENCRYPTION_KEY cannot decrypt existing production wallets.",
      );
      console.error("  Aborting migration to prevent data corruption.\n");
      process.exit(1);
    }
    throw e;
  }
}

// ── SQL Helpers ──

/** Escape a string for use in a SQL single-quoted literal. */
function sqlEscape(value: string | null | undefined): string {
  if (value == null || value === "") return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

// ── Main ──

const WALLET_ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY;
if (!WALLET_ENCRYPTION_KEY) {
  console.error(
    "Error: WALLET_ENCRYPTION_KEY env var is required.\n" +
      "Usage: WALLET_ENCRYPTION_KEY=your-key bun run scripts/migrate-legacy-users.ts",
  );
  process.exit(1);
}

// Validate the key before doing any work
await validateEncryptionKey(WALLET_ENCRYPTION_KEY);

const pbDbPath = resolve(import.meta.dir, "../users-port/data.db");
const outputPath = resolve(import.meta.dir, "legacy-migration.sql");

console.log(`Reading PocketBase database: ${pbDbPath}`);
const db = new Database(pbDbPath, { readonly: true });

// Query: users with unencrypted wallets, joined with their OAuth providers
interface LegacyRow {
  user_id: string;
  email: string;
  name: string;
  created: string;
  updated: string;
  wallet_address: string;
  regular_jwk: string;
  wallet_created: string;
  wallet_updated: string;
  github_id: string | null;
  google_id: string | null;
}

const rows = db
  .query<LegacyRow, []>(
    `
    SELECT
      u.id          AS user_id,
      u.email       AS email,
      u.name        AS name,
      u.created     AS created,
      u.updated     AS updated,
      w.address     AS wallet_address,
      w.regular_jwk AS regular_jwk,
      w.created     AS wallet_created,
      w.updated     AS wallet_updated,
      (SELECT ea.providerId FROM _externalAuths ea
         WHERE ea.recordRef = u.id AND ea.provider = 'github'
         LIMIT 1)   AS github_id,
      (SELECT ea.providerId FROM _externalAuths ea
         WHERE ea.recordRef = u.id AND ea.provider = 'google'
         LIMIT 1)   AS google_id
    FROM users u
    INNER JOIN wallets w ON u.id = w.user
    WHERE w.encrypted = 0
      AND w.regular_jwk IS NOT NULL
      AND w.regular_jwk != ''
    ORDER BY u.created ASC
  `,
  )
  .all();

db.close();

console.log(`Found ${rows.length} users with unencrypted wallets`);

if (rows.length === 0) {
  console.log("Nothing to migrate.");
  process.exit(0);
}

// Build SQL statements
const sqlStatements: string[] = [];

sqlStatements.push("-- Legacy PocketBase user migration");
sqlStatements.push(`-- Generated: ${new Date().toISOString()}`);
sqlStatements.push(`-- Users to migrate: ${rows.length}`);
sqlStatements.push("");

let migrated = 0;
let skipped = 0;

for (const row of rows) {
  const userId = crypto.randomUUID();
  const walletId = crypto.randomUUID();

  // Parse and encrypt the JWK
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(row.regular_jwk);
  } catch (e) {
    console.warn(
      `  Skipping user ${row.email}: invalid JWK JSON`,
    );
    skipped++;
    continue;
  }

  // Validate JWK has required fields
  if (!jwk.n || !jwk.e || !jwk.d) {
    console.warn(
      `  Skipping user ${row.email}: JWK missing required fields (n, e, d)`,
    );
    skipped++;
    continue;
  }

  const { encrypted, salt } = await encryptJwk(jwk, WALLET_ENCRYPTION_KEY);

  // Convert github_id to integer if present (D1 schema expects INTEGER)
  const githubId = row.github_id ? parseInt(row.github_id, 10) : null;
  const googleId = row.google_id; // stays as TEXT

  // Convert PocketBase timestamps (ISO 8601) to SQLite datetime format
  // PocketBase: "2025-07-24 16:55:49.470Z" -> keep as-is, D1 stores TEXT
  const createdAt = row.created;
  const updatedAt = row.updated;
  const walletCreatedAt = row.wallet_created;
  const walletUpdatedAt = row.wallet_updated;

  sqlStatements.push(`-- User: ${row.email} (legacy ID: ${row.user_id})`);

  // INSERT user - skip if email already exists
  sqlStatements.push(
    `INSERT INTO users (id, email, name, avatar_url, github_id, github_username, github_access_token, google_id, google_access_token, created_at, updated_at)` +
      ` SELECT ${sqlEscape(userId)}, ${sqlEscape(row.email)}, ${sqlEscape(row.name)}, NULL,` +
      ` ${githubId ?? "NULL"}, NULL, NULL,` +
      ` ${sqlEscape(googleId)}, NULL,` +
      ` ${sqlEscape(createdAt)}, ${sqlEscape(updatedAt)}` +
      ` WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = ${sqlEscape(row.email)});`,
  );

  // INSERT wallet - use the user id we just created, or the existing user's id if email matched
  // We need to reference the actual user id (could be existing if email matched)
  sqlStatements.push(
    `INSERT INTO wallets (id, user_id, address, encrypted_jwk, salt, created_at, updated_at)` +
      ` SELECT ${sqlEscape(walletId)},` +
      ` (SELECT id FROM users WHERE email = ${sqlEscape(row.email)}),` +
      ` ${sqlEscape(row.wallet_address)}, ${sqlEscape(encrypted)}, ${sqlEscape(salt)},` +
      ` ${sqlEscape(walletCreatedAt)}, ${sqlEscape(walletUpdatedAt)}` +
      ` WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE user_id = (SELECT id FROM users WHERE email = ${sqlEscape(row.email)}))` +
      `   AND NOT EXISTS (SELECT 1 FROM wallets WHERE address = ${sqlEscape(row.wallet_address)});`,
  );

  sqlStatements.push("");
  migrated++;

  process.stdout.write(`  Encrypted wallet for ${row.email}\n`);
}

// Write the SQL file
const sqlContent = sqlStatements.join("\n");
await Bun.write(outputPath, sqlContent);

console.log(`\nDone!`);
console.log(`  Migrated: ${migrated}`);
console.log(`  Skipped:  ${skipped}`);
console.log(`  Output:   ${outputPath}`);
console.log(`\nTo apply locally:`);
console.log(
  `  cd worker && npx wrangler d1 execute arlinkauth-db --local --file=../scripts/legacy-migration.sql`,
);
console.log(`\nTo apply to production:`);
console.log(
  `  cd worker && npx wrangler d1 execute arlinkauth-db --remote --file=../scripts/legacy-migration.sql`,
);
