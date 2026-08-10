#!/usr/bin/env node
/**
 * Scan Flowbie PHP route handlers and emit docs/api markdown + _manifest.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLUGIN = path.join(ROOT, "wordpress-plugins/flowbie-app/includes");
const DOCS = path.join(ROOT, "docs/api");
const OVERRIDES = path.join(DOCS, "_overrides");

const HANDLER_PREFIX = {
  "auth/class-auth-route-handlers.php": "auth",
  "teams/class-teams-route-handlers.php": "teams",
  "chat/class-chat-route-handlers.php": "teams/{teamId}/chat",
  "tasks/class-tasks-route-handlers.php": "teams/{teamId}/tasks",
  "wordpress/class-wp-route-handlers.php": "wordpress",
  "gsc/class-gsc-route-handlers.php": "gsc",
  "ga/class-ga-route-handlers.php": "ga",
  "gmb/class-gmb-route-handlers.php": "gmb",
  "overview/class-overview-route-handlers.php": "overview",
  "dataforseo/class-dataforseo-route-handlers.php": "dataforseo",
  "semrush/class-semrush-route-handlers.php": "semrush",
  "proposal/class-proposal-route-handlers.php": "proposal",
  "seo/class-seo-route-handlers.php": "seo",
  "grid-local/class-grid-local-route-handlers.php": "grid-local",
  "vertical-benchmark/class-vertical-benchmark-route-handlers.php": "vertical-benchmarks",
  "site-scraper/class-site-scraper-route-handlers.php": "site-scraper",
  "knowledge-model/class-knowledge-model-route-handlers.php": "knowledge-model",
  "images/class-images-route-handlers.php": "images",
  "integrations/class-integrations-route-handlers.php": "integrations",
  "integrations/class-manager-route-handlers.php": null,
};

const SECTION_LABELS = {
  "getting-started": "Getting started",
  auth: "Authentication",
  teams: "Teams",
  wordpress: "WordPress",
  gsc: "Google Search Console",
  ga: "Google Analytics",
  gmb: "Google Business Profile",
  overview: "Overview",
  dataforseo: "DataForSEO",
  mcp: "DataForSEO MCP",
  semrush: "Semrush",
  proposal: "Proposal",
  seo: "SEO",
  "grid-local": "Grid Local",
  "vertical-benchmarks": "Vertical Benchmarks",
  "site-scraper": "Site Scraper",
  "knowledge-model": "Knowledge Model",
  images: "Images",
  integrations: "Integrations",
  "manager-cloud-settings": "Manager Cloud Settings",
  "manager-wordpress-properties": "Manager WordPress Properties",
  bulk: "Bulk",
  wikipedia: "Wikipedia",
  "entity-maps-image": "Entity Maps",
};

const SECTION_OVERVIEWS = [
  { sectionId: "auth", slug: "auth/overview", title: "Overview", order: 5 },
  { sectionId: "teams", slug: "teams/overview", title: "Overview", order: 5 },
  { sectionId: "wordpress", slug: "wordpress/overview", title: "Overview", order: 5 },
  { sectionId: "integrations", slug: "integrations/overview", title: "Overview", order: 5 },
];

/** @type {Array<{method:string,path:string,auth:string,title?:string,stream?:boolean}>} */
const routes = [];

/** @type {Map<string, { rel: string, fn: string }>} */
const routeHandlerMap = new Map();

/** @type {Map<string, string>} */
const handlerFileContents = new Map();

function addRoute(method, apiPath, auth = "open", extra = {}) {
  const key = `${method} ${apiPath}`;
  if (routes.some((r) => `${r.method} ${r.path}` === key)) return;
  routes.push({ method, path: apiPath, auth, ...extra });
}

function slugFromPath(apiPath) {
  return apiPath.replace(/\{[^}]+\}/g, (m) => m.slice(1, -1)).replace(/\//g, "/");
}

