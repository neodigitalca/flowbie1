<?php
/**
 * Residential proxy browser automation via Node + Puppeteer.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Browser_Automation {

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array<string,mixed>
	 */
	public static function start_job_from_body( array $body ): array {
		$target_url = isset( $body['targetUrl'] ) ? trim( (string) $body['targetUrl'] ) : '';
		$instructions = isset( $body['browserInstructionsHtml'] ) ? trim( (string) $body['browserInstructionsHtml'] ) : '';
		if ( $target_url === '' ) {
			return array( 'ok' => false, 'error' => 'Missing required field: targetUrl' );
		}
		if ( $instructions === '' ) {
			return array( 'ok' => false, 'error' => 'Missing required field: browserInstructionsHtml' );
		}

		$remote = self::remote_worker_url();
		if ( $remote !== '' ) {
			return self::remote_worker_request(
				'POST',
				$remote . '/browser-automation/jobs',
				array(
					'targetUrl'               => $target_url,
					'browserInstructionsHtml' => $instructions,
				)
			) ?? array( 'ok' => false, 'error' => 'Remote worker request failed.' );
		}

		if ( ! self::exec_allowed() ) {
			return array(
				'ok'    => false,
				'error' => 'Browser automation worker is not configured.',
				'code'  => 'BROWSER_AUTOMATION_EXEC_BLOCKED',
			);
		}

		$script = self::session_script_path();
		$node   = self::node_binary();
		if ( $script === '' || ! is_readable( $script ) || $node === '' ) {
			return array(
				'ok'    => false,
				'error' => 'Browser automation script is not configured.',
				'code'  => 'BROWSER_AUTOMATION_WORKER_NOT_CONFIGURED',
			);
		}

		$job_id   = wp_generate_uuid4();
		$jobs_dir = self::jobs_dir();
		if ( ! is_dir( $jobs_dir ) && ! wp_mkdir_p( $jobs_dir ) ) {
			return array( 'ok' => false, 'error' => 'Could not create browser automation jobs directory.' );
		}

		$progress_path      = self::job_progress_path( $job_id );
		$instructions_path  = self::job_instructions_path( $job_id );
		$meta_path          = self::job_meta_path( $job_id );
		file_put_contents( $progress_path, '' );
		file_put_contents( $instructions_path, $instructions );

		$cmd = escapeshellarg( $node ) . ' '
			. escapeshellarg( $script ) . ' --json'
			. ' --progress-file ' . escapeshellarg( $progress_path )
			. ' --url ' . escapeshellarg( $target_url )
			. ' --instructions-file ' . escapeshellarg( $instructions_path );

		$descriptors = array(
			0 => array( 'pipe', 'r' ),
			1 => array( 'file', self::job_stdout_path( $job_id ), 'a' ),
			2 => array( 'file', self::job_stderr_path( $job_id ), 'a' ),
		);

		$proc = proc_open( $cmd, $descriptors, $pipes, dirname( $script ), self::worker_env() );
		if ( ! is_resource( $proc ) ) {
			self::cleanup_job_files( $job_id );
			return array(
				'ok'    => false,
				'error' => 'Failed to start browser automation process.',
				'code'  => 'BROWSER_AUTOMATION_EXEC_BLOCKED',
			);
		}

		fclose( $pipes[0] );
		$status = proc_get_status( $proc );
		$pid    = isset( $status['pid'] ) ? (int) $status['pid'] : 0;
		file_put_contents(
			$meta_path,
			wp_json_encode(
				array(
					'jobId'     => $job_id,
					'targetUrl' => $target_url,
					'startedAt' => gmdate( 'c' ),
					'pid'       => $pid,
				)
			)
		);

		return array(
			'ok'    => true,
			'jobId' => $job_id,
		);
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
			return self::remote_worker_request(
				'GET',
				$remote . '/browser-automation/jobs/' . rawurlencode( $job_id )
			) ?? array(
				'ok'     => false,
				'status' => 'error',
				'error'  => 'Remote worker returned an invalid response.',
			);
		}

		$meta_path = self::job_meta_path( $job_id );
		if ( ! is_readable( $meta_path ) ) {
			return array(
				'ok'     => false,
				'status' => 'error',
				'error'  => 'Job not found.',
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
				'error'            => $parsed['error'] ?? 'Browser automation failed.',
			);
		}

		$meta_raw = file_get_contents( $meta_path );
		$meta     = is_string( $meta_raw ) ? json_decode( $meta_raw, true ) : null;
		$pid      = is_array( $meta ) && isset( $meta['pid'] ) ? (int) $meta['pid'] : 0;
		if ( $pid > 0 && ! self::is_process_running( $pid ) ) {
			self::cleanup_job_files( $job_id );
			return array(
				'ok'               => true,
				'status'           => 'error',
				'label'            => $parsed['label'] ?? 'Error',
				'screenshotBase64' => $parsed['screenshotBase64'] ?? null,
				'error'            => $parsed['error'] ?? 'Browser automation process exited unexpectedly.',
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
	public static function cancel_job( string $job_id ): array {
		$job_id = self::sanitize_job_id( $job_id );
		if ( $job_id === '' ) {
			return array( 'ok' => false, 'error' => 'Invalid job id.' );
		}

		$remote = self::remote_worker_url();
		if ( $remote !== '' ) {
			return self::remote_worker_request(
				'POST',
				$remote . '/browser-automation/jobs/' . rawurlencode( $job_id ) . '/cancel'
			) ?? array( 'ok' => false, 'error' => 'Remote worker request failed.' );
		}

		if ( ! is_readable( self::job_progress_path( $job_id ) ) ) {
			return array( 'ok' => false, 'error' => 'Job not found.' );
		}

		return array( 'ok' => true );
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function proxy_status( bool $probe = false ): array {
		$remote = self::remote_worker_url();
		if ( $remote !== '' ) {
			$url = $remote . '/residential-proxy/status';
			if ( $probe ) {
				$response = self::remote_worker_request( 'GET', $url, null, array( 'X-Probe' => '1' ) );
			} else {
				$response = self::remote_worker_request( 'GET', $url );
			}
			return is_array( $response ) ? $response : array( 'ok' => false, 'configured' => false );
		}

		return array(
			'ok'         => false,
			'configured' => false,
			'error'      => 'Residential proxy status requires the browser worker.',
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
				$result = ! empty( $data['summary'] ) ? $data['summary'] : $data;
			}
			if ( $type === 'error' ) {
				$status = 'error';
				$error  = ! empty( $data['message'] ) ? (string) $data['message'] : 'Browser automation failed.';
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
		return trailingslashit( (string) ( $upload['basedir'] ?? '' ) ) . 'neo-pulse/browser-automation-jobs';
	}

	private static function job_progress_path( string $job_id ): string {
		return trailingslashit( self::jobs_dir() ) . $job_id . '.jsonl';
	}

	private static function job_instructions_path( string $job_id ): string {
		return trailingslashit( self::jobs_dir() ) . $job_id . '-instructions.html';
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
				self::job_instructions_path( $job_id ),
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

	private static function session_script_path(): string {
		if ( defined( 'NEO_PULSE_APP_BROWSER_AUTOMATION_SCRIPT' ) ) {
			return trim( (string) NEO_PULSE_APP_BROWSER_AUTOMATION_SCRIPT );
		}
		return '';
	}

	private static function node_binary(): string {
		if ( defined( 'NEO_PULSE_APP_NODE_BINARY' ) && NEO_PULSE_APP_NODE_BINARY !== '' ) {
			return (string) NEO_PULSE_APP_NODE_BINARY;
		}
		$from_env = getenv( 'NEO_PULSE_APP_NODE_BINARY' );
		return is_string( $from_env ) && $from_env !== '' ? $from_env : 'node';
	}

	/**
	 * @return array<string,string>
	 */
	private static function worker_env(): array {
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

		$openrouter = Neo_Pulse_App_Secrets::openrouter_api_key();
		if ( $openrouter !== '' ) {
			$env['OPENROUTER_API_KEY'] = $openrouter;
		}

		$agentmail_key = Neo_Pulse_App_Secrets::agentmail_api_key();
		if ( $agentmail_key !== '' ) {
			$env['AGENTMAIL_API_KEY'] = $agentmail_key;
		}
		$inbox = Neo_Pulse_App_Secrets::agentmail_inbox();
		if ( $inbox !== '' ) {
			$env['AGENTMAIL_INBOX'] = $inbox;
			$env['CHATGPT_AUDIT_EMAIL'] = $inbox;
		}

		if ( defined( 'NEO_PULSE_APP_RESIDENTIAL_PROXY_ENV_FILE' ) ) {
			$env_file = trim( (string) NEO_PULSE_APP_RESIDENTIAL_PROXY_ENV_FILE );
			if ( $env_file !== '' && is_readable( $env_file ) ) {
				$env['RESIDENTIAL_PROXY_ENV_FILE'] = $env_file;
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
		if ( defined( 'NEO_PULSE_APP_CHATGPT_AUDIT_WORKER_URL' ) ) {
			return rtrim( trim( (string) NEO_PULSE_APP_CHATGPT_AUDIT_WORKER_URL ), '/' );
		}
		$from_env = getenv( 'NEO_PULSE_APP_CHATGPT_AUDIT_WORKER_URL' );
		return is_string( $from_env ) ? rtrim( trim( $from_env ), '/' ) : '';
	}

	private static function remote_worker_auth_token(): string {
		if ( defined( 'NEO_PULSE_APP_CHATGPT_AUDIT_WORKER_AUTH' ) ) {
			return trim( (string) NEO_PULSE_APP_CHATGPT_AUDIT_WORKER_AUTH );
		}
		$from_env = getenv( 'NEO_PULSE_APP_CHATGPT_AUDIT_WORKER_AUTH' );
		return is_string( $from_env ) ? trim( $from_env ) : '';
	}

	/**
	 * @param array<string,string> $extra_headers
	 * @return array<string,mixed>|null
	 */
	private static function remote_worker_request( string $method, string $url, ?array $body = null, array $extra_headers = array() ): ?array {
		$headers = array_merge(
			array(
				'Accept'       => 'application/json',
				'Content-Type' => 'application/json',
			),
			$extra_headers
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
				'error' => 'Remote browser worker returned non-JSON (HTTP ' . $status . ').',
			);
		}
		if ( $status >= 400 && empty( $data['error'] ) ) {
			$data['error'] = 'Remote browser worker error (HTTP ' . $status . ').';
		}
		return $data;
	}
}
