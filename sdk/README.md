# arlinkauth

Authentication SDK for Arweave apps. Sign in with GitHub or Google, get an Arweave wallet automatically.

## Installation

```bash
npm install arlinkauth
# or
bun add arlinkauth
```

## Quick Start

```typescript
import { createArlinkAuthClient } from 'arlinkauth';

const auth = createArlinkAuthClient({});
// Uses production URL by default
// Set ARLINKAUTH_API_URL env var in development to override

// Initialize (checks for existing session)
await auth.init();

// Login with GitHub (opens popup)
await auth.login();
// or
await auth.loginWithGoogle();

// Get current user
const user = auth.getState().user;
console.log(user.arweave_address);

// Sign and upload data to Arweave
const result = await auth.dispatch({
  data: 'Hello Arweave',
  tags: [{ name: 'Content-Type', value: 'text/plain' }]
});
console.log(result.id); // Transaction ID

// Logout
auth.logout();
```

## React Integration

```tsx
import { AuthProvider, useAuth } from 'arlinkauth/react';

function App() {
  return (
    <AuthProvider>
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
      <p>Arweave address: {user.arweave_address}</p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
```

## API Reference

### Client Methods

| Method | Description |
|--------|-------------|
| `init()` | Initialize client, check for existing session |
| `login()` | Login with GitHub (default) |
| `loginWithGithub()` | Login with GitHub |
| `loginWithGoogle()` | Login with Google |
| `logout()` | Clear session |
| `getState()` | Get current auth state |
| `getToken()` | Get JWT token |
| `isAuthenticated()` | Check if user is logged in |
| `onAuthChange(callback)` | Subscribe to auth state changes |

### Wallet Methods

| Method | Description |
|--------|-------------|
| `sign(input)` | Sign an Arweave L1 transaction |
| `signDataItem(input)` | Sign an ANS-104 data item |
| `signature(input)` | Create raw signature of data |
| `dispatch(input)` | Sign and upload to Arweave via bundler |

### Types

```typescript
type ArlinkUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  github_id: number | null;
  github_username: string | null;
  google_id: string | null;
  arweave_address: string | null;
  created_at: string;
  updated_at: string;
};

type AuthState = {
  user: ArlinkUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};
```

## License

MIT
