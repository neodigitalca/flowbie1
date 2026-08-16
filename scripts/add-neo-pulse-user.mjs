#!/usr/bin/env node
/**
 * Create or reset a NEO Pulse app user via /api/auth/setup-admin (or bootstrap on empty DB).
 *
 * Usage:
 *   node scripts/add-neo-pulse-user.mjs --email you@example.com --password "secret"
 *   node scripts/add-neo-pulse-user.mjs --bootstrap --email you@example.com --password "secret"
 *
 * Env:
 *   NEO_PULSE_APP_SETUP_KEY  sent as setupKey when --setup-key is omitted
 *   NEO_PULSE_BASE_URL       default API host (default https://neodigital.ca)
 */

import { createInterface } from "readline/promises";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { stdin as input, stdout as output } from "process";

const DEFAULT_BASE = (process.env.NEO_PULSE_BASE_URL || "https://neodigital.ca").replace(/\/+$/, "");
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_SECRETS = join(
  REPO_ROOT,
  "wordpress-plugins/neo-pulse-app/includes/neo-pulse-app-secrets.php",
);

function readSetupKeyFromLocalSecrets() {
  try {
    const src = readFileSync(LOCAL_SECRETS, "utf8");
    const m = src.match(/define\s*\(\s*['"]NEO_PULSE_APP_SETUP_KEY['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    return m?.[1]?.trim() || "";
  } catch {
    return "";
  }
}

function usage() {
  console.log(`Add or reset a NEO Pulse user (owner + team via setup-admin).

Options:
  --email <email>           Required
  --password <password>     Required
  --display-name <name>     Optional (defaults to email)
  --team-name <name>        Optional (default Neo Digital Inc.)
  --job-title <title>       Optional (default Lead SEO/AI Developer)
  --setup-key <key>         Required when users already exist (auto-read from local neo-pulse-app-secrets.php)
  --base-url <url>          API origin (default ${DEFAULT_BASE})
  --bootstrap               Use /api/auth/bootstrap (empty DB only)
  --help                    Show this help

Examples:
  node scripts/add-neo-pulse-user.mjs
  node scripts/add-neo-pulse-user.mjs --email sean@neodigital.ca --password "YourPass123"
  set NEO_PULSE_APP_SETUP_KEY=your-key
  node scripts/add-neo-pulse-user.mjs --email sean@neodigital.ca --password "YourPass123"
`);
}

function parseArgs(argv) {
  const opts = {
    email: "",
    password: "",
    displayName: "",
    teamName: "",
    jobTitle: "",
    setupKey: process.env.NEO_PULSE_APP_SETUP_KEY?.trim() || readSetupKeyFromLocalSecrets(),
    baseUrl: DEFAULT_BASE,
    bootstrap: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
      continue;
    }
    if (arg === "--bootstrap") {
      opts.bootstrap = true;
      continue;
    }
    const next = argv[i + 1];
    if (arg === "--email" && next) {
      opts.email = next.trim();
      i += 1;
      continue;
    }
    if (arg === "--password" && next) {
      opts.password = next;
      i += 1;
      continue;
    }
    if (arg === "--display-name" && next) {
      opts.displayName = next.trim();
      i += 1;
      continue;
    }
    if (arg === "--team-name" && next) {
      opts.teamName = next.trim();
      i += 1;
      continue;
    }
    if (arg === "--job-title" && next) {
      opts.jobTitle = next.trim();
      i += 1;
      continue;
    }
    if (arg === "--setup-key" && next) {
      opts.setupKey = next.trim();
      i += 1;
      continue;
    }
    if (arg === "--base-url" && next) {
      opts.baseUrl = next.replace(/\/+$/, "");
      i += 1;
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }

  return opts;
}

async function promptMissing(opts) {
  const rl = createInterface({ input, output });
  try {
    if (!opts.email) {
      opts.email = (await rl.question("Email: ")).trim();
    }
    if (!opts.password) {
      opts.password = await rl.question("Password: ");
    }
    if (!opts.bootstrap && !opts.setupKey) {
      const key = (await rl.question("Setup key (Enter uses local neo-pulse-app-secrets.php if present): ")).trim();
      if (key) opts.setupKey = key;
      else opts.setupKey = readSetupKeyFromLocalSecrets();
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  await promptMissing(opts);

  if (!opts.email || !opts.password) {
    console.error("Email and password are required.");
    usage();
    process.exit(1);
  }

  const path = opts.bootstrap ? "/api/auth/bootstrap" : "/api/auth/setup-admin";
  const url = `${opts.baseUrl}${path}`;
  const body = {
    email: opts.email,
    password: opts.password,
  };

  if (opts.displayName) body.displayName = opts.displayName;
  if (!opts.bootstrap) {
    if (opts.teamName) body.teamName = opts.teamName;
    if (opts.jobTitle) body.jobTitle = opts.jobTitle;
    if (opts.setupKey) body.setupKey = opts.setupKey;
  }

  console.log(`POST ${url}`);
  console.log(`Email: ${opts.email}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    console.error(`HTTP ${res.status} (non-JSON response)`);
    process.exit(1);
  }

  if (!res.ok || !data?.ok) {
    console.error(`Failed (HTTP ${res.status}):`, data?.error || data);
    if (data?.error === "Setup not allowed") {
      console.error("Tip: pass --setup-key or set NEO_PULSE_APP_SETUP_KEY from neo-pulse-app-secrets.php on the server.");
    }
    process.exit(1);
  }

  if (opts.bootstrap) {
    console.log("Bootstrap OK. First user created.");
  } else {
    console.log("Setup OK.");
    if (data.email) console.log(`  email: ${data.email}`);
    if (data.role) console.log(`  role: ${data.role}`);
    if (data.team) console.log(`  team: ${data.team}`);
  }
  console.log(`Sign in at ${opts.baseUrl}/neo-pulse/login`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
