import "./index.css";
import { AuthProvider } from "arlinkauth/react";
import { Dashboard } from "./components/dashboard";

// Use local worker if BUN_PUBLIC_USE_LOCAL_API is set, otherwise use production
const API_URL = process.env.BUN_PUBLIC_USE_LOCAL_API === "true" 
  ? "http://localhost:8787" 
  : "https://arlinkauth.ankushkun.workers.dev";

export function App() {
  return (
    <AuthProvider apiUrl={API_URL}>
      <Dashboard />
    </AuthProvider>
  );
}

export default App;
