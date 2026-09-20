<?php
if ( ( $_GET['key'] ?? '' ) !== '4d937a62b18280309875eb9d66ac1656' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;
$config = Neo_Pulse_Wp_Speed_Settings::get_config();
Neo_Pulse_Wp_Speed_Settings::save_config( Neo_Pulse_Wp_Speed_Settings::apply_simple_enabled_config( $config ) );
$c = Neo_Pulse_Wp_Speed_Settings::get_config();
echo 'enabled=' . ( ! empty( $c['enabled'] ) ? '1' : '0' ) . "\n";
echo 'optimize_css=' . ( ! empty( $c['optimize_css'] ) ? '1' : '0' ) . "\n";
echo 'optimize_js=' . ( ! empty( $c['optimize_js'] ) ? '1' : '0' ) . "\n";
echo 'bypass_elementor=' . ( ! empty( $c['bypass_elementor'] ) ? '1' : '0' ) . "\n";
@unlink( __FILE__ );
