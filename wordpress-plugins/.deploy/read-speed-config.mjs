import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"));
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
const token = randomBytes(16).toString("hex");
const php = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;
if ( class_exists( 'Neo_Pulse_Wp_Speed_Settings' ) ) {
  $c = Neo_Pulse_Wp_Speed_Settings::get_config();
  echo 'enabled=' . ( ! empty( $c['enabled'] ) ? '1' : '0' ) . "\\n";
  echo 'optimize_css=' . ( ! empty( $c['optimize_css'] ) ? '1' : '0' ) . "\\n";
  echo 'optimize_js=' . ( ! empty( $c['optimize_js'] ) ? '1' : '0' ) . "\\n";
  echo 'bypass_elementor=' . ( ! empty( $c['bypass_elementor'] ) ? '1' : '0' ) . "\\n";
}
echo 'gate=' . ( class_exists( 'Neo_Pulse_Wp_Speed_Gate' ) && Neo_Pulse_Wp_Speed_Gate::should_optimize() ? '1' : '0' ) . "\\n";
@unlink( __FILE__ );
`;
const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const local = join(tmpDir, "nd-speed-read.php");
writeFileSync(local, php, "utf8");
const sftp = new SftpClient();
await sftp.connect({
  host: site.host, port: site.port, username: site.username, password: site.password, readyTimeout: 45000,
  algorithms: {
    serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
    kex: ["curve25519-sha256", "ecdh-sha2-nistp256", "diffie-hellman-group14-sha256", "diffie-hellman-group-exchange-sha256", "diffie-hellman-group14-sha1"],
  },
});
await sftp.put(local, "./wp-content/plugins/neo-pulse-wp/nd-speed-read.php");
await sftp.end();
const res = await fetch(`https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-speed-read.php?key=${token}`, { cache: "no-store" });
console.log((await res.text()).trim());
