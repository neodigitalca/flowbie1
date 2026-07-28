import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// For WP Engine subdirectory deploy (e.g. flowbie.ca/app/): set VITE_BASE_PATH=/app/
const deployGitSha =
  process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || "";

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    "import.meta.env.VITE_DEPLOY_GIT_SHA": JSON.stringify(deployGitSha),
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'https://flowbie.ca',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Ensures a single React instance so context providers/consumers always match (fixes "must be used within Provider" in dev).
    dedupe: ["react", "react-dom"],
  },
}));
