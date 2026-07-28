<?php
/**
 * Persist Overview SEO briefs under flowbie-data/seo-briefs/.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Overview_Seo_Brief {

	const MAX_BYTES = 524288;

	public static function briefs_dir(): string {
		return Flowbie_App_Data_Paths::subdir( 'seo-briefs' );
	}

	public static function is_safe_filename( string $filename ): bool {
		return (bool) preg_match( '/^seo_brief__[a-zA-Z0-9._-]+\.(json|md)$/', $filename );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function save( array $body ): array {
		$content = isset( $body['content'] ) ? (string) $body['content'] : '';
		if ( trim( $content ) === '' ) {
			return array( 'statusCode' => 400, 'body' => array( 'error' => 'content is required' ) );
		}
		if ( strlen( $content ) > self::MAX_BYTES ) {
			return array( 'statusCode' => 400, 'body' => array( 'error' => 'content exceeds ' . self::MAX_BYTES . ' bytes' ) );
		}

		$ts     = str_replace( array( ':', '.' ), '-', gmdate( 'c' ) );
		$suffix = bin2hex( random_bytes( 4 ) );
		$parsed = json_decode( $content, true );
		if ( is_array( $parsed ) ) {
			$stored = "seo_brief__{$ts}__{$suffix}.json";
			$payload = wp_json_encode( $parsed, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
		} else {
			$stored  = "seo_brief__{$ts}__{$suffix}.md";
			$keyword = isset( $body['keyword'] ) ? trim( (string) $body['keyword'] ) : '';
			$header  = $keyword !== ''
				? "---\nkeyword: " . str_replace( array( "\r", "\n" ), ' ', $keyword ) . "\ngeneratedAt: " . gmdate( 'c' ) . "\n---\n\n"
				: "---\ngeneratedAt: " . gmdate( 'c' ) . "\n---\n\n";
			$payload = $header . $content;
		}

		$path = self::briefs_dir() . '/' . sanitize_file_name( $stored );
		file_put_contents( $path, $payload );
		return array( 'statusCode' => 200, 'body' => array( 'storedFile' => basename( $path ) ) );
	}

	/** @return array{statusCode:int,body?:array<string,mixed>,file?:string,contentType?:string} */
	public static function serve( string $filename ): array {
		if ( ! self::is_safe_filename( $filename ) ) {
			return array( 'statusCode' => 400, 'body' => array( 'error' => 'Invalid filename' ) );
		}
		$path = self::briefs_dir() . '/' . sanitize_file_name( $filename );
		if ( ! is_readable( $path ) ) {
			return array( 'statusCode' => 404, 'body' => array( 'error' => 'File not found' ) );
		}
		$is_json = substr( $filename, -5 ) === '.json';
		return array(
			'statusCode'  => 200,
			'file'        => $path,
			'contentType' => $is_json ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8',
		);
	}
}
