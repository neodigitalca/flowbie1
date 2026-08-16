<?php
/**
 * Automation trigger block catalog (blocks/triggers/*.json).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Automation_Trigger_Registry {

	/** @var array<string,array<string,mixed>>|null */
	private static $blocks = null;

	public static function blocks_dir(): string {
		return NEO_PULSE_APP_PLUGIN_DIR . 'includes/automation-recipes/blocks/triggers';
	}

	/**
	 * @return array<string,array<string,mixed>>
	 */
	public static function all(): array {
		if ( is_array( self::$blocks ) ) {
			return self::$blocks;
		}

		self::$blocks = array();
		$dir          = self::blocks_dir();
		if ( ! is_dir( $dir ) ) {
			return self::$blocks;
		}

		$files = glob( $dir . '/*.json' );
		if ( ! is_array( $files ) ) {
			return self::$blocks;
		}

		foreach ( $files as $file ) {
			if ( ! is_string( $file ) || ! is_readable( $file ) ) {
				continue;
			}
			$raw = file_get_contents( $file );
			if ( ! is_string( $raw ) || trim( $raw ) === '' ) {
				continue;
			}
			$data = json_decode( $raw, true );
			if ( ! is_array( $data ) ) {
				continue;
			}
			$kw = sanitize_title( (string) ( $data['keyword'] ?? '' ) );
			if ( $kw === '' ) {
				continue;
			}
			self::$blocks[ $kw ] = $data;
		}

		ksort( self::$blocks );
		return self::$blocks;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_for_api(): array {
		$out = array();
		foreach ( self::all() as $block ) {
			$out[] = $block;
		}
		return $out;
	}

	public static function get_by_keyword( string $keyword ): ?array {
		$keyword = sanitize_title( $keyword );
		if ( $keyword === '' ) {
			return null;
		}
		$all = self::all();
		return $all[ $keyword ] ?? null;
	}
}
