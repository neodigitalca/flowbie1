<?php
/**
 * Pulse Assist secretary: fast ack before the main pipeline.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Secretary {

	const ACK_MODEL = 'google/gemini-2.5-flash-lite';

	/**
	 * @param array<string,mixed>            $body Request body.
	 * @param array<int,array<string,mixed>> $history
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function ack( array $body, array $history = array() ): array {
		$key_err = self::prepare_openrouter_key( $body );
		if ( $key_err !== null ) {
			return array( 400, array( 'ok' => false, 'error' => $key_err ) );
		}

		$message = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( (string) $body['message'] ) ) : '';
		if ( trim( $message ) === '' ) {
			return array( 400, array( 'ok' => false, 'error' => 'Message cannot be empty.' ) );
		}

		$submode  = self::normalize_submode( isset( $body['admin_submode'] ) ? (string) $body['admin_submode'] : 'ask' );
		$pulse    = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		$location = ! empty( $pulse['locationSummary'] ) ? sanitize_text_field( (string) $pulse['locationSummary'] ) : 'NEO Pulse manager';

		$recent_user = array();
		foreach ( array_slice( $history, -4 ) as $entry ) {
			if ( ! is_array( $entry ) || ( $entry['role'] ?? '' ) !== 'user' ) {
				continue;
			}
			$content = trim( (string) ( $entry['content'] ?? '' ) );
			if ( $content !== '' ) {
				$recent_user[] = $content;
			}
		}

		$context_block = '';
		if ( ! empty( $recent_user ) ) {
			$context_block = "Recent user messages:\n- " . implode( "\n- ", $recent_user ) . "\n";
		}

		$mode_label = $submode === 'plan' ? 'Plan mode' : 'Ask mode';
		$system     = <<<PROMPT
You are NEO Pulse Assist, a read-only helper inside the NEO Pulse manager app.
The user just sent a message in {$mode_label}. Output ONLY valid JSON:
{"text":"..."}

For "text": 6-12 words acknowledging what the user asked about. Mirror their request directly.
Do not answer the question. Do not say you are looking anything up or researching.
Do not mention OpenRouter, agents, or internal tools.
Output only JSON. No markdown fences. No emoji.
PROMPT;

		$user = trim( "Current location: {$location}\nUser message: \"{$message}\"\n{$context_block}" );

		$raw = Neo_Pulse_App_Chat_Openrouter::chat_text(
			array(
				array(
					'role'    => 'system',
					'content' => $system,
				),
				array(
					'role'    => 'user',
					'content' => $user,
				),
			),
			array(
				'model'       => self::ACK_MODEL,
				'temperature' => 0.35,
				'maxTokens'   => 80,
			)
		);

		Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();

		$text = self::parse_ack_text( $raw, $message, $submode );
		return array( 200, array( 'ok' => true, 'text' => $text ) );
	}

	private static function parse_ack_text( string $raw, string $message, string $submode ): string {
		$raw = trim( $raw );
		if ( $raw === '' ) {
			return self::fallback_ack( $message, $submode );
		}

		$decoded = json_decode( $raw, true );
		if ( is_array( $decoded ) && ! empty( $decoded['text'] ) && is_scalar( $decoded['text'] ) ) {
			$text = trim( sanitize_text_field( (string) $decoded['text'] ) );
			if ( $text !== '' ) {
				return $text;
			}
		}

		$start = strpos( $raw, '{' );
		$end   = strrpos( $raw, '}' );
		if ( $start !== false && $end !== false && $end > $start ) {
			$decoded = json_decode( substr( $raw, $start, $end - $start + 1 ), true );
			if ( is_array( $decoded ) && ! empty( $decoded['text'] ) && is_scalar( $decoded['text'] ) ) {
				$text = trim( sanitize_text_field( (string) $decoded['text'] ) );
				if ( $text !== '' ) {
					return $text;
				}
			}
		}

		return self::fallback_ack( $message, $submode );
	}

	private static function fallback_ack( string $message, string $submode ): string {
		$snippet = trim( wp_strip_all_tags( $message ) );
		if ( strlen( $snippet ) > 48 ) {
			$snippet = substr( $snippet, 0, 45 ) . '…';
		}
		if ( $snippet === '' ) {
			return $submode === 'plan' ? 'Drafting your plan preview.' : 'On it.';
		}
		return 'Got it: ' . $snippet;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return string|null Error message when key missing.
	 */
	private static function prepare_openrouter_key( array $body ) {
		$api_key = Neo_Pulse_App_Chat_Openrouter::api_key_from_request( $body );
		if ( $api_key === '' ) {
			return 'OpenRouter API key is required. Add it in Dashboard → API Keys.';
		}
		Neo_Pulse_App_Chat_Openrouter::use_request_api_key( $api_key );
		return null;
	}

	private static function normalize_submode( string $submode ): string {
		$submode = sanitize_key( $submode );
		if ( in_array( $submode, array( 'ask', 'plan', 'build' ), true ) ) {
			return $submode;
		}
		return 'ask';
	}
}
