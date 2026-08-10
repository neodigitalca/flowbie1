<?php
/**
 * Frontend chat backend mode — streams Backend Assist pipeline to logged-in users.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Chat_Super_Admin {

	/**
	 * Whether the request should use the backend expert pipeline.
	 *
	 * @param array<string, mixed>|null $body Request body.
	 */
	public static function is_backend_mode_request( ?array $body ): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}
		if ( ! is_array( $body ) ) {
			return false;
		}
		$mode = isset( $body['admin_mode'] ) ? sanitize_key( (string) $body['admin_mode'] ) : 'visitor';
		return $mode === 'backend';
	}

	/**
	 * Run Backend Assist and stream NDJSON progress to the frontend widget.
	 *
	 * @param string                    $message User message.
	 * @param array<int, mixed>         $history Conversation history.
	 * @param array<string, mixed>|null $body    Stream request body.
	 */
	public static function stream_pipeline( string $message, array $history, ?array $body = null ): void {
		Flowbie_Wp_Chat::stream_begin();

		if ( trim( $message ) === '' ) {
			Flowbie_Wp_Chat::stream_emit( array(
				'status' => 'done',
				'card'   => array(
					'type'       => 'not-found',
					'title'      => __( 'Empty message', 'flowbie-wp' ),
					'body'       => __( 'Message cannot be empty.', 'flowbie-wp' ),
					'confidence' => 'low',
				),
			) );
			wp_die();
		}

		try {
			Flowbie_Wp_Backend_Assist::ensure_dependencies();

			$site_name = get_bloginfo( 'name' );
			$submode   = self::parse_submode_from_body( $body );
			$ack       = sprintf(
				/* translators: %s: site name */
				__( 'Reviewing backend data for %s…', 'flowbie-wp' ),
				$site_name
			);
			Flowbie_Wp_Chat::stream_emit( array( 'status' => 'ack', 'text' => $ack ) );
			Flowbie_Wp_Chat::stream_emit( array(
				'status' => 'searching',
				'label'  => Flowbie_Wp_Backend_Assist_Submode::stream_search_label( $submode ),
			) );

			Flowbie_Wp_Backend_Assist_Context::$builder_context = self::builder_context_from_body( $body, $submode );

			Flowbie_Wp_OpenRouter::maybe_extend_time_limit();
			$normalized = Flowbie_Wp_Backend_Assist_Cards::normalize_history( $history );
			Flowbie_Wp_Chat::stream_emit( array( 'status' => 'thinking', 'label' => __( 'Thinking…', 'flowbie-wp' ) ) );
			$card       = Flowbie_Wp_Backend_Assist_Submode::run_for_submode( $submode, $message, $normalized );
		} catch ( \Throwable $e ) {
			Flowbie_Wp_Backend_Assist_Context::$builder_context = null;
			Flowbie_Wp_Chat::stream_emit( array(
				'status' => 'done',
				'card'   => array(
					'type'       => 'not-found',
					'title'      => __( 'Something went wrong', 'flowbie-wp' ),
					'body'       => $e->getMessage(),
					'confidence' => 'low',
				),
			) );
			wp_die();
		}

		Flowbie_Wp_Backend_Assist_Context::$builder_context = null;

		Flowbie_Wp_Chat::stream_emit( array( 'status' => 'formatting', 'label' => __( 'Formatting response…', 'flowbie-wp' ) ) );

		$frontend_card = self::map_card_for_frontend( is_array( $card ) ? $card : array() );
		$payload       = array(
			'status' => 'done',
			'card'   => $frontend_card,
		);

		if ( ! empty( $frontend_card['relatedTopics'] ) && is_array( $frontend_card['relatedTopics'] ) ) {
			$payload['relatedTopics'] = $frontend_card['relatedTopics'];
		}

		Flowbie_Wp_Chat::stream_emit( $payload );
		wp_die();
	}

	/**
	 * Admin-focused conversation starters for backend mode.
	 *
	 * @return array<int, string>
	 */
	public static function get_backend_starters(): array {
		$starters = array(
			__( 'What are visitors asking that we do not cover?', 'flowbie-wp' ),
			__( 'Top search queries this month', 'flowbie-wp' ),
			__( 'Pages with traffic but low engagement', 'flowbie-wp' ),
		);
		if ( current_user_can( 'manage_options' ) ) {
			$starters[] = __( 'GSC quick wins for this site', 'flowbie-wp' );
		}
		return $starters;
	}

	/**
	 * @param array<string, mixed> $card Backend Assist card.
	 * @return array<string, mixed>
	 */
	public static function map_card_for_frontend_public( array $card ): array {
		return self::map_card_for_frontend( $card );
	}

	/**
	 * @param array<string, mixed> $card Backend Assist card.
	 * @return array<string, mixed>
	 */
	private static function map_card_for_frontend( array $card ): array {
		$type = isset( $card['type'] ) ? sanitize_key( (string) $card['type'] ) : 'answer';
		if ( $type === 'error' ) {
			$type = 'not-found';
		}

		$card = Flowbie_Wp_Backend_Assist_Cards::enrich_card( $card );

		$mapped = array(
			'type'       => $type,
			'title'      => isset( $card['title'] ) ? (string) $card['title'] : __( 'Backend response', 'flowbie-wp' ),
			'body'       => isset( $card['body'] ) ? (string) $card['body'] : '',
			'links'      => isset( $card['links'] ) && is_array( $card['links'] ) ? $card['links'] : array(),
			'confidence' => isset( $card['confidence'] ) ? (string) $card['confidence'] : 'medium',
		);

		if (
			empty( $card['submode_switch'] )
			&& ! empty( $card['suggested_actions'] )
			&& is_array( $card['suggested_actions'] )
		) {
			$topics = array();
			foreach ( $card['suggested_actions'] as $action ) {
				$label = is_string( $action ) ? trim( $action ) : '';
				if ( $label !== '' ) {
					$topics[] = $label;
				}
			}
			if ( ! empty( $topics ) ) {
				$mapped['relatedTopics'] = array_slice( $topics, 0, 4 );
			}
		}

		if ( ! empty( $card['steps'] ) && is_array( $card['steps'] ) ) {
			$mapped['steps'] = $card['steps'];
		}
		if ( isset( $card['workflow'] ) ) {
			$mapped['workflow'] = (bool) $card['workflow'];
		}
		if ( ! empty( $card['workflow_id'] ) ) {
			$mapped['workflow_id'] = sanitize_text_field( (string) $card['workflow_id'] );
		}
		if ( isset( $card['workflow_complete'] ) ) {
			$mapped['workflow_complete'] = (bool) $card['workflow_complete'];
		}
		if ( ! empty( $card['submode_switch'] ) ) {
			$mapped['submode_switch'] = Flowbie_Wp_Backend_Assist_Submode::normalize_submode( (string) $card['submode_switch'] );
		}
		if ( ! empty( $card['build_message'] ) ) {
			$mapped['build_message'] = sanitize_textarea_field( (string) $card['build_message'] );
		}
		if ( ! empty( $card['plan_intent'] ) ) {
			$mapped['plan_intent'] = sanitize_key( (string) $card['plan_intent'] );
		}
		if ( ! empty( $card['planned_tool'] ) ) {
			$mapped['planned_tool'] = sanitize_key( (string) $card['planned_tool'] );
		}
		if ( ! empty( $card['planned_ops'] ) && is_array( $card['planned_ops'] ) ) {
			$mapped['planned_ops'] = $card['planned_ops'];
		}
		if ( ! empty( $card['details_drawer'] ) && is_array( $card['details_drawer'] ) ) {
			$mapped['details_drawer'] = $card['details_drawer'];
		}
		if ( ! empty( $card['harness_sections'] ) && is_array( $card['harness_sections'] ) ) {
			$mapped['harness_sections'] = $card['harness_sections'];
		}
		if ( ! empty( $card['harness_progress'] ) && is_array( $card['harness_progress'] ) ) {
			$mapped['harness_progress'] = $card['harness_progress'];
		}
		if ( ! empty( $card['action_result'] ) && is_array( $card['action_result'] ) ) {
			$mapped['action_result'] = self::sanitize_action_result_for_frontend( $card['action_result'] );
		}

		if (
			! empty( $card['cta'] )
			&& is_array( $card['cta'] )
			&& ! empty( $card['cta']['url'] )
		) {
			$mapped['cta'] = array(
				'label' => isset( $card['cta']['label'] ) ? (string) $card['cta']['label'] : '',
				'url'   => (string) $card['cta']['url'],
			);
		}

		if (
			! empty( $card['undo'] )
			&& is_array( $card['undo'] )
			&& ! empty( $card['undo']['post_id'] )
			&& empty( array_filter( $mapped['links'], static function ( $link ) {
				return is_array( $link ) && ( $link['action'] ?? '' ) === 'undo';
			} ) )
		) {
			$mapped['links'][] = Flowbie_Wp_Backend_Assist_Cards::undo_link_for_post(
				absint( $card['undo']['post_id'] )
			);
		}

		return $mapped;
	}

	/**
	 * Keep action_result on Build cards so the editor can sync saved meta.
	 *
	 * @param array<string, mixed> $exec
	 * @return array<string, mixed>
	 */
	private static function sanitize_action_result_for_frontend( array $exec ): array {
		$out = array(
			'success'        => ! empty( $exec['success'] ),
			'post_id'        => isset( $exec['post_id'] ) ? absint( $exec['post_id'] ) : 0,
			'build_executed' => ! empty( $exec['build_executed'] ),
		);

		if ( ! empty( $exec['saved'] ) && is_array( $exec['saved'] ) ) {
			$out['saved'] = array_values( array_map( 'strval', $exec['saved'] ) );
		}

		if ( ! empty( $exec['values'] ) && is_array( $exec['values'] ) ) {
			$values = array();
			foreach ( array( 'seoTitle', 'metaDescription', 'focusKeyword', 'seoResearch', 'faq', 'pageUrl' ) as $key ) {
				if ( ! isset( $exec['values'][ $key ] ) ) {
					continue;
				}
				$raw = trim( (string) $exec['values'][ $key ] );
				if ( $raw !== '' ) {
					$values[ $key ] = $raw;
				}
			}
			if ( $values !== array() ) {
				$out['values'] = $values;
			}
		}

		if ( ! empty( $exec['meta_compound'] ) ) {
			$out['meta_compound'] = true;
		}

		return $out;
	}

	/**
	 * @param array<string, mixed>|null $body Stream request body.
	 */
	public static function parse_target_scope_from_body( ?array $body ): string {
		if ( ! is_array( $body ) || ! isset( $body['target_scope'] ) ) {
			return 'page';
		}
		$scope = sanitize_key( (string) $body['target_scope'] );
		return $scope === 'site' ? 'site' : 'page';
	}

	/**
	 * @param array<string, mixed>|null $body Stream request body.
	 */
	private static function parse_submode_from_body( ?array $body ): string {
		if ( ! is_array( $body ) || ! isset( $body['admin_submode'] ) ) {
			return 'ask';
		}
		return Flowbie_Wp_Backend_Assist_Submode::normalize_submode( (string) $body['admin_submode'] );
	}

	public static function build_builder_context_from_request( ?array $body, string $submode = 'ask' ): ?array {
		return self::builder_context_from_body( $body, $submode );
	}

	/**
	 * @param array<string, mixed>|null $body    Stream request body.
	 * @param string                    $submode Admin submode.
	 * @return array<string, mixed>|null
	 */
	private static function builder_context_from_body( ?array $body, string $submode = 'ask' ): ?array {
		if ( ! is_array( $body ) ) {
			return null;
		}

		$ctx = array(
			'admin_submode' => Flowbie_Wp_Backend_Assist_Submode::normalize_submode( $submode ),
			'target_scope'  => self::parse_target_scope_from_body( $body ),
		);

		Flowbie_Wp_Site_Inventory::warm( true );
		$inventory_summary = Flowbie_Wp_Site_Inventory::build_prompt_summary( 150 );
		$blog_summary      = Flowbie_Wp_Site_Inventory::build_type_inventory_summary( 'post' );
		$inventory_meta    = Flowbie_Wp_Site_Inventory::get_meta();
		if ( $inventory_summary !== '' ) {
			$ctx['site_inventory_summary'] = $inventory_summary;
		}
		if ( $blog_summary !== '' ) {
			$ctx['site_blog_inventory_summary'] = $blog_summary;
		}
		$ctx['site_inventory_count'] = (int) ( $inventory_meta['count'] ?? 0 );

		if ( $ctx['target_scope'] === 'site' ) {
			return $ctx;
		}

		$settings     = Flowbie_Wp_Chat::get_settings();
		$raw_page_url = isset( $body['page_url'] ) ? trim( wp_unslash( (string) $body['page_url'] ) ) : '';
		$page_url     = $raw_page_url !== '' ? esc_url_raw( $raw_page_url ) : '';
		$post_id      = isset( $body['post_id'] ) ? (int) $body['post_id'] : 0;
		$page_title   = isset( $body['page_title'] ) ? sanitize_text_field( wp_unslash( (string) $body['page_title'] ) ) : '';
		$key          = isset( $body['page_context_key'] ) ? sanitize_text_field( wp_unslash( (string) $body['page_context_key'] ) ) : '';

		if ( $post_id < 1 && $raw_page_url !== '' ) {
			$from_url = Flowbie_Wp_Chat_Page_Context::post_id_from_url( $raw_page_url );
			if ( $from_url > 0 ) {
				$post_id = $from_url;
			}
		}

		if ( $page_url === '' && $post_id < 1 && $key === '' ) {
			return $ctx;
		}

		$page_context = Flowbie_Wp_Chat_Page_Context::load( $key, $page_url, $post_id, $page_title, $settings );
		$post_id_resolved = is_array( $page_context ) ? absint( $page_context['post_id'] ?? 0 ) : 0;
		if ( $post_id_resolved < 1 ) {
			$site_index       = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
			$post_id_resolved = Flowbie_Wp_Chat_Page_Context::resolve_post_id( $page_url, $post_id, $site_index, $page_title );
			if ( $post_id_resolved > 0 ) {
				$page_context = Flowbie_Wp_Chat_Page_Context::resolve_from_request( $page_url, $post_id_resolved, $page_title, $settings, true );
			}
		}

		if ( $post_id_resolved < 1 || ! current_user_can( 'edit_post', $post_id_resolved ) ) {
			return $ctx;
		}

		$ctx['frontend_page'] = array(
			'post_id'    => $post_id_resolved,
			'title'      => is_array( $page_context ) ? (string) ( $page_context['title'] ?? $page_title ) : $page_title,
			'url'        => is_array( $page_context ) ? (string) ( $page_context['url'] ?? $page_url ) : $page_url,
			'type_label' => is_array( $page_context ) ? (string) ( $page_context['type_label'] ?? '' ) : '',
		);

		$post = get_post( $post_id_resolved );
		if ( $post instanceof WP_Post ) {
			$ctx['frontend_page']['post_status'] = (string) $post->post_status;
			if ( $ctx['frontend_page']['title'] === '' ) {
				$ctx['frontend_page']['title'] = get_the_title( $post );
			}
			if ( $ctx['frontend_page']['type_label'] === '' ) {
				$ctx['frontend_page']['type_label'] = Flowbie_Wp_Chat_Page_Context::type_label_for_post( $post );
			}
		}

		if ( is_array( $page_context ) ) {
			$prompt = Flowbie_Wp_Chat_Page_Context::format_for_prompt( $page_context );
			if ( $prompt !== '' ) {
				$ctx['page_context'] = $prompt;
			}
		}

		return $ctx;
	}
}
