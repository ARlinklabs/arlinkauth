import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { createWauthClient, type WauthClient } from "./client.js";
import type { AuthState, WauthClientOptions, WauthUser } from "./types.js";

// ── Context ───────────────────────────────────────────

type AuthContextValue = {
  user: WauthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  loginWithGithub: () => void;
  loginWithGoogle: () => void;
  logout: () => void;
  getToken: () => string | null;
  client: WauthClient;
  api: WauthClient["api"];
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────

type AuthProviderProps = WauthClientOptions & {
  children: ReactNode;
};

export function AuthProvider({ children, ...options }: AuthProviderProps) {
  const client = useMemo(() => createWauthClient(options), [options.apiUrl, options.tokenKey]);

  const [authState, setAuthState] = useState<AuthState>(client.getState);

  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = client.onAuthChange(setAuthState);

    // Initialize: handle callback token + validate session
    client.init();

    return unsubscribe;
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: authState.user,
      isLoading: authState.isLoading,
      isAuthenticated: authState.isAuthenticated,
      login: client.login,
      loginWithGithub: client.loginWithGithub,
      loginWithGoogle: client.loginWithGoogle,
      logout: client.logout,
      getToken: client.getToken,
      client,
      api: client.api,
    }),
    [authState, client]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}

// Re-export types that consumers commonly need
export type { WauthUser, AuthState, WauthClientOptions };
export type {
  OAuthProvider,
  ArweaveTag,
  SignTransactionInput,
  SignTransactionResult,
  SignDataItemInput,
  SignDataItemResult,
  SignatureInput,
  SignatureResult,
  BundlerType,
  DispatchInput,
  DispatchResult,
} from "./types.js";
export { WalletAction } from "./types.js";
