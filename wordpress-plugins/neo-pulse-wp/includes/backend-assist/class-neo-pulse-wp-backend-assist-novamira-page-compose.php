<?php
/**
 * Layout plan + Elementor materialize from site design RAG and SEO slots.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Compose {

	/**
	 * @param array<string,mixed>            $tokens
	 * @param array<string,mixed>            $digest
	 * @param array<int,array<string,mixed>> $slots
	 * @return array<string,mixed>|WP_Error
	 */
	public static function layout_plan( array $tokens, array $digest, array $slots, string $page_title ) {
		$archetypes = isset( $digest['archetypes'] ) && is_array( $digest['archetypes'] ) ? $digest['archetypes'] : array();
		if ( $archetypes === array() ) {
			return new WP_Error( 'neo-pulse_novamira_plan', __( 'Design RAG has no section archetypes.', 'neo-pulse-wp' ) );
		}

		$system = implode(
			"\n",
			array(
				'You map SEO content slots to page section archetypes for Elementor.',
				'Output JSON only: {"sections":[{"archetype":"...","slot_indexes":[0,1]}]}',
				'Rules:',
				'- Every slot index 0..' . ( count( $slots ) - 1 ) . ' must appear exactly once across all sections.',
				'- archetype must be one of: ' . implode( ', ', $archetypes ) . '.',
				'- Prefer hero for the first title/cta slots when hero is available.',
				'- Group related slots in content_band or faq_pair sections.',
				'- Do not output page copy or Elementor JSON.',
			)
		);

		$notes = isset( $digest['layout_notes'] ) && is_array( $digest['layout_notes'] ) ? implode( ' ', $digest['layout_notes'] ) : '';
		$user   = "Page title: {$page_title}\n";
		$user  .= "Layout notes: {$notes}\n";
		$user  .= "Available widget types on site: " . implode( ', ', (array) ( $digest['widget_types'] ?? array() ) ) . "\n\n";
		$user  .= "Slots:\n";
		foreach ( $slots as $i => $slot ) {
			if ( ! is_array( $slot ) ) {
				continue;
			}
			$type = (string) ( $slot['type'] ?? '' );
			$preview = self::slot_preview( $slot );
			$user .= "{$i}. type={$type} preview=" . substr( $preview, 0, 200 ) . "\n";
		}
		$user .= "\nNovamira design summary:\n" . self::token_summary( $tokens );

		$raw = Neo_Pulse_Wp_Backend_Assist_Ai::call_openrouter(
			Neo_Pulse_Wp_Backend_Assist_Context::FAST_MODEL,
			$system,
			$user,
			2048,
			0.2,
			array( 'response_format' => array( 'type' => 'json_object' ) )
		);
		if ( is_wp_error( $raw ) ) {
			return $raw;
		}

		$parsed = Neo_Pulse_Wp_Backend_Assist_Ai::parse_json_response( (string) $raw );
		if ( ! is_array( $parsed ) ) {
			return new WP_Error( 'neo-pulse_novamira_plan', __( 'Layout plan did not return JSON.', 'neo-pulse-wp' ) );
		}

		return self::validate_plan( $parsed, $archetypes, count( $slots ) );
	}

	/**
	 * Map slots to section archetypes from RAG (server-side, no OpenRouter).
	 *
	 * @param array<string,mixed>            $digest
	 * @param array<int,array<string,mixed>> $slots
	 * @return array<string,mixed>|WP_Error
	 */
	public static function deterministic_layout_plan( array $digest, array $slots, array $block_spans = array() ) {
		$archetypes = isset( $digest['archetypes'] ) && is_array( $digest['archetypes'] ) ? $digest['archetypes'] : array();
		if ( $archetypes === array() ) {
			return new WP_Error( 'neo-pulse_novamira_plan', __( 'Design RAG has no section archetypes.', 'neo-pulse-wp' ) );
		}

		if ( ! in_array( 'content_band', $archetypes, true ) ) {
			$archetypes[] = 'content_band';
		}

		$template_sequence = isset( $digest['section_template_sequence'] ) && is_array( $digest['section_template_sequence'] ) ? $digest['section_template_sequence'] : array();
		$sections          = array();

		if ( $block_spans !== array() ) {
			if ( $template_sequence === array() ) {
				return new WP_Error(
					'neo-pulse_novamira_plan',
					__( 'Design RAG has no section templates from published pages for SEO blocks.', 'neo-pulse-wp' )
				);
			}
			$template_count = count( $template_sequence );
			foreach ( $block_spans as $block_index => $span ) {
				if ( ! is_array( $span ) ) {
					continue;
				}
				$indexes = isset( $span['slot_indexes'] ) && is_array( $span['slot_indexes'] ) ? $span['slot_indexes'] : array();
				if ( $indexes === array() ) {
					continue;
				}
				$template_index = (int) $block_index % $template_count;
				$template       = $template_sequence[ $template_index ];
				if ( ! is_array( $template ) ) {
					continue;
				}
				$arch = sanitize_key( (string) ( $template['archetype'] ?? 'content_band' ) );
				if ( ! in_array( $arch, $archetypes, true ) ) {
					$arch = 'content_band';
				}
				$sections[] = array(
					'archetype'       => $arch,
					'template_index'  => $template_index,
					'slot_indexes'    => $indexes,
					'label'           => trim( (string) ( $span['label'] ?? '' ) ),
				);
			}
		} else {
			$segments = self::slot_segments_by_h2( $slots );
			if ( $segments === array() ) {
				return new WP_Error( 'neo-pulse_novamira_plan', __( 'SEO slots have no H2 sections to plan.', 'neo-pulse-wp' ) );
			}
			if ( $template_sequence === array() ) {
				return new WP_Error(
					'neo-pulse_novamira_plan',
					__( 'Design RAG has no section templates from published pages.', 'neo-pulse-wp' )
				);
			}
			$template_count = count( $template_sequence );
			foreach ( $segments as $segment_index => $segment ) {
				$indexes = $segment['indexes'];
				if ( $indexes === array() ) {
					continue;
				}
				$template_index = (int) $segment_index % $template_count;
				$template       = $template_sequence[ $template_index ];
				$arch           = is_array( $template ) ? sanitize_key( (string) ( $template['archetype'] ?? 'content_band' ) ) : 'content_band';
				if ( ! in_array( $arch, $archetypes, true ) ) {
					$arch = 'content_band';
				}
				$sections[] = array(
					'archetype'      => $arch,
					'template_index' => $template_index,
					'slot_indexes'   => $indexes,
					'label'          => (string) $segment['label'],
				);
			}
		}

		if ( $sections === array() ) {
			return new WP_Error( 'neo-pulse_novamira_plan', __( 'Section plan is empty.', 'neo-pulse-wp' ) );
		}

		return self::validate_plan( array( 'sections' => $sections ), $archetypes, count( $slots ) );
	}

	/**
	 * One plan section per H2 block (H2 plus following slots until the next H2).
	 *
	 * @param array<int,array<string,mixed>> $slots
	 * @return array<int,array{label:string,indexes:array<int,int>}>
	 */
	public static function slot_segments_by_h2( array $slots ): array {
		$segments = array();
		$current  = array(
			'label'   => '',
			'indexes' => array(),
		);

		foreach ( $slots as $i => $slot ) {
			if ( ! is_array( $slot ) ) {
				continue;
			}
			$type = sanitize_key( (string) ( $slot['type'] ?? '' ) );
			if ( $type === 'h2' ) {
				if ( $current['indexes'] !== array() ) {
					$segments[] = $current;
				}
				$current = array(
					'label'   => trim( (string) ( $slot['text'] ?? '' ) ),
					'indexes' => array( $i ),
				);
				continue;
			}
			if ( $current['indexes'] === array() ) {
				$current['label']   = __( 'Introduction', 'neo-pulse-wp' );
				$current['indexes'] = array( $i );
			} else {
				$current['indexes'][] = $i;
			}
		}

		if ( $current['indexes'] !== array() ) {
			$segments[] = $current;
		}

		return $segments;
	}

	/**
	 * @param array<string,mixed>            $plan
	 * @param array<string,mixed>            $digest
	 * @param array<int,array<string,mixed>> $slots
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	public static function materialize( array $plan, array $digest, array $slots, string $page_title, array $tokens ) {
		$sections_plan = isset( $plan['sections'] ) && is_array( $plan['sections'] ) ? $plan['sections'] : array();
		if ( $sections_plan === array() ) {
			return new WP_Error( 'neo-pulse_novamira_compose', __( 'Layout plan has no sections.', 'neo-pulse-wp' ) );
		}

		$blueprints = isset( $digest['section_blueprints'] ) && is_array( $digest['section_blueprints'] ) ? $digest['section_blueprints'] : array();
		$exemplars  = isset( $digest['widget_exemplars'] ) && is_array( $digest['widget_exemplars'] ) ? $digest['widget_exemplars'] : array();
		$sequence   = isset( $digest['section_template_sequence'] ) && is_array( $digest['section_template_sequence'] ) ? $digest['section_template_sequence'] : array();

		$elements = array();
		$slot_used = array();

		foreach ( $sections_plan as $section_plan ) {
			if ( ! is_array( $section_plan ) ) {
				continue;
			}
			$archetype = sanitize_key( (string) ( $section_plan['archetype'] ?? '' ) );
			$indexes   = isset( $section_plan['slot_indexes'] ) && is_array( $section_plan['slot_indexes'] ) ? $section_plan['slot_indexes'] : array();
			$blueprint = self::resolve_section_blueprint( $section_plan, $sequence, $blueprints );
			if ( ! is_array( $blueprint ) ) {
				return new WP_Error(
					'neo-pulse_novamira_compose',
					sprintf(
						/* translators: %s: archetype name */
						__( 'No section blueprint for archetype %s.', 'neo-pulse-wp' ),
						$archetype
					)
				);
			}

			$section_slots = array();
			foreach ( $indexes as $idx ) {
				$i = absint( $idx );
				if ( ! isset( $slots[ $i ] ) || ! is_array( $slots[ $i ] ) ) {
					return new WP_Error( 'neo-pulse_novamira_compose', __( 'Layout plan references an unknown slot index.', 'neo-pulse-wp' ) );
				}
				$slot_used[ $i ] = true;
				$section_slots[] = $slots[ $i ];
			}

			$slot_driven = ! empty( $section_plan['slot_driven'] );
			if ( $slot_driven && $section_slots !== array() ) {
				$built = self::build_slot_driven_section( $blueprint, $section_slots, $exemplars, $tokens );
			} else {
				$is_hero = $archetype === 'hero';
				$built   = self::build_section( $blueprint, $section_slots, $page_title, $exemplars, $tokens, $is_hero );
			}
			if ( is_wp_error( $built ) ) {
				return $built;
			}
			$elements[] = $built;
		}

		if ( count( $slot_used ) !== count( $slots ) ) {
			return new WP_Error( 'neo-pulse_novamira_compose', __( 'Layout plan did not assign every SEO slot.', 'neo-pulse-wp' ) );
		}

		if ( $elements === array() ) {
			return new WP_Error( 'neo-pulse_novamira_compose', __( 'Materialize produced no Elementor sections.', 'neo-pulse-wp' ) );
		}

		return $elements;
	}

	/**
	 * @param array<string,mixed> $parsed
	 * @return array<string,mixed>|WP_Error
	 */
	public static function validate_plan( array $parsed, array $allowed_archetypes, int $slot_count ) {
		if ( empty( $parsed['sections'] ) || ! is_array( $parsed['sections'] ) ) {
			return new WP_Error( 'neo-pulse_novamira_plan', __( 'Layout plan missing sections array.', 'neo-pulse-wp' ) );
		}

		$seen = array();
		$out  = array( 'sections' => array() );

		foreach ( $parsed['sections'] as $section ) {
			if ( ! is_array( $section ) ) {
				return new WP_Error( 'neo-pulse_novamira_plan', __( 'Invalid section entry in layout plan.', 'neo-pulse-wp' ) );
			}
			$archetype = sanitize_key( (string) ( $section['archetype'] ?? '' ) );
			if ( ! in_array( $archetype, $allowed_archetypes, true ) ) {
				return new WP_Error(
					'neo-pulse_novamira_plan',
					sprintf(
						/* translators: %s: archetype */
						__( 'Layout plan used disallowed archetype %s.', 'neo-pulse-wp' ),
						$archetype
					)
				);
			}
			$indexes = isset( $section['slot_indexes'] ) && is_array( $section['slot_indexes'] ) ? $section['slot_indexes'] : array();
			$clean   = array();
			foreach ( $indexes as $idx ) {
				$i = absint( $idx );
				if ( $i >= $slot_count ) {
					return new WP_Error( 'neo-pulse_novamira_plan', __( 'Layout plan slot index out of range.', 'neo-pulse-wp' ) );
				}
				if ( isset( $seen[ $i ] ) ) {
					return new WP_Error( 'neo-pulse_novamira_plan', __( 'Layout plan assigned a slot more than once.', 'neo-pulse-wp' ) );
				}
				$seen[ $i ] = true;
				$clean[]    = $i;
			}
			$entry = array(
				'archetype'    => $archetype,
				'slot_indexes' => $clean,
			);
			if ( ! empty( $section['label'] ) && is_string( $section['label'] ) ) {
				$entry['label'] = trim( $section['label'] );
			}
			if ( isset( $section['template_index'] ) ) {
				$entry['template_index'] = absint( $section['template_index'] );
			}
			if ( ! empty( $section['slot_driven'] ) ) {
				$entry['slot_driven'] = true;
			}
			$out['sections'][] = $entry;
		}

		if ( count( $seen ) !== $slot_count ) {
			return new WP_Error( 'neo-pulse_novamira_plan', __( 'Layout plan did not cover every slot.', 'neo-pulse-wp' ) );
		}

		return $out;
	}

	/**
	 * @param array<string,mixed>            $blueprint
	 * @param array<int,array<string,mixed>> $section_slots
	 * @param array<string,array<string,mixed>> $exemplars
	 * @return array<string,mixed>|WP_Error
	 */
	/**
	 * Build one Elementor section from SEO slots only (no blueprint chrome widgets).
	 *
	 * @param array<string,mixed>            $blueprint
	 * @param array<int,array<string,mixed>> $section_slots
	 * @param array<string,array<string,mixed>> $exemplars
	 * @return array<string,mixed>|WP_Error
	 */
	public static function build_slot_driven_section( array $blueprint, array $section_slots, array $exemplars, array $tokens ) {
		$section_settings = isset( $blueprint['section_settings'] ) && is_array( $blueprint['section_settings'] ) ? $blueprint['section_settings'] : array();
		$section_settings = self::apply_tokens_to_settings( $section_settings, $tokens );

		$widgets = array();
		foreach ( $section_slots as $slot ) {
			if ( ! is_array( $slot ) ) {
				continue;
			}
			$type     = self::slot_widget_type( $slot, $exemplars );
			$settings = isset( $exemplars[ $type ] ) && is_array( $exemplars[ $type ] ) ? $exemplars[ $type ] : array();
			$settings = self::apply_tokens_to_settings( $settings, $tokens );
			$settings = self::apply_slot_to_settings( $type, $settings, $slot, '' );
			$widgets[] = self::make_widget( $type, $settings );
		}

		if ( $widgets === array() ) {
			return new WP_Error( 'neo-pulse_novamira_compose', __( 'Slot-driven section has no widgets.', 'neo-pulse-wp' ) );
		}

		return self::wrap_section_columns( $section_settings, array( 100 ), $widgets );
	}

	/**
	 * @param array<string,mixed>            $section_plan
	 * @param array<int,array<string,mixed>> $sequence
	 * @param array<string,array<string,mixed>> $blueprints
	 * @return array<string,mixed>|null
	 */
	public static function resolve_section_blueprint( array $section_plan, array $sequence, array $blueprints ): ?array {
		if ( isset( $section_plan['template_index'] ) && $sequence !== array() ) {
			$idx = absint( $section_plan['template_index'] );
			if ( isset( $sequence[ $idx ] ) && is_array( $sequence[ $idx ] ) ) {
				return Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag::normalize_blueprint( $sequence[ $idx ] );
			}
		}
		$archetype = sanitize_key( (string) ( $section_plan['archetype'] ?? '' ) );
		$fallback  = $blueprints[ $archetype ] ?? $blueprints['content_band'] ?? null;
		if ( ! is_array( $fallback ) ) {
			return null;
		}
		return Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag::normalize_blueprint( $fallback );
	}

	public static function build_section( array $blueprint, array $section_slots, string $page_title, array $exemplars, array $tokens, bool $is_hero ) {
		$blueprint        = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag::normalize_blueprint( $blueprint );
		$section_settings = isset( $blueprint['section_settings'] ) && is_array( $blueprint['section_settings'] ) ? $blueprint['section_settings'] : array();
		$section_settings = self::apply_tokens_to_settings( $section_settings, $tokens );

		$columns_sz         = isset( $blueprint['columns'] ) && is_array( $blueprint['columns'] ) ? $blueprint['columns'] : array( 100 );
		$widgets_by_column  = isset( $blueprint['widgets_by_column'] ) && is_array( $blueprint['widgets_by_column'] ) ? $blueprint['widgets_by_column'] : array();
		$slot_queue         = $section_slots;
		$has_h2             = self::section_slots_have_h2( $section_slots );
		$use_page_title     = $is_hero && $page_title !== '' && ! $has_h2;

		$column_elements = array();
		foreach ( $widgets_by_column as $col_tpls ) {
			if ( ! is_array( $col_tpls ) ) {
				continue;
			}
			$filled = self::fill_widget_templates(
				$col_tpls,
				$slot_queue,
				$section_slots,
				$exemplars,
				$tokens,
				$page_title,
				$use_page_title
			);
			if ( is_wp_error( $filled ) ) {
				return $filled;
			}
			$column_elements[] = $filled;
		}

		while ( $slot_queue !== array() ) {
			$slot = array_shift( $slot_queue );
			if ( ! is_array( $slot ) ) {
				continue;
			}
			$type     = self::slot_widget_type( $slot, $exemplars );
			$settings = isset( $exemplars[ $type ] ) && is_array( $exemplars[ $type ] ) ? $exemplars[ $type ] : array();
			$settings = self::apply_slot_to_settings( $type, $settings, $slot, $page_title );
			if ( $column_elements === array() ) {
				$column_elements[] = array();
			}
			$last = count( $column_elements ) - 1;
			$column_elements[ $last ][] = self::make_widget( $type, $settings );
		}

		if ( $column_elements === array() ) {
			return new WP_Error( 'neo-pulse_novamira_compose', __( 'Section blueprint produced no widgets.', 'neo-pulse-wp' ) );
		}

		return self::wrap_section_columns_prefilled( $section_settings, $columns_sz, $column_elements );
	}

	/**
	 * @param array<int,array<string,mixed>> $widgets_tpl
	 * @param array<int,array<string,mixed>> $slot_queue
	 * @param array<int,array<string,mixed>> $section_slots
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	private static function fill_widget_templates(
		array $widgets_tpl,
		array &$slot_queue,
		array $section_slots,
		array $exemplars,
		array $tokens,
		string $page_title,
		bool $use_page_title
	) {
		$fill_roles = array( 'title', 'body', 'cta', 'list' );
		$widgets    = array();
		$page_title_used = false;

		foreach ( $widgets_tpl as $tpl ) {
			if ( ! is_array( $tpl ) ) {
				continue;
			}
			$role        = (string) ( $tpl['role'] ?? 'body' );
			$widget_type = (string) ( $tpl['widgetType'] ?? 'text-editor' );
			$settings    = isset( $tpl['settings'] ) && is_array( $tpl['settings'] ) ? $tpl['settings'] : array();
			if ( $settings === array() && isset( $exemplars[ $widget_type ] ) ) {
				$settings = $exemplars[ $widget_type ];
			}
			$settings = self::apply_tokens_to_settings( $settings, $tokens );

			if ( $role === 'chrome' ) {
				$widgets[] = self::make_widget( $widget_type, $settings );
				continue;
			}

			if ( $role === 'title' && $use_page_title && ! $page_title_used && $slot_queue === array() ) {
				$settings = self::apply_heading_text( $widget_type, $settings, $page_title );
				$page_title_used = true;
				$widgets[] = self::make_widget( $widget_type, $settings );
				continue;
			}

			if ( ! in_array( $role, $fill_roles, true ) || $slot_queue === array() ) {
				if ( in_array( $role, array( 'title', 'body' ), true ) ) {
					continue;
				}
				$widgets[] = self::make_widget( $widget_type, $settings );
				continue;
			}

			$slot = array_shift( $slot_queue );
			while ( $slot !== null && ! self::slot_matches_role( $slot, $role ) && $slot_queue !== array() ) {
				array_push( $slot_queue, $slot );
				$slot = array_shift( $slot_queue );
				if ( count( $slot_queue ) > count( $section_slots ) * 2 ) {
					break;
				}
			}
			if ( $slot === null || ! is_array( $slot ) ) {
				continue;
			}
			if ( ! self::slot_matches_role( $slot, $role ) && $role === 'body' ) {
				// Accept any non-cta slot as body when role is body.
			} elseif ( ! self::slot_matches_role( $slot, $role ) ) {
				array_unshift( $slot_queue, $slot );
				continue;
			}

			$settings = self::apply_slot_to_settings( $widget_type, $settings, $slot, $page_title );
			$widgets[] = self::make_widget( $widget_type, $settings );
		}

		return $widgets;
	}

	/**
	 * @param array<int,array<string,mixed>> $section_slots
	 */
	private static function section_slots_have_h2( array $section_slots ): bool {
		foreach ( $section_slots as $slot ) {
			if ( ! is_array( $slot ) ) {
				continue;
			}
			if ( sanitize_key( (string) ( $slot['type'] ?? '' ) ) === 'h2' ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<int,array<int,array<string,mixed>>> $column_widgets
	 * @return array<string,mixed>
	 */
	private static function wrap_section_columns_prefilled( array $section_settings, array $column_sizes, array $column_widgets ): array {
		$columns = array();
		$count   = max( 1, count( $column_sizes ), count( $column_widgets ) );

		for ( $c = 0; $c < $count; $c++ ) {
			$size    = absint( $column_sizes[ $c ] ?? ( $c === 0 ? 100 : 0 ) );
			$widgets = isset( $column_widgets[ $c ] ) && is_array( $column_widgets[ $c ] ) ? $column_widgets[ $c ] : array();
			if ( $size <= 0 && $widgets === array() ) {
				continue;
			}
			$columns[] = array(
				'id'       => self::element_id(),
				'elType'   => 'column',
				'isInner'  => false,
				'settings' => array( '_column_size' => $size > 0 ? $size : 100 ),
				'elements' => $widgets,
			);
		}

		if ( $columns === array() ) {
			$columns[] = array(
				'id'       => self::element_id(),
				'elType'   => 'column',
				'isInner'  => false,
				'settings' => array( '_column_size' => 100 ),
				'elements' => array(),
			);
		}

		return array(
			'id'       => self::element_id(),
			'elType'   => 'section',
			'isInner'  => false,
			'settings' => $section_settings,
			'elements' => $columns,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $widgets
	 * @return array<string,mixed>
	 */
	private static function wrap_section_columns( array $section_settings, array $column_sizes, array $widgets ): array {
		$columns = array();
		$count   = max( 1, count( $column_sizes ) );
		$per_col = (int) ceil( count( $widgets ) / $count );
		$offset  = 0;

		for ( $c = 0; $c < $count; $c++ ) {
			$size = absint( $column_sizes[ $c ] ?? 100 );
			$slice = array_slice( $widgets, $offset, $per_col );
			$offset += $per_col;
			if ( $slice === array() && $c === 0 ) {
				$slice = $widgets;
			}
			$columns[] = array(
				'id'       => self::element_id(),
				'elType'   => 'column',
				'isInner'  => false,
				'settings' => array( '_column_size' => $size > 0 ? $size : 100 ),
				'elements' => $slice,
			);
		}

		return array(
			'id'       => self::element_id(),
			'elType'   => 'section',
			'isInner'  => false,
			'settings' => $section_settings,
			'elements' => $columns,
		);
	}

	/**
	 * @param array<string,mixed> $settings
	 * @return array<string,mixed>
	 */
	private static function make_widget( string $widget_type, array $settings ): array {
		return array(
			'id'         => self::element_id(),
			'elType'     => 'widget',
			'widgetType' => $widget_type,
			'settings'   => $settings,
			'elements'   => array(),
		);
	}

	/**
	 * @param array<string,mixed> $slot
	 */
	private static function slot_matches_role( array $slot, string $role ): bool {
		$type = sanitize_key( (string) ( $slot['type'] ?? '' ) );
		if ( $role === 'title' ) {
			return $type === 'h2';
		}
		if ( $role === 'cta' ) {
			return $type === 'cta';
		}
		if ( $role === 'list' ) {
			return $type === 'list';
		}
		return in_array( $type, array( 'paragraph', 'list' ), true );
	}

	/**
	 * @param array<string,mixed> $slot
	 * @param array<string,array<string,mixed>> $exemplars
	 */
	private static function slot_widget_type( array $slot, array $exemplars ): string {
		$type = sanitize_key( (string) ( $slot['type'] ?? '' ) );
		if ( $type === 'h2' ) {
			return isset( $exemplars['ygency-section-title'] ) ? 'ygency-section-title' : 'heading';
		}
		if ( $type === 'cta' ) {
			return isset( $exemplars['ygency-button'] ) ? 'ygency-button' : 'button';
		}
		return 'text-editor';
	}

	/**
	 * @param array<string,mixed> $slot
	 * @return array<string,mixed>
	 */
	private static function apply_slot_to_settings( string $widget_type, array $settings, array $slot, string $page_title ): array {
		unset( $page_title );
		$type = sanitize_key( (string) ( $slot['type'] ?? '' ) );

		if ( $type === 'h2' ) {
			$text = trim( (string) ( $slot['text'] ?? '' ) );
			$settings = self::strip_copy_from_widget_settings( $settings );
			if ( str_contains( $widget_type, 'section-title' ) ) {
				$settings['title'] = $text;
				$settings['sub_title'] = '';
				$settings['subtitle'] = '';
				$settings['section_subtitle'] = '';
			} else {
				$level = absint( $slot['heading_level'] ?? 2 );
				$settings['title']       = $text;
				$settings['header_size'] = 'h' . ( ( $level >= 1 && $level <= 6 ) ? $level : 2 );
			}
			return $settings;
		}

		if ( $type === 'paragraph' || $type === 'list' ) {
			$html = trim( (string) ( $slot['html'] ?? '' ) );
			if ( $html === '' && $type === 'list' && ! empty( $slot['items'] ) && is_array( $slot['items'] ) ) {
				$items = array();
				foreach ( $slot['items'] as $item ) {
					$items[] = '<li>' . esc_html( (string) $item ) . '</li>';
				}
				$html = '<ul>' . implode( '', $items ) . '</ul>';
			}
			$settings['editor'] = $html;
			return $settings;
		}

		if ( $type === 'cta' ) {
			$label = trim( (string) ( $slot['label'] ?? '' ) );
			if ( str_contains( $widget_type, 'ygency' ) || str_contains( $widget_type, 'button' ) ) {
				$settings['text']    = $label;
				$settings['btn_text'] = $label;
			}
			$settings['link'] = array(
				'url' => (string) ( $slot['url'] ?? home_url( '/' ) ),
			);
			return $settings;
		}

		return $settings;
	}

	/**
	 * @param array<string,mixed> $settings
	 */
	private static function strip_copy_from_widget_settings( array $settings ): array {
		if ( ! class_exists( 'Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag', false ) ) {
			return $settings;
		}
		$keys = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag::COPY_SETTING_KEYS;
		foreach ( $keys as $key ) {
			if ( array_key_exists( $key, $settings ) ) {
				unset( $settings[ $key ] );
			}
		}
		return $settings;
	}

	private static function apply_heading_text( string $widget_type, array $settings, string $text ): array {
		if ( str_contains( $widget_type, 'section-title' ) ) {
			$settings['title'] = $text;
		} else {
			$settings['title']       = $text;
			$settings['header_size'] = 'h1';
		}
		return $settings;
	}

	/**
	 * @param array<string,mixed> $settings
	 * @param array<string,mixed> $tokens
	 * @return array<string,mixed>
	 */
	private static function apply_tokens_to_settings( array $settings, array $tokens ): array {
		$design = isset( $tokens['design'] ) && is_array( $tokens['design'] ) ? $tokens['design'] : array();
		$tok    = isset( $design['tokens'] ) && is_array( $design['tokens'] ) ? $design['tokens'] : array();
		if ( $tok === array() ) {
			return $settings;
		}
		foreach ( $settings as $key => $value ) {
			if ( ! is_string( $key ) || ! str_contains( $key, 'color' ) ) {
				continue;
			}
			if ( isset( $tok['accent'] ) && str_contains( $key, 'accent' ) ) {
				$settings[ $key ] = (string) $tok['accent'];
			}
		}
		return $settings;
	}

	/**
	 * @param array<string,mixed> $slot
	 */
	private static function slot_preview( array $slot ): string {
		$type = (string) ( $slot['type'] ?? '' );
		if ( $type === 'h2' ) {
			return wp_strip_all_tags( (string) ( $slot['text'] ?? '' ) );
		}
		if ( $type === 'cta' ) {
			return (string) ( $slot['label'] ?? '' );
		}
		return wp_strip_all_tags( (string) ( $slot['html'] ?? $slot['text'] ?? '' ) );
	}

	/**
	 * @param array<string,mixed> $tokens
	 */
	private static function token_summary( array $tokens ): string {
		$design = isset( $tokens['design'] ) && is_array( $tokens['design'] ) ? $tokens['design'] : array();
		$name   = (string) ( $design['name'] ?? $design['design']['name'] ?? '' );
		$lines  = array();
		if ( $name !== '' ) {
			$lines[] = 'Active design: ' . $name;
		}
		if ( ! empty( $design['guidance'] ) && is_string( $design['guidance'] ) ) {
			$lines[] = substr( $design['guidance'], 0, 500 );
		}
		return $lines !== array() ? implode( "\n", $lines ) : 'Novamira design active.';
	}

	private static function element_id(): string {
		if ( class_exists( 'Neo_Pulse_Wp_Seo_Blocks_Library', false ) ) {
			return Neo_Pulse_Wp_Seo_Blocks_Library::generate_element_id();
		}
		return substr( md5( uniqid( (string) wp_rand(), true ) ), 0, 7 );
	}
}
