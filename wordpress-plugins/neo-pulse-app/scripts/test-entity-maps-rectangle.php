<?php
/**
 * CLI helper for entity map parser tests.
 *
 * Usage:
 *   php scripts/test-entity-maps-rectangle.php <fixture.json>
 *   php scripts/test-entity-maps-rectangle.php --keyword "Meadowlark Park, Edmonton, AB"
 */

if ( php_sapi_name() !== 'cli' ) {
	exit( 1 );
}

define( 'ABSPATH', true );

if ( ! function_exists( 'wp_json_encode' ) ) {
	/**
	 * @param mixed $data
	 */
	function wp_json_encode( $data ) {
		return json_encode( $data );
	}
}

require_once dirname( __DIR__ ) . '/includes/maps/class-entity-maps-image.php';

$fixture = $argv[1] ?? '';
if ( $fixture === '--keyword' ) {
	$entity = isset( $argv[2] ) ? (string) $argv[2] : '';
	echo wp_json_encode( Neo_Pulse_App_Entity_Maps_Image::serp_keyword_for_entity( $entity ) );
	exit( 0 );
}

if ( $fixture === '--keywords' ) {
	$entity = isset( $argv[2] ) ? (string) $argv[2] : '';
	echo wp_json_encode( Neo_Pulse_App_Entity_Maps_Image::serp_keywords_for_entity( $entity ) );
	exit( 0 );
}

if ( $fixture === '--city-labels' ) {
	$entity = isset( $argv[2] ) ? (string) $argv[2] : '';
	echo wp_json_encode( Neo_Pulse_App_Entity_Maps_Image::city_labels_for_entity( $entity ) );
	exit( 0 );
}

if ( $fixture === '--fallback-rect' ) {
	$img_w = isset( $argv[2] ) ? (int) $argv[2] : 0;
	$img_h = isset( $argv[3] ) ? (int) $argv[3] : 0;
	echo wp_json_encode( Neo_Pulse_App_Entity_Maps_Image::fallback_city_screenshot_rectangle( $img_w, $img_h ) );
	exit( 0 );
}

if ( $fixture === '' || ! is_readable( $fixture ) ) {
	fwrite( STDERR, "Fixture path required\n" );
	exit( 2 );
}

$raw  = file_get_contents( $fixture );
$data = json_decode( $raw, true );
if ( ! is_array( $data ) ) {
	fwrite( STDERR, "Invalid fixture JSON\n" );
	exit( 3 );
}

$rect = Neo_Pulse_App_Entity_Maps_Image::extract_map_rectangle( $data );
echo wp_json_encode( $rect );
