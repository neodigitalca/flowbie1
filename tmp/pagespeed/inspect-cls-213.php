<?php
$h = file_get_contents( getenv( 'TEMP' ) . '/nd-home-cls.html' );
$head_end = stripos( $h, '</head>' );
$head = $head_end === false ? $h : substr( $h, 0, $head_end );

echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'font_preload=' . ( preg_match( '/rel="preload" as="font"/i', $head ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'poppins_print=' . ( preg_match( '/poppins\.css[^>]+media="print"|poppins[^"]+\.css[^>]+media="print"/i', $head ) ? 'yes' : 'no' ) . PHP_EOL;
if ( preg_match( '/id="neo-pulse-first-paint">([^<]+)</', $h, $fp ) ) {
	echo 'FIRST_PAINT ' . $fp[1] . PHP_EOL;
}

preg_match_all( '#<img\b[^>]*>#i', substr( $h, 0, 120000 ), $imgs );
$n = 0;
foreach ( $imgs[0] as $tag ) {
	$has_w = preg_match( '/\bwidth=/i', $tag );
	$has_h = preg_match( '/\bheight=/i', $tag );
	$src = preg_match( '/\bsrc=(["\'])([^"\']+)\1/i', $tag, $u ) ? basename( (string) parse_url( $u[2], PHP_URL_PATH ) ) : '?';
	if ( ! $has_w || ! $has_h || $n < 8 ) {
		echo ( $has_w && $has_h ? 'OK' : 'NO_DIM' ) . ' ' . $src . PHP_EOL;
	}
	$n++;
	if ( $n >= 15 ) {
		break;
	}
}

if ( preg_match( '/<h1\b[^>]*>[\s\S]{0,200}<\/h1>/i', $h, $h1 ) ) {
	echo 'H1 ' . trim( strip_tags( $h1[0] ) ) . PHP_EOL;
}
