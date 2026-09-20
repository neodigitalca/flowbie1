<?php
/**
 * Backend Assist — expand create-page/post packs and heading outlines
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Workflow_Expand {

	/**
	 * Expand a create-only (or create-without-meta/content) decompose into the full page/post pack.
	 *
	 * @param array<string, mixed> $decomposed
	 * @param array<string, mixed> $classification
	 * @return array<string, mixed>
	 */
	public static function expand_create_to_full_page( array $decomposed, string $message, array $classification = array() ): array {
		$steps = isset( $decomposed['steps'] ) && is_array( $decomposed['steps'] ) ? $decomposed['steps'] : array();
		$tools = self::decomposed_tool_names( $steps );

		$create_tool = '';
		if ( in_array( 'create_page', $tools, true ) ) {
			$create_tool = 'create_page';
		} elseif ( in_array( 'create_post', $tools, true ) ) {
			$create_tool = 'create_post';
		} else {
			$classified = isset( $classification['tool'] ) ? sanitize_key( (string) $classification['tool'] ) : '';
			if ( in_array( $classified, array( 'create_page', 'create_post' ), true ) ) {
				$create_tool = $classified;
			}
		}

		if ( $create_tool === '' ) {
			return $decomposed;
		}

		$create_params = self::first_step_params( $steps, $create_tool );
		$class_params  = isset( $classification['params'] ) && is_array( $classification['params'] ) ? $classification['params'] : array();
		$from_message  = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::create_page_title_from_message( $message, $classification );
		$title         = '';
		if ( ! empty( $create_params['title'] ) ) {
			$title = sanitize_text_field( (string) $create_params['title'] );
		} elseif ( ! empty( $class_params['title'] ) ) {
			$title = sanitize_text_field( (string) $class_params['title'] );
		} elseif ( $from_message['title'] !== '' ) {
			$title = $from_message['title'];
		}

		$keyword = '';
		if ( ! empty( $create_params['focus_keyword'] ) ) {
			$keyword = sanitize_text_field( (string) $create_params['focus_keyword'] );
		} elseif ( ! empty( $class_params['focus_keyword'] ) ) {
			$keyword = sanitize_text_field( (string) $class_params['focus_keyword'] );
		} elseif ( ! empty( $class_params['focusKeyword'] ) ) {
			$keyword = sanitize_text_field( (string) $class_params['focusKeyword'] );
		} elseif ( $from_message['keyword'] !== '' ) {
			$keyword = $from_message['keyword'];
		}

		if ( $title === '' && $keyword !== '' ) {
			$title = $keyword;
		}
		if ( $title === '' ) {
			return $decomposed;
		}

		$has_create  = in_array( $create_tool, $tools, true );
		$has_meta    = in_array( 'save_post_meta', $tools, true );
		$has_content = self::decomposed_has_content_steps( $tools );

		if ( $has_create && $has_meta && $has_content ) {
			$decomposed['workflow'] = true;
			$decomposed['steps']    = self::finish_create_page_steps( $steps, $create_tool );
			return $decomposed;
		}

		$out = array();
		if ( ! $has_create ) {
			$create_step_params = array( 'title' => $title );
			if ( $keyword !== '' ) {
				$create_step_params['focus_keyword'] = $keyword;
			}
			$out[] = array(
				'tool'   => $create_tool,
				'label'  => ( $create_tool === 'create_page' ? 'Create page ' : 'Create post ' ) . $title,
				'params' => $create_step_params,
			);
		}

		foreach ( $steps as $step ) {
			if ( ! is_array( $step ) || empty( $step['tool'] ) ) {
				continue;
			}
			$out[] = $step;
			if ( sanitize_key( (string) $step['tool'] ) === $create_tool && ! $has_meta ) {
				$out[]     = self::full_page_meta_step( $keyword );
				$has_meta = true;
			}
		}

		if ( ! $has_meta ) {
			$out      = self::insert_meta_after_create( $out, $create_tool, $keyword );
			$has_meta = true;
		}

		if ( ! $has_content ) {
			if ( $create_tool === 'create_page' ) {
				$prompt = $title;
				if ( $keyword !== '' ) {
					$prompt .= '. Focus keyword ' . $keyword . '.';
				}
				if ( self::uses_elementor_page_content() ) {
					$out[] = self::compose_elementor_step(
						'Compose Elementor sections for ' . $title,
						array( 'prompt' => $prompt )
					);
				} else {
					$out[] = array(
						'tool'   => 'compose_seo_block',
						'label'  => 'Compose SEO block for ' . $title,
						'params' => array(
							'mode'   => 'generate_full',
							'prompt' => $prompt,
						),
					);
					$out[] = array(
						'tool'   => 'save_seo_block',
						'label'  => 'Save SEO block to Agent Hub',
						'params' => array(),
					);
				}
				$out[] = self::design_step();
			} else {
				$brief = 'Write full post body for ' . $title . '.';
				if ( $keyword !== '' ) {
					$brief .= ' Focus keyword ' . $keyword . '.';
				}
				$out[] = array(
					'tool'   => 'add_content',
					'label'  => 'Add post body',
					'params' => array(
						'mode'            => 'replace',
						'expand_sections' => true,
						'content_brief'   => $brief,
					),
				);
			}
		}

		$decomposed['workflow'] = true;
		$decomposed['steps']    = self::finish_create_page_steps( $out, $create_tool );
		if ( empty( $decomposed['title'] ) ) {
			$decomposed['title'] = ( $create_tool === 'create_page' ? 'Create page ' : 'Create post ' ) . $title;
		}
		return $decomposed;
	}

	/**
	 * Replace one mega compose with compose/save/apply per H2.
	 *
	 * @param array<string, mixed>             $decomposed
	 * @param array<int, array<string, mixed>> $sections
	 * @return array<string, mixed>
	 */
	public static function apply_heading_outline_to_steps( array $decomposed, array $sections ): array {
		$steps = isset( $decomposed['steps'] ) && is_array( $decomposed['steps'] ) ? $decomposed['steps'] : array();
		if ( $steps === array() || $sections === array() ) {
			return $decomposed;
		}

		$groups = self::heading_groups( $sections );
		if ( $groups === array() ) {
			return $decomposed;
		}

		$topic          = self::pack_topic( $decomposed );
		$is_create      = in_array( 'create_page', self::decomposed_tool_names( $steps ), true );
		$use_elementor  = $is_create && self::uses_elementor_page_content();
		$triplets       = array();
		foreach ( $groups as $group ) {
			$h2 = $group['title'];
			if ( $use_elementor ) {
				$triplets[] = self::compose_elementor_step(
					'Compose Elementor section: ' . $h2,
					array(
						'prompt'      => self::compose_prompt_for_h2( $topic, $group ),
						'section_h2'  => $h2,
						'new_section' => true,
					)
				);
				continue;
			}
			$triplets[] = array(
				'tool'   => 'compose_seo_block',
				'label'  => 'Compose SEO block: ' . $h2,
				'params' => array(
					'mode'          => 'generate_full',
					'prompt'        => self::compose_prompt_for_h2( $topic, $group ),
					'new_block'     => true,
					'current_block' => array(),
				),
			);
			$triplets[] = array(
				'tool'   => 'save_seo_block',
				'label'  => 'Save SEO block: ' . $h2,
				'params' => array(),
			);
			if ( ! $is_create ) {
				$triplets[] = array(
					'tool'   => 'apply_seo_block_to_page',
					'label'  => 'Apply SEO block: ' . $h2,
					'params' => array(
						'mode'                    => 'append',
						'sync_library'            => true,
						'include_dynamic_heading' => true,
					),
				);
			}
		}

		$out      = array();
		$replaced = false;
		foreach ( $steps as $step ) {
			if ( ! is_array( $step ) ) {
				continue;
			}
			if ( sanitize_key( (string) ( $step['step_kind'] ?? '' ) ) === 'heading' ) {
				continue;
			}
			$tool = sanitize_key( (string) ( $step['tool'] ?? '' ) );
			if ( in_array( $tool, array( 'compose_seo_block', 'save_seo_block', 'apply_seo_block_to_page', 'compose_elementor_page_sections', 'design_page_with_novamira' ), true ) ) {
				if ( ! $replaced ) {
					$out      = array_merge( $out, $triplets );
					$replaced = true;
				}
				continue;
			}
			if ( $tool === '' ) {
				continue;
			}
			$out[] = $step;
		}
		if ( ! $replaced ) {
			$out = array_merge( $out, $triplets );
		}
		if ( $is_create ) {
			$out[] = self::design_step();
		}

		$decomposed['steps']   = $out;
		$decomposed['outline'] = $sections;
		return $decomposed;
	}

	/**
	 * @param array<int, array<string, mixed>> $sections
	 * @return array<int, array{title: string, brief: string, h3s: array<int, array{title: string, brief: string}>}>
	 */
	private static function heading_groups( array $sections ): array {
		$groups  = array();
		$current = null;
		foreach ( $sections as $section ) {
			if ( ! is_array( $section ) ) {
				continue;
			}
			$type  = isset( $section['type'] ) ? sanitize_key( (string) $section['type'] ) : 'h2';
			$title = isset( $section['title'] ) ? sanitize_text_field( (string) $section['title'] ) : '';
			if ( $title === '' ) {
				continue;
			}
			$brief = isset( $section['brief'] ) ? sanitize_text_field( (string) $section['brief'] ) : '';
			if ( $type === 'h3' && is_array( $current ) ) {
				$current['h3s'][] = array(
					'title' => $title,
					'brief' => $brief,
				);
				continue;
			}
			if ( is_array( $current ) ) {
				$groups[] = $current;
			}
			$current = array(
				'title' => $title,
				'brief' => $brief,
				'h3s'   => array(),
			);
		}
		if ( is_array( $current ) ) {
			$groups[] = $current;
		}
		return $groups;
	}

	/**
	 * @param array{title: string, keyword: string} $topic
	 * @param array{title: string, brief: string, h3s: array<int, array{title: string, brief: string}>} $group
	 */
	private static function compose_prompt_for_h2( array $topic, array $group ): string {
		$page = $topic['title'] !== '' ? $topic['title'] : 'this page';
		$h2   = $group['title'];
		$prompt = 'Create a brand-new Agent Hub Block Builder SEO block for this H2 only on the WordPress page "' . $page . '".';
		if ( $topic['keyword'] !== '' ) {
			$prompt .= ' Focus keyword: ' . $topic['keyword'] . '.';
		}
		$prompt .= ' H2 title (use exactly): ' . $h2 . '.';
		if ( $group['brief'] !== '' ) {
			$prompt .= ' ' . $group['brief'];
		}
		if ( ! empty( $group['h3s'] ) ) {
			$prompt .= ' H3s under this H2 only:';
			foreach ( $group['h3s'] as $h3 ) {
				$prompt .= ' ' . $h3['title'];
				if ( $h3['brief'] !== '' ) {
					$prompt .= ' (' . $h3['brief'] . ')';
				}
				$prompt .= '.';
			}
		}
		$prompt .= ' Body copy covers this subtopic only. Do not include sibling H2s as slots. Do not load or reuse an existing Agent Hub block id. Start with an empty current_block.';
		return $prompt;
	}

	/**
	 * @param array<string, mixed> $decomposed
	 * @return array{title: string, keyword: string}
	 */
	public static function pack_topic( array $decomposed ): array {
		$title   = '';
		$keyword = '';
		$steps   = isset( $decomposed['steps'] ) && is_array( $decomposed['steps'] ) ? $decomposed['steps'] : array();
		foreach ( $steps as $step ) {
			if ( ! is_array( $step ) ) {
				continue;
			}
			$tool   = sanitize_key( (string) ( $step['tool'] ?? '' ) );
			$params = isset( $step['params'] ) && is_array( $step['params'] ) ? $step['params'] : array();
			if ( in_array( $tool, array( 'create_page', 'create_post' ), true ) ) {
				if ( $title === '' && ! empty( $params['title'] ) ) {
					$title = sanitize_text_field( (string) $params['title'] );
				}
				if ( $keyword === '' && ! empty( $params['focus_keyword'] ) ) {
					$keyword = sanitize_text_field( (string) $params['focus_keyword'] );
				}
			}
			if ( $tool === 'save_post_meta' && $keyword === '' && ! empty( $params['focusKeyword'] ) ) {
				$keyword = sanitize_text_field( (string) $params['focusKeyword'] );
			}
		}
		return array(
			'title'   => $title,
			'keyword' => $keyword,
		);
	}

	/**
	 * Plan H2/H3s for a compose_seo_block pack and lock the compose prompt to them.
	 *
	 * @param array<string, mixed>             $decomposed
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>|WP_Error
	 */
	public static function attach_heading_outline( array $decomposed, string $message, array $history = array() ) {
		$steps = isset( $decomposed['steps'] ) && is_array( $decomposed['steps'] ) ? $decomposed['steps'] : array();
		$tools = self::decomposed_tool_names( $steps );
		if ( ! in_array( 'compose_seo_block', $tools, true ) ) {
			return $decomposed;
		}
		foreach ( $steps as $step ) {
			if ( is_array( $step ) && sanitize_key( (string) ( $step['step_kind'] ?? '' ) ) === 'heading' ) {
				return $decomposed;
			}
		}

		if ( ! class_exists( 'Neo_Pulse_Wp_Backend_Assist_Content', false ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-content.php';
		}

		$topic   = self::pack_topic( $decomposed );
		$planned = Neo_Pulse_Wp_Backend_Assist_Content::phase_plan_content_outline(
			$message,
			array(
				'post_title'    => $topic['title'],
				'focus_keyword' => $topic['keyword'],
				'content_brief' => 'Plan one H2 per subtopic. Each H2 becomes its own Agent Hub Block Builder block.',
			),
			$history
		);
		if ( is_wp_error( $planned ) ) {
			return $planned;
		}
		$sections = Neo_Pulse_Wp_Backend_Assist_Content::normalize_outline_sections( $planned['sections'] ?? array() );
		if ( $sections === array() ) {
			return new WP_Error( 'neo-pulse_outline', __( 'Could not plan headings for this page block.', 'neo-pulse-wp' ) );
		}
		return self::apply_heading_outline_to_steps( $decomposed, $sections );
	}

	/**
	 * @param array<int, mixed> $steps
	 * @return array<int, string>
	 */
	private static function decomposed_tool_names( array $steps ): array {
		$tools = array();
		foreach ( $steps as $step ) {
			if ( is_array( $step ) && ! empty( $step['tool'] ) ) {
				$tools[] = sanitize_key( (string) $step['tool'] );
			}
		}
		return $tools;
	}

	/**
	 * @param array<int, mixed> $steps
	 * @return array<string, mixed>
	 */
	private static function first_step_params( array $steps, string $tool ): array {
		foreach ( $steps as $step ) {
			if ( ! is_array( $step ) || sanitize_key( (string) ( $step['tool'] ?? '' ) ) !== $tool ) {
				continue;
			}
			return isset( $step['params'] ) && is_array( $step['params'] ) ? $step['params'] : array();
		}
		return array();
	}

	/**
	 * @param array<int, string> $tools
	 */
	private static function decomposed_has_content_steps( array $tools ): bool {
		foreach ( array( 'add_content', 'compose_seo_block', 'compose_elementor_page_sections', 'duplicate_seo_block', 'apply_seo_block_to_page', 'design_page_with_novamira' ) as $tool ) {
			if ( in_array( $tool, $tools, true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function full_page_meta_step( string $keyword ): array {
		$params = array();
		if ( $keyword !== '' ) {
			$params['focusKeyword'] = $keyword;
		}
		return array(
			'tool'   => 'save_post_meta',
			'label'  => 'Save SEO meta',
			'params' => $params,
		);
	}

	/**
	 * @param array<int, mixed> $steps
	 * @return array<int, mixed>
	 */
	/**
	 * @param array<int, mixed> $steps
	 * @return array<int, mixed>
	 */
	private static function clear_create_pack_post_ids( array $steps ): array {
		$out = array();
		foreach ( $steps as $step ) {
			if ( ! is_array( $step ) ) {
				continue;
			}
			$tool = sanitize_key( (string) ( $step['tool'] ?? '' ) );
			if ( in_array( $tool, array( 'save_post_meta', 'compose_seo_block', 'apply_seo_block_to_page', 'design_page_with_novamira', 'add_content' ), true ) ) {
				if ( isset( $step['params'] ) && is_array( $step['params'] ) ) {
					unset( $step['params']['post_id'] );
				}
			}
			$out[] = $step;
		}
		return $out;
	}

	/**
	 * @param array<int, mixed> $steps
	 * @return array<int, mixed>
	 */
	private static function insert_meta_after_create( array $steps, string $create_tool, string $keyword ): array {
		$out  = array();
		$done = false;
		foreach ( $steps as $step ) {
			$out[] = $step;
			if ( $done || ! is_array( $step ) ) {
				continue;
			}
			if ( sanitize_key( (string) ( $step['tool'] ?? '' ) ) === $create_tool ) {
				$out[] = self::full_page_meta_step( $keyword );
				$done  = true;
			}
		}
		if ( ! $done ) {
			array_unshift( $out, self::full_page_meta_step( $keyword ) );
		}
		return $out;
	}

	/**
	 * @param array<int, mixed> $steps
	 * @return array<int, mixed>
	 */
	private static function finish_create_page_steps( array $steps, string $create_tool ): array {
		$steps = self::clear_create_pack_post_ids( $steps );
		if ( $create_tool !== 'create_page' ) {
			return $steps;
		}
		$out         = array();
		$has_design  = false;
		foreach ( $steps as $step ) {
			if ( ! is_array( $step ) ) {
				continue;
			}
			$tool = sanitize_key( (string) ( $step['tool'] ?? '' ) );
			if ( $tool === 'apply_seo_block_to_page' ) {
				continue;
			}
			if ( $tool === 'design_page_with_novamira' ) {
				if ( $has_design ) {
					continue;
				}
				$has_design = true;
			}
			$out[] = $step;
		}
		if ( ! $has_design ) {
			$out[] = self::design_step();
		}
		return $out;
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function design_step(): array {
		$params = array();
		if ( self::uses_elementor_page_content() ) {
			$params['content_mode'] = 'elementor_widgets';
		}
		return array(
			'tool'   => 'design_page_with_novamira',
			'label'  => 'Design page with Novamira',
			'params' => $params,
		);
	}

	private static function uses_elementor_page_content(): bool {
		return Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::page_content_mode_from_context() === 'elementor_widgets';
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>
	 */
	private static function compose_elementor_step( string $label, array $params ): array {
		return array(
			'tool'   => 'compose_elementor_page_sections',
			'label'  => $label,
			'params' => $params,
		);
	}

}
