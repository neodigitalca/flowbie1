import {
  handleDataForSeoLlmResponsesLive,
  isLlmResponsesLiveRequest,
  loadDataForSeoAuth,
} from "./dataforseo-llm-responses-direct.mjs";

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Fallback when local WP proxy plugin is off; localWpApiProxyPlugin handles this path first when enabled. */
export function dataforseoLlmResponsesDevPlugin() {
  const auth = loadDataForSeoAuth();
  return {
    name: "dataforseo-llm-responses-dev",
    enforce: "pre",
    configureServer(server) {
      if (!auth) return;
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        if (!isLlmResponsesLiveRequest(req.method, path)) {
          next();
          return;
        }
        try {
          const raw = await readRequestBody(req);
          const result = await handleDataForSeoLlmResponsesLive(raw, auth);
          res.statusCode = result.status;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(result.json));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "DataForSEO LLM request failed",
            }),
          );
        }
      });
    },
  };
}
