<?php
if ( ( $_GET['key'] ?? '' ) !== 'e87b1c5c45923741b5331b231b41ff95' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;
$cls = 'NitroPack\\WordPress\\Settings\\PurgeCache';
if ( class_exists( $cls ) ) {
  $methods = get_class_methods( $cls );
  echo 'purge_methods=' . implode( ',', is_array( $methods ) ? $methods : array() ) . "\n";
  foreach ( array( 'purge', 'purge_cache', 'purgeCache', 'handle', 'run' ) as $m ) {
    if ( is_callable( array( $cls, $m ) ) ) {
      echo 'call=' . $m . "\n";
      $cls::$m();
    }
  }
}
$np = 'NitroPack\\WordPress\\NitroPack';
if ( class_exists( $np ) && method_exists( $np, 'getInstance' ) ) {
  $inst = $np::getInstance();
  echo 'np_inst=' . ( is_object( $inst ) ? get_class( $inst ) : 'no' ) . "\n";
  if ( is_object( $inst ) ) {
    foreach ( array( 'purgeCache', 'invalidateCache', 'clearCache', 'purge' ) as $m ) {
      if ( method_exists( $inst, $m ) ) {
        echo 'inst_call=' . $m . "\n";
        $inst->$m();
      }
    }
    if ( method_exists( $inst, 'getSdk' ) ) {
      $sdk = $inst->getSdk();
      echo 'sdk=' . ( is_object( $sdk ) ? get_class( $sdk ) : 'no' ) . "\n";
      if ( is_object( $sdk ) ) {
        foreach ( array( 'purgeCache', 'invalidateCache', 'clearCache' ) as $m ) {
          if ( method_exists( $sdk, $m ) ) {
            echo 'sdk_call=' . $m . "\n";
            $sdk->$m();
          }
        }
      }
    }
  }
}
echo "done\n";
@unlink( __FILE__ );
