<?php
/**
 * Research browser job registry (GitHub Actions).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Research_Job_Registry {

	/** @var array<string,array<string,mixed>> */
	private static $jobs = array(
		'local_dominator_export' => array(
			'workflow' => 'research-browser-job.yml',
			'label'    => 'Local Dominator grid export',
		),
	);

	public static function is_valid( string $job_key ): bool {
		return isset( self::$jobs[ sanitize_key( $job_key ) ] );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( string $job_key ): ?array {
		$key = sanitize_key( $job_key );
		return self::$jobs[ $key ] ?? null;
	}

	public static function workflow_file_for( string $job_key ): string {
		$meta = self::get( $job_key );
		return $meta ? (string) $meta['workflow'] : '';
	}
}
