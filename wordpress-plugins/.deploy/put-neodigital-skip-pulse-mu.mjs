import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
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
const php = `<?php
/**
 * Temporarily skip NEO Pulse App while its loader bytecode is stale.
 */
add_filter(
	'option_active_plugins',
	static function ( $plugins ) {
		if ( ! is_array( $plugins ) ) {
			return $plugins;
		}
		return array_values(
			array_filter(
				$plugins,
				static function ( $p ) {
					return $p !== 'neo-pulse-app/neo-pulse-app.php';
				}
			)
		);
	}
);
`;
const local = join(import.meta.dirname, "neodigital-title-sync", "000-nd-skip-pulse-app.php");
writeFileSync(local, php);
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
const mu = "./wp-content/mu-plugins";
if (!(await sftp.exists(mu))) {
  await sftp.mkdir(mu, true);
}
await sftp.put(local, `${mu}/000-nd-skip-pulse-app.php`);
await sftp.end();
console.log("mu-plugin put");
