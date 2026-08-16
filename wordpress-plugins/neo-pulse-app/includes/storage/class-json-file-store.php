<?php
/**
 * Atomic JSON read/write for neo-pulse-data files.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Json_File_Store {

	/**
	 * @return array<string,mixed>|array<int,mixed>|null
	 */
	public static function read( string $path ) {
		if ( ! is_readable( $path ) ) {
			return null;
		}
		$raw = file_get_contents( $path );
		if ( $raw === false || $raw === '' ) {
			return null;
		}
		$data = json_decode( $raw, true );
		return is_array( $data ) ? $data : null;
	}

	/**
	 * @param mixed $data
	 */
	public static function write( string $path, $data ): bool {
		$dir = dirname( $path );
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
		}
		$json = wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
		if ( $json === false ) {
			return false;
		}
		$tmp = $path . '.tmp.' . wp_generate_password( 8, false );
		if ( file_put_contents( $tmp, $json ) === false ) {
			return false;
		}
		return rename( $tmp, $path );
	}
}
