<?php
$path = $argv[1] ?? ( getenv( 'TEMP' ) . '/nd-home-209.html' );
$h    = file_get_contents( $path );
$head_end = stripos( $h, '</head>' );
$head = $head_end === false ? $h : substr( $h, 0, $head_end );

echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'webp_in_html=' . ( str_contains( $h, 'edmonton-seo-command.webp' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'webp_preload=' . ( preg_match( '/preload[^>]+edmonton-seo-command\.webp/i', $head ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'webp_high=' . ( preg_match( '/edmonton-seo-command\.webp[^>]+fetchpriority="high"|fetchpriority="high"[^>]+edmonton-seo-command\.webp/i', $head ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'first_paint_bg=' . ( preg_match( '/id="neo-pulse-first-paint"[^>]*>[^<]*edmonton-seo-command\.webp/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'edmonton_png_preload=' . ( preg_match( '/preload[^>]+edmonton\.png/i', $head ) ? 'yes' : 'no' ) . PHP_EOL;

preg_match_all( '/<link\b[^>]+href=(["\'])([^"\']+)\1[^>]*>/i', $head, $links );
foreach ( $links[2] as $i => $href ) {
	$tag = $links[0][ $i ];
	if ( preg_match( '/font-awesome|fontawesome|webfonts|poppins|roboto|preload|neo-pulse-speed/i', $href . $tag ) ) {
		echo 'LINK ' . $tag . PHP_EOL;
	}
}

if ( preg_match( '/id="neo-pulse-first-paint">([^<]+)</', $h, $fp ) ) {
	echo 'FIRST_PAINT ' . $fp[1] . PHP_EOL;
}
