<?php
/**
 * Flowbie Voice: REST endpoint for speech-to-text (push-to-talk input).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Voice {

	const REST_NAMESPACE = 'flowbie/v1';

	/**
	 * Hook registrations.
	 */
	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		if ( ! Flowbie_Wp_Speed::is_active() ) {
			add_filter( 'autoptimize_filter_js_exclude', array( __CLASS__, 'autoptimize_exclude_voice_scripts' ) );
		}
	}

	/**
	 * Keep voice scripts out of Autoptimize bundles.
	 *
	 * @param string $exclude Comma-separated exclude list.
	 * @return string
	 */
	public static function autoptimize_exclude_voice_scripts( $exclude ): string {
		if ( ! is_string( $exclude ) ) {
			$exclude = '';
		}
		$needles = array( 'flowbie-voice', 'flowbie-thinking-card', 'flowbie-chat-widget', 'flowbie-markdown' );
		foreach ( $needles as $needle ) {
			if ( strpos( $exclude, $needle ) === false ) {
				$exclude .= ( $exclude !== '' ? ', ' : '' ) . $needle;
			}
		}
		return $exclude;
	}

	/**
	 * Register voice REST routes.
	 */
	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/voice/transcribe',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_transcribe' ),
				'permission_callback' => array( __CLASS__, 'rest_permission' ),
			)
		);
	}

	/**
	 * @param WP_REST_Request $request
	 * @return bool
	 */
	public static function rest_permission( WP_REST_Request $request ): bool {
		if ( current_user_can( 'edit_posts' ) ) {
			return true;
		}
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}
		if ( ! Flowbie_Wp_Chat::is_enabled() ) {
			return false;
		}
		return self::verify_voice_nonce( $request );
	}

	/**
	 * @param WP_REST_Request $request
	 */
	private static function verify_voice_nonce( WP_REST_Request $request ): bool {
		$nonce = $request->get_header( 'x_flowbie_voice_nonce' );
		if ( ! is_string( $nonce ) || $nonce === '' ) {
			$params = $request->get_json_params();
			if ( is_array( $params ) && isset( $params['voice_nonce'] ) ) {
				$nonce = (string) $params['voice_nonce'];
			}
		}
		if ( $nonce === '' ) {
			return false;
		}
		return (bool) wp_verify_nonce( $nonce, 'flowbie_chat_stream' );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public static function rest_transcribe( WP_REST_Request $request ): WP_REST_Response {
		if ( Flowbie_Wp_OpenRouter::get_api_key() === '' ) {
			return new WP_REST_Response(
				array( 'error' => __( 'OpenRouter API key is not configured.', 'flowbie-wp' ) ),
				503
			);
		}

		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = array();
		}

		$audio_b64 = isset( $body['audio_base64'] ) ? (string) $body['audio_base64'] : '';
		if ( $audio_b64 !== '' && strpos( $audio_b64, ',' ) !== false ) {
			$parts     = explode( ',', $audio_b64, 2 );
			$audio_b64 = $parts[1];
		}
		$audio_b64 = preg_replace( '/\s+/', '', $audio_b64 );

		if ( $audio_b64 === '' ) {
			return new WP_REST_Response(
				array( 'error' => __( 'Audio data is required.', 'flowbie-wp' ) ),
				400
			);
		}

		if ( strlen( $audio_b64 ) > Flowbie_Wp_OpenRouter::MAX_AUDIO_BASE64_BYTES ) {
			return new WP_REST_Response(
				array( 'error' => __( 'Audio recording is too large.', 'flowbie-wp' ) ),
				413
			);
		}

		$format = isset( $body['format'] ) ? sanitize_key( (string) $body['format'] ) : 'webm';

		$result = Flowbie_Wp_OpenRouter::transcribe_audio( $audio_b64, $format );
		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				array( 'error' => $result->get_error_message() ),
				502
			);
		}

		return new WP_REST_Response(
			array( 'text' => sanitize_textarea_field( $result ) ),
			200
		);
	}

	/**
	 * Enqueue thinking-card script (loading checklist UI).
	 *
	 * @param bool $in_footer Load script in footer.
	 */
	public static function enqueue_thinking_card_assets( bool $in_footer = true ): void {
		$base         = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/shared/';
		$thinking_js  = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-thinking-card.js';
		$thinking_css = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-thinking-card.css';
		$thinking_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $thinking_js ) ) {
			$thinking_ver .= '.' . (string) filemtime( $thinking_js );
		}

		if ( ! wp_style_is( 'flowbie-thinking-card', 'registered' ) ) {
			wp_register_style(
				'flowbie-thinking-card',
				$base . 'flowbie-thinking-card.css',
				array(),
				is_readable( $thinking_css ) ? $thinking_ver : FLOWBIE_WP_VERSION
			);
		}
		wp_enqueue_style( 'flowbie-thinking-card' );

		if ( ! wp_script_is( 'flowbie-thinking-card', 'registered' ) ) {
			wp_register_script(
				'flowbie-thinking-card',
				$base . 'flowbie-thinking-card.js',
				array(),
				$thinking_ver,
				$in_footer
			);
		}
		wp_enqueue_script( 'flowbie-thinking-card' );

		$stream_js  = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-chat-stream.js';
		$stream_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $stream_js ) ) {
			$stream_ver .= '.' . (string) filemtime( $stream_js );
		}
		if ( ! wp_script_is( 'flowbie-chat-stream', 'registered' ) ) {
			wp_register_script(
				'flowbie-chat-stream',
				$base . 'flowbie-chat-stream.js',
				array( 'flowbie-thinking-card' ),
				$stream_ver,
				$in_footer
			);
		}
		wp_enqueue_script( 'flowbie-chat-stream' );

		$prefetch_js  = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-chat-prefetch.js';
		$prefetch_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $prefetch_js ) ) {
			$prefetch_ver .= '.' . (string) filemtime( $prefetch_js );
		}
		if ( ! wp_script_is( 'flowbie-chat-prefetch', 'registered' ) ) {
			wp_register_script(
				'flowbie-chat-prefetch',
				$base . 'flowbie-chat-prefetch.js',
				array(),
				$prefetch_ver,
				$in_footer
			);
		}
		wp_enqueue_script( 'flowbie-chat-prefetch' );

		$debug_log_js  = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-chat-debug-log.js';
		$debug_log_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $debug_log_js ) ) {
			$debug_log_ver .= '.' . (string) filemtime( $debug_log_js );
		}
		if ( ! wp_script_is( 'flowbie-chat-debug-log', 'registered' ) ) {
			wp_register_script(
				'flowbie-chat-debug-log',
				$base . 'flowbie-chat-debug-log.js',
				array(),
				$debug_log_ver,
				$in_footer
			);
		}
		wp_enqueue_script( 'flowbie-chat-debug-log' );

		$display_text_js  = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-display-text.js';
		$display_text_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $display_text_js ) ) {
			$display_text_ver .= '.' . (string) filemtime( $display_text_js );
		}
		if ( ! wp_script_is( 'flowbie-display-text', 'registered' ) ) {
			wp_register_script(
				'flowbie-display-text',
				$base . 'flowbie-display-text.js',
				array(),
				$display_text_ver,
				$in_footer
			);
		}

		$markdown_js = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-markdown.js';
		$markdown_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $markdown_js ) ) {
			$markdown_ver .= '.' . (string) filemtime( $markdown_js );
		}
		if ( ! wp_script_is( 'flowbie-markdown', 'registered' ) ) {
			wp_register_script(
				'flowbie-markdown',
				$base . 'flowbie-markdown.js',
				array( 'flowbie-display-text' ),
				$markdown_ver,
				$in_footer
			);
		}
	}

	/**
	 * Enqueue shared voice assets (admin or frontend).
	 *
	 * @param array<string, mixed> $config Extra config merged into flowbieVoiceConfig.
	 * @param bool                $in_footer Load script in footer (false = head, for admin pages with inline JS).
	 */
	public static function enqueue_assets( array $config = array(), bool $in_footer = true ): void {
		$base     = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/shared/';
		$ver      = FLOWBIE_WP_VERSION;
		$js_path  = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-voice.js';
		$css_path = FLOWBIE_WP_PLUGIN_DIR . 'assets/shared/flowbie-voice.css';
		if ( is_readable( $js_path ) ) {
			$ver .= '.' . (string) filemtime( $js_path );
		}

		self::enqueue_thinking_card_assets( $in_footer );

		wp_enqueue_style(
			'flowbie-voice',
			$base . 'flowbie-voice.css',
			array( 'flowbie-thinking-card' ),
			is_readable( $css_path ) ? $ver : FLOWBIE_WP_VERSION
		);

		wp_register_script(
			'flowbie-voice',
			$base . 'flowbie-voice.js',
			array( 'flowbie-thinking-card' ),
			$ver,
			$in_footer
		);

		wp_enqueue_script( 'flowbie-voice' );

		$defaults = array(
			'transcribeUrl' => esc_url_raw( rest_url( self::REST_NAMESPACE . '/voice/transcribe' ) ),
			'nonce'         => wp_create_nonce( 'wp_rest' ),
			'voiceNonce'    => wp_create_nonce( 'flowbie_chat_stream' ),
		);

		wp_localize_script(
			'flowbie-voice',
			'flowbieVoiceConfig',
			array_merge( $defaults, $config )
		);
	}
}
