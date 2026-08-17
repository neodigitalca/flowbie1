import { createRequire } from "module";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { localDominatorDevExportPlugin } from "./scripts/vite-local-dominator-export-plugin.mjs";
import { localWpApiProxyPlugin } from "./scripts/vite-local-wp-api-proxy-plugin.mjs";

const require = createRequire(import.meta.url);
const { resolveDevApiTarget, isLocalWpProxyTarget } = require("./scripts/resolve-dev-api-target.cjs");

// https://vitejs.dev/config/
// For WP Engine subdirectory deploy (e.g. neodigital.ca/app/): set VITE_BASE_PATH=/app/
const deployGitSha =
  process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || "";
const isMobileApp = process.env.VITE_MOBILE_APP === "1";
const openRouterApiKey =
  process.env.VITE_OPENROUTER_API_KEY ||
  process.env.OPEN_ROUTER_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  "";

const apiProxyTarget = resolveDevApiTarget();
const isLocalWpProxy = isLocalWpProxyTarget(apiProxyTarget);

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    "import.meta.env.VITE_DEPLOY_GIT_SHA": JSON.stringify(deployGitSha),
    "import.meta.env.VITE_MOBILE_APP": JSON.stringify(isMobileApp ? "1" : ""),
    "import.meta.env.VITE_OPENROUTER_API_KEY": JSON.stringify(openRouterApiKey),
  },
  build: {
    rollupOptions: {
      input: isMobileApp
        ? { index: path.resolve(__dirname, "mobile.html") }
        : path.resolve(__dirname, "index.html"),
    },
  },
  server: {
    host: "::",
    port: 8080,
    ...(isLocalWpProxy
      ? {}
      : {
          proxy: {
            "/api": {
              target: apiProxyTarget,
              changeOrigin: true,
              secure: true,
            },
          },
        }),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "development" && isLocalWpProxy && localWpApiProxyPlugin(),
    mode === "development" && isLocalWpProxy && localDominatorDevExportPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Ensures a single React instance so context providers/consumers always match (fixes "must be used within Provider" in dev).
    dedupe: ["react", "react-dom"],
  },
}));
