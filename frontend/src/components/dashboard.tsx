import { useAuth } from "arlinkauth/react";
import type { WauthUser, SignDataItemResult, SignatureResult, DispatchResult } from "arlinkauth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function LoginScreen({
  loginWithGithub,
  loginWithGoogle
}: {
  loginWithGithub: () => void;
  loginWithGoogle: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Arlink Auth</CardTitle>
          <CardDescription>Sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={loginWithGithub} className="w-full" size="lg" variant="outline">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </Button>
          <Button onClick={loginWithGoogle} className="w-full" size="lg" variant="outline">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

// ── Detail row helper ─────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right break-all">{value ?? "N/A"}</span>
    </div>
  );
}

// ── User Profile Card ─────────────────────────────────

// ── Token Row with reveal/hide ─────────────────────────

function TokenRow({ label, token }: { label: string; token: string | null }) {
  const [showToken, setShowToken] = useState(false);

  if (!token) return null;

  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => setShowToken(!showToken)}
          className="text-xs text-primary hover:underline"
        >
          {showToken ? "Hide" : "Reveal"}
        </button>
        {showToken && (
          <code className="text-xs bg-muted px-2 py-1 rounded break-all max-w-[280px]">
            {token}
          </code>
        )}
      </div>
    </div>
  );
}

function UserProfile({ user }: { user: WauthUser }) {
  const connectedProviders: string[] = [];
  if (user.github_id) connectedProviders.push("GitHub");
  if (user.google_id) connectedProviders.push("Google");

  return (
    <div className="space-y-4">
      {/* Avatar + name header */}
      <div className="flex items-center gap-4">
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.name ?? "User"}
            className="w-16 h-16 rounded-full border"
          />
        )}
        <div>
          <p className="font-semibold text-lg">{user.name ?? user.github_username ?? "User"}</p>
          {user.github_username && (
            <a
              href={`https://github.com/${user.github_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:underline"
            >
              @{user.github_username}
            </a>
          )}
          {!user.github_username && user.email && (
            <p className="text-sm text-muted-foreground">{user.email}</p>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="rounded-lg border p-4">
        <DetailRow label="User ID" value={user.id} />
        <DetailRow label="Email" value={user.email} />
        <DetailRow label="Name" value={user.name} />
        <DetailRow label="Connected" value={connectedProviders.join(", ") || "None"} />
        <DetailRow label="Arweave Address" value={user.arweave_address} />
        <DetailRow label="Member since" value={user.created_at} />
        <DetailRow label="Last updated" value={user.updated_at} />
        <TokenRow label="GitHub Token" token={user.github_access_token} />
        <TokenRow label="Google Token" token={user.google_access_token} />
      </div>
    </div>
  );
}

// ── Signing Demo Card ──────────────────────────────────

function SigningDemo() {
  const { client } = useAuth();
  const [message, setMessage] = useState("Hello from wauth!");
  const [signatureResult, setSignatureResult] = useState<SignatureResult | null>(null);
  const [dataItemResult, setDataItemResult] = useState<SignDataItemResult | null>(null);
  const [isSigningMessage, setIsSigningMessage] = useState(false);
  const [isSigningDataItem, setIsSigningDataItem] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignMessage = async () => {
    setError(null);
    setSignatureResult(null);
    setIsSigningMessage(true);
    try {
      const result = await client.signature({ data: message });
      setSignatureResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign message");
    } finally {
      setIsSigningMessage(false);
    }
  };

  const handleSignDataItem = async () => {
    setError(null);
    setDataItemResult(null);
    setIsSigningDataItem(true);
    try {
      const result = await client.signDataItem({
        data: message,
        tags: [
          { name: "Content-Type", value: "text/plain" },
          { name: "App-Name", value: "wauth-demo" },
        ],
      });
      setDataItemResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign data item");
    } finally {
      setIsSigningDataItem(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Message to sign</label>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter a message..."
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSignMessage}
          disabled={isSigningMessage || !message}
          variant="secondary"
          className="flex-1"
        >
          {isSigningMessage ? "Signing..." : "Sign Message"}
        </Button>
        <Button
          onClick={handleSignDataItem}
          disabled={isSigningDataItem || !message}
          variant="secondary"
          className="flex-1"
        >
          {isSigningDataItem ? "Signing..." : "Sign Data Item"}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {signatureResult && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Raw Signature</p>
          <div className="p-3 bg-muted rounded-lg">
            <code className="text-xs break-all">
              {signatureResult.signature.slice(0, 64).join(", ")}...
              <br />
              <span className="text-muted-foreground">
                ({signatureResult.signature.length} bytes)
              </span>
            </code>
          </div>
        </div>
      )}

      {dataItemResult && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Signed Data Item</p>
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="text-xs">
              <span className="text-muted-foreground">ID:</span>{" "}
              <code className="break-all">{dataItemResult.id}</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Raw size: {dataItemResult.raw.length} bytes
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dispatch Demo Card ──────────────────────────────────

function DispatchDemo() {
  const { client } = useAuth();
  const [message, setMessage] = useState("Hello from wauth! This is stored on Arweave.");
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDispatch = async () => {
    setError(null);
    setDispatchResult(null);
    setIsDispatching(true);
    try {
      const result = await client.dispatch({
        data: message,
        tags: [
          { name: "Content-Type", value: "text/plain" },
          { name: "App-Name", value: "wauth-demo" },
          { name: "App-Version", value: "1.0.0" },
        ],
      });
      setDispatchResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch");
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Data to upload</label>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter data to upload to Arweave..."
        />
      </div>

      <Button
        onClick={handleDispatch}
        disabled={isDispatching || !message}
        className="w-full"
      >
        {isDispatching ? "Uploading to Arweave..." : "Upload to Arweave"}
      </Button>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {dispatchResult && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-green-600">Uploaded successfully!</p>
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <p className="text-xs">
              <span className="text-muted-foreground">Transaction ID:</span>{" "}
              <code className="break-all">{dispatchResult.id}</code>
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">Bundler:</span>{" "}
              <code>{dispatchResult.bundler}</code>
            </p>
            <a
              href={`https://arweave.net/${dispatchResult.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline block"
            >
              View on Arweave Gateway
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Authenticated Screen ──────────────────────────────

function AuthenticatedScreen() {
  const { user, logout } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-lg space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Account</CardTitle>
            <CardDescription>Your GitHub profile and auth details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {user && <UserProfile user={user} />}
            <Button onClick={logout} variant="outline" className="w-full">
              Sign out
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Wallet Signing</CardTitle>
            <CardDescription>
              Test signing with your server-side Arweave wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SigningDemo />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Upload to Arweave</CardTitle>
            <CardDescription>
              Dispatch data to Arweave via Turbo bundler (free for small uploads)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DispatchDemo />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────

export function Dashboard() {
  const { isLoading, isAuthenticated, loginWithGithub, loginWithGoogle } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen loginWithGithub={loginWithGithub} loginWithGoogle={loginWithGoogle} />;
  return <AuthenticatedScreen />;
}
