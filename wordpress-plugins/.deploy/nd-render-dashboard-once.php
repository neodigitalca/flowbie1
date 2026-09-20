<?php
/**
 * One-time: render NEO Pulse WP dashboard as admin.
 */
if ( ( $_GET['key'] ?? '' ) !== 'ND_RENDER_TOKEN' ) {
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
require_once ABSPATH . 'wp-admin/includes/admin.php';
require_once ABSPATH . 'wp-admin/includes/screen.php';
require_once ABSPATH . 'wp-admin/includes/template.php';

$admins = get_users(
	array(
		'role'   => 'administrator',
		'number' => 1,
	)
);
if ( ! isset( $admins[0] ) ) {
	http_response_code( 500 );
	exit( 'no admin' );
}

wp_set_current_user( (int) $admins[0]->ID );
$_GET['page']           = 'neo-pulse-wp';
$GLOBALS['pagenow']     = 'admin.php';
$GLOBALS['plugin_page'] = 'neo-pulse-wp';
set_current_screen( 'toplevel_page_neo-pulse-wp' );
do_action( 'admin_menu' );

header( 'Content-Type: text/plain; charset=utf-8' );
echo "start_render\n";
ob_start();
Neo_Pulse_Wp_Admin::render_app_page();
$html = ob_get_clean();
echo "render_ok len=" . (string) strlen( $html ) . "\n";

@unlink( __FILE__ );
