<?php
/**
 * Flowbie Chat Widget: frontend injection and REST API.
 *
 * When enabled in Settings > Chat Widget, injects a floating chat bubble
 * on every frontend page via wp_footer. The REST endpoint at flowbie/v1/chat
 * handles messages using RAG + three-phase sub-agent reasoning.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Chat {

	const OPTION_KEY     = 'flowbie_wp_chat_settings';
	const REST_NAMESPACE = 'flowbie/v1';

	/**
	 * Hook registrations.
	 */
	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_action( 'wp_footer', array( __CLASS__, 'maybe_render_widget' ), 100 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'maybe_enqueue_assets' ) );
		add_action( 'save_post', array( __CLASS__, 'on_post_save' ), 10, 0 );

		add_action( 'wp_ajax_flowbie_chat_stream', array( __CLASS__, 'ajax_chat_stream' ) );
		add_action( 'wp_ajax_nopriv_flowbie_chat_stream', array( __CLASS__, 'ajax_chat_stream' ) );
	}

	/**
	 * Whether the chat widget is enabled.
	 */
	public static function is_enabled(): bool {
		$settings = self::get_settings();
		return ! empty( $settings['enabled'] );
	}

	/**
	 * Get all chat settings with defaults.
	 *
	 * @return array{enabled:bool,welcome_message:string,color:string,position:string}
	 */
	public static function get_settings(): array {
		$defaults = array(
			'enabled'             => false,
			'welcome_message'     => __( 'Hi! Ask me anything about this website.', 'flowbie-wp' ),
			'color'               => '#3b82f6',
			'position'            => 'bottom-right',
			'assistant_name'      => 'Flow Assist',
			'system_prompt'       => '',
			'greeting_style'      => 'friendly',
			'knowledge_base'      => array(),
			'indexed_post_types'  => array( 'post', 'page' ),
			'excluded_categories' => array(),
			'full_content'        => false,
			'voice_enabled'       => true,
			'voice_ptt'           => true,
			'voice_ack'           => true,
			'voice_narrate'       => true,
			'mic_replaces_send'   => true,
		);

		$stored = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		return array_merge( $defaults, $stored );
	}

	/**
	 * Save chat settings.
	 *
	 * @param array $settings
	 */
	public static function save_settings( array $settings ): void {
		$current = self::get_settings();
		$merged  = array_merge( $current, $settings );
		update_option( self::OPTION_KEY, $merged );
	}

	/**
	 * Register REST route for chat messages.
	 */
	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/chat',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_chat' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * REST handler: process a chat message through the RAG + sub-agent pipeline.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function rest_chat( WP_REST_Request $request ): WP_REST_Response {
		if ( ! self::is_enabled() && ! current_user_can( 'manage_options' ) ) {
			return new WP_REST_Response(
				array( 'error' => __( 'Chat widget is not enabled.', 'flowbie-wp' ) ),
				403
			);
		}

		$api_key = Flowbie_Wp_OpenRouter::get_api_key();
		if ( $api_key === '' ) {
			return new WP_REST_Response(
				array( 'error' => __( 'AI is not configured. Please ask the site administrator to add an OpenRouter API key.', 'flowbie-wp' ) ),
				503
			);
		}

		$body    = $request->get_json_params();
		$message = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( $body['message'] ) ) : '';
		$history = isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array();
		$log_meta = Flowbie_Wp_Chat_Logs::parse_meta_from_body( is_array( $body ) ? $body : null );

		if ( trim( $message ) === '' ) {
			return new WP_REST_Response(
				array( 'error' => __( 'Message cannot be empty.', 'flowbie-wp' ) ),
				400
			);
		}

		$history = array_map(
			function ( $entry ) {
				return array(
					'role'    => isset( $entry['role'] ) ? sanitize_text_field( $entry['role'] ) : 'user',
					'content' => isset( $entry['content'] ) ? sanitize_textarea_field( $entry['content'] ) : '',
				);
			},
			array_slice( $history, -10 )
		);

		$site_name  = get_bloginfo( 'name' );
		$settings   = self::get_settings();
		$site_index = Flowbie_Wp_Chat_Rag::get_site_index( $settings );

		$training = array(
			'assistant_name' => $settings['assistant_name'],
			'system_prompt'  => $settings['system_prompt'],
			'greeting_style' => $settings['greeting_style'],
			'knowledge_base' => $settings['knowledge_base'],
		);

		Flowbie_Wp_Chat_Logs::log_user_message( $message, $log_meta );

		$card = Flowbie_Wp_Chat_Agents::run( $message, $history, $site_name, $site_index, $training );

		if ( is_array( $card ) ) {
			Flowbie_Wp_Chat_Logs::log_assistant_card( $card, $log_meta );
		}

		return new WP_REST_Response( $card, 200 );
	}

	/**
	 * Enqueue chat widget assets on the frontend when enabled.
	 */
	public static function maybe_enqueue_assets(): void {
		if ( is_admin() || ! self::is_enabled() ) {
			return;
		}

		$base = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/frontend/';
		$ver  = FLOWBIE_WP_VERSION;

		wp_enqueue_style(
			'flowbie-wp-lato',
			'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,600;0,700;1,400&display=swap',
			array(),
			null
		);

		wp_enqueue_style(
			'flowbie-chat-widget',
			$base . 'flowbie-chat-widget.css',
			array( 'flowbie-wp-lato' ),
			$ver
		);

		Flowbie_Wp_Voice::enqueue_thinking_card_assets();

		$settings       = self::get_settings();
		$voice_enabled  = ! empty( $settings['voice_enabled'] ) && Flowbie_Wp_OpenRouter::get_api_key() !== '';
		$widget_deps    = array( 'flowbie-thinking-card' );
		if ( $voice_enabled ) {
			Flowbie_Wp_Voice::enqueue_assets();
			$widget_deps[] = 'flowbie-voice';
		}

		wp_enqueue_script(
			'flowbie-chat-widget',
			$base . 'flowbie-chat-widget.js',
			$widget_deps,
			$ver,
			true
		);

		$design   = Flowbie_Wp_Ai_Widget_Design::get_settings();
		$tokens   = Flowbie_Wp_Ai_Widget_Design::resolve( 'chat' );
		$css_vars = Flowbie_Wp_Ai_Widget_Design::build_chat_css_vars( $tokens );

		wp_localize_script(
			'flowbie-chat-widget',
			'flowbieChatConfig',
			array(
				'restUrl'         => esc_url_raw( rest_url( self::REST_NAMESPACE . '/chat' ) ),
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'ajaxUrl'         => admin_url( 'admin-ajax.php' ),
				'streamNonce'     => wp_create_nonce( 'flowbie_chat_stream' ),
				'transcribeUrl'   => esc_url_raw( rest_url( Flowbie_Wp_Voice::REST_NAMESPACE . '/voice/transcribe' ) ),
				'ackUrl'          => esc_url_raw( rest_url( Flowbie_Wp_Voice::REST_NAMESPACE . '/voice/ack' ) ),
				'narrateUrl'      => esc_url_raw( rest_url( Flowbie_Wp_Voice::REST_NAMESPACE . '/voice/narrate' ) ),
				'siteName'        => get_bloginfo( 'name' ),
				'welcomeMessage'  => $settings['welcome_message'],
				'color'           => $settings['color'],
				'position'        => $settings['position'],
				'assistantName'   => $settings['assistant_name'],
				'cssVars'         => $css_vars,
				'ui'              => $design['chat_ui'],
				'voiceEnabled'    => $voice_enabled,
				'voicePtt'        => ! empty( $settings['voice_ptt'] ),
				'voiceAck'        => ! empty( $settings['voice_ack'] ),
				'voiceNarrate'    => ! empty( $settings['voice_narrate'] ),
				'micReplacesSend' => ! empty( $settings['mic_replaces_send'] ),
			)
		);
	}

	/**
	 * Render the widget mount point in the footer.
	 */
	public static function maybe_render_widget(): void {
		if ( is_admin() || ! self::is_enabled() ) {
			return;
		}

		echo '<div id="flowbie-chat-widget-root"></div>' . "\n";
	}

	/**
	 * Invalidate RAG cache when posts are saved.
	 */
	public static function on_post_save(): void {
		Flowbie_Wp_Chat_Rag::invalidate_cache();
	}

	/**
	 * AJAX streaming handler: runs the pipeline step-by-step, flushing
	 * NDJSON progress events so the frontend can show live status.
	 *
	 * Each line is a JSON object: {"status":"...","label":"..."} for progress,
	 * or {"status":"done","card":{...}} for the final result.
	 */
	public static function ajax_chat_stream(): void {
		check_ajax_referer( 'flowbie_chat_stream', '_nonce' );

		if ( ! self::is_enabled() && ! current_user_can( 'manage_options' ) ) {
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Disabled', 'body' => 'Chat widget is not enabled.', 'confidence' => 'low',
			) ) );
			wp_die();
		}

		$api_key = Flowbie_Wp_OpenRouter::get_api_key();
		if ( $api_key === '' ) {
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Not configured', 'body' => 'AI is not configured. Please add an OpenRouter API key.', 'confidence' => 'low',
			) ) );
			wp_die();
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$raw_body = file_get_contents( 'php://input' );
		$body     = json_decode( $raw_body, true );
		$message  = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( $body['message'] ) ) : '';
		$history  = isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array();
		$log_meta = Flowbie_Wp_Chat_Logs::parse_meta_from_body( is_array( $body ) ? $body : null );

		if ( trim( $message ) === '' ) {
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Empty message', 'body' => 'Message cannot be empty.', 'confidence' => 'low',
			) ) );
			wp_die();
		}

		Flowbie_Wp_Chat_Logs::log_user_message( $message, $log_meta );

		$history = array_map(
			function ( $entry ) {
				return array(
					'role'    => isset( $entry['role'] ) ? sanitize_text_field( $entry['role'] ) : 'user',
					'content' => isset( $entry['content'] ) ? sanitize_textarea_field( $entry['content'] ) : '',
				);
			},
			array_slice( $history, -10 )
		);

		$settings   = self::get_settings();
		$site_name  = get_bloginfo( 'name' );
		$site_index = Flowbie_Wp_Chat_Rag::get_site_index( $settings );

		$training = array(
			'assistant_name' => $settings['assistant_name'],
			'system_prompt'  => $settings['system_prompt'],
			'greeting_style' => $settings['greeting_style'],
			'knowledge_base' => $settings['knowledge_base'],
		);

		// -- Begin streaming headers --
		header( 'Content-Type: text/plain; charset=utf-8' );
		header( 'Cache-Control: no-cache' );
		header( 'X-Accel-Buffering: no' );
		if ( function_exists( 'apache_setenv' ) ) {
			apache_setenv( 'no-gzip', '1' ); // @codeCoverageIgnore
		}
		while ( ob_get_level() ) {
			ob_end_flush();
		}

		// -- Phase A: classify --
		self::stream_line( array( 'status' => 'searching', 'label' => 'Searching content…' ) );

		$phase_a = Flowbie_Wp_Chat_Agents::phase_classify( $message, $site_name, $site_index );
		if ( is_wp_error( $phase_a ) ) {
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Something went wrong', 'body' => $phase_a->get_error_message(), 'confidence' => 'low',
			) ) );
			wp_die();
		}

		$relevant_items = Flowbie_Wp_Chat_Agents::select_relevant_items( $phase_a, $site_index );

		// -- Deep-read: fetch full page content for top matches --
		$enriched_items = self::enrich_with_full_content( $relevant_items, 3 );

		// -- Phase B: reason --
		self::stream_line( array( 'status' => 'thinking', 'label' => 'Thinking…' ) );

		$phase_b = Flowbie_Wp_Chat_Agents::phase_reason( $message, $history, $site_name, $enriched_items, $phase_a, $training );
		if ( is_wp_error( $phase_b ) ) {
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Something went wrong', 'body' => $phase_b->get_error_message(), 'confidence' => 'low',
			) ) );
			wp_die();
		}

		// -- Phase C: format --
		self::stream_line( array( 'status' => 'formatting', 'label' => 'Formatting response…' ) );

		$phase_c = Flowbie_Wp_Chat_Agents::phase_format( $phase_b, $phase_a );
		if ( is_wp_error( $phase_c ) ) {
			$links = array();
			foreach ( array_slice( $enriched_items, 0, 3 ) as $fb ) {
				$links[] = array(
					'label' => $fb['title'],
					'url'   => $fb['url'],
					'icon'  => $fb['type'] === 'post' ? 'post' : 'page',
				);
			}
			$phase_c = array(
				'type'       => 'answer',
				'title'      => 'Here\'s what I found',
				'body'       => $phase_b,
				'links'      => $links,
				'confidence' => 'medium',
			);
		}

		if ( is_array( $phase_c ) ) {
			Flowbie_Wp_Chat_Logs::log_assistant_card( $phase_c, $log_meta );
		}

		self::stream_line( array( 'status' => 'done', 'card' => $phase_c ) );
		wp_die();
	}

	/**
	 * Flush a single NDJSON line to the output stream.
	 *
	 * @param array $data JSON-serialisable payload.
	 */
	private static function stream_line( array $data ): void {
		echo wp_json_encode( $data ) . "\n";
		if ( ob_get_level() ) {
			ob_flush();
		}
		flush();
	}

	/**
	 * Fetch full post content for the top N relevant items so the LLM
	 * can answer detail questions that short excerpts would miss.
	 *
	 * Streams a "Reading [Title]..." event for each page fetched.
	 *
	 * @param array $items Relevant items from select_relevant_items().
	 * @param int   $limit Max pages to deep-read (default 3).
	 * @return array Items with excerpt replaced by full content for the top $limit.
	 */
	private static function enrich_with_full_content( array $items, int $limit = 3 ): array {
		$count = 0;
		foreach ( $items as $i => $item ) {
			if ( $count >= $limit ) {
				break;
			}

			$post = get_post( $item['id'] );
			if ( ! $post || $post->post_status !== 'publish' ) {
				continue;
			}

			self::stream_line( array(
				'status' => 'reading',
				'label'  => 'Reading ' . $item['title'] . '…',
			) );

			$full = wp_strip_all_tags( $post->post_content );
			$full = wp_trim_words( $full, 2000, '' );

			$items[ $i ]['excerpt'] = $full;
			$count++;
		}

		return $items;
	}
}
