import { type WauthClientOptions, type WauthUser, type AuthState, type AuthChangeListener, type OAuthProvider, type SignTransactionInput, type SignTransactionResult, type SignDataItemInput, type SignDataItemResult, type SignatureInput, type SignatureResult, type DispatchInput, type DispatchResult } from "./types.js";
export declare function createWauthClient(options: WauthClientOptions): {
    init: () => Promise<AuthState>;
    login: () => Promise<boolean>;
    loginWithGithub: () => Promise<boolean>;
    loginWithGoogle: () => Promise<boolean>;
    loginWithProvider: (provider: OAuthProvider) => Promise<boolean>;
    logout: () => void;
    handleCallback: () => boolean;
    isAuthenticated: () => boolean;
    getToken: () => string | null;
    getState: () => AuthState;
    onAuthChange: (listener: AuthChangeListener) => () => void;
    api: {
        getMe: () => Promise<WauthUser>;
    };
    sign: (input: SignTransactionInput) => Promise<SignTransactionResult>;
    signDataItem: (input: SignDataItemInput) => Promise<SignDataItemResult>;
    signature: (input: SignatureInput) => Promise<SignatureResult>;
    dispatch: (input: DispatchInput) => Promise<DispatchResult>;
};
export type WauthClient = ReturnType<typeof createWauthClient>;
