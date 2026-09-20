/**
 * SFTP: noindex Elementor ?e-page- URLs and block them in robots.txt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import SftpClient from "ssh2-sftp-client";
import { runNeodigitalPhp } from "../../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
if (!site) throw new Error("No neodigital.ca production catalog row");

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

const muLocal = join(import.meta.dirname, "neodigital-epage/nd-elementor-epage-noindex.php");
const muRemote = "./wp-content/mu-plugins/nd-elementor-epage-noindex.php";

const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});

const physicalRobots = await sftp.exists("./robots.txt");
const muDir = "./wp-content/mu-plugins";
if (!(await sftp.exists(muDir))) {
  await sftp.mkdir(muDir, true);
}
await sftp.put(muLocal, muRemote);
console.log("mu-plugin put", muRemote, "physical_robots", Boolean(physicalRobots));
await sftp.end();

const result = await runNeodigitalPhp(
  `
$rule = 'Disallow: /*?*e-page-';
$physical = is_readable( ABSPATH . 'robots.txt' );
if ( ! class_exists( 'Neo_Pulse_Wp_Robots_Txt' ) ) {
  echo wp_json_encode( array( 'error' => 'robots class missing', 'physical' => $physical ) );
  return;
}
$before = Neo_Pulse_Wp_Robots_Txt::get_content();
if ( $before === '' ) {
  $before = Neo_Pulse_Wp_Robots_Txt::default_content();
}
$after = $before;
if ( stripos( $after, 'e-page-' ) === false ) {
  $lines = explode( "\\n", $after );
  $out = array();
  $inserted = false;
  foreach ( $lines as $line ) {
    if ( ! $inserted && stripos( ltrim( $line ), 'Sitemap:' ) === 0 ) {
      $out[] = $rule;
      $inserted = true;
    }
    $out[] = $line;
  }
  if ( ! $inserted ) {
    $out[] = $rule;
  }
  $after = implode( "\\n", $out );
  Neo_Pulse_Wp_Robots_Txt::save_content( $after );
}
if ( function_exists( 'wp_cache_flush' ) ) {
  wp_cache_flush();
}
if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush' ) ) {
  Neo_Pulse_Wp_Cache_Flush::flush_all();
}
$np = 'NitroPack\\\\WordPress\\\\NitroPack';
if ( class_exists( $np ) && method_exists( $np, 'getInstance' ) ) {
  $inst = $np::getInstance();
  if ( is_object( $inst ) && method_exists( $inst, 'getSdk' ) ) {
    $sdk = $inst->getSdk();
    if ( is_object( $sdk ) && method_exists( $sdk, 'invalidateCache' ) ) {
      $sdk->invalidateCache();
    }
    if ( is_object( $sdk ) && method_exists( $sdk, 'purgeCache' ) ) {
      $sdk->purgeCache();
    }
  }
}
if ( class_exists( 'WpeCommon' ) ) {
  if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) {
    WpeCommon::purge_memcached();
  }
  if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) {
    WpeCommon::purge_varnish_cache();
  }
}
echo wp_json_encode( array(
  'ok' => true,
  'physical' => $physical,
  'before' => $before,
  'after' => Neo_Pulse_Wp_Robots_Txt::get_content(),
) );
`,
  "nd-epage-robots-once",
);

console.log(JSON.stringify(result, null, 2));
