<?php
/**
 * Plugin Name: Neo Digital Elementor pagination noindex
 * Description: noindex Elementor ?e-page- loop pagination and advertise X-Robots-Tag.
 */

defined( 'ABSPATH' ) || exit;

function nd_request_has_elementor_epage(): bool {
	if ( empty( $_GET ) || ! is_array( $_GET ) ) {
		return false;
	}
	foreach ( array_keys( $_GET ) as $key ) {
		if ( is_string( $key ) && strncmp( $key, 'e-page-', 7 ) === 0 ) {
			return true;
		}
	}
	return false;
}

add_filter(
	'wp_robots',
	static function ( $robots ) {
		if ( ! nd_request_has_elementor_epage() ) {
			return $robots;
		}
		if ( ! is_array( $robots ) ) {
			$robots = array();
		}
		$robots['noindex'] = true;
		$robots['follow']  = true;
		unset( $robots['index'] );
		return $robots;
	},
	99
);

add_action(
	'send_headers',
	static function () {
		if ( ! nd_request_has_elementor_epage() || headers_sent() ) {
			return;
		}
		header( 'X-Robots-Tag: noindex, follow', false );
	},
	0
);
