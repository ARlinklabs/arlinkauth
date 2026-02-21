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
export type AuthClientOptions = Partial<WauthClientOptions> & Partial<NodeAuthOptions>;
export type AuthClient = WauthClient | NodeAuthClient;
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
export declare function createAuthClient(options?: AuthClientOptions): Promise<AuthClient>;
//# sourceMappingURL=auto.d.ts.map