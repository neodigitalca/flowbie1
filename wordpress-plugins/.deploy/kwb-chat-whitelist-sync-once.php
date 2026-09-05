<?php
/**
 * One-time KWB sync: untrained public chat, whitelist test page only, Chekkit off.
 * Self-deletes after a successful run.
 */
if ( ( $_GET['key'] ?? '' ) !== 'KWB_WHITELIST_TOKEN' ) {
	http_response_code( 403 );
	header( 'Content-Type: text/plain; charset=utf-8' );
	exit( 'forbidden' );
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
	header( 'Content-Type: text/plain; charset=utf-8' );
	exit( 'wp-load missing' );
}

require_once $wp_load;
require_once ABSPATH . 'wp-admin/includes/plugin.php';

header( 'Content-Type: text/plain; charset=utf-8' );

$neo = 'neo-pulse-wp/neo-pulse-wp.php';
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

if ( class_exists( 'Neo_Pulse_Wp_Chat', false ) ) {
	Neo_Pulse_Wp_Chat::save_settings(
		array(
			'enabled'                => true,
			'logged_in_only'         => false,
			'admin_only'             => false,
			'whitelist_url'          => 'https://kwbllp.com/chat-bot-test-page/',
			'system_prompt'          => '',
			'knowledge_base'         => array(),
			'chekkit_enabled'        => false,
			'chekkit_teaser_enabled' => false,
		)
	);
}

if ( class_exists( 'Neo_Pulse_Wp_Chat_Rag', false ) ) {
	Neo_Pulse_Wp_Chat_Rag::invalidate_cache();
}
if ( function_exists( 'wp_cache_flush' ) ) {
	wp_cache_flush();
}

$chat = class_exists( 'Neo_Pulse_Wp_Chat', false ) ? Neo_Pulse_Wp_Chat::get_settings() : array();

echo "ok\n";
echo 'neo_pulse_active=' . ( is_plugin_active( $neo ) ? 'yes' : 'no' ) . "\n";
echo 'chat_enabled=' . ( ! empty( $chat['enabled'] ) ? 'yes' : 'no' ) . "\n";
echo 'logged_in_only=' . ( ! empty( $chat['logged_in_only'] ) ? 'yes' : 'no' ) . "\n";
echo 'admin_only=' . ( ! empty( $chat['admin_only'] ) ? 'yes' : 'no' ) . "\n";
echo 'chekkit_enabled=' . ( ! empty( $chat['chekkit_enabled'] ) ? 'yes' : 'no' ) . "\n";
echo 'whitelist_url=' . ( isset( $chat['whitelist_url'] ) ? (string) $chat['whitelist_url'] : '' ) . "\n";

@unlink( __FILE__ );
