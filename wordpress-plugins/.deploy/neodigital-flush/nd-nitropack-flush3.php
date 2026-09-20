<?php
if ( ( $_GET['key'] ?? '' ) !== 'eaa5607e1b1be22e4ff0c0f812327939' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;
$cls = 'NitroPack\\WordPress\\Settings\\PurgeCache';
if ( class_exists( $cls ) && method_exists( $cls, 'nitropack_purge_entire_cache' ) ) {
  $cls::nitropack_purge_entire_cache();
  echo "entire=yes\n";
}
if ( class_exists( $cls ) && method_exists( $cls, 'nitropack_invalidate_entire_cache' ) ) {
  $cls::nitropack_invalidate_entire_cache();
  echo "invalidate=yes\n";
}
if ( class_exists( 'WpeCommon' ) && method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) {
  WpeCommon::purge_varnish_cache();
  echo "varnish=yes\n";
}
echo "plugin=" . ( defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : 'missing' ) . "\n";
@unlink( __FILE__ );
