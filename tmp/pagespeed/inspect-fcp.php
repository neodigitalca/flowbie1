<?php
$path = $argv[1] ?? '';
if ( $path === '' || ! is_readable( $path ) ) {
	fwrite( STDERR, "missing html\n" );
	exit( 1 );
}
$h = file_get_contents( $path );
echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'kb=' . round( strlen( $h ) / 1024, 1 ) . PHP_EOL;
preg_match( '/<head[\s\S]*?<\/head>/i', $h, $headm );
$head = $headm[0] ?? '';
echo 'head_kb=' . round( strlen( $head ) / 1024, 1 ) . PHP_EOL;
echo 'invisible=' . substr_count( $h, 'elementor-invisible' ) . PHP_EOL;
echo 'nitro-lazy=' . substr_count( $h, 'nitro-lazy' ) . PHP_EOL;
echo 'data_uri_src=' . preg_match_all( '/<img[^>]+src="data:image/', $h ) . PHP_EOL;

preg_match_all( '/<link[^>]+rel=["\']stylesheet["\'][^>]*>/i', $head, $css );
echo "blocking_css=" . count( $css[0] ) . PHP_EOL;
foreach ( $css[0] as $i => $tag ) {
	if ( preg_match( '/href=["\']([^"\']+)/', $tag, $u ) ) {
		echo 'CSS' . $i . ' ' . $u[1] . PHP_EOL;
	} else {
		echo 'CSS' . $i . ' inline-or-weird ' . substr( $tag, 0, 160 ) . PHP_EOL;
	}
}
preg_match_all( '/<style\b/i', $head, $st );
echo 'head_styles=' . count( $st[0] ) . PHP_EOL;
preg_match_all( '/<link[^>]+rel=["\']preload["\'][^>]*>/i', $head, $pl );
echo 'preloads=' . count( $pl[0] ) . PHP_EOL;
foreach ( $pl[0] as $p ) {
	echo 'PRELOAD ' . substr( preg_replace( '/\s+/', ' ', $p ), 0, 220 ) . PHP_EOL;
}

if ( preg_match( '/<h1[^>]*>[\s\S]{0,200}<\/h1>/i', $h, $h1 ) ) {
	echo 'H1 ' . trim( preg_replace( '/\s+/', ' ', $h1[0] ) ) . PHP_EOL;
	$pos = strpos( $h, $h1[0] );
	$before = substr( $h, max( 0, $pos - 800 ), 800 );
	echo 'H1_PARENT_INVISIBLE=' . ( str_contains( $before, 'elementor-invisible' ) ? 'yes' : 'no' ) . PHP_EOL;
	if ( preg_match( '/class="[^"]*elementor-element-[a-z0-9]+[^"]*"/i', $before, $cls ) ) {
		echo 'H1_NEAR_CLASS ' . $cls[0] . PHP_EOL;
	}
}

if ( preg_match( '/edmonton\.png[^"]*/', $h, $e ) ) {
	echo 'EDMONTON_HIT yes' . PHP_EOL;
}
if ( preg_match( '/<img[^>]+edmonton\.png[^>]*>/i', $h, $img ) ) {
	echo 'LCP_IMG ' . substr( preg_replace( '/\s+/', ' ', $img[0] ), 0, 400 ) . PHP_EOL;
	$pos = strpos( $h, $img[0] );
	$before = substr( $h, max( 0, $pos - 600 ), 600 );
	echo 'LCP_PARENT_INVISIBLE=' . ( str_contains( $before, 'elementor-invisible' ) ? 'yes' : 'no' ) . PHP_EOL;
}

echo 'visibility_hidden_css=' . ( preg_match( '/visibility\s*:\s*hidden/', $head ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'elementor-invisible_rule=' . ( str_contains( $head, 'elementor-invisible' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'opacity0=' . ( preg_match( '/\.elementor-invisible\{[^}]*opacity\s*:\s*0/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
