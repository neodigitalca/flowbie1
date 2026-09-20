<?php
$h = file_get_contents( $argv[1] );
echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'kb=' . round( strlen( $h ) / 1024, 1 ) . PHP_EOL;
preg_match( '/<head[\s\S]*?<\/head>/i', $h, $hm );
$head = $hm[0] ?? '';
echo 'head_kb=' . round( strlen( $head ) / 1024, 1 ) . PHP_EOL;
echo 'preload_pos=' . strpos( $h, 'edmonton.png' ) . PHP_EOL;
echo 'first_style_pos=' . stripos( $h, '<style' ) . PHP_EOL;
echo 'h1_pos=' . stripos( $h, '<h1' ) . PHP_EOL;
echo 'img_edmonton_pos=' . stripos( $h, 'src="https://neodigital.ca/wp-content/uploads/2026/02/edmonton.png"' ) . PHP_EOL;
preg_match_all( '/<style\b[^>]*>/i', $head, $st );
echo 'head_style_tags=' . count( $st[0] ) . PHP_EOL;
preg_match_all( '/<link[^>]+rel=["\']stylesheet["\'][^>]*>/i', $head, $css );
$block = 0;
foreach ( $css[0] as $tag ) {
	if ( stripos( $tag, 'media="print"' ) === false ) {
		$block++;
		if ( preg_match( '/href=["\']([^"\']+)/', $tag, $u ) ) {
			echo 'BLOCK ' . $u[1] . PHP_EOL;
		}
	}
}
echo 'head_blocking_css=' . $block . PHP_EOL;
echo 'head_jquery=' . ( str_contains( $head, 'jquery.min.js' ) ? 'yes' : 'no' ) . PHP_EOL;
if ( preg_match( '/<link[^>]+edmonton\.png[^>]*>/i', $head, $p ) ) {
	echo 'PRELOAD ' . substr( preg_replace( '/\s+/', ' ', $p[0] ), 0, 240 ) . PHP_EOL;
}
if ( preg_match( '/<img[^>]+edmonton\.png[^>]*>/i', $h, $img ) ) {
	echo 'LCP_IMG ' . substr( preg_replace( '/\s+/', ' ', $img[0] ), 0, 400 ) . PHP_EOL;
}
echo 'invisible_h1=' . ( preg_match( '/a71df32[^>]*elementor-invisible/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
