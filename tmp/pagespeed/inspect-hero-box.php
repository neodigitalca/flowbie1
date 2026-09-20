<?php
$c = file_get_contents( getenv( 'TEMP' ) . '/combined-209.css' );
if ( ! is_string( $c ) || $c === '' ) {
	$c = file_get_contents( getenv( 'TEMP' ) . '/nd-home-tbt.html' );
}
$pos = 0;
$n   = 0;
while ( ( $p = stripos( $c, 'a3d0229', $pos ) ) !== false && $n < 8 ) {
	echo "==== hit {$n} ====\n";
	echo substr( $c, max( 0, $p - 80 ), 420 ) . "\n";
	$pos = $p + 7;
	$n++;
}
