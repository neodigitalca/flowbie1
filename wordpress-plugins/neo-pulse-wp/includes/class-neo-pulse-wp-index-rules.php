<?php
/**
 * Keep crawlers on valuable URLs: core pages, posts, service areas, and work.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * noindex + attachment redirects for pagination, archives, templates, and media pages.
 */
class Neo_Pulse_Wp_Index_Rules {

	/**
	 * Builder/template CPTs that must not be indexed.
	 *
	 * @return array<int, string>
	 */
	public static function template_post_types(): array {
		return array(
			'elementor_library',
			'e-floating-buttons',
			'ygency_template',
			'qi-addons-template',
		);
	}

	/**
	 * @return array<int, string>
	 */
	public static function noindex_post_types(): array {
		return array_merge( array( 'attachment' ), self::template_post_types() );
	}

	/**
	 * @return array<int, string>
	 */
	public static function noindex_taxonomies(): array {
		return array( 'post_tag', 'post_format' );
	}

	/**
	 * @return array<int, string>
	 */
	public static function noindex_page_slugs(): array {
		return array( 'thank-you' );
	}

	public static function init(): void {
		add_filter( 'wp_robots', array( __CLASS__, 'filter_robots' ), 99 );
		add_action( 'send_headers', array( __CLASS__, 'send_noindex_header' ), 0 );
		add_action( 'template_redirect', array( __CLASS__, 'redirect_attachment_pages' ), 0 );
	}

	/**
	 * Elementor Loop Grid / Loop Carousel pagination (?e-page-{id}=N).
	 *
	 * @param array<string, mixed>|null $query Query args. Defaults to $_GET.
	 */
	public static function request_has_elementor_epage( ?array $query = null ): bool {
		$query = $query ?? ( isset( $_GET ) && is_array( $_GET ) ? $_GET : array() );
		foreach ( array_keys( $query ) as $key ) {
			if ( is_string( $key ) && strncmp( $key, 'e-page-', 7 ) === 0 ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<string, mixed> $robots Robots directives.
	 * @return array<string, mixed>
	 */
	public static function filter_robots( $robots ): array {
		if ( ! is_array( $robots ) ) {
			$robots = array();
		}
		if ( ! self::should_noindex() ) {
			return $robots;
		}
		$robots['noindex'] = true;
		$robots['follow']  = true;
		unset( $robots['index'] );
		return $robots;
	}

	public static function should_noindex(): bool {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
			return false;
		}
		if ( self::request_has_elementor_epage() ) {
			return true;
		}
		if ( is_search() || is_author() || is_date() || is_attachment() || is_feed() || is_404() ) {
			return true;
		}
		if ( is_paged() ) {
			return true;
		}
		if ( is_tag() ) {
			return true;
		}
		foreach ( self::noindex_taxonomies() as $taxonomy ) {
			if ( function_exists( 'is_tax' ) && is_tax( $taxonomy ) ) {
				return true;
			}
		}
		if ( is_singular( self::noindex_post_types() ) ) {
			return true;
		}
		if ( is_singular( 'page' ) ) {
			$slug = get_post_field( 'post_name', get_queried_object_id() );
			if ( in_array( (string) $slug, self::noindex_page_slugs(), true ) ) {
				return true;
			}
		}
		return false;
	}

	public static function send_noindex_header(): void {
		if ( ! self::request_has_elementor_epage() ) {
			return;
		}
		if ( ! headers_sent() ) {
			header( 'X-Robots-Tag: noindex, follow', false );
		}
	}

	public static function redirect_attachment_pages(): void {
		if ( ! is_attachment() ) {
			return;
		}
		$id     = (int) get_queried_object_id();
		$parent = $id > 0 ? (int) wp_get_post_parent_id( $id ) : 0;
		$url    = $parent > 0 ? get_permalink( $parent ) : wp_get_attachment_url( $id );
		if ( ! is_string( $url ) || $url === '' ) {
			return;
		}
		wp_safe_redirect( $url, 301 );
		exit;
	}
}
