<?php
if ( ( $_GET['key'] ?? '' ) !== 'eb2e03a8fdaabd65fb17b4c8f3206305' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); exit('wp-load missing'); }
require_once $wp_load;
if ( function_exists( 'wp_cache_flush' ) ) { wp_cache_flush(); }
if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush' ) ) { Neo_Pulse_Wp_Cache_Flush::flush_all(); }
$np = 'NitroPack\\WordPress\\NitroPack';
if ( class_exists( $np ) && method_exists( $np, 'getInstance' ) ) {
  $inst = $np::getInstance();
  if ( is_object( $inst ) && method_exists( $inst, 'getSdk' ) ) {
    $sdk = $inst->getSdk();
    if ( is_object( $sdk ) && method_exists( $sdk, 'invalidateCache' ) ) { $sdk->invalidateCache(); echo "nitropack_invalidate=yes\n"; }
    if ( is_object( $sdk ) && method_exists( $sdk, 'purgeCache' ) ) { $sdk->purgeCache(); echo "nitropack_purge=yes\n"; }
  }
}
if ( class_exists( 'WpeCommon' ) ) {
  if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) { WpeCommon::purge_memcached(); }
  if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) { WpeCommon::purge_varnish_cache(); }
  echo "purged=yes\n";
} else {
  echo "purged=no_wpe\n";
}
echo "plugin=" . ( defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : 'missing' ) . "\n";
@unlink( __FILE__ );
