// Browser client (with localStorage + popup OAuth)
export { createWauthClient, createWauthClient as createArlinkAuthClient } from "./client.js";
export type { WauthClient, WauthClient as ArlinkAuthClient, LoginResult } from "./client.js";

// Core client (universal - works with any TokenStorage)
export { createCoreClient } from "./core.js";
export type { CoreClient, CoreClientOptions, TokenStorage } from "./core.js";

// Node/CLI client (with file storage + browser OAuth)
export { createNodeAuthClient } from "./node.js";
export type { NodeAuthClient, NodeAuthOptions } from "./node.js";

// Auto-detecting client factory
export { createAuthClient } from "./auto.js";
export type { AuthClient, AuthClientOptions } from "./auto.js";

// Types
export {
  WalletAction,
  type WauthUser,
  type WauthUser as ArlinkUser,
  type WauthClientOptions,
  type WauthClientOptions as ArlinkAuthClientOptions,
  type AuthState,
  type AuthChangeListener,
  type OAuthProvider,
  type GitHubLoginOptions,
  type GoogleLoginOptions,
  type ArweaveTag,
  type SignTransactionInput,
  type SignTransactionResult,
  type SignDataItemInput,
  type SignDataItemResult,
  type SignatureInput,
  type SignatureResult,
  type BundlerType,
  type DispatchInput,
  type DispatchResult,
} from "./types.js";
