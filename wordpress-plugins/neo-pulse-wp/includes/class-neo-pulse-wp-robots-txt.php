<?php
/**
 * robots.txt settings storage and front-end output.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Robots_Txt {

	const OPTION_KEY = 'neo_pulse_wp_robots_txt';

	public static function init(): void {
		add_filter( 'robots_txt', array( __CLASS__, 'filter_robots_txt' ), 99, 2 );
	}

	public static function get_content(): string {
		$raw = get_option( self::OPTION_KEY, array() );
		if ( is_string( $raw ) ) {
			return self::sanitize_content( $raw );
		}
		if ( is_array( $raw ) && isset( $raw['content'] ) ) {
			return self::sanitize_content( (string) $raw['content'] );
		}

		return '';
	}

	public static function save_content( string $content ): void {
		$sanitized = self::sanitize_content( $content );

		if ( get_option( self::OPTION_KEY, null ) === null ) {
			add_option( self::OPTION_KEY, array( 'content' => $sanitized ), '', false );
		} else {
			update_option( self::OPTION_KEY, array( 'content' => $sanitized ), false );
		}
	}

	public static function reset_settings(): void {
		self::save_content( self::default_content() );
	}

	public static function sitemap_url(): string {
		if ( class_exists( 'Neo_Pulse_Wp_Sitemap_Settings', false ) ) {
			return Neo_Pulse_Wp_Sitemap_Settings::index_url();
		}
		return function_exists( 'home_url' ) ? home_url( '/sitemap_index.xml' ) : '/sitemap_index.xml';
	}

	public static function sitemap_line( string $url = '' ): string {
		$url = trim( $url );
		if ( $url === '' ) {
			$url = self::sitemap_url();
		}
		return 'Sitemap: ' . $url;
	}

	public static function has_sitemap_line( string $content ): bool {
		foreach ( explode( "\n", self::sanitize_content( $content ) ) as $line ) {
			if ( stripos( ltrim( $line ), 'Sitemap:' ) === 0 ) {
				return true;
			}
		}
		return false;
	}

	public static function with_sitemap_line( string $content, string $url = '' ): string {
		$content = rtrim( self::sanitize_content( $content ) );
		if ( self::has_sitemap_line( $content ) ) {
			return $content;
		}
		$line = self::sitemap_line( $url );
		if ( $content === '' ) {
			return $line;
		}
		return $content . "\n" . $line;
	}

	public static function filter_robots_txt( string $output, bool $public ): string {
		unset( $output );
		$content = self::get_content();
		if ( $content === '' ) {
			return self::default_content( $public );
		}
		if ( ! $public ) {
			return $content;
		}
		return self::with_sitemap_line( self::with_ai_bot_allows( $content ) );
	}

	/**
	 * Semrush AI Search Health named crawlers.
	 *
	 * @return array<int, string>
	 */
	public static function ai_bot_user_agents(): array {
		return array(
			'GPTBot',
			'OAI-SearchBot',
			'ChatGPT-User',
			'PerplexityBot',
			'ClaudeBot',
			'Google-Extended',
			'Applebot-Extended',
			'Amazonbot',
		);
	}

	/**
	 * Same crawl blocks as User-agent: *, including noindexed Elementor e-page URLs.
	 *
	 * @return array<int, string>
	 */
	public static function shared_disallow_lines(): array {
		return array(
			'Disallow: /wp-admin/',
			'Allow: /wp-admin/admin-ajax.php',
			'Disallow: /wp-json/',
			'Disallow: /feed/',
			'Disallow: /*/feed/',
			'Disallow: /search/',
			'Disallow: /?s=',
			'Disallow: /author/',
			'Disallow: /tag/',
			'Disallow: /page/',
			'Disallow: /*/page/',
			'Disallow: /*?*e-page-',
		);
	}

	public static function ai_bot_allows_block(): string {
		$lines = array();
		foreach ( self::ai_bot_user_agents() as $bot ) {
			$lines[] = 'User-agent: ' . $bot;
			$lines[] = 'Allow: /';
			foreach ( self::shared_disallow_lines() as $rule ) {
				$lines[] = $rule;
			}
			$lines[] = '';
		}
		return rtrim( implode( "\n", $lines ) );
	}

	public static function with_ai_bot_allows( string $content ): string {
		$content = rtrim( self::strip_ai_bot_groups( $content ) );
		$block   = self::ai_bot_allows_block();
		if ( $content === '' ) {
			return $block;
		}
		return $content . "\n\n" . $block;
	}

	/**
	 * Drop named AI groups so they can be rewritten with the same Disallows as *.
	 */
	public static function strip_ai_bot_groups( string $content ): string {
		$content = self::sanitize_content( $content );
		$bots    = array_map( 'preg_quote', self::ai_bot_user_agents() );
		$pattern = '/(?:^|\n)User-agent:\s*(?:' . implode( '|', $bots ) . ')[ \t]*(?:\n(?!User-agent:|Sitemap:)[^\n]*)*/i';
		$stripped = preg_replace( $pattern, "\n", $content );
		$stripped = is_string( $stripped ) ? $stripped : $content;
		return trim( preg_replace( "/\n{3,}/", "\n\n", $stripped ) ?? $stripped );
	}

	public static function default_content( ?bool $public = null ): string {
		if ( null === $public ) {
			$public = (bool) get_option( 'blog_public' );
		}

		$lines = array( 'User-agent: *' );
		if ( $public ) {
			foreach ( self::shared_disallow_lines() as $rule ) {
				$lines[] = $rule;
			}
			$lines[] = '';
			$lines[] = self::ai_bot_allows_block();
			$lines[] = self::sitemap_line();
		} else {
			$lines[] = 'Disallow: /';
		}

		return implode( "\n", $lines );
	}

	public static function preview_url(): string {
		return home_url( '/robots.txt' );
	}

	public static function has_physical_file(): bool {
		return is_readable( ABSPATH . 'robots.txt' );
	}

	public static function sanitize_content( string $content ): string {
		return str_replace( array( "\r\n", "\r" ), "\n", $content );
	}
}
