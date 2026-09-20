<?php
$h = file_get_contents( __DIR__ . '/home-guest5.html' );
foreach ( array( '64f68179', '0efac59', 'ygency-body', 'body{' ) as $id ) {
	echo "==== $id ====\n";
	$offset = 0;
	$n = 0;
	while ( ( $p = strpos( $h, $id, $offset ) ) !== false && $n < 6 ) {
		echo substr( $h, max( 0, $p - 80 ), 400 ) . "\n---\n";
		$offset = $p + strlen( $id );
		$n++;
	}
}
