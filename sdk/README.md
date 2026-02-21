# arlinkauth

Authentication SDK for Arweave apps. Sign in with GitHub or Google, get an Arweave wallet automatically.

Works in **Browser** and **Node.js/CLI** environments.

## Installation

```bash
npm install arlinkauth
# or
bun add arlinkauth
```

## Quick Start

### Auto-detecting Environment

The simplest way to use arlinkauth - it automatically detects your environment:

```typescript
import { createAuthClient } from 'arlinkauth';

const client = await createAuthClient();

// Login (opens browser popup in browser, or browser window in Node)
await client.login();

// Get user info
const user = await client.getMe();
console.log(user.arweave_address);

// Sign and upload data to Arweave
const result = await client.dispatch({
  data: 'Hello Arweave',
  tags: [{ name: 'Content-Type', value: 'text/plain' }]
});
console.log(result.id); // Transaction ID
```

### Browser Usage

```typescript
import { createWauthClient } from 'arlinkauth';

const client = createWauthClient({
  apiUrl: 'https://your-worker.workers.dev'
});

// Initialize (checks for existing session in localStorage)
await client.init();

// Login with GitHub (opens popup)
await client.login();
// or
await client.loginWithGoogle();

// Get current user
const user = client.getState().user;

// Logout
client.logout();
```

### Node.js / CLI Usage

```typescript
import { createNodeAuthClient } from 'arlinkauth';

const client = createNodeAuthClient();

// Login (opens browser, waits for OAuth callback)
const result = await client.login();
if (result.success) {
  console.log('Logged in as:', result.user.name);
}

// Token is stored in ~/.arlinkauth/token
const user = await client.getUser();

// Use wallet methods
await client.dispatch({ data: 'Hello from CLI!' });

// Logout
await client.logout();
```

### React Integration

```tsx
import { AuthProvider, useAuth } from 'arlinkauth/react';

function App() {
  return (
    <AuthProvider apiUrl="https://your-worker.workers.dev">
      <YourApp />
    </AuthProvider>
  );
}

function YourApp() {
  const { user, isLoading, login, loginWithGoogle, logout, client } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  if (!user) {
    return (
      <div>
        <button onClick={() => login()}>Sign in with GitHub</button>
        <button onClick={() => loginWithGoogle()}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <div>
      <p>Welcome, {user.name}</p>
      <p>Arweave address: {user.arweave_address}</p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
```

## CLI

The package includes a CLI for quick authentication:

```bash
# Login via browser
npx arlinkauth login

# Login with specific provider
npx arlinkauth login --provider github
npx arlinkauth login --provider google

# Check current user
npx arlinkauth whoami

# Check auth status
npx arlinkauth status

# Logout
npx arlinkauth logout
```

## API Reference

### Client Factory Functions

| Function | Environment | Description |
|----------|-------------|-------------|
| `createAuthClient()` | Auto | Auto-detects environment, returns appropriate client |
| `createWauthClient(options)` | Browser | Browser client with localStorage + popup OAuth |
| `createNodeAuthClient(options)` | Node.js | Node client with file storage + browser OAuth |
| `createCoreClient(options)` | Any | Low-level client, bring your own TokenStorage |

### Browser Client Methods

| Method | Description |
|--------|-------------|
| `init()` | Initialize client, check for existing session |
| `login(options?)` | Login with GitHub (default) |
| `loginWithGithub(options?)` | Login with GitHub |
| `loginWithGoogle(options?)` | Login with Google |
| `logout()` | Clear session |
| `getState()` | Get current auth state |
| `getToken()` | Get JWT token |
| `isAuthenticated()` | Check if user is logged in |
| `onAuthChange(callback)` | Subscribe to auth state changes |

### Node.js Client Methods

| Method | Description |
|--------|-------------|
| `login(provider?)` | Open browser for OAuth login |
| `logout()` | Clear stored token |
| `getUser()` | Get current user (null if not authenticated) |
| `getMe()` | Get current user (throws if not authenticated) |
| `isAuthenticated()` | Check if user is logged in |
| `getToken()` | Get stored token |
| `setToken(token)` | Set token directly |
| `clearToken()` | Clear stored token |

### Wallet Methods (All Clients)

| Method | Description |
|--------|-------------|
| `sign(input)` | Sign an Arweave L1 transaction |
| `signDataItem(input)` | Sign an ANS-104 data item |
| `signature(input)` | Create raw signature of data |
| `dispatch(input)` | Sign and upload to Arweave via bundler |

### Types

```typescript
type WauthUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  github_id: number | null;
  github_username: string | null;
  github_access_token: string | null;
  google_id: string | null;
  google_access_token: string | null;
  arweave_address: string | null;
  created_at: string;
  updated_at: string;
};

type AuthState = {
  user: WauthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type DispatchInput = {
  data: string | Uint8Array;
  tags?: { name: string; value: string }[];
  target?: string;
  anchor?: string;
  bundler?: 'turbo' | 'irys';
};

type DispatchResult = {
  id: string;
  bundler: 'turbo' | 'irys';
  response: Record<string, unknown>;
};
```

### Configuration Options

**Browser Client (`createWauthClient`):**
```typescript
{
  apiUrl: string;        // Required: Auth worker URL
  tokenKey?: string;     // localStorage key (default: "arlinkauth_token")
}
```

**Node.js Client (`createNodeAuthClient`):**
```typescript
{
  apiUrl?: string;       // Auth worker URL (default: production URL)
  frontendUrl?: string;  // Frontend URL for OAuth (default: production URL)
  tokenPath?: string;    // Token file path (default: ~/.arlinkauth/token)
  timeout?: number;      // Auth timeout in ms (default: 120000)
}
```

## Environment Variables

For Node.js/CLI, set `DEV=true` to use localhost URLs:

```bash
DEV=true npx arlinkauth login
```

This uses:
- API: `http://localhost:8787`
- Frontend: `http://localhost:3000`

## License

MIT
