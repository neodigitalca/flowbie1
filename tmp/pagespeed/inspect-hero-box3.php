<?php
$c = file_get_contents( getenv( 'TEMP' ) . '/combined-209.css' );
$needles = array(
	'--padding-top:10rem;--padding-bottom:3rem;--padding-left:5%;--padding-right:5%;',
	'--padding-top:14rem',
);
foreach ( $needles as $n ) {
	$p = strpos( $c, $n );
	echo "needle {$n} pos={$p}\n";
	if ( $p !== false ) {
		$before = substr( $c, max( 0, $p - 250 ), 250 );
		echo $before . "[[HIT]]\n\n";
	}
}
// last @media before the 10rem rule
$p = strpos( $c, '.elementor-55 .elementor-element.elementor-element-a3d0229{--padding-top:10rem' );
if ( $p !== false ) {
	$chunk = substr( $c, max( 0, $p - 2000 ), 2000 );
	if ( preg_match_all( '/@media[^{]+\{/', $chunk, $mm ) ) {
		echo "nearby media:\n";
		foreach ( $mm[0] as $m ) {
			echo $m . "\n";
		}
	}
}
