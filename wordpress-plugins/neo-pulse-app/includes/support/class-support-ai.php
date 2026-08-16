<?php
/**
 * Support ticket AI title + summary generation.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Support_Ai {

	const MODEL = 'google/gemini-2.5-flash-lite';

	/**
	 * @param array<string,mixed> $body Request body (chatLog, comment, openRouterApiKey).
	 * @return array{ok:bool,title?:string,summary?:string,error?:string}
	 */
	public static function generate_title_summary( array $body ): array {
		try {
			self::prepare_openrouter_key( $body );

			$comment = isset( $body['comment'] ) ? trim( sanitize_textarea_field( (string) $body['comment'] ) ) : '';
			if ( $comment === '' ) {
				return array(
					'ok'    => false,
					'error' => 'Reporter description is required before generating ticket details.',
				);
			}

			$excerpt = self::build_excerpt( $body );
			if ( $excerpt === '' ) {
				return array(
					'ok'    => false,
					'error' => 'Chat log context is required before generating ticket details.',
				);
			}

			$parsed = Neo_Pulse_App_Chat_Openrouter::json_completion(
				array(
					array(
						'role'    => 'system',
						'content' => 'You write concise support ticket metadata for a product engineering team. Return JSON only: {"title":"...","summary":"..."}. The reporter description is authoritative: describe only what they report plus supporting facts from the chat log. Do not invent new bugs, UX complaints, or problems the reporter did not mention. Title: max 12 words, specific to their report. Summary: 2-4 sentences grounded in the reporter description; use the chat log only as supporting context.',
					),
					array(
						'role'    => 'user',
						'content' => $excerpt,
					),
				),
				array(
					'model'       => self::MODEL,
					'temperature' => 0.2,
					'maxTokens'   => 512,
				)
			);

			$title   = sanitize_text_field( (string) ( $parsed['title'] ?? '' ) );
			$summary = sanitize_textarea_field( (string) ( $parsed['summary'] ?? '' ) );

			if ( $title === '' || $summary === '' ) {
				return array(
					'ok'    => false,
					'error' => 'OpenRouter returned empty title or summary.',
				);
			}

			return array(
				'ok'      => true,
				'title'   => $title,
				'summary' => $summary,
			);
		} catch ( Exception $e ) {
			return array(
				'ok'    => false,
				'error' => $e->getMessage(),
			);
		} finally {
			Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();
		}
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function build_excerpt( array $body ): string {
		$lines   = array();
		$comment = isset( $body['comment'] ) ? trim( sanitize_textarea_field( (string) $body['comment'] ) ) : '';
		if ( $comment !== '' ) {
			$lines[] = 'Reporter description (authoritative): ' . $comment;
		}

		$chat_log = isset( $body['chatLog'] ) && is_array( $body['chatLog'] ) ? $body['chatLog'] : array();
		$history  = isset( $chat_log['history'] ) && is_array( $chat_log['history'] ) ? $chat_log['history'] : array();
		$turns    = isset( $chat_log['turns'] ) && is_array( $chat_log['turns'] ) ? $chat_log['turns'] : array();

		if ( count( $history ) > 0 ) {
			$lines[] = 'Chat history:';
			foreach ( array_slice( $history, -8 ) as $entry ) {
				if ( ! is_array( $entry ) ) {
					continue;
				}
				$role    = (string) ( $entry['role'] ?? 'user' );
				$content = trim( (string) ( $entry['content'] ?? '' ) );
				if ( $content !== '' ) {
					$lines[] = strtoupper( $role ) . ': ' . self::truncate( $content, 1200 );
				}
			}
		} elseif ( count( $turns ) > 0 ) {
			$lines[] = 'Chat turns:';
			foreach ( array_slice( $turns, -8 ) as $turn ) {
				if ( ! is_array( $turn ) ) {
					continue;
				}
				$kind = (string) ( $turn['kind'] ?? '' );
				if ( $kind === 'user' ) {
					$lines[] = 'USER: ' . self::truncate( (string) ( $turn['text'] ?? '' ), 1200 );
				} elseif ( $kind === 'card' && isset( $turn['card'] ) && is_array( $turn['card'] ) ) {
					$card = $turn['card'];
					$lines[] = 'ASSISTANT: ' . self::truncate(
						trim( (string) ( $card['title'] ?? '' ) . "\n" . (string) ( $card['body'] ?? '' ) ),
						1200
					);
				}
			}
		}

		$workspace = isset( $chat_log['workspace'] ) && is_array( $chat_log['workspace'] ) ? $chat_log['workspace'] : array();
		if ( count( $workspace ) > 0 ) {
			$lines[] = 'Workspace: ' . wp_json_encode( $workspace, JSON_UNESCAPED_SLASHES );
		}

		return implode( "\n", $lines );
	}

	private static function truncate( string $text, int $max ): string {
		$text = trim( preg_replace( '/\s+/', ' ', $text ) ?? '' );
		if ( strlen( $text ) <= $max ) {
			return $text;
		}
		return substr( $text, 0, $max - 1 ) . '…';
	}

	/**
	 * Same OpenRouter key resolution as Pulse Assist and team chat.
	 *
	 * @param array<string,mixed> $body
	 */
	private static function prepare_openrouter_key( array $body ): void {
		$key = Neo_Pulse_App_Chat_Openrouter::api_key_from_request( $body );
		if ( $key === '' ) {
			throw new Exception( 'OpenRouter API key is required. Add it in Dashboard → API Keys.' );
		}
		Neo_Pulse_App_Chat_Openrouter::use_request_api_key( $key );
	}
}
