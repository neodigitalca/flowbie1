<?php
/**
 * One-time: enable Design option "Header search icon opens sidebar". Self-deletes.
 */
if ( ( $_GET['key'] ?? '' ) !== 'BLINDMAGIC_HEADER_SEARCH_TOKEN' ) {
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
$sidebar['header_search_opens_sidebar'] = true;
Neo_Pulse_Wp_Ai_Widget_Design::save( array( 'chat_sidebar' => $sidebar ) );

$chat_settings = class_exists( 'Neo_Pulse_Wp_Chat' ) ? Neo_Pulse_Wp_Chat::get_settings() : array();
$chat_settings['header_search_opens_sidebar'] = true;
if ( class_exists( 'Neo_Pulse_Wp_Chat' ) ) {
	Neo_Pulse_Wp_Chat::save_settings( $chat_settings );
}

$enabled = ! empty( Neo_Pulse_Wp_Ai_Widget_Design::get_settings()['chat_sidebar']['header_search_opens_sidebar'] );

@unlink( __FILE__ );

echo wp_json_encode(
	array(
		'ok'      => $enabled,
		'option'  => 'header_search_opens_sidebar',
		'enabled' => $enabled,
	)
);
