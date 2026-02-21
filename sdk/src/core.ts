/**
 * Core API client - Universal (Node.js + Browser compatible)
 * 
 * This module provides the wallet API methods without any browser-specific
 * authentication. It requires a token to be provided via TokenStorage adapter.
 */

import {
  WalletAction,
  type WauthUser,
  type SignTransactionInput,
  type SignTransactionResult,
  type SignDataItemInput,
  type SignDataItemResult,
  type SignatureInput,
  type SignatureResult,
  type DispatchInput,
  type DispatchResult,
} from "./types.js";

// ── Token Storage Interface ─────────────────────────────

/** Interface for token storage - implement this for different environments */
export interface TokenStorage {
  getToken(): string | null | Promise<string | null>;
  setToken(token: string): void | Promise<void>;
  removeToken(): void | Promise<void>;
}

// ── Core Client Options ─────────────────────────────────

export interface CoreClientOptions {
  /** Base URL of the auth worker API */
  apiUrl: string;
  /** Token storage adapter */
  tokenStorage: TokenStorage;
}

// ── Core Client Type ────────────────────────────────────

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

// ── Create Core Client ──────────────────────────────────

/**
 * Create a universal core client that works in any JavaScript environment.
 * Requires a token storage adapter to be provided.
 */
export function createCoreClient(options: CoreClientOptions): CoreClient {
  const { apiUrl, tokenStorage } = options;

  // Helper to get token (handles both sync and async storage)
  async function loadToken(): Promise<string | null> {
    const token = tokenStorage.getToken();
    return token instanceof Promise ? await token : token;
  }

  // Authenticated fetch helper
  async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await loadToken();
    if (!token) {
      throw new Error("Not authenticated. No token available.");
    }

    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      await tokenStorage.removeToken();
      throw new Error("Session expired. Please login again.");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  // ── API Methods ─────────────────────────────────────

  async function getMe(): Promise<WauthUser> {
    return fetchApi<WauthUser>("/api/me");
  }

  async function sign(input: SignTransactionInput): Promise<SignTransactionResult> {
    return fetchApi<SignTransactionResult>("/api/wallet/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: WalletAction.SIGN,
        payload: { transaction: input.transaction },
      }),
    });
  }

  async function signDataItem(input: SignDataItemInput): Promise<SignDataItemResult> {
    const data = input.data instanceof Uint8Array
      ? Array.from(input.data)
      : input.data;

    return fetchApi<SignDataItemResult>("/api/wallet/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: WalletAction.SIGN_DATA_ITEM,
        payload: {
          dataItem: {
            data,
            tags: input.tags,
            target: input.target,
            anchor: input.anchor,
          },
        },
      }),
    });
  }

  async function signature(input: SignatureInput): Promise<SignatureResult> {
    const data = input.data instanceof Uint8Array
      ? Array.from(input.data)
      : input.data;

    return fetchApi<SignatureResult>("/api/wallet/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: WalletAction.SIGNATURE,
        payload: { data },
      }),
    });
  }

  async function dispatch(input: DispatchInput): Promise<DispatchResult> {
    const data = input.data instanceof Uint8Array
      ? Array.from(input.data)
      : input.data;

    return fetchApi<DispatchResult>("/api/wallet/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: WalletAction.DISPATCH,
        payload: {
          data,
          tags: input.tags,
          target: input.target,
          anchor: input.anchor,
          bundler: input.bundler,
        },
      }),
    });
  }

  async function isAuthenticated(): Promise<boolean> {
    const token = await loadToken();
    if (!token) return false;

    try {
      await getMe();
      return true;
    } catch {
      return false;
    }
  }

  async function setToken(token: string): Promise<void> {
    const result = tokenStorage.setToken(token);
    if (result instanceof Promise) await result;
  }

  async function clearToken(): Promise<void> {
    const result = tokenStorage.removeToken();
    if (result instanceof Promise) await result;
  }

  async function getToken(): Promise<string | null> {
    return loadToken();
  }

  return {
    apiUrl,
    getMe,
    sign,
    signDataItem,
    signature,
    dispatch,
    isAuthenticated,
    setToken,
    clearToken,
    getToken,
  };
}
