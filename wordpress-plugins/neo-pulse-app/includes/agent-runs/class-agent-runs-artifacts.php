<?php
/**
 * Agent run artifact storage (uploads/neo-pulse/agent-runs/{runId}/).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Runs_Artifacts {

	/**
	 * @return string Absolute directory for a run's artifacts.
	 */
	public static function run_dir( int $run_id ): string {
		$upload = wp_upload_dir();
		$base   = trailingslashit( (string) ( $upload['basedir'] ?? '' ) ) . 'neo-pulse/agent-runs/' . $run_id;
		if ( ! is_dir( $base ) ) {
			wp_mkdir_p( $base );
		}
		return $base;
	}

	/**
	 * @return string Public URL base for a run's artifacts.
	 */
	public static function run_url_base( int $run_id ): string {
		$upload = wp_upload_dir();
		return trailingslashit( (string) ( $upload['baseurl'] ?? '' ) ) . 'neo-pulse/agent-runs/' . $run_id;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function save_artifact( int $team_id, int $run_id, array $body ): array {
		$run = Neo_Pulse_App_Agent_Runs_Store::get_run( $team_id, $run_id, false );
		if ( ! $run ) {
			return array( 'ok' => false, 'error' => 'Not found' );
		}

		$step_key = sanitize_key( (string) ( $body['stepKey'] ?? $body['step_key'] ?? '' ) );
		$name     = sanitize_file_name( (string) ( $body['name'] ?? 'artifact.json' ) );
		$mime     = sanitize_text_field( (string) ( $body['mime'] ?? 'application/json' ) );
		$content  = (string) ( $body['content'] ?? '' );

		if ( $step_key === '' || $name === '' || $content === '' ) {
			return array( 'ok' => false, 'error' => 'stepKey, name, and content are required.' );
		}

		$content = self::normalize_artifact_content( $content, $mime );

		if ( $content === '' ) {
			return array( 'ok' => false, 'error' => 'Artifact content is empty after decode.' );
		}

		$dir      = self::run_dir( $run_id );
		$file_id  = substr( md5( $step_key . '|' . $name ), 0, 12 );
		$filename = $step_key . '-' . $file_id . '-' . $name;
		$path     = trailingslashit( $dir ) . $filename;

		$written = file_put_contents( $path, $content );
		if ( $written === false ) {
			return array( 'ok' => false, 'error' => 'Could not write artifact file.' );
		}

		$url = trailingslashit( self::run_url_base( $run_id ) ) . $filename;
		$artifact = array(
			'id'   => $file_id,
			'name' => $name,
			'url'  => $url,
			'mime' => $mime,
		);

		return array(
			'ok'       => true,
			'artifact' => $artifact,
			'stepKey'  => $step_key,
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_artifacts( int $run_id ): array {
		$dir = self::run_dir( $run_id );
		if ( ! is_dir( $dir ) ) {
			return array();
		}

		$files = glob( trailingslashit( $dir ) . '*' );
		if ( ! is_array( $files ) ) {
			return array();
		}

		$base_url = self::run_url_base( $run_id );
		$out      = array();
		foreach ( $files as $path ) {
			if ( ! is_file( $path ) ) {
				continue;
			}
			$basename = basename( $path );
			$parts    = explode( '-', $basename, 3 );
			$step_key = isset( $parts[0] ) ? sanitize_key( (string) $parts[0] ) : '';
			$file_id  = isset( $parts[1] ) ? sanitize_key( (string) $parts[1] ) : '';
			$name     = isset( $parts[2] ) ? (string) $parts[2] : $basename;
			$out[]    = array(
				'id'       => $file_id !== '' ? $file_id : substr( md5( $basename ), 0, 12 ),
				'name'     => $name,
				'url'      => trailingslashit( $base_url ) . $basename,
				'stepKey'  => $step_key,
				'createdAt'=> gmdate( 'c', (int) filemtime( $path ) ),
			);
		}
		return $out;
	}

	/**
	 * Read persisted artifact body for a step (survives checkpoint ticks that omit large fields).
	 */
	public static function read_artifact_content( int $run_id, string $step_key, string $name ): string {
		$step_key = sanitize_key( $step_key );
		$name     = sanitize_file_name( $name );
		if ( $step_key === '' || $name === '' ) {
			return '';
		}

		$dir = self::run_dir( $run_id );
		if ( ! is_dir( $dir ) ) {
			return '';
		}

		$pattern = trailingslashit( $dir ) . $step_key . '-*-' . $name;
		$files   = glob( $pattern );
		if ( ! is_array( $files ) || empty( $files ) ) {
			return '';
		}

		usort(
			$files,
			static function ( $a, $b ) {
				return (int) filemtime( $b ) <=> (int) filemtime( $a );
			}
		);

		$content = file_get_contents( $files[0] );
		return is_string( $content ) ? $content : '';
	}

	/**
	 * Decode base64 image payloads so PNG/JPEG artifacts are valid binary files.
	 */
	private static function normalize_artifact_content( string $content, string $mime ): string {
		if ( ! str_starts_with( $mime, 'image/' ) ) {
			return $content;
		}

		if ( preg_match( '#^data:image/[^;]+;base64,#i', $content ) ) {
			$comma = strrpos( $content, ',' );
			if ( $comma !== false ) {
				$content = substr( $content, $comma + 1 );
			}
		}

		$binary = base64_decode( $content, true );
		if ( $binary !== false && $binary !== '' ) {
			return $binary;
		}

		return $content;
	}
}
