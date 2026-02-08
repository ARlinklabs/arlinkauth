# Arlink Auth

## Project Structure

```
arlinkauth/
├── worker/     # Cloudflare Worker backend (handles OAuth, wallet storage, signing)
├── sdk/        # TypeScript SDK for your apps
└── frontend/   # Demo app showing how to use the SDK
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0 or later)
- GitHub OAuth app (for GitHub login)
- Google OAuth credentials (for Google login)

### 1. Clone and Install

```bash
git clone <repo-url>
cd arlinkauth
bun run setup
```

### 2. Set Up OAuth Apps

**GitHub:**
1. Go to GitHub Settings > Developer settings > OAuth Apps > New OAuth App
2. Set Authorization callback URL to `http://localhost:8787/auth/github/callback`
3. Copy the Client ID and Client Secret

**Google:**
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:8787/auth/google/callback` to Authorized redirect URIs
4. Copy the Client ID and Client Secret

### 3. Configure Environment

```bash
cd worker
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your values:

```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
JWT_SECRET=generate_a_random_string_here
WALLET_ENCRYPTION_KEY=generate_another_random_string_here
FRONTEND_URL=http://localhost:3000
```

For production, you can specify multiple frontend origins (comma-separated):
```
FRONTEND_URL=http://localhost:3000,https://arlink.ar.io
```

Generate random strings with:
```bash
openssl rand -base64 32
```

### 4. Run Everything

```bash
# From the root directory
bun run dev
```

This starts:
- Worker API at http://localhost:8787
- Frontend demo at http://localhost:3000
- SDK in watch mode

Open http://localhost:3000 and try logging in.

## Using the SDK

Install the SDK in your project:

```bash
bun add arlinkauth
# or
npm install arlinkauth
```

### Basic Usage

```typescript
import { createArlinkAuthClient } from 'arlinkauth';

const auth = createArlinkAuthClient({
  apiUrl: 'http://localhost:8787' // or your deployed worker URL
});

// Check if user is already logged in
await auth.init();

// Login
await auth.login(); // GitHub by default
// or
await auth.loginWithGoogle();

// Get current user
const user = auth.getUser();
console.log(user.wallet_address); // Their Arweave address

// Sign a data item (for uploading to Arweave via bundlers)
const signed = await auth.signDataItem({
  data: 'Hello Arweave',
  tags: [{ name: 'Content-Type', value: 'text/plain' }]
});

// Upload directly to Arweave
const result = await auth.dispatch({
  data: 'Hello Arweave',
  tags: [{ name: 'Content-Type', value: 'text/plain' }]
});
console.log(result.id); // Arweave transaction ID

// Logout
auth.logout();
```

### React Integration

```tsx
import { AuthProvider, useAuth } from 'arlinkauth/react';

function App() {
  return (
    <AuthProvider apiUrl="http://localhost:8787">
      <YourApp />
    </AuthProvider>
  );
}

function YourApp() {
  const { user, login, loginWithGoogle, logout, client } = useAuth();

  if (!user) {
    return (
      <div>
        <button onClick={login}>Sign in with GitHub</button>
        <button onClick={loginWithGoogle}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <div>
      <p>Welcome, {user.name}</p>
      <p>Your Arweave address: {user.wallet_address}</p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
```

## API Endpoints

The worker exposes these endpoints:

| Endpoint             | Method | Description                           |
| -------------------- | ------ | ------------------------------------- |
| `/auth/github`       | GET    | Start GitHub OAuth flow               |
| `/auth/google`       | GET    | Start Google OAuth flow               |
| `/api/me`            | GET    | Get current user info (requires auth) |
| `/api/wallet/action` | POST   | Sign transactions (requires auth)     |

### Wallet Actions

POST to `/api/wallet/action` with a JSON body:

**Sign a data item:**
```json
{
  "action": "signDataItem",
  "payload": {
    "data": "base64_encoded_data",
    "tags": [{ "name": "Content-Type", "value": "text/plain" }]
  }
}
```

**Get a raw signature:**
```json
{
  "action": "signature",
  "payload": {
    "data": "base64_encoded_data"
  }
}
```

**Sign and upload to Arweave:**
```json
{
  "action": "dispatch",
  "payload": {
    "data": "base64_encoded_data",
    "tags": [{ "name": "Content-Type", "value": "text/plain" }]
  }
}
```

## Security

- Wallet private keys are encrypted with AES-256-GCM before storage
- Encryption uses PBKDF2 with 100,000 iterations for key derivation
- JWTs expire after 7 days
- CORS is restricted to your frontend URL
- Rate limiting: 60 requests/minute for API, 10/minute for auth endpoints
- All inputs are validated with Zod schemas

## Database

The worker uses Cloudflare D1 (SQLite). Two tables:

- `users` - User accounts with OAuth provider IDs
- `wallets` - Encrypted wallet data linked to users

If the same email is used across GitHub and Google, the accounts are linked automatically.

## Development Commands

```bash
# Run everything
bun run dev

# Run individual services
cd worker && bun run dev
cd frontend && bun run dev
cd sdk && bun run dev

# Reset database
cd worker && bun run setup

# Type check
cd worker && bun run typecheck
cd sdk && bun run typecheck
```

## Deploying to Production

1. Create a Cloudflare account
2. Set up the D1 database:
   ```bash
   cd worker
   wrangler d1 create arlinkauth-db
   wrangler d1 execute arlinkauth-db --file=./schema.sql
   ```
3. Set secrets:
   ```bash
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   wrangler secret put JWT_SECRET
   wrangler secret put WALLET_ENCRYPTION_KEY
   wrangler secret put FRONTEND_URL
   ```
4. Update OAuth callback URLs in GitHub/Google to your worker URL
5. Deploy:
   ```bash
   wrangler deploy
   ```

## Limitations

- Wallets are custodial (server holds the keys)
- Users cannot export their wallet (by design, for simplicity)
- No way to import existing wallets
- Single wallet per user

If you need non-custodial wallets, users should use ArConnect or another browser extension instead.

## License

MIT
