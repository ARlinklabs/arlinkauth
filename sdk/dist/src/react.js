import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState, useMemo, } from "react";
import { createWauthClient } from "./client.js";
const AuthContext = createContext(null);
export function AuthProvider({ children, ...options }) {
    const client = useMemo(() => createWauthClient(options), [options.apiUrl, options.tokenKey]);
    const [authState, setAuthState] = useState(client.getState);
    useEffect(() => {
        // Subscribe to state changes
        const unsubscribe = client.onAuthChange(setAuthState);
        // Initialize: handle callback token + validate session
        client.init();
        return unsubscribe;
    }, [client]);
    const value = useMemo(() => ({
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
    }), [authState, client]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
// ── Hook ──────────────────────────────────────────────
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an <AuthProvider>");
    }
    return ctx;
}
export { WalletAction } from "./types.js";
