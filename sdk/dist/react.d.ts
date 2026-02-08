import { type ReactNode } from "react";
import { type WauthClient } from "./client.js";
import type { AuthState, WauthClientOptions, WauthUser } from "./types.js";
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
type AuthProviderProps = WauthClientOptions & {
    children: ReactNode;
};
export declare function AuthProvider({ children, ...options }: AuthProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function useAuth(): AuthContextValue;
export type { WauthUser, AuthState, WauthClientOptions };
export type { OAuthProvider, ArweaveTag, SignTransactionInput, SignTransactionResult, SignDataItemInput, SignDataItemResult, SignatureInput, SignatureResult, BundlerType, DispatchInput, DispatchResult, } from "./types.js";
export { WalletAction } from "./types.js";
