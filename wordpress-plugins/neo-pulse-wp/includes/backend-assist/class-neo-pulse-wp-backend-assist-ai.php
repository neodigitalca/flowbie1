<?php
/**
 * Backend Assist — OpenRouter calls and JSON parsing
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Ai {

	public static function call_openrouter( string $model, string $system_prompt, string $user_prompt, int $max_tokens = 1024, float $temperature = 0.3 ) {
		$key = Neo_Pulse_Wp_OpenRouter::get_api_key();
		if ( $key === '' ) {
			return new WP_Error( 'neo-pulse_openrouter_key', __( 'OpenRouter API key not configured.', 'neo-pulse-wp' ) );
		}

		Neo_Pulse_Wp_OpenRouter::maybe_extend_time_limit();

		$response = wp_remote_post(
			Neo_Pulse_Wp_OpenRouter::API_URL,
			array(
				'timeout' => Neo_Pulse_Wp_OpenRouter::get_timeout(),
				'headers' => Neo_Pulse_Wp_OpenRouter::request_headers( $key ),
				'body'    => wp_json_encode( array(
					'model'       => $model,
					'messages'    => array(
						array( 'role' => 'system', 'content' => $system_prompt ),
						array( 'role' => 'user', 'content' => $user_prompt ),
					),
					'temperature' => $temperature,
					'max_tokens'  => $max_tokens,
				) ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = '';
			if ( is_array( $data ) && isset( $data['error']['message'] ) ) {
				$msg = (string) $data['error']['message'];
			}
			return new WP_Error( 'neo-pulse_backend_ai', $msg ?: sprintf( 'HTTP %d', $code ) );
		}

		$text = '';
		if ( is_array( $data ) && isset( $data['choices'][0]['message']['content'] ) ) {
			$text = trim( (string) $data['choices'][0]['message']['content'] );
		}

		if ( $text === '' ) {
			return new WP_Error( 'neo-pulse_backend_empty', __( 'AI returned empty content.', 'neo-pulse-wp' ) );
		}

		return $text;
	}
	public static function parse_json_response( string $text ): ?array {
		$text = trim( $text );
		$text = preg_replace( '/^```(?:json)?\s*/i', '', $text );
		$text = preg_replace( '/\s*```$/', '', $text );
		$text = trim( $text );

		$decoded = json_decode( $text, true );
		return is_array( $decoded ) ? $decoded : null;
	}
	public static function build_site_context(): string {
		$lines   = array();
		$lines[] = 'Site: ' . get_bloginfo( 'name' );
		$lines[] = 'URL: ' . home_url( '/' );
		$lines[] = 'WordPress: ' . get_bloginfo( 'version' );
		$lines[] = 'Theme: ' . wp_get_theme()->get( 'Name' );

		$post_types = get_post_types( array( 'public' => true ), 'objects' );
		$pt_names   = array();
		foreach ( $post_types as $pt ) {
			if ( $pt->name === 'attachment' ) {
				continue;
			}
			$count      = wp_count_posts( $pt->name );
			$published  = isset( $count->publish ) ? (int) $count->publish : 0;
			$drafts     = isset( $count->draft ) ? (int) $count->draft : 0;
			$pt_names[] = "{$pt->labels->singular_name} ({$pt->name}): {$published} published, {$drafts} drafts";
		}
		$lines[] = 'Content types: ' . implode( '; ', $pt_names );

		return implode( "\n", $lines );
	}
}
