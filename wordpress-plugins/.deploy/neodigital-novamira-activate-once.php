<?php
/**
 * One-time neodigital.ca Novamira + Elementor activate. Self-deletes after a successful run.
 */
if ( ( $_GET['key'] ?? '' ) !== 'NEODIGITAL_NOVAMIRA_TOKEN' ) {
	http_response_code( 403 );
	header( 'Content-Type: application/json; charset=utf-8' );
	echo '{"error":"forbidden"}';
	exit;
}

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
	header( 'Content-Type: application/json; charset=utf-8' );
	echo '{"error":"wp-load missing"}';
	exit;
}

require_once $wp_load;
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
require_once ABSPATH . 'wp-admin/includes/misc.php';
require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

header( 'Content-Type: application/json; charset=utf-8' );

$plugins_dir    = WP_PLUGIN_DIR;
$novamira_main  = 'novamira/novamira.php';
$elementor_main = 'elementor/elementor.php';
$zip_path       = $plugins_dir . '/novamira-1.12.4.zip';

WP_Filesystem();

if ( ! is_readable( $plugins_dir . '/novamira/novamira.php' ) ) {
	if ( ! is_readable( $zip_path ) ) {
		http_response_code( 500 );
		echo wp_json_encode( array( 'error' => 'Novamira zip missing' ) );
		exit;
	}
	$unzip = unzip_file( $zip_path, $plugins_dir );
	if ( is_wp_error( $unzip ) ) {
		http_response_code( 500 );
		echo wp_json_encode( array( 'error' => 'Novamira unzip failed: ' . $unzip->get_error_message() ) );
		exit;
	}
}

if ( ! is_readable( $plugins_dir . '/elementor/elementor.php' ) ) {
	$skin     = new Automatic_Upgrader_Skin();
	$upgrader = new Plugin_Upgrader( $skin );
	$install  = $upgrader->install( 'https://downloads.wordpress.org/plugin/elementor.latest-stable.zip' );
	if ( is_wp_error( $install ) || $install === false ) {
		$msg = is_wp_error( $install ) ? $install->get_error_message() : 'Elementor install failed';
		http_response_code( 500 );
		echo wp_json_encode( array( 'error' => $msg ) );
		exit;
	}
}

$activate_novamira = activate_plugin( $novamira_main, '', false, false );
if ( is_wp_error( $activate_novamira ) ) {
	http_response_code( 500 );
	echo wp_json_encode( array( 'error' => 'Novamira activate failed: ' . $activate_novamira->get_error_message() ) );
	exit;
}

$activate_elementor = activate_plugin( $elementor_main, '', false, false );
if ( is_wp_error( $activate_elementor ) ) {
	http_response_code( 500 );
	echo wp_json_encode( array( 'error' => 'Elementor activate failed: ' . $activate_elementor->get_error_message() ) );
	exit;
}

if ( function_exists( 'novamira_enable_ai_abilities' ) ) {
	$enabled = novamira_enable_ai_abilities();
} else {
	update_option( 'novamira_ai_abilities_enabled', '1' );
	update_option( 'novamira_ai_abilities_domain', (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
	$enabled = true;
}

$admins = get_users(
	array(
		'role'    => 'administrator',
		'number'  => 1,
		'orderby' => 'ID',
	)
);
if ( ! $admins ) {
	http_response_code( 500 );
	echo wp_json_encode( array( 'error' => 'No administrator user' ) );
	exit;
}
$admin   = $admins[0];
$uuid    = function_exists( 'wp_generate_uuid4' ) ? wp_generate_uuid4() : uniqid( 'nm', true );
$created = WP_Application_Passwords::create_new_application_password(
	(int) $admin->ID,
	array( 'name' => 'neo-pulse-elementor-' . substr( $uuid, 0, 8 ) )
);
if ( is_wp_error( $created ) ) {
	http_response_code( 500 );
	echo wp_json_encode( array( 'error' => 'App password failed: ' . $created->get_error_message() ) );
	exit;
}

if ( function_exists( 'wp_cache_flush' ) ) {
	wp_cache_flush();
}

$routes = rest_get_server()->get_routes();

echo wp_json_encode(
	array(
		'ok'              => true,
		'wpVersion'       => get_bloginfo( 'version' ),
		'novamiraActive'  => is_plugin_active( $novamira_main ),
		'elementorActive' => is_plugin_active( $elementor_main ),
		'abilitiesOn'     => $enabled && (string) get_option( 'novamira_ai_abilities_enabled' ) === '1',
		'abilitiesDomain' => (string) get_option( 'novamira_ai_abilities_domain' ),
		'frontPageId'     => (int) get_option( 'page_on_front' ),
		'frontStatus'     => get_post_status( (int) get_option( 'page_on_front' ) ),
		'username'        => $admin->user_login,
		'appPassword'     => $created[0],
		'mcpRoute'        => isset( $routes['/mcp/novamira'] ),
	)
);

@unlink( $zip_path );
@unlink( __FILE__ );
