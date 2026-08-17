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

	public static function filter_robots_txt( string $output, bool $public ): string {
		$content = self::get_content();
		if ( $content === '' ) {
			return self::default_content( $public );
		}

		return $content;
	}

	public static function default_content( ?bool $public = null ): string {
		if ( null === $public ) {
			$public = (bool) get_option( 'blog_public' );
		}

		$lines = array( 'User-agent: *' );
		if ( $public ) {
			$lines[] = 'Disallow: /wp-admin/';
			$lines[] = 'Allow: /wp-admin/admin-ajax.php';
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
