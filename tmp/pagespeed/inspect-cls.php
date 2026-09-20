<?php
$h = file_get_contents( $argv[1] );
echo 'first_paint=' . ( str_contains( $h, 'id="neo-pulse-first-paint"' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'h1_clamp=' . ( str_contains( $h, 'clamp(2.1rem' ) ? 'yes' : 'no' ) . PHP_EOL;
preg_match_all( '/<link[^>]+rel=["\']stylesheet["\'][^>]*>/i', $h, $css );
$block = 0;
$defer = 0;
foreach ( $css[0] as $tag ) {
	$href = preg_match( '/href=["\']([^"\']+)/', $tag, $u ) ? $u[1] : '';
	$short = preg_replace( '#https?://[^/]+#', '', $href );
	if ( stripos( $tag, 'media="print"' ) !== false && stripos( $tag, 'onload=' ) !== false ) {
		$defer++;
		echo 'DEFER ' . $short . PHP_EOL;
	} else {
		$block++;
		echo 'BLOCK ' . $short . PHP_EOL;
	}
}
echo "blocking={$block} deferred={$defer}\n";
