import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
if (!site) {
  console.error("No neodigital.ca catalog row");
  process.exit(1);
}

const token = randomBytes(16).toString("hex");
const jobOption = "neo_pulse_rebuild_9908_job";

const rebuildPhp = `<?php
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
$job_key = '${jobOption}';

if ( ( $_GET['poll'] ?? '' ) === '1' ) {
  $job = get_option( $job_key );
  if ( ! is_array( $job ) ) {
    echo wp_json_encode( array( 'state' => 'missing' ) );
    exit;
  }
  echo wp_json_encode( $job );
  if ( ( $job['state'] ?? '' ) === 'done' || ( $job['state'] ?? '' ) === 'error' ) {
    delete_option( $job_key );
    @unlink( __FILE__ );
  }
  exit;
}

if ( ! class_exists( 'Neo_Pulse_Wp_Backend_Assist' ) ) {
  echo wp_json_encode( array( 'error' => 'backend assist missing', 'plugin' => defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : 'missing' ) );
  @unlink( __FILE__ );
  exit;
}
Neo_Pulse_Wp_Backend_Assist::ensure_dependencies();
$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( empty( $admins ) ) {
  echo wp_json_encode( array( 'error' => 'no administrator', 'plugin' => NEO_PULSE_WP_VERSION ) );
  @unlink( __FILE__ );
  exit;
}
wp_set_current_user( (int) $admins[0]->ID );
$post_id = 9908;
$post = get_post( $post_id );
if ( ! $post ) {
  echo wp_json_encode( array( 'error' => 'page 9908 missing', 'plugin' => NEO_PULSE_WP_VERSION ) );
  @unlink( __FILE__ );
  exit;
}
if ( get_post_status( $post_id ) === 'trash' ) {
  wp_untrash_post( $post_id );
}

update_option(
  $job_key,
  array(
    'state'   => 'running',
    'started' => time(),
    'plugin'  => defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '',
    'post_id' => $post_id,
  ),
  false
);

$queued = Neo_Pulse_Wp_Backend_Assist_Novamira_Page::queue_design_cron( $post_id, $job_key );
if ( is_wp_error( $queued ) ) {
  update_option(
    $job_key,
    array(
      'state'   => 'error',
      'success' => false,
      'error'   => $queued->get_error_message(),
    ),
    false
  );
  echo wp_json_encode( array( 'accepted' => false, 'error' => $queued->get_error_message() ) );
  exit;
}

echo wp_json_encode( array( 'accepted' => true, 'state' => 'running', 'poll' => 'poll=1', 'via' => 'wp-cron' ) );
`;

const tmpDir = join(import.meta.dirname, "neodigital-flush");
mkdirSync(tmpDir, { recursive: true });
const localPhp = join(tmpDir, "nd-rebuild-9880-once.php");
writeFileSync(localPhp, rebuildPhp, "utf8");

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
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
await sftp.put(localPhp, "./wp-content/plugins/neo-pulse-wp/nd-rebuild-9880-once.php");
await sftp.end();

const base = `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-rebuild-9880-once.php?key=${token}`;
const startRes = await fetch(base, { cache: "no-store", signal: AbortSignal.timeout(15000) });
const startBody = await startRes.text();
console.log("start_status", startRes.status);
console.log(startBody.trim());
if (!startRes.ok) {
  process.exit(1);
}
const started = JSON.parse(startBody);
if (!started.accepted) {
  process.exit(1);
}

void fetch(`https://neodigital.ca/wp-cron.php?doing_wp_cron=${Date.now()}`, {
  cache: "no-store",
  signal: AbortSignal.timeout(15000),
}).catch(() => {});

const pollUrl = `${base}&poll=1`;
const deadline = Date.now() + 300000;
let parsed = null;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 8000));
  const pollRes = await fetch(pollUrl, { cache: "no-store", signal: AbortSignal.timeout(60000) });
  const pollBody = await pollRes.text();
  if (!pollRes.ok) {
    console.log("poll_status", pollRes.status, pollBody.slice(0, 200));
    continue;
  }
  const job = JSON.parse(pollBody);
  console.log("poll_state", job.state ?? job.error ?? "unknown");
  if (job.state === "running" || job.state === "missing") {
    continue;
  }
  parsed = job;
  break;
}
if (!parsed || !parsed.success) {
  console.log("final", parsed ? JSON.stringify(parsed).slice(0, 2000) : "timeout");
  process.exit(1);
}
console.log("rebuild_ok", parsed.view_url ?? "", "sections", parsed.section_plan?.length ?? 0);
