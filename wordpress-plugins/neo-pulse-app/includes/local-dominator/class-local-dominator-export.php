<?php
/**
 * Local Dominator grid CSV export via Node + Puppeteer on the host.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Local_Dominator_Export {

	/**
	 * @return array<string,mixed>
	 */
	public static function probe_worker(): array {
		if ( self::remote_worker_url() !== '' ) {
			return array(
				'ok'         => true,
				'remote'     => true,
				'workerUrl'  => self::remote_worker_url(),
				'code'       => null,
			);
		}

		if ( ! self::exec_allowed() ) {
			return array(
				'ok'   => false,
				'code' => 'LD_EXPORT_EXEC_BLOCKED',
			);
		}

		$script = self::export_script_path();
		$node   = self::node_binary();

		return array(
			'ok'           => $script !== '' && is_readable( $script ) && $node !== '',
			'nodeBinary'   => $node,
			'scriptPath'   => $script,
			'scriptExists' => $script !== '' && is_readable( $script ),
			'code'         => ( $script === '' || ! is_readable( $script ) || $node === '' ) ? 'LD_EXPORT_WORKER_NOT_CONFIGURED' : null,
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array<string,mixed>
	 */
	public static function export_grid( array $body ): array {
		$validated = self::validate_export_body( $body );
		if ( ! empty( $validated['error'] ) ) {
			return $validated;
		}

		$probe = self::probe_worker();
		if ( empty( $probe['ok'] ) ) {
			return array(
				'ok'    => false,
				'error' => 'Local Dominator export worker is not configured.',
				'code'  => ! empty( $probe['code'] ) ? (string) $probe['code'] : 'LD_EXPORT_WORKER_NOT_CONFIGURED',
			);
		}

		$started = self::start_export_job( $validated['businessName'], $validated['keyword'] );
		if ( empty( $started['ok'] ) || empty( $started['jobId'] ) ) {
			return $started;
		}

		$deadline = time() + 180;
		while ( time() < $deadline ) {
			$progress = self::read_job_progress( (string) $started['jobId'] );
			if ( ( $progress['status'] ?? '' ) === 'done' && ! empty( $progress['result'] ) ) {
				return $progress['result'];
			}
			if ( ( $progress['status'] ?? '' ) === 'error' ) {
				return array(
					'ok'    => false,
					'error' => ! empty( $progress['error'] ) ? (string) $progress['error'] : 'Local Dominator export failed.',
					'code'  => 'LD_EXPORT_EXEC_BLOCKED',
				);
			}
			usleep( 500_000 );
		}

		return array(
			'ok'    => false,
			'error' => 'Local Dominator export timed out.',
			'code'  => 'LD_EXPORT_EXEC_BLOCKED',
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array<string,mixed>
	 */
	public static function start_export_job_from_body( array $body ): array {
		$validated = self::validate_export_body( $body );
		if ( ! empty( $validated['error'] ) ) {
			return $validated;
		}

		$probe = self::probe_worker();
		if ( empty( $probe['ok'] ) ) {
			return array(
				'ok'    => false,
				'error' => 'Local Dominator export worker is not configured.',
				'code'  => ! empty( $probe['code'] ) ? (string) $probe['code'] : 'LD_EXPORT_WORKER_NOT_CONFIGURED',
			);
		}

		return self::start_export_job( $validated['businessName'], $validated['keyword'] );
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function read_job_progress( string $job_id ): array {
		$job_id = self::sanitize_job_id( $job_id );
		if ( $job_id === '' ) {
			return array(
				'ok'     => false,
				'status' => 'error',
				'error'  => 'Invalid job id.',
			);
		}

		$remote = self::remote_worker_url();
		if ( $remote !== '' ) {
			return self::read_remote_job_progress( $remote, $job_id );
		}

		$meta_path = self::job_meta_path( $job_id );
		if ( ! is_readable( $meta_path ) ) {
			return array(
				'ok'     => false,
				'status' => 'error',
				'error'  => 'Job not found.',
			);
		}

		$meta_raw = file_get_contents( $meta_path );
		$meta     = is_string( $meta_raw ) ? json_decode( $meta_raw, true ) : null;
		if ( ! is_array( $meta ) ) {
			return array(
				'ok'     => false,
				'status' => 'error',
				'error'  => 'Job metadata is invalid.',
			);
		}

		$parsed = self::parse_progress_file( self::job_progress_path( $job_id ) );
		if ( ( $parsed['status'] ?? '' ) === 'done' ) {
			self::cleanup_job_files( $job_id );
			return array(
				'ok'               => true,
				'status'           => 'done',
				'label'            => $parsed['label'] ?? 'Complete',
				'screenshotBase64' => $parsed['screenshotBase64'] ?? null,
				'result'           => $parsed['result'] ?? null,
			);
		}

		if ( ( $parsed['status'] ?? '' ) === 'error' ) {
			self::cleanup_job_files( $job_id );
			return array(
				'ok'               => true,
				'status'           => 'error',
				'label'            => $parsed['label'] ?? 'Error',
				'screenshotBase64' => $parsed['screenshotBase64'] ?? null,
				'error'            => $parsed['error'] ?? 'Local Dominator export failed.',
			);
		}

		$pid = isset( $meta['pid'] ) ? (int) $meta['pid'] : 0;
		if ( $pid > 0 && ! self::is_process_running( $pid ) ) {
			self::cleanup_job_files( $job_id );
			return array(
				'ok'               => true,
				'status'           => 'error',
				'label'            => $parsed['label'] ?? 'Error',
				'screenshotBase64' => $parsed['screenshotBase64'] ?? null,
				'error'            => $parsed['error'] ?? 'Local Dominator export process exited unexpectedly.',
			);
		}

		return array(
			'ok'               => true,
			'status'           => 'running',
			'label'            => $parsed['label'] ?? 'Running',
			'screenshotBase64' => $parsed['screenshotBase64'] ?? null,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function start_export_job( string $business_name, string $keyword ): array {
		$remote = self::remote_worker_url();
		if ( $remote !== '' ) {
			return self::start_remote_export_job( $remote, $business_name, $keyword );
		}

		$script = self::export_script_path();
		$node   = self::node_binary();
		$cwd    = dirname( $script );
		$job_id = wp_generate_uuid4();
		$jobs_dir = self::jobs_dir();
		if ( ! is_dir( $jobs_dir ) && ! wp_mkdir_p( $jobs_dir ) ) {
			return array(
				'ok'    => false,
				'error' => 'Could not create Local Dominator jobs directory.',
			);
		}

		$progress_path = self::job_progress_path( $job_id );
		$meta_path     = self::job_meta_path( $job_id );
		file_put_contents( $progress_path, '' );
		file_put_contents(
			$meta_path,
			wp_json_encode(
				array(
					'jobId'        => $job_id,
					'businessName' => $business_name,
					'keyword'      => $keyword,
					'startedAt'    => gmdate( 'c' ),
				)
			)
		);

		$cmd = escapeshellarg( $node ) . ' '
			. escapeshellarg( $script ) . ' --json'
			. ' --progress-file ' . escapeshellarg( $progress_path )
			. ' --business ' . escapeshellarg( $business_name )
			. ' --keyword ' . escapeshellarg( $keyword );

		$descriptors = array(
			0 => array( 'pipe', 'r' ),
			1 => array( 'file', self::job_stdout_path( $job_id ), 'a' ),
			2 => array( 'file', self::job_stderr_path( $job_id ), 'a' ),
		);

		$env  = self::export_env();
		$proc = proc_open( $cmd, $descriptors, $pipes, $cwd, $env );
		if ( ! is_resource( $proc ) ) {
			self::cleanup_job_files( $job_id );
			return array(
				'ok'    => false,
				'error' => 'Failed to start Local Dominator export process.',
				'code'  => 'LD_EXPORT_EXEC_BLOCKED',
			);
		}

		fclose( $pipes[0] );
		$status = proc_get_status( $proc );
		$pid    = isset( $status['pid'] ) ? (int) $status['pid'] : 0;
		file_put_contents(
			$meta_path,
			wp_json_encode(
				array(
					'jobId'        => $job_id,
					'businessName' => $business_name,
					'keyword'      => $keyword,
					'startedAt'    => gmdate( 'c' ),
					'pid'          => $pid,
				)
			)
		);

		return array(
			'ok'    => true,
			'jobId' => $job_id,
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array<string,mixed>
	 */
	private static function validate_export_body( array $body ): array {
		$business_name = isset( $body['businessName'] ) ? trim( (string) $body['businessName'] ) : '';
		$keyword       = isset( $body['keyword'] ) ? trim( (string) $body['keyword'] ) : '';

		if ( $business_name === '' ) {
			return array(
				'ok'    => false,
				'error' => 'Missing required field: businessName',
			);
		}
		if ( $keyword === '' ) {
			return array(
				'ok'    => false,
				'error' => 'Missing required field: keyword',
			);
		}

		return array(
			'businessName' => $business_name,
			'keyword'      => $keyword,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function parse_progress_file( string $progress_path ): array {
		if ( ! is_readable( $progress_path ) ) {
			return array(
				'status' => 'running',
				'label'  => 'Starting',
			);
		}

		$raw   = file_get_contents( $progress_path );
		$lines = preg_split( '/\r\n|\r|\n/', is_string( $raw ) ? $raw : '' ) ?: array();
		$label = 'Starting';
		$screenshot = null;
		$result = null;
		$error  = null;
		$status = 'running';

		foreach ( $lines as $line ) {
			$line = trim( (string) $line );
			if ( $line === '' ) {
				continue;
			}
			$data = json_decode( $line, true );
			if ( ! is_array( $data ) || empty( $data['type'] ) ) {
				continue;
			}
			$type = (string) $data['type'];
			if ( $type === 'step' && ! empty( $data['label'] ) ) {
				$label = (string) $data['label'];
			}
			if ( $type === 'screenshot' ) {
				if ( ! empty( $data['label'] ) ) {
					$label = (string) $data['label'];
				}
				if ( ! empty( $data['pngBase64'] ) ) {
					$screenshot = (string) $data['pngBase64'];
				}
			}
			if ( $type === 'done' ) {
				$status = 'done';
				$label  = 'Complete';
				$result = $data;
			}
			if ( $type === 'error' ) {
				$status = 'error';
				$error  = ! empty( $data['message'] ) ? (string) $data['message'] : 'Local Dominator export failed.';
				$label  = $error;
			}
		}

		return array(
			'status'           => $status,
			'label'            => $label,
			'screenshotBase64' => $screenshot,
			'result'           => $result,
			'error'            => $error,
		);
	}

	private static function sanitize_job_id( string $job_id ): string {
		$job_id = strtolower( trim( $job_id ) );
		if ( ! preg_match( '/^[a-f0-9-]{8,64}$/', $job_id ) ) {
			return '';
		}
		return $job_id;
	}

	private static function jobs_dir(): string {
		$upload = wp_upload_dir();
		return trailingslashit( (string) ( $upload['basedir'] ?? '' ) ) . 'neo-pulse/ld-jobs';
	}

	private static function job_progress_path( string $job_id ): string {
		return trailingslashit( self::jobs_dir() ) . $job_id . '.jsonl';
	}

	private static function job_meta_path( string $job_id ): string {
		return trailingslashit( self::jobs_dir() ) . $job_id . '.meta.json';
	}

	private static function job_stdout_path( string $job_id ): string {
		return trailingslashit( self::jobs_dir() ) . $job_id . '.stdout.log';
	}

	private static function job_stderr_path( string $job_id ): string {
		return trailingslashit( self::jobs_dir() ) . $job_id . '.stderr.log';
	}

	private static function cleanup_job_files( string $job_id ): void {
		foreach (
			array(
				self::job_progress_path( $job_id ),
				self::job_meta_path( $job_id ),
				self::job_stdout_path( $job_id ),
				self::job_stderr_path( $job_id ),
			) as $path
		) {
			if ( is_file( $path ) ) {
				wp_delete_file( $path );
			}
		}
	}

	private static function is_process_running( int $pid ): bool {
		if ( $pid <= 0 ) {
			return false;
		}
		if ( strtoupper( substr( PHP_OS, 0, 3 ) ) === 'WIN' ) {
			$out = array();
			exec( 'tasklist /FI "PID eq ' . (int) $pid . '" /NH', $out );
			$joined = implode( ' ', $out );
			return str_contains( $joined, (string) $pid );
		}
		return function_exists( 'posix_kill' ) ? @posix_kill( $pid, 0 ) : true;
	}

	private static function export_script_path(): string {
		if ( defined( 'NEO_PULSE_APP_LOCAL_DOMINATOR_EXPORT_SCRIPT' ) ) {
			return trim( (string) NEO_PULSE_APP_LOCAL_DOMINATOR_EXPORT_SCRIPT );
		}
		return '';
	}

	private static function node_binary(): string {
		if ( defined( 'NEO_PULSE_APP_NODE_BINARY' ) && NEO_PULSE_APP_NODE_BINARY !== '' ) {
			return (string) NEO_PULSE_APP_NODE_BINARY;
		}
		$from_env = getenv( 'NEO_PULSE_APP_NODE_BINARY' );
		if ( is_string( $from_env ) && $from_env !== '' ) {
			return $from_env;
		}
		return 'node';
	}

	/**
	 * @return array<string,string>
	 */
	private static function export_env(): array {
		$env = array();
		foreach ( $_ENV as $key => $value ) {
			if ( is_string( $key ) && ( is_string( $value ) || is_numeric( $value ) ) ) {
				$env[ $key ] = (string) $value;
			}
		}
		foreach ( $_SERVER as $key => $value ) {
			if ( ! is_string( $key ) || ! is_string( $value ) ) {
				continue;
			}
			if ( str_starts_with( $key, 'HTTP_' ) || $key === 'SERVER_NAME' ) {
				continue;
			}
			if ( ! array_key_exists( $key, $env ) ) {
				$env[ $key ] = $value;
			}
		}

		if ( defined( 'NEO_PULSE_APP_LOCAL_DOMINATOR_ENV_FILE' ) ) {
			$env_file = trim( (string) NEO_PULSE_APP_LOCAL_DOMINATOR_ENV_FILE );
			if ( $env_file !== '' && is_readable( $env_file ) ) {
				$env['LOCAL_DOMINATOR_ENV_FILE'] = $env_file;
			}
		}

		return $env;
	}

	private static function exec_allowed(): bool {
		if ( self::remote_worker_url() !== '' ) {
			return true;
		}
		if ( ! function_exists( 'proc_open' ) ) {
			return false;
		}
		$disabled = array_map( 'trim', explode( ',', (string) ini_get( 'disable_functions' ) ) );
		return ! in_array( 'proc_open', $disabled, true );
	}

	private static function remote_worker_url(): string {
		if ( defined( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_URL' ) ) {
			return rtrim( trim( (string) NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_URL ), '/' );
		}
		$from_env = getenv( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_URL' );
		return is_string( $from_env ) ? rtrim( trim( $from_env ), '/' ) : '';
	}

	private static function remote_worker_auth_token(): string {
		if ( defined( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_AUTH' ) ) {
			return trim( (string) NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_AUTH );
		}
		$from_env = getenv( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_AUTH' );
		return is_string( $from_env ) ? trim( $from_env ) : '';
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function start_remote_export_job( string $worker_url, string $business_name, string $keyword ): array {
		$response = self::remote_worker_request(
			'POST',
			$worker_url . '/local-dominator/export-grid/jobs',
			array(
				'businessName' => $business_name,
				'keyword'      => $keyword,
			)
		);
		if ( empty( $response['ok'] ) ) {
			return array(
				'ok'    => false,
				'error' => ! empty( $response['error'] ) ? (string) $response['error'] : 'Remote Local Dominator worker request failed.',
				'code'  => 'LD_EXPORT_WORKER_NOT_CONFIGURED',
			);
		}
		if ( empty( $response['jobId'] ) ) {
			return array(
				'ok'    => false,
				'error' => 'Remote Local Dominator worker did not return a job id.',
				'code'  => 'LD_EXPORT_WORKER_NOT_CONFIGURED',
			);
		}
		return array(
			'ok'    => true,
			'jobId' => (string) $response['jobId'],
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function read_remote_job_progress( string $worker_url, string $job_id ): array {
		$response = self::remote_worker_request(
			'GET',
			$worker_url . '/local-dominator/export-grid/jobs/' . rawurlencode( $job_id )
		);
		if ( ! is_array( $response ) ) {
			return array(
				'ok'     => false,
				'status' => 'error',
				'error'  => 'Remote Local Dominator worker returned an invalid response.',
			);
		}
		return $response;
	}

	/**
	 * @param array<string,mixed>|null $body
	 * @return array<string,mixed>|null
	 */
	private static function remote_worker_request( string $method, string $url, ?array $body = null ): ?array {
		$headers = array(
			'Accept'       => 'application/json',
			'Content-Type' => 'application/json',
		);
		$token = self::remote_worker_auth_token();
		if ( $token !== '' ) {
			$headers['Authorization'] = 'Bearer ' . $token;
		}

		$args = array(
			'method'  => $method,
			'timeout' => 120,
			'headers' => $headers,
		);
		if ( $body !== null ) {
			$args['body'] = wp_json_encode( $body );
		}

		$result = wp_remote_request( $url, $args );
		if ( is_wp_error( $result ) ) {
			return array(
				'ok'    => false,
				'error' => $result->get_error_message(),
			);
		}

		$status = (int) wp_remote_retrieve_response_code( $result );
		$raw    = wp_remote_retrieve_body( $result );
		$data   = is_string( $raw ) ? json_decode( $raw, true ) : null;
		if ( ! is_array( $data ) ) {
			return array(
				'ok'    => false,
				'error' => 'Remote Local Dominator worker returned non-JSON (HTTP ' . $status . ').',
			);
		}
		if ( $status >= 400 && empty( $data['error'] ) ) {
			$data['error'] = 'Remote Local Dominator worker error (HTTP ' . $status . ').';
		}
		return $data;
	}
}
