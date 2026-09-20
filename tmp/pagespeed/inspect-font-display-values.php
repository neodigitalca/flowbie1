<?php
$c = file_get_contents( getenv( 'TEMP' ) . '/combined.css' );
if ( preg_match_all( '/@font-face\{([^}]{0,400})\}/i', $c, $m ) ) {
	foreach ( $m[1] as $body ) {
		$family  = preg_match( '/font-family:([^;]+)/i', $body, $f ) ? trim( $f[1], " \t\"'" ) : '?';
		$display = preg_match( '/font-display:([^;]+)/i', $body, $d ) ? trim( $d[1] ) : 'MISSING';
		$src     = preg_match( '/woff2[^)]*\)/', $body, $s ) ? $s[0] : '';
		echo $family . ' display=' . $display . ' ' . $src . PHP_EOL;
	}
}

$p = file_get_contents( getenv( 'TEMP' ) . '/poppins.css' );
if ( preg_match_all( '/font-weight:\s*(\d+)[\s\S]{0,200}url\(([^)]+poppins-pxigyp8[^)]+\.woff2)\)/i', $p, $pm, PREG_SET_ORDER ) ) {
	foreach ( $pm as $row ) {
		echo 'poppins latin? weight=' . $row[1] . ' ' . $row[2] . PHP_EOL;
	}
}
if ( preg_match_all( '/@font-face \{([\s\S]*?)\}/', $p, $faces ) ) {
	foreach ( $faces[1] as $face ) {
		if ( ! str_contains( $face, 'unicode-range: U+0000-00FF' ) && ! str_contains( $face, 'unicode-range: U+0000' ) ) {
			continue;
		}
		if ( ! preg_match( '/font-style:\s*normal/', $face ) ) {
			continue;
		}
		$w = preg_match( '/font-weight:\s*(\d+)/', $face, $wm ) ? $wm[1] : '?';
		$u = preg_match( '/url\(([^)]+\.woff2)\)/', $face, $um ) ? $um[1] : '?';
		echo "LATIN normal w{$w} {$u}\n";
	}
}
