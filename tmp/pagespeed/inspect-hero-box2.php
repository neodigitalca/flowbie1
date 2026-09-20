<?php
$c = file_get_contents( getenv( 'TEMP' ) . '/combined-209.css' );
if ( preg_match_all( '/[^{}]*a3d0229[^{]*\{[^}]+\}/', $c, $m ) ) {
	foreach ( $m[0] as $i => $rule ) {
		if ( $i > 6 ) {
			break;
		}
		echo "RULE {$i}\n{$rule}\n\n";
	}
}
if ( preg_match_all( '/@media[^{]+\{(?:[^{}]|\{[^}]*\})*a3d0229(?:[^{}]|\{[^}]*\}){0,400}/', $c, $mm ) ) {
	echo "MEDIA count=" . count( $mm[0] ) . PHP_EOL;
	echo substr( $mm[0][0], 0, 800 ) . PHP_EOL;
}
