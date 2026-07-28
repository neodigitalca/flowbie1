<?php
/**
 * Sitemap rewrite rules, request handling, shortcode, and REST.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Front-end sitemap delivery and REST API.
 */
class Flowbie_Wp_Sitemap {

	const QUERY_VAR = 'flowbie_sitemap';

	/**
	 * Hook registrations.
	 */
	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'register_rewrites' ), 5 );
		add_filter( 'query_vars', array( __CLASS__, 'register_query_vars' ) );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_serve_sitemap' ), 0 );
		add_filter( 'wp_sitemaps_enabled', array( __CLASS__, 'maybe_disable_core_sitemaps' ) );
		add_shortcode( 'flowbie_sitemap', array( __CLASS__, 'shortcode_html_sitemap' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_action( 'save_post', array( __CLASS__, 'flush_cache_on_content_change' ), 20, 1 );
		add_action( 'deleted_post', array( __CLASS__, 'flush_cache_on_content_change' ), 20, 1 );
		add_action( 'created_term', array( __CLASS__, 'flush_cache_on_term_change' ), 20, 1 );
		add_action( 'edited_term', array( __CLASS__, 'flush_cache_on_term_change' ), 20, 1 );
		add_action( 'delete_term', array( __CLASS__, 'flush_cache_on_term_change' ), 20, 1 );
	}

	/**
	 * @param mixed $enabled Core sitemap enabled flag.
	 * @return bool
	 */
	public static function maybe_disable_core_sitemaps( $enabled ): bool {
		$config = Flowbie_Wp_Sitemap_Settings::get_config();
		if ( ! empty( $config['general']['enabled'] ) ) {
			return false;
		}
		return (bool) $enabled;
	}

	public static function register_rewrites(): void {
		add_rewrite_rule( '^sitemap_index\.xml$', 'index.php?' . self::QUERY_VAR . '=index', 'top' );
		add_rewrite_rule( '^([a-z0-9_-]+)-sitemap([0-9]+)?\.xml$', 'index.php?' . self::QUERY_VAR . '=child&flowbie_sitemap_type=$matches[1]&flowbie_sitemap_page=$matches[2]', 'top' );
	}

	/**
	 * @param array<int, string> $vars Query vars.
	 * @return array<int, string>
	 */
	public static function register_query_vars( array $vars ): array {
		$vars[] = self::QUERY_VAR;
		$vars[] = 'flowbie_sitemap_type';
		$vars[] = 'flowbie_sitemap_page';
		return $vars;
	}

	public static function maybe_serve_sitemap(): void {
		$config = Flowbie_Wp_Sitemap_Settings::get_config();
		if ( empty( $config['general']['enabled'] ) ) {
			return;
		}

		$kind = get_query_var( self::QUERY_VAR );
		if ( ! is_string( $kind ) || $kind === '' ) {
			return;
		}

		if ( 'index' === $kind ) {
			self::output_xml( self::get_index_xml( $config ) );
		}

		if ( 'child' === $kind ) {
			$type = sanitize_key( (string) get_query_var( 'flowbie_sitemap_type' ) );
			$page = max( 1, (int) get_query_var( 'flowbie_sitemap_page' ) );
			if ( $page < 1 ) {
				$page = 1;
			}
			$xml = self::get_child_xml( $type, $page, $config );
			if ( $xml === null ) {
				status_header( 404 );
				exit;
			}
			self::output_xml( $xml );
		}
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 */
	private static function get_index_xml( array $config ): string {
		$key = Flowbie_Wp_Sitemap_Cache::cache_key( 'index' );
		$cached = Flowbie_Wp_Sitemap_Cache::get( $key );
		if ( $cached !== null ) {
			return $cached;
		}
		$xml = Flowbie_Wp_Sitemap_Generator::build_index( $config );
		Flowbie_Wp_Sitemap_Cache::set( $key, $xml );
		return $xml;
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 */
	private static function get_child_xml( string $type, int $page, array $config ): ?string {
		$is_post_type = isset( $config['post_types'][ $type ] ) && ! empty( $config['post_types'][ $type ]['include_xml'] );
		$is_taxonomy  = isset( $config['taxonomies'][ $type ] ) && ! empty( $config['taxonomies'][ $type ]['include_xml'] );

		if ( ! $is_post_type && ! $is_taxonomy ) {
			return null;
		}

		$key    = Flowbie_Wp_Sitemap_Cache::cache_key( $is_post_type ? 'post_type' : 'taxonomy', $type, $page );
		$cached = Flowbie_Wp_Sitemap_Cache::get( $key );
		if ( $cached !== null ) {
			return $cached;
		}

		if ( $is_post_type ) {
			$max_pages = Flowbie_Wp_Sitemap_Generator::post_type_page_count( $type, $config );
			if ( $page > $max_pages ) {
				return null;
			}
			$xml = Flowbie_Wp_Sitemap_Generator::build_post_type_sitemap( $type, $page, $config );
		} else {
			$max_pages = Flowbie_Wp_Sitemap_Generator::taxonomy_page_count( $type, $config );
			if ( $page > $max_pages ) {
				return null;
			}
			$xml = Flowbie_Wp_Sitemap_Generator::build_taxonomy_sitemap( $type, $page, $config );
		}

		Flowbie_Wp_Sitemap_Cache::set( $key, $xml );
		return $xml;
	}

	private static function output_xml( string $xml ): void {
		status_header( 200 );
		header( 'Content-Type: application/xml; charset=UTF-8' );
		header( 'X-Robots-Tag: noindex, follow', true );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- XML payload.
		echo $xml;
		exit;
	}

	/**
	 * @param array<string, string>|string $atts Shortcode attributes.
	 */
	public static function shortcode_html_sitemap( $atts = array() ): string {
		$config = Flowbie_Wp_Sitemap_Settings::get_config();
		if ( empty( $config['html']['enabled'] ) ) {
			return '';
		}
		return Flowbie_Wp_Sitemap_Generator::build_html( $config );
	}

	public static function flush_cache_on_content_change( $post_id ): void {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		Flowbie_Wp_Sitemap_Cache::flush_all();
	}

	public static function flush_cache_on_term_change( $term_id ): void {
		unset( $term_id );
		Flowbie_Wp_Sitemap_Cache::flush_all();
	}

	public static function flush_rewrites(): void {
		self::register_rewrites();
		flush_rewrite_rules();
	}

	/**
	 * Register REST API routes.
	 */
	public static function register_routes(): void {
		register_rest_route(
			'flowbie/v1',
			'/sitemap',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'rest_get' ),
					'permission_callback' => array( __CLASS__, 'manage_permission' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'rest_put' ),
					'permission_callback' => array( __CLASS__, 'manage_permission' ),
				),
			)
		);

		register_rest_route(
			'flowbie/v1',
			'/sitemap/flush',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_flush' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
			)
		);
	}

	/**
	 * @return bool|\WP_Error
	 */
	public static function manage_permission() {
		if ( ! is_user_logged_in() ) {
			return new WP_Error(
				'rest_not_logged_in',
				__( 'Authentication required.', 'flowbie-wp' ),
				array( 'status' => 401 )
			);
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to manage sitemap settings.', 'flowbie-wp' ),
				array( 'status' => 403 )
			);
		}
		return true;
	}

	/**
	 * @return \WP_REST_Response
	 */
	public static function rest_get(): WP_REST_Response {
		$config = Flowbie_Wp_Sitemap_Settings::get_config();
		return new WP_REST_Response(
			array(
				'ok'        => true,
				'config'    => $config,
				'indexUrl'  => Flowbie_Wp_Sitemap_Settings::index_url(),
				'conflicts' => Flowbie_Wp_Sitemap_Settings::conflicting_plugins(),
			),
			200
		);
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function rest_put( $request ) {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			return new WP_Error(
				'rest_invalid_param',
				__( 'Invalid JSON body.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		$config = isset( $body['config'] ) && is_array( $body['config'] )
			? Flowbie_Wp_Sitemap_Settings::sanitize_config( $body['config'] )
			: Flowbie_Wp_Sitemap_Settings::sanitize_config( $body );

		$previous = Flowbie_Wp_Sitemap_Settings::get_config();
		Flowbie_Wp_Sitemap_Settings::save_config( $config );
		Flowbie_Wp_Sitemap_Cache::flush_all();

		if ( (int) ( $previous['general']['links_per_sitemap'] ?? 200 ) !== (int) ( $config['general']['links_per_sitemap'] ?? 200 ) ) {
			self::flush_rewrites();
		}

		return new WP_REST_Response(
			array(
				'ok'       => true,
				'config'   => $config,
				'indexUrl' => Flowbie_Wp_Sitemap_Settings::index_url(),
			),
			200
		);
	}

	/**
	 * @return \WP_REST_Response
	 */
	public static function rest_flush(): WP_REST_Response {
		Flowbie_Wp_Sitemap_Cache::flush_all();
		return new WP_REST_Response(
			array(
				'ok'      => true,
				'message' => __( 'Sitemap cache flushed.', 'flowbie-wp' ),
			),
			200
		);
	}
}
