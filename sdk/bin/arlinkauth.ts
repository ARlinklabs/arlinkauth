#!/usr/bin/env node

/**
 * Arlink Auth CLI
 * 
 * Usage:
 *   arlinkauth login [--provider github|google]
 *   arlinkauth logout
 *   arlinkauth whoami
 *   arlinkauth status
 */

import { createNodeAuthClient } from "../src/node.js";

const client = createNodeAuthClient();

const command = process.argv[2];

async function main() {
  switch (command) {
    case "login": {
      const providerArg = process.argv.indexOf("--provider");
      const provider = providerArg !== -1 
        ? (process.argv[providerArg + 1] as "github" | "google") 
        : undefined;

      console.log("Starting authentication...");
      const result = await client.login(provider);
      
      if (result.success && result.user) {
        console.log("\nAuthentication successful!");
        console.log(`  Name: ${result.user.name || "N/A"}`);
        console.log(`  Email: ${result.user.email || "N/A"}`);
        console.log(`  Arweave Address: ${result.user.arweave_address || "N/A"}`);
      } else {
        console.error("\nAuthentication failed or was cancelled.");
        process.exit(1);
      }
      break;
    }

    case "logout": {
      await client.logout();
      console.log("Logged out successfully.");
      break;
    }

    case "whoami": {
      const user = await client.getUser();
      if (user) {
        console.log(`Logged in as: ${user.name || user.email || user.id}`);
        console.log(`  Email: ${user.email || "N/A"}`);
        console.log(`  Arweave Address: ${user.arweave_address || "N/A"}`);
        if (user.github_username) {
          console.log(`  GitHub: @${user.github_username}`);
        }
      } else {
        console.log("Not logged in. Run 'arlinkauth login' to authenticate.");
        process.exit(1);
      }
      break;
    }

    case "status": {
      const isAuth = await client.isAuthenticated();
      if (isAuth) {
        const user = await client.getUser();
        console.log("Status: Authenticated");
        if (user) {
          console.log(`  User: ${user.name || user.email || user.id}`);
          console.log(`  Arweave Address: ${user.arweave_address || "N/A"}`);
        }
      } else {
        console.log("Status: Not authenticated");
        process.exit(1);
      }
      break;
    }

    case "help":
    case "--help":
    case "-h":
    default: {
      console.log(`
Arlink Auth CLI

Usage:
  arlinkauth <command> [options]

Commands:
  login     Authenticate via browser (OAuth)
  logout    Clear stored credentials
  whoami    Show current user info
  status    Check authentication status
  help      Show this help message

Options:
  --provider <github|google>  Specify OAuth provider for login

Examples:
  arlinkauth login
  arlinkauth login --provider github
  arlinkauth whoami
  arlinkauth logout
`);
      if (command && command !== "help" && command !== "--help" && command !== "-h") {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
      break;
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
