<?php
if ( ( $_GET['key'] ?? '' ) !== '65ddea458578a5c77a8bd49a18308d23' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); exit('wp-load missing'); }
require_once $wp_load;
echo 'plugin=' . ( defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : 'missing' ) . "\n";
$fns = array(
  'nitropack_sdk_purge_cache',
  'nitropack_purge_cache',
  'nitropack_invalidate_cache',
  'nitropack_sdk_invalidate_cache',
);
foreach ( $fns as $fn ) {
  echo 'fn_' . $fn . '=' . ( function_exists( $fn ) ? 'yes' : 'no' ) . "\n";
  if ( function_exists( $fn ) ) { $fn(); }
}
if ( function_exists( 'do_action' ) ) {
  do_action( 'nitropack_integration_purge_all' );
  do_action( 'nitropack_cache_invalidate' );
}
if ( class_exists( '\NitroPack\WordPress\NitroPack' ) ) {
  echo "class_nitropack=yes\n";
}
$classes = get_declared_classes();
foreach ( $classes as $c ) {
  if ( stripos( $c, 'nitro' ) !== false ) {
    echo 'class=' . $c . "\n";
  }
}
@unlink( __FILE__ );
