<?php
/**
 * Persist Semrush overview / audit JSON next to SERP dumps.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Semrush_Overview_Json {

	public static function dumps_dir(): string {
		return Neo_Pulse_App_Data_Paths::subdir( 'serp-dumps' );
	}

	public static function is_safe_overview_filename( string $filename ): bool {
		return (bool) preg_match( '/^sem_rush__[a-zA-Z0-9._-]+\.json$/', $filename );
	}

	public static function is_safe_audit_filename( string $filename ): bool {
		return (bool) preg_match( '/^sem_rush__(audit__)?[a-zA-Z0-9._-]+\.json$/', $filename );
	}

	/**
	 * @param array<string,mixed> $semrush
	 */
	public static function write_overview( string $page_url, string $seed_keyword, array $semrush ): string {
		$ts     = gmdate( 'Y-m-d\TH-i-s-\Z' );
		$suffix = bin2hex( random_bytes( 4 ) );
		$name   = 'sem_rush__' . $ts . '__' . $suffix . '.json';
		$path   = self::dumps_dir() . '/' . $name;

		$ext = array();
		if ( ! empty( $semrush['externalSemrushUrls'] ) && is_array( $semrush['externalSemrushUrls'] ) ) {
			$ext = $semrush['externalSemrushUrls'];
		}

		Neo_Pulse_App_Json_File_Store::write(
			$path,
			array(
				'generatedAt'         => gmdate( 'c' ),
				'url'                 => $page_url,
				'acfKeyword'          => $seed_keyword,
				'semrush'             => $semrush,
				'externalSemrushUrls' => $ext,
			)
		);

		return $name;
	}

	/**
	 * @param array<string,mixed> $payload
	 */
	public static function write_audit( string $page_url, string $project_id, array $payload ): string {
		$ts     = gmdate( 'Y-m-d\TH-i-s-\Z' );
		$suffix = bin2hex( random_bytes( 4 ) );
		$name   = 'sem_rush__audit__' . $ts . '__' . $suffix . '.json';
		$path   = self::dumps_dir() . '/' . $name;

		Neo_Pulse_App_Json_File_Store::write(
			$path,
			array_merge(
				array(
					'generatedAt' => gmdate( 'c' ),
					'pageUrl'     => $page_url,
					'projectId'   => $project_id,
				),
				$payload
			)
		);

		return $name;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function read( string $filename ): ?array {
		if ( ! self::is_safe_audit_filename( $filename ) ) {
			return null;
		}

		$path = self::dumps_dir() . '/' . $filename;
		$real = realpath( $path );
		$base = realpath( self::dumps_dir() );
		if ( $real === false || $base === false || strpos( $real, $base ) !== 0 ) {
			return null;
		}

		$data = Neo_Pulse_App_Json_File_Store::read( $real );
		return is_array( $data ) ? $data : null;
	}

	/**
	 * @param array<string,mixed> $doc
	 */
	public static function compact_audit_context( array $doc, int $max_chars = 120000 ): array {
		$compact = array(
			'pageUrl'     => $doc['pageUrl'] ?? null,
			'pageid'      => $doc['pageid'] ?? null,
			'errors'      => $doc['errors'] ?? null,
			'pageInfo'    => $doc['pageInfo'] ?? null,
			'projectInfo' => $doc['projectInfo'] ?? null,
		);
		$context   = wp_json_encode( $compact, JSON_UNESCAPED_SLASHES );
		$truncated = false;
		if ( is_string( $context ) && strlen( $context ) > $max_chars ) {
			$context   = substr( $context, 0, $max_chars ) . "\n\n[TRUNCATED]";
			$truncated = true;
		}
		return array(
			'context'   => $context,
			'truncated' => $truncated,
		);
	}
}
