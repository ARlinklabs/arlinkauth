import { type ReactNode } from "react";
import { type WauthClient } from "./client.js";
import type { AuthState, WauthClientOptions, WauthUser, GitHubLoginOptions, GoogleLoginOptions } from "./types.js";
import type { LoginResult } from "./client.js";
type AuthContextValue = {
    user: WauthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (options?: GitHubLoginOptions) => Promise<LoginResult>;
    loginWithGithub: (options?: GitHubLoginOptions) => Promise<LoginResult>;
    loginWithGoogle: (options?: GoogleLoginOptions) => Promise<LoginResult>;
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
export type { OAuthProvider, GitHubLoginOptions, GoogleLoginOptions, ArweaveTag, SignTransactionInput, SignTransactionResult, SignDataItemInput, SignDataItemResult, SignatureInput, SignatureResult, BundlerType, DispatchInput, DispatchResult, } from "./types.js";
export type { LoginResult } from "./client.js";
export { WalletAction } from "./types.js";
//# sourceMappingURL=react.d.ts.map