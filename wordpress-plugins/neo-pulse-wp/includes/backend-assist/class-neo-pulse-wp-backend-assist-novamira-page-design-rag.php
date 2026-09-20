<?php
/**
 * Site Elementor design RAG for Novamira page compose (no hardcoded reference pages).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag {

	const MAX_SOURCE_PAGES = 4;

	const MAX_SECTION_TEMPLATES = 8;

	const COPY_SETTING_KEYS = array(
		'title',
		'editor',
		'text',
		'description',
		'subtitle',
		'sub_title',
		'section_subtitle',
		'section_title',
		'sec_title',
		'btn_text',
		'button_text',
		'html',
		'content',
		'caption',
		'inner_text',
		'prefix',
		'suffix',
		'marquee_text',
		'items',
		'icon_list',
		'testimonial_content',
		'name',
		'job',
		'link',
	);

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function build( int $exclude_post_id ) {
		$cache_key = 'neo_pulse_nv_design_rag_v3';
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) && $cached !== array() ) {
			return $cached;
		}

		$candidates = self::discover_candidates( $exclude_post_id );
		if ( $candidates === array() ) {
			return new WP_Error(
				'neo-pulse_novamira_rag',
				__( 'No published Elementor pages on this site to learn design from.', 'neo-pulse-wp' )
			);
		}

		$ranked = self::rank_candidates( $candidates );
		$pages  = array();
		foreach ( array_slice( $ranked, 0, self::MAX_SOURCE_PAGES ) as $row ) {
			$elements = self::decode_elementor( (int) $row['post_id'] );
			if ( $elements === array() ) {
				continue;
			}
			$pages[] = array(
				'post_id'  => (int) $row['post_id'],
				'title'    => (string) $row['title'],
				'elements' => $elements,
				'score'    => (int) $row['score'],
			);
		}

		if ( $pages === array() ) {
			return new WP_Error(
				'neo-pulse_novamira_rag',
				__( 'Published Elementor pages had no usable layout data.', 'neo-pulse-wp' )
			);
		}

		$digest = self::merge_pages( $pages );
		if ( $digest === array() ) {
			return new WP_Error(
				'neo-pulse_novamira_rag',
				__( 'Site design RAG digest is empty.', 'neo-pulse-wp' )
			);
		}

		set_transient( $cache_key, $digest, HOUR_IN_SECONDS );

		return $digest;
	}

	/**
	 * @return array<int,array{post_id:int,title:string,score:int}>
	 */
	public static function discover_candidates( int $exclude_post_id ): array {
		$query = new WP_Query(
			array(
				'post_type'              => 'page',
				'post_status'            => 'publish',
				'posts_per_page'         => 30,
				'post__not_in'           => $exclude_post_id > 0 ? array( $exclude_post_id ) : array(),
				'orderby'                => 'modified',
				'order'                  => 'DESC',
				'no_found_rows'          => true,
				'update_post_meta_cache' => true,
				'meta_query'             => array(
					'relation' => 'OR',
					array(
						'key'   => '_elementor_edit_mode',
						'value' => 'builder',
					),
					array(
						'key'     => '_elementor_data',
						'compare' => 'EXISTS',
					),
				),
			)
		);

		$out = array();
		foreach ( $query->posts as $post ) {
			if ( ! $post instanceof WP_Post ) {
				continue;
			}
			$raw = get_post_meta( $post->ID, '_elementor_data', true );
			if ( ! is_string( $raw ) || trim( $raw ) === '' || trim( $raw ) === '[]' ) {
				continue;
			}
			$out[] = array(
				'post_id' => (int) $post->ID,
				'title'   => get_the_title( $post ),
			);
		}
		wp_reset_postdata();
		return $out;
	}

	/**
	 * @param array<int,array{post_id:int,title:string}> $candidates
	 * @return array<int,array{post_id:int,title:string,score:int}>
	 */
	public static function rank_candidates( array $candidates ): array {
		$scored = array();
		foreach ( $candidates as $row ) {
			$post_id = (int) $row['post_id'];
			$raw     = get_post_meta( $post_id, '_elementor_data', true );
			$score   = is_string( $raw ) ? strlen( $raw ) : 0;
			if ( $score < 100 ) {
				continue;
			}
			$scored[] = array(
				'post_id' => $post_id,
				'title'   => (string) $row['title'],
				'score'   => $score,
			);
		}
		usort(
			$scored,
			static function ( $a, $b ) {
				return ( $b['score'] ?? 0 ) <=> ( $a['score'] ?? 0 );
			}
		);
		return $scored;
	}

	/**
	 * @param array<int,array<string,mixed>> $pages
	 * @return array<string,mixed>
	 */
	public static function merge_pages( array $pages ): array {
		$widget_exemplars   = array();
		$section_blueprints = array();
		$archetypes         = array();
		$widget_type_counts = array();
		$layout_notes       = array();

		foreach ( $pages as $page ) {
			$elements = isset( $page['elements'] ) && is_array( $page['elements'] ) ? $page['elements'] : array();
			self::collect_widget_exemplars( $elements, $widget_exemplars, $widget_type_counts );

			foreach ( $elements as $block ) {
				if ( ! is_array( $block ) ) {
					continue;
				}
				$el_type = (string) ( $block['elType'] ?? '' );
				if ( $el_type === 'section' ) {
					$blueprint = self::section_to_blueprint( $block );
				} elseif ( $el_type === 'container' ) {
					$blueprint = self::container_to_blueprint( $block );
				} else {
					continue;
				}
				if ( $blueprint === null ) {
					continue;
				}
				self::register_blueprint( $blueprint, $section_blueprints, $archetypes, $widget_exemplars, $widget_type_counts );
			}
		}

		if ( $widget_exemplars === array() ) {
			return array();
		}

		self::synthesize_blueprints( $widget_exemplars, $section_blueprints, $archetypes );

		if ( ! isset( $section_blueprints['content_band'] ) ) {
			$section_blueprints['content_band'] = self::default_content_blueprint( $widget_exemplars );
			$archetypes['content_band']         = true;
		}

		$types = array_keys( $widget_type_counts );
		sort( $types );
		if ( in_array( 'ygency-section-title', $types, true ) || in_array( 'qi_addons_for_elementor_text_marquee', $types, true ) ) {
			$layout_notes[] = 'Site uses theme marketing widgets (Ygency/Qi). Prefer those widget types over generic heading/text-editor when building sections.';
		}
		if ( isset( $section_blueprints['hero'] ) ) {
			$layout_notes[] = 'Open with a hero section (title + visual + CTA) when slots allow.';
		}

		$source_ids = array();
		foreach ( $pages as $page ) {
			$source_ids[] = (int) ( $page['post_id'] ?? 0 );
		}

		return array(
			'source_page_ids'    => array_values( array_filter( $source_ids ) ),
			'archetypes'         => array_keys( $archetypes ),
			'widget_exemplars'   => $widget_exemplars,
			'section_blueprints' => $section_blueprints,
			'widget_types'       => $types,
			'layout_notes'       => $layout_notes,
		);
	}

	/**
	 * Ordered section templates from the top-ranked published Elementor page (cached separately).
	 *
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	public static function section_template_sequence( int $exclude_post_id ) {
		$cache_key = 'neo_pulse_nv_section_templates_v2';
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) && $cached !== array() ) {
			return $cached;
		}

		$candidates = self::discover_candidates( $exclude_post_id );
		if ( $candidates === array() ) {
			return new WP_Error(
				'neo-pulse_novamira_rag',
				__( 'No published Elementor pages on this site to learn design from.', 'neo-pulse-wp' )
			);
		}
		$ranked = self::rank_candidates( $candidates );
		if ( $ranked === array() ) {
			return new WP_Error(
				'neo-pulse_novamira_rag',
				__( 'Published Elementor pages had no usable layout data.', 'neo-pulse-wp' )
			);
		}

		$top_id     = (int) $ranked[0]['post_id'];
		$elements   = self::decode_elementor( $top_id );
		$sequence   = array();

		foreach ( $elements as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}
			$el_type = (string) ( $block['elType'] ?? '' );
			if ( $el_type === 'section' ) {
				$blueprint = self::section_to_blueprint( $block );
			} elseif ( $el_type === 'container' ) {
				$blueprint = self::container_to_blueprint( $block );
			} else {
				continue;
			}
			if ( $blueprint === null || ! self::blueprint_usable_for_seo_block( $blueprint ) ) {
				continue;
			}
			$sequence[] = self::trim_template_chrome( $blueprint );
			if ( count( $sequence ) >= self::MAX_SECTION_TEMPLATES ) {
				break;
			}
		}

		if ( $sequence === array() ) {
			return new WP_Error(
				'neo-pulse_novamira_rag',
				__( 'Top Elementor page had no usable section templates for SEO blocks.', 'neo-pulse-wp' )
			);
		}

		set_transient( $cache_key, $sequence, HOUR_IN_SECONDS );

		return $sequence;
	}

	/**
	 * @param array<string,mixed> $blueprint
	 */
	public static function blueprint_usable_for_seo_block( array $blueprint ): bool {
		$widgets = isset( $blueprint['widgets'] ) && is_array( $blueprint['widgets'] ) ? $blueprint['widgets'] : array();
		if ( $widgets === array() ) {
			return false;
		}
		$fill_roles = array( 'title', 'body', 'cta', 'list' );
		foreach ( $widgets as $widget ) {
			if ( ! is_array( $widget ) ) {
				continue;
			}
			$role = (string) ( $widget['role'] ?? '' );
			if ( in_array( $role, $fill_roles, true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<string,mixed> $blueprint
	 * @return array<string,mixed>
	 */
	public static function normalize_blueprint( array $blueprint ): array {
		if ( ! empty( $blueprint['widgets_by_column'] ) && is_array( $blueprint['widgets_by_column'] ) ) {
			return $blueprint;
		}
		$widgets = isset( $blueprint['widgets'] ) && is_array( $blueprint['widgets'] ) ? $blueprint['widgets'] : array();
		$columns = isset( $blueprint['columns'] ) && is_array( $blueprint['columns'] ) ? $blueprint['columns'] : array( 100 );
		$blueprint['widgets_by_column'] = array( $widgets );
		if ( count( $columns ) > 1 && count( $widgets ) > 1 ) {
			$count   = count( $columns );
			$per_col = (int) ceil( count( $widgets ) / $count );
			$offset  = 0;
			$by_col  = array();
			for ( $c = 0; $c < $count; $c++ ) {
				$slice = array_slice( $widgets, $offset, $per_col );
				$offset += $per_col;
				if ( $slice === array() && $c === 0 ) {
					$slice = $widgets;
				}
				$by_col[] = $slice;
			}
			$blueprint['widgets_by_column'] = $by_col;
		}
		return $blueprint;
	}

	/**
	 * Keep layout columns but drop extra decorative widgets so materialize stays fast.
	 *
	 * @param array<string,mixed> $blueprint
	 * @return array<string,mixed>
	 */
	public static function trim_template_chrome( array $blueprint ): array {
		$blueprint = self::normalize_blueprint( $blueprint );
		$by_col    = isset( $blueprint['widgets_by_column'] ) && is_array( $blueprint['widgets_by_column'] ) ? $blueprint['widgets_by_column'] : array();
		$chrome_kept = false;
		$trimmed     = array();
		foreach ( $by_col as $col_widgets ) {
			if ( ! is_array( $col_widgets ) ) {
				$trimmed[] = array();
				continue;
			}
			$next_col = array();
			foreach ( $col_widgets as $widget ) {
				if ( ! is_array( $widget ) ) {
					continue;
				}
				$role = (string) ( $widget['role'] ?? '' );
				if ( $role === 'chrome' ) {
					if ( $chrome_kept ) {
						continue;
					}
					$chrome_kept = true;
				}
				$next_col[] = $widget;
			}
			$trimmed[] = $next_col;
		}
		$blueprint['widgets_by_column'] = $trimmed;
		$flat = array();
		foreach ( $trimmed as $col_widgets ) {
			foreach ( $col_widgets as $widget ) {
				$flat[] = $widget;
			}
		}
		$blueprint['widgets'] = $flat;
		return $blueprint;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function decode_elementor( int $post_id ): array {
		$raw = get_post_meta( $post_id, '_elementor_data', true );
		$data = is_string( $raw ) ? json_decode( $raw, true ) : ( is_array( $raw ) ? $raw : array() );
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 */
	public static function score_elements( array $elements ): int {
		$types    = array();
		$sections = 0;
		self::walk_widget_types( $elements, $types, $sections );
		$score = count( $types ) * 10 + $sections * 3;
		foreach ( $types as $type ) {
			if ( str_contains( $type, 'ygency' ) || str_contains( $type, 'qi_addons' ) ) {
				$score += 15;
			}
		}
		return $score;
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @param array<string,true>             $types
	 */
	private static function walk_widget_types( array $elements, array &$types, int &$sections ): void {
		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( ( $element['elType'] ?? '' ) === 'section' || ( $element['elType'] ?? '' ) === 'container' ) {
				++$sections;
			}
			if ( ( $element['elType'] ?? '' ) === 'widget' ) {
				$type = (string) ( $element['widgetType'] ?? '' );
				if ( $type !== '' ) {
					$types[ $type ] = true;
				}
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::walk_widget_types( $element['elements'], $types, $sections );
			}
		}
	}

	/**
	 * @param array<string,mixed> $section
	 * @return array<string,mixed>|null
	 */
	public static function section_to_blueprint( array $section ): ?array {
		$columns             = array();
		$widgets             = array();
		$widgets_by_column   = array();
		$types               = array();

		if ( empty( $section['elements'] ) || ! is_array( $section['elements'] ) ) {
			return null;
		}

		foreach ( $section['elements'] as $col ) {
			if ( ! is_array( $col ) || ( $col['elType'] ?? '' ) !== 'column' ) {
				continue;
			}
			$size = absint( $col['settings']['_column_size'] ?? 100 );
			$columns[] = $size > 0 ? $size : 100;
			$col_widgets = array();
			if ( empty( $col['elements'] ) || ! is_array( $col['elements'] ) ) {
				$widgets_by_column[] = $col_widgets;
				continue;
			}
			foreach ( $col['elements'] as $widget ) {
				if ( ! is_array( $widget ) || ( $widget['elType'] ?? '' ) !== 'widget' ) {
					continue;
				}
				$widget_type = (string) ( $widget['widgetType'] ?? '' );
				if ( $widget_type === '' ) {
					continue;
				}
				$types[] = $widget_type;
				$tpl     = array(
					'widgetType' => $widget_type,
					'role'       => self::widget_role( $widget_type ),
					'settings'   => self::style_exemplar_from_settings(
						isset( $widget['settings'] ) && is_array( $widget['settings'] ) ? $widget['settings'] : array()
					),
				);
				$widgets[]       = $tpl;
				$col_widgets[]   = $tpl;
			}
			$widgets_by_column[] = $col_widgets;
		}

		if ( $widgets === array() ) {
			return null;
		}

		$archetype = self::infer_archetype( $types );
		$settings  = isset( $section['settings'] ) && is_array( $section['settings'] ) ? self::style_exemplar_from_settings( $section['settings'] ) : array();

		return array(
			'archetype'          => $archetype,
			'section_settings'   => $settings,
			'columns'            => $columns !== array() ? $columns : array( 100 ),
			'widgets'            => $widgets,
			'widgets_by_column'  => $widgets_by_column,
			'score'              => count( $types ) + ( str_contains( implode( ',', $types ), 'ygency' ) ? 5 : 0 ),
		);
	}

	/**
	 * @param array<int,string> $widget_types
	 */
	public static function infer_archetype( array $widget_types ): string {
		$joined = implode( ' ', $widget_types );
		if ( str_contains( $joined, 'text_marquee' ) || str_contains( $joined, 'marquee' ) ) {
			return 'marquee_band';
		}
		if ( str_contains( $joined, 'testimonial' ) ) {
			return 'testimonial';
		}
		if ( str_contains( $joined, 'feature-list' ) || str_contains( $joined, 'info-box' ) ) {
			return 'card_grid';
		}
		if ( in_array( 'image', $widget_types, true ) && ( in_array( 'ygency-section-title', $widget_types, true ) || in_array( 'heading', $widget_types, true ) ) ) {
			return 'hero';
		}
		if ( in_array( 'ygency-button', $widget_types, true ) || in_array( 'button', $widget_types, true ) ) {
			if ( in_array( 'ygency-section-title', $widget_types, true ) || in_array( 'heading', $widget_types, true ) ) {
				return 'hero';
			}
			return 'cta_band';
		}
		if ( in_array( 'heading', $widget_types, true ) && in_array( 'text-editor', $widget_types, true ) ) {
			return 'faq_pair';
		}
		return 'content_band';
	}

	/**
	 * @param array<string,mixed> $container
	 * @return array<string,mixed>|null
	 */
	public static function container_to_blueprint( array $container ): ?array {
		$widgets = array();
		$types   = array();
		self::collect_widgets_flat( isset( $container['elements'] ) && is_array( $container['elements'] ) ? $container['elements'] : array(), $widgets, $types );
		if ( $widgets === array() ) {
			return null;
		}
		$settings = isset( $container['settings'] ) && is_array( $container['settings'] ) ? self::style_exemplar_from_settings( $container['settings'] ) : array();
		return array(
			'archetype'          => self::infer_archetype( $types ),
			'section_settings'   => $settings,
			'columns'            => array( 100 ),
			'widgets'            => $widgets,
			'widgets_by_column'  => array( $widgets ),
			'score'              => count( $types ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @param array<int,array<string,mixed>> $widgets
	 * @param array<int,string>              $types
	 */
	private static function collect_widgets_flat( array $elements, array &$widgets, array &$types ): void {
		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( ( $element['elType'] ?? '' ) === 'widget' ) {
				$widget_type = (string) ( $element['widgetType'] ?? '' );
				if ( $widget_type === '' ) {
					continue;
				}
				$types[]   = $widget_type;
				$widgets[] = array(
					'widgetType' => $widget_type,
					'role'       => self::widget_role( $widget_type ),
					'settings'   => self::style_exemplar_from_settings(
						isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array()
					),
				);
				continue;
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::collect_widgets_flat( $element['elements'], $widgets, $types );
			}
		}
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @param array<string,array<string,mixed>> $exemplars
	 * @param array<string,int>                $counts
	 */
	private static function collect_widget_exemplars( array $elements, array &$exemplars, array &$counts ): void {
		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( ( $element['elType'] ?? '' ) === 'widget' ) {
				$type = (string) ( $element['widgetType'] ?? '' );
				if ( $type === '' ) {
					continue;
				}
				$counts[ $type ] = ( $counts[ $type ] ?? 0 ) + 1;
				if ( ! isset( $exemplars[ $type ] ) ) {
					$exemplars[ $type ] = self::style_exemplar_from_settings(
						isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array()
					);
				}
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::collect_widget_exemplars( $element['elements'], $exemplars, $counts );
			}
		}
	}

	/**
	 * @param array<string,mixed> $blueprint
	 * @param array<string,array<string,mixed>> $section_blueprints
	 * @param array<string,true>               $archetypes
	 * @param array<string,array<string,mixed>> $widget_exemplars
	 * @param array<string,int>                $widget_type_counts
	 */
	private static function register_blueprint( array $blueprint, array &$section_blueprints, array &$archetypes, array &$widget_exemplars, array &$widget_type_counts ): void {
		$arch = (string) $blueprint['archetype'];
		$archetypes[ $arch ] = true;
		if ( ! isset( $section_blueprints[ $arch ] ) || (int) ( $blueprint['score'] ?? 0 ) > (int) ( $section_blueprints[ $arch ]['score'] ?? 0 ) ) {
			$section_blueprints[ $arch ] = $blueprint;
		}
		foreach ( $blueprint['widgets'] as $w ) {
			$type = (string) ( $w['widgetType'] ?? '' );
			if ( $type === '' ) {
				continue;
			}
			$widget_type_counts[ $type ] = ( $widget_type_counts[ $type ] ?? 0 ) + 1;
			if ( ! isset( $widget_exemplars[ $type ] ) && ! empty( $w['settings'] ) && is_array( $w['settings'] ) ) {
				$widget_exemplars[ $type ] = $w['settings'];
			}
		}
	}

	/**
	 * @param array<string,array<string,mixed>> $widget_exemplars
	 * @param array<string,array<string,mixed>> $section_blueprints
	 * @param array<string,true>               $archetypes
	 */
	private static function synthesize_blueprints( array $widget_exemplars, array &$section_blueprints, array &$archetypes ): void {
		$types = array_keys( $widget_exemplars );
		if ( ! isset( $section_blueprints['hero'] ) && in_array( 'ygency-section-title', $types, true ) && in_array( 'image', $types, true ) ) {
			$btn_type = isset( $widget_exemplars['ygency-button'] ) ? 'ygency-button' : 'button';
			$title_tpl = array(
				'widgetType' => 'ygency-section-title',
				'role'       => 'title',
				'settings'   => $widget_exemplars['ygency-section-title'] ?? array(),
			);
			$cta_tpl = array(
				'widgetType' => $btn_type,
				'role'       => 'cta',
				'settings'   => $widget_exemplars['ygency-button'] ?? $widget_exemplars['button'] ?? array(),
			);
			$image_tpl = array(
				'widgetType' => 'image',
				'role'       => 'chrome',
				'settings'   => $widget_exemplars['image'] ?? array(),
			);
			$section_blueprints['hero'] = array(
				'archetype'          => 'hero',
				'section_settings'   => array(),
				'columns'            => array( 50, 50 ),
				'score'              => 10,
				'widgets'            => array( $title_tpl, $cta_tpl, $image_tpl ),
				'widgets_by_column'  => array(
					array( $title_tpl, $cta_tpl ),
					array( $image_tpl ),
				),
			);
			$archetypes['hero'] = true;
		}
		foreach ( $types as $type ) {
			if ( ! str_contains( $type, 'marquee' ) ) {
				continue;
			}
			if ( isset( $section_blueprints['marquee_band'] ) ) {
				break;
			}
			$section_blueprints['marquee_band'] = array(
				'archetype'        => 'marquee_band',
				'section_settings' => array(),
				'columns'          => array( 100 ),
				'score'            => 8,
				'widgets'          => array(
					array(
						'widgetType' => $type,
						'role'       => 'chrome',
						'settings'   => $widget_exemplars[ $type ],
					),
				),
			);
			$archetypes['marquee_band'] = true;
			break;
		}
	}

	public static function widget_role( string $widget_type ): string {
		if ( str_contains( $widget_type, 'button' ) ) {
			return 'cta';
		}
		if ( str_contains( $widget_type, 'section-title' ) || $widget_type === 'heading' ) {
			return 'title';
		}
		if ( str_contains( $widget_type, 'text-editor' ) || str_contains( $widget_type, 'text' ) ) {
			return 'body';
		}
		if ( $widget_type === 'image' || str_contains( $widget_type, 'gallery' ) ) {
			return 'chrome';
		}
		if ( str_contains( $widget_type, 'marquee' ) ) {
			return 'chrome';
		}
		return 'body';
	}

	/**
	 * @param array<string,mixed> $settings
	 * @return array<string,mixed>
	 */
	public static function style_exemplar_from_settings( array $settings ): array {
		$out = array();
		foreach ( $settings as $key => $value ) {
			if ( ! is_string( $key ) ) {
				continue;
			}
			if ( in_array( $key, self::COPY_SETTING_KEYS, true ) ) {
				continue;
			}
			if ( is_array( $value ) ) {
				if ( self::is_media_setting( $key, $value ) ) {
					$out[ $key ] = $value;
				}
				continue;
			}
			if ( is_string( $key ) && ( str_contains( $key, 'color' ) || str_contains( $key, 'background' ) || str_contains( $key, 'typography' ) || str_contains( $key, 'padding' ) || str_contains( $key, 'margin' ) || str_contains( $key, 'width' ) || str_contains( $key, 'align' ) || str_contains( $key, 'border' ) || str_contains( $key, 'gap' ) || str_contains( $key, 'column' ) ) ) {
				$out[ $key ] = $value;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $value
	 */
	private static function is_media_setting( string $key, array $value ): bool {
		unset( $key );
		return isset( $value['url'] ) || isset( $value['id'] );
	}

	/**
	 * @param array<string,array<string,mixed>> $widget_exemplars
	 * @return array<string,mixed>
	 */
	private static function default_content_blueprint( array $widget_exemplars ): array {
		$title_type = isset( $widget_exemplars['ygency-section-title'] ) ? 'ygency-section-title' : 'heading';
		$body_type  = 'text-editor';
		$widgets    = array(
			array(
				'widgetType' => $title_type,
				'role'       => 'title',
				'settings'   => $widget_exemplars[ $title_type ] ?? array(),
			),
			array(
				'widgetType' => $body_type,
				'role'       => 'body',
				'settings'   => $widget_exemplars[ $body_type ] ?? array(),
			),
		);
		return array(
			'archetype'          => 'content_band',
			'section_settings' => array(),
			'columns'            => array( 100 ),
			'widgets'            => $widgets,
			'widgets_by_column'  => array( $widgets ),
			'score'              => 1,
		);
	}
}
