import { handleLocalDominatorExportRequest } from "./local-dominator-export-jobs.mjs";

/**
 * Local WP Staging runs PHP inside Docker without Node. Intercept export-grid on
 * the Vite dev server and run Puppeteer on the host instead.
 */
export function localDominatorDevExportPlugin() {
  return {
    name: "local-dominator-dev-export",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url?.split("?")[0] ?? "").replace(/\/+$/, "");
        if (!url.startsWith("/api/local-dominator/export-grid")) {
          next();
          return;
        }
        const apiPath = url.slice(4);
        const handled = await handleLocalDominatorExportRequest(req, res, apiPath);
        if (!handled) next();
      });
    },
  };
}
