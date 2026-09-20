/**
 * Call NitroPack PurgeCache APIs on neodigital.ca.
 */
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
const token = randomBytes(16).toString("hex");
const flushPhp = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;
$cls = 'NitroPack\\\\WordPress\\\\Settings\\\\PurgeCache';
if ( class_exists( $cls ) ) {
  $methods = get_class_methods( $cls );
  echo 'purge_methods=' . implode( ',', is_array( $methods ) ? $methods : array() ) . "\\n";
  foreach ( array( 'purge', 'purge_cache', 'purgeCache', 'handle', 'run' ) as $m ) {
    if ( is_callable( array( $cls, $m ) ) ) {
      echo 'call=' . $m . "\\n";
      $cls::$m();
    }
  }
}
$np = 'NitroPack\\\\WordPress\\\\NitroPack';
if ( class_exists( $np ) && method_exists( $np, 'getInstance' ) ) {
  $inst = $np::getInstance();
  echo 'np_inst=' . ( is_object( $inst ) ? get_class( $inst ) : 'no' ) . "\\n";
  if ( is_object( $inst ) ) {
    foreach ( array( 'purgeCache', 'invalidateCache', 'clearCache', 'purge' ) as $m ) {
      if ( method_exists( $inst, $m ) ) {
        echo 'inst_call=' . $m . "\\n";
        $inst->$m();
      }
    }
    if ( method_exists( $inst, 'getSdk' ) ) {
      $sdk = $inst->getSdk();
      echo 'sdk=' . ( is_object( $sdk ) ? get_class( $sdk ) : 'no' ) . "\\n";
      if ( is_object( $sdk ) ) {
        foreach ( array( 'purgeCache', 'invalidateCache', 'clearCache' ) as $m ) {
          if ( method_exists( $sdk, $m ) ) {
            echo 'sdk_call=' . $m . "\\n";
            $sdk->$m();
          }
        }
      }
    }
  }
}
echo "done\\n";
@unlink( __FILE__ );
`;

const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localFlush = join(tmpDir, "nd-nitropack-flush2.php");
writeFileSync(localFlush, flushPhp, "utf8");

const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: {
    serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
    kex: ["curve25519-sha256", "ecdh-sha2-nistp256", "diffie-hellman-group14-sha256", "diffie-hellman-group-exchange-sha256", "diffie-hellman-group14-sha1"],
  },
});
await sftp.put(localFlush, "./wp-content/plugins/neo-pulse-wp/nd-nitropack-flush2.php");
await sftp.end();

const res = await fetch(`https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-nitropack-flush2.php?key=${token}`, { cache: "no-store" });
console.log(res.status);
console.log((await res.text()).trim());
