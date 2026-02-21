import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

// ── Types ──

type Bindings = {
  DB: D1Database;
  DASHBOARD_PASSWORD: string;
};

type DashboardEnv = { Bindings: Bindings };

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  github_id: number | null;
  github_username: string | null;
  google_id: string | null;
  created_at: string;
  updated_at: string;
  wallet_address: string | null;
  wallet_created_at: string | null;
}

// ── Dashboard App ──

const dashboard = new Hono<DashboardEnv>();

// Auth middleware — check cookie on all routes except login
dashboard.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === "/dashboard/login") return next();

  const token = getCookie(c, "dashboard_session");
  if (!token || token !== generateSessionToken(c.env.DASHBOARD_PASSWORD)) {
    return c.redirect("/dashboard/login");
  }
  await next();
});

function generateSessionToken(password: string): string {
  // Simple HMAC-like token derived from the password. Not a full HMAC since
  // we only need to verify the user knew the password at login time.
  let hash = 0;
  const str = `dashboard:${password}:session`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ── Login ──

dashboard.get("/login", (c) => {
  const error = c.req.query("error");
  return c.html(loginPage(error === "1"));
});

dashboard.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const password = body["password"];

  if (typeof password !== "string" || password !== c.env.DASHBOARD_PASSWORD) {
    return c.redirect("/dashboard/login?error=1");
  }

  setCookie(c, "dashboard_session", generateSessionToken(c.env.DASHBOARD_PASSWORD), {
    path: "/dashboard",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return c.redirect("/dashboard");
});

dashboard.get("/logout", (c) => {
  deleteCookie(c, "dashboard_session", { path: "/dashboard" });
  return c.redirect("/dashboard/login");
});

// ── Main Dashboard ──

dashboard.get("/", async (c) => {
  const users = await c.env.DB.prepare(`
    SELECT
      u.id, u.email, u.name, u.avatar_url,
      u.github_id, u.github_username, u.google_id,
      u.created_at, u.updated_at,
      w.address AS wallet_address,
      w.created_at AS wallet_created_at
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
    ORDER BY u.created_at DESC
  `).all<UserRow>();

  return c.html(dashboardPage(users.results));
});

// ── HTML Templates ──

function loginPage(error: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard Login</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 40px; width: 100%; max-width: 380px; }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 24px; color: #fff; }
  label { display: block; font-size: 13px; color: #a3a3a3; margin-bottom: 6px; }
  input[type="password"] { width: 100%; padding: 10px 12px; background: #0a0a0a; border: 1px solid #262626; border-radius: 8px; color: #fff; font-size: 14px; outline: none; transition: border-color 0.15s; }
  input[type="password"]:focus { border-color: #525252; }
  button { width: 100%; padding: 10px; margin-top: 16px; background: #fff; color: #0a0a0a; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: opacity 0.15s; }
  button:hover { opacity: 0.9; }
  .error { color: #ef4444; font-size: 13px; margin-bottom: 16px; }
</style>
</head>
<body>
<div class="card">
  <h1>ArLink Dashboard</h1>
  ${error ? '<p class="error">Invalid password.</p>' : ""}
  <form method="POST" action="/dashboard/login">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autofocus required>
    <button type="submit">Sign in</button>
  </form>
</div>
</body>
</html>`;
}

function dashboardPage(users: UserRow[]): string {
  const totalUsers = users.length;
  const withWallet = users.filter((u) => u.wallet_address).length;
  const withGithub = users.filter((u) => u.github_id).length;
  const withGoogle = users.filter((u) => u.google_id).length;

  const rows = users
    .map((u) => {
      const providers: string[] = [];
      if (u.github_id) providers.push(`<span class="badge gh" title="GitHub ID: ${esc(String(u.github_id))}">GitHub${u.github_username ? ` (${esc(u.github_username)})` : ""}</span>`);
      if (u.google_id) providers.push(`<span class="badge gg" title="Google ID: ${esc(u.google_id)}">Google</span>`);
      if (providers.length === 0) providers.push(`<span class="badge none">Email only</span>`);

      const avatar = u.avatar_url
        ? `<img src="${esc(u.avatar_url)}" alt="" class="avatar">`
        : `<div class="avatar placeholder">${(u.name || u.email || "?")[0].toUpperCase()}</div>`;

      return `<tr>
        <td>${avatar}</td>
        <td>
          <div class="name">${esc(u.name || "--")}</div>
          <div class="email">${esc(u.email || "--")}</div>
        </td>
        <td>${providers.join(" ")}</td>
        <td class="mono">${u.wallet_address ? esc(u.wallet_address.slice(0, 8) + "..." + u.wallet_address.slice(-6)) : '<span class="dim">None</span>'}</td>
        <td class="dim">${formatDate(u.created_at)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ArLink Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; }
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
  header h1 { font-size: 22px; font-weight: 600; color: #fff; }
  header a { color: #a3a3a3; font-size: 13px; text-decoration: none; }
  header a:hover { color: #fff; }
  .stats { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
  .stat { background: #141414; border: 1px solid #262626; border-radius: 10px; padding: 16px 20px; min-width: 140px; }
  .stat .val { font-size: 28px; font-weight: 700; color: #fff; }
  .stat .lbl { font-size: 12px; color: #737373; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .search { width: 100%; padding: 10px 14px; background: #141414; border: 1px solid #262626; border-radius: 8px; color: #fff; font-size: 14px; outline: none; margin-bottom: 20px; transition: border-color 0.15s; }
  .search:focus { border-color: #525252; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 10px 12px; font-size: 11px; color: #737373; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #262626; }
  td { padding: 12px; border-bottom: 1px solid #1a1a1a; vertical-align: middle; }
  tr:hover td { background: #141414; }
  .avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; display: block; }
  .avatar.placeholder { background: #262626; color: #a3a3a3; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; }
  .name { font-weight: 500; color: #fff; font-size: 14px; }
  .email { color: #737373; font-size: 12px; margin-top: 1px; }
  .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }
  .dim { color: #525252; font-size: 13px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .badge.gh { background: #1c1c1c; color: #e5e5e5; border: 1px solid #333; }
  .badge.gg { background: #1a1a2e; color: #818cf8; border: 1px solid #2e2e5e; }
  .badge.none { background: #1a1a1a; color: #737373; border: 1px solid #262626; }
  .empty { text-align: center; padding: 60px 20px; color: #525252; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>ArLink Dashboard</h1>
    <a href="/dashboard/logout">Sign out</a>
  </header>

  <div class="stats">
    <div class="stat"><div class="val">${totalUsers}</div><div class="lbl">Total Users</div></div>
    <div class="stat"><div class="val">${withWallet}</div><div class="lbl">With Wallet</div></div>
    <div class="stat"><div class="val">${withGithub}</div><div class="lbl">GitHub</div></div>
    <div class="stat"><div class="val">${withGoogle}</div><div class="lbl">Google</div></div>
  </div>

  <input type="text" class="search" placeholder="Search users by name, email, or wallet..." id="search">

  ${
    totalUsers === 0
      ? '<div class="empty">No users yet.</div>'
      : `<table>
    <thead>
      <tr>
        <th style="width:48px"></th>
        <th>User</th>
        <th>Provider</th>
        <th>Wallet</th>
        <th>Joined</th>
      </tr>
    </thead>
    <tbody id="users">
      ${rows}
    </tbody>
  </table>`
  }
</div>
<script>
  const search = document.getElementById("search");
  const tbody = document.getElementById("users");
  if (search && tbody) {
    const rows = Array.from(tbody.querySelectorAll("tr"));
    search.addEventListener("input", () => {
      const q = search.value.toLowerCase();
      rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }
</script>
</body>
</html>`;
}

// ── Helpers ──

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export { dashboard };
