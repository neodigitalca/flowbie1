<?php
/**
 * Google Maps screenshot via bundled Python script.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Maps_Screenshot {

	/**
	 * @return array<string,mixed>
	 */
	public static function probe_exec(): array {
		if ( ! self::exec_allowed() ) {
			return array(
				'execAllowed' => false,
				'code'        => 'MAPS_EXEC_BLOCKED',
			);
		}
		$disabled = array_map( 'trim', explode( ',', (string) ini_get( 'disable_functions' ) ) );
		$blocked  = in_array( 'exec', $disabled, true ) || in_array( 'shell_exec', $disabled, true );
		$python   = self::python_command();
		return array(
			'execAllowed' => ! $blocked,
			'python'      => $python,
			'scriptPath'  => self::script_path(),
			'scriptExists'=> is_readable( self::script_path() ),
			'code'        => $blocked ? 'MAPS_EXEC_BLOCKED' : null,
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array<string,mixed>
	 */
	public static function generate( array $body ): array {
		$entity = isset( $body['entity'] ) ? trim( (string) $body['entity'] ) : '';
		if ( $entity === '' ) {
			return array(
				'success' => false,
				'error'   => 'Missing required field: entity',
			);
		}

		$probe = self::probe_exec();
		if ( empty( $probe['execAllowed'] ) || empty( $probe['scriptExists'] ) ) {
			return array(
				'success' => false,
				'error'   => 'Google Maps screenshot is not available on this host.',
				'code'    => 'MAPS_EXEC_BLOCKED',
			);
		}

		$script = self::script_path();
		$python = self::python_command();
		$cmd    = escapeshellarg( $python ) . ' ' . escapeshellarg( $script ) . ' ' . escapeshellarg( $entity );
		$cwd    = dirname( $script );

		$descriptors = array(
			0 => array( 'pipe', 'r' ),
			1 => array( 'pipe', 'w' ),
			2 => array( 'pipe', 'w' ),
		);

		$proc = proc_open( $cmd, $descriptors, $pipes, $cwd );
		if ( ! is_resource( $proc ) ) {
			return array(
				'success' => false,
				'error'   => 'Failed to start Python process',
				'code'    => 'MAPS_EXEC_BLOCKED',
			);
		}

		fclose( $pipes[0] );
		$stdout = stream_get_contents( $pipes[1] );
		$stderr = stream_get_contents( $pipes[2] );
		fclose( $pipes[1] );
		fclose( $pipes[2] );
		$exit = proc_close( $proc );

		$result = self::parse_python_json( is_string( $stdout ) ? $stdout : '' );
		if ( $result === null ) {
			$msg = trim( is_string( $stderr ) && $stderr !== '' ? $stderr : ( is_string( $stdout ) ? $stdout : 'Unknown error' ) );
			return array(
				'success' => false,
				'error'   => 'Failed to generate Google Maps image: ' . $msg,
			);
		}

		if ( $exit !== 0 || empty( $result['success'] ) ) {
			return array(
				'success' => false,
				'error'   => isset( $result['error'] ) ? (string) $result['error'] : 'Failed to generate Google Maps image',
			);
		}

		if ( empty( $result['imageBase64'] ) ) {
			return array(
				'success' => false,
				'error'   => 'Image generated but no base64 data returned',
			);
		}

		return array(
			'success'     => true,
			'imageBase64' => (string) $result['imageBase64'],
			'mimeType'    => ! empty( $result['mimeType'] ) ? (string) $result['mimeType'] : 'image/jpeg',
		);
	}

	private static function script_path(): string {
		return NEO_PULSE_APP_PLUGIN_DIR . 'maps/google_maps_screenshot.py';
	}

	private static function python_command(): string {
		if ( defined( 'NEO_PULSE_APP_GOOGLE_MAPS_PYTHON' ) && NEO_PULSE_APP_GOOGLE_MAPS_PYTHON !== '' ) {
			return (string) NEO_PULSE_APP_GOOGLE_MAPS_PYTHON;
		}
		if ( getenv( 'GOOGLE_MAPS_PYTHON' ) ) {
			return (string) getenv( 'GOOGLE_MAPS_PYTHON' );
		}
		return ( strtoupper( substr( PHP_OS, 0, 3 ) ) === 'WIN' ) ? 'python' : 'python3';
	}

	private static function exec_allowed(): bool {
		if ( ! function_exists( 'proc_open' ) ) {
			return false;
		}
		$disabled = array_map( 'trim', explode( ',', (string) ini_get( 'disable_functions' ) ) );
		return ! in_array( 'proc_open', $disabled, true );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function parse_python_json( string $stdout ) {
		$clean = trim( $stdout );
		if ( $clean === '' ) {
			return null;
		}
		if ( preg_match( '/\{[\s\S]*\}/', $clean, $m ) ) {
			$data = json_decode( $m[0], true );
			return is_array( $data ) ? $data : null;
		}
		$data = json_decode( $clean, true );
		return is_array( $data ) ? $data : null;
	}
}
