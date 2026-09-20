<?php
if ( ( $_GET['key'] ?? '' ) !== 'c22c6101eddf22fd01295262b9c29f1e' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;
$job_key = 'neo_pulse_rebuild_9908_job';

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
