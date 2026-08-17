import { basename } from "path";

const SECRET_BASENAMES = new Set([
  "neo-pulse-app-secrets.php",
  "neo-pulse-wp-secrets.php",
  "neo-pulse-wp-gsc-config.php",
  ".env",
]);

/** @param {string} rel Posix-style relative path */
export function isSecretRelPath(rel) {
  const norm = rel.replace(/\\/g, "/");
  const base = basename(norm);
  if (SECRET_BASENAMES.has(base)) return true;
  if (base.startsWith(".env")) return true;
  if (base.includes("-credentials") && base.endsWith(".json")) return true;
  if (base.endsWith(".credentials.json")) return true;
  if (base === "gsc-config.local.js") return true;
  return false;
}

/** Fail fast when a zip/deploy would include local credential files. */
export function assertNoSecretsInFiles(files, label = "build") {
  const leaked = files.filter((f) => isSecretRelPath(f.rel));
  if (leaked.length === 0) return;
  const paths = leaked.map((f) => f.rel).join(", ");
  throw new Error(
    `${label} would include credential files (${paths}). Remove them from the source tree or update secret-excludes.js.`
  );
}
