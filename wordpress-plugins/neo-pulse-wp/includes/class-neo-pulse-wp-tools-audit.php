<?php
/**
 * Audit log for NEO Pulse MCP / tools execute.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Tools_Audit {

	const OPTION_KEY = 'neo_pulse_wp_tools_audit_log';
	const MAX_ENTRIES  = 200;

	/**
	 * @param string               $tool_name Tool name.
	 * @param array<string, mixed> $params    Sanitized params snapshot.
	 * @param bool                 $ok        Success.
	 * @param int                  $user_id   User ID.
	 * @return string Audit entry ID.
	 */
	public static function log( string $tool_name, array $params, bool $ok, int $user_id = 0 ): string {
		if ( $user_id < 1 ) {
			$user_id = get_current_user_id();
		}

		$id      = 'aud_' . wp_generate_password( 12, false, false );
		$entries = self::get_entries_raw();

		array_unshift(
			$entries,
			array(
				'id'        => $id,
				'tool'      => $tool_name,
				'user_id'   => $user_id,
				'ok'        => $ok,
				'post_id'   => isset( $params['post_id'] ) ? (int) $params['post_id'] : 0,
				'params'    => self::redact_params( $params ),
				'timestamp' => gmdate( 'c' ),
			)
		);

		if ( count( $entries ) > self::MAX_ENTRIES ) {
			$entries = array_slice( $entries, 0, self::MAX_ENTRIES );
		}

		update_option( self::OPTION_KEY, $entries, false );

		return $id;
	}

	/**
	 * @param int $limit Max entries.
	 * @return array<int, array<string, mixed>>
	 */
	public static function list_recent( int $limit = 50 ): array {
		$entries = self::get_entries_raw();
		return array_slice( $entries, 0, max( 1, min( 100, $limit ) ) );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	private static function get_entries_raw(): array {
		$raw = get_option( self::OPTION_KEY, array() );
		return is_array( $raw ) ? $raw : array();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	private static function redact_params( array $params ): array {
		$out = $params;
		foreach ( array( 'value', 'html', 'content', 'summary', 'config' ) as $key ) {
			if ( isset( $out[ $key ] ) && is_string( $out[ $key ] ) && strlen( $out[ $key ] ) > 500 ) {
				$out[ $key ] = substr( $out[ $key ], 0, 500 ) . '…';
			}
		}
		return $out;
	}
}
