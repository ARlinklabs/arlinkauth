/**
 * Auto-detecting Auth Client
 * 
 * Automatically creates the appropriate client based on the environment:
 * - Browser: Uses localStorage + popup OAuth
 * - Node.js/CLI: Uses file storage + browser OAuth with local server
 */

import type { WauthClient } from "./client.js";
import type { NodeAuthClient, NodeAuthOptions } from "./node.js";
import type { WauthClientOptions } from "./types.js";

// ── Environment Detection ───────────────────────────────

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

// ── Types ───────────────────────────────────────────────

export type AuthClientOptions = Partial<WauthClientOptions> & Partial<NodeAuthOptions>;

export type AuthClient = WauthClient | NodeAuthClient;

// ── Auto-detecting Factory ──────────────────────────────

// Default API URL
const DEFAULT_API_URL = "https://arlinkauth.contact-arlink.workers.dev";

/**
 * Create an auth client that automatically detects the environment.
 * 
 * - In browser: Returns a WauthClient with localStorage + popup OAuth
 * - In Node.js: Returns a NodeAuthClient with file storage + browser OAuth
 * 
 * @example
 * ```typescript
 * import { createAuthClient } from "arlinkauth";
 * 
 * const client = await createAuthClient();
 * await client.login();
 * ```
 */
export async function createAuthClient(options: AuthClientOptions = {}): Promise<AuthClient> {
  if (isBrowser()) {
    // Dynamic import to avoid bundling Node.js code in browser
    const { createWauthClient } = await import("./client.js");
    return createWauthClient({
      apiUrl: options.apiUrl ?? DEFAULT_API_URL,
      tokenKey: options.tokenKey,
    });
  } else {
    // Dynamic import to avoid bundling browser code in Node
    const { createNodeAuthClient } = await import("./node.js");
    return createNodeAuthClient(options);
  }
}
