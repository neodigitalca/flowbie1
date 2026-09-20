<?php
if ( ( $_GET['key'] ?? '' ) !== '79f0f5903cb8abf7ab961b822caf7dea' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;
$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( empty( $admins ) ) { echo '{"error":"no administrator"}'; @unlink( __FILE__ ); exit; }
wp_set_current_user( (int) $admins[0]->ID );

function nd_fix_home_h1( &$elements, &$changed ) {
  foreach ( $elements as &$el ) {
    if ( ! is_array( $el ) ) {
      continue;
    }
    if ( isset( $el['id'] ) && $el['id'] === 'a71df32' && isset( $el['settings']['title'] ) ) {
      $before = (string) $el['settings']['title'];
      $after  = preg_replace( '/^\s*Window Coverings\b/i', 'Edmonton', $before, 1 );
      if ( is_string( $after ) && $after !== $before ) {
        $el['settings']['title'] = $after;
        $changed = $before;
      }
    }
    if ( ! empty( $el['elements'] ) ) {
      nd_fix_home_h1( $el['elements'], $changed );
    }
  }
  unset( $el );
}

$raw = get_post_meta( 55, '_elementor_data', true );
$data = json_decode( is_string( $raw ) ? $raw : '', true );
if ( ! is_array( $data ) ) {
  echo wp_json_encode( array( 'error' => 'no elementor data' ) );
  @unlink( __FILE__ );
  exit;
}
$changed = '';
nd_fix_home_h1( $data, $changed );
if ( $changed === '' ) {
  echo wp_json_encode( array( 'ok' => true, 'changed' => false, 'title' => 'already edmonton' ) );
  @unlink( __FILE__ );
  exit;
}
if ( class_exists( 'Elementor\\Plugin' ) ) {
  $document = \Elementor\Plugin::$instance->documents->get( 55 );
  if ( $document ) {
    $document->save( array( 'elements' => $data ) );
  } else {
    update_post_meta( 55, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
  }
  \Elementor\Plugin::$instance->files_manager->clear_cache();
} else {
  update_post_meta( 55, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
}
echo wp_json_encode( array( 'ok' => true, 'changed' => true, 'from' => $changed ) );
@unlink( __FILE__ );
