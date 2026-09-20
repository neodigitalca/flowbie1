<?php
$c = file_get_contents( getenv( 'TEMP' ) . '/combined.css' );
foreach ( array( 'fa-brands-400', 'fa-light-300', 'fa-regular-400', 'fa-solid-900' ) as $file ) {
	$pos = strpos( $c, $file );
	if ( $pos === false ) {
		echo $file . " missing\n";
		continue;
	}
	$chunk = substr( $c, max( 0, $pos - 180 ), 360 );
	echo "==== {$file} ====\n{$chunk}\n";
}

$h = file_get_contents( getenv( 'TEMP' ) . '/nd-home-fonts.html' );
if ( preg_match( '/a71df32[\s\S]{0,500}font-family[^;]{0,80}/', $h, $m ) ) {
	echo "HEADING {$m[0]}\n";
}
if ( preg_match( '/elementor-element-a71df32\{[^}]{0,400}\}/', $h, $m ) ) {
	echo "A71 {$m[0]}\n";
}
if ( preg_match( '/\.elementor-149[\s\S]{0,80}a71df32[\s\S]{0,300}/', $h, $m ) ) {
	echo "POST {$m[0]}\n";
}
