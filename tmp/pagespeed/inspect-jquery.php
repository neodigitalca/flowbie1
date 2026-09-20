<?php
$h = file_get_contents( getenv( 'TEMP' ) . '/nd-home-cls204.html' );
if ( ! is_string( $h ) || $h === '' ) {
	$h = file_get_contents( 'php://stdin' );
}
preg_match_all( '#<script\b[^>]*>.*?</script>#is', $h, $scripts );
$i = 0;
foreach ( $scripts[0] as $s ) {
	if ( stripos( $s, 'jquery' ) !== false || ( stripos( $s, '<script' ) !== false && stripos( $s, 'src=' ) === false && $i < 8 ) ) {
		echo '--- ' . $i . " ---\n" . substr( preg_replace( '/\s+/', ' ', $s ), 0, 280 ) . "\n";
	}
	$i++;
}
echo 'script_count=' . count( $scripts[0] ) . PHP_EOL;
echo 'head_jquery=' . ( preg_match( '/<head[\s\S]*jquery\.min\.js[\s\S]*<\/head>/i', $h ) ? 'yes' : 'no' ) . PHP_EOL;
