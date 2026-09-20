<?php
$h = file_get_contents( getenv( 'TEMP' ) . '/nd-home-fcp203.html' );
$img = strpos( $h, 'edmonton.png' );
$head_end = stripos( $h, '</head>' );
echo 'head_end=' . $head_end . PHP_EOL;
echo 'img_pos=' . $img . PHP_EOL;
preg_match_all( '/<link[^>]+rel=["\']stylesheet["\'][^>]*>/i', $h, $css, PREG_OFFSET_CAPTURE );
foreach ( $css[0] as $row ) {
	if ( stripos( $row[0], 'media="print"' ) !== false ) {
		continue;
	}
	echo 'BLOCK pos=' . $row[1] . ' after_img=' . ( $row[1] > $img ? 'yes' : 'NO' ) . PHP_EOL;
}
echo 'h1_has_invisible_class=' . ( preg_match( '/a71df32[^>]*elementor-invisible/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'head_blocking=' . substr_count( substr( $h, 0, $head_end ), 'rel="stylesheet"' ) - substr_count( substr( $h, 0, $head_end ), 'media="print"' ) . PHP_EOL;
