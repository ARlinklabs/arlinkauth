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
  - [Wallet Features](#wallet-features-web)
- [Part 2: CLI Integration](#part-2-cli-integration)
  - [Installation](#cli-installation)
  - [Basic Authentication](#basic-authentication)
  - [Wallet Features](#wallet-features-cli)
- [Part 3: SDK Features Reference](#part-3-sdk-features-reference)
  - [Authentication](#authentication)
  - [User Information](#user-information)
  - [Signing Transactions](#signing-transactions)
  - [Signing Data Items](#signing-data-items)
  - [Raw Signatures](#raw-signatures)
  - [Dispatch to Arweave](#dispatch-to-arweave)
- [Full Examples](#full-examples)
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

### Wallet Features (Web)

See [Part 3: SDK Features Reference](#part-3-sdk-features-reference) for detailed examples of all wallet features.

Quick example:

```tsx
import { useAuth } from 'arlinkauth/react';

function MyComponent() {
  const { client, isAuthenticated } = useAuth();

  const handleUpload = async () => {
    const result = await client.dispatch({
      data: 'Hello Arweave!',
      tags: [{ name: 'Content-Type', value: 'text/plain' }],
    });
    console.log('Uploaded:', result.id);
  };

  return <button onClick={handleUpload}>Upload</button>;
}
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

# Login with specific provider
npx arlinkauth login --provider github
npx arlinkauth login --provider google

# Check who you're logged in as
npx arlinkauth whoami

# Check authentication status
npx arlinkauth status

# Logout
npx arlinkauth logout
```

**Option B: Integrate into your own CLI**

```typescript
import { createNodeAuthClient } from 'arlinkauth';

const auth = createNodeAuthClient();

// Login
const result = await auth.login(); // or auth.login('github') / auth.login('google')
if (result.success) {
  console.log('Logged in as:', result.user.name);
}

// Check auth status
const isLoggedIn = await auth.isAuthenticated();

// Get user info
const user = await auth.getUser(); // Returns null if not logged in

// Logout
await auth.logout();
```

### Wallet Features (CLI)

See [Part 3: SDK Features Reference](#part-3-sdk-features-reference) for detailed examples of all wallet features.

Quick example:

```typescript
import { createNodeAuthClient } from 'arlinkauth';

const auth = createNodeAuthClient();

// Ensure logged in
if (!await auth.isAuthenticated()) {
  await auth.login();
}

// Upload to Arweave
const result = await auth.dispatch({
  data: 'Hello from CLI!',
  tags: [{ name: 'Content-Type', value: 'text/plain' }],
});
console.log('Uploaded:', result.id);
```

---

## Part 3: SDK Features Reference

This section documents all SDK features with examples for both **Web** and **CLI** environments.

### Authentication

#### Web (React)

```tsx
import { useAuth } from 'arlinkauth/react';

function AuthExample() {
  const { 
    isLoading,        // true while checking existing session
    isAuthenticated,  // true if user is logged in
    user,             // user object or null
    login,            // login with GitHub
    loginWithGithub,  // login with GitHub (explicit)
    loginWithGoogle,  // login with Google
    logout,           // clear session
    getToken,         // get JWT token
  } = useAuth();

  // Login with GitHub
  const handleGithubLogin = async () => {
    const result = await login(); // or loginWithGithub()
    if (result.success) {
      console.log('Logged in:', result.user);
    }
  };

  // Login with Google
  const handleGoogleLogin = async () => {
    const result = await loginWithGoogle();
    if (result.success) {
      console.log('Logged in:', result.user);
    }
  };

  // Login with custom GitHub scopes
  const handleGithubWithScopes = async () => {
    const result = await login({ scopes: ['repo', 'read:org'] });
    // User's github_access_token will have these scopes
  };

  // Logout
  const handleLogout = () => {
    logout();
  };

  // Get token for custom API calls
  const token = getToken();
}
```

#### CLI (Node.js)

```typescript
import { createNodeAuthClient } from 'arlinkauth';

const auth = createNodeAuthClient();

// Login (opens browser, waits for callback)
const result = await auth.login(); // defaults to GitHub
// or
const result = await auth.login('github');
const result = await auth.login('google');

if (result.success) {
  console.log('User:', result.user.name);
  console.log('Email:', result.user.email);
  console.log('Arweave Address:', result.user.arweave_address);
}

// Check if authenticated
const isLoggedIn = await auth.isAuthenticated();

// Logout
await auth.logout();

// Get token
const token = await auth.getToken();
```

---

### User Information

#### Web (React)

```tsx
import { useAuth } from 'arlinkauth/react';

function UserInfo() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <p>Not logged in</p>;
  }

  return (
    <div>
      <img src={user.avatar_url} alt={user.name} />
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
      <p>Arweave Address: {user.arweave_address}</p>
      
      {/* GitHub info (if logged in with GitHub) */}
      {user.github_username && (
        <p>GitHub: @{user.github_username}</p>
      )}
      
      {/* Access tokens for API calls */}
      {user.github_access_token && (
        <p>Has GitHub token for API access</p>
      )}
      {user.google_access_token && (
        <p>Has Google token for API access</p>
      )}
    </div>
  );
}
```

#### CLI (Node.js)

```typescript
import { createNodeAuthClient } from 'arlinkauth';

const auth = createNodeAuthClient();

// Get user (returns null if not authenticated)
const user = await auth.getUser();

if (user) {
  console.log('ID:', user.id);
  console.log('Name:', user.name);
  console.log('Email:', user.email);
  console.log('Avatar:', user.avatar_url);
  console.log('Arweave Address:', user.arweave_address);
  
  // OAuth provider info
  if (user.github_id) {
    console.log('GitHub Username:', user.github_username);
    console.log('GitHub Token:', user.github_access_token);
  }
  if (user.google_id) {
    console.log('Google ID:', user.google_id);
    console.log('Google Token:', user.google_access_token);
  }
  
  console.log('Created:', user.created_at);
  console.log('Updated:', user.updated_at);
}

// Or use getMe() which throws if not authenticated
try {
  const user = await auth.getMe();
  console.log('User:', user.name);
} catch (error) {
  console.log('Not authenticated');
}
```

---

### Signing Transactions

Sign Arweave L1 transactions (created with arweave-js).

#### Web (React)

```tsx
import { useAuth } from 'arlinkauth/react';
import Arweave from 'arweave';

const arweave = Arweave.init({ host: 'arweave.net', protocol: 'https' });

function SignTransaction() {
  const { client, isAuthenticated, user } = useAuth();

  const handleSign = async () => {
    // Create a transaction
    const tx = await arweave.createTransaction({
      data: 'Hello Arweave!',
    });
    tx.addTag('Content-Type', 'text/plain');
    tx.addTag('App-Name', 'MyApp');

    // Sign it with the user's wallet
    const signedTx = await client.sign({ transaction: tx.toJSON() });
    
    console.log('Signed TX:', signedTx);
    
    // Submit to network
    const response = await arweave.transactions.post(signedTx);
    console.log('Submitted:', response.status);
  };

  if (!isAuthenticated) return <p>Please log in</p>;

  return <button onClick={handleSign}>Sign Transaction</button>;
}
```

#### CLI (Node.js)

```typescript
import { createNodeAuthClient } from 'arlinkauth';
import Arweave from 'arweave';

const auth = createNodeAuthClient();
const arweave = Arweave.init({ host: 'arweave.net', protocol: 'https' });

async function signTransaction() {
  // Create transaction
  const tx = await arweave.createTransaction({
    data: 'Hello from CLI!',
  });
  tx.addTag('Content-Type', 'text/plain');

  // Sign with user's wallet
  const signedTx = await auth.sign({ transaction: tx.toJSON() });
  
  // Submit to network
  const response = await arweave.transactions.post(signedTx);
  console.log('Transaction submitted:', response.status);
}
```

---

### Signing Data Items

Sign ANS-104 data items (for bundled transactions, AO messages, etc.).

#### Web (React)

```tsx
import { useAuth } from 'arlinkauth/react';

function SignDataItem() {
  const { client, isAuthenticated } = useAuth();

  const handleSignDataItem = async () => {
    const result = await client.signDataItem({
      data: 'Hello ANS-104!',
      tags: [
        { name: 'Content-Type', value: 'text/plain' },
        { name: 'App-Name', value: 'MyApp' },
      ],
      // Optional:
      // target: 'recipient-address',
      // anchor: 'anchor-id',
    });

    console.log('Data Item ID:', result.id);
    console.log('Raw bytes:', result.raw); // Uint8Array
    
    // You can now submit result.raw to a bundler
  };

  const handleSignBinaryData = async () => {
    // Sign binary data (e.g., an image)
    const response = await fetch('/image.png');
    const buffer = await response.arrayBuffer();
    
    const result = await client.signDataItem({
      data: new Uint8Array(buffer),
      tags: [
        { name: 'Content-Type', value: 'image/png' },
      ],
    });

    console.log('Signed image, ID:', result.id);
  };

  if (!isAuthenticated) return <p>Please log in</p>;

  return (
    <div>
      <button onClick={handleSignDataItem}>Sign Text Data Item</button>
      <button onClick={handleSignBinaryData}>Sign Image Data Item</button>
    </div>
  );
}
```

#### CLI (Node.js)

```typescript
import { createNodeAuthClient } from 'arlinkauth';
import { readFile } from 'fs/promises';

const auth = createNodeAuthClient();

async function signDataItem() {
  // Sign text data
  const result = await auth.signDataItem({
    data: 'Hello from CLI!',
    tags: [
      { name: 'Content-Type', value: 'text/plain' },
      { name: 'App-Name', value: 'Arlink-CLI' },
    ],
  });

  console.log('Data Item ID:', result.id);
  console.log('Raw bytes length:', result.raw.length);
}

async function signFileAsDataItem(filePath: string) {
  const fileData = await readFile(filePath);
  
  const result = await auth.signDataItem({
    data: new Uint8Array(fileData),
    tags: [
      { name: 'Content-Type', value: 'application/octet-stream' },
    ],
  });

  console.log('Signed file as data item:', result.id);
  return result;
}
```

---

### Raw Signatures

Create raw cryptographic signatures of arbitrary data.

#### Web (React)

```tsx
import { useAuth } from 'arlinkauth/react';

function RawSignature() {
  const { client, isAuthenticated } = useAuth();

  const handleSign = async () => {
    // Sign a string message
    const result = await client.signature({
      data: 'Message to sign',
    });

    console.log('Signature length:', result.signature.length);
    console.log('Signature (base64):', btoa(String.fromCharCode(...result.signature)));
  };

  const handleSignBinary = async () => {
    // Sign binary data
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    
    const result = await client.signature({ data });
    
    console.log('Signature:', result.signature);
  };

  const handleVerifiableMessage = async () => {
    // Create a verifiable message (e.g., for authentication)
    const message = JSON.stringify({
      action: 'login',
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    });

    const result = await client.signature({ data: message });

    // Send message + signature to your server for verification
    console.log('Message:', message);
    console.log('Signature:', result.signature);
  };

  if (!isAuthenticated) return <p>Please log in</p>;

  return (
    <div>
      <button onClick={handleSign}>Sign Message</button>
      <button onClick={handleSignBinary}>Sign Binary</button>
      <button onClick={handleVerifiableMessage}>Create Verifiable Message</button>
    </div>
  );
}
```

#### CLI (Node.js)

```typescript
import { createNodeAuthClient } from 'arlinkauth';

const auth = createNodeAuthClient();

async function signMessage(message: string) {
  const result = await auth.signature({ data: message });
  
  console.log('Signature bytes:', result.signature.length);
  
  // Convert to base64 for display/transmission
  const base64Sig = Buffer.from(result.signature).toString('base64');
  console.log('Signature (base64):', base64Sig);
  
  return result.signature;
}

async function signBinaryData(data: Uint8Array) {
  const result = await auth.signature({ data });
  return result.signature;
}

// Example: Create a signed authentication token
async function createAuthToken() {
  const payload = {
    action: 'authenticate',
    timestamp: Date.now(),
    nonce: Math.random().toString(36),
  };
  
  const message = JSON.stringify(payload);
  const result = await auth.signature({ data: message });
  
  return {
    payload,
    signature: Buffer.from(result.signature).toString('base64'),
  };
}
```

---

### Dispatch to Arweave

Sign and upload data directly to Arweave via bundlers (Turbo or Irys). This is the easiest way to upload data.

#### Web (React)

```tsx
import { useAuth } from 'arlinkauth/react';
import { useState } from 'react';

function DispatchExample() {
  const { client, isAuthenticated, user } = useAuth();
  const [result, setResult] = useState<string | null>(null);

  // Upload text
  const handleUploadText = async () => {
    const result = await client.dispatch({
      data: 'Hello Arweave!',
      tags: [
        { name: 'Content-Type', value: 'text/plain' },
        { name: 'App-Name', value: 'MyApp' },
      ],
    });

    console.log('Transaction ID:', result.id);
    console.log('Bundler used:', result.bundler);
    console.log('View at:', `https://arweave.net/${result.id}`);
    
    setResult(result.id);
  };

  // Upload JSON
  const handleUploadJSON = async () => {
    const data = JSON.stringify({
      name: 'My Document',
      created: new Date().toISOString(),
      author: user?.arweave_address,
    });

    const result = await client.dispatch({
      data,
      tags: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'App-Name', value: 'MyApp' },
        { name: 'Type', value: 'document' },
      ],
    });

    setResult(result.id);
  };

  // Upload file
  const handleUploadFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    
    const result = await client.dispatch({
      data: new Uint8Array(buffer),
      tags: [
        { name: 'Content-Type', value: file.type },
        { name: 'File-Name', value: file.name },
      ],
    });

    setResult(result.id);
  };

  // Upload with specific bundler
  const handleUploadWithIrys = async () => {
    const result = await client.dispatch({
      data: 'Using Irys bundler',
      tags: [{ name: 'Content-Type', value: 'text/plain' }],
      bundler: 'irys', // 'turbo' (default) or 'irys'
    });

    console.log('Uploaded via:', result.bundler);
    setResult(result.id);
  };

  // Upload to specific target (for AO messages)
  const handleSendAOMessage = async () => {
    const result = await client.dispatch({
      data: JSON.stringify({ action: 'transfer', amount: 100 }),
      tags: [
        { name: 'Data-Protocol', value: 'ao' },
        { name: 'Action', value: 'Transfer' },
      ],
      target: 'ao-process-id-here', // AO process ID
    });

    setResult(result.id);
  };

  if (!isAuthenticated) return <p>Please log in</p>;

  return (
    <div>
      <button onClick={handleUploadText}>Upload Text</button>
      <button onClick={handleUploadJSON}>Upload JSON</button>
      <button onClick={handleUploadWithIrys}>Upload via Irys</button>
      <button onClick={handleSendAOMessage}>Send AO Message</button>
      
      <input 
        type="file" 
        onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])} 
      />

      {result && (
        <p>
          Success! <a href={`https://arweave.net/${result}`} target="_blank">
            View on Arweave
          </a>
        </p>
      )}
    </div>
  );
}
```

#### CLI (Node.js)

```typescript
import { createNodeAuthClient } from 'arlinkauth';
import { readFile } from 'fs/promises';
import { basename, extname } from 'path';

const auth = createNodeAuthClient();

// Upload text
async function uploadText(text: string) {
  const result = await auth.dispatch({
    data: text,
    tags: [
      { name: 'Content-Type', value: 'text/plain' },
      { name: 'App-Name', value: 'Arlink-CLI' },
    ],
  });

  console.log('Uploaded!');
  console.log('  TX ID:', result.id);
  console.log('  Bundler:', result.bundler);
  console.log('  URL:', `https://arweave.net/${result.id}`);
  
  return result;
}

// Upload JSON data
async function uploadJSON(data: object) {
  const result = await auth.dispatch({
    data: JSON.stringify(data, null, 2),
    tags: [
      { name: 'Content-Type', value: 'application/json' },
    ],
  });

  return result;
}

// Upload a file
async function uploadFile(filePath: string) {
  const fileData = await readFile(filePath);
  const fileName = basename(filePath);
  const contentType = getContentType(filePath);

  console.log(`Uploading ${fileName}...`);

  const result = await auth.dispatch({
    data: new Uint8Array(fileData),
    tags: [
      { name: 'Content-Type', value: contentType },
      { name: 'File-Name', value: fileName },
      { name: 'App-Name', value: 'Arlink-CLI' },
    ],
  });

  console.log(`Uploaded: https://arweave.net/${result.id}`);
  return result;
}

// Upload multiple files
async function uploadDirectory(files: string[]) {
  const results = [];
  
  for (const file of files) {
    const result = await uploadFile(file);
    results.push({ file, id: result.id });
  }

  return results;
}

// Upload with specific bundler
async function uploadWithBundler(data: string, bundler: 'turbo' | 'irys') {
  const result = await auth.dispatch({
    data,
    tags: [{ name: 'Content-Type', value: 'text/plain' }],
    bundler,
  });

  console.log(`Uploaded via ${result.bundler}: ${result.id}`);
  return result;
}

// Helper: Get content type from file extension
function getContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase().slice(1);
  const types: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'mjs': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
  };
  return types[ext] || 'application/octet-stream';
}

// Example usage
async function main() {
  // Check authentication
  if (!await auth.isAuthenticated()) {
    console.log('Please login first: npx arlinkauth login');
    process.exit(1);
  }

  // Upload a text file
  await uploadText('Hello from Arlink CLI!');

  // Upload JSON
  await uploadJSON({ message: 'Hello', timestamp: Date.now() });

  // Upload a file
  await uploadFile('./dist/index.html');
}
```

---

## Full Examples

### Complete Web App

```tsx
// src/App.tsx
import { AuthProvider, useAuth } from 'arlinkauth/react';
import { useState } from 'react';

const API_URL = 'https://arlinkauth.arlink.workers.dev';

function App() {
  return (
    <AuthProvider apiUrl={API_URL}>
      <Main />
    </AuthProvider>
  );
}

function Main() {
  const { isLoading, isAuthenticated, user, login, loginWithGoogle, logout, client } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState<string | null>(null);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="login-page">
        <h1>Welcome to Arlink</h1>
        <p>Deploy your apps to Arweave</p>
        <button onClick={() => login()}>Sign in with GitHub</button>
        <button onClick={() => loginWithGoogle()}>Sign in with Google</button>
      </div>
    );
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await client.dispatch({
        data: new Uint8Array(buffer),
        tags: [
          { name: 'Content-Type', value: file.type },
          { name: 'File-Name', value: file.name },
        ],
      });
      setLastUpload(result.id);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="dashboard">
      <header>
        <img src={user!.avatar_url!} alt="" />
        <span>{user!.name}</span>
        <button onClick={logout}>Sign Out</button>
      </header>

      <main>
        <section>
          <h2>Your Wallet</h2>
          <code>{user!.arweave_address}</code>
        </section>

        <section>
          <h2>Upload to Arweave</h2>
          <input type="file" onChange={handleUpload} disabled={uploading} />
          {uploading && <p>Uploading...</p>}
          {lastUpload && (
            <p>
              Uploaded: <a href={`https://arweave.net/${lastUpload}`}>{lastUpload}</a>
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
```

### Complete CLI Tool

```typescript
#!/usr/bin/env node
// src/cli.ts

import { createNodeAuthClient } from 'arlinkauth';
import { readFile, readdir, stat } from 'fs/promises';
import { join, basename, extname } from 'path';

const auth = createNodeAuthClient();

async function main() {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'login':
      await cmdLogin(args[0] as 'github' | 'google' | undefined);
      break;
    case 'logout':
      await cmdLogout();
      break;
    case 'whoami':
      await cmdWhoami();
      break;
    case 'upload':
      await cmdUpload(args[0]);
      break;
    case 'sign':
      await cmdSign(args.join(' '));
      break;
    case 'deploy':
      await cmdDeploy(args[0]);
      break;
    default:
      printHelp();
  }
}

async function cmdLogin(provider?: 'github' | 'google') {
  console.log('Opening browser for authentication...\n');
  const result = await auth.login(provider);
  
  if (result.success) {
    console.log('✓ Logged in successfully!\n');
    console.log(`  Name: ${result.user!.name}`);
    console.log(`  Email: ${result.user!.email}`);
    console.log(`  Wallet: ${result.user!.arweave_address}\n`);
  } else {
    console.error('✗ Login failed or was cancelled\n');
    process.exit(1);
  }
}

async function cmdLogout() {
  await auth.logout();
  console.log('✓ Logged out successfully\n');
}

async function cmdWhoami() {
  const user = await auth.getUser();
  if (!user) {
    console.log('Not logged in. Run: arlink login\n');
    process.exit(1);
  }

  console.log(`Logged in as: ${user.name || user.email}\n`);
  console.log(`  ID: ${user.id}`);
  console.log(`  Email: ${user.email || 'N/A'}`);
  console.log(`  Wallet: ${user.arweave_address}`);
  if (user.github_username) {
    console.log(`  GitHub: @${user.github_username}`);
  }
  console.log();
}

async function cmdUpload(filePath: string) {
  if (!filePath) {
    console.error('Usage: arlink upload <file>\n');
    process.exit(1);
  }

  await requireAuth();

  console.log(`Uploading ${basename(filePath)}...\n`);
  
  const data = await readFile(filePath);
  const contentType = getContentType(filePath);

  const result = await auth.dispatch({
    data: new Uint8Array(data),
    tags: [
      { name: 'Content-Type', value: contentType },
      { name: 'File-Name', value: basename(filePath) },
    ],
  });

  console.log('✓ Uploaded successfully!\n');
  console.log(`  TX: ${result.id}`);
  console.log(`  URL: https://arweave.net/${result.id}\n`);
}

async function cmdSign(message: string) {
  if (!message) {
    console.error('Usage: arlink sign <message>\n');
    process.exit(1);
  }

  await requireAuth();

  const result = await auth.signature({ data: message });
  
  console.log('Signature:\n');
  console.log(Buffer.from(result.signature).toString('base64'));
  console.log();
}

async function cmdDeploy(directory: string) {
  if (!directory) {
    console.error('Usage: arlink deploy <directory>\n');
    process.exit(1);
  }

  await requireAuth();

  const files = await getAllFiles(directory);
  console.log(`Deploying ${files.length} files...\n`);

  const manifest: Record<string, { id: string }> = {};

  for (const file of files) {
    const relativePath = file.replace(directory, '').replace(/^\//, '');
    const data = await readFile(file);
    const contentType = getContentType(file);

    process.stdout.write(`  ${relativePath}... `);

    const result = await auth.dispatch({
      data: new Uint8Array(data),
      tags: [
        { name: 'Content-Type', value: contentType },
      ],
    });

    manifest[relativePath] = { id: result.id };
    console.log(result.id);
  }

  // Create and upload manifest
  const manifestData = {
    manifest: 'arweave/paths',
    version: '0.2.0',
    index: { path: 'index.html' },
    paths: manifest,
  };

  const manifestResult = await auth.dispatch({
    data: JSON.stringify(manifestData),
    tags: [
      { name: 'Content-Type', value: 'application/x.arweave-manifest+json' },
    ],
  });

  console.log('\n✓ Deployed successfully!\n');
  console.log(`  Manifest: ${manifestResult.id}`);
  console.log(`  URL: https://arweave.net/${manifestResult.id}\n`);
}

async function requireAuth() {
  if (!await auth.isAuthenticated()) {
    console.error('Not authenticated. Run: arlink login\n');
    process.exit(1);
  }
}

async function getAllFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function getContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase().slice(1);
  const types: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff2': 'font/woff2',
  };
  return types[ext] || 'application/octet-stream';
}

function printHelp() {
  console.log(`
Arlink CLI - Deploy to Arweave

Usage:
  arlink <command> [arguments]

Commands:
  login [provider]     Login via browser (github or google)
  logout               Clear credentials
  whoami               Show current user
  upload <file>        Upload a single file
  sign <message>       Sign a message
  deploy <directory>   Deploy a directory with manifest

Examples:
  arlink login
  arlink login google
  arlink upload ./image.png
  arlink deploy ./dist
  arlink sign "Hello World"
`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
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
  client,            // WauthClient
} = useAuth();

// Client methods
client.sign({ transaction })           // Sign L1 transaction
client.signDataItem({ data, tags })    // Sign ANS-104 data item
client.signature({ data })             // Create raw signature
client.dispatch({ data, tags })        // Upload to Arweave
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

interface SignTransactionInput {
  transaction: unknown;  // arweave-js transaction.toJSON()
}

interface SignDataItemInput {
  data: string | Uint8Array | number[];
  tags?: { name: string; value: string }[];
  target?: string;
  anchor?: string;
}

interface SignDataItemResult {
  id: string;
  raw: number[];  // Signed data item bytes
}

interface SignatureInput {
  data: string | Uint8Array | number[];
}

interface SignatureResult {
  signature: number[];  // Raw signature bytes
}

interface DispatchInput {
  data: string | Uint8Array | number[];
  tags?: { name: string; value: string }[];
  target?: string;
  anchor?: string;
  bundler?: 'turbo' | 'irys';  // Default: 'turbo'
}

interface DispatchResult {
  id: string;
  bundler: 'turbo' | 'irys';
  response: Record<string, unknown>;
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

### Large file uploads

The dispatch endpoint has a 100KB limit. For larger files, use `signDataItem()` and submit directly to a bundler.

### Rate limiting

The API has rate limits:
- 60 requests/minute for API calls
- 10 requests/minute for auth endpoints

---

## Need Help?

- GitHub Issues: https://github.com/ArkLinkHQ/arlinkauth/issues
- Documentation: https://github.com/ArkLinkHQ/arlinkauth
