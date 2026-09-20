<?php
/**
 * One-time: boot real wp-admin as an administrator and print the result.
 */
if ( ( $_GET['key'] ?? '' ) !== 'ND_ADMIN_BOOT_TOKEN' ) {
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

$uid        = (int) $admins[0]->ID;
$expiration = time() + 300;
$auth       = wp_generate_auth_cookie( $uid, $expiration, is_ssl() ? 'secure_auth' : 'auth' );
$logged     = wp_generate_auth_cookie( $uid, $expiration, 'logged_in' );
if ( is_ssl() ) {
	$_COOKIE[ SECURE_AUTH_COOKIE ] = $auth;
} else {
	$_COOKIE[ AUTH_COOKIE ] = $auth;
}
$_COOKIE[ LOGGED_IN_COOKIE ] = $logged;
wp_set_current_user( $uid );

$_SERVER['PHP_SELF']    = '/wp-admin/index.php';
$_SERVER['REQUEST_URI'] = '/wp-admin/';
$_GET['nd_boot']        = '1';

ob_start();
require ABSPATH . 'wp-admin/admin.php';
$html = ob_get_clean();

header( 'Content-Type: text/plain; charset=utf-8' );
echo "admin_boot_ok\n";
echo 'user=' . (string) wp_get_current_user()->user_email . "\n";
echo 'html_len=' . (string) strlen( $html ) . "\n";
echo 'has_critical=' . ( str_contains( $html, 'critical error' ) ? 'yes' : 'no' ) . "\n";
echo 'has_dashboard=' . ( str_contains( $html, 'dashboard' ) || str_contains( $html, 'Dashboard' ) ? 'yes' : 'no' ) . "\n";
echo 'has_neo_pulse=' . ( str_contains( $html, 'NEO Pulse' ) ? 'yes' : 'no' ) . "\n";

@unlink( __FILE__ );
