<?php
$path = $argv[1] ?? ( getenv( 'TEMP' ) . '/nd-home-210.html' );
$h    = file_get_contents( $path );
$head_end = stripos( $h, '</head>' );
$head = $head_end === false ? $h : substr( $h, 0, $head_end );

echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'apply_css=' . ( str_contains( $h, 'id="neo-pulse-apply-css"' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'delay_js=' . ( str_contains( $h, 'id="neo-pulse-delay-js"' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'print_onload=' . substr_count( $h, "onload=\"this.media='all'\"" ) . PHP_EOL;
echo 'print_mark=' . substr_count( $h, 'data-neo-pulse-print="1"' ) . PHP_EOL;
echo 'delayed=' . substr_count( $h, 'data-neo-pulse-delay="1"' ) . PHP_EOL;
echo 'hero_pad=' . ( str_contains( $h, 'padding:14rem 5% 3rem' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'tiny_hero=' . ( str_contains( $h, 'min-height:4.5em' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'logo150=' . ( str_contains( $h, 'WordPress_blue_logo.svg_-150x150.png' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'logo_full=' . ( str_contains( $h, 'WordPress_blue_logo.svg_.png' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'edm_webp=' . ( str_contains( $h, 'edmonton.webp' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'jquery_head=' . ( stripos( $head, 'jquery' ) !== false ? 'yes' : 'no' ) . PHP_EOL;

$blocking = 0;
preg_match_all( '#<script\b([^>]*)>#i', $h, $scripts );
foreach ( $scripts[0] as $tag ) {
	if ( ! preg_match( '/\bsrc=(["\'])([^"\']+)\1/i', $tag, $u ) ) {
		continue;
	}
	if ( preg_match( '/\b(?:defer|async)\b/i', $tag ) || stripos( $tag, 'text/plain' ) !== false ) {
		continue;
	}
	++$blocking;
	echo 'BLOCK ' . basename( (string) parse_url( $u[2], PHP_URL_PATH ) ) . PHP_EOL;
}
echo 'blocking_src=' . $blocking . PHP_EOL;
if ( preg_match( '/id="neo-pulse-first-paint">([^<]+)</', $h, $fp ) ) {
	echo 'FIRST_PAINT ' . $fp[1] . PHP_EOL;
}
if ( preg_match( '/<img[^>]+WordPress_blue_logo[^>]*>/i', $h, $img ) ) {
	echo 'LOGO_TAG ' . $img[0] . PHP_EOL;
}
