<?php
$path = $argv[1] ?? ( getenv( 'TEMP' ) . '/nd-home-fonts.html' );
$h    = file_get_contents( $path );
$head_end = stripos( $h, '</head>' );
$head = $head_end === false ? $h : substr( $h, 0, $head_end );

echo 'bytes=' . strlen( $h ) . PHP_EOL;
echo 'first_paint=' . ( str_contains( $h, 'id="neo-pulse-first-paint"' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'edmonton_preload=' . ( preg_match( '/preload[^>]+edmonton\.png/i', $head ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'edmonton_img=' . ( preg_match( '/<img[^>]+edmonton\.png[^>]*>/i', $h, $img ) ? $img[0] : 'missing' ) . PHP_EOL;

if ( preg_match( '/elementor-element-a3d0229[\s\S]{0,1200}/i', $h, $box ) ) {
	echo "----a3d0229----\n" . substr( $box[0], 0, 800 ) . PHP_EOL;
}

preg_match_all( '/<link\b[^>]*>/i', $head, $links );
foreach ( $links[0] as $tag ) {
	if ( preg_match( '/font|woff|awesome|poppins|roboto|preload/i', $tag ) ) {
		echo 'LINK ' . $tag . PHP_EOL;
	}
}

echo "----font hrefs----\n";
preg_match_all( '/href=(["\'])([^"\']*(?:fontawesome|font-awesome|webfonts|poppins|roboto|googleapis)[^"\']*)\1/i', $h, $fh );
foreach ( array_unique( $fh[2] ) as $href ) {
	echo $href . PHP_EOL;
}

echo "----h1----\n";
if ( preg_match( '/<h1\b[^>]*>[\s\S]{0,400}<\/h1>/i', $h, $h1 ) ) {
	echo $h1[0] . PHP_EOL;
}
