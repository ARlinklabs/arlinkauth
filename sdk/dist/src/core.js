/**
 * Core API client - Universal (Node.js + Browser compatible)
 *
 * This module provides the wallet API methods without any browser-specific
 * authentication. It requires a token to be provided via TokenStorage adapter.
 */
import { WalletAction, } from "./types.js";
// ── Create Core Client ──────────────────────────────────
/**
 * Create a universal core client that works in any JavaScript environment.
 * Requires a token storage adapter to be provided.
 */
export function createCoreClient(options) {
    const { apiUrl, tokenStorage } = options;
    // Helper to get token (handles both sync and async storage)
    async function loadToken() {
        const token = tokenStorage.getToken();
        return token instanceof Promise ? await token : token;
    }
    // Authenticated fetch helper
    async function fetchApi(path, init) {
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
            throw new Error(body.error ?? `API error: ${res.status}`);
        }
        return res.json();
    }
    // ── API Methods ─────────────────────────────────────
    async function getMe() {
        return fetchApi("/api/me");
    }
    async function sign(input) {
        return fetchApi("/api/wallet/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: WalletAction.SIGN,
                payload: { transaction: input.transaction },
            }),
        });
    }
    async function signDataItem(input) {
        const data = input.data instanceof Uint8Array
            ? Array.from(input.data)
            : input.data;
        return fetchApi("/api/wallet/action", {
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
    async function signature(input) {
        const data = input.data instanceof Uint8Array
            ? Array.from(input.data)
            : input.data;
        return fetchApi("/api/wallet/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: WalletAction.SIGNATURE,
                payload: { data },
            }),
        });
    }
    async function dispatch(input) {
        const data = input.data instanceof Uint8Array
            ? Array.from(input.data)
            : input.data;
        return fetchApi("/api/wallet/action", {
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
    async function isAuthenticated() {
        const token = await loadToken();
        if (!token)
            return false;
        try {
            await getMe();
            return true;
        }
        catch {
            return false;
        }
    }
    async function setToken(token) {
        const result = tokenStorage.setToken(token);
        if (result instanceof Promise)
            await result;
    }
    async function clearToken() {
        const result = tokenStorage.removeToken();
        if (result instanceof Promise)
            await result;
    }
    async function getToken() {
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
