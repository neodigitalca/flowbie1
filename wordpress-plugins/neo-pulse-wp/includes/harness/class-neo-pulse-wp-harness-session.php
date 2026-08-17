<?php
/**
 * Body harness session storage (WP transients).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Harness_Session {

	const TTL = 7200;

	/**
	 * @return string
	 */
	public static function transient_key( int $post_id, int $user_id = 0 ): string {
		if ( $user_id < 1 ) {
			$user_id = get_current_user_id();
		}
		return 'neo_pulse_wp_body_' . md5( $user_id . '|' . $post_id . '|' . NEO_PULSE_WP_VERSION );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $post_id ): ?array {
		$raw = get_transient( self::transient_key( $post_id ) );
		return is_array( $raw ) ? $raw : null;
	}

	/**
	 * @param array<string,mixed> $session
	 */
	public static function save( int $post_id, array $session ): string {
		$session['postId']    = $post_id;
		$session['updatedAt'] = gmdate( 'c' );
		if ( empty( $session['sessionId'] ) ) {
			$session['sessionId'] = wp_generate_uuid4();
		}
		set_transient( self::transient_key( $post_id ), $session, self::TTL );
		return (string) $session['sessionId'];
	}

	public static function delete( int $post_id ): void {
		delete_transient( self::transient_key( $post_id ) );
	}

	/**
	 * @param array<string,mixed> $session
	 * @return array<string,mixed>
	 */
	public static function public_shape( array $session ): array {
		$sections = isset( $session['sections'] ) && is_array( $session['sections'] ) ? $session['sections'] : array();
		$public   = array();
		$done     = 0;
		foreach ( $sections as $s ) {
			if ( ! is_array( $s ) ) {
				continue;
			}
			$status = isset( $s['status'] ) ? (string) $s['status'] : 'waiting';
			if ( in_array( $status, array( 'done', 'applied' ), true ) ) {
				++$done;
			}
			$row = array(
				'index'     => isset( $s['index'] ) ? (int) $s['index'] : 0,
				'title'     => isset( $s['title'] ) ? (string) $s['title'] : '',
				'keyword'   => isset( $s['keyword'] ) ? (string) $s['keyword'] : '',
				'status'    => $status,
				'truncated' => ! empty( $s['truncated'] ),
				'applied'   => ! empty( $s['applied'] ),
				'error'     => isset( $s['error'] ) ? (string) $s['error'] : '',
			);
			if ( ! empty( $s['html'] ) && in_array( $status, array( 'done', 'applied' ), true ) ) {
				$row['hasPreview'] = true;
			}
			$public[] = $row;
		}
		$planned = isset( $session['plannedCount'] ) ? (int) $session['plannedCount'] : count( $public );

		return array(
			'ok'           => true,
			'sessionId'    => isset( $session['sessionId'] ) ? (string) $session['sessionId'] : '',
			'postId'       => isset( $session['postId'] ) ? (int) $session['postId'] : 0,
			'phase'        => isset( $session['phase'] ) ? (string) $session['phase'] : 'idle',
			'plannedCount' => $planned,
			'doneCount'    => $done,
			'activeIndex'  => isset( $session['activeIndex'] ) ? (int) $session['activeIndex'] : -1,
			'sections'     => $public,
		);
	}

	/**
	 * @param array<string,mixed> $session
	 * @param int                   $index
	 * @param array<string,mixed>   $patch
	 */
	public static function patch_section( array &$session, int $index, array $patch ): void {
		if ( ! isset( $session['sections'] ) || ! is_array( $session['sections'] ) ) {
			return;
		}
		foreach ( $session['sections'] as $i => &$section ) {
			if ( ! is_array( $section ) ) {
				continue;
			}
			if ( (int) ( $section['index'] ?? $i ) === $index ) {
				$section = array_merge( $section, $patch );
				return;
			}
		}
	}
}
