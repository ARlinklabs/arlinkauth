import "./index.css";
import { AuthProvider } from "arlinkauth/react";
import { Dashboard } from "./components/dashboard";

// Use env var if set, otherwise default to production
const API_URL = import.meta.env?.BUN_PUBLIC_API_URL || "https://arlinkauth.contact-arlink.workers.dev";

export function App() {
  return (
    <AuthProvider apiUrl={API_URL}>
      <Dashboard />
    </AuthProvider>
  );
}

export default App;