function fileSlug(apiPath) {
  return apiPath
    .replace(/\{teamId\}/g, "")
    .replace(/\{[^}]+\}/g, (m) => `by-${m.slice(1, -1)}`)
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "")
    .replace(/\//g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleFromSegment(seg) {
  return seg
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function titleFromPath(apiPath, method) {
  const parts = apiPath.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? apiPath;
  if (last.includes("{")) return `${method} ${apiPath}`;
  return titleFromSegment(last.replace(/\.[^.]+$/, ""));
}

function parseExactRoutes(content, prefix, subVar = "subpath", handlerRel = "") {
  const re = new RegExp(
    `\\$${subVar}\\s*===\\s*'([^']+)'\\s*&&\\s*\\$method\\s*===\\s*'([^']+)'`,
    "g",
  );
  let m;
  while ((m = re.exec(content)) !== null) {
    const sub = m[1];
    const method = m[2];
    const p = sub === "" ? prefix : `${prefix}/${sub}`;
    addRoute(method, p, authForPath(p));
    const tail = content.slice(m.index, m.index + 400);
    const fnMatch = tail.match(/self::([a-z_]+)\s*\(/);
    if (fnMatch && handlerRel) {
      routeHandlerMap.set(`${method} ${p}`, { rel: handlerRel, fn: fnMatch[1] });
    }
  }
}

function parsePregRoutes(content, prefix, subVar = "subpath", handlerRel = "") {
  const re = new RegExp(
    `preg_match\\(\\s*'#\\^([^#]+)\\$#'[^)]*\\$${subVar}[^)]*\\)\\s*(?:&&\\s*\\$method\\s*===\\s*'([^']+)')?`,
    "g",
  );
  let m;
  while ((m = re.exec(content)) !== null) {
    let pattern = m[1];
    const method = m[2] ?? "ANY";
    pattern = pattern
      .replace(/\\d\+/g, "{id}")
      .replace(/\(\[a-zA-Z0-9._-\]\+\)/g, "{filename}")
      .replace(/\(\[a-zA-Z0-9_-\]\+\)/g, "{filename}");
    const p = `${prefix}/${pattern}`.replace(/\/+/g, "/");
    if (method === "ANY") {
      for (const meth of ["GET", "POST", "PATCH", "DELETE"]) {
        if (content.includes(`$method === '${meth}'`) && content.includes(pattern)) {
          addRoute(meth, p, authForPath(p));
        }
      }
      addRoute("GET", p, authForPath(p));
      addRoute("POST", p, authForPath(p));
      addRoute("PATCH", p, authForPath(p));
      addRoute("DELETE", p, authForPath(p));
    } else {
      addRoute(method, p, authForPath(p));
      const tail = content.slice(m.index, m.index + 400);
      const fnMatch = tail.match(/self::([a-z_]+)\s*\(/);
      if (fnMatch && handlerRel) {
        routeHandlerMap.set(`${method} ${p}`, { rel: handlerRel, fn: fnMatch[1] });
      }
    }
  }
}

function authForPath(apiPath) {
  if (
    apiPath === "auth/login" ||
    apiPath === "auth/register" ||
    apiPath === "auth/bootstrap" ||
    apiPath === "auth/setup-admin" ||
    apiPath === "teams/invites/accept"
  ) {
    return "public";
  }
  if (apiPath.startsWith("auth/")) return "session";
  if (apiPath.includes("/chat/")) return "team-rbac-communication";
  if (apiPath.startsWith("teams/")) return "session-team";
  return "open";
}

function parseWordPressActions(content, handlerRel) {
  const re = /case\s+'([a-z0-9-]+)':/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    addRoute("POST", `wordpress/${m[1]}`, "open");
    addRoute("GET", `wordpress/${m[1]}`, "open");
  }
  void handlerRel;
}

function parseMcpTools(content) {
  const re = /'((?:DataForSEO_[a-zA-Z0-9_]+))'\s*=>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    addRoute("POST", `mcp/${m[1]}`, "open");
  }
  addRoute("POST", "mcp/DataForSEO_serp_google_ai_mode", "open");
}

function parseManagerHandlers(content, handlerRel) {
  const cloud = content.match(/function dispatch_cloud[\s\S]*?(?=function dispatch_properties)/);
  const props = content.match(/function dispatch_properties[\s\S]*$/);
  if (cloud) {
    parseExactRoutes(cloud[0], "manager-cloud-settings", "subpath", handlerRel);
  }
  if (props) {
    parseExactRoutes(props[0], "manager-wordpress-properties", "subpath", handlerRel);
  }
}

function scanHandlers() {
  for (const [rel, prefix] of Object.entries(HANDLER_PREFIX)) {
    const file = path.join(PLUGIN, rel);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    handlerFileContents.set(rel, content);
    if (rel.includes("manager-route")) {
      parseManagerHandlers(content, rel);
      continue;
    }
    if (rel.includes("wp-route")) {
      parseWordPressActions(content, rel);
      continue;
    }
    if (rel.includes("teams-route")) {
      addRoute("GET", "teams", "session");
      addRoute("POST", "teams", "session");
      addRoute("GET", "teams/invites/accept", "public");
      addRoute("GET", "teams/{teamId}", "session-team");
      addRoute("PATCH", "teams/{teamId}", "session-team");
      addRoute("DELETE", "teams/{teamId}", "session-team");
      parseExactRoutes(content, "teams/{teamId}", "sub", rel);
      parsePregRoutes(content, "teams/{teamId}", "sub", rel);
      parseExactRoutes(content, "teams", "route", rel);
      continue;
    }
    if (rel.includes("chat-route") || rel.includes("tasks-route")) {
      parseExactRoutes(content, prefix, "sub", rel);
      parsePregRoutes(content, prefix, "sub", rel);
      continue;
    }
    if (prefix) {
      parseExactRoutes(content, prefix, "subpath", rel);
      parsePregRoutes(content, prefix, "subpath", rel);
    }
  }

  const mcpFile = path.join(PLUGIN, "dataforseo/class-dataforseo-mcp-router.php");
  if (fs.existsSync(mcpFile)) parseMcpTools(fs.readFileSync(mcpFile, "utf8"));

  addRoute("GET", "dataforseo/serp-dump/{filename}", "open");
  addRoute("GET", "mcp/DataForSEO_serp_dump_download/{filename}", "open");
  addRoute("POST", "bulk/validate-internal-links", "open", { stream: true });
  addRoute("POST", "bulk/abort-dataforseo", "open");
  addRoute("GET", "wikipedia/api", "open");
  addRoute("POST", "entity-maps-image/generate", "open");
}

function extractFunctionBlock(content, fnName) {
  const re = new RegExp(`(?:private|public|protected)\\s+static\\s+function\\s+${fnName}\\s*\\([^)]*\\)[^{]*\\{`, "m");
  const match = re.exec(content);
  if (!match) return null;
  let i = match.index + match[0].length;
  let depth = 1;
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    i += 1;
  }
  return content.slice(match.index, i);
}

