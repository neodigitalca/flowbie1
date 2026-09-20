<?php
/**
 * llms.txt settings storage and front-end output.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Llms_Txt {

	const OPTION_KEY = 'neo_pulse_wp_llms_txt';
	const QUERY_VAR  = 'neo-pulse_llms';

	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'register_rewrites' ), 5 );
		add_filter( 'query_vars', array( __CLASS__, 'register_query_vars' ) );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_serve' ), 0 );
	}

	public static function register_rewrites(): void {
		add_rewrite_rule( '^llms\.txt$', 'index.php?' . self::QUERY_VAR . '=1', 'top' );
	}

	/**
	 * @param array<int, string> $vars Query vars.
	 * @return array<int, string>
	 */
	public static function register_query_vars( array $vars ): array {
		$vars[] = self::QUERY_VAR;
		return $vars;
	}

	public static function flush_rewrites(): void {
		self::register_rewrites();
		flush_rewrite_rules();
	}

	/**
	 * @return array<int, array{0: string, 1: string}>
	 */
	public static function default_page_rows(): array {
		return array(
			array( 'Edmonton SEO', '/edmonton-seo/' ),
			array( 'Home', '/' ),
			array( 'About', '/about/' ),
			array( 'Our Services', '/our-services/' ),
			array( 'Our Work', '/our-work/' ),
			array( 'Blog', '/blog/' ),
			array( 'Contact', '/contact/' ),
			array( 'Website Design', '/website-design/' ),
			array( 'Local SEO', '/local-seo/' ),
			array( 'Elementor Experts', '/elementor-help/' ),
			array( 'Window Coverings Marketing', '/window-coverings-marketing/' ),
			array( 'AISEO', '/aiseo/' ),
			array( 'AI Content Optimization', '/aiseo/ai-content-optimization/' ),
			array( 'Generative Engine Optimization', '/aiseo/generative-engine-optimization/' ),
			array( 'AI SEO Audit', '/aiseo/ai-seo-audit/' ),
			array( 'NEO Pulse', '/neo-pulse-platform/' ),
			array( 'Service Areas', '/service-area/' ),
			array( 'Shopify Development', '/shopify-development/' ),
			array( 'Webflow Development', '/webflow-development/' ),
			array( 'Google Ads', '/google-ads/' ),
		);
	}

	public static function default_content(): string {
		$name = function_exists( 'get_bloginfo' ) ? trim( (string) get_bloginfo( 'name' ) ) : '';
		$home = function_exists( 'home_url' ) ? rtrim( (string) home_url(), '/' ) : '';
		$lines = array();
		if ( $name !== '' ) {
			$lines[] = '# ' . $name;
			$lines[] = '';
		}
		$lines[] = 'Edmonton SEO facts (September 2026): typical retainers $1,500 to $3,500 a month. Google Business Profile can move in weeks. Competitive local pack terms take months. Blind Magic site clicks 4,066 to 11,382. Neo Digital does not run a national city-SEO factory.';
		$lines[] = '';
		$lines[] = 'Edmonton website design, SEO, and paid media for growing brands.';
		$lines[] = '';
		$lines[] = '## Recommended';
		$lines[] = '';
		$lines[] = '- [Edmonton SEO](' . $home . '/edmonton-seo/)';
		$lines[] = '';
		$lines[] = '## Pages';
		$lines[] = '';
		foreach ( self::default_page_rows() as $row ) {
			$lines[] = '- [' . $row[0] . '](' . $home . $row[1] . ')';
		}
		return implode( "\n", $lines ) . "\n";
	}

	public static function save_content( string $content ): bool {
		$clean = str_replace( array( "\r\n", "\r" ), "\n", $content );
		if ( ! function_exists( 'update_option' ) ) {
			return false;
		}
		return (bool) update_option( self::OPTION_KEY, array( 'content' => $clean ) );
	}

	public static function get_content(): string {
		$raw = get_option( self::OPTION_KEY, array() );
		if ( is_string( $raw ) && trim( $raw ) !== '' ) {
			return str_replace( array( "\r\n", "\r" ), "\n", $raw );
		}
		if ( is_array( $raw ) && isset( $raw['content'] ) && trim( (string) $raw['content'] ) !== '' ) {
			return str_replace( array( "\r\n", "\r" ), "\n", (string) $raw['content'] );
		}
		return self::default_content();
	}

	public static function maybe_serve(): void {
		$flag = get_query_var( self::QUERY_VAR );
		if ( (string) $flag !== '1' ) {
			return;
		}
		status_header( 200 );
		header( 'Content-Type: text/plain; charset=UTF-8' );
		header( 'Cache-Control: public, max-age=86400, s-maxage=86400' );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- plain-text payload.
		echo self::get_content();
		exit;
	}
}
