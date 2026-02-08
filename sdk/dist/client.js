import { WalletAction, } from "./types.js";
const DEFAULT_TOKEN_KEY = "arlinkauth_token";
export function createWauthClient(options) {
    const { apiUrl } = options;
    const tokenKey = options.tokenKey ?? DEFAULT_TOKEN_KEY;
    const listeners = new Set();
    let state = {
        user: null,
        token: getStoredToken(),
        isLoading: false,
        isAuthenticated: false,
    };
    // ── Token Storage ───────────────────────────────────
    function getStoredToken() {
        try {
            return localStorage.getItem(tokenKey);
        }
        catch {
            return null;
        }
    }
    function setStoredToken(token) {
        try {
            localStorage.setItem(tokenKey, token);
        }
        catch {
            // SSR or storage unavailable
        }
    }
    function removeStoredToken() {
        try {
            localStorage.removeItem(tokenKey);
        }
        catch {
            // SSR or storage unavailable
        }
    }
    // ── State Management ────────────────────────────────
    function setState(partial) {
        state = { ...state, ...partial };
        for (const listener of listeners) {
            listener(state);
        }
    }
    function getState() {
        return state;
    }
    function onAuthChange(listener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }
    // ── Authenticated Fetch ─────────────────────────────
    async function fetchApi(path, init) {
        const token = state.token;
        if (!token) {
            throw new Error("Not authenticated");
        }
        const res = await fetch(`${apiUrl}${path}`, {
            ...init,
            headers: {
                ...init?.headers,
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 401) {
            // Token is invalid/expired — clear it
            removeStoredToken();
            setState({ token: null, user: null, isAuthenticated: false });
            throw new Error("Session expired");
        }
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `API error: ${res.status}`);
        }
        return res.json();
    }
    // ── Auth Actions ────────────────────────────────────
    /** Open a popup for OAuth login with the specified provider */
    function loginWithProvider(provider) {
        return new Promise((resolve) => {
            // Pass origin explicitly to ensure it survives the OAuth redirect chain
            const loginUrl = `${apiUrl}/auth/${provider}?origin=${encodeURIComponent(window.location.origin)}`;
            const width = 500;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            const popup = window.open(loginUrl, "wauth-login", `width=${width},height=${height},left=${left},top=${top},popup=1`);
            if (!popup) {
                console.error("[arlinkauth] Failed to open popup - check popup blocker");
                resolve(false);
                return;
            }
            // Listen for message from popup
            const handleMessage = async (event) => {
                // Strict origin validation
                if (event.origin !== new URL(apiUrl).origin)
                    return;
                // Strict message structure validation
                if (typeof event.data !== "object" || event.data === null)
                    return;
                if (event.data.type !== "arlinkauth:callback")
                    return;
                if (typeof event.data.token !== "string" || event.data.token.length === 0)
                    return;
                // Basic JWT structure validation (header.payload.signature)
                const tokenParts = event.data.token.split(".");
                if (tokenParts.length !== 3)
                    return;
                window.removeEventListener("message", handleMessage);
                popup.close();
                // Store token and fetch user
                setStoredToken(event.data.token);
                setState({ token: event.data.token, isLoading: true, isAuthenticated: true });
                try {
                    const user = await api.getMe();
                    setState({ user, isLoading: false, isAuthenticated: true });
                    resolve(true);
                }
                catch {
                    removeStoredToken();
                    setState({ token: null, user: null, isLoading: false, isAuthenticated: false });
                    resolve(false);
                }
            };
            window.addEventListener("message", handleMessage);
            // Clean up if popup is closed without completing auth
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener("message", handleMessage);
                    resolve(false);
                }
            }, 500);
        });
    }
    /** Open a popup for GitHub OAuth login (no page refresh) */
    function login() {
        return loginWithProvider("github");
    }
    /** Open a popup for GitHub OAuth login */
    function loginWithGithub() {
        return loginWithProvider("github");
    }
    /** Open a popup for Google OAuth login */
    function loginWithGoogle() {
        return loginWithProvider("google");
    }
    /**
     * Check for existing token in localStorage.
     * (URL-based callback is no longer used - popup flow uses postMessage)
     */
    function handleCallback() {
        const existing = getStoredToken();
        if (existing) {
            setState({ token: existing, isAuthenticated: true });
            return true;
        }
        return false;
    }
    /** Clear the token and user state */
    function logout() {
        removeStoredToken();
        setState({ token: null, user: null, isAuthenticated: false });
    }
    function isAuthenticated() {
        return state.isAuthenticated;
    }
    function getToken() {
        return state.token;
    }
    // ── API Methods ─────────────────────────────────────
    const api = {
        getMe: () => fetchApi("/api/me"),
    };
    // ── Wallet Signing Methods ─────────────────────────────
    /**
     * Sign an Arweave transaction.
     * The transaction must be created using arweave-js and passed as the raw object.
     */
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
    /**
     * Sign an ANS-104 data item (for AO/bundled transactions).
     * Returns the signed data item ID and raw bytes.
     */
    async function signDataItem(input) {
        // Convert Uint8Array to array for JSON serialization
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
    /**
     * Create a raw signature of arbitrary data.
     * Returns the raw signature bytes.
     */
    async function signature(input) {
        // Convert Uint8Array to array for JSON serialization
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
    /**
     * Sign and dispatch a data item to Arweave via a bundler (Turbo/Irys).
     * Returns the transaction ID and bundler response.
     */
    async function dispatch(input) {
        // Convert Uint8Array to array for JSON serialization
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
    // ── Initialize ──────────────────────────────────────
    /**
     * Initialize the client: check for existing session token
     * and validate it by fetching /api/me.
     */
    async function init() {
        handleCallback();
        if (!state.token) {
            setState({ isLoading: false, isAuthenticated: false });
            return getState();
        }
        setState({ isLoading: true });
        try {
            const user = await api.getMe();
            setState({ user, isLoading: false, isAuthenticated: true });
        }
        catch {
            // Token invalid — clear everything
            removeStoredToken();
            setState({
                token: null,
                user: null,
                isLoading: false,
                isAuthenticated: false,
            });
        }
        return getState();
    }
    return {
        init,
        login,
        loginWithGithub,
        loginWithGoogle,
        loginWithProvider,
        logout,
        handleCallback,
        isAuthenticated,
        getToken,
        getState,
        onAuthChange,
        api,
        // Wallet signing methods
        sign,
        signDataItem,
        signature,
        dispatch,
    };
}
