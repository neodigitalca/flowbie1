<?php
/**
 * Uploads paths for flowbie-data JSON and dumps.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Data_Paths {

	public static function root(): string {
		$upload = wp_upload_dir();
		$dir    = trailingslashit( $upload['basedir'] ) . 'flowbie-data';
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
			if ( ! file_exists( $dir . '/index.php' ) ) {
				file_put_contents( $dir . '/index.php', '<?php // silence' );
			}
		}
		return $dir;
	}

	public static function subdir( string $name ): string {
		$dir = self::root() . '/' . sanitize_file_name( $name );
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
			if ( ! file_exists( $dir . '/index.php' ) ) {
				file_put_contents( $dir . '/index.php', '<?php // silence' );
			}
		}
		return $dir;
	}

	public static function file( string $subdir, string $filename ): string {
		return self::subdir( $subdir ) . '/' . sanitize_file_name( $filename );
	}

	public static function sites_path(): string {
		return self::root() . '/sites.json';
	}

	public static function manager_settings_path(): string {
		return self::root() . '/manager-settings.json';
	}

	public static function active_site_path(): string {
		return self::root() . '/active-site-id.json';
	}

	public static function ga_service_account_path(): string {
		return self::root() . '/ga-service-account.json';
	}

	public static function gmb_oauth_config_path(): string {
		return self::root() . '/gmb-oauth.json';
	}

	public static function gmb_tokens_path(): string {
		return self::root() . '/gmb-tokens.json';
	}

	public static function vertical_benchmarks_dir(): string {
		return self::subdir( 'vertical-benchmarks' );
	}

	public static function vertical_benchmark_classifications_path(): string {
		return self::vertical_benchmarks_dir() . '/classifications.json';
	}

	public static function vertical_benchmark_export_path(): string {
		return self::vertical_benchmarks_dir() . '/latest-export.json';
	}

	public static function knowledge_model_jobs_dir(): string {
		return self::subdir( 'knowledge-model-jobs' );
	}

	public static function knowledge_model_job_path( string $job_id ): string {
		$safe = preg_replace( '/[^a-zA-Z0-9-]/', '', $job_id );
		return self::knowledge_model_jobs_dir() . '/' . $safe . '.json';
	}
}
