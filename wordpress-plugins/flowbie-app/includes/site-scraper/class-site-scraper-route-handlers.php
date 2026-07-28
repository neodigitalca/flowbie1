<?php
/**
 * POST /api/site-scraper/scrape and /cancel (Python NDJSON stream).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Site_Scraper_Route_Handlers {

	/** @var resource|null */
	private static $current_process = null;

	/**
	 * @param string              $subpath Route after site-scraper/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'scrape' && $method === 'POST' ) {
			self::scrape( $body );
			return;
		}
		if ( $subpath === 'cancel' && $method === 'POST' ) {
			self::cancel();
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}

	/** @param array<string,mixed> $body */
	private static function scrape( array $body ): void {
		$url = isset( $body['url'] ) ? trim( (string) $body['url'] ) : '';
		if ( $url === '' ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Missing required field: url' ), 400 );
			return;
		}

		if ( self::$current_process !== null ) {
			$status = proc_get_status( self::$current_process );
			if ( ! empty( $status['running'] ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'A site scrape is already in progress. Please cancel it before starting a new one.' ), 429 );
				return;
			}
		}

		$script = self::script_path();
		if ( ! is_readable( $script ) ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Site scraper script not found' ), 500 );
			return;
		}

		$python = self::python_command();
		$args   = array( escapeshellarg( $python ), escapeshellarg( $script ), escapeshellarg( $url ) );
		if ( isset( $body['maxPages'] ) && is_numeric( $body['maxPages'] ) && is_finite( (float) $body['maxPages'] ) ) {
			$args[] = escapeshellarg( (string) (int) $body['maxPages'] );
		}

		$cmd = implode( ' ', $args ) . ' 2>&1';
		$descriptors = array(
			0 => array( 'pipe', 'r' ),
			1 => array( 'pipe', 'w' ),
			2 => array( 'pipe', 'w' ),
		);

		$cwd = dirname( $script );
		$proc = @proc_open( $cmd, $descriptors, $pipes, $cwd );
		if ( ! is_resource( $proc ) ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Failed to start site scraper process' ), 500 );
			return;
		}

		self::$current_process = $proc;
		fclose( $pipes[0] );

		status_header( 200 );
		header( 'Content-Type: application/x-ndjson' );

		stream_set_blocking( $pipes[1], false );
		stream_set_blocking( $pipes[2], false );

		$stdout_done = false;
		$stderr_buf  = '';
		while ( true ) {
			$chunk = fread( $pipes[1], 8192 );
			if ( is_string( $chunk ) && $chunk !== '' ) {
				echo $chunk;
				if ( function_exists( 'ob_flush' ) ) {
					@ob_flush();
				}
				flush();
			}
			$err = fread( $pipes[2], 8192 );
			if ( is_string( $err ) && $err !== '' ) {
				$stderr_buf .= $err;
			}

			$status = proc_get_status( $proc );
			if ( empty( $status['running'] ) ) {
				while ( ( $chunk = fread( $pipes[1], 8192 ) ) !== false && $chunk !== '' ) {
					echo $chunk;
				}
				$stdout_done = true;
				break;
			}
			usleep( 100000 );
		}

		fclose( $pipes[1] );
		fclose( $pipes[2] );
		$exit_code = proc_close( $proc );
		self::$current_process = null;

		if ( $exit_code !== 0 && ! $stdout_done ) {
			echo wp_json_encode(
				array(
					'type'    => 'error',
					'message' => 'Site scraper exited with code ' . $exit_code,
				)
			) . "\n";
		}
	}

	private static function cancel(): void {
		if ( self::$current_process === null ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'cancelled' => false, 'message' => 'No active scraper process' ) );
			return;
		}
		$status = proc_get_status( self::$current_process );
		if ( empty( $status['running'] ) ) {
			self::$current_process = null;
			Flowbie_App_Api_Dispatcher::send_json( array( 'cancelled' => false, 'message' => 'No active scraper process' ) );
			return;
		}
		@proc_terminate( self::$current_process );
		self::$current_process = null;
		Flowbie_App_Api_Dispatcher::send_json( array( 'cancelled' => true ) );
	}

	private static function python_command(): string {
		if ( defined( 'FLOWBIE_APP_SITE_SCRAPER_PYTHON' ) && FLOWBIE_APP_SITE_SCRAPER_PYTHON !== '' ) {
			return (string) FLOWBIE_APP_SITE_SCRAPER_PYTHON;
		}
		return strtoupper( substr( PHP_OS, 0, 3 ) ) === 'WIN' ? 'python' : 'python3';
	}

	private static function script_path(): string {
		if ( defined( 'FLOWBIE_APP_SITE_SCRAPER_SCRIPT' ) && FLOWBIE_APP_SITE_SCRAPER_SCRIPT !== '' ) {
			return (string) FLOWBIE_APP_SITE_SCRAPER_SCRIPT;
		}
		$repo = dirname( FLOWBIE_APP_PLUGIN_DIR, 2 ) . '/server/site-scraper/site_scraper.py';
		if ( is_readable( $repo ) ) {
			return $repo;
		}
		return FLOWBIE_APP_PLUGIN_DIR . 'scripts/site_scraper.py';
	}
}
