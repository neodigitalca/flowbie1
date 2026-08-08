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
	private static function map_card_for_frontend( array $card ): array {
		$type = isset( $card['type'] ) ? sanitize_key( (string) $card['type'] ) : 'answer';
		if ( $type === 'error' ) {
			$type = 'not-found';
		}

		$mapped = array(
			'type'       => $type,
			'title'      => isset( $card['title'] ) ? (string) $card['title'] : __( 'Backend response', 'flowbie-wp' ),
			'body'       => isset( $card['body'] ) ? (string) $card['body'] : '',
			'links'      => isset( $card['links'] ) && is_array( $card['links'] ) ? $card['links'] : array(),
			'confidence' => isset( $card['confidence'] ) ? (string) $card['confidence'] : 'medium',
		);

		if ( ! empty( $card['suggested_actions'] ) && is_array( $card['suggested_actions'] ) ) {
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

		return $mapped;
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

		$settings   = Flowbie_Wp_Chat::get_settings();
		$page_url   = isset( $body['page_url'] ) ? esc_url_raw( wp_unslash( (string) $body['page_url'] ) ) : '';
		$post_id    = isset( $body['post_id'] ) ? (int) $body['post_id'] : 0;
		$page_title = isset( $body['page_title'] ) ? sanitize_text_field( wp_unslash( (string) $body['page_title'] ) ) : '';
		$key        = isset( $body['page_context_key'] ) ? sanitize_text_field( wp_unslash( (string) $body['page_context_key'] ) ) : '';

		if ( $page_url === '' && $post_id < 1 && $key === '' ) {
			return $ctx;
		}

		$page_context = Flowbie_Wp_Chat_Page_Context::load( $key, $page_url, $post_id, $page_title, $settings );
		if ( ! is_array( $page_context ) || empty( $page_context['post_id'] ) ) {
			return $ctx;
		}

		$ctx['frontend_page'] = array(
			'post_id'    => (int) $page_context['post_id'],
			'title'      => (string) ( $page_context['title'] ?? '' ),
			'url'        => (string) ( $page_context['url'] ?? '' ),
			'type_label' => (string) ( $page_context['type_label'] ?? '' ),
		);

		$prompt = Flowbie_Wp_Chat_Page_Context::format_for_prompt( $page_context );
		if ( $prompt !== '' ) {
			$ctx['page_context'] = $prompt;
		}

		return $ctx;
	}
}
