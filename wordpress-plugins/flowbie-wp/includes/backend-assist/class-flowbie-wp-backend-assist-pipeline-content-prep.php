<?php
/**
 * Backend Assist — tool param preparation and post body generation
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep {

	/** @var array<int, string> */
	private static $read_only_tools = array(
		'get_chat_insights',
		'get_search_insights',
		'get_overseer_summary',
		'list_overseer_tasks',
		'get_site_inventory',
		'analyze_content_gaps',
		'grade_post_library_seo',
		'get_gsc_context',
		'list_posts',
		'get_post',
		'list_seo_blocks',
	);

	public static function prepare_tool_params( string $message, array $history, string $tool, array $params, ?array $workflow = null ): array {
		$params = self::apply_frontend_page_context( $message, $params );

		if ( $tool === 'modify_seo_block_slots' ) {
			if ( empty( $params['action'] ) ) {
				$params['action'] = 'add';
			}
			if ( empty( $params['slot'] ) && ! empty( $params['slots'] ) && is_array( $params['slots'] ) ) {
				$params['slot'] = $params['slots'][0];
			}
			if ( ( $params['action'] ?? '' ) === 'add' && empty( $params['slot'] ) ) {
				$plan   = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_plan( $message, $history, $tool, $params );
				$params = is_array( $plan['params'] ) ? array_merge( $params, $plan['params'] ) : $params;
			}
			return array(
				'tool'   => 'modify_seo_block_slots',
				'params' => $params,
			);
		}

		if ( $tool === 'compose_seo_block' ) {
			$plan   = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_plan( $message, $history, $tool, $params );
			$params = is_array( $plan['params'] ) ? $plan['params'] : $params;
			if ( empty( $params['prompt'] ) ) {
				$params['prompt'] = $message;
			}
			if ( empty( $params['mode'] ) ) {
				$params['mode'] = 'generate_full';
			}
			if (
				empty( $params['current_block'] )
				&& is_array( Flowbie_Wp_Backend_Assist_Context::$builder_context )
				&& ! empty( Flowbie_Wp_Backend_Assist_Context::$builder_context['block'] )
				&& is_array( Flowbie_Wp_Backend_Assist_Context::$builder_context['block'] )
			) {
				$params['current_block'] = Flowbie_Wp_Backend_Assist_Context::$builder_context['block'];
			}
			if ( empty( $params['page_context'] ) && is_array( Flowbie_Wp_Backend_Assist_Context::$builder_context ) && ! empty( Flowbie_Wp_Backend_Assist_Context::$builder_context['page_context'] ) ) {
				$params['page_context'] = sanitize_textarea_field( (string) Flowbie_Wp_Backend_Assist_Context::$builder_context['page_context'] );
			}
			if ( empty( $params['page_context'] ) ) {
				$block = isset( $params['current_block'] ) && is_array( $params['current_block'] ) ? $params['current_block'] : array();
				if ( ! class_exists( 'Flowbie_Wp_Seo_Blocks_Context' ) ) {
					require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-context.php';
				}
				$params['page_context'] = Flowbie_Wp_Seo_Blocks_Context::prompt_for_block(
					absint( $block['primary_post_id'] ?? 0 ),
					absint( $block['id'] ?? 0 ),
					$block
				);
			}
			return array(
				'tool'   => 'compose_seo_block',
				'params' => $params,
			);
		}

		if ( in_array( $tool, self::$read_only_tools, true ) ) {
			return array(
				'tool'   => $tool,
				'params' => $params,
			);
		}

		if ( $tool !== 'add_content' ) {
			$plan = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_plan( $message, $history, $tool, $params );
			return array(
				'tool'   => $plan['tool'],
				'params' => $plan['params'],
			);
		}

		if ( empty( $params['mode'] ) ) {
			$params['mode'] = 'replace';
		}

		$needs_resolve = empty( $params['post_id'] ) && empty( $params['title'] );
		if ( $needs_resolve ) {
			$plan   = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_plan( $message, $history, $tool, $params );
			$tool   = $plan['tool'];
			$params = is_array( $plan['params'] ) ? $plan['params'] : $params;
		}

		$content = isset( $params['content'] ) ? trim( (string) $params['content'] ) : '';
		if ( $content === '' ) {
			$generated = self::generate_post_body_html( $message, $history, $params, $workflow );
			if ( ! is_wp_error( $generated ) && $generated !== '' ) {
				$params['content'] = $generated;
			} elseif ( is_wp_error( $generated ) && $content === '' ) {
				// Retry once with plan phase only to recover post_id, then generate again.
				$plan   = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_plan( $message, $history, $tool, $params );
				$params = is_array( $plan['params'] ) ? array_merge( $params, $plan['params'] ) : $params;
				$generated = self::generate_post_body_html( $message, $history, $params, $workflow );
				if ( ! is_wp_error( $generated ) && $generated !== '' ) {
					$params['content'] = $generated;
				}
			}
		}

		if ( empty( $params['mode'] ) ) {
			$params['mode'] = 'replace';
		}

		return array(
			'tool'   => $tool,
			'params' => $params,
		);
	}
	public static function generate_post_body_html( string $message, array $history, array $params, ?array $workflow = null ) {
		$site_name = get_bloginfo( 'name' );
		$site_url  = home_url( '/' );

		$fk = '';
		if ( ! empty( $params['focus_keyword'] ) ) {
			$fk = sanitize_text_field( $params['focus_keyword'] );
		}
		$post_id = isset( $params['post_id'] ) ? absint( $params['post_id'] ) : 0;
		if ( $fk === '' && $post_id > 0 ) {
			$fk = get_post_meta( $post_id, '_flowbie_focus_keyword', true );
		}

		$post_title = isset( $params['title'] ) ? sanitize_text_field( $params['title'] ) : '';
		if ( $post_title === '' && $post_id > 0 ) {
			$post = get_post( $post_id );
			if ( $post ) {
				$post_title = $post->post_title;
			}
		}

		$user_request = ( null !== $workflow && ! empty( $workflow['message'] ) )
			? $workflow['message']
			: $message;

		$brief_parts = array();
		if ( ! empty( $params['content_brief'] ) ) {
			$brief_parts[] = (string) $params['content_brief'];
		}
		if ( ! empty( $params['instructions'] ) ) {
			$brief_parts[] = (string) $params['instructions'];
		}
		$brief = implode( "\n", $brief_parts );
		if ( $brief === '' ) {
			$brief = $user_request;
		}

		$system = <<<PROMPT
You are an expert SEO content writer for WordPress on "{$site_name}" ({$site_url}).
Write the COMPLETE post body the user asked for — publish-ready semantic HTML only.

OUTPUT RULES (non-negotiable):
- Return ONLY HTML. No markdown code fences. No JSON. No explanations before or after.
- Use <h2>, <h3>, <p>, <ul>/<li>, and <table> (with <thead>/<tbody>/<tr>/<th>/<td>) as appropriate.
- Fulfill EVERY structural requirement in the brief (exact H2 counts, lists under sections, tables, etc.).
- Write real, useful copy (2–4 sentences per section minimum) optimized for the focus keyword.
- Do not leave placeholders like "[insert content]" or "Lorem ipsum".
PROMPT;

		$user = "USER REQUEST:\n{$user_request}\n\n";
		if ( $post_title !== '' ) {
			$user .= "POST TITLE: {$post_title}\n";
		}
		if ( $fk !== '' ) {
			$user .= "FOCUS KEYWORD: {$fk}\n";
		}
		$gsc_block = '';
		if ( $post_id > 0 ) {
			$gsc_block = Flowbie_Wp_Gsc_Prompt::for_post( $post_id, $fk );
		}
		if ( $gsc_block !== '' ) {
			$user .= "\n{$gsc_block}\n";
		}
		if ( $brief !== $user_request ) {
			$user .= "\nCONTENT BRIEF:\n{$brief}\n";
		}

		$result = Flowbie_Wp_Backend_Assist_Ai::call_openrouter( Flowbie_Wp_Backend_Assist_Context::REASON_MODEL, $system, $user, 8192, 0.55 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$html = self::strip_ai_html_fences( $result );
		if ( $html === '' ) {
			return new WP_Error( 'flowbie_backend_empty_html', __( 'Content generation returned empty HTML.', 'flowbie-wp' ) );
		}

		return $html;
	}
	public static function strip_ai_html_fences( string $text ): string {
		$text = trim( $text );
		$text = preg_replace( '/^```(?:html)?\s*/i', '', $text );
		$text = preg_replace( '/\s*```$/', '', $text );
		return trim( $text );
	}
	public static function builder_context_page_prompt( array $block ): string {
		if ( ! class_exists( 'Flowbie_Wp_Seo_Blocks_Context' ) ) {
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-context.php';
		}
		$formatted = Flowbie_Wp_Seo_Blocks_Context::prompt_for_block(
			absint( $block['primary_post_id'] ?? 0 ),
			absint( $block['id'] ?? 0 ),
			$block
		);
		if ( $formatted === '' ) {
			return '';
		}
		return "\nLINKED PAGE CONTEXT:\n{$formatted}\n";
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>
	 */
	private static function apply_frontend_page_context( string $message, array $params ): array {
		if ( ! empty( $params['post_id'] ) || ! empty( $params['title'] ) ) {
			return $params;
		}
		if ( ! Flowbie_Wp_Chat_Page_Context::message_targets_current_page( $message ) ) {
			return $params;
		}

		$ctx = Flowbie_Wp_Backend_Assist_Context::$builder_context;
		if ( ! is_array( $ctx ) || empty( $ctx['frontend_page'] ) || ! is_array( $ctx['frontend_page'] ) ) {
			return $params;
		}

		$post_id = absint( $ctx['frontend_page']['post_id'] ?? 0 );
		if ( $post_id < 1 || ! current_user_can( 'edit_post', $post_id ) ) {
			return $params;
		}

		$params['post_id'] = $post_id;
		if ( empty( $params['title'] ) && ! empty( $ctx['frontend_page']['title'] ) ) {
			$params['title'] = sanitize_text_field( (string) $ctx['frontend_page']['title'] );
		}

		return $params;
	}
}