function extractDocblock(content, fnName) {
  const fnRe = new RegExp(`(?:private|public|protected)\\s+static\\s+function\\s+${fnName}\\s*\\(`, "m");
  const fnMatch = fnRe.exec(content);
  if (!fnMatch) return { summary: "", detail: "" };
  const before = content.slice(0, fnMatch.index);
  const all = [...before.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
  if (all.length === 0) return { summary: "", detail: "" };
  const raw = all[all.length - 1][1];
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l && !l.startsWith("@"));
  let summary = lines[0] ?? "";
  let detail = lines.slice(1).join(" ").trim();
  if (summary.startsWith("/api/") || summary.includes("route handlers") || detail.includes("function dispatch")) {
    summary = "";
    detail = "";
  }
  if (detail.length > 400) {
    detail = detail.slice(0, 397) + "...";
  }
  return { summary, detail };
}

function fieldToVar(name) {
  return name.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "") || name;
}

function extractBodyFields(block) {
  /** @type {Map<string, { name: string, required: boolean, description: string }>} */
  const fields = new Map();
  const re = /\$body\s*\[\s*['"]([\w]+)['"]\s*\]/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    if (!fields.has(m[1])) {
      fields.set(m[1], { name: m[1], required: false, description: "Request body field" });
    }
  }
  for (const field of fields.values()) {
    const varName = fieldToVar(field.name);
    const patterns = [
      new RegExp(`\\$${varName}\\s*===\\s*''`),
      new RegExp(`'${field.name}'[^\\n]*Missing`),
    ];
    if (patterns.some((p) => p.test(block))) {
      field.required = true;
    }
  }
  if (block.includes("Missing required fields") || block.includes("Missing email or password")) {
    for (const field of fields.values()) {
      if (["email", "password", "inviteToken", "token"].includes(field.name)) {
        field.required = true;
      }
    }
  }
  return [...fields.values()];
}

