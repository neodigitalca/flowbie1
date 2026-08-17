import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {Record<string, { script: string, requiredEnv: string[], jsonArgs?: string[] }>} */
export const researchJobs = {
  local_dominator_export: {
    script: path.join(__dirname, "local-dominator", "export-grid.mjs"),
    requiredEnv: ["LOCAL_DOMINATOR_EMAIL", "LOCAL_DOMINATOR_PASSWORD"],
    jsonArgs: ["--json"],
  },
};

export function getResearchJob(jobKey) {
  const key = String(jobKey ?? "").trim();
  const job = researchJobs[key];
  if (!job) {
    throw new Error(`Unknown research job key: ${key}`);
  }
  return job;
}
