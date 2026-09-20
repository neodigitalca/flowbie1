<?php
$h = file_get_contents( $argv[1] );
echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'first_paint=' . ( str_contains( $h, 'id="neo-pulse-first-paint"' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'h1_invisible_widget=' . ( str_contains( $h, 'elementor-invisible elementor-widget elementor-widget-heading' ) ? 'yes' : 'no' ) . PHP_EOL;
preg_match_all( '/<link[^>]+rel=["\']stylesheet["\'][^>]*>/i', $h, $css );
$block = 0;
$defer = 0;
foreach ( $css[0] as $tag ) {
	if ( stripos( $tag, 'media="print"' ) !== false && stripos( $tag, 'onload=' ) !== false ) {
		$defer++;
	} else {
		$block++;
		if ( preg_match( '/href=["\']([^"\']+)/', $tag, $u ) ) {
			echo 'BLOCK ' . $u[1] . PHP_EOL;
		}
	}
}
echo 'blocking_css=' . $block . PHP_EOL;
echo 'deferred_css=' . $defer . PHP_EOL;
if ( preg_match( '/<h1[^>]*>[\s\S]{0,180}<\/h1>/i', $h, $h1 ) ) {
	echo 'H1 ' . trim( preg_replace( '/\s+/', ' ', $h1[0] ) ) . PHP_EOL;
}
echo 'edmonton_eager=' . ( preg_match( '/edmonton\.png[^>]*(fetchpriority="high"|loading="eager")/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
