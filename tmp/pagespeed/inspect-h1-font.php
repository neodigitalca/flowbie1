<?php
$h = file_get_contents( getenv( 'TEMP' ) . '/nd-home-cls.html' );
$c = is_readable( getenv( 'TEMP' ) . '/combined-209.css' ) ? file_get_contents( getenv( 'TEMP' ) . '/combined-209.css' ) : $h;
foreach ( array( 'a71df32', 'a3d0229' ) as $id ) {
	$pos = 0;
	$n   = 0;
	while ( ( $p = stripos( $c, $id, $pos ) ) !== false && $n < 4 ) {
		$chunk = substr( $c, $p, 500 );
		if ( preg_match( '/font-|heading-title|typography/', $chunk ) ) {
			echo "==== {$id} {$n} ====\n{$chunk}\n\n";
		}
		$pos = $p + 7;
		$n++;
	}
}
if ( preg_match( '/\.elementor-55 \.elementor-element\.elementor-element-a71df32[^{]*\{[^}]+\}/', $c, $m ) ) {
	echo "RULE {$m[0]}\n";
}
if ( preg_match( '/a71df32[^{]*heading-title\{[^}]+\}/', $c, $m ) ) {
	echo "H1RULE {$m[0]}\n";
}
