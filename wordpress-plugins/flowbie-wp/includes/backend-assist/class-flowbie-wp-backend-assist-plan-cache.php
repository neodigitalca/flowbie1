<?php
/**
 * Backend Assist — cached body-op plans for Plan / Build parity
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Plan_Cache {

	public static function cache_key( string $message, int $post_id ): string {
		$user_id = get_current_user_id();
		$hash    = md5( $post_id . '|' . trim( $message ) );
		return 'flowbie_ba_plan_' . $user_id . '_' . $hash;
	}

	/**
	 * @param array<string, mixed> $payload
	 */
	public static function save( string $message, int $post_id, array $payload ): void {
		if ( $post_id < 1 || trim( $message ) === '' ) {
			return;
		}
		$payload['message']  = trim( $message );
		$payload['post_id']  = $post_id;
		$payload['saved_at'] = gmdate( 'c' );
		set_transient(
			self::cache_key( $message, $post_id ),
			$payload,
			Flowbie_Wp_Backend_Assist_Context::WORKFLOW_TTL
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function load( string $message, int $post_id ): ?array {
		if ( $post_id < 1 || trim( $message ) === '' ) {
			return null;
		}
		$data = get_transient( self::cache_key( $message, $post_id ) );
		if ( ! is_array( $data ) ) {
			return null;
		}
		$has_ops  = ! empty( $data['ops'] ) && is_array( $data['ops'] );
		$has_tool = ! empty( $data['tool'] );
		if ( ! $has_ops && ! $has_tool ) {
			return null;
		}
		if ( trim( (string) ( $data['message'] ?? '' ) ) !== trim( $message ) ) {
			return null;
		}
		if ( (int) ( $data['post_id'] ?? 0 ) !== $post_id ) {
			return null;
		}
		return $data;
	}

	public static function clear( string $message, int $post_id ): void {
		delete_transient( self::cache_key( $message, $post_id ) );
	}
}
