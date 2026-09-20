import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import SftpClient from "ssh2-sftp-client";

const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
    "diffie-hellman-group14-sha1",
  ],
};

export function neodigitalCatalogRow() {
  const catalogPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../wordpress-plugins/.deploy/wpengine-sftp-catalog.json",
  );
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
  if (!site) throw new Error("No neodigital.ca production catalog row");
  return site;
}

/**
 * Upload a one-shot PHP file, GET it, parse JSON, remote file unlinks itself.
 * @param {string} phpInner Body after the token/wp-load bootstrap.
 * @param {string} remoteBase File stem under wp-content/plugins/neo-pulse-wp/
 */
export async function uploadNeodigitalPhp(phpInner, remoteBase) {
  const site = neodigitalCatalogRow();
  const token = randomBytes(16).toString("hex");
  const php = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;
${phpInner}
@unlink( __FILE__ );
`;
  const tmpDir = join(dirname(fileURLToPath(import.meta.url)), "../../wordpress-plugins/.deploy/neodigital-flush");
  mkdirSync(tmpDir, { recursive: true });
  const localPhp = join(tmpDir, `${remoteBase}.php`);
  writeFileSync(localPhp, php, "utf8");
  const remote = `./wp-content/plugins/neo-pulse-wp/${remoteBase}.php`;
  const sftp = new SftpClient();
  await sftp.connect({
    host: site.host,
    port: site.port,
    username: site.username,
    password: site.password,
    readyTimeout: 45000,
    algorithms: ALGOS,
  });
  await sftp.put(localPhp, remote);
  await sftp.end();
  unlinkSync(localPhp);
  return {
    token,
    url: `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/${remoteBase}.php?key=${token}`,
  };
}

export async function runNeodigitalPhp(phpInner, remoteBase) {
  const { url } = await uploadNeodigitalPhp(phpInner, remoteBase);
  const { openProxiedSession, proxiedGetText } = await import("../firstrank-teardown/lib.mjs");
  const session = await openProxiedSession();
  let text;
  try {
    text = await proxiedGetText(session.page, url);
  } finally {
    await session.browser.close();
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`oneshot ${remoteBase}: ${String(text).slice(0, 400)}`);
  }
  if (parsed.error) {
    throw new Error(`oneshot ${remoteBase}: ${parsed.error}`);
  }
  return parsed;
}
