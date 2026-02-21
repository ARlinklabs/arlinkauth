import "./index.css";
import { AuthProvider } from "arlinkauth/react";
import { Dashboard } from "./components/dashboard";
import { CLILogin } from "./components/cli-login";

// Use env var if set, otherwise default to production
const API_URL = import.meta.env?.BUN_PUBLIC_API_URL || "https://arlinkauth.contact-arlink.workers.dev";

function Router() {
  const path = window.location.pathname;
  
  if (path === "/cli-login") {
    return <CLILogin />;
  }
  
  return <Dashboard />;
}

export function App() {
  return (
    <AuthProvider apiUrl={API_URL}>
      <Router />
    </AuthProvider>
  );
}

export default App;
