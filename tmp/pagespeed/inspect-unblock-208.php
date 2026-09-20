<?php
$path = $argv[1] ?? ( getenv( 'TEMP' ) . '/nd-home-208.html' );
if ( ! is_readable( $path ) ) {
	fwrite( STDERR, "missing $path\n" );
	exit( 1 );
}
$h = file_get_contents( $path );
$head_end = stripos( $h, '</head>' );
$head = $head_end === false ? $h : substr( $h, 0, $head_end );
$h1 = 0;
if ( preg_match( '/<h1\b/i', $h, $m, PREG_OFFSET_CAPTURE ) ) {
	$h1 = (int) $m[0][1];
}

echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'head_end=' . ( $head_end === false ? 'missing' : $head_end ) . PHP_EOL;
echo 'h1_pos=' . $h1 . PHP_EOL;

$blocking = 0;
$print_sheets = 0;
$style_preloads = 0;
$img_preloads = 0;
preg_match_all( '/<link\b[^>]*>/i', $head, $links );
foreach ( $links[0] as $tag ) {
	$is_preload = (bool) preg_match( '/\brel=(["\'])preload\1/i', $tag );
	$as = '';
	if ( preg_match( '/\bas=(["\'])([^"\']+)\1/i', $tag, $a ) ) {
		$as = strtolower( $a[2] );
	}
	if ( $is_preload && $as === 'style' ) {
		$style_preloads++;
		if ( preg_match( '/\bhref=(["\'])([^"\']+)\1/i', $tag, $u ) ) {
			echo 'style_preload=' . basename( parse_url( $u[2], PHP_URL_PATH ) ?: $u[2] ) . PHP_EOL;
		}
	}
	if ( $is_preload && $as === 'image' ) {
		$img_preloads++;
	}
	if ( stripos( $tag, 'stylesheet' ) === false ) {
		continue;
	}
	if ( preg_match( '/media=(["\'])print\1/i', $tag ) || stripos( $tag, 'onload=' ) !== false ) {
		$print_sheets++;
		continue;
	}
	$blocking++;
	$href = preg_match( '/\bhref=(["\'])([^"\']+)\1/i', $tag, $u ) ? $u[2] : $tag;
	echo 'BLOCKING=' . $href . PHP_EOL;
}

echo 'head_blocking_css=' . $blocking . PHP_EOL;
echo 'print_onload_sheets=' . $print_sheets . PHP_EOL;
echo 'style_preloads=' . $style_preloads . PHP_EOL;
echo 'img_preloads=' . $img_preloads . PHP_EOL;
echo 'first_paint=' . ( str_contains( $head, 'id="neo-pulse-first-paint"' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'jquery_in_head=' . ( stripos( $head, 'jquery' ) !== false ? 'yes' : 'no' ) . PHP_EOL;
echo 'combined_css=' . ( str_contains( $h, 'neo-pulse-speed/css/' ) ? 'yes' : 'no' ) . PHP_EOL;

$head_open = stripos( $h, '<head' );
$first_link = false;
if ( preg_match( '/<link\b[^>]*>/i', $h, $lm, PREG_OFFSET_CAPTURE ) ) {
	$first_link = $lm[0][0];
}
echo 'first_link=' . ( is_string( $first_link ) ? substr( $first_link, 0, 180 ) : 'none' ) . PHP_EOL;
