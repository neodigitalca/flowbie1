/**
 * Verify Google Drive delivery resolve picks Reporting/Year/Month, not client root.
 *
 * Usage: node scripts/verify-delivery-subfolder-resolve.mjs
 */
import fs from "node:fs";
import path from "node:path";

const API_BASE = (process.env.VERIFY_APP_BASE ?? "http://localhost:8080").replace(/\/+$/, "") + "/api";
const loginPath = path.join(process.cwd(), ".cursor-tmp-login.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function api(pathname, { token, body } = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function main() {
  const { email, password } = readJson(loginPath);
  const login = await api("/auth/login", { body: { username: email, email, password } });
  if (!login.data.sessionToken) throw new Error(`Login failed: ${login.data.error ?? login.res.status}`);
  const token = login.data.sessionToken;

  const advanceBlindsClientRoot = "1ykfW8uMfv0jFP1YOUbNYdvuTBEcOB9n7";

  const manual = await api("/google-mcp/resolve-folder-path", {
    token,
    body: {
      deliveryResolve: true,
      siteName: "Advance Blinds",
      siteUrl: "https://advanceblinds.ca",
      googleDriveFolderSource: "manual",
      googleDriveFolderId: advanceBlindsClientRoot,
      googleDriveFolderLabel: "Advance Blinds",
      googleDriveFolderPath: "reporting",
      executionKind: "gsc_reporting",
    },
  });
  if (!manual.res.ok || !manual.data.folderId) {
    throw new Error(`Manual delivery resolve failed: ${JSON.stringify(manual.data).slice(0, 400)}`);
  }

  const pathMode = await api("/google-mcp/resolve-folder-path", {
    token,
    body: {
      deliveryResolve: true,
      siteName: "Advance Blinds",
      siteUrl: "https://advanceblinds.ca",
      googleDriveFolderSource: "path",
      googleDriveFolderPath: "reporting",
      executionKind: "gsc_reporting",
    },
  });
  if (!pathMode.res.ok || !pathMode.data.folderId) {
    throw new Error(`Path delivery resolve failed: ${JSON.stringify(pathMode.data).slice(0, 400)}`);
  }

  const manualFolderId = String(manual.data.folderId);
  const pathFolderId = String(pathMode.data.folderId);
  const clientRoot = advanceBlindsClientRoot;

  if (manualFolderId === clientRoot) {
    throw new Error(`Manual resolve returned client root (${clientRoot}) instead of Reporting subfolder`);
  }
  if (pathFolderId === clientRoot) {
    throw new Error(`Path resolve returned client root (${clientRoot}) instead of Reporting subfolder`);
  }

  const label = String(manual.data.label ?? "");
  if (!/Reporting/i.test(label) || !/2026/i.test(label)) {
    throw new Error(`Expected Reporting/2026 in label, got: ${label}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        manual: {
          folderId: manualFolderId,
          label: manual.data.label,
          webViewLink: manual.data.webViewLink,
        },
        path: {
          folderId: pathFolderId,
          label: pathMode.data.label,
          webViewLink: pathMode.data.webViewLink,
        },
        clientRoot,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
