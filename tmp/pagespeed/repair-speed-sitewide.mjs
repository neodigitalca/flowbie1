/**
 * neodigital.ca: skip Speed for logged-in users, purge HTML caches, list public URLs.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import SftpClient from "ssh2-sftp-client";
import { neodigitalCatalogRow, uploadNeodigitalPhp } from "../../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const MISSING = [
  "bc79f1542aa02f26e4a8b434c5c14bce",
  "df8c486568f4433810545ed91d3adc78",
];

const phpInner = `
try {
  $config = Neo_Pulse_Wp_Speed_Settings::get_config();
  $before = array(
    'enabled' => ! empty( $config['enabled'] ),
    'optimize_css' => ! empty( $config['optimize_css'] ),
    'optimize_js' => ! empty( $config['optimize_js'] ),
    'skip_logged_in' => ! empty( $config['skip_logged_in'] ),
    'bypass_elementor' => ! empty( $config['bypass_elementor'] ),
  );
  $config['skip_logged_in'] = true;
  Neo_Pulse_Wp_Speed_Settings::save_config( $config );
  $after = Neo_Pulse_Wp_Speed_Settings::get_config();
  $cache_dir = Neo_Pulse_Wp_Speed_Cache::cache_dir();
  $hashes = array();
  foreach ( array( 'bc79f1542aa02f26e4a8b434c5c14bce', 'df8c486568f4433810545ed91d3adc78' ) as $h ) {
    $hashes[ $h ] = is_readable( $cache_dir . '/css/' . $h . '.css' );
  }
  $purged = array();
  if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush', false ) ) {
    try {
      $purged = Neo_Pulse_Wp_Cache_Flush::purge_html_caches();
    } catch ( Throwable $purgeErr ) {
      $purged = array( 'purge_error' => $purgeErr->getMessage() );
    }
  }
  $urls = array( home_url( '/' ) );
  foreach ( get_posts( array( 'post_type' => array( 'page', 'post' ), 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids' ) ) as $id ) {
    $u = get_permalink( (int) $id );
    if ( is_string( $u ) && $u !== '' ) {
      $urls[] = $u;
    }
  }
  echo wp_json_encode( array(
    'before' => $before,
    'after_skip_logged_in' => ! empty( $after['skip_logged_in'] ),
    'hashes' => $hashes,
    'stats' => Neo_Pulse_Wp_Speed_Cache::stats(),
    'purged' => $purged,
    'urls' => array_values( array_unique( $urls ) ),
  ) );
} catch ( Throwable $e ) {
  echo wp_json_encode( array( 'error' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine() ) );
}
`;

const site = neodigitalCatalogRow();
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: {
    serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
    kex: [
      "curve25519-sha256",
      "ecdh-sha2-nistp256",
      "diffie-hellman-group14-sha256",
      "diffie-hellman-group-exchange-sha256",
      "diffie-hellman-group14-sha1",
    ],
  },
});
let cssFiles = [];
try {
  cssFiles = await sftp.list("./wp-content/cache/neo-pulse-speed/css");
} catch (err) {
  console.log("sftp css list", String(err).slice(0, 160));
}
await sftp.end();

const listed = (cssFiles || []).filter((f) => f.type === "-" && f.name.endsWith(".css")).map((f) => f.name);
console.log("disk_css", listed.length);
for (const hash of MISSING) {
  console.log("disk", hash, listed.includes(`${hash}.css`) ? "present" : "MISSING");
}

const { url } = await uploadNeodigitalPhp(phpInner, "nd-speed-sitewide-repair");
const res = await fetch(url, { cache: "no-store" });
const text = await res.text();
console.log("repair_http", res.status);
if (res.status !== 200) {
  console.log("repair_body", text.slice(0, 800));
  process.exit(1);
}
const result = JSON.parse(text);
const out = join(import.meta.dirname, "sitewide-repair.json");
writeFileSync(out, JSON.stringify(result, null, 2), "utf8");
console.log("before", result.before);
console.log("skip_logged_in", result.after_skip_logged_in);
console.log("hashes", result.hashes);
console.log("stats", result.stats);
console.log("purged", result.purged);
console.log("urls", Array.isArray(result.urls) ? result.urls.length : 0);
if (Array.isArray(result.urls)) {
  for (const pageUrl of result.urls) console.log("URL", pageUrl);
}