function extractErrors(block) {
  /** @type {Array<{ status: string, error: string }>} */
  const errors = [];
  const re = /send_json\s*\(\s*array\s*\(\s*'ok'\s*=>\s*false\s*,\s*'error'\s*=>\s*'([^']+)'[^)]*\)\s*,\s*(\d+)\s*\)/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    errors.push({ error: m[1], status: m[2] });
  }
  const re2 = /send_json\s*\(\s*array\s*\(\s*'ok'\s*=>\s*false\s*,\s*'error'\s*=>\s*'([^']+)'[^)]*\)\s*\)/g;
  while ((m = re2.exec(block)) !== null) {
    if (!errors.some((e) => e.error === m[1])) {
      errors.push({ error: m[1], status: "400" });
    }
  }
  return errors;
}

function extractResponseFields(block) {
  /** @type {Set<string>} */
  const keys = new Set();
  const matches = block.matchAll(/send_json\s*\(\s*array\s*\(([\s\S]*?)\)\s*(?:,\s*\d+\s*)?\)/g);
  for (const m of matches) {
    if (m[1].includes("'ok' => false") || m[1].includes("'success' => false")) continue;
    const keyRe = /'([\w]+)'\s*=>/g;
    let km;
    while ((km = keyRe.exec(m[1])) !== null) {
      keys.add(km[1]);
    }
  }
  return [...keys];
}

function analyzeRoute(route) {
  const key = `${route.method} ${route.path}`;
  const ref = routeHandlerMap.get(key);
  if (!ref) return null;
  const content = handlerFileContents.get(ref.rel);
  if (!content) return null;
  const block = extractFunctionBlock(content, ref.fn);
  if (!block) return null;
  const doc = extractDocblock(content, ref.fn);
  return {
    handlerFn: ref.fn,
    block,
    purpose: doc.summary,
    whenToUse: doc.detail,
    requestFields: extractBodyFields(block),
    responseFields: extractResponseFields(block),
    errors: extractErrors(block),
  };
}

function pathTail(apiPath) {
  const parts = apiPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? apiPath;
}

function pathTailLabel(apiPath) {
  const tail = pathTail(apiPath);
  if (tail.includes("{")) {
    const parts = apiPath.split("/").filter(Boolean);
    const parent = parts[parts.length - 2] ?? "resource";
    return `${titleFromSegment(parent).toLowerCase()} item`;
  }
  return titleFromSegment(tail).toLowerCase();
}

function extractInlineComment(block) {
  if (!block) return "";
  const head = block.slice(0, 900);
  for (const line of head.split("\n").slice(0, 14)) {
    const cm = line.match(/^\s*\/\/\s*(.{12,220})$/);
    if (cm && !cm[1].startsWith("@") && !cm[1].toLowerCase().includes("phpcs")) {
      return cm[1].trim();
    }
  }
  return "";
}

