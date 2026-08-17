<?php
/**
 * Decode HTML entities for user-facing display strings.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Display_Text {

	/**
	 * Decode HTML entities (including numeric) for display.
	 */
	public static function decode( string $text ): string {
		if ( $text === '' ) {
			return '';
		}

		$decoded = $text;
		for ( $i = 0; $i < 3; $i++ ) {
			$next = html_entity_decode( $decoded, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			if ( $next === $decoded ) {
				break;
			}
			$decoded = $next;
		}

		return $decoded;
	}

	/**
	 * Decode display strings on a chat answer card payload.
	 *
	 * @param array<string,mixed> $card
	 * @return array<string,mixed>
	 */
	public static function decode_card( array $card ): array {
		if ( isset( $card['title'] ) && is_string( $card['title'] ) ) {
			$card['title'] = self::decode( $card['title'] );
		}
		if ( isset( $card['body'] ) && is_string( $card['body'] ) ) {
			$card['body'] = self::decode( $card['body'] );
		}
		if ( isset( $card['cta'] ) && is_array( $card['cta'] ) && isset( $card['cta']['label'] ) && is_string( $card['cta']['label'] ) ) {
			$card['cta']['label'] = self::decode( $card['cta']['label'] );
		}
		if ( isset( $card['links'] ) && is_array( $card['links'] ) ) {
			foreach ( $card['links'] as $i => $link ) {
				if ( is_array( $link ) && isset( $link['label'] ) && is_string( $link['label'] ) ) {
					$card['links'][ $i ]['label'] = self::decode( $link['label'] );
				}
			}
		}
		if ( isset( $card['relatedTopics'] ) && is_array( $card['relatedTopics'] ) ) {
			foreach ( $card['relatedTopics'] as $i => $topic ) {
				if ( is_string( $topic ) ) {
					$card['relatedTopics'][ $i ] = self::decode( $topic );
				}
			}
		}

		return $card;
	}
}
