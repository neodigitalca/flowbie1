<?php
$path = $argv[1] ?? ( getenv( 'TEMP' ) . '/nd-home-tbt.html' );
$h    = file_get_contents( $path );
$head_end = stripos( $h, '</head>' );
$head = $head_end === false ? $h : substr( $h, 0, $head_end );

echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'head_end=' . ( $head_end === false ? 'missing' : $head_end ) . PHP_EOL;
echo 'print_onload=' . substr_count( $h, "onload=\"this.media='all'\"" ) . PHP_EOL;

preg_match_all( '#<script\b([^>]*)>#i', $h, $scripts, PREG_SET_ORDER );
$blocking = 0;
$deferred = 0;
$delayed  = 0;
foreach ( $scripts as $s ) {
	$tag = $s[0];
	if ( ! preg_match( '/\bsrc=(["\'])([^"\']+)\1/i', $tag, $u ) ) {
		continue;
	}
	$url = $u[2];
	$flag = 'BLOCK';
	if ( preg_match( '/\b(?:defer|async)\b/i', $tag ) ) {
		$flag = 'defer';
		$deferred++;
	} else {
		$blocking++;
	}
	$path_only = (string) parse_url( $url, PHP_URL_PATH );
	$in_head   = ( $head_end !== false && strpos( $h, $tag ) !== false && strpos( $h, $tag ) < $head_end ) ? 'HEAD' : 'BODY';
	echo $flag . ' ' . $in_head . ' ' . basename( $path_only ) . ' ' . $path_only . PHP_EOL;
}
echo "blocking_src={$blocking} deferred_src={$deferred}\n";

if ( preg_match( '/id="neo-pulse-first-paint">([^<]+)</', $h, $fp ) ) {
	echo 'FIRST_PAINT ' . $fp[1] . PHP_EOL;
}
if ( preg_match( '/WordPress_blue_logo[^"\']+/', $h, $logo ) ) {
	echo 'LOGO ' . $logo[0] . PHP_EOL;
}
if ( preg_match( '/<img[^>]+WordPress_blue_logo[^>]*>/i', $h, $img ) ) {
	echo 'LOGO_TAG ' . $img[0] . PHP_EOL;
}
