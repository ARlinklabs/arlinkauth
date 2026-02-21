# Arlink Auth Implementation Guide

This guide covers how to integrate Arlink Auth into:
1. **Arlink Website** - Browser-based authentication with React
2. **Arlink CLI** - Command-line tool authentication

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Part 1: Website Integration](#part-1-website-integration)
  - [Installation](#installation)
  - [Setup AuthProvider](#setup-authprovider)
  - [Add Login UI](#add-login-ui)
  - [Use Wallet Features](#use-wallet-features)
  - [Full Example](#full-example)
- [Part 2: CLI Integration](#part-2-cli-integration)
  - [Installation](#cli-installation)
  - [Basic Authentication](#basic-authentication)
  - [Using Wallet Features](#using-wallet-features-in-cli)
  - [Full CLI Example](#full-cli-example)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ (for CLI)
- React 18+ (for website)
- The auth worker deployed at `https://arlinkauth.arlink.workers.dev` (or your own deployment)

---

## Part 1: Website Integration

### Installation

```bash
npm install arlinkauth
# or
bun add arlinkauth
```

### Setup AuthProvider

Wrap your app with `AuthProvider` at the root level:

```tsx
// src/main.tsx or src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from 'arlinkauth/react';
import App from './App';

const API_URL = 'https://arlinkauth.arlink.workers.dev';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider apiUrl={API_URL}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

### Add Login UI

Use the `useAuth` hook to access authentication state and methods:

```tsx
// src/components/LoginButton.tsx
import { useAuth } from 'arlinkauth/react';

export function LoginButton() {
  const { isLoading, isAuthenticated, user, login, loginWithGoogle, logout } = useAuth();

  if (isLoading) {
    return <button disabled>Loading...</button>;
  }

  if (isAuthenticated && user) {
    return (
      <div>
        <span>Welcome, {user.name}</span>
        <button onClick={logout}>Sign Out</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => login()}>Sign in with GitHub</button>
      <button onClick={() => loginWithGoogle()}>Sign in with Google</button>
    </div>
  );
}
```

### Use Wallet Features

Once authenticated, you can sign transactions and upload to Arweave:

```tsx
// src/components/UploadButton.tsx
import { useAuth } from 'arlinkauth/react';
import { useState } from 'react';

export function UploadButton() {
  const { isAuthenticated, user, client } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!isAuthenticated) {
    return <p>Please sign in to upload</p>;
  }

  const handleUpload = async () => {
    setUploading(true);
    try {
      const response = await client.dispatch({
        data: 'Hello from Arlink!',
        tags: [
          { name: 'Content-Type', value: 'text/plain' },
          { name: 'App-Name', value: 'Arlink' },
        ],
      });
      setResult(response.id);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <p>Wallet: {user?.arweave_address}</p>
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload to Arweave'}
      </button>
      {result && (
        <p>
          Success! View at:{' '}
          <a href={`https://arweave.net/${result}`} target="_blank">
            arweave.net/{result}
          </a>
        </p>
      )}
    </div>
  );
}
```

### Full Example

```tsx
// src/App.tsx
import { useAuth } from 'arlinkauth/react';

function App() {
  const { 
    isLoading, 
    isAuthenticated, 
    user, 
    login, 
    loginWithGoogle, 
    logout,
    client 
  } = useAuth();

  // Loading state
  if (isLoading) {
    return (
      <div className="container">
        <p>Loading...</p>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container">
        <h1>Welcome to Arlink</h1>
        <p>Sign in to deploy your apps to Arweave</p>
        <div className="buttons">
          <button onClick={() => login()}>
            Continue with GitHub
          </button>
          <button onClick={() => loginWithGoogle()}>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  // Authenticated
  return (
    <div className="container">
      <header>
        <img src={user.avatar_url} alt={user.name} />
        <span>{user.name}</span>
        <button onClick={logout}>Sign Out</button>
      </header>
      
      <main>
        <h2>Your Arweave Wallet</h2>
        <code>{user.arweave_address}</code>
        
        <h2>Deploy</h2>
        <DeployForm client={client} />
      </main>
    </div>
  );
}

function DeployForm({ client }) {
  const handleDeploy = async (files: FileList) => {
    // Sign and upload each file
    for (const file of files) {
      const data = await file.arrayBuffer();
      const result = await client.dispatch({
        data: new Uint8Array(data),
        tags: [
          { name: 'Content-Type', value: file.type },
          { name: 'App-Name', value: 'Arlink' },
        ],
      });
      console.log('Uploaded:', result.id);
    }
  };

  return (
    <input 
      type="file" 
      multiple 
      onChange={(e) => e.target.files && handleDeploy(e.target.files)} 
    />
  );
}

export default App;
```

---

## Part 2: CLI Integration

### CLI Installation

```bash
npm install arlinkauth
# or
bun add arlinkauth
```

### Basic Authentication

**Option A: Use the built-in CLI**

```bash
# Login (opens browser)
npx arlinkauth login

# Check who you're logged in as
npx arlinkauth whoami

# Logout
npx arlinkauth logout
```

**Option B: Integrate into your own CLI**

```typescript
// src/auth.ts
import { createNodeAuthClient } from 'arlinkauth';

const auth = createNodeAuthClient();

export async function login() {
  console.log('Opening browser for authentication...');
  
  const result = await auth.login();
  
  if (result.success) {
    console.log(`✓ Logged in as ${result.user.name}`);
    console.log(`  Email: ${result.user.email}`);
    console.log(`  Arweave: ${result.user.arweave_address}`);
    return result.user;
  } else {
    console.error('✗ Authentication failed');
    process.exit(1);
  }
}

export async function logout() {
  await auth.logout();
  console.log('✓ Logged out');
}

export async function getUser() {
  const user = await auth.getUser();
  if (!user) {
    console.error('Not logged in. Run: arlink login');
    process.exit(1);
  }
  return user;
}

export { auth };
```

### Using Wallet Features in CLI

```typescript
// src/deploy.ts
import { auth, getUser } from './auth';
import { readFile } from 'fs/promises';

export async function deploy(filePath: string) {
  // Ensure user is authenticated
  const user = await getUser();
  console.log(`Deploying as ${user.name} (${user.arweave_address})`);

  // Read file
  const data = await readFile(filePath);
  const contentType = getContentType(filePath);

  // Upload to Arweave
  console.log(`Uploading ${filePath}...`);
  
  const result = await auth.dispatch({
    data: new Uint8Array(data),
    tags: [
      { name: 'Content-Type', value: contentType },
      { name: 'App-Name', value: 'Arlink-CLI' },
      { name: 'Deployed-By', value: user.arweave_address },
    ],
  });

  console.log(`✓ Deployed!`);
  console.log(`  TX ID: ${result.id}`);
  console.log(`  URL: https://arweave.net/${result.id}`);
  
  return result;
}

function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'svg': 'image/svg+xml',
  };
  return types[ext || ''] || 'application/octet-stream';
}
```

### Full CLI Example

```typescript
#!/usr/bin/env node
// src/cli.ts

import { createNodeAuthClient } from 'arlinkauth';
import { readFile } from 'fs/promises';
import { basename } from 'path';

const auth = createNodeAuthClient();

async function main() {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'login':
      await handleLogin();
      break;
      
    case 'logout':
      await handleLogout();
      break;
      
    case 'whoami':
      await handleWhoami();
      break;
      
    case 'deploy':
      await handleDeploy(args[0]);
      break;
      
    case 'sign':
      await handleSign(args[0]);
      break;
      
    default:
      printHelp();
  }
}

async function handleLogin() {
  const result = await auth.login();
  if (result.success) {
    console.log(`\n✓ Authenticated as ${result.user.name}`);
    console.log(`  Arweave Address: ${result.user.arweave_address}\n`);
  } else {
    console.error('\n✗ Authentication failed or cancelled\n');
    process.exit(1);
  }
}

async function handleLogout() {
  await auth.logout();
  console.log('✓ Logged out successfully');
}

async function handleWhoami() {
  const user = await auth.getUser();
  if (user) {
    console.log(`Logged in as: ${user.name || user.email}`);
    console.log(`  Email: ${user.email || 'N/A'}`);
    console.log(`  Arweave: ${user.arweave_address}`);
    if (user.github_username) {
      console.log(`  GitHub: @${user.github_username}`);
    }
  } else {
    console.log('Not logged in. Run: arlink login');
    process.exit(1);
  }
}

async function handleDeploy(filePath: string) {
  if (!filePath) {
    console.error('Usage: arlink deploy <file>');
    process.exit(1);
  }

  // Check auth
  const isAuth = await auth.isAuthenticated();
  if (!isAuth) {
    console.error('Not authenticated. Run: arlink login');
    process.exit(1);
  }

  // Read and upload file
  console.log(`Deploying ${basename(filePath)}...`);
  
  const data = await readFile(filePath);
  const result = await auth.dispatch({
    data: new Uint8Array(data),
    tags: [
      { name: 'Content-Type', value: 'application/octet-stream' },
      { name: 'App-Name', value: 'Arlink-CLI' },
    ],
  });

  console.log(`\n✓ Deployed successfully!`);
  console.log(`  Transaction: ${result.id}`);
  console.log(`  Gateway: https://arweave.net/${result.id}\n`);
}

async function handleSign(message: string) {
  if (!message) {
    console.error('Usage: arlink sign <message>');
    process.exit(1);
  }

  const isAuth = await auth.isAuthenticated();
  if (!isAuth) {
    console.error('Not authenticated. Run: arlink login');
    process.exit(1);
  }

  const result = await auth.signature({ data: message });
  console.log(`Signature (${result.signature.length} bytes):`);
  console.log(Buffer.from(result.signature).toString('base64'));
}

function printHelp() {
  console.log(`
Arlink CLI

Usage:
  arlink <command> [options]

Commands:
  login           Authenticate via browser
  logout          Clear stored credentials
  whoami          Show current user
  deploy <file>   Upload file to Arweave
  sign <message>  Sign a message

Examples:
  arlink login
  arlink deploy ./dist/index.html
  arlink sign "Hello World"
`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

**package.json for your CLI:**

```json
{
  "name": "arlink-cli",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "arlink": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "arlinkauth": "^0.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## API Reference

### Browser (`useAuth` hook)

```typescript
const {
  // State
  user,              // WauthUser | null
  isLoading,         // boolean
  isAuthenticated,   // boolean
  
  // Auth methods
  login,             // (options?) => Promise<LoginResult>
  loginWithGithub,   // (options?) => Promise<LoginResult>
  loginWithGoogle,   // (options?) => Promise<LoginResult>
  logout,            // () => void
  getToken,          // () => string | null
  
  // Wallet client
  client,            // WauthClient (has sign, dispatch, etc.)
} = useAuth();
```

### Node.js (`createNodeAuthClient`)

```typescript
const auth = createNodeAuthClient({
  apiUrl?: string,      // Default: production URL
  frontendUrl?: string, // Default: production URL  
  tokenPath?: string,   // Default: ~/.arlinkauth/token
  timeout?: number,     // Default: 120000 (2 min)
});

// Auth
await auth.login(provider?);     // 'github' | 'google'
await auth.logout();
await auth.getUser();            // WauthUser | null
await auth.getMe();              // WauthUser (throws if not auth)
await auth.isAuthenticated();    // boolean
await auth.getToken();           // string | null

// Wallet
await auth.sign({ transaction });
await auth.signDataItem({ data, tags?, target?, anchor? });
await auth.signature({ data });
await auth.dispatch({ data, tags?, target?, anchor?, bundler? });
```

### Types

```typescript
interface WauthUser {
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
}

interface DispatchInput {
  data: string | Uint8Array | number[];
  tags?: { name: string; value: string }[];
  target?: string;
  anchor?: string;
  bundler?: 'turbo' | 'irys';  // Default: 'turbo'
}

interface DispatchResult {
  id: string;           // Transaction ID
  bundler: string;      // Which bundler was used
  response: object;     // Raw bundler response
}
```

---

## Troubleshooting

### "Not authenticated" error

The token may have expired or been cleared. Run `login()` again.

### Browser doesn't open (CLI)

The CLI prints a URL if the browser doesn't open automatically. Copy and paste it manually.

### Popup blocked (Website)

Browser popup blockers may prevent the OAuth window. The `login()` call should be triggered by a direct user action (button click).

### Token storage location (CLI)

Tokens are stored in `~/.arlinkauth/token`. You can customize this:

```typescript
const auth = createNodeAuthClient({
  tokenPath: '/custom/path/to/token'
});
```

### Development mode (CLI)

Set `DEV=true` to use localhost:

```bash
DEV=true node your-cli.js login
```

This uses:
- API: `http://localhost:8787`
- Frontend: `http://localhost:3000`

---

## Need Help?

- GitHub Issues: https://github.com/ArkLinkHQ/arlinkauth/issues
- Documentation: https://github.com/ArkLinkHQ/arlinkauth
