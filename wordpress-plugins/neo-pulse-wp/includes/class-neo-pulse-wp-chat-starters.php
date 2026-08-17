<?php
/**
 * Context-aware conversation starters for the chat empty state.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Chat_Starters {

	const CACHE_KEY  = 'neo_pulse_chat_starters_v1';
	const CACHE_TTL  = 3600;
	const MAX_COUNT  = 3;
	const FAST_MODEL = 'google/gemini-2.5-flash-lite';
	const MAX_TOKENS = 512;

	public static function invalidate_cache(): void {
		delete_transient( self::CACHE_KEY );
	}

	/**
	 * @param array<string,mixed> $settings Chat settings for index build.
	 * @return array<int,string>
	 */
	public static function get( array $settings = array() ): array {
		$cached = get_transient( self::CACHE_KEY );
		if ( is_array( $cached ) && ! empty( $cached ) ) {
			return self::normalize_list( $cached );
		}

		if ( empty( $settings ) ) {
			$settings = Neo_Pulse_Wp_Chat::get_settings();
		}

		$site_index = Neo_Pulse_Wp_Chat_Rag::get_site_index( $settings );
		$site_name  = get_bloginfo( 'name' );
		$generated  = self::generate( $site_index, $site_name, $settings );
		if ( is_wp_error( $generated ) || empty( $generated ) ) {
			return array();
		}

		set_transient( self::CACHE_KEY, $generated, self::CACHE_TTL );
		return self::normalize_list( $generated );
	}

	/**
	 * @param array<int,array<string,mixed>> $site_index
	 * @param array<string,mixed>            $settings
	 * @return array<int,string>|WP_Error
	 */
	public static function generate( array $site_index, string $site_name, array $settings = array() ): array {
		if ( empty( $site_index ) ) {
			return new WP_Error( 'neo_pulse_chat_starters_empty', __( 'Site index is empty.', 'neo-pulse-wp' ) );
		}

		$inventory = self::build_inventory_block( $site_index );
		$kb_block  = self::build_knowledge_block( $settings );

		$system = <<<'PROMPT'
You suggest conversation starter questions for a website chat widget empty state.

Return ONLY valid JSON:
{"starters": ["question 1", "question 2", "question 3"]}

Rules:
- Exactly 3 short visitor questions (max 12 words each).
- Ground every question in the SITE INVENTORY or KNOWLEDGE BASE. Do not invent pages, products, or services.
- Mix helpful discovery (products, services, locations) with action intent (booking, contact, quote) when the inventory supports it.
- Use natural visitor phrasing, not SEO keyword stuffing.
- Output ONLY JSON, no markdown fences.
PROMPT;

		$user = "Site name: {$site_name}\n\nSITE INVENTORY:\n{$inventory}";
		if ( $kb_block !== '' ) {
			$user .= "\n\nKNOWLEDGE BASE:\n{$kb_block}";
		}

		$result = self::call_openrouter( $system, $user );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed = self::parse_json_response( (string) $result );
		if ( null === $parsed || empty( $parsed['starters'] ) || ! is_array( $parsed['starters'] ) ) {
			return new WP_Error( 'neo_pulse_chat_starters_parse', __( 'Starter generation returned invalid JSON.', 'neo-pulse-wp' ) );
		}

		return self::normalize_list( $parsed['starters'] );
	}

	/**
	 * @param array<int,array<string,mixed>> $site_index
	 */
	private static function build_inventory_block( array $site_index ): string {
		$lines = array();
		foreach ( array_slice( $site_index, 0, 48 ) as $item ) {
			if ( empty( $item['title'] ) ) {
				continue;
			}
			$url   = isset( $item['url'] ) ? (string) $item['url'] : '';
			$type  = isset( $item['type'] ) ? (string) $item['type'] : '';
			$kw    = ! empty( $item['focus_keyword'] ) ? ' | kw:' . (string) $item['focus_keyword'] : '';
			$lines[] = '- ' . (string) $item['title'] . ( $type !== '' ? " ({$type})" : '' ) . ( $url !== '' ? ' → ' . $url : '' ) . $kw;
		}
		return implode( "\n", $lines );
	}

	/**
	 * @param array<string,mixed> $settings
	 */
	private static function build_knowledge_block( array $settings ): string {
		$kb = isset( $settings['knowledge_base'] ) && is_array( $settings['knowledge_base'] ) ? $settings['knowledge_base'] : array();
		if ( empty( $kb ) ) {
			return '';
		}

		$lines = array();
		foreach ( array_slice( $kb, 0, 12 ) as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$q = isset( $entry['question'] ) ? trim( (string) $entry['question'] ) : '';
			$a = isset( $entry['answer'] ) ? trim( (string) $entry['answer'] ) : '';
			if ( $q === '' && $a === '' ) {
				continue;
			}
			$lines[] = $q !== '' ? "Q: {$q}\nA: {$a}" : $a;
		}

		return implode( "\n\n", $lines );
	}

	/**
	 * @param array<int,mixed> $starters
	 * @return array<int,string>
	 */
	private static function normalize_list( array $starters ): array {
		$out = array();
		foreach ( $starters as $starter ) {
			if ( ! is_string( $starter ) ) {
				continue;
			}
			$starter = trim( sanitize_text_field( $starter ) );
			if ( $starter === '' ) {
				continue;
			}
			$out[] = $starter;
			if ( count( $out ) >= self::MAX_COUNT ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * @return string|WP_Error
	 */
	private static function call_openrouter( string $system_prompt, string $user_prompt ) {
		$key = Neo_Pulse_Wp_OpenRouter::get_api_key();
		if ( $key === '' ) {
			return new WP_Error( 'neo-pulse_openrouter_key', __( 'OpenRouter API key is not configured.', 'neo-pulse-wp' ) );
		}

		Neo_Pulse_Wp_OpenRouter::maybe_extend_time_limit();

		$response = wp_remote_post(
			Neo_Pulse_Wp_OpenRouter::API_URL,
			array(
				'timeout' => Neo_Pulse_Wp_OpenRouter::get_timeout(),
				'headers' => Neo_Pulse_Wp_OpenRouter::request_headers( $key ),
				'body'    => wp_json_encode(
					array(
						'model'       => self::FAST_MODEL,
						'messages'    => array(
							array( 'role' => 'system', 'content' => $system_prompt ),
							array( 'role' => 'user', 'content' => $user_prompt ),
						),
						'temperature' => 0.3,
						'max_tokens'  => self::MAX_TOKENS,
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code < 200 || $code >= 300 || ! is_array( $data ) || empty( $data['choices'][0]['message']['content'] ) ) {
			return new WP_Error( 'neo_pulse_chat_starters_ai', __( 'Starter generation failed.', 'neo-pulse-wp' ) );
		}

		return trim( (string) $data['choices'][0]['message']['content'] );
	}

	/**
	 * @return array|null
	 */
	private static function parse_json_response( string $text ): ?array {
		$text    = trim( $text );
		$text    = preg_replace( '/^```(?:json)?\s*/i', '', $text );
		$text    = preg_replace( '/\s*```$/', '', $text );
		$text    = trim( $text );
		$decoded = json_decode( $text, true );
		return is_array( $decoded ) ? $decoded : null;
	}
}
