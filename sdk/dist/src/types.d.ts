export type WauthUser = {
    id: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
    github_id: number | null;
    github_username: string | null;
    github_access_token: string | null;
    google_id: string | null;
    google_access_token: string | null;
    arweave_address: string | null;
    created_at: string;
    updated_at: string;
};
export type OAuthProvider = "github" | "google";
/** Options for GitHub OAuth login */
export type GitHubLoginOptions = {
    /** GitHub OAuth scopes to request (e.g., ["repo", "read:org"]) */
    scopes?: string[];
};
/** Options for Google OAuth login */
export type GoogleLoginOptions = {
    /** Google OAuth scopes to request */
    scopes?: string[];
};
export declare enum WalletAction {
    SIGN = "sign",
    SIGN_DATA_ITEM = "signDataItem",
    SIGNATURE = "signature",
    DISPATCH = "dispatch"
}
/** Tag for Arweave transactions/data items */
export type ArweaveTag = {
    name: string;
    value: string;
};
/** Input for signing an Arweave transaction */
export type SignTransactionInput = {
    /** Raw transaction object from arweave-js */
    transaction: unknown;
};
/** Result of signing a transaction */
export type SignTransactionResult = {
    /** Signed transaction JSON */
    [key: string]: unknown;
};
/** Input for signing an ANS-104 data item */
export type SignDataItemInput = {
    data: string | Uint8Array | number[];
    tags?: ArweaveTag[];
    target?: string;
    anchor?: string;
};
/** Result of signing a data item */
export type SignDataItemResult = {
    /** Data item ID (transaction ID) */
    id: string;
    /** Raw signed data item bytes */
    raw: number[];
};
/** Input for raw signature */
export type SignatureInput = {
    /** Data to sign - can be string, Uint8Array, or array of numbers */
    data: string | Uint8Array | number[];
};
/** Result of raw signature */
export type SignatureResult = {
    /** Raw signature bytes */
    signature: number[];
};
/** Bundler types for dispatching data items */
export type BundlerType = "turbo" | "irys";
/** Input for dispatching a data item to Arweave via bundler */
export type DispatchInput = {
    /** Data to upload - can be string or array of bytes */
    data: string | Uint8Array | number[];
    /** Optional tags for the data item */
    tags?: ArweaveTag[];
    /** Optional target address */
    target?: string;
    /** Optional anchor */
    anchor?: string;
    /** Which bundler to use (default: "turbo") */
    bundler?: BundlerType;
};
/** Result of dispatching a data item */
export type DispatchResult = {
    /** Transaction/data item ID */
    id: string;
    /** Which bundler was used */
    bundler: BundlerType;
    /** Response from the bundler */
    response: Record<string, unknown>;
};
export type WauthClientOptions = {
    /** Base URL of the wauth worker. Defaults to production URL unless ARLINKAUTH_API_URL env var is set. */
    apiUrl?: string;
    /** localStorage key for the JWT. Default: "wauth_token" */
    tokenKey?: string;
};
export type AuthState = {
    user: WauthUser | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
};
export type AuthChangeListener = (state: AuthState) => void;
//# sourceMappingURL=types.d.ts.map