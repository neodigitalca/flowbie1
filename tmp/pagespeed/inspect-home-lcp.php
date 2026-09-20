<?php
$path = getenv('TEMP') . '/nd-home-199.html';
if ( ! is_readable( $path ) ) {
	fwrite( STDERR, "missing $path\n" );
	exit( 1 );
}
$h = file_get_contents( $path );
echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'has_data_uri_src=' . ( preg_match( '/src="data:image/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'elementor-invisible=' . ( str_contains( $h, 'elementor-invisible' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'nitro-lazy-src=' . ( str_contains( $h, 'nitro-lazy-src' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'fadeInRight=' . ( str_contains( $h, 'fadeInRight' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'fetchpriority_high=' . ( str_contains( $h, 'fetchpriority="high"' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'edmonton.png=' . ( str_contains( $h, 'edmonton.png' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'edmonton-seo-command.webp=' . ( str_contains( $h, 'edmonton-seo-command.webp' ) ? 'yes' : 'no' ) . PHP_EOL;
preg_match_all( '/<link[^>]+rel=["\']preload["\'][^>]*>/i', $h, $m );
echo 'preloads=' . count( $m[0] ) . PHP_EOL;
foreach ( $m[0] as $p ) {
	if ( stripos( $p, 'image' ) !== false ) {
		echo 'PRELOAD ' . $p . PHP_EOL;
	}
}
if ( preg_match( '/elementor-element-60bc532[\s\S]{0,2500}<img[^>]+>/i', $h, $w ) ) {
	echo 'WIDGET_IMG ' . substr( $w[0], 0, 1800 ) . PHP_EOL;
} else {
	echo 'WIDGET_IMG missing' . PHP_EOL;
	preg_match_all( '/<img[^>]+>/i', $h, $imgs );
	echo 'img_count=' . count( $imgs[0] ) . PHP_EOL;
	foreach ( array_slice( $imgs[0], 0, 8 ) as $i => $img ) {
		echo 'IMG' . $i . ' ' . substr( $img, 0, 400 ) . PHP_EOL;
	}
}
