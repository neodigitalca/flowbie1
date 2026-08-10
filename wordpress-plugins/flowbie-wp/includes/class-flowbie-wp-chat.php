<?php
/**
 * Flowbie Chat Widget: frontend injection and REST API.
 *
 * When enabled in Settings > Chat Widget, injects a chat panel host in wp_footer
 * that merges with the AI Search magnifying-glass sidebar. The REST endpoint at
 * flowbie/v1/chat handles messages using RAG + three-phase sub-agent reasoning.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Chat {

	const OPTION_KEY              = 'flowbie_wp_chat_settings';
	const REST_NAMESPACE          = 'flowbie/v1';
	const PREFETCH_TRANSIENT_PREFIX = 'flowbie_chat_pf_';
	const PREFETCH_TTL            = 60;
	const RESPONSE_PREFETCH_TTL   = 120;

	/**
	 * Hook registrations.
	 */
	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_action( 'wp_head', array( __CLASS__, 'render_mobile_guard_script' ), 0 );
		add_action( 'wp_head', array( __CLASS__, 'render_mobile_launcher_critical_css' ), 1 );
		add_action( 'wp_footer', array( __CLASS__, 'maybe_render_widget' ), 1 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'maybe_enqueue_assets' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'maybe_enqueue_assets' ) );
		add_action( 'admin_footer', array( __CLASS__, 'maybe_render_widget' ), 1 );
		add_action( 'wp_footer', array( __CLASS__, 'render_mobile_launcher_force_css' ), 99999 );
		add_action( 'save_post', array( __CLASS__, 'on_post_save' ), 10, 0 );

		add_action( 'wp_ajax_flowbie_chat_stream', array( __CLASS__, 'ajax_chat_stream' ) );
		add_action( 'wp_ajax_nopriv_flowbie_chat_stream', array( __CLASS__, 'ajax_chat_stream' ) );
		add_action( 'wp_ajax_flowbie_chat_prefetch', array( __CLASS__, 'ajax_chat_prefetch' ) );
		add_action( 'wp_ajax_nopriv_flowbie_chat_prefetch', array( __CLASS__, 'ajax_chat_prefetch' ) );
		add_action( 'wp_ajax_flowbie_chat_ack_prefetch', array( __CLASS__, 'ajax_chat_ack_prefetch' ) );
		add_action( 'wp_ajax_nopriv_flowbie_chat_ack_prefetch', array( __CLASS__, 'ajax_chat_ack_prefetch' ) );
		add_action( 'wp_ajax_flowbie_chat_response_prefetch', array( __CLASS__, 'ajax_chat_response_prefetch' ) );
		add_action( 'wp_ajax_nopriv_flowbie_chat_response_prefetch', array( __CLASS__, 'ajax_chat_response_prefetch' ) );
		add_action( 'wp_ajax_flowbie_chat_page_context', array( __CLASS__, 'ajax_chat_page_context' ) );
		add_action( 'wp_ajax_nopriv_flowbie_chat_page_context', array( __CLASS__, 'ajax_chat_page_context' ) );
	}

	/**
	 * Whether the chat widget is enabled.
	 */
	public static function is_enabled(): bool {
		$stored = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $stored ) || ! array_key_exists( 'enabled', $stored ) ) {
			return false;
		}
		return ! empty( $stored['enabled'] );
	}

	/**
	 * Whether the chat widget should load for the current frontend visitor.
	 * When logged_in_only is set, guests do not see the widget or receive chat API access.
	 */
	public static function should_show_for_visitor(): bool {
		if ( ! self::is_enabled() ) {
			return false;
		}
		$settings = self::get_settings();
		if ( ! empty( $settings['logged_in_only'] ) && ! is_user_logged_in() ) {
			return false;
		}
		return true;
	}

	/**
	 * Whether the chat sidebar should load on the current screen (frontend or wp-admin).
	 */
	public static function should_show_on_current_screen(): bool {
		if ( ! self::is_enabled() && ! current_user_can( 'manage_options' ) ) {
			return false;
		}
		if ( is_admin() ) {
			return is_user_logged_in();
		}
		return self::should_show_for_visitor();
	}

	/**
	 * Whether chat API endpoints (stream, prefetch) may run for this request.
	 */
	public static function can_use_chat_api(): bool {
		if ( ! self::is_enabled() && ! current_user_can( 'manage_options' ) ) {
			return false;
		}
		if ( is_user_logged_in() ) {
			return true;
		}
		return self::should_show_for_visitor();
	}

	/**
	 * Get all chat settings with defaults.
	 *
	 * @return array{enabled:bool,welcome_message:string,color:string}
	 */
	public static function get_settings(): array {
		$defaults = array(
			'enabled'             => false,
			'logged_in_only'        => false,
			'welcome_message'     => __( 'Hi! Ask me anything about this website.', 'flowbie-wp' ),
			'color'               => '#3b82f6',
			'assistant_name'      => 'Flow Assist',
			'system_prompt'       => '',
			'greeting_style'      => 'friendly',
			'knowledge_base'      => array(),
			'indexed_post_types'  => array( 'post', 'page' ),
			'excluded_categories' => array(),
			'full_content'        => false,
			'voice_enabled'       => true,
			'voice_ptt'           => true,
			'mic_replaces_send'   => true,
			'lead_conversion_enabled' => true,
			'lead_forms'          => array(
				'booking' => 0,
				'contact' => 0,
				'pricing' => 0,
			),
			'chekkit_enabled'        => true,
			'chekkit_teaser_enabled' => true,
			'chekkit_cta_label'      => __( 'Send Us A Text', 'flowbie-wp' ),
			'chekkit_event_type'     => 'contact_request',
			'chekkit_webhook_url'    => Flowbie_Wp_Chekkit::DEFAULT_WEBHOOK_URL,
		);

		$stored = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$merged = array_merge( $defaults, $stored );
		if ( isset( $merged['chekkit_cta_label'] ) && trim( (string) $merged['chekkit_cta_label'] ) === 'Talk To A Human' ) {
			$merged['chekkit_cta_label'] = __( 'Send Us A Text', 'flowbie-wp' );
		}
		$sidebar = Flowbie_Wp_Ai_Widget_Design::resolve_sidebar_config( 'chat', $stored );

		return array_merge( $merged, $sidebar );
	}

	/**
	 * Context-aware conversation starters for the empty state.
	 *
	 * @param array<string,mixed> $settings
	 * @return array<int, string>
	 */
	public static function conversation_starters( array $settings = array() ): array {
		return Flowbie_Wp_Chat_Starters::get( $settings );
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

		register_rest_route(
			self::REST_NAMESPACE,
			'/chat/accept',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_chat_accept' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/chat/site-inventory',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'rest_site_inventory' ),
				'permission_callback' => array( __CLASS__, 'can_access_site_inventory' ),
			)
		);
	}

	/**
	 * @return bool
	 */
	public static function can_access_site_inventory(): bool {
		return is_user_logged_in() && current_user_can( 'edit_posts' );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_site_inventory( WP_REST_Request $request ): WP_REST_Response {
		$include_drafts = rest_sanitize_boolean( $request->get_param( 'include_drafts' ) );
		$format         = sanitize_key( (string) $request->get_param( 'format' ) );

		if ( $format === 'csv' ) {
			$csv      = Flowbie_Wp_Site_Inventory::build_csv( $include_drafts );
			$response = new WP_REST_Response( $csv, 200 );
			$response->header( 'Content-Type', 'text/csv; charset=utf-8' );
			$response->header( 'Content-Disposition', 'attachment; filename=' . Flowbie_Wp_Site_Inventory::download_filename() );
			return $response;
		}

		Flowbie_Wp_Site_Inventory::warm( $include_drafts );
		$meta = Flowbie_Wp_Site_Inventory::get_meta();

		return new WP_REST_Response(
			array(
				'ok'        => true,
				'count'     => (int) ( $meta['count'] ?? 0 ),
				'by_type'   => isset( $meta['by_type'] ) && is_array( $meta['by_type'] ) ? $meta['by_type'] : array(),
				'cached_at' => (int) ( $meta['cached_at'] ?? 0 ),
			),
			200
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
		if ( ! self::can_use_chat_api() ) {
			return new WP_REST_Response(
				array( 'error' => __( 'Chat is available to logged-in users only.', 'flowbie-wp' ) ),
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

		$history = Flowbie_Wp_Chat_History::normalize( $history );

		$site_name  = get_bloginfo( 'name' );
		$settings   = self::get_settings();
		$site_index = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
		$page_context = self::parse_page_context_from_body( is_array( $body ) ? $body : null, $settings );

		$training = array(
			'assistant_name' => $settings['assistant_name'],
			'system_prompt'  => $settings['system_prompt'],
			'greeting_style' => $settings['greeting_style'],
			'knowledge_base' => $settings['knowledge_base'],
		);

		$log_meta = self::enrich_log_meta_for_message( $log_meta, $message, $page_context, $settings );
		Flowbie_Wp_Chat_Logs::log_user_message( $message, $log_meta );

		$card = Flowbie_Wp_Chat_Agents::run( $message, $history, $site_name, $site_index, $training, $settings, $page_context );

		if ( is_array( $card ) ) {
			$message_uid = Flowbie_Wp_Chat_Logs::log_assistant_card( $card, $log_meta );
			if ( $message_uid !== '' ) {
				$card['message_uid'] = $message_uid;
			}
		}

		return new WP_REST_Response( $card, 200 );
	}

	/**
	 * REST handler: record accepted answer click.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_chat_accept( WP_REST_Request $request ): WP_REST_Response {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = array();
		}

		$result = Flowbie_Wp_Chat_Logs::record_accept(
			array(
				'message_uid' => isset( $body['messageId'] ) ? (string) $body['messageId'] : '',
				'url'         => isset( $body['url'] ) ? (string) $body['url'] : '',
				'label'       => isset( $body['label'] ) ? (string) $body['label'] : '',
				'type'        => isset( $body['type'] ) ? (string) $body['type'] : 'link',
			)
		);

		if ( empty( $result['ok'] ) ) {
			$status = ( isset( $result['error'] ) && $result['error'] === 'logging_disabled' ) ? 200 : 400;
			return new WP_REST_Response( $result, $status );
		}

		return new WP_REST_Response( array( 'ok' => true ), 200 );
	}

	/**
	 * Enqueue chat widget assets on the frontend when enabled.
	 */
	public static function maybe_enqueue_assets(): void {
		if ( ! self::should_show_on_current_screen() ) {
			return;
		}

		$base = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/frontend/';
		$ver  = FLOWBIE_WP_VERSION;
		$widget_css = FLOWBIE_WP_PLUGIN_DIR . 'assets/frontend/flowbie-chat-widget.css';
		$widget_js  = FLOWBIE_WP_PLUGIN_DIR . 'assets/frontend/flowbie-chat-widget.js';
		if ( is_readable( $widget_css ) ) {
			$ver .= '.' . (string) filemtime( $widget_css );
		}
		$widget_js_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $widget_js ) ) {
			$widget_js_ver .= '.' . (string) filemtime( $widget_js );
		}
		$in_admin = is_admin();

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

		$shared_base   = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/shared/';
		$build_js_path = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-build-harness.js';
		$build_css_path = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-build-harness.css';
		$build_ver     = FLOWBIE_WP_VERSION;
		if ( is_readable( $build_js_path ) ) {
			$build_ver .= '.' . (string) filemtime( $build_js_path );
		}
		if ( ! wp_style_is( 'flowbie-build-harness', 'registered' ) ) {
			wp_register_style(
				'flowbie-build-harness',
				$shared_base . 'flowbie-build-harness.css',
				array( 'flowbie-chat-widget' ),
				is_readable( $build_css_path ) ? $build_ver : FLOWBIE_WP_VERSION
			);
		}
		wp_enqueue_style( 'flowbie-build-harness' );
		if ( ! wp_script_is( 'flowbie-build-harness', 'registered' ) ) {
			wp_register_script(
				'flowbie-build-harness',
				$shared_base . 'flowbie-build-harness.js',
				array( 'flowbie-thinking-card' ),
				$build_ver,
				true
			);
		}
		wp_enqueue_script( 'flowbie-build-harness' );

		if ( class_exists( 'Flowbie_Wp_Forms' ) ) {
			Flowbie_Wp_Forms::enqueue_frontend_assets();
		}

		Flowbie_Wp_Search::register_sidebar_assets();

		$mobile = ! $in_admin && wp_is_mobile();
		wp_enqueue_style( 'flowbie-ai-sidebar-shell' );
		if ( ! $mobile ) {
			wp_enqueue_style( 'flowbie-ai-sidebar-unify' );
		}

		wp_enqueue_style(
			'flowbie-chat-chrome',
			$base . 'flowbie-chat-chrome.css',
			$mobile ? array( 'flowbie-chat-widget' ) : array( 'flowbie-chat-widget', 'flowbie-ai-sidebar-unify' ),
			$ver
		);

		wp_enqueue_style(
			'flowbie-chat-mobile',
			$base . 'flowbie-chat-mobile.css',
			array( 'flowbie-chat-chrome' ),
			$ver
		);

		wp_add_inline_style( 'flowbie-chat-mobile', self::mobile_launcher_force_css() );

		if ( $in_admin ) {
			wp_add_inline_style(
				'flowbie-chat-widget',
				'body.wp-admin .flowbie-chat-widget{z-index:100000!important}'
				. 'body.wp-admin .fcw-mobile-launcher{z-index:100000!important}'
			);
		}

		$settings       = self::get_settings();
		$chekkit_enabled = ! isset( $settings['chekkit_enabled'] ) || ! empty( $settings['chekkit_enabled'] );
		$chekkit_teaser  = $chekkit_enabled && ( ! isset( $settings['chekkit_teaser_enabled'] ) || ! empty( $settings['chekkit_teaser_enabled'] ) );
		if ( $chekkit_teaser ) {
			wp_add_inline_style( 'flowbie-chat-widget', self::chekkit_teaser_force_css() );
		}

		$voice_enabled  = ! empty( $settings['voice_enabled'] ) && Flowbie_Wp_OpenRouter::get_api_key() !== '';
		$widget_deps    = array( 'flowbie-thinking-card', 'flowbie-chat-stream', 'flowbie-chat-prefetch', 'flowbie-chat-debug-log', 'flowbie-display-text', 'flowbie-markdown', 'flowbie-build-harness' );
		if ( class_exists( 'Flowbie_Wp_Forms' ) ) {
			$widget_deps[] = 'flowbie-forms';
		}
		if ( $voice_enabled ) {
			Flowbie_Wp_Voice::enqueue_assets();
			$widget_deps[] = 'flowbie-voice';
		}
		wp_enqueue_script( 'flowbie-ai-sidebar-shell' );
		wp_enqueue_script( 'flowbie-ai-sidebar-unify' );
		$widget_deps[] = 'flowbie-ai-sidebar-shell';
		$widget_deps[] = 'flowbie-ai-sidebar-unify';

		wp_enqueue_script(
			'flowbie-chat-widget',
			$base . 'flowbie-chat-widget.js',
			$widget_deps,
			$widget_js_ver,
			true
		);

		if ( is_user_logged_in() ) {
			$backend_starters = wp_json_encode( Flowbie_Wp_Chat_Super_Admin::get_backend_starters() );
			wp_add_inline_script(
				'flowbie-chat-widget',
				'window.flowbieChatConfig=window.flowbieChatConfig||{};'
				. 'window.flowbieChatConfig.canCopyLog=true;'
				. 'window.flowbieChatConfig.canBackendMode=true;'
				. 'window.flowbieChatConfig.isLoggedIn=true;'
				. 'window.flowbieChatConfig.backendStarters=' . $backend_starters . ';',
				'before'
			);
		}

		$design   = Flowbie_Wp_Ai_Widget_Design::get_settings();
		$tokens   = Flowbie_Wp_Ai_Widget_Design::resolve( 'chat' );
		$css_vars = Flowbie_Wp_Ai_Widget_Design::build_chat_css_vars( $tokens );
		$css_vars .= Flowbie_Wp_Ai_Widget_Design::build_sidebar_css_vars( $settings, $tokens );

		$launcher_label   = isset( $settings['launcher_label'] ) ? trim( (string) $settings['launcher_label'] ) : '';
		if ( $launcher_label === '' ) {
			$launcher_label = sprintf(
				/* translators: %s: assistant display name */
				__( 'Open %s', 'flowbie-wp' ),
				(string) $settings['assistant_name']
			);
		}

		$assistant_name = (string) $settings['assistant_name'];
		$site_name      = get_bloginfo( 'name' );
		$page_context   = Flowbie_Wp_Chat_Page_Context::for_localize_script();
		$starters       = self::conversation_starters( $settings );
		if ( ! empty( $page_context['postId'] ) ) {
			array_unshift( $starters, __( 'Summarize this page', 'flowbie-wp' ) );
			$starters = array_slice( array_values( array_unique( $starters ) ), 0, 3 );
		}
		if ( ! empty( $page_context['postId'] ) && ! empty( $page_context['typeLabel'] ) ) {
			$composer_placeholder = sprintf(
				/* translators: %s: page type label, e.g. blog post */
				__( 'Ask about this %s…', 'flowbie-wp' ),
				(string) $page_context['typeLabel']
			);
		} elseif ( ! empty( $page_context['postId'] ) ) {
			$composer_placeholder = __( 'Ask about this page…', 'flowbie-wp' );
		} else {
			$composer_placeholder = sprintf(
				/* translators: %s: site name */
				__( 'Ask about %s…', 'flowbie-wp' ),
				$site_name
			);
		}

		$chekkit_enabled = ! isset( $settings['chekkit_enabled'] ) || ! empty( $settings['chekkit_enabled'] );
		$config          = array(
			'restUrl'                => esc_url_raw( rest_url( self::REST_NAMESPACE . '/chat' ) ),
			'acceptUrl'              => esc_url_raw( rest_url( self::REST_NAMESPACE . '/chat/accept' ) ),
			'nonce'                  => wp_create_nonce( 'wp_rest' ),
			'ajaxUrl'                => admin_url( 'admin-ajax.php' ),
			'streamNonce'            => wp_create_nonce( 'flowbie_chat_stream' ),
			'transcribeUrl'          => esc_url_raw( rest_url( Flowbie_Wp_Voice::REST_NAMESPACE . '/voice/transcribe' ) ),
			'siteName'               => $site_name,
			'welcomeMessage'         => $settings['welcome_message'],
			'color'                  => $settings['color'],
			'assistantName'          => $assistant_name,
			'greetingStyle'          => isset( $settings['greeting_style'] ) ? (string) $settings['greeting_style'] : 'friendly',
			'cssVars'                => $css_vars,
			'ui'                     => $design['chat_ui'],
			'voiceEnabled'           => $voice_enabled,
			'voicePtt'               => ! empty( $settings['voice_ptt'] ),
			'micReplacesSend'        => ! empty( $settings['mic_replaces_send'] ),
			'sidebarSide'            => (string) ( $settings['sidebar_side'] ?? 'right' ),
			'sidebarTransition'      => (string) ( $settings['sidebar_transition'] ?? 'slide' ),
			'sidebarWidth'           => (int) ( $settings['sidebar_width'] ?? 400 ),
			'sidebarHeading'         => (string) ( $settings['sidebar_heading'] ?? '' ),
			'sidebarLayout'          => isset( $settings['sidebar_layout'] ) && is_array( $settings['sidebar_layout'] )
				? $settings['sidebar_layout']
				: array( 'chat' ),
			'launcherLabel'          => $launcher_label,
			'greetingLine'           => __( 'Hello', 'flowbie-wp' ),
			'greetingSubline'        => __( 'How can I help you today?', 'flowbie-wp' ),
			'conversationStarters'   => $starters,
			'composerPlaceholder'    => $composer_placeholder,
			'pageContext'            => $page_context,
			'chekkitEnabled'         => $chekkit_enabled,
			'chekkitSubmitUrl'       => esc_url_raw( rest_url( self::REST_NAMESPACE . '/chekkit/contact' ) ),
			'chekkitCtaLabel'        => isset( $settings['chekkit_cta_label'] ) && trim( (string) $settings['chekkit_cta_label'] ) !== ''
				? (string) $settings['chekkit_cta_label']
				: __( 'Send Us A Text', 'flowbie-wp' ),
			'chekkitTeaserEnabled'   => $chekkit_enabled && ( ! isset( $settings['chekkit_teaser_enabled'] ) || ! empty( $settings['chekkit_teaser_enabled'] ) ),
			'chekkitTeaserAvatarUrl' => esc_url_raw( plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/frontend/chekkit-teaser-avatar.png' ),
			'canCopyLog'             => is_user_logged_in(),
			'isLoggedIn'             => is_user_logged_in(),
			'canBackendMode'         => is_user_logged_in(),
			'canAnalytics'           => current_user_can( 'manage_options' ),
			'canEditContent'         => current_user_can( 'edit_posts' ),
			'backendStarters'        => is_user_logged_in() ? Flowbie_Wp_Chat_Super_Admin::get_backend_starters() : array(),
			'backendAssistUrl'       => esc_url_raw( rest_url( self::REST_NAMESPACE . '/backend-assist' ) ),
			'backendAssistUndoUrl'   => esc_url_raw( rest_url( self::REST_NAMESPACE . '/backend-assist/undo' ) ),
			'isWpAdmin'              => $in_admin,
			'defaultAdminMode'       => $in_admin ? 'backend' : 'visitor',
			'currentUserId'          => is_user_logged_in() ? get_current_user_id() : 0,
		);
		if ( is_user_logged_in() && current_user_can( 'edit_posts' ) ) {
			$config['siteInventoryUrl']    = esc_url_raw( rest_url( self::REST_NAMESPACE . '/chat/site-inventory' ) );
			$config['siteInventoryCsvUrl'] = esc_url_raw( rest_url( self::REST_NAMESPACE . '/chat/site-inventory?format=csv&include_drafts=1' ) );
		}
		if ( $chekkit_enabled ) {
			$config['contactInfo'] = Flowbie_Wp_Chat_Lead::get_widget_contact_facts( $settings );
		}

		wp_localize_script(
			'flowbie-chat-widget',
			'flowbieChatConfig',
			$config
		);
	}

	/**
	 * Mobile CSS: zero-size fixed root, no off-screen panel translate (prevents horizontal scroll/CLS).
	 */
	private static function mobile_launcher_force_css(): string {
		return '@media (max-width:767px){'
			. 'html,body{overflow-x:hidden!important;max-width:100%!important;width:100%!important;position:relative!important}'
			. '#flowbie-chat-mobile-launcher[hidden],.fcw-mobile-launcher[hidden],body:has(#flowbie-chat-widget-root.fai-sidebar-root--open) #flowbie-chat-mobile-launcher{display:none!important;visibility:hidden!important;pointer-events:none!important}'
			. '#flowbie-chat-mobile-launcher,.fcw-mobile-launcher{position:fixed!important;bottom:20px!important;right:16px!important;left:auto!important;width:56px!important;height:56px!important;z-index:999900!important;pointer-events:auto!important;margin:0!important;padding:0!important;border:0!important;border-radius:50%!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;transform:none!important;box-sizing:border-box!important}'
			. '#flowbie-chat-widget-root[hidden],#flowbie-chat-widget-root.fcw-mobile-root-closed:not(.fai-sidebar-root--open){display:none!important;visibility:hidden!important;position:absolute!important;left:-9999px!important;top:auto!important;width:0!important;height:0!important;max-width:0!important;overflow:hidden!important;pointer-events:none!important;margin:0!important;padding:0!important;border:0!important}'
			. '.fai-sidebar-panel[hidden],.fai-sidebar-backdrop[hidden]{display:none!important;visibility:hidden!important;pointer-events:none!important;transform:none!important}'
			. 'html body #flowbie-chat-widget-root.flowbie-chat-widget:not(.fai-sidebar-root--open){display:none!important;visibility:hidden!important;position:absolute!important;left:-9999px!important;width:0!important;height:0!important;max-width:0!important;overflow:hidden!important;pointer-events:none!important}'
			. 'html body #flowbie-chat-widget-root.flowbie-chat-widget.fai-sidebar-root--open{position:fixed!important;inset:0!important;width:auto!important;height:auto!important;max-width:none!important;overflow:visible!important;pointer-events:none!important;z-index:999950!important;display:block!important;visibility:visible!important;left:0!important}'
			. 'html body #flowbie-chat-widget-root.flowbie-chat-widget.fai-sidebar-root--open .fai-sidebar-panel:not([hidden]){display:flex!important;visibility:visible!important;pointer-events:auto!important;z-index:999960!important;position:fixed!important;inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:100%!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;transform:none!important;border:none!important;border-radius:0!important;box-shadow:none!important}'
			. 'html body #flowbie-chat-widget-root.flowbie-chat-widget.fai-sidebar-root--open .fai-sidebar-backdrop:not([hidden]){pointer-events:auto!important;z-index:999955!important}'
			. '.fcw-contact-human__overlay:not([hidden]){z-index:999999!important}'
			. '}';
	}

	/**
	 * Force Chekkit teaser colors over aggressive theme button styles.
	 */
	private static function chekkit_teaser_force_css(): string {
		return 'html body .fcw-chekkit-teaser__card{background:#ffffff!important;color:#111111!important;border:none!important;box-shadow:0 4px 24px rgba(0,0,0,0.14)!important}'
			. 'html body .fcw-chekkit-teaser__card:hover{background:#ffffff!important;color:#111111!important}'
			. 'html body .fcw-chekkit-teaser__line{color:#111111!important}'
			. 'html body button.fcw-chekkit-teaser__dismiss{background:#ffffff!important;color:#666666!important;border:none!important}'
			. 'html body .fcw-launcher--chekkit,html body #flowbie-chat-mobile-launcher.fcw-launcher--chekkit{background:#d8005f!important;color:#ffffff!important;border:none!important}';
	}

	/**
	 * Immediate mobile overflow guard (runs before CSS).
	 */
	public static function render_mobile_guard_script(): void {
		if ( is_admin() || ! self::should_show_on_current_screen() ) {
			return;
		}
		echo "<script id=\"flowbie-chat-mobile-guard\">!function(){try{if(!window.matchMedia||!window.matchMedia('(max-width:767px)').matches)return;var d=document.documentElement,b=document.body;d.style.overflowX='hidden';d.style.maxWidth='100%';d.style.width='100%';if(b){b.style.overflowX='hidden';b.style.maxWidth='100%';b.style.width='100%';}var w=document.getElementById('flowbie-chat-widget-root');if(w){w.style.display='none';w.style.visibility='hidden';w.style.position='absolute';w.style.left='-9999px';w.style.width='0';w.style.height='0';w.style.overflow='hidden';w.classList.add('fcw-mobile-root-closed');}var l=document.getElementById('flowbie-chat-mobile-launcher');if(l){l.style.zIndex='999900';l.style.position='fixed';l.style.right='16px';l.style.bottom='20px';}}catch(e){}}();</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Critical mobile CSS in head (before stylesheets) so closed panel never widens the page.
	 */
	public static function render_mobile_launcher_critical_css(): void {
		if ( is_admin() || ! self::should_show_on_current_screen() ) {
			return;
		}
		echo '<style id="flowbie-chat-mobile-critical">' . self::mobile_launcher_force_css() . '</style>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Last-resort mobile launcher CSS in footer (after theme styles).
	 */
	public static function render_mobile_launcher_force_css(): void {
		if ( is_admin() || ! self::should_show_on_current_screen() ) {
			return;
		}
		echo '<style id="flowbie-chat-mobile-force">' . self::mobile_launcher_force_css() . '</style>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Render the widget mount point in the footer.
	 */
	public static function maybe_render_widget(): void {
		if ( ! self::should_show_on_current_screen() ) {
			return;
		}

		$in_admin         = is_admin();
		$settings         = self::get_settings();
		$side             = ( isset( $settings['sidebar_side'] ) && 'left' === $settings['sidebar_side'] ) ? 'left' : 'right';
		$transition       = isset( $settings['sidebar_transition'] ) ? (string) $settings['sidebar_transition'] : 'slide';
		if ( ! in_array( $transition, array( 'slide', 'fade', 'none' ), true ) ) {
			$transition = 'slide';
		}
		$tokens           = Flowbie_Wp_Ai_Widget_Design::resolve( 'chat' );
		$css_vars         = Flowbie_Wp_Ai_Widget_Design::build_chat_css_vars( $tokens );
		$css_vars        .= Flowbie_Wp_Ai_Widget_Design::build_sidebar_css_vars( $settings, $tokens );
		$launcher_label   = isset( $settings['launcher_label'] ) ? trim( (string) $settings['launcher_label'] ) : '';
		if ( $launcher_label === '' ) {
			$launcher_label = sprintf(
				/* translators: %s: assistant display name */
				__( 'Open %s', 'flowbie-wp' ),
				isset( $settings['assistant_name'] ) ? (string) $settings['assistant_name'] : 'Flow Assist'
			);
		}
		$launcher_svg = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
		$launcher_bg  = (string) ( $tokens['launcher_bg'] ?? $tokens['accent'] ?? '#9EAF43' );

		printf(
			'<button type="button" id="flowbie-chat-mobile-launcher" class="fcw-mobile-launcher fai-sidebar-launcher fcw-launcher" data-fcw-chat-launcher="1" aria-label="%1$s" aria-expanded="false" aria-controls="flowbie-chat-widget-root" style="position:fixed;bottom:20px;right:16px;width:56px;height:56px;z-index:999900;pointer-events:auto;margin:0;padding:0;border:0;border-radius:50%%;display:inline-flex;align-items:center;justify-content:center;background:%2$s;color:#ffffff;box-shadow:0 4px 24px rgba(0,0,0,0.12);">%3$s</button>' . "\n",
			esc_attr( $launcher_label ),
			esc_attr( $launcher_bg ),
			$launcher_svg // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		);
		printf(
			'<div id="flowbie-chat-widget-root" class="flowbie-chat-widget flowbie-chat--sidebar flowbie-chat--standalone-launcher fcw-mobile-root-closed fai-sidebar-root fai-sidebar-root--%1$s fai-sidebar-root--transition-%2$s" data-fcw-chat-root="1" aria-hidden="true" hidden style="display:none!important;%3$s"></div>' . "\n",
			esc_attr( $side ),
			esc_attr( $transition ),
			esc_attr( $css_vars )
		);
		if ( ! $in_admin ) {
			echo '<style id="flowbie-chat-mobile-inline">' . self::mobile_launcher_force_css() . '</style>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
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
			self::begin_stream_response();
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Disabled', 'body' => 'Chat widget is not enabled.', 'confidence' => 'low',
			) ) );
			wp_die();
		}
		if ( ! self::can_use_chat_api() ) {
			self::begin_stream_response();
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Login required', 'body' => 'Chat is available to logged-in users only.', 'confidence' => 'low',
			) ) );
			wp_die();
		}

		$api_key = Flowbie_Wp_OpenRouter::get_api_key();
		if ( $api_key === '' ) {
			self::begin_stream_response();
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

		if ( Flowbie_Wp_Chat_Super_Admin::is_backend_mode_request( is_array( $body ) ? $body : null ) ) {
			$history = Flowbie_Wp_Chat_History::normalize( $history );
			Flowbie_Wp_Chat_Super_Admin::stream_pipeline( $message, $history, is_array( $body ) ? $body : null );
			return;
		}

		$log_meta = Flowbie_Wp_Chat_Logs::parse_meta_from_body( is_array( $body ) ? $body : null );

		self::begin_stream_response();

		if ( trim( $message ) === '' ) {
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Empty message', 'body' => 'Message cannot be empty.', 'confidence' => 'low',
			) ) );
			wp_die();
		}

		$history  = Flowbie_Wp_Chat_History::normalize( $history );
		$settings = self::get_settings();
		$page_context = self::parse_page_context_from_body( is_array( $body ) ? $body : null, $settings );
		$site_name = get_bloginfo( 'name' );
		$training = array(
			'assistant_name' => $settings['assistant_name'],
			'system_prompt'  => $settings['system_prompt'],
			'greeting_style' => $settings['greeting_style'],
			'knowledge_base' => $settings['knowledge_base'],
		);

		$prefetch_key = isset( $body['prefetch_key'] ) ? sanitize_text_field( wp_unslash( (string) $body['prefetch_key'] ) ) : '';
		$prefetched   = self::load_prefetch_payload( $prefetch_key, $message, $history );

		if ( is_array( $prefetched ) && ! empty( $prefetched['card'] ) && is_array( $prefetched['card'] ) ) {
			self::stream_prefetched_card( $message, $prefetched, $log_meta, $settings, $history, $page_context );
			wp_die();
		}

		// -- Secretary gate (instant, before RAG / site index) --
		$gate = is_array( $prefetched ) && isset( $prefetched['ack'] ) && is_array( $prefetched['ack'] )
			? $prefetched['ack']
			: Flowbie_Wp_Chat_Agents::phase_ack( $message, $site_name, $training, $history, $settings );
		if ( is_wp_error( $gate ) ) {
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Something went wrong', 'body' => $gate->get_error_message(), 'confidence' => 'low',
			) ) );
			wp_die();
		}

		if ( is_array( $gate ) && trim( (string) ( $gate['text'] ?? '' ) ) !== '' ) {
			self::stream_line( array( 'status' => 'ack', 'text' => trim( (string) $gate['text'] ) ) );
		}

		Flowbie_Wp_Chat_Logs::log_user_message( $message, self::enrich_log_meta_for_message( $log_meta, $message, $page_context, $settings ) );

		if ( is_array( $gate ) && ( $gate['action'] ?? '' ) === 'deny' ) {
			$site_index = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
			$denial = Flowbie_Wp_Chat_Agents::build_denial_card(
				(string) ( $gate['text'] ?? '' ),
				$message,
				$site_name,
				$site_index,
				$history
			);
			$message_uid = Flowbie_Wp_Chat_Logs::log_assistant_card( $denial, $log_meta );
			if ( $message_uid !== '' ) {
				$denial['message_uid'] = $message_uid;
			}
			self::stream_line( array( 'status' => 'done', 'card' => $denial ) );
			wp_die();
		}

		if ( self::try_stream_template_response( $message, $page_context, $settings, $log_meta, $history ) ) {
			wp_die();
		}

		if ( self::try_stream_blog_discovery_response( $message, $settings, $log_meta, $history ) ) {
			wp_die();
		}

		// -- Instant retrieve (continue path) --
		$site_index = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
		if ( is_array( $prefetched ) && ! empty( $prefetched['early_retrieved'] ) && is_array( $prefetched['early_retrieved'] ) ) {
			$early_retrieved = $prefetched['early_retrieved'];
		} else {
			$early_retrieved = self::retrieve_early_items( $message, $settings, $page_context );
		}
		if ( Flowbie_Wp_Chat_Links::resolve_lead_action( $message, $site_index ) ) {
			$lead_pages      = Flowbie_Wp_Chat_Links::find_lead_pages( $message, $site_index, 2 );
			$early_retrieved = Flowbie_Wp_Chat_Links::dedupe_items_by_id( array_merge( $lead_pages, $early_retrieved ) );
		}

		self::stream_line( array( 'status' => 'searching', 'label' => 'Searching content…' ) );

		$phase_a = null;
		if ( is_array( $prefetched ) && ! empty( $prefetched['phase_a'] ) && is_array( $prefetched['phase_a'] ) ) {
			$phase_a = $prefetched['phase_a'];
		}
		if ( null === $phase_a ) {
			$phase_a = Flowbie_Wp_Chat_Agents::synthesize_classification_from_retrieve( $message, $early_retrieved );
		}
		if ( null === $phase_a ) {
			$narrow  = Flowbie_Wp_Chat_Agents::build_narrow_candidate_items( $site_index, $message, $early_retrieved, $settings );
			$phase_a = Flowbie_Wp_Chat_Agents::phase_classify( $message, $site_name, $site_index, $narrow );
		}
		if ( is_wp_error( $phase_a ) ) {
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Something went wrong', 'body' => $phase_a->get_error_message(), 'confidence' => 'low',
			) ) );
			wp_die();
		}

		$relevant_items = Flowbie_Wp_Chat_Agents::select_relevant_items( $phase_a, $site_index, $message, $settings, $page_context );

		$enriched_items = self::enrich_relevant_items( $relevant_items, true, $settings );

		// -- Phase B: reason --
		self::stream_line( array( 'status' => 'thinking', 'label' => 'Thinking…' ) );

		$phase_b = Flowbie_Wp_Chat_Agents::phase_reason( $message, $history, $site_name, $enriched_items, $phase_a, $training, $site_index, $page_context );
		if ( is_wp_error( $phase_b ) ) {
			self::stream_line( array( 'status' => 'done', 'card' => array(
				'type' => 'not-found', 'title' => 'Something went wrong', 'body' => $phase_b->get_error_message(), 'confidence' => 'low',
			) ) );
			wp_die();
		}

		// -- Deterministic card (skip Phase C LLM in stream) --
		self::stream_line( array( 'status' => 'formatting', 'label' => 'Formatting response…' ) );

		$phase_c = Flowbie_Wp_Chat_Agents::build_card_from_answer( $phase_b, $phase_a, $enriched_items, $message, $site_index, $history );

		if ( Flowbie_Wp_Chat_Lead::is_lead_message( $message, $site_index ) && Flowbie_Wp_Chat_Lead::is_enabled( $settings ) ) {
			self::stream_line( array( 'status' => 'formatting', 'label' => 'Preparing next steps…' ) );
			$phase_c = Flowbie_Wp_Chat_Lead::enrich_card( $phase_c, $message, $phase_b, $enriched_items, $site_index, $training, $settings );
		}

		if ( is_array( $phase_c ) ) {
			$phase_c = Flowbie_Wp_Chat_Lead::maybe_attach_contact_human_cta( $phase_c, $message, $phase_a, $settings );
		}

		if ( is_array( $phase_c ) ) {
			$message_uid = Flowbie_Wp_Chat_Logs::log_assistant_card( $phase_c, $log_meta );
			if ( $message_uid !== '' ) {
				$phase_c['message_uid'] = $message_uid;
			}
		}

		$done_payload = array( 'status' => 'done', 'card' => $phase_c );
		if ( isset( $log_meta['source'] ) && $log_meta['source'] === 'demo' && current_user_can( 'manage_options' ) ) {
			$done_payload['debug'] = self::build_demo_debug_payload(
				$message,
				$phase_a,
				$enriched_items,
				$site_index
			);
		}

		self::stream_line( $done_payload );
		self::stream_followup_chips(
			$message,
			is_array( $phase_c ) ? $phase_c : array(),
			$phase_b,
			$enriched_items,
			$site_index,
			$history,
			$page_context
		);
		wp_die();
	}

	/**
	 * Blog discovery fast path: real post URLs from the Flowbie post sitemap.
	 *
	 * @param array<string,mixed>              $settings
	 * @param array<string,mixed>              $log_meta
	 * @param array<int,array<string,mixed>>   $history
	 */
	private static function try_stream_blog_discovery_response(
		string $message,
		array $settings,
		array $log_meta,
		array $history
	): bool {
		if ( ! Flowbie_Wp_Chat_Rag::is_site_blog_discovery_query( $message ) ) {
			return false;
		}

		$posts = Flowbie_Wp_Chat_Rag::collect_sitemap_blog_posts( $message, $settings, 5 );
		if ( empty( $posts ) ) {
			return false;
		}

		self::stream_line( array( 'status' => 'formatting', 'label' => 'Finding blog posts…' ) );

		$card = Flowbie_Wp_Chat_Rag::build_blog_discovery_card( $message, $posts, $settings );
		if ( ! is_array( $card ) || empty( $card['body'] ) ) {
			return false;
		}

		$site_index     = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
		$seen_urls      = Flowbie_Wp_Chat_History::collect_seen_urls( $history );
		$classification = array(
			'intent'       => 'recommendation',
			'search_terms' => array(),
		);
		$card           = Flowbie_Wp_Chat_Links::attach_to_card(
			$card,
			$message,
			(string) $card['body'],
			$posts,
			$classification,
			$site_index,
			$seen_urls,
			array()
		);

		Flowbie_Wp_Chat_Logs::log_user_message( $message, self::enrich_log_meta_for_message( $log_meta, $message, $page_context, $settings ) );

		$message_uid = Flowbie_Wp_Chat_Logs::log_assistant_card( $card, $log_meta );
		if ( $message_uid !== '' ) {
			$card['message_uid'] = $message_uid;
		}

		self::stream_line( array( 'status' => 'done', 'card' => $card ) );

		$followups = Flowbie_Wp_Chat_Rag::blog_discovery_followup_topics( $posts, $settings );
		if ( ! empty( $followups ) ) {
			$payload = array(
				'status'        => 'chips',
				'relatedTopics' => $followups,
			);
			if ( $message_uid !== '' ) {
				$payload['message_uid'] = $message_uid;
			}
			self::stream_line( $payload );
		}

		return true;
	}

	/**
	 * Template fast path: OpenRouter-formatted card from page content, no full RAG pipeline.
	 *
	 * @param array<string,mixed>|null     $page_context
	 * @param array<string,mixed>          $log_meta
	 * @param array<int,array<string,mixed>> $history
	 */
	private static function try_stream_template_response(
		string $message,
		?array $page_context,
		array $settings,
		array $log_meta,
		array $history
	): bool {
		$site_index = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
		$intent     = Flowbie_Wp_Chat_Suggestion_Templates::match_intent( $message, $page_context, $site_index );
		if ( null === $intent ) {
			return false;
		}

		self::stream_line( array( 'status' => 'formatting', 'label' => 'Formatting response…' ) );

		$card = Flowbie_Wp_Chat_Suggestion_Templates::build_card( $intent, $page_context, $site_index, $settings, $message );
		if ( ! is_array( $card ) || empty( $card ) ) {
			return false;
		}

		$message_uid = Flowbie_Wp_Chat_Logs::log_assistant_card( $card, $log_meta );
		if ( $message_uid !== '' ) {
			$card['message_uid'] = $message_uid;
		}

		self::stream_line(
			array(
				'status'          => 'done',
				'card'            => $card,
				'prefetched'      => true,
				'template_intent' => (string) ( $intent['intent'] ?? '' ),
			)
		);

		$answer = (string) ( $card['body'] ?? '' );
		self::stream_followup_chips(
			$message,
			$card,
			$answer,
			array(),
			$site_index,
			$history,
			$page_context
		);

		return true;
	}

	/**
	 * Generate and stream async follow-up chips after the answer card.
	 *
	 * @param array<string,mixed>              $card
	 * @param array<int,array<string,mixed>>   $items
	 * @param array<int,array<string,mixed>>   $site_index
	 * @param array<int,array<string,mixed>>   $history
	 */
	private static function stream_followup_chips(
		string $user_message,
		array $card,
		string $answer,
		array $items,
		array $site_index,
		array $history,
		?array $page_context = null
	): void {
		unset( $card['relatedTopics'] );

		$type = isset( $card['type'] ) ? (string) $card['type'] : '';
		if ( in_array( $type, array( 'error', 'not-found' ), true ) ) {
			return;
		}
		$answer_text = trim( $answer );
		if ( $answer_text === '' ) {
			$answer_text = trim( (string) ( $card['body'] ?? '' ) );
		}
		if ( $answer_text === '' ) {
			return;
		}

		$topics = Flowbie_Wp_Chat_Agents::generate_followup_topics(
			$user_message,
			$answer_text,
			$items,
			$site_index,
			$history,
			$page_context,
			$card
		);
		if ( empty( $topics ) ) {
			return;
		}

		$payload = array(
			'status'        => 'chips',
			'relatedTopics' => $topics,
		);
		if ( ! empty( $card['message_uid'] ) ) {
			$payload['message_uid'] = (string) $card['message_uid'];
		}
		self::stream_line( $payload );
	}

	/**
	 * AJAX prefetch: secretary ack + early RAG while the visitor is still typing.
	 */
	public static function ajax_chat_prefetch(): void {
		check_ajax_referer( 'flowbie_chat_stream', '_nonce' );

		if ( ! self::passes_chat_access_gates() ) {
			wp_send_json_error( array( 'message' => 'Chat unavailable.' ), 403 );
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$raw_body = file_get_contents( 'php://input' );
		$body     = json_decode( $raw_body, true );
		$message  = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( $body['message'] ) ) : '';
		$history  = isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array();

		if ( trim( $message ) === '' ) {
			wp_send_json_error( array( 'message' => 'Empty message.' ), 400 );
		}

		$history  = Flowbie_Wp_Chat_History::normalize( $history );
		$settings = self::get_settings();
		$page_context = self::parse_page_context_from_body( is_array( $body ) ? $body : null, $settings );
		$site_name = get_bloginfo( 'name' );
		$training = array(
			'assistant_name' => $settings['assistant_name'],
			'system_prompt'  => $settings['system_prompt'],
			'greeting_style' => $settings['greeting_style'],
			'knowledge_base' => $settings['knowledge_base'],
		);

		$gate = Flowbie_Wp_Chat_Agents::phase_ack( $message, $site_name, $training, $history, $settings );
		if ( is_wp_error( $gate ) ) {
			wp_send_json_error( array( 'message' => $gate->get_error_message() ), 500 );
		}

		$site_index      = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
		$early_retrieved = self::retrieve_early_items( $message, $settings, $page_context );
		if ( Flowbie_Wp_Chat_Links::resolve_lead_action( $message, $site_index ) ) {
			$lead_pages      = Flowbie_Wp_Chat_Links::find_lead_pages( $message, $site_index, 2 );
			$early_retrieved = Flowbie_Wp_Chat_Links::dedupe_items_by_id( array_merge( $lead_pages, $early_retrieved ) );
		}

		$phase_a = Flowbie_Wp_Chat_Agents::synthesize_classification_from_retrieve( $message, $early_retrieved );

		$prefetch_key = wp_generate_password( 32, false, false );
		set_transient(
			self::PREFETCH_TRANSIENT_PREFIX . $prefetch_key,
			array(
				'message'         => $message,
				'history_hash'    => self::prefetch_history_hash( $history ),
				'ack'             => $gate,
				'early_retrieved' => $early_retrieved,
				'phase_a'         => $phase_a,
			),
			self::PREFETCH_TTL
		);

		wp_send_json_success(
			array(
				'message'      => $message,
				'prefetch_key' => $prefetch_key,
				'ack'          => array(
					'action' => isset( $gate['action'] ) ? (string) $gate['action'] : 'continue',
					'text'   => isset( $gate['text'] ) ? (string) $gate['text'] : '',
				),
			)
		);
	}

	/**
	 * AJAX fast ack prefetch: secretary ack only (no RAG) while the visitor types.
	 */
	public static function ajax_chat_ack_prefetch(): void {
		check_ajax_referer( 'flowbie_chat_stream', '_nonce' );

		if ( ! self::passes_chat_access_gates() ) {
			wp_send_json_error( array( 'message' => 'Chat unavailable.' ), 403 );
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$raw_body = file_get_contents( 'php://input' );
		$body     = json_decode( $raw_body, true );
		$message  = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( $body['message'] ) ) : '';
		$history  = isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array();

		if ( trim( $message ) === '' ) {
			wp_send_json_error( array( 'message' => 'Empty message.' ), 400 );
		}

		$history  = Flowbie_Wp_Chat_History::normalize( $history );
		$settings = self::get_settings();
		$site_name = get_bloginfo( 'name' );
		$training = array(
			'assistant_name' => $settings['assistant_name'],
			'system_prompt'  => $settings['system_prompt'],
			'greeting_style' => $settings['greeting_style'],
			'knowledge_base' => $settings['knowledge_base'],
		);

		$gate = Flowbie_Wp_Chat_Agents::phase_ack( $message, $site_name, $training, $history, $settings );
		if ( is_wp_error( $gate ) ) {
			wp_send_json_error( array( 'message' => $gate->get_error_message() ), 500 );
		}

		wp_send_json_success(
			array(
				'message' => $message,
				'ack'     => array(
					'action' => isset( $gate['action'] ) ? (string) $gate['action'] : 'continue',
					'text'   => isset( $gate['text'] ) ? (string) $gate['text'] : '',
				),
			)
		);
	}

	/**
	 * AJAX full response prefetch for conversation starters and follow-up chips.
	 */
	public static function ajax_chat_response_prefetch(): void {
		check_ajax_referer( 'flowbie_chat_stream', '_nonce' );

		if ( ! self::passes_chat_access_gates() ) {
			wp_send_json_error( array( 'message' => 'Chat unavailable.' ), 403 );
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$raw_body = file_get_contents( 'php://input' );
		$body     = json_decode( $raw_body, true );
		$message  = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( $body['message'] ) ) : '';
		$history  = isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array();

		if ( trim( $message ) === '' ) {
			wp_send_json_error( array( 'message' => 'Empty message.' ), 400 );
		}

		$history  = Flowbie_Wp_Chat_History::normalize( $history );
		$settings = self::get_settings();
		$page_context = self::parse_page_context_from_body( is_array( $body ) ? $body : null, $settings );
		$training = array(
			'assistant_name' => $settings['assistant_name'],
			'system_prompt'  => $settings['system_prompt'],
			'greeting_style' => $settings['greeting_style'],
			'knowledge_base' => $settings['knowledge_base'],
		);

		$result = self::execute_chat_pipeline( $message, $history, $settings, $training, null, $page_context );
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
		}

		$gate = $result['gate'];
		$prefetch_key = wp_generate_password( 32, false, false );
		$prefetch_payload = array(
			'message'         => $message,
			'history_hash'    => self::prefetch_history_hash( $history ),
			'ack'             => $gate,
			'card'            => $result['card'],
			'answer'          => isset( $result['answer'] ) ? (string) $result['answer'] : '',
			'early_retrieved' => $result['early_retrieved'],
			'phase_a'         => $result['phase_a'],
		);
		if ( ! empty( $result['template_intent'] ) ) {
			$prefetch_payload['template_intent'] = (string) $result['template_intent'];
		}
		set_transient(
			self::PREFETCH_TRANSIENT_PREFIX . $prefetch_key,
			$prefetch_payload,
			self::RESPONSE_PREFETCH_TTL
		);

		wp_send_json_success(
			array(
				'message'      => $message,
				'prefetch_key' => $prefetch_key,
				'ready'        => true,
				'ack'          => array(
					'action' => isset( $gate['action'] ) ? (string) $gate['action'] : 'continue',
					'text'   => isset( $gate['text'] ) ? (string) $gate['text'] : '',
				),
			)
		);
	}

	/**
	 * Stream a fully prefetched card (starters / follow-up chips).
	 *
	 * @param array<string,mixed>              $prefetched
	 * @param array<string,mixed>              $log_meta
	 * @param array<string,mixed>              $settings
	 */
	private static function stream_prefetched_card(
		string $message,
		array $prefetched,
		array $log_meta,
		array $settings,
		array $history,
		?array $page_context = null
	): void {
		$gate = isset( $prefetched['ack'] ) && is_array( $prefetched['ack'] )
			? $prefetched['ack']
			: array(
				'action' => 'continue',
				'text'   => '',
			);

		if ( trim( (string) ( $gate['text'] ?? '' ) ) !== '' ) {
			self::stream_line( array( 'status' => 'ack', 'text' => trim( (string) $gate['text'] ) ) );
		}

		Flowbie_Wp_Chat_Logs::log_user_message( $message, self::enrich_log_meta_for_message( $log_meta, $message, $page_context, $settings ) );

		$phase_c = isset( $prefetched['card'] ) && is_array( $prefetched['card'] ) ? $prefetched['card'] : array();
		if ( is_array( $phase_c ) && ! empty( $phase_c ) ) {
			$message_uid = Flowbie_Wp_Chat_Logs::log_assistant_card( $phase_c, $log_meta );
			if ( $message_uid !== '' ) {
				$phase_c['message_uid'] = $message_uid;
			}
		}

		$done_payload = array(
			'status'     => 'done',
			'card'       => $phase_c,
			'prefetched' => true,
		);
		if ( ! empty( $prefetched['template_intent'] ) ) {
			$done_payload['template_intent'] = (string) $prefetched['template_intent'];
		}

		if (
			isset( $log_meta['source'] )
			&& $log_meta['source'] === 'demo'
			&& current_user_can( 'manage_options' )
			&& ! empty( $prefetched['phase_a'] )
			&& is_array( $prefetched['phase_a'] )
		) {
			$site_index     = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
			$enriched_items = isset( $prefetched['early_retrieved'] ) && is_array( $prefetched['early_retrieved'] )
				? $prefetched['early_retrieved']
				: array();
			$done_payload['debug'] = self::build_demo_debug_payload(
				$message,
				$prefetched['phase_a'],
				$enriched_items,
				$site_index
			);
		}

		self::stream_line( $done_payload );

		$site_index     = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
		$enriched_items = isset( $prefetched['early_retrieved'] ) && is_array( $prefetched['early_retrieved'] )
			? $prefetched['early_retrieved']
			: array();
		$answer = isset( $prefetched['answer'] ) ? (string) $prefetched['answer'] : (string) ( $phase_c['body'] ?? '' );

		self::stream_followup_chips(
			$message,
			is_array( $phase_c ) ? $phase_c : array(),
			$answer,
			$enriched_items,
			$site_index,
			$history,
			$page_context
		);
	}

	/**
	 * Full chat pipeline (no streaming). Used for response prefetch.
	 *
	 * @param array<int,array<string,mixed>>   $history
	 * @param array<string,mixed>              $settings
	 * @param array<string,mixed>              $training
	 * @param array<string,mixed>|null         $prefetched
	 * @return array{
	 *   gate:array<string,mixed>,
	 *   card:array<string,mixed>,
	 *   phase_a:array<string,mixed>|null,
	 *   early_retrieved:array<int,array<string,mixed>>
	 * }|WP_Error
	 */
	private static function execute_chat_pipeline(
		string $message,
		array $history,
		array $settings,
		array $training,
		?array $prefetched = null,
		?array $page_context = null
	) {
		$site_name = get_bloginfo( 'name' );

		$gate = is_array( $prefetched ) && isset( $prefetched['ack'] ) && is_array( $prefetched['ack'] )
			? $prefetched['ack']
			: Flowbie_Wp_Chat_Agents::phase_ack( $message, $site_name, $training, $history, $settings );
		if ( is_wp_error( $gate ) ) {
			return $gate;
		}

		if ( is_array( $gate ) && ( $gate['action'] ?? '' ) === 'deny' ) {
			$site_index = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
			$denial     = Flowbie_Wp_Chat_Agents::build_denial_card(
				(string) ( $gate['text'] ?? '' ),
				$message,
				$site_name,
				$site_index,
				$history
			);

			return array(
				'gate'            => $gate,
				'card'            => $denial,
				'phase_a'         => null,
				'early_retrieved' => array(),
			);
		}

		$site_index = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
		$intent     = Flowbie_Wp_Chat_Suggestion_Templates::match_intent( $message, $page_context, $site_index );
		if ( is_array( $intent ) ) {
			$card = Flowbie_Wp_Chat_Suggestion_Templates::build_card( $intent, $page_context, $site_index, $settings, $message );
			if ( is_array( $card ) && ! empty( $card ) ) {
				return array(
					'gate'            => $gate,
					'card'            => $card,
					'answer'          => (string) ( $card['body'] ?? '' ),
					'phase_a'         => null,
					'early_retrieved' => array(),
					'template_intent' => (string) ( $intent['intent'] ?? '' ),
				);
			}
		}

		if ( is_array( $prefetched ) && ! empty( $prefetched['early_retrieved'] ) && is_array( $prefetched['early_retrieved'] ) ) {
			$early_retrieved = $prefetched['early_retrieved'];
		} else {
			$early_retrieved = self::retrieve_early_items( $message, $settings, $page_context );
		}
		if ( Flowbie_Wp_Chat_Links::resolve_lead_action( $message, $site_index ) ) {
			$lead_pages      = Flowbie_Wp_Chat_Links::find_lead_pages( $message, $site_index, 2 );
			$early_retrieved = Flowbie_Wp_Chat_Links::dedupe_items_by_id( array_merge( $lead_pages, $early_retrieved ) );
		}

		$phase_a = null;
		if ( is_array( $prefetched ) && ! empty( $prefetched['phase_a'] ) && is_array( $prefetched['phase_a'] ) ) {
			$phase_a = $prefetched['phase_a'];
		}
		if ( null === $phase_a ) {
			$phase_a = Flowbie_Wp_Chat_Agents::synthesize_classification_from_retrieve( $message, $early_retrieved );
		}
		if ( null === $phase_a ) {
			$narrow  = Flowbie_Wp_Chat_Agents::build_narrow_candidate_items( $site_index, $message, $early_retrieved, $settings );
			$phase_a = Flowbie_Wp_Chat_Agents::phase_classify( $message, $site_name, $site_index, $narrow );
		}
		if ( is_wp_error( $phase_a ) ) {
			return $phase_a;
		}

		$relevant_items = Flowbie_Wp_Chat_Agents::select_relevant_items( $phase_a, $site_index, $message, $settings, $page_context );
		$enriched_items = self::enrich_relevant_items( $relevant_items, false, $settings );

		$phase_b = Flowbie_Wp_Chat_Agents::phase_reason( $message, $history, $site_name, $enriched_items, $phase_a, $training, $site_index, $page_context );
		if ( is_wp_error( $phase_b ) ) {
			return $phase_b;
		}

		$phase_c = Flowbie_Wp_Chat_Agents::build_card_from_answer( $phase_b, $phase_a, $enriched_items, $message, $site_index, $history );

		if ( Flowbie_Wp_Chat_Lead::is_lead_message( $message, $site_index ) && Flowbie_Wp_Chat_Lead::is_enabled( $settings ) ) {
			$phase_c = Flowbie_Wp_Chat_Lead::enrich_card( $phase_c, $message, $phase_b, $enriched_items, $site_index, $training, $settings );
		}

		if ( is_array( $phase_c ) ) {
			$phase_c = Flowbie_Wp_Chat_Lead::maybe_attach_contact_human_cta( $phase_c, $message, $phase_a, $settings );
		}

		return array(
			'gate'            => $gate,
			'card'            => is_array( $phase_c ) ? $phase_c : array(),
			'answer'          => $phase_b,
			'phase_a'         => $phase_a,
			'early_retrieved' => $enriched_items,
		);
	}

	/**
	 * AJAX warm current-page context for URL-aware chat.
	 */
	public static function ajax_chat_page_context(): void {
		check_ajax_referer( 'flowbie_chat_stream', '_nonce' );

		if ( ! self::passes_chat_access_gates() ) {
			wp_send_json_error( array( 'message' => 'Chat unavailable.' ), 403 );
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$raw_body = file_get_contents( 'php://input' );
		$body     = json_decode( $raw_body, true );
		$page_url = isset( $body['page_url'] ) ? esc_url_raw( (string) $body['page_url'] ) : '';
		$post_id  = isset( $body['post_id'] ) ? (int) $body['post_id'] : 0;
		$page_title = isset( $body['page_title'] ) ? sanitize_text_field( wp_unslash( (string) $body['page_title'] ) ) : '';

		if ( $page_url === '' && $post_id < 1 ) {
			wp_send_json_error( array( 'message' => 'Missing page URL.' ), 400 );
		}

		$settings = self::get_settings();
		$result   = Flowbie_Wp_Chat_Page_Context::warm_and_store( $page_url, $post_id, $page_title, $settings );
		wp_send_json_success( $result );
	}

	/**
	 * @param array<string,mixed>|null $body
	 * @param array<string,mixed>      $settings
	 * @return array<string,mixed>|null
	 */
	private static function parse_page_context_from_body( ?array $body, array $settings ): ?array {
		if ( ! is_array( $body ) ) {
			return null;
		}

		$page_url = isset( $body['page_url'] ) ? esc_url_raw( (string) $body['page_url'] ) : '';
		$post_id  = isset( $body['post_id'] ) ? (int) $body['post_id'] : 0;
		$page_title = isset( $body['page_title'] ) ? sanitize_text_field( wp_unslash( (string) $body['page_title'] ) ) : '';
		$key = isset( $body['page_context_key'] ) ? sanitize_text_field( wp_unslash( (string) $body['page_context_key'] ) ) : '';

		if ( $page_url === '' && $post_id < 1 && $key === '' ) {
			return null;
		}

		return Flowbie_Wp_Chat_Page_Context::load( $key, $page_url, $post_id, $page_title, $settings );
	}

	/**
	 * Shared enabled / visitor / API-key gates for stream + prefetch.
	 */
	private static function passes_chat_access_gates(): bool {
		if ( ! self::can_use_chat_api() ) {
			return false;
		}
		if ( Flowbie_Wp_OpenRouter::get_api_key() === '' ) {
			return false;
		}
		return true;
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 */
	private static function prefetch_history_hash( array $history ): string {
		return md5( wp_json_encode( array_slice( $history, -10 ) ) );
	}

	/**
	 * @param array<string,mixed>              $settings
	 * @param array<string,mixed>|null         $page_context
	 * @return array<int,array<string,mixed>>
	 */
	private static function retrieve_early_items( string $message, array $settings, ?array $page_context = null ): array {
		$items = Flowbie_Wp_Chat_Rag::retrieve( $message, Flowbie_Wp_Chat_Rag::MAX_RESULTS, $settings );
		$items = Flowbie_Wp_Chat_Rag::merge_blog_discovery_items( $message, $items, $settings );
		return Flowbie_Wp_Chat_Page_Context::merge_into_items( $items, $page_context, $message );
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @return array<string,mixed>|null
	 */
	private static function load_prefetch_payload( string $prefetch_key, string $message, array $history ): ?array {
		$prefetch_key = trim( $prefetch_key );
		if ( $prefetch_key === '' ) {
			return null;
		}

		$stored = get_transient( self::PREFETCH_TRANSIENT_PREFIX . $prefetch_key );
		if ( ! is_array( $stored ) ) {
			return null;
		}

		if ( (string) ( $stored['message'] ?? '' ) !== $message ) {
			return null;
		}

		if ( (string) ( $stored['history_hash'] ?? '' ) !== self::prefetch_history_hash( $history ) ) {
			return null;
		}

		delete_transient( self::PREFETCH_TRANSIENT_PREFIX . $prefetch_key );

		return $stored;
	}

	/**
	 * Demo-only RAG debug snapshot (no full post bodies).
	 *
	 * @param array<string,mixed>              $phase_a
	 * @param array<int,array<string,mixed>>   $enriched_items
	 * @param array<int,array<string,mixed>>   $site_index
	 * @return array<string,mixed>
	 */
	private static function build_demo_debug_payload( string $user_message, array $phase_a, array $enriched_items, array $site_index ): array {
		$extra_phrases = isset( $phase_a['search_terms'] ) ? array_values( (array) $phase_a['search_terms'] ) : array();
		$match_terms   = Flowbie_Wp_Chat_Rag::extract_match_terms( $user_message, $extra_phrases );

		$retrieved = array();
		foreach ( $enriched_items as $item ) {
			$retrieved[] = array(
				'id'             => isset( $item['id'] ) ? (int) $item['id'] : 0,
				'title'          => isset( $item['title'] ) ? (string) $item['title'] : '',
				'url'            => isset( $item['url'] ) ? (string) $item['url'] : '',
				'slug'           => isset( $item['slug'] ) ? (string) $item['slug'] : '',
				'type'           => isset( $item['type'] ) ? (string) $item['type'] : '',
				'score'          => Flowbie_Wp_Chat_Rag::fuzzy_page_score( $user_message, $item, $extra_phrases ),
				'slug_term_hits' => Flowbie_Wp_Chat_Rag::count_slug_path_term_hits( $user_message, $item, $extra_phrases ),
				'excerpt_length' => isset( $item['excerpt'] ) ? strlen( (string) $item['excerpt'] ) : 0,
			);
		}

		$primary    = Flowbie_Wp_Chat_Links::pick_primary_topic_link( $user_message, $enriched_items, $site_index, $extra_phrases );
		$topics     = Flowbie_Wp_Chat_Links::pick_topic_links( $user_message, $enriched_items, 3, $site_index, true, $extra_phrases );
		$fuzzy_top  = Flowbie_Wp_Chat_Rag::find_fuzzy_topic_pages( $user_message, $site_index, 5, $extra_phrases );
		$url_hits   = Flowbie_Wp_Chat_Rag::index_url_term_hits( $user_message, $site_index, $extra_phrases );
		$type_counts = array();
		foreach ( $site_index as $item ) {
			$t = isset( $item['type'] ) ? (string) $item['type'] : 'unknown';
			$type_counts[ $t ] = ( $type_counts[ $t ] ?? 0 ) + 1;
		}

		return array(
			'timestamp'              => gmdate( 'c' ),
			'user_message'           => $user_message,
			'match_terms'            => array_values( $match_terms ),
			'index_count'            => count( $site_index ),
			'index_source'           => array(
				'source'     => 'sitemap',
				'post_types' => Flowbie_Wp_Chat_Rag::get_index_post_types( $settings ),
				'type_counts' => $type_counts,
			),
			'phase_a'                => array(
				'intent'       => isset( $phase_a['intent'] ) ? (string) $phase_a['intent'] : '',
				'relevant_ids' => isset( $phase_a['relevant_ids'] ) ? array_map( 'intval', (array) $phase_a['relevant_ids'] ) : array(),
				'search_terms' => $extra_phrases,
			),
			'retrieved_items'        => $retrieved,
			'url_term_hits'          => $url_hits,
			'fuzzy_top_5'            => array_map(
				function ( $item ) {
					return array(
						'id'    => isset( $item['id'] ) ? (int) $item['id'] : 0,
						'title' => isset( $item['title'] ) ? (string) $item['title'] : '',
						'slug'  => isset( $item['slug'] ) ? (string) $item['slug'] : '',
						'url'   => isset( $item['url'] ) ? (string) $item['url'] : '',
						'score' => isset( $item['fuzzy_score'] ) ? (float) $item['fuzzy_score'] : 0,
					);
				},
				$fuzzy_top
			),
			'topic_link_primary'     => null !== $primary ? array(
				'label' => $primary['label'],
				'url'   => $primary['url'],
				'score' => isset( $primary['score'] ) ? (float) $primary['score'] : 0,
			) : null,
			'topic_links'            => array_map(
				function ( $link ) {
					return array(
						'label' => $link['label'],
						'url'   => $link['url'],
						'score' => isset( $link['score'] ) ? (float) $link['score'] : 0,
					);
				},
				$topics
			),
			'enriched_excerpt_lengths' => array_map(
				function ( $item ) {
					return isset( $item['excerpt'] ) ? strlen( (string) $item['excerpt'] ) : 0;
				},
				$enriched_items
			),
		);
	}

	/**
	 * Open an unbuffered NDJSON stream response.
	 */
	public static function stream_begin(): void {
		self::begin_stream_response();
	}

	/**
	 * Flush a single NDJSON line to the output stream.
	 *
	 * @param array $data JSON-serialisable payload.
	 */
	public static function stream_emit( array $data ): void {
		self::stream_line( $data );
	}

	/**
	 * Open an unbuffered NDJSON stream response.
	 */
	private static function begin_stream_response(): void {
		if ( headers_sent() ) {
			return;
		}
		header( 'Content-Type: text/plain; charset=utf-8' );
		header( 'Cache-Control: no-cache' );
		header( 'X-Accel-Buffering: no' );
		if ( function_exists( 'apache_setenv' ) ) {
			apache_setenv( 'no-gzip', '1' ); // @codeCoverageIgnore
		}
		while ( ob_get_level() ) {
			ob_end_flush();
		}
	}

	/**
	 * Flush a single NDJSON line to the output stream.
	 *
	 * @param array $data JSON-serialisable payload.
	 */
	private static function stream_line( array $data ): void {
		if ( isset( $data['card'] ) && is_array( $data['card'] ) ) {
			$data['card'] = Flowbie_Wp_Display_Text::decode_card( $data['card'] );
		}
		echo wp_json_encode( $data ) . "\n";
		if ( ob_get_level() ) {
			ob_flush();
		}
		flush();
	}

	/**
	 * Fetch rendered post content for all relevant items before Phase B.
	 *
	 * @param array $items               Relevant items from select_relevant_items().
	 * @param bool  $emit_reading_events Stream NDJSON reading events when true.
	 * @param array $settings            Chat settings (unused; kept for call-site compat).
	 * @return array Items with excerpt replaced by full page content for reasoning.
	 */
	public static function enrich_relevant_items( array $items, bool $emit_reading_events = false, array $settings = array() ): array {
		if ( empty( $items ) ) {
			return $items;
		}

		$items = array_slice( $items, 0, Flowbie_Wp_Chat_Rag::ENRICH_MAX );

		if ( $emit_reading_events ) {
			self::stream_line(
				array(
					'status' => 'reading',
					'label'  => 'Reading matched pages…',
				)
			);
		}

		foreach ( $items as $i => $item ) {
			$post = get_post( $item['id'] );
			if ( ! $post || $post->post_status !== 'publish' ) {
				continue;
			}

			if ( $emit_reading_events ) {
				self::stream_line(
					array(
						'status' => 'reading',
						'label'  => 'Reading ' . $item['title'] . '…',
					)
				);
			}

			$full = Flowbie_Wp_Chat_Rag::read_post_body_for_chat( $post->ID );
			if ( $full !== '' ) {
				$items[ $i ]['excerpt'] = $full;
			}
		}

		return $items;
	}

	/**
	 * Resolve input_origin for chat log rows (client hint + template intents).
	 *
	 * @param array<string,mixed>      $log_meta
	 * @param array<string,mixed>|null $page_context
	 * @param array<string,mixed>      $settings
	 * @return array<string,mixed>
	 */
	private static function enrich_log_meta_for_message( array $log_meta, string $message, ?array $page_context, array $settings ): array {
		$origin = isset( $log_meta['input_origin'] )
			? Flowbie_Wp_Chat_Logs::sanitize_input_origin( (string) $log_meta['input_origin'] )
			: 'typed';

		$site_index = Flowbie_Wp_Chat_Rag::get_site_index( $settings );
		if ( Flowbie_Wp_Chat_Suggestion_Templates::match_intent( $message, $page_context, $site_index ) !== null ) {
			$origin = 'template';
		}

		$log_meta['input_origin'] = $origin;
		return $log_meta;
	}
}