function overviewFromFunctionName(fn, route) {
  /** @type {Record<string, string>} */
  const known = {
    login:
      "Authenticates a user with email and password, sets the flowbie_session cookie, and returns basic profile fields.",
    logout: "Ends the current session and clears the flowbie_session cookie.",
    register: "Creates a user account from an invite token and signs the user in.",
    bootstrap: "Creates the first owner account when no users exist yet.",
    setup_admin: "Installs auth tables and creates the first agency owner on a fresh deploy.",
    classify_clients:
      "Classifies managed WordPress sites into vertical benchmark client tags using taxonomy rules and optional Gemini labeling via OpenRouter.",
    export_gsc_csv:
      "Builds a Google Search Console CSV export for vertical benchmark reporting across selected sites.",
  };
  if (known[fn]) return known[fn];

  const section = SECTION_LABELS[route.path.split("/")[0]] ?? titleFromSegment(route.path.split("/")[0]);
  const label = pathTailLabel(route.path);

  if (fn.startsWith("classify_")) {
    return `Classifies ${label} for ${section} using taxonomy rules and model-assisted tagging when configured.`;
  }
  if (fn.startsWith("export_")) {
    return `Exports ${label} data for ${section} workflows.`;
  }
  if (fn.startsWith("fetch_") || fn.startsWith("get_") || fn.startsWith("list_")) {
    return `Fetches ${label} from the ${section} API.`;
  }
  if (fn.startsWith("create_") || fn.startsWith("add_")) {
    return `Creates ${label} through the ${section} API.`;
  }
  if (fn.startsWith("update_") || fn.startsWith("patch_") || fn.startsWith("save_")) {
    return `Updates ${label} through the ${section} API.`;
  }
  if (fn.startsWith("delete_") || fn.startsWith("remove_")) {
    return `Removes ${label} through the ${section} API.`;
  }
  if (fn.startsWith("sync_")) {
    return `Synchronizes ${label} with external services in ${section}.`;
  }
  if (fn.startsWith("validate_")) {
    return `Validates ${label} and returns structured results from ${section}.`;
  }
  return "";
}

function genericOverview(route) {
  const section = SECTION_LABELS[route.path.split("/")[0]] ?? titleFromSegment(route.path.split("/")[0]);
  const label = pathTailLabel(route.path);
  const tail = pathTail(route.path);

  if (route.method === "GET") {
    if (tail.includes("{")) return `Fetches a single ${label} from the ${section} API.`;
    return `Reads ${label} from the ${section} API.`;
  }
  if (route.method === "POST") {
    if (route.path.includes("bulk")) return `Runs a bulk ${section.toLowerCase()} operation from a JSON request body.`;
    return `Runs the ${label} action in the ${section} API from a JSON request body.`;
  }
  if (route.method === "PATCH") return `Updates ${label} through the ${section} API.`;
  if (route.method === "DELETE") return `Removes ${label} through the ${section} API.`;
  return `Handles ${label} on the ${section} API.`;
}

function authOverviewNote(auth) {
  if (auth === "public") return "No existing session is required.";
  if (auth === "session") return "Requires a signed-in user with a valid flowbie_session cookie.";
  if (auth === "session-team") return "Requires a signed-in user who belongs to the team id in the path.";
  if (auth === "team-rbac-communication") {
    return "Requires a signed-in team member with communication permissions.";
  }
  return "";
}

function responseOverviewNote(analysis) {
  const keys = (analysis?.responseFields ?? []).filter((k) => !["ok", "success", "error"].includes(k));
  if (keys.length === 0) return "";
  if (keys.length === 1) return `On success, returns \`${keys[0]}\`.`;
  const shown = keys.slice(0, 4).map((k) => `\`${k}\``).join(", ");
  return `On success, returns ${shown}${keys.length > 4 ? ", and related fields" : ""}.`;
}

function buildOverview(route, analysis) {
  const sentences = [];

  if (analysis?.purpose) {
    sentences.push(analysis.purpose);
    if (analysis.whenToUse && !analysis.purpose.includes(analysis.whenToUse.slice(0, 24))) {
      sentences.push(analysis.whenToUse);
    }
  } else {
    const inline = extractInlineComment(analysis?.block);
    const fromFn = analysis?.handlerFn ? overviewFromFunctionName(analysis.handlerFn, route) : "";
    if (inline) sentences.push(inline);
    else if (fromFn) sentences.push(fromFn);
    else sentences.push(genericOverview(route));
  }

  const authNote = authOverviewNote(route.auth);
  if (authNote && !sentences.join(" ").toLowerCase().includes("session")) {
    sentences.push(authNote);
  }

  const respNote = responseOverviewNote(analysis);
  if (respNote && !sentences.join(" ").toLowerCase().includes("returns")) {
    sentences.push(respNote);
  }

  if (route.stream) {
    sentences.push("Streams progress as NDJSON instead of a single JSON object.");
  }

  return sentences.join(" ");
}

function tableRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function buildRequestTable(route, analysis) {
  if (route.method === "GET") {
    return tableRow(["_(none)_", "—", "—", "No JSON body for GET requests."]);
  }
  const fields = analysis?.requestFields ?? [];
  if (fields.length === 0) {
    return tableRow(["_(optional)_", "object", "no", "JSON body shape depends on the action."]);
  }
  return fields
    .map((f) =>
      tableRow([`\`${f.name}\``, "string", f.required ? "yes" : "no", f.description]),
    )
    .join("\n");
}

function buildResponseTable(analysis) {
  const keys = analysis?.responseFields ?? [];
  if (keys.length === 0) {
    return tableRow(["`success` / `ok`", "boolean", "Operation status when present"]) + "\n" +
      tableRow(["`error`", "string", "Error message on failure"]);
  }
  return keys
    .map((k) => tableRow([`\`${k}\``, "varies", "See handler response."]))
    .join("\n");
}

function buildErrorTable(analysis) {
  const errors = analysis?.errors ?? [];
  if (errors.length === 0) {
    return tableRow(["4xx/5xx", "varies", "See HTTP status and `error` field in body."]);
  }
  return errors
    .map((e) => tableRow([e.status, `\`${e.error}\``, "Returned when validation or auth fails."]))
    .join("\n");
}

function exampleJson(route, analysis) {
  const fields = analysis?.requestFields?.filter((f) => f.required) ?? [];
  if (fields.length === 0) return "{}";
  const obj = {};
  for (const f of fields) {
    if (f.name === "email") obj.email = "you@example.com";
    else if (f.name === "password") obj.password = "your-password";
    else if (f.name === "inviteToken") obj.inviteToken = "invite-token";
    else if (f.name === "displayName") obj.displayName = "Your Name";
    else if (f.name === "teamName") obj.teamName = "My Agency";
    else if (f.name === "jobTitle") obj.jobTitle = "Lead SEO";
    else if (f.name === "setupKey") obj.setupKey = "your-setup-key";
    else obj[f.name] = "...";
  }
  return JSON.stringify(obj, null, 2);
}

function scaffoldBody(route) {
  const analysis = analyzeRoute(route);
  const overview = buildOverview(route, analysis);
  const streamNote = route.stream
    ? "\n\n## Notes\n\nReturns `application/x-ndjson`. Read line-delimited JSON objects from the response body.\n"
    : "";

  const exampleBody = exampleJson(route, analysis);
  const hasBody = route.method !== "GET";

  return `${route.method} \`/api/${route.path}\`.

${overview}

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
${buildRequestTable(route, analysis)}

## Response

| Field | Type | Description |
| --- | --- | --- |
${buildResponseTable(analysis)}

## Errors

| Status | error | Cause |
| --- | --- | --- |
${buildErrorTable(analysis)}

## Example

\`\`\`bash
curl -X ${route.method} "https://flowbie.ca/api/${route.path}" \\
  -H "Content-Type: application/json" \\${hasBody ? `\n  -d '${exampleBody.replace(/\n/g, " ")}'` : ""}
\`\`\`

\`\`\`javascript
const res = await fetch(\`/api/${route.path}\`, {
  method: "${route.method}",
  credentials: "include",
  headers: { "Content-Type": "application/json" },${hasBody ? `\n  body: JSON.stringify(${exampleBody}),` : ""}
});
const data = await res.json();
\`\`\`
${streamNote}`;
}

