<?php
/**
 * SEO block AI optimizer (preview / apply).
 *
 * Copy-only: preserves slot IDs, layout grid, images, CTA URLs, and structure.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Blocks_Optimizer {

	/**
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>|WP_Error
	 */
	public static function preview( array $params ) {
		$post_id    = absint( $params['post_id'] ?? 0 );
		$block_id   = absint( $params['block_id'] ?? 0 );
		$element_id = sanitize_text_field( (string) ( $params['element_id'] ?? '' ) );
		$mode       = sanitize_key( (string) ( $params['mode'] ?? 'full' ) );
		$slots_in   = isset( $params['slots'] ) && is_array( $params['slots'] ) ? $params['slots'] : null;

		if ( ! in_array( $mode, array( 'full', 'intent' ), true ) ) {
			$mode = 'full';
		}

		$registry_optimize = $block_id > 0 && $element_id === '';

		if ( Neo_Pulse_Wp_OpenRouter::get_body_api_key() === '' && Neo_Pulse_Wp_OpenRouter::get_api_key() === '' ) {
			return new WP_Error( 'neo-pulse_openrouter', __( 'OpenRouter API key is required.', 'neo-pulse-wp' ) );
		}

		$row = $block_id > 0 ? Neo_Pulse_Wp_Seo_Blocks_Storage::get( $block_id ) : null;

		$post_id = Neo_Pulse_Wp_Seo_Blocks_Context::resolve_primary_post_id(
			$post_id,
			$block_id,
			is_array( $row ) ? $row : null
		);

		if ( $post_id > 0 ) {
			if ( $registry_optimize ) {
				$valid = Neo_Pulse_Wp_Seo_Blocks_Storage::validate_primary_post( $post_id );
				if ( is_wp_error( $valid ) ) {
					return $valid;
				}
			} elseif ( ! Neo_Pulse_Wp_Ai_Gate::can_preview( $post_id ) ) {
				return new WP_Error( 'neo-pulse_seo_block_gate', __( 'AI optimization is not available for this post.', 'neo-pulse-wp' ) );
			}
		}

		$page_context_override = sanitize_textarea_field( (string) ( $params['page_context'] ?? '' ) );

		$ctx = Neo_Pulse_Wp_Seo_Blocks_Context::build(
			array(
				'post_id'    => $post_id,
				'element_id' => $element_id,
				'block_id'   => $block_id,
				'block_row'  => is_array( $row ) ? $row : null,
			)
		);

		$current = isset( $ctx['currentBlock'] ) && is_array( $ctx['currentBlock'] ) ? $ctx['currentBlock'] : array();
		$slots   = $slots_in ? Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $slots_in ) : ( $current['slots'] ?? array() );

		if ( is_array( $row ) ) {
			if ( empty( $slots ) ) {
				$slots = $row['slots'] ?? array();
			}
			if ( empty( $current['topic_focus'] ) ) {
				$current['topic_focus'] = (string) ( $row['topic_focus'] ?? '' );
			}
			if ( empty( $current['focus_keyword'] ) ) {
				$current['focus_keyword'] = (string) ( $row['focus_keyword'] ?? '' );
			}
			if ( empty( $current['title'] ) ) {
				$current['title'] = (string) ( $row['title'] ?? '' );
			}
			if ( empty( $current['h2'] ) ) {
				$current['h2'] = (string) ( $row['h2'] ?? '' );
			}
		}

		$slots = Neo_Pulse_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots );

		$layout_config = array();
		if ( is_array( $row ) && ! empty( $row['layout_config'] ) && is_array( $row['layout_config'] ) ) {
			$layout_config = $row['layout_config'];
		} elseif ( isset( $params['layout_config'] ) && is_array( $params['layout_config'] ) ) {
			$layout_config = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $params['layout_config'], $slots );
		} else {
			$layout_config = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( array(), $slots );
		}

		if ( empty( $slots ) ) {
			return new WP_Error( 'neo-pulse_seo_block_empty', __( 'No content slots to optimize.', 'neo-pulse-wp' ) );
		}

		$topic_focus = (string) ( $params['topic_focus'] ?? $current['topic_focus'] ?? '' );
		if ( $topic_focus === '' ) {
			$topic_focus = (string) ( $params['focus_keyword'] ?? $current['focus_keyword'] ?? '' );
		}
		if ( $topic_focus === '' ) {
			$topic_focus = (string) ( $current['h2'] ?? '' );
		}
		if ( $topic_focus === '' && is_array( $row ) ) {
			$topic_focus = (string) ( $row['topic_focus'] ?? $row['focus_keyword'] ?? $row['h2'] ?? $row['title'] ?? '' );
		}
		if ( $topic_focus === '' ) {
			return new WP_Error( 'neo-pulse_seo_block_topic', __( 'Topic focus or focus keyword is required before optimizing.', 'neo-pulse-wp' ) );
		}

		$focus_keyword = (string) ( $params['focus_keyword'] ?? $current['focus_keyword'] ?? '' );
		if ( $focus_keyword === '' && is_array( $row ) ) {
			$focus_keyword = (string) ( $row['focus_keyword'] ?? '' );
		}

		$block_meta = array(
			'title'         => (string) ( $current['title'] ?? ( is_array( $row ) ? ( $row['title'] ?? '' ) : '' ) ),
			'focus_keyword' => $focus_keyword,
			'topic_focus'   => $topic_focus,
			'h2'            => (string) ( $current['h2'] ?? ( is_array( $row ) ? ( $row['h2'] ?? '' ) : '' ) ),
		);

		$has_linked_page = $post_id > 0 || $page_context_override !== '';
		$system          = self::system_prompt( $mode, $has_linked_page );
		$user            = self::user_prompt( $mode, $ctx, $slots, $layout_config, $block_meta, $topic_focus, $focus_keyword, $page_context_override );

		$result = Neo_Pulse_Wp_OpenRouter::complete_chat( $system, $user, 4096, $mode === 'intent' ? 0.4 : 0.7 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed = self::parse_slots_json( (string) ( $result['content'] ?? '' ) );
		if ( is_wp_error( $parsed ) ) {
			return $parsed;
		}

		$merged = self::merge_copy_onto_slots( $slots, $parsed );

		return array(
			'mode'          => $mode,
			'preview_slots' => $merged,
			'original_slots'=> $slots,
			'focus_keyword' => $focus_keyword,
			'topic_focus'   => $topic_focus,
		);
	}

	/**
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>|WP_Error
	 */
	public static function apply( array $params ) {
		$post_id       = absint( $params['post_id'] ?? 0 );
		$block_id      = absint( $params['block_id'] ?? 0 );
		$element_id    = sanitize_text_field( (string) ( $params['element_id'] ?? '' ) );
		$preview_slots = isset( $params['preview_slots'] ) && is_array( $params['preview_slots'] ) ? Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $params['preview_slots'] ) : array();
		$topic_focus   = sanitize_textarea_field( (string) ( $params['topic_focus'] ?? '' ) );
		$focus_keyword = sanitize_text_field( (string) ( $params['focus_keyword'] ?? '' ) );

		if ( empty( $preview_slots ) ) {
			return new WP_Error( 'neo-pulse_seo_block_apply', __( 'Preview slots are required.', 'neo-pulse-wp' ) );
		}

		if ( $post_id > 0 && $element_id !== '' ) {
			$updated = Neo_Pulse_Wp_Seo_Blocks_Sync::apply_to_page_element(
				$post_id,
				$element_id,
				$preview_slots,
				array(
					'block_id'      => $block_id,
					'topic_focus'   => $topic_focus,
					'focus_keyword' => $focus_keyword,
				)
			);
			if ( is_wp_error( $updated ) ) {
				return $updated;
			}
		}

		if ( $block_id > 0 ) {
			$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $block_id );
			if ( is_array( $row ) ) {
				$original = Neo_Pulse_Wp_Seo_Blocks_Slots::add_elementor_ids( $row['slots'] ?? array() );
				$preview_slots = self::merge_copy_onto_slots( $original, $preview_slots );

				if ( $topic_focus !== '' ) {
					$row['topic_focus'] = $topic_focus;
				}
				if ( $focus_keyword !== '' ) {
					$row['focus_keyword'] = $focus_keyword;
				}
				$row['slots'] = $preview_slots;
				Neo_Pulse_Wp_Seo_Blocks_Storage::update_slots( $block_id, $preview_slots, true );
				if ( $topic_focus !== '' || $focus_keyword !== '' ) {
					global $wpdb;
					$table  = Neo_Pulse_Wp_Seo_Blocks_Storage::table_name();
					$patch  = array( 'updated_at' => current_time( 'mysql' ) );
					if ( $topic_focus !== '' ) {
						$patch['topic_focus'] = $topic_focus;
					}
					if ( $focus_keyword !== '' ) {
						$patch['focus_keyword'] = $focus_keyword;
					}
					$wpdb->update( $table, $patch, array( 'id' => $block_id ) );
				}
				$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $block_id );
				if ( is_array( $row ) ) {
					Neo_Pulse_Wp_Seo_Blocks_Library::sync_row( $row );
				}
			}
		}

		return array(
			'success'  => true,
			'block_id' => $block_id,
			'post_id'  => $post_id,
			'slots'    => $preview_slots,
		);
	}

	private static function system_prompt( string $mode, bool $has_linked_page = false ): string {
		$types = implode( ', ', Neo_Pulse_Wp_Seo_Blocks_Slots::slot_types() );
		$base  = "You are an expert SEO copy editor for WordPress Elementor blocks.\n"
			. "The block has a fixed grid layout (provided in the user message). Your job is COPY ONLY.\n"
			. "Return ONLY valid JSON: an array of slot objects.\n"
			. "Allowed slot types: {$types}.\n\n"
			. "STRICT RULES:\n"
			. "- Keep the exact same number of slots, same _id values, same types, and same order.\n"
			. "- Do NOT add, remove, or reorder slots.\n"
			. "- Do NOT change layout_config (it is context only — do not return it).\n"
			. "- Do NOT change attachment_id, url, style, align_h, align_v, or heading_level.\n"
			. "- h2: rewrite text only.\n"
			. "- paragraph: rewrite html only.\n"
			. "- list: rewrite html or items only (keep list style).\n"
			. "- cta: rewrite label only (keep url and style).\n"
			. "- image: rewrite alt text only (keep attachment_id).\n"
			. "- Use the focus keyword naturally; tailor copy to each slot's grid position.\n"
			. "- Do not wrap JSON in markdown fences.\n";

		if ( $mode === 'intent' ) {
			$base .= "\nMode: intent alignment — tighten copy to topic focus and keyword with minimal changes.\n";
		} else {
			$base .= "\nMode: full copy optimize — improve SEO, clarity, and conversion while keeping structure identical.\n";
		}

		if ( $has_linked_page ) {
			$base .= "\n" . Neo_Pulse_Wp_Seo_Blocks_Context::linked_page_system_note() . "\n";
		}

		return $base;
	}

	/**
	 * @param array<string,mixed>              $ctx
	 * @param array<int,array<string,mixed>>   $slots
	 * @param array<string,mixed>              $layout_config
	 * @param array<string,mixed>              $block_meta
	 */
	private static function user_prompt( string $mode, array $ctx, array $slots, array $layout_config, array $block_meta, string $topic_focus, string $focus_keyword, string $page_context_override = '' ): string {
		$context_block = $page_context_override !== ''
			? $page_context_override
			: Neo_Pulse_Wp_Seo_Blocks_Context::format_for_prompt( $ctx );
		$manifest      = array_merge(
			$block_meta,
			array(
				'slots'         => $slots,
				'layout_config' => $layout_config,
			)
		);
		$block_json    = wp_json_encode( $manifest, JSON_PRETTY_PRINT );
		$instruction   = $mode === 'intent'
			? 'Align written copy to the topic focus and keyword. Layout and slot structure must stay identical.'
			: 'Rewrite written copy for stronger SEO and readability. Layout and slot structure must stay identical.';
		if ( $context_block !== '' ) {
			$instruction .= ' Optimize this block copy to fit the linked page intent.';
		}

		$prompt = "{$instruction}\n\n";
		if ( $context_block !== '' ) {
			$prompt .= "=== PAGE CONTEXT ===\n{$context_block}\n=== END ===\n\n";
		}
		$prompt .= "Block topic focus prompt:\n{$topic_focus}\n\n"
			. ( $focus_keyword !== '' ? "Block focus keyword: {$focus_keyword}\n\n" : '' )
			. "Full block manifest (slots + grid layout). Layout is for context only — do NOT modify it.\n"
			. "Each section's slot_ids show which copy belongs in which grid cell.\n\n"
			. "{$block_json}\n\n"
			. 'Return the optimized slots JSON array only, with identical _id, type, and order.';

		return $prompt;
	}

	/**
	 * Apply AI copy onto original slots; preserve IDs, layout bindings, media, and structure.
	 *
	 * @param array<int,array<string,mixed>> $original_slots
	 * @param array<int,array<string,mixed>> $ai_slots
	 * @return array<int,array<string,mixed>>
	 */
	private static function merge_copy_onto_slots( array $original_slots, array $ai_slots ): array {
		$original_slots = Neo_Pulse_Wp_Seo_Blocks_Slots::add_elementor_ids( $original_slots );
		$ai_by_id       = array();

		foreach ( $ai_slots as $slot ) {
			if ( ! empty( $slot['_id'] ) ) {
				$ai_by_id[ (string) $slot['_id'] ] = $slot;
			}
		}

		$merged = array();
		foreach ( $original_slots as $index => $orig ) {
			$sid = (string) ( $orig['_id'] ?? '' );
			$ai  = ( $sid !== '' && isset( $ai_by_id[ $sid ] ) ) ? $ai_by_id[ $sid ] : ( $ai_slots[ $index ] ?? null );

			if ( ! is_array( $ai ) || (string) ( $ai['type'] ?? '' ) !== (string) ( $orig['type'] ?? '' ) ) {
				$merged[] = $orig;
				continue;
			}

			$merged[] = self::merge_slot_copy( $orig, $ai );
		}

		return Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $merged );
	}

	/**
	 * @param array<string,mixed> $orig
	 * @param array<string,mixed> $ai
	 * @return array<string,mixed>
	 */
	private static function merge_slot_copy( array $orig, array $ai ): array {
		$slot = $orig;
		$type = (string) ( $orig['type'] ?? '' );

		switch ( $type ) {
			case 'h2':
				if ( isset( $ai['text'] ) && (string) $ai['text'] !== '' ) {
					$slot['text'] = sanitize_text_field( (string) $ai['text'] );
				}
				break;
			case 'paragraph':
				if ( ! empty( $ai['html'] ) ) {
					$slot['html'] = wp_kses_post( (string) $ai['html'] );
				} elseif ( ! empty( $ai['text'] ) ) {
					$text = trim( (string) $ai['text'] );
					$slot['html'] = wp_kses_post( '<p>' . esc_html( $text ) . '</p>' );
				}
				break;
			case 'list':
				if ( ! empty( $ai['html'] ) ) {
					$slot['html'] = wp_kses_post( (string) $ai['html'] );
				} elseif ( ! empty( $ai['items'] ) && is_array( $ai['items'] ) ) {
					$slot['items'] = array_values(
						array_filter(
							array_map(
								static function ( $item ) {
									return sanitize_text_field( (string) $item );
								},
								$ai['items']
							),
							static function ( $item ) {
								return $item !== '';
							}
						)
					);
				}
				break;
			case 'cta':
				if ( isset( $ai['label'] ) && (string) $ai['label'] !== '' ) {
					$slot['label'] = sanitize_text_field( (string) $ai['label'] );
				}
				break;
			case 'image':
				if ( isset( $ai['alt'] ) ) {
					$slot['alt'] = sanitize_text_field( (string) $ai['alt'] );
				}
				break;
		}

		return $slot;
	}

	/**
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	private static function parse_slots_json( string $content ) {
		$content = trim( $content );
		$content = preg_replace( '/^```(?:json)?\s*/i', '', $content );
		$content = preg_replace( '/\s*```\s*$/', '', $content );
		$content = trim( (string) $content );

		$decoded = json_decode( $content, true );
		if ( ! is_array( $decoded ) ) {
			$start = strpos( $content, '[' );
			$end   = strrpos( $content, ']' );
			if ( $start !== false && $end !== false && $end > $start ) {
				$decoded = json_decode( substr( $content, $start, $end - $start + 1 ), true );
			}
		}

		if ( is_array( $decoded ) && isset( $decoded['slots'] ) && is_array( $decoded['slots'] ) ) {
			$decoded = $decoded['slots'];
		}

		if ( ! is_array( $decoded ) ) {
			return new WP_Error( 'neo-pulse_seo_block_json', __( 'AI returned invalid slot JSON.', 'neo-pulse-wp' ) );
		}

		if ( array_keys( $decoded ) !== range( 0, count( $decoded ) - 1 ) ) {
			$decoded = array_values( $decoded );
		}

		$normalized = Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $decoded );
		if ( empty( $normalized ) ) {
			return new WP_Error( 'neo-pulse_seo_block_json', __( 'AI returned empty slots.', 'neo-pulse-wp' ) );
		}

		return $normalized;
	}
}
