/**
 * Node.js/CLI Auth Client
 *
 * This module provides authentication functionality for Node.js/CLI applications.
 * It opens a browser for OAuth login and receives the token via a local HTTP server.
 *
 * Compatible with Node.js 18+ and Bun.
 */
import type { WauthUser, SignTransactionInput, SignTransactionResult, SignDataItemInput, SignDataItemResult, SignatureInput, SignatureResult, DispatchInput, DispatchResult } from "./types.js";
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
    login(provider?: "github" | "google"): Promise<{
        success: boolean;
        user?: WauthUser;
    }>;
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
/**
 * Create a Node.js/CLI auth client.
 * Uses file-based token storage and opens browser for OAuth.
 */
export declare function createNodeAuthClient(options?: NodeAuthOptions): NodeAuthClient;
//# sourceMappingURL=node.d.ts.map