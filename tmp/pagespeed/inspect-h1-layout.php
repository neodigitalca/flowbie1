<?php
$c = file_get_contents( getenv( 'TEMP' ) . '/layout-212.css' );
if ( preg_match_all( '/[^{}]*a71df32[^{]*\{[^}]+\}/', $c, $m ) ) {
	foreach ( $m[0] as $i => $rule ) {
		echo "RULE {$i}\n{$rule}\n\n";
	}
}
