<?php
/**
 * SEO block AI composer — full manifest generation for Agent tab.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Blocks_Agent {

	/**
	 * Backend Assist tool handler.
	 *
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>
	 */
	public static function tool_handler( array $params ): array {
		$compose = array(
			'prompt'        => (string) ( $params['prompt'] ?? '' ),
			'mode'          => (string) ( $params['mode'] ?? 'generate_full' ),
			'current_block' => isset( $params['current_block'] ) && is_array( $params['current_block'] ) ? $params['current_block'] : array(),
			'page_context'  => (string) ( $params['page_context'] ?? '' ),
		);
		if ( array_key_exists( 'user_copy', $params ) ) {
			$compose['user_copy'] = (string) $params['user_copy'];
		}
		$result = self::compose( $compose );

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
		$prompt     = sanitize_textarea_field( (string) ( $params['prompt'] ?? '' ) );
		$user_copy  = trim( (string) ( $params['user_copy'] ?? '' ) );
		$mode       = sanitize_key( (string) ( $params['mode'] ?? 'generate_full' ) );
		$block      = isset( $params['current_block'] ) && is_array( $params['current_block'] ) ? $params['current_block'] : array();
		$page_context = sanitize_textarea_field( (string) ( $params['page_context'] ?? '' ) );
		if ( $page_context === '' ) {
			$page_context = Neo_Pulse_Wp_Seo_Blocks_Context::prompt_for_block(
				absint( $block['primary_post_id'] ?? 0 ),
				absint( $block['id'] ?? 0 ),
				$block
			);
		}

		if ( ! in_array( $mode, array( 'generate_full', 'optimize', 'analyze' ), true ) ) {
			$mode = 'generate_full';
		}

		$has_slots = ! empty( $block['slots'] ) && is_array( $block['slots'] );
		if ( $mode === 'generate_full' && ! $has_slots && array_key_exists( 'user_copy', $params ) && $user_copy === '' ) {
			return new WP_Error( 'neo-pulse_seo_agent_user_copy', __( 'user_copy is required to create a new SEO block.', 'neo-pulse-wp' ) );
		}
		if ( $user_copy !== '' && $prompt === '' ) {
			$prompt = $user_copy;
		}

		if ( $prompt === '' && $mode !== 'analyze' ) {
			return new WP_Error( 'neo-pulse_seo_agent_prompt', __( 'Prompt is required.', 'neo-pulse-wp' ) );
		}

		if ( Neo_Pulse_Wp_OpenRouter::get_body_api_key() === '' && Neo_Pulse_Wp_OpenRouter::get_api_key() === '' ) {
			return new WP_Error( 'neo-pulse_openrouter', __( 'OpenRouter API key is required.', 'neo-pulse-wp' ) );
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
				'title'          => __( 'SEO block analysis', 'neo-pulse-wp' ),
			);
		}

		$system = self::system_prompt( $mode, $page_context !== '' );
		$user   = self::user_prompt( $prompt, $mode, $block, $page_context, $user_copy );

		$result = Neo_Pulse_Wp_OpenRouter::complete_chat( $system, $user, 8192, 0.65 );
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
			'summary'        => (string) ( $parsed['summary'] ?? __( 'Block manifest generated.', 'neo-pulse-wp' ) ),
			'title'          => $mode === 'optimize'
				? __( 'Block optimized', 'neo-pulse-wp' )
				: __( 'Block generated', 'neo-pulse-wp' ),
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
	 * Map pasted copy onto existing slot ids only.
	 *
	 * @param array<string,mixed> $block
	 * @return array<string,mixed>|WP_Error
	 */
	public static function fill_slots_from_user_copy( array $block, string $user_copy ) {
		$user_copy = trim( $user_copy );
		if ( $user_copy === '' ) {
			return new WP_Error( 'neo-pulse_seo_fill_copy', __( 'user_copy is required to fill template slots.', 'neo-pulse-wp' ) );
		}

		$slots = isset( $block['slots'] ) && is_array( $block['slots'] ) ? $block['slots'] : array();
		if ( empty( $slots ) ) {
			return new WP_Error( 'neo-pulse_seo_fill_slots', __( 'Template has no slots to fill.', 'neo-pulse-wp' ) );
		}

		$catalog = array();
		foreach ( $slots as $slot ) {
			if ( ! is_array( $slot ) || empty( $slot['_id'] ) ) {
				continue;
			}
			$catalog[] = array(
				'_id'  => (string) $slot['_id'],
				'type' => (string) ( $slot['type'] ?? '' ),
			);
		}
		if ( empty( $catalog ) ) {
			return new WP_Error( 'neo-pulse_seo_fill_slots', __( 'Template slots are missing ids.', 'neo-pulse-wp' ) );
		}

		$system = "You map user copy onto an existing SEO block slot list.\n"
			. "Return ONLY a JSON object: {\"slots\":[{\"_id\":\"existing-id\",\"text\":\"\",\"html\":\"\",\"label\":\"\",\"url\":\"\",\"items\":[]}]}\n"
			. "Rules:\n"
			. "- Use only _id values from the provided slot catalog. Do not invent ids or types.\n"
			. "- Put the user's copy into the matching slot fields (h2=text, paragraph=html, list=items or html, cta=label/url).\n"
			. "- Do not add slots. Omit a slot if the copy has nothing for it.\n"
			. "- At least one slot update is required.";
		$user   = "Slot catalog:\n" . wp_json_encode( $catalog, JSON_PRETTY_PRINT )
			. "\n\nVerbatim user copy:\n{$user_copy}\n\nReturn the JSON object only.";

		$result = Neo_Pulse_Wp_OpenRouter::complete_chat( $system, $user, 2048, 0.1 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed = self::parse_manifest_json( (string) ( $result['content'] ?? '' ) );
		if ( is_wp_error( $parsed ) ) {
			return $parsed;
		}

		$updates = isset( $parsed['slots'] ) && is_array( $parsed['slots'] ) ? $parsed['slots'] : array();
		return self::apply_mapped_slot_updates( $block, $updates );
	}

	/**
	 * @param array<string,mixed>      $block
	 * @param array<int,array<string,mixed>> $updates
	 * @return array<string,mixed>|WP_Error
	 */
	public static function apply_mapped_slot_updates( array $block, array $updates ) {
		if ( empty( $updates ) ) {
			return new WP_Error( 'neo-pulse_seo_fill_empty', __( 'No slot updates were mapped from user_copy.', 'neo-pulse-wp' ) );
		}

		$known = array();
		foreach ( isset( $block['slots'] ) && is_array( $block['slots'] ) ? $block['slots'] : array() as $slot ) {
			if ( is_array( $slot ) && ! empty( $slot['_id'] ) ) {
				$known[ (string) $slot['_id'] ] = true;
			}
		}

		$applied = 0;
		foreach ( $updates as $update ) {
			if ( ! is_array( $update ) ) {
				continue;
			}
			$sid = (string) ( $update['_id'] ?? $update['slot_id'] ?? '' );
			if ( $sid === '' ) {
				return new WP_Error( 'neo-pulse_seo_fill_id', __( 'Slot update is missing _id.', 'neo-pulse-wp' ) );
			}
			if ( empty( $known[ $sid ] ) ) {
				return new WP_Error( 'neo-pulse_seo_fill_unknown', __( 'Slot update targeted an id that is not on the template.', 'neo-pulse-wp' ) );
			}

			$patch = array();
			foreach ( array( 'text', 'html', 'label', 'url', 'alt', 'style' ) as $field ) {
				if ( array_key_exists( $field, $update ) ) {
					$patch[ $field ] = $update[ $field ];
				}
			}
			if ( isset( $update['items'] ) && is_array( $update['items'] ) ) {
				$patch['items'] = $update['items'];
			}
			if ( empty( $patch ) ) {
				continue;
			}

			$updated = Neo_Pulse_Wp_Seo_Blocks_Mutation::update_slot( $block, $sid, $patch );
			if ( is_wp_error( $updated ) ) {
				return $updated;
			}
			$block = $updated;
			++$applied;
		}

		if ( $applied < 1 ) {
			return new WP_Error( 'neo-pulse_seo_fill_empty', __( 'No slot updates were mapped from user_copy.', 'neo-pulse-wp' ) );
		}

		return $block;
	}

	/**
	 * @param array<string,mixed> $raw
	 * @return array<string,mixed>
	 */
	private static function normalize_manifest( array $raw ): array {
		$slots = isset( $raw['slots'] ) && is_array( $raw['slots'] ) ? $raw['slots'] : array();
		$slots = Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $slots );
		$slots = Neo_Pulse_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots );

		$layout_raw = isset( $raw['layout_config'] ) && is_array( $raw['layout_config'] ) ? $raw['layout_config'] : array();
		$layout     = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $layout_raw, $slots );

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
		$types = implode( ', ', Neo_Pulse_Wp_Seo_Blocks_Slots::slot_types() );
		$max   = Neo_Pulse_Wp_Seo_Blocks_Layout::GRID_MAX;

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
			$base .= "Mode: generate_full — produce a complete block from the user prompt.\n"
				. "When VERBATIM USER COPY is present, put that copy into slots. Do not replace it with invented text.\n";
		}

		if ( $has_linked_page ) {
			$base .= "\n" . Neo_Pulse_Wp_Seo_Blocks_Context::linked_page_system_note() . "\n";
		}

		return $base;
	}

	/**
	 * @param array<string,mixed> $block
	 */
	private static function user_prompt( string $prompt, string $mode, array $block, string $page_context = '', string $user_copy = '' ): string {
		$block_json = wp_json_encode( $block, JSON_PRETTY_PRINT );
		$instruction = $mode === 'optimize'
			? 'Optimize this SEO block manifest for stronger SEO and clarity.'
			: 'Generate a complete SEO block manifest from this request.';
		if ( $page_context !== '' ) {
			$instruction .= ' Align copy with the linked page intent.';
		}

		$out = "{$instruction}\n\nUser request:\n{$prompt}\n\n";
		if ( $user_copy !== '' ) {
			$out .= "=== VERBATIM USER COPY (required in slots) ===\n{$user_copy}\n=== END ===\n\n";
		}
		if ( $page_context !== '' ) {
			$out .= "=== LINKED PAGE CONTEXT ===\n{$page_context}\n=== END ===\n\n";
		}

		$post_id = absint( $block['primary_post_id'] ?? 0 );
		$fk      = sanitize_text_field( (string) ( $block['focus_keyword'] ?? '' ) );
		if ( $post_id > 0 || $fk !== '' ) {
			$gsc = Neo_Pulse_Wp_Gsc_Prompt::for_post( $post_id, $fk );
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

		$result = Neo_Pulse_Wp_OpenRouter::complete_chat( $system, $user, 1024, 0.4 );
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
			return new WP_Error( 'neo-pulse_seo_agent_json', __( 'AI returned invalid block manifest JSON.', 'neo-pulse-wp' ) );
		}

		return $decoded;
	}
}
