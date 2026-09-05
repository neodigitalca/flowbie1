import { handleLocalDominatorExportRequest } from "./local-dominator-export-jobs.mjs";
import { handleChatGptAuditRequest } from "./chatgpt-audit-jobs.mjs";
import {
  handleBrowserAutomationRequest,
  handleResidentialProxyStatusRequest,
} from "./browser-automation-jobs.mjs";
import { handlePostCreatorServerRequest } from "./post-creator-server-jobs.mjs";

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
        if (
          !url.startsWith("/api/local-dominator/export-grid") &&
          !url.startsWith("/api/chatgpt-audit/") &&
          !url.startsWith("/api/browser-automation/") &&
          !url.startsWith("/api/post-creator/") &&
          url !== "/api/residential-proxy/status"
        ) {
          next();
          return;
        }
        const apiPath = url.slice(4);
        const handled =
          (await handleResidentialProxyStatusRequest(req, res, apiPath)) ||
          (await handleBrowserAutomationRequest(req, res, apiPath)) ||
          (await handleLocalDominatorExportRequest(req, res, apiPath)) ||
          (await handleChatGptAuditRequest(req, res, apiPath)) ||
          (await handlePostCreatorServerRequest(req, res, apiPath));
        if (!handled) next();
      });
    },
  };
}
