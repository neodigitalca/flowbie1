<?php
/**
 * Compose page section copy for native Elementor widgets (no Agent Hub blocks).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Tools_Elementor_Sections {

	/**
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>
	 */
	public static function tool_compose_elementor_page_sections( array $params ): array {
		$prompt = isset( $params['prompt'] ) ? sanitize_textarea_field( (string) $params['prompt'] ) : '';
		if ( $prompt === '' && ! empty( $params['user_copy'] ) ) {
			$prompt = sanitize_textarea_field( (string) $params['user_copy'] );
		}
		if ( $prompt === '' ) {
			return array(
				'success' => false,
				'error'   => __( 'prompt is required for Elementor section copy.', 'neo-pulse-wp' ),
			);
		}

		$section_h2 = isset( $params['section_h2'] ) ? sanitize_text_field( (string) $params['section_h2'] ) : '';
		$user_copy  = isset( $params['user_copy'] ) ? sanitize_textarea_field( (string) $params['user_copy'] ) : '';

		$system = implode(
			"\n",
			array(
				'You write marketing page copy for WordPress Elementor native widgets (heading, text editor, button).',
				'Return JSON only with key "sections": an array of objects.',
				'Each section object must include: h2 (string), body_html (string, valid HTML paragraphs only, no scripts).',
				'Optional: bullets (array of strings), cta (string label for a button).',
				'Do not include Agent Hub or neo-pulse SEO block widgets.',
				'Match the requested H2 exactly when section_h2 is given.',
			)
		);

		$user = 'Prompt: ' . $prompt;
		if ( $section_h2 !== '' ) {
			$user .= "\nsection_h2 (use exactly): " . $section_h2;
		}
		if ( $user_copy !== '' && $user_copy !== $prompt ) {
			$user .= "\nUser copy:\n" . $user_copy;
		}

		$text = Neo_Pulse_Wp_Backend_Assist_Ai::call_openrouter(
			Neo_Pulse_Wp_Backend_Assist_Context::FAST_MODEL,
			$system,
			$user,
			4096,
			0.35,
			array( 'response_format' => array( 'type' => 'json_object' ) )
		);
		if ( is_wp_error( $text ) ) {
			return array(
				'success' => false,
				'error'   => $text->get_error_message(),
			);
		}

		$decoded = Neo_Pulse_Wp_Backend_Assist_Ai::parse_json_response( (string) $text );
		if ( ! is_array( $decoded ) || empty( $decoded['sections'] ) || ! is_array( $decoded['sections'] ) ) {
			return array(
				'success' => false,
				'error'   => __( 'Elementor section compose returned invalid JSON.', 'neo-pulse-wp' ),
			);
		}

		$sections = self::normalize_sections( $decoded['sections'] );
		if ( $sections === array() ) {
			return array(
				'success' => false,
				'error'   => __( 'Elementor section compose produced no valid sections.', 'neo-pulse-wp' ),
			);
		}

		return array(
			'success'  => true,
			'sections' => $sections,
			'summary'  => sprintf(
				/* translators: %d: section count */
				__( 'Composed %d Elementor section(s) of copy.', 'neo-pulse-wp' ),
				count( $sections )
			),
		);
	}

	/**
	 * @param array<int,mixed> $raw
	 * @return array<int,array{h2:string,body_html:string,bullets:array<int,string>,cta:string}>
	 */
	public static function normalize_sections( array $raw ): array {
		$out = array();
		foreach ( $raw as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$h2 = isset( $row['h2'] ) ? sanitize_text_field( (string) $row['h2'] ) : '';
			if ( $h2 === '' ) {
				continue;
			}
			$body = isset( $row['body_html'] ) ? wp_kses_post( (string) $row['body_html'] ) : '';
			if ( $body === '' && ! empty( $row['body'] ) ) {
				$body = wp_kses_post( (string) $row['body'] );
			}
			if ( $body === '' ) {
				continue;
			}
			$bullets = array();
			if ( ! empty( $row['bullets'] ) && is_array( $row['bullets'] ) ) {
				foreach ( $row['bullets'] as $bullet ) {
					$b = sanitize_text_field( (string) $bullet );
					if ( $b !== '' ) {
						$bullets[] = $b;
					}
				}
			}
			$cta = isset( $row['cta'] ) ? sanitize_text_field( (string) $row['cta'] ) : '';
			$out[] = array(
				'h2'        => $h2,
				'body_html' => $body,
				'bullets'   => $bullets,
				'cta'       => $cta,
			);
		}
		return $out;
	}

	/**
	 * @param array<int,array{h2:string,body_html:string,bullets?:array<int,string>,cta?:string}> $existing
	 * @param array<int,array{h2:string,body_html:string,bullets?:array<int,string>,cta?:string}> $incoming
	 * @return array<int,array{h2:string,body_html:string,bullets:array<int,string>,cta:string}>
	 */
	public static function merge_sections( array $existing, array $incoming ): array {
		$merged = self::normalize_sections( $existing );
		foreach ( self::normalize_sections( $incoming ) as $row ) {
			$merged[] = $row;
		}
		return $merged;
	}
}
