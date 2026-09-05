import { randomBytes } from "crypto";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";
import { loadProductionSites } from "../deploy/lib/csv-sites.js";

const dir = join(import.meta.dirname, "..");
const csvPath = join(dir, "Customer List", "SFTP Users_Clients List.csv");
const kwb = loadProductionSites(csvPath).find((s) => s.site === "kwbllp.com");
if (!kwb) {
  console.error("kwbllp.com missing");
  process.exit(1);
}

const token = randomBytes(16).toString("hex");
const php = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 6; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); exit('wp-load missing'); }
require_once $wp_load;
header('Content-Type: text/plain; charset=utf-8');
if ( class_exists( 'Neo_Pulse_Wp_Search' ) ) {
  Neo_Pulse_Wp_Search::purge_public_caches();
}
if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush' ) ) {
  Neo_Pulse_Wp_Cache_Flush::flush_all();
}
if ( function_exists( 'wp_cache_flush' ) ) { wp_cache_flush(); }
if ( class_exists( 'WpeCommon' ) ) {
  if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) { WpeCommon::purge_memcached(); }
  if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) { WpeCommon::purge_varnish_cache(); }
}
echo "flushed\\n";
echo "version=" . ( defined('NEO_PULSE_WP_VERSION') ? NEO_PULSE_WP_VERSION : 'unknown' ) . "\\n";
@unlink( __FILE__ );
`;

const tmpDir = join(dir, "..", ".cursor-kwb-patch");
mkdirSync(tmpDir, { recursive: true });
const localPhp = join(tmpDir, "kwb-flush-once.generated.php");
writeFileSync(localPhp, php, "utf8");

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

const sftp = new SftpClient();
await sftp.connect({
  host: kwb.host,
  port: kwb.port,
  username: kwb.username,
  password: kwb.password,
  readyTimeout: 30000,
  algorithms: ALGOS,
});
await sftp.put(localPhp, "./wp-content/plugins/neo-pulse-wp/kwb-flush-once.php");
await sftp.end();

const flushUrl = `https://kwbllp.com/wp-content/plugins/neo-pulse-wp/kwb-flush-once.php?key=${token}`;
const flushRes = await fetch(flushUrl);
const flushText = await flushRes.text();
console.log("flush", flushRes.status, flushText.trim());

const home = await fetch(`https://kwbllp.com/?npflush=${Date.now()}`, {
  headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  redirect: "follow",
});
const html = await home.text();
writeFileSync(join(tmpDir, "kwb-home-after.html"), html);
const headingAt = html.indexOf("fai-sidebar-heading");
const searchAt = html.indexOf("fbs__sidebar-search");
const resultsAt = html.indexOf("fbs__sidebar-query-scroll");
const insightsAt = html.indexOf("fbs__sidebar-insights");
const checks = {
  heading: headingAt > 0,
  insights: html.includes("fbs__sidebar-insights"),
  popular_topics: html.includes('data-insight="popular_topics"'),
  popular_terms: html.includes('data-insight="popular_terms"'),
  overseer_attr: html.includes("data-show-popular-pages-overseer"),
  terms_attr: html.includes("data-show-popular-terms"),
  results_after_search: searchAt > 0 && resultsAt > searchAt,
  insights_after_results: insightsAt > resultsAt && resultsAt > 0,
  version_133: html.includes("0.9.133") || html.includes("neo-pulse-search.js?ver=0.9.133"),
};
console.log("home", home.status, checks);

const nonce = html.match(/data-nonce="([^"]+)"/)?.[1] || "";
if (nonce) {
  const insights = await fetch(
    `https://kwbllp.com/wp-json/neo-pulse/v1/search/insights?days=30&limit=5`,
    { headers: { "X-WP-Nonce": nonce } },
  );
  const body = await insights.text();
  console.log("insights api", insights.status, body.slice(0, 500));
}
