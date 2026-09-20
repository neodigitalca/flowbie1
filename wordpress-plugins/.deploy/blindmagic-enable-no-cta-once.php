<?php
/**
 * One-time: set Chat launcher style to No CTA. Self-deletes.
 */
if ( ( $_GET['key'] ?? '' ) !== 'BLINDMAGIC_NO_CTA_TOKEN' ) {
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

header( 'Content-Type: application/json; charset=utf-8' );

if ( ! class_exists( 'Neo_Pulse_Wp_Ai_Widget_Design' ) ) {
	http_response_code( 500 );
	echo '{"error":"design class missing"}';
	exit;
}

$settings = Neo_Pulse_Wp_Ai_Widget_Design::get_settings();
$sidebar  = isset( $settings['chat_sidebar'] ) && is_array( $settings['chat_sidebar'] )
	? $settings['chat_sidebar']
	: array();
$sidebar['launcher_style'] = 'none';
Neo_Pulse_Wp_Ai_Widget_Design::save( array( 'chat_sidebar' => $sidebar ) );

$chat_settings = class_exists( 'Neo_Pulse_Wp_Chat' ) ? Neo_Pulse_Wp_Chat::get_settings() : array();
$chat_settings['launcher_style'] = 'none';
if ( class_exists( 'Neo_Pulse_Wp_Chat' ) ) {
	Neo_Pulse_Wp_Chat::save_settings( $chat_settings );
}

$style = (string) ( Neo_Pulse_Wp_Ai_Widget_Design::get_settings()['chat_sidebar']['launcher_style'] ?? '' );

if ( class_exists( 'Neo_Pulse_Wp_Search' ) ) {
	Neo_Pulse_Wp_Search::purge_public_caches();
}
if ( function_exists( 'wp_cache_flush' ) ) {
	wp_cache_flush();
}
if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) {
	WpeCommon::purge_memcached();
}
if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) {
	WpeCommon::purge_varnish_cache();
}

@unlink( __FILE__ );

echo wp_json_encode(
	array(
		'ok'             => $style === 'none',
		'option'         => 'launcher_style',
		'launcher_style' => $style,
	)
);
