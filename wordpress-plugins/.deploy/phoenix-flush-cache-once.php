<?php
if ( ( $_GET['key'] ?? '' ) !== 'PHOENIX_FLUSH_TOKEN' ) {
	http_response_code( 403 );
	echo '{"error":"forbidden"}';
	exit;
}
header( 'Content-Type: application/json; charset=utf-8' );
$abspath = dirname( __DIR__, 2 ) . '/';
if ( ! is_readable( $abspath . 'wp-load.php' ) ) {
	echo '{"error":"wp-load"}';
	exit;
}
require_once $abspath . 'wp-load.php';
if ( function_exists( 'wp_cache_flush' ) ) {
	wp_cache_flush();
}
if ( class_exists( 'WpeCommon' ) ) {
	if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) {
		WpeCommon::purge_memcached();
	}
	if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) {
		WpeCommon::purge_varnish_cache();
	}
}
echo json_encode(
	array(
		'ok'      => true,
		'blog'    => get_option( 'blogname' ),
		'home'    => get_option( 'home' ),
		'siteurl' => get_option( 'siteurl' ),
	)
);
@unlink( __FILE__ );
