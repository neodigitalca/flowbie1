import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CHANGELOG_CLIENT_FOLDER,
  EMPTY_WEEK_MESSAGE,
  REPO_NAME,
  TEAM_SHARED_DRIVE_FOLDER_ID,
  changelogDriveLabel,
  changelogDriveSegments,
  changelogFileName,
  collectCommits,
  weekWindow,
} from "./lib/repo-changelog-collect.mjs";
import { renderChangelogMarkdown, writeChangelogDoc } from "./lib/repo-changelog-openrouter.mjs";

const DEFAULT_API_BASE = "https://neodigital.ca/app/api";

export function requireEnv(name, env = process.env) {
  const value = String(env[name] ?? "").trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function resolveApiBase(env = process.env) {
  const raw = String(env.NEO_PULSE_API_BASE ?? "").trim() || DEFAULT_API_BASE;
  return raw.replace(/\/+$/, "");
}

async function readJson(res) {
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Non-JSON ${res.status}: ${raw.slice(0, 200)}`);
  }
  return data;
}

export async function loginNeoPulse(env = process.env, fetchImpl = fetch) {
  const apiBase = resolveApiBase(env);
  const username = requireEnv("NEO_PULSE_USERNAME", env);
  const password = requireEnv("NEO_PULSE_PASSWORD", env);
  const res = await fetchImpl(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ username, email: username, password }),
  });
  const data = await readJson(res);
  const token = String(data.sessionToken ?? "").trim();
  if (!res.ok || !data.ok || !token) {
    throw new Error(`Login failed: ${data.error ?? res.statusText ?? res.status}`);
  }
  return { apiBase, token };
}

export async function neoPulsePost(session, pathname, body, fetchImpl = fetch) {
  const res = await fetchImpl(`${session.apiBase}${pathname}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? `${pathname} failed (${res.status})`);
  }
  return data;
}

export async function resolveChangelogFolder(session, date = new Date(), fetchImpl = fetch) {
  const segments = changelogDriveSegments(date);
  const data = await neoPulsePost(
    session,
    "/google-mcp/resolve-folder-path",
    {
      rootFolderId: TEAM_SHARED_DRIVE_FOLDER_ID,
      segments,
      createMissing: true,
    },
    fetchImpl,
  );
  const folderId = String(data.folderId ?? "").trim();
  if (folderId.length < 10) {
    throw new Error("resolve-folder-path did not return folderId");
  }
  return {
    folderId,
    label: changelogDriveLabel(date),
    webViewLink: String(data.webViewLink ?? "").trim(),
    segments,
  };
}

export async function uploadChangelogDoc(session, input, fetchImpl = fetch) {
  const data = await neoPulsePost(
    session,
    "/google-mcp/upload-deliverable",
    {
      fileName: input.fileName,
      content: input.content,
      folderId: input.folderId,
      mime: "text/markdown",
      convertToGoogleDoc: true,
    },
    fetchImpl,
  );
  const webViewLink = String(data.webViewLink ?? "").trim();
  if (!webViewLink) {
    throw new Error("upload-deliverable did not return webViewLink");
  }
  return {
    fileId: String(data.fileId ?? data.id ?? "").trim(),
    name: String(data.name ?? input.fileName).trim(),
    webViewLink,
  };
}

export async function publishRepoChangelog(options = {}) {
  const log = options.log ?? console.log;
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const collect = options.collect ?? collectCommits;
  const writeDoc = options.writeDoc ?? writeChangelogDoc;

  const commits = collect({ cwd: options.cwd });
  if (commits.length === 0) {
    log(EMPTY_WEEK_MESSAGE);
    return { skipped: true, reason: "empty-week" };
  }

  const { weekStart, weekEnd } = weekWindow(now);
  const doc = await writeDoc({
    apiKey: requireEnv("OPENROUTER_API_KEY", env),
    repoName: REPO_NAME,
    weekStart,
    weekEnd,
    commits,
  });
  const content = renderChangelogMarkdown(doc);
  const fileName = changelogFileName(weekEnd);
  const session = await loginNeoPulse(env, fetchImpl);
  const folder = await resolveChangelogFolder(session, now, fetchImpl);
  const uploaded = await uploadChangelogDoc(
    session,
    { fileName, content, folderId: folder.folderId },
    fetchImpl,
  );
  log(uploaded.webViewLink);
  return {
    skipped: false,
    fileName,
    folderLabel: folder.label,
    clientFolder: CHANGELOG_CLIENT_FOLDER,
    segments: folder.segments,
    webViewLink: uploaded.webViewLink,
    fileId: uploaded.fileId,
  };
}

async function main() {
  const result = await publishRepoChangelog();
  if (result.skipped) {
    process.exit(0);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
