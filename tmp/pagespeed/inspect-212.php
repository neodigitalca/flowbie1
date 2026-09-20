<?php
$h = file_get_contents( getenv( 'TEMP' ) . '/nd-home-212.html' );
$head_end = stripos( $h, '</head>' );
$head = $head_end === false ? $h : substr( $h, 0, $head_end );
echo 'waypoint_src=' . ( preg_match( '/<script[^>]+src=[^>]+neo-pulse-elementor-waypoint/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'waypoint_delay=' . ( preg_match( '/data-src="[^"]*neo-pulse-elementor-waypoint/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
$combined_print = 0;
if ( preg_match_all( '/<link[^>]+neo-pulse-speed\/css\/[^>]+>/i', $head, $m ) ) {
	foreach ( $m[0] as $tag ) {
		if ( stripos( $tag, 'stylesheet' ) !== false && preg_match( '/media=(["\'])print\1/i', $tag ) ) {
			++$combined_print;
			echo 'PRINT_COMBINED ' . $tag . PHP_EOL;
		}
		if ( stripos( $tag, 'stylesheet' ) !== false && ! preg_match( '/media=(["\'])print\1/i', $tag ) ) {
			echo 'BLOCK_COMBINED yes' . PHP_EOL;
		}
	}
}
echo 'combined_print=' . $combined_print . PHP_EOL;
echo 'style_preload=' . substr_count( $head, 'rel="preload" as="style"' ) . PHP_EOL;
echo 'delayed=' . substr_count( $h, 'data-neo-pulse-delay="1"' ) . PHP_EOL;
