<?php
$h = file_get_contents( getenv( 'TEMP' ) . '/nd-home-fcp.html' );
if ( preg_match( '/<h1[^>]*>[\s\S]*?<\/h1>/i', $h, $m, PREG_OFFSET_CAPTURE ) ) {
	$pos = $m[0][1];
	echo substr( $h, max( 0, $pos - 2500 ), 3500 );
}
echo "\n----\n";
preg_match_all( '/elementor-invisible[^"]*"/', $h, $inv );
echo 'invisible_samples=' . count( $inv[0] ) . PHP_EOL;
foreach ( array_slice( $inv[0], 0, 8 ) as $s ) {
	echo $s . PHP_EOL;
}
