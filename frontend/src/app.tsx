import "./index.css";
import { AuthProvider } from "arlinkauth/react";
import { Dashboard } from "./components/dashboard";

const API_URL = import.meta.env?.VITE_API_URL ?? "http://localhost:8787";

export function App() {
  return (
    <AuthProvider apiUrl={API_URL}>
      <Dashboard />
    </AuthProvider>
  );
}

export default App;
