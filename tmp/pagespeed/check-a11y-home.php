<?php
define( 'ABSPATH', __DIR__ );
function esc_attr( $t ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
function wp_strip_all_tags( $t ) { return trim( html_entity_decode( strip_tags( (string) $t ), ENT_QUOTES, 'UTF-8' ) ); }
require_once dirname( __DIR__, 2 ) . '/wordpress-plugins/neo-pulse-wp/includes/class-neo-pulse-wp-a11y-front.php';
$html = file_get_contents( __DIR__ . '/home-guest3.html' );
$out = Neo_Pulse_Wp_A11y_Front::process( $html );
preg_match_all( '/<a class="box-wrapper-link"[^>]*>/', $out, $boxes );
preg_match_all( '/<a class="link-arrow"[^>]*>/', $out, $arrows );
$unnamed_box = 0;
foreach ( $boxes[0] as $tag ) {
	if ( strpos( $tag, 'aria-label=' ) === false ) {
		$unnamed_box++;
	}
}
$unnamed_arrow = 0;
foreach ( $arrows[0] as $tag ) {
	if ( strpos( $tag, 'aria-label=' ) === false ) {
		$unnamed_arrow++;
	}
}
echo "boxes=" . count( $boxes[0] ) . " unnamed={$unnamed_box}\n";
echo "arrows=" . count( $arrows[0] ) . " unnamed={$unnamed_arrow}\n";
echo "open-menu=" . ( strpos( $out, 'aria-label="Open menu"' ) !== false ? 'yes' : 'no' ) . "\n";
echo "skip=" . ( strpos( $out, 'neo-pulse-skip-link' ) !== false ? 'yes' : 'no' ) . "\n";
echo "h5-about=" . ( strpos( $out, '<h5 class="elementor-heading-title elementor-size-default">About Us</h5>' ) !== false ? 'still' : 'demoted' ) . "\n";
echo implode( "\n", $boxes[0] ) . "\n";
echo implode( "\n", array_slice( $arrows[0], 0, 3 ) ) . "\n";
