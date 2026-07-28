<?php
/**
 * SEO block AI composer — full manifest generation for Agent tab.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Seo_Blocks_Agent {

	/**
	 * Backend Assist tool handler.
	 *
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>
	 */
	public static function tool_handler( array $params ): array {
		$result = self::compose(
			array(
				'prompt'        => (string) ( $params['prompt'] ?? '' ),
				'mode'          => (string) ( $params['mode'] ?? 'generate_full' ),
				'current_block' => isset( $params['current_block'] ) && is_array( $params['current_block'] ) ? $params['current_block'] : array(),
				'page_context'  => (string) ( $params['page_context'] ?? '' ),
			)
		);

		if ( is_wp_error( $result ) ) {
			return array(
				'success' => false,
				'error'   => $result->get_error_message(),
			);
		}

		return $result;
	}

	/**
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>|WP_Error
	 */
	public static function compose( array $params ) {
		$prompt = sanitize_textarea_field( (string) ( $params['prompt'] ?? '' ) );
		$mode   = sanitize_key( (string) ( $params['mode'] ?? 'generate_full' ) );
		$block  = isset( $params['current_block'] ) && is_array( $params['current_block'] ) ? $params['current_block'] : array();
		$page_context = sanitize_textarea_field( (string) ( $params['page_context'] ?? '' ) );
		if ( $page_context === '' ) {
			$page_context = Flowbie_Wp_Seo_Blocks_Context::prompt_for_block(
				absint( $block['primary_post_id'] ?? 0 ),
				absint( $block['id'] ?? 0 ),
				$block
			);
		}

		if ( ! in_array( $mode, array( 'generate_full', 'optimize', 'analyze' ), true ) ) {
			$mode = 'generate_full';
		}

		if ( $prompt === '' && $mode !== 'analyze' ) {
			return new WP_Error( 'flowbie_seo_agent_prompt', __( 'Prompt is required.', 'flowbie-wp' ) );
		}

		if ( Flowbie_Wp_OpenRouter::get_body_api_key() === '' && Flowbie_Wp_OpenRouter::get_api_key() === '' ) {
			return new WP_Error( 'flowbie_openrouter', __( 'OpenRouter API key is required.', 'flowbie-wp' ) );
		}

		if ( $mode === 'analyze' ) {
			$manifest = self::normalize_manifest( $block );
			$summary  = self::analyze_summary( $prompt, $manifest );
			if ( is_wp_error( $summary ) ) {
				return $summary;
			}
			return array(
				'success'        => true,
				'block_manifest' => $manifest,
				'summary'        => $summary,
				'title'          => __( 'SEO block analysis', 'flowbie-wp' ),
			);
		}

		$system = self::system_prompt( $mode, $page_context !== '' );
		$user   = self::user_prompt( $prompt, $mode, $block, $page_context );

		$result = Flowbie_Wp_OpenRouter::complete_chat( $system, $user, 8192, 0.65 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed = self::parse_manifest_json( (string) ( $result['content'] ?? '' ) );
		if ( is_wp_error( $parsed ) ) {
			return $parsed;
		}

		$manifest = self::normalize_manifest( array_merge( $block, $parsed ) );
		$manifest = self::preserve_media_on_optimize( $block, $manifest, $mode );

		return array(
			'success'        => true,
			'block_manifest' => $manifest,
			'summary'        => (string) ( $parsed['summary'] ?? __( 'Block manifest generated.', 'flowbie-wp' ) ),
			'title'          => $mode === 'optimize'
				? __( 'Block optimized', 'flowbie-wp' )
				: __( 'Block generated', 'flowbie-wp' ),
		);
	}

	/**
	 * @param array<string,mixed> $existing
	 * @param array<string,mixed> $manifest
	 * @param string              $mode
	 * @return array<string,mixed>
	 */
	private static function preserve_media_on_optimize( array $existing, array $manifest, string $mode ): array {
		if ( $mode !== 'optimize' || empty( $existing['slots'] ) || empty( $manifest['slots'] ) ) {
			return $manifest;
		}

		$by_id = array();
		foreach ( $existing['slots'] as $slot ) {
			if ( ! empty( $slot['_id'] ) ) {
				$by_id[ (string) $slot['_id'] ] = $slot;
			}
		}

		foreach ( $manifest['slots'] as $i => $slot ) {
			$sid = (string) ( $slot['_id'] ?? '' );
			if ( $sid === '' || ! isset( $by_id[ $sid ] ) ) {
				continue;
			}
			$prev = $by_id[ $sid ];
			if ( ( $slot['type'] ?? '' ) === 'image' && ! empty( $prev['attachment_id'] ) ) {
				$manifest['slots'][ $i ]['attachment_id']  = $prev['attachment_id'];
				$manifest['slots'][ $i ]['attachment_url'] = $prev['attachment_url'] ?? '';
				if ( empty( $manifest['slots'][ $i ]['alt'] ) && ! empty( $prev['alt'] ) ) {
					$manifest['slots'][ $i ]['alt'] = $prev['alt'];
				}
			}
		}

		return $manifest;
	}

	/**
	 * @param array<string,mixed> $raw
	 * @return array<string,mixed>
	 */
	public static function normalize_manifest_public( array $raw ): array {
		return self::normalize_manifest( $raw );
	}

	/**
	 * @param array<string,mixed> $raw
	 * @return array<string,mixed>
	 */
	private static function normalize_manifest( array $raw ): array {
		$slots = isset( $raw['slots'] ) && is_array( $raw['slots'] ) ? $raw['slots'] : array();
		$slots = Flowbie_Wp_Seo_Blocks_Slots::normalize_list( $slots );
		$slots = Flowbie_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots );

		$layout_raw = isset( $raw['layout_config'] ) && is_array( $raw['layout_config'] ) ? $raw['layout_config'] : array();
		$layout     = Flowbie_Wp_Seo_Blocks_Layout::normalize_config( $layout_raw, $slots );

		$primary_post_id = absint( $raw['primary_post_id'] ?? 0 );

		return array(
			'id'              => absint( $raw['id'] ?? 0 ),
			'title'           => sanitize_text_field( (string) ( $raw['title'] ?? '' ) ),
			'focus_keyword'   => sanitize_text_field( (string) ( $raw['focus_keyword'] ?? '' ) ),
			'topic_focus'     => sanitize_textarea_field( (string) ( $raw['topic_focus'] ?? '' ) ),
			'h2'              => sanitize_text_field( (string) ( $raw['h2'] ?? '' ) ),
			'status'          => sanitize_key( (string) ( $raw['status'] ?? 'draft' ) ),
			'primary_post_id' => $primary_post_id,
			'slots'           => $slots,
			'layout_config'   => $layout,
		);
	}

	private static function system_prompt( string $mode, bool $has_linked_page = false ): string {
		$types = implode( ', ', Flowbie_Wp_Seo_Blocks_Slots::slot_types() );
		$max   = Flowbie_Wp_Seo_Blocks_Layout::GRID_MAX;

		$base = "You are an expert SEO block composer for WordPress Agent Hub.\n"
			. "Return ONLY valid JSON object (no markdown fences) with keys:\n"
			. "title, focus_keyword, topic_focus, h2, status, slots, layout_config, summary\n\n"
			. "slots: array of slot objects. Allowed types: {$types}.\n"
			. "Schema examples:\n"
			. "- h2: {\"type\":\"h2\",\"text\":\"Heading\",\"heading_level\":2,\"align_h\":\"left\"}\n"
			. "- paragraph: {\"type\":\"paragraph\",\"html\":\"<p>Text</p>\",\"align_h\":\"left\"}\n"
			. "- cta: {\"type\":\"cta\",\"label\":\"Label\",\"url\":\"/path\",\"style\":\"primary\"}\n"
			. "- image: {\"type\":\"image\",\"attachment_id\":0,\"alt\":\"\"}\n"
			. "- list: {\"type\":\"list\",\"style\":\"bullet\",\"items\":[\"a\",\"b\"]}\n\n"
			. "layout_config must include:\n"
			. "- grid: {rows, cols} integers 1-{$max}\n"
			. "- sections: [{row, col, col_span, align_h, slot_ids: [\"id1\"]}]\n"
			. "- responsive: desktop/tablet/mobile breakpoint settings\n\n"
			. "Use col_span to merge columns and align_h (left|center|right) to center content in merged spans.\n"
			. "summary: one paragraph explaining what you changed.\n";

		if ( $mode === 'optimize' ) {
			$base .= "Mode: optimize — improve copy and SEO while preserving slot IDs and image attachment_id values when present.\n";
		} else {
			$base .= "Mode: generate_full — produce a complete block from the user prompt.\n";
		}

		if ( $has_linked_page ) {
			$base .= "\n" . Flowbie_Wp_Seo_Blocks_Context::linked_page_system_note() . "\n";
		}

		return $base;
	}

	/**
	 * @param array<string,mixed> $block
	 */
	private static function user_prompt( string $prompt, string $mode, array $block, string $page_context = '' ): string {
		$block_json = wp_json_encode( $block, JSON_PRETTY_PRINT );
		$instruction = $mode === 'optimize'
			? 'Optimize this SEO block manifest for stronger SEO and clarity.'
			: 'Generate a complete SEO block manifest from this request.';
		if ( $page_context !== '' ) {
			$instruction .= ' Align copy with the linked page intent.';
		}

		$out = "{$instruction}\n\nUser request:\n{$prompt}\n\n";
		if ( $page_context !== '' ) {
			$out .= "=== LINKED PAGE CONTEXT ===\n{$page_context}\n=== END ===\n\n";
		}

		$post_id = absint( $block['primary_post_id'] ?? 0 );
		$fk      = sanitize_text_field( (string) ( $block['focus_keyword'] ?? '' ) );
		if ( $post_id > 0 || $fk !== '' ) {
			$gsc = Flowbie_Wp_Gsc_Prompt::for_post( $post_id, $fk );
			if ( $gsc !== '' ) {
				$out .= "Use these Search Console queries naturally in slot copy:\n{$gsc}\n";
			}
		}

		$out .= "Current block JSON (may be empty for new blocks):\n{$block_json}\n\nReturn the full updated manifest JSON object only.";
		return $out;
	}

	/**
	 * @param array<string,mixed> $manifest
	 * @return string|WP_Error
	 */
	private static function analyze_summary( string $prompt, array $manifest ) {
		$system = 'You are an SEO analyst. Given a block manifest JSON, return a concise bullet list of SEO gaps and improvement suggestions. Plain text only.';
		$user   = "User question:\n{$prompt}\n\nBlock manifest:\n" . wp_json_encode( $manifest, JSON_PRETTY_PRINT );

		$result = Flowbie_Wp_OpenRouter::complete_chat( $system, $user, 1024, 0.4 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return trim( (string) ( $result['content'] ?? '' ) );
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	private static function parse_manifest_json( string $content ) {
		$content = trim( $content );
		$content = preg_replace( '/^```(?:json)?\s*/i', '', $content );
		$content = preg_replace( '/\s*```\s*$/', '', $content );
		$content = trim( (string) $content );

		$decoded = json_decode( $content, true );
		if ( ! is_array( $decoded ) ) {
			$start = strpos( $content, '{' );
			$end   = strrpos( $content, '}' );
			if ( $start !== false && $end !== false && $end > $start ) {
				$decoded = json_decode( substr( $content, $start, $end - $start + 1 ), true );
			}
		}

		if ( ! is_array( $decoded ) ) {
			return new WP_Error( 'flowbie_seo_agent_json', __( 'AI returned invalid block manifest JSON.', 'flowbie-wp' ) );
		}

		return $decoded;
	}
}
