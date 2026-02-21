/**
 * Browser client - extends core with localStorage and popup OAuth
 */

import {
  createCoreClient,
  type CoreClient,
  type TokenStorage,
} from "./core.js";
import {
  type WauthClientOptions,
  type WauthUser,
  type AuthState,
  type AuthChangeListener,
  type OAuthProvider,
  type GitHubLoginOptions,
  type GoogleLoginOptions,
} from "./types.js";

/** Result returned after successful login */
export type LoginResult = {
  success: true;
  user: WauthUser;
} | {
  success: false;
};

const DEFAULT_TOKEN_KEY = "arlinkauth_token";
const PROD_API_URL = "https://arlinkauth.contact-arlink.workers.dev";

function resolveApiUrl(apiUrl?: string): string {
  if (apiUrl) return apiUrl;
  try {
    const g = globalThis as Record<string, unknown>;
    const proc = g.process as { env?: Record<string, string | undefined> } | undefined;
    if (proc?.env?.ARLINKAUTH_API_URL) {
      return proc.env.ARLINKAUTH_API_URL;
    }
  } catch {
    // process.env may not exist in browser environments
  }
  return PROD_API_URL;
}

/** Create localStorage-based token storage for browser */
function createBrowserTokenStorage(tokenKey: string): TokenStorage {
  return {
    getToken(): string | null {
      try {
        return localStorage.getItem(tokenKey);
      } catch {
        return null;
      }
    },
    setToken(token: string): void {
      try {
        localStorage.setItem(tokenKey, token);
      } catch {
        // SSR or storage unavailable
      }
    },
    removeToken(): void {
      try {
        localStorage.removeItem(tokenKey);
      } catch {
        // SSR or storage unavailable
      }
    },
  };
}

export function createWauthClient(options: WauthClientOptions) {
  const apiUrl = resolveApiUrl(options.apiUrl);
  const tokenKey = options.tokenKey ?? DEFAULT_TOKEN_KEY;

  // Create token storage and core client
  const tokenStorage = createBrowserTokenStorage(tokenKey);
  const core = createCoreClient({ apiUrl, tokenStorage });

  // ── State Management ────────────────────────────────

  const listeners = new Set<AuthChangeListener>();

  // Browser token storage is synchronous, so we can cast safely
  let state: AuthState = {
    user: null,
    token: tokenStorage.getToken() as string | null,
    isLoading: false,
    isAuthenticated: false,
  };

  function setState(partial: Partial<AuthState>) {
    state = { ...state, ...partial };
    for (const listener of listeners) {
      listener(state);
    }
  }

  function getState(): AuthState {
    return state;
  }

  function onAuthChange(listener: AuthChangeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  // ── Auth Actions ────────────────────────────────────

  /** Open a popup for OAuth login with the specified provider and optional scopes */
  function loginWithProvider(provider: OAuthProvider, options?: { scopes?: string[] }): Promise<LoginResult> {
    return new Promise((resolve) => {
      // Build login URL with origin and optional scopes
      const params = new URLSearchParams({
        origin: window.location.origin,
      });
      if (options?.scopes?.length) {
        params.set("scopes", options.scopes.join(","));
      }
      const loginUrl = `${apiUrl}/auth/${provider}?${params.toString()}`;
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        loginUrl,
        "wauth-login",
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      if (!popup) {
        console.error("[arlinkauth] Failed to open popup - check popup blocker");
        resolve({ success: false });
        return;
      }

      // Listen for message from popup
      const handleMessage = async (event: MessageEvent) => {
        // Strict origin validation
        if (event.origin !== new URL(apiUrl).origin) return;
        
        // Strict message structure validation
        if (typeof event.data !== "object" || event.data === null) return;
        if (event.data.type !== "arlinkauth:callback") return;
        if (typeof event.data.token !== "string" || event.data.token.length === 0) return;
        
        // Basic JWT structure validation (header.payload.signature)
        const tokenParts = event.data.token.split(".");
        if (tokenParts.length !== 3) return;

        window.removeEventListener("message", handleMessage);
        popup.close();

        // Store token and fetch user
        tokenStorage.setToken(event.data.token);
        setState({ token: event.data.token, isLoading: true, isAuthenticated: true });

        try {
          const user = await core.getMe();
          setState({ user, isLoading: false, isAuthenticated: true });
          resolve({ success: true, user });
        } catch {
          tokenStorage.removeToken();
          setState({ token: null, user: null, isLoading: false, isAuthenticated: false });
          resolve({ success: false });
        }
      };

      window.addEventListener("message", handleMessage);

      // Clean up if popup is closed without completing auth
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", handleMessage);
          resolve({ success: false });
        }
      }, 500);
    });
  }

  /** Open a popup for GitHub OAuth login (no page refresh) */
  function login(options?: GitHubLoginOptions): Promise<LoginResult> {
    return loginWithProvider("github", options);
  }

  /** Open a popup for GitHub OAuth login with optional custom scopes */
  function loginWithGithub(options?: GitHubLoginOptions): Promise<LoginResult> {
    return loginWithProvider("github", options);
  }

  /** Open a popup for Google OAuth login with optional custom scopes */
  function loginWithGoogle(options?: GoogleLoginOptions): Promise<LoginResult> {
    return loginWithProvider("google", options);
  }

  /**
   * Check for existing token in localStorage.
   */
  function handleCallback(): boolean {
    // Browser token storage is synchronous
    const existing = tokenStorage.getToken() as string | null;
    if (existing) {
      setState({ token: existing, isAuthenticated: true });
      return true;
    }
    return false;
  }

  /** Clear the token and user state */
  function logout() {
    tokenStorage.removeToken();
    setState({ token: null, user: null, isAuthenticated: false });
  }

  function isAuthenticated(): boolean {
    return state.isAuthenticated;
  }

  function getToken(): string | null {
    return state.token;
  }

  // ── API Methods ─────────────────────────────────────

  const api = {
    getMe: () => core.getMe(),
  };

  // ── Initialize ──────────────────────────────────────

  /**
   * Initialize the client: check for existing session token
   * and validate it by fetching /api/me.
   */
  async function init(): Promise<AuthState> {
    handleCallback();

    if (!state.token) {
      setState({ isLoading: false, isAuthenticated: false });
      return getState();
    }

    setState({ isLoading: true });
    try {
      const user = await core.getMe();
      setState({ user, isLoading: false, isAuthenticated: true });
    } catch {
      // Token invalid — clear everything
      tokenStorage.removeToken();
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
    // Wallet signing methods (delegated to core)
    sign: core.sign,
    signDataItem: core.signDataItem,
    signature: core.signature,
    dispatch: core.dispatch,
  };
}

export type WauthClient = ReturnType<typeof createWauthClient>;
