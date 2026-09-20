<?php
$h = file_get_contents( getenv( 'TEMP' ) . '/nd-home-fcp203.html' );
$mains = array();
$offset = 0;
while ( ( $p = stripos( $h, '<main', $offset ) ) !== false ) {
	$mains[] = $p;
	$offset  = $p + 5;
}
echo 'main_count=' . count( $mains ) . ' pos=' . implode( ',', $mains ) . PHP_EOL;
$h1 = strpos( $h, '<h1 class="elementor-heading-title' );
echo 'h1_pos=' . $h1 . PHP_EOL;
echo 'h1_minus_main0=' . ( $h1 - ( $mains[0] ?? 0 ) ) . PHP_EOL;
$around = substr( $h, max( 0, $h1 - 400 ), 500 );
echo "AROUND_H1\n" . $around . "\n";
preg_match_all( '/<link[^>]+rel=["\']stylesheet["\'][^>]*>/i', $h, $css, PREG_OFFSET_CAPTURE );
foreach ( $css[0] as $row ) {
	$tag = $row[0];
	$pos = $row[1];
	$where = $pos < stripos( $h, '</head>' ) ? 'HEAD' : ( $pos < $h1 ? 'BEFORE_H1' : 'AFTER_H1' );
	$def = ( stripos( $tag, 'media="print"' ) !== false ) ? 'defer' : 'BLOCK';
	if ( $def === 'BLOCK' || $where === 'BEFORE_H1' ) {
		preg_match( '/href=["\']([^"\']+)/', $tag, $u );
		echo $def . ' ' . $where . ' ' . ( $u[1] ?? '' ) . PHP_EOL;
	}
}
