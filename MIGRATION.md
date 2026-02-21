# Legacy User Migration

Migrate users with unencrypted wallets from PocketBase to Cloudflare D1.

## Step 1: Get the PocketBase backup

Copy the PocketBase data directory into the project root as `users-port/`:

```
users-port/
  data.db
  auxiliary.db
  storage/
  types.d.ts
```

## Step 2: Get the production encryption key

Check `worker/.dev.vars` for `WALLET_ENCRYPTION_KEY`. Confirm it matches the key in production by running:

```bash
cd worker
npx wrangler secret list
```

`WALLET_ENCRYPTION_KEY` should be listed. The migration script will validate the key against production before proceeding.

## Step 3: Generate the migration SQL

```bash
WALLET_ENCRYPTION_KEY="your-key-here" bun run scripts/migrate-legacy-users.ts
```

This reads `users-port/data.db`, encrypts wallet JWKs, and outputs `scripts/legacy-migration.sql`.

## Step 4: Dry run against local D1 (optional)

```bash
cd worker
npx wrangler d1 execute arlinkauth-db --local --command "SELECT COUNT(*) FROM users"
npx wrangler d1 execute arlinkauth-db --local --file=../scripts/legacy-migration.sql
npx wrangler d1 execute arlinkauth-db --local --command "SELECT COUNT(*) FROM users"
```

## Step 5: Apply to production

```bash
cd worker
npx wrangler d1 execute arlinkauth-db --remote --file=../scripts/legacy-migration.sql
```

## Step 6: Verify

```bash
cd worker
npx wrangler d1 execute arlinkauth-db --remote --command "SELECT COUNT(*) FROM users"
npx wrangler d1 execute arlinkauth-db --remote --command "SELECT COUNT(*) FROM wallets"
```

## Step 7: Cleanup

```bash
rm scripts/legacy-migration.sql
```

The migration is idempotent — safe to run multiple times. Duplicate users/wallets are skipped automatically.
