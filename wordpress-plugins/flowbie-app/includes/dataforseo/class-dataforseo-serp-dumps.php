<?php
/**
 * SERP JSON dump read/write under uploads/flowbie-data/serp-dumps/.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Dataforseo_Serp_Dumps {

	public static function dir(): string {
		return Flowbie_App_Data_Paths::subdir( 'serp-dumps' );
	}

	public static function is_safe_filename( string $filename ): bool {
		return $filename !== '' && (bool) preg_match( '/^[a-zA-Z0-9._-]+$/', $filename );
	}

	public static function path_for( string $filename ): string {
		$filename = sanitize_file_name( $filename );
		return self::dir() . '/' . $filename;
	}

	/**
	 * @return string|null Stored filename or null on failure.
	 */
	public static function write( string $keyword_hint, array $payload ): ?string {
		$safe = preg_replace( '/[^a-z0-9\-_.]+/i', '_', trim( $keyword_hint ) );
		$safe = substr( $safe !== '' ? $safe : 'keyword', 0, 80 );
		$ts   = gmdate( 'Y-m-d\TH-i-s-\Z' );
		$name = $safe . '__' . $ts . '.json';
		$path = self::path_for( $name );

		if ( ! Flowbie_App_Json_File_Store::write( $path, $payload ) ) {
			return null;
		}
		return $name;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function read( string $filename ): ?array {
		if ( ! self::is_safe_filename( $filename ) ) {
			return null;
		}
		$path = self::path_for( $filename );
		$real = realpath( $path );
		$base = realpath( self::dir() );
		if ( $real === false || $base === false || strpos( $real, $base ) !== 0 ) {
			return null;
		}
		$data = Flowbie_App_Json_File_Store::read( $real );
		return is_array( $data ) ? $data : null;
	}

	public static function exists( string $filename ): bool {
		return self::read( $filename ) !== null;
	}
}
