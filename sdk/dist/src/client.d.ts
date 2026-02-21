/**
 * Browser client - extends core with localStorage and popup OAuth
 */
import { type WauthClientOptions, type WauthUser, type AuthState, type AuthChangeListener, type OAuthProvider, type GitHubLoginOptions, type GoogleLoginOptions } from "./types.js";
/** Result returned after successful login */
export type LoginResult = {
    success: true;
    user: WauthUser;
} | {
    success: false;
};
export declare function createWauthClient(options: WauthClientOptions): {
    init: () => Promise<AuthState>;
    login: (options?: GitHubLoginOptions) => Promise<LoginResult>;
    loginWithGithub: (options?: GitHubLoginOptions) => Promise<LoginResult>;
    loginWithGoogle: (options?: GoogleLoginOptions) => Promise<LoginResult>;
    loginWithProvider: (provider: OAuthProvider, options?: {
        scopes?: string[];
    }) => Promise<LoginResult>;
    logout: () => void;
    handleCallback: () => boolean;
    isAuthenticated: () => boolean;
    getToken: () => string | null;
    getState: () => AuthState;
    onAuthChange: (listener: AuthChangeListener) => () => void;
    api: {
        getMe: () => Promise<WauthUser>;
    };
    sign: (input: import("./types.js").SignTransactionInput) => Promise<import("./types.js").SignTransactionResult>;
    signDataItem: (input: import("./types.js").SignDataItemInput) => Promise<import("./types.js").SignDataItemResult>;
    signature: (input: import("./types.js").SignatureInput) => Promise<import("./types.js").SignatureResult>;
    dispatch: (input: import("./types.js").DispatchInput) => Promise<import("./types.js").DispatchResult>;
};
export type WauthClient = ReturnType<typeof createWauthClient>;
//# sourceMappingURL=client.d.ts.map