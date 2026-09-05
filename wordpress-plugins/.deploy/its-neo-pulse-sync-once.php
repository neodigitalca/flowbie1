<?php
/**
 * One-time In The Shade sync: activate NEO Pulse WP, chat for logged-in users only.
 * Self-deletes after a successful run.
 */
if ( ( $_GET['key'] ?? '' ) !== 'ITS_SYNC_TOKEN' ) {
	http_response_code( 403 );
	header( 'Content-Type: text/plain; charset=utf-8' );
	exit( 'forbidden' );
}

$dir = __DIR__;
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
$flow = 'flowbie-wp/flowbie-wp.php';

if ( is_plugin_active( $flow ) ) {
	deactivate_plugins( $flow, true );
}

$activate = activate_plugin( $neo, '', false, false );
if ( is_wp_error( $activate ) ) {
	http_response_code( 500 );
	echo 'activate_failed ' . $activate->get_error_message() . "\n";
	exit;
}

if ( ! class_exists( 'Neo_Pulse_Wp_Env', false ) ) {
	if ( ! defined( 'NEO_PULSE_WP_PLUGIN_DIR' ) ) {
		define( 'NEO_PULSE_WP_PLUGIN_DIR', WP_PLUGIN_DIR . '/neo-pulse-wp/' );
	}
	require_once WP_PLUGIN_DIR . '/neo-pulse-wp/includes/class-neo-pulse-wp-env.php';
	Neo_Pulse_Wp_Env::load();
}

$key = '';
if ( class_exists( 'Neo_Pulse_Wp_OpenRouter', false ) ) {
	$key = Neo_Pulse_Wp_OpenRouter::get_api_key();
}
if ( $key === '' && defined( 'NEO_PULSE_WP_OPENROUTER_API_KEY' ) ) {
	$key = trim( (string) NEO_PULSE_WP_OPENROUTER_API_KEY );
}

if ( $key !== '' && class_exists( 'Neo_Pulse_Wp_Api', false ) ) {
	Neo_Pulse_Wp_Api::save_agency_openrouter_api_key( $key );
}

$kb = json_decode( ITS_KB_JSON, true );
if ( ! is_array( $kb ) ) {
	$kb = array();
}

if ( class_exists( 'Neo_Pulse_Wp_Chat', false ) ) {
	Neo_Pulse_Wp_Chat::save_settings(
		array(
			'enabled'           => true,
			'logged_in_only'    => true,
			'god_mode_enabled'  => true,
			'whitelist_url'     => '',
			'system_prompt'     => '',
			'knowledge_base'    => $kb,
		)
	);
}

if ( class_exists( 'Neo_Pulse_Wp_Chat_Rag', false ) ) {
	Neo_Pulse_Wp_Chat_Rag::invalidate_cache();
}
if ( class_exists( 'Neo_Pulse_Wp_Chat_Lead', false ) ) {
	Neo_Pulse_Wp_Chat_Lead::invalidate_widget_contact_cache();
}
if ( function_exists( 'wp_cache_flush' ) ) {
	wp_cache_flush();
}

$chat = class_exists( 'Neo_Pulse_Wp_Chat', false ) ? Neo_Pulse_Wp_Chat::get_settings() : array();
$err  = error_get_last();

echo "ok\n";
echo 'neo_pulse_active=' . ( is_plugin_active( $neo ) ? 'yes' : 'no' ) . "\n";
echo 'flowbie_active=' . ( is_plugin_active( $flow ) ? 'yes' : 'no' ) . "\n";
echo 'openrouter=' . ( $key !== '' ? 'yes' : 'no' ) . "\n";
echo 'chat_enabled=' . ( ! empty( $chat['enabled'] ) ? 'yes' : 'no' ) . "\n";
echo 'logged_in_only=' . ( ! empty( $chat['logged_in_only'] ) ? 'yes' : 'no' ) . "\n";
echo 'god_mode_enabled=' . ( ! empty( $chat['god_mode_enabled'] ) ? 'yes' : 'no' ) . "\n";
echo 'god_mode_whitelist=' . ( method_exists( 'Neo_Pulse_Wp_Chat', 'current_user_email_is_neodigital' ) ? 'yes' : 'no' ) . "\n";
echo 'kb_rows=' . ( isset( $chat['knowledge_base'] ) && is_array( $chat['knowledge_base'] ) ? (string) count( $chat['knowledge_base'] ) : '0' ) . "\n";
echo 'php_last_error=' . ( is_array( $err ) && ! empty( $err['message'] ) ? 'yes' : 'no' ) . "\n";

@unlink( __FILE__ );
