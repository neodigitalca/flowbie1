<?php
/**
 * One-time: activate NEO Pulse WP on neodigital.ca. Self-deletes after a successful run.
 */
if ( ( $_GET['key'] ?? '' ) !== 'ND_ACTIVATE_TOKEN' ) {
	http_response_code( 403 );
	header( 'Content-Type: text/plain; charset=utf-8' );
	exit( 'forbidden' );
}

ini_set( 'display_errors', '1' );
error_reporting( E_ALL );
register_shutdown_function(
	static function () {
		$e = error_get_last();
		if ( ! is_array( $e ) ) {
			return;
		}
		if ( ! in_array( (int) $e['type'], array( E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR ), true ) ) {
			return;
		}
		header( 'Content-Type: text/plain; charset=utf-8' );
		echo 'fatal ' . $e['message'] . ' @ ' . $e['file'] . ':' . $e['line'] . "\n";
	}
);

$dir     = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 6; $i++ ) {
	$candidate = $dir . '/wp-load.php';
	if ( is_readable( $candidate ) ) {
		$wp_load = $candidate;
		break;
	}
	$dir = dirname( $dir );
}
if ( $wp_load === '' ) {
	http_response_code( 500 );
	header( 'Content-Type: text/plain; charset=utf-8' );
	exit( 'wp-load missing' );
}

require_once $wp_load;
require_once ABSPATH . 'wp-admin/includes/plugin.php';

header( 'Content-Type: text/plain; charset=utf-8' );

$neo  = 'neo-pulse-wp/neo-pulse-wp.php';
$app  = 'neo-pulse-app/neo-pulse-app.php';
$flow = 'flowbie-wp/flowbie-wp.php';

if ( is_plugin_active( $app ) ) {
	deactivate_plugins( $app, true );
}
if ( is_plugin_active( $flow ) ) {
	deactivate_plugins( $flow, true );
}

$activate = activate_plugin( $neo, '', false, false );
if ( is_wp_error( $activate ) ) {
	http_response_code( 500 );
	echo 'activate_failed ' . $activate->get_error_message() . "\n";
	exit;
}

echo "ok\n";
echo 'neo_pulse_active=' . ( is_plugin_active( $neo ) ? 'yes' : 'no' ) . "\n";
echo 'app_active=' . ( is_plugin_active( $app ) ? 'yes' : 'no' ) . "\n";

@unlink( __FILE__ );