function writeScaffold(route, order) {
  const slug = slugFromPath(route.path);
  const sectionKey = slug.split("/")[0];
  const title = route.title ?? titleFromPath(route.path, route.method);

  const overridePath = path.join(OVERRIDES, `${slug}.md`);
  if (fs.existsSync(overridePath)) {
    return overridePath;
  }

  const fm = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `slug: ${slug}`,
    `section: ${SECTION_LABELS[sectionKey] ?? titleFromSegment(sectionKey)}`,
    `method: ${route.method}`,
    `path: /api/${route.path}`,
    `auth: ${route.auth}`,
    `order: ${order}`,
    "---",
    "",
    scaffoldBody(route),
  ].join("\n");

  const dir = path.join(DOCS, ...slug.split("/").slice(0, -1));
  const base = fileSlug(route.path) || slug.replace(/\//g, "-");
  const fname = `${base}.md`;
  const full = path.join(dir || DOCS, fname);

  if (fs.existsSync(full)) {
    const existing = fs.readFileSync(full, "utf8");
    if (existing.includes("<!-- manual -->")) return full;
    const manualBlock = existing.match(/<!-- manual -->[\s\S]*/);
    if (manualBlock) {
      fs.writeFileSync(full, fm + "\n\n" + manualBlock[0]);
      return full;
    }
  }

  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, fm);
  return full;
}

function buildManifest() {
  /** @type {Record<string, {slug:string,title:string,method?:string,path?:string,auth?:string,order:number}[]>} */
  const sections = {};

  for (const route of routes.sort((a, b) => a.path.localeCompare(b.path))) {
    const slug = slugFromPath(route.path);
    const sectionKey = slug.split("/")[0];
    if (!sections[sectionKey]) sections[sectionKey] = [];
    sections[sectionKey].push({
      slug,
      title: route.title ?? titleFromPath(route.path, route.method),
      method: route.method,
      path: `/api/${route.path}`,
      auth: route.auth,
      order: sections[sectionKey].length * 10 + 10,
    });
  }

  for (const ov of SECTION_OVERVIEWS) {
    const overviewFile = path.join(DOCS, ...ov.slug.split("/")) + ".md";
    if (!fs.existsSync(overviewFile)) continue;
    if (!sections[ov.sectionId]) sections[ov.sectionId] = [];
    if (!sections[ov.sectionId].some((i) => i.slug === ov.slug)) {
      sections[ov.sectionId].unshift({
        slug: ov.slug,
        title: ov.title,
        order: ov.order,
      });
    }
  }

  const manualSections = [
    {
      id: "getting-started",
      label: "Getting started",
      items: [
        { slug: "getting-started", title: "Introduction", order: 0 },
        { slug: "getting-started/authentication", title: "Authentication", order: 10 },
        { slug: "getting-started/errors", title: "Errors", order: 20 },
        { slug: "getting-started/streaming", title: "Streaming responses", order: 30 },
        { slug: "getting-started/client-library", title: "Building a client library", order: 40 },
      ],
    },
    {
      id: "god-mode",
      label: "God Mode",
      items: [
        { slug: "god-mode/overview", title: "Overview", order: 0 },
        { slug: "god-mode/feature-index", title: "Feature index", order: 5 },
        { slug: "god-mode/ask-plan-build", title: "Ask / Plan / Build", order: 10 },
        { slug: "god-mode/tools", title: "Tools reference", order: 20 },
        { slug: "god-mode/body-ops", title: "Body operations", order: 30 },
        { slug: "god-mode/endpoints", title: "Endpoints", order: 40 },
      ],
    },
  ];

  const apiSections = Object.keys(sections)
    .sort()
    .map((id) => ({
      id,
      label: SECTION_LABELS[id] ?? titleFromSegment(id),
      items: sections[id].sort((a, b) => a.order - b.order),
    }));

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    routeCount: routes.length,
    sections: [...manualSections, ...apiSections],
  };

  fs.writeFileSync(path.join(DOCS, "_manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

function main() {
  fs.mkdirSync(DOCS, { recursive: true });
  fs.mkdirSync(OVERRIDES, { recursive: true });
  routes.length = 0;
  routeHandlerMap.clear();
  handlerFileContents.clear();
  scanHandlers();

  routes.sort((a, b) => {
    const c = a.path.localeCompare(b.path);
    return c !== 0 ? c : a.method.localeCompare(b.method);
  });

  const written = [];
  routes.forEach((route, i) => {
    written.push(writeScaffold(route, (i + 1) * 10));
  });

  const manifest = buildManifest();
  console.log(`Generated ${routes.length} API route docs in docs/api/`);
  console.log(`Manifest: ${manifest.sections.length} sections`);
}

main();
