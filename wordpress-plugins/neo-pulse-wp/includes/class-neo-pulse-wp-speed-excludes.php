<?php
/**
 * Speed module asset exclude lists.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Default and user-defined exclude matching for CSS/JS URLs.
 */
class Neo_Pulse_Wp_Speed_Excludes {

	/**
	 * Built-in NEO Pulse script handles/URL needles (chat, voice).
	 *
	 * @return array<int, string>
	 */
	public static function default_js_needles(): array {
		$defaults = array(
			'neo-pulse-voice',
			'neo-pulse-thinking-card',
			'neo-pulse-chat-stream',
			'neo-pulse-chat-prefetch',
			'neo-pulse-chat-debug-log',
			'neo-pulse-chat-widget',
			'neo-pulse-overseer',
			'webpack.runtime',
			'wp-includes/js/dist',
		);
		/**
		 * Filter default JS URL fragments that Speed will not minify.
		 * Add needles such as `elementor` here if combine/minify breaks your builder.
		 *
		 * @param array<int, string> $defaults Needles matched against lowercase asset URLs.
		 */
		return apply_filters( 'neo_pulse_wp_speed_default_js_excludes', $defaults );
	}

	/**
	 * @return array<int, string>
	 */
	public static function default_css_needles(): array {
		$defaults = array();
		/**
		 * Filter default CSS URL fragments that Speed will not minify.
		 * Add needles such as `elementor-frontend` if per-file minify breaks layouts.
		 *
		 * @param array<int, string> $defaults Needles matched against lowercase asset URLs.
		 */
		return apply_filters( 'neo_pulse_wp_speed_default_css_excludes', $defaults );
	}

	/**
	 * @param string $url Asset URL or path fragment.
	 * @param string $type css|js.
	 * @param array<string, mixed> $config Settings config.
	 */
	public static function is_excluded( string $url, string $type, array $config ): bool {
		$url = strtolower( $url );
		if ( $url === '' ) {
			return true;
		}

		$needles = 'css' === $type ? self::default_css_needles() : self::default_js_needles();
		$key     = 'css' === $type ? 'css_exclude' : 'js_exclude';
		$user    = Neo_Pulse_Wp_Speed_Settings::parse_exclude_lines( (string) ( $config[ $key ] ?? '' ) );
		$needles = array_merge( $needles, $user );

		foreach ( $needles as $needle ) {
			$needle = strtolower( trim( (string) $needle ) );
			if ( $needle === '' ) {
				continue;
			}
			if ( strpos( $url, $needle ) !== false ) {
				return true;
			}
		}

		if ( 'js' === $type ) {
			if ( strpos( $url, 'jquery' ) !== false ) {
				return true;
			}
			if ( strpos( $url, 'admin-bar' ) !== false ) {
				return true;
			}
		}

		return (bool) apply_filters( 'neo_pulse_wp_speed_is_excluded', false, $url, $type, $config );
	}

	/**
	 * URL fragments that must not receive defer (builder-critical scripts).
	 *
	 * @return array<int, string>
	 */
	public static function default_defer_js_needles(): array {
		$defaults = array(
			'elementor',
			'elementor-frontend',
			'webpack.runtime',
			'wp-includes/js/dist',
			'neo-pulse-voice',
			'neo-pulse-thinking-card',
			'neo-pulse-chat-stream',
			'neo-pulse-chat-prefetch',
			'neo-pulse-chat-debug-log',
			'neo-pulse-chat-widget',
			'neo-pulse-overseer',
			'neo-pulse-search',
			'comment-reply',
			'wp-embed',
		);
		/**
		 * Filter default JS URL fragments that Speed will not defer.
		 *
		 * @param array<int, string> $defaults Needles matched against lowercase asset URLs.
		 */
		return apply_filters( 'neo_pulse_wp_speed_default_defer_js_excludes', $defaults );
	}

	/**
	 * Whether a script URL should keep blocking execution (no defer).
	 *
	 * @param string               $url    Asset URL.
	 * @param array<string, mixed> $config Settings config.
	 */
	public static function is_defer_excluded( string $url, array $config ): bool {
		if ( self::is_excluded( $url, 'js', $config ) ) {
			return true;
		}
		$url = strtolower( $url );
		foreach ( self::default_defer_js_needles() as $needle ) {
			$needle = strtolower( trim( (string) $needle ) );
			if ( $needle !== '' && strpos( $url, $needle ) !== false ) {
				return true;
			}
		}
		return (bool) apply_filters( 'neo_pulse_wp_speed_is_defer_excluded', false, $url, $config );
	}
}
