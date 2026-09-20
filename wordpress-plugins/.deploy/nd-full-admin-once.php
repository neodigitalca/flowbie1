<?php
/**
 * One-time: load real wp-admin for the NEO Pulse page as an administrator.
 */
if ( ( $_GET['key'] ?? '' ) !== 'ND_FULL_ADMIN_TOKEN' ) {
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
$expiration = time() + 600;
$scheme     = is_ssl() ? 'secure_auth' : 'auth';
$auth_name  = is_ssl() ? SECURE_AUTH_COOKIE : AUTH_COOKIE;
$_COOKIE[ $auth_name ]       = wp_generate_auth_cookie( $uid, $expiration, $scheme );
$_COOKIE[ LOGGED_IN_COOKIE ] = wp_generate_auth_cookie( $uid, $expiration, 'logged_in' );
wp_set_current_user( $uid );

$valid = wp_validate_auth_cookie( (string) $_COOKIE[ $auth_name ], $scheme );

$_GET['page']               = 'neo-pulse-wp';
$_GET['neo_pulse_welcome']  = '1';
$_REQUEST['page']           = 'neo-pulse-wp';
$_SERVER['REQUEST_URI']     = '/wp-admin/admin.php?page=neo-pulse-wp&neo_pulse_welcome=1';
$_SERVER['PHP_SELF']        = '/wp-admin/admin.php';
$_SERVER['SCRIPT_FILENAME'] = ABSPATH . 'wp-admin/admin.php';
$_SERVER['SCRIPT_NAME']     = '/wp-admin/admin.php';

header( 'Content-Type: text/plain; charset=utf-8' );
echo 'auth_valid=' . ( $valid ? (string) $valid : 'no' ) . "\n";
echo 'user=' . (string) wp_get_current_user()->user_email . "\n";
echo 'welcome=' . ( class_exists( 'Neo_Pulse_Wp_Welcome', false ) && Neo_Pulse_Wp_Welcome::has_pending_flag() ? 'pending' : 'no' ) . "\n";

ob_start();
require ABSPATH . 'wp-admin/admin.php';
$html = ob_get_clean();
echo "admin_ok\n";
echo 'html_len=' . (string) strlen( $html ) . "\n";
echo 'has_critical=' . ( str_contains( $html, 'critical error' ) ? 'yes' : 'no' ) . "\n";

@unlink( __FILE__ );
