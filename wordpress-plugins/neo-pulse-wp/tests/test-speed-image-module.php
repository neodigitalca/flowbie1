<?php
/**
 * Smoke tests for Speed image optimization (run: php tests/test-speed-image-module.php)
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );

if ( ! function_exists( 'apply_filters' ) ) {
	/**
	 * @param mixed $value Value.
	 * @return mixed
	 */
	function apply_filters( $hook, $value ) { // phpcs:ignore
		unset( $hook );
		return $value;
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	/**
	 * @param string $key Key.
	 */
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	/**
	 * @param string $str String.
	 */
	function sanitize_text_field( $str ) {
		return trim( (string) $str );
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {
	/**
	 * @param array<string, mixed> $args Args.
	 * @param array<string, mixed> $defaults Defaults.
	 * @return array<string, mixed>
	 */
	function wp_parse_args( $args, $defaults = array() ) {
		return array_merge( $defaults, $args );
	}
}

if ( ! function_exists( 'wp_normalize_path' ) ) {
	/**
	 * @param string $path Path.
	 */
	function wp_normalize_path( $path ) {
		return str_replace( '\\', '/', $path );
	}
}

require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-speed-image-settings.php';
require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-speed-image-stats.php';
require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-speed-image-delivery.php';

$failed = 0;

/**
 * @param bool   $cond Condition.
 * @param string $msg Message.
 */
function assert_true( bool $cond, string $msg ): void {
	global $failed;
	if ( ! $cond ) {
		echo "FAIL: {$msg}\n";
		$failed++;
	} else {
		echo "OK: {$msg}\n";
	}
}

$config = Neo_Pulse_Wp_Speed_Image_Settings::sanitize_config(
	array(
		'enabled'         => 1,
		'jpeg_quality'    => 200,
		'png_compression' => 99,
		'max_width'       => -5,
		'optimize_sizes'  => 'invalid',
		'skip_mimes'      => "image/gif\nnot-a-mime\nimage/svg+xml",
	)
);
assert_true( ! empty( $config['enabled'] ), 'image enabled sanitized' );
assert_true( 100 === (int) $config['jpeg_quality'], 'jpeg quality capped at 100' );
assert_true( 9 === (int) $config['png_compression'], 'png compression capped at 9' );
assert_true( 0 === (int) $config['max_width'], 'max width floored at 0' );
assert_true( 'full' === $config['optimize_sizes'], 'invalid optimize_sizes becomes full' );
assert_true( strpos( $config['skip_mimes'], 'image/gif' ) !== false, 'skip mimes keeps image/*' );
assert_true( strpos( $config['skip_mimes'], 'not-a-mime' ) === false, 'skip mimes drops invalid lines' );

$mime_ok = Neo_Pulse_Wp_Speed_Image_Settings::sanitize_config(
	array( 'skip_mimes' => 'image/gif' )
);
// Stub skip_mime_list by testing is_supported via optimizer - load optimizer needs WP functions.
// Test delivery accept header only.
$_SERVER['HTTP_ACCEPT'] = 'text/html,image/webp,*/*';
assert_true( Neo_Pulse_Wp_Speed_Image_Delivery::client_accepts_webp(), 'accepts webp when header present' );
$_SERVER['HTTP_ACCEPT'] = 'image/jpeg';
assert_true( ! Neo_Pulse_Wp_Speed_Image_Delivery::client_accepts_webp(), 'rejects webp without header' );

$tmpdir  = sys_get_temp_dir() . '/neo-pulse-img-test';
$basedir = $tmpdir . '/uploads';
@mkdir( $basedir, 0777, true );
$testfile = $basedir . '/photo.jpg';
file_put_contents( $testfile, 'fake' );

if ( ! function_exists( 'wp_get_upload_dir' ) ) {
	/**
	 * @return array<string, string>
	 */
	function wp_get_upload_dir() {
		global $basedir;
		return array(
			'basedir' => $basedir,
			'baseurl' => 'https://example.com/wp-content/uploads',
		);
	}
}

$url = Neo_Pulse_Wp_Speed_Image_Delivery::path_to_url( $testfile );
assert_true( is_string( $url ) && strpos( $url, 'photo.jpg' ) !== false, 'path_to_url maps under uploads' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll image speed tests passed.\n";
exit( $failed > 0 ? 1 : 0 );
