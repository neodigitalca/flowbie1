import { readFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../wordpress-plugins/.deploy/wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
const php = `<?php
/**
 * Plugin Name: NEO Pulse one-shot cache flush
 */
add_action( 'init', static function () {
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
	@unlink( __FILE__ );
}, 0 );
`;

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
    ],
  },
});
const remote = "./wp-content/mu-plugins/neo-pulse-flush-once.php";
await sftp.put(Buffer.from(php, "utf8"), remote);
console.log("uploaded", remote);
await sftp.end();
