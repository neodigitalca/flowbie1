<?php
$files = array(
	'poppins'  => getenv( 'TEMP' ) . '/poppins.css',
	'fa-solid' => getenv( 'TEMP' ) . '/fa-solid.css',
	'combined' => getenv( 'TEMP' ) . '/combined.css',
);
foreach ( $files as $name => $path ) {
	if ( ! is_readable( $path ) ) {
		echo $name . " missing\n";
		continue;
	}
	$css = file_get_contents( $path );
	echo $name . ' bytes=' . strlen( $css ) . PHP_EOL;
	echo $name . ' font-display=' . preg_match_all( '/font-display\s*:/i', $css ) . PHP_EOL;
	echo $name . ' fa-light=' . ( str_contains( $css, 'fa-light' ) ? 'yes' : 'no' ) . PHP_EOL;
	echo $name . ' fontawesome/=' . ( str_contains( $css, 'fontawesome/' ) ? 'yes' : 'no' ) . PHP_EOL;
	echo $name . ' webfonts/=' . ( str_contains( $css, 'webfonts/' ) ? 'yes' : 'no' ) . PHP_EOL;
	if ( preg_match_all( '/url\(([^)]+\.woff2)\)/i', $css, $m ) ) {
		foreach ( array_slice( array_unique( $m[1] ), 0, 8 ) as $u ) {
			echo $name . ' woff2=' . trim( $u, " \t\"'" ) . PHP_EOL;
		}
	}
	echo substr( $css, 0, 500 ) . PHP_EOL . "----\n";
}
