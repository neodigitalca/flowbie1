<?php
/**
 * One-time fatal probe. Self-deletes after a successful run.
 */
if ( ( $_GET['key'] ?? '' ) !== 'ND_PROBE_TOKEN' ) {
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
	exit( 'wp-load missing' );
}

require_once $wp_load;
require_once ABSPATH . 'wp-admin/includes/plugin.php';

header( 'Content-Type: text/plain; charset=utf-8' );

$active = (array) get_option( 'active_plugins', array() );
echo "active_plugins\n";
foreach ( $active as $p ) {
	echo $p . "\n";
}
echo "---\n";
echo 'neo_pulse_active=' . ( is_plugin_active( 'neo-pulse-wp/neo-pulse-wp.php' ) ? 'yes' : 'no' ) . "\n";
echo 'app_file=' . ( is_readable( WP_PLUGIN_DIR . '/neo-pulse-app/neo-pulse-app.php' ) ? 'yes' : 'no' ) . "\n";
echo 'wp_file=' . ( is_readable( WP_PLUGIN_DIR . '/neo-pulse-wp/neo-pulse-wp.php' ) ? 'yes' : 'no' ) . "\n";

$admins = get_users(
	array(
		'role'   => 'administrator',
		'number' => 1,
		'fields' => array( 'ID', 'user_email' ),
	)
);
if ( isset( $admins[0] ) ) {
	wp_set_current_user( (int) $admins[0]->ID );
	echo 'admin_set=' . (string) $admins[0]->user_email . "\n";
}

do_action( 'admin_init' );
do_action( 'admin_menu' );
do_action( 'admin_bar_menu', class_exists( 'WP_Admin_Bar' ) ? new WP_Admin_Bar() : null, false );
do_action( 'wp_enqueue_scripts' );
do_action( 'admin_enqueue_scripts', 'index.php' );
do_action( 'template_redirect' );

echo "probe_ok\n";
echo 'classes=' . ( class_exists( 'Neo_Pulse_Wp_Admin', false ) ? 'admin' : 'noadmin' ) . ',' . ( class_exists( 'Neo_Pulse_Wp_Speed', false ) ? 'speed' : 'nospeed' ) . "\n";

@unlink( __FILE__ );
