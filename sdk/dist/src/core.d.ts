/**
 * Core API client - Universal (Node.js + Browser compatible)
 *
 * This module provides the wallet API methods without any browser-specific
 * authentication. It requires a token to be provided via TokenStorage adapter.
 */
import { type WauthUser, type SignTransactionInput, type SignTransactionResult, type SignDataItemInput, type SignDataItemResult, type SignatureInput, type SignatureResult, type DispatchInput, type DispatchResult } from "./types.js";
/** Interface for token storage - implement this for different environments */
export interface TokenStorage {
    getToken(): string | null | Promise<string | null>;
    setToken(token: string): void | Promise<void>;
    removeToken(): void | Promise<void>;
}
export interface CoreClientOptions {
    /** Base URL of the auth worker API */
    apiUrl: string;
    /** Token storage adapter */
    tokenStorage: TokenStorage;
}
export interface CoreClient {
    /** Get the API URL */
    readonly apiUrl: string;
    /** Get current user info */
    getMe(): Promise<WauthUser>;
    /** Sign an Arweave transaction */
    sign(input: SignTransactionInput): Promise<SignTransactionResult>;
    /** Sign an ANS-104 data item */
    signDataItem(input: SignDataItemInput): Promise<SignDataItemResult>;
    /** Create a raw signature */
    signature(input: SignatureInput): Promise<SignatureResult>;
    /** Sign and dispatch to Arweave bundler */
    dispatch(input: DispatchInput): Promise<DispatchResult>;
    /** Check if authenticated (has valid token) */
    isAuthenticated(): Promise<boolean>;
    /** Set a new token */
    setToken(token: string): Promise<void>;
    /** Clear the token */
    clearToken(): Promise<void>;
    /** Get the current token */
    getToken(): Promise<string | null>;
}
/**
 * Create a universal core client that works in any JavaScript environment.
 * Requires a token storage adapter to be provided.
 */
export declare function createCoreClient(options: CoreClientOptions): CoreClient;
//# sourceMappingURL=core.d.ts.map