/**
 * Node.js/CLI Auth Client
 *
 * This module provides authentication functionality for Node.js/CLI applications.
 * It opens a browser for OAuth login and receives the token via a local HTTP server.
 * 
 * Compatible with Node.js 18+ and Bun.
 */

import { createServer } from "node:http";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";

import { createCoreClient, type TokenStorage } from "./core.js";
import type {
  WauthUser,
  SignTransactionInput,
  SignTransactionResult,
  SignDataItemInput,
  SignDataItemResult,
  SignatureInput,
  SignatureResult,
  DispatchInput,
  DispatchResult,
} from "./types.js";

// ── Environment Detection ───────────────────────────────

const IS_DEV = process.env.DEV === "true";

const DEFAULT_API_URL = IS_DEV 
  ? "http://localhost:8787" 
  : "https://arlinkauth.contact-arlink.workers.dev";
const DEFAULT_FRONTEND_URL = IS_DEV 
  ? "http://localhost:3000" 
  : "https://auth.arlink.app";
const DEFAULT_TIMEOUT = 120000; // 2 minutes

// ── Types ───────────────────────────────────────────────

export interface NodeAuthOptions {
  /** The API URL for the auth worker */
  apiUrl?: string;
  /** The frontend URL for login */
  frontendUrl?: string;
  /** Path to store the token file (default: ~/.arlinkauth/token) */
  tokenPath?: string;
  /** Timeout in ms to wait for auth (default: 120000 = 2 minutes) */
  timeout?: number;
}

export interface NodeAuthClient {
  /** The API URL */
  readonly apiUrl: string;
  /** Login via browser OAuth flow */
  login(provider?: "github" | "google"): Promise<{ success: boolean; user?: WauthUser }>;
  /** Logout and clear stored token */
  logout(): Promise<void>;
  /** Check if authenticated */
  isAuthenticated(): Promise<boolean>;
  /** Get current user info */
  getUser(): Promise<WauthUser | null>;
  /** Get current user info (from core) */
  getMe(): Promise<WauthUser>;
  /** Get the stored token */
  getToken(): Promise<string | null>;
  /** Set a token directly */
  setToken(token: string): Promise<void>;
  /** Clear the token */
  clearToken(): Promise<void>;
  /** Sign an Arweave transaction */
  sign(input: SignTransactionInput): Promise<SignTransactionResult>;
  /** Sign an ANS-104 data item */
  signDataItem(input: SignDataItemInput): Promise<SignDataItemResult>;
  /** Create a raw signature */
  signature(input: SignatureInput): Promise<SignatureResult>;
  /** Sign and dispatch to Arweave bundler */
  dispatch(input: DispatchInput): Promise<DispatchResult>;
}

// ── Helpers ─────────────────────────────────────────────

function getDefaultTokenPath(): string {
  return join(homedir(), ".arlinkauth", "token");
}

async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
}

/** Open a URL in the default browser (cross-platform) */
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

/** Create file-based token storage for Node/CLI */
function createFileTokenStorage(tokenPath: string): TokenStorage {
  return {
    async getToken(): Promise<string | null> {
      try {
        const token = await readFile(tokenPath, "utf-8");
        return token.trim() || null;
      } catch {
        return null;
      }
    },
    async setToken(token: string): Promise<void> {
      await ensureDir(tokenPath);
      await writeFile(tokenPath, token, { mode: 0o600 });
    },
    async removeToken(): Promise<void> {
      try {
        await unlink(tokenPath);
      } catch {
        // File doesn't exist, that's fine
      }
    },
  };
}

// ── Create Node Auth Client ─────────────────────────────

/**
 * Create a Node.js/CLI auth client.
 * Uses file-based token storage and opens browser for OAuth.
 */
export function createNodeAuthClient(options: NodeAuthOptions = {}): NodeAuthClient {
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL;
  const frontendUrl = options.frontendUrl ?? DEFAULT_FRONTEND_URL;
  const tokenPath = options.tokenPath ?? getDefaultTokenPath();
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  // Create file-based token storage
  const tokenStorage = createFileTokenStorage(tokenPath);

  // Create core client
  const core = createCoreClient({ apiUrl, tokenStorage });

  // ── Login Flow ──────────────────────────────────────

  async function login(provider?: "github" | "google"): Promise<{ success: boolean; user?: WauthUser }> {
    return new Promise((resolve) => {
      let resolved = false;

      const server = createServer(async (req, res) => {
        const url = new URL(req.url || "/", `http://localhost`);

        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }

        // Handle the callback from frontend
        if (url.pathname === "/callback" && req.method === "POST") {
          try {
            // Parse JSON body
            let body = "";
            for await (const chunk of req) {
              body += chunk.toString();
            }
            const data = JSON.parse(body) as { token?: string };
            
            if (data.token) {
              await core.setToken(data.token);

              // Verify the token by fetching user info
              try {
                const user = await core.getMe();
                
                res.writeHead(200, {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                });
                res.end(JSON.stringify({ success: true }));
                
                if (!resolved) {
                  resolved = true;
                  server.close();
                  server.closeAllConnections();
                  resolve({ success: true, user });
                }
                return;
              } catch {
                await core.clearToken();
                
                res.writeHead(200, {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                });
                res.end(JSON.stringify({ success: true }));
                
                if (!resolved) {
                  resolved = true;
                  server.close();
                  server.closeAllConnections();
                  resolve({ success: false });
                }
                return;
              }
            }
          } catch (e) {
            console.error("Error processing callback:", e);
          }

          res.writeHead(400, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ success: false }));
          return;
        }

        // Not found
        res.writeHead(404);
        res.end("Not found");
      });

      // Listen on random available port
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;

        // Encode parameters to obscure them
        const params = { p: port, v: provider || "" };
        const encoded = Buffer.from(JSON.stringify(params)).toString("base64url");
        const loginUrl = `${frontendUrl}/cli-login?s=${encoded}`;

        console.log(`\nOpening browser for authentication...`);
        console.log(`If browser doesn't open, visit: ${loginUrl}\n`);

        openBrowser(loginUrl);

        // Set timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            server.close();
            server.closeAllConnections();
            resolve({ success: false });
          }
        }, timeout);
      });

      server.on("error", (err) => {
        console.error("Server error:", err);
        if (!resolved) {
          resolved = true;
          server.close();
          server.closeAllConnections();
          resolve({ success: false });
        }
      });
    });
  }

  async function logout(): Promise<void> {
    await core.clearToken();
  }

  async function getUser(): Promise<WauthUser | null> {
    try {
      return await core.getMe();
    } catch {
      return null;
    }
  }

  // Return combined interface
  return {
    apiUrl: core.apiUrl,
    getMe: core.getMe,
    sign: core.sign,
    signDataItem: core.signDataItem,
    signature: core.signature,
    dispatch: core.dispatch,
    isAuthenticated: core.isAuthenticated,
    setToken: core.setToken,
    clearToken: core.clearToken,
    getToken: core.getToken,
    login,
    logout,
    getUser,
  };
}
