<?php
/**
 * Local Dominator grid CSV export via bundled Node script.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Local_Dominator_Export {

	/**
	 * @return array<string,mixed>
	 */
	public static function probe_exec(): array {
		if ( ! self::exec_allowed() ) {
			return array(
				'execAllowed' => false,
				'code'        => 'LD_EXPORT_EXEC_BLOCKED',
			);
		}
		$node   = self::node_command();
		$script = self::script_path();
		return array(
			'execAllowed'  => true,
			'node'         => $node,
			'scriptPath'   => $script,
			'scriptExists' => is_readable( $script ),
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array<string,mixed>
	 */
	public static function export_grid( array $body ): array {
		$business = isset( $body['businessName'] ) ? trim( (string) $body['businessName'] ) : '';
		$keyword  = isset( $body['keyword'] ) ? trim( (string) $body['keyword'] ) : '';
		if ( $business === '' ) {
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

		$probe = self::probe_exec();
		if ( empty( $probe['execAllowed'] ) || empty( $probe['scriptExists'] ) ) {
			return array(
				'ok'    => false,
				'error' => 'Local Dominator export is not available on this host.',
				'code'  => 'LD_EXPORT_EXEC_BLOCKED',
			);
		}

		$script = self::script_path();
		$node   = self::node_command();
		$cmd    = escapeshellarg( $node ) . ' '
			. escapeshellarg( $script ) . ' '
			. '--json '
			. '--business ' . escapeshellarg( $business ) . ' '
			. '--keyword ' . escapeshellarg( $keyword );
		$cwd = dirname( $script, 2 );

		$descriptors = array(
			0 => array( 'pipe', 'r' ),
			1 => array( 'pipe', 'w' ),
			2 => array( 'pipe', 'w' ),
		);

		$proc = proc_open( $cmd, $descriptors, $pipes, $cwd );
		if ( ! is_resource( $proc ) ) {
			return array(
				'ok'    => false,
				'error' => 'Failed to start Local Dominator export process',
				'code'  => 'LD_EXPORT_EXEC_BLOCKED',
			);
		}

		fclose( $pipes[0] );
		$stdout = stream_get_contents( $pipes[1] );
		$stderr = stream_get_contents( $pipes[2] );
		fclose( $pipes[1] );
		fclose( $pipes[2] );
		$exit = proc_close( $proc );

		$result = self::parse_node_json( is_string( $stdout ) ? $stdout : '' );
		if ( $result === null ) {
			$msg = trim( is_string( $stderr ) && $stderr !== '' ? $stderr : ( is_string( $stdout ) ? $stdout : 'Unknown error' ) );
			return array(
				'ok'    => false,
				'error' => 'Failed to export Local Dominator grid: ' . $msg,
			);
		}

		if ( $exit !== 0 || empty( $result['ok'] ) ) {
			return array(
				'ok'    => false,
				'error' => isset( $result['error'] ) ? (string) $result['error'] : 'Failed to export Local Dominator grid',
			);
		}

		if ( empty( $result['csvBase64'] ) || empty( $result['fileName'] ) ) {
			return array(
				'ok'    => false,
				'error' => 'Export completed but CSV payload was missing',
			);
		}

		return array(
			'ok'           => true,
			'fileName'     => (string) $result['fileName'],
			'csvBase64'    => (string) $result['csvBase64'],
			'businessName' => $business,
			'keyword'      => $keyword,
		);
	}

	private static function script_path(): string {
		if ( defined( 'NEO_PULSE_APP_LOCAL_DOMINATOR_EXPORT_SCRIPT' ) && NEO_PULSE_APP_LOCAL_DOMINATOR_EXPORT_SCRIPT !== '' ) {
			return (string) NEO_PULSE_APP_LOCAL_DOMINATOR_EXPORT_SCRIPT;
		}
		return dirname( NEO_PULSE_APP_PLUGIN_DIR, 2 ) . '/scripts/research/local-dominator/export-grid.mjs';
	}

	private static function node_command(): string {
		if ( defined( 'NEO_PULSE_APP_NODE_BINARY' ) && NEO_PULSE_APP_NODE_BINARY !== '' ) {
			return (string) NEO_PULSE_APP_NODE_BINARY;
		}
		if ( getenv( 'NEO_PULSE_APP_NODE' ) ) {
			return (string) getenv( 'NEO_PULSE_APP_NODE' );
		}
		return ( strtoupper( substr( PHP_OS, 0, 3 ) ) === 'WIN' ) ? 'node.exe' : 'node';
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
	private static function parse_node_json( string $stdout ) {
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
