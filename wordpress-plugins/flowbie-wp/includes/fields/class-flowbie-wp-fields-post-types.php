<?php
/**
 * Register post types from Flowbie Fields UI.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Post_Types {

	/** @var array<string, true> Post types Flowbie registered on this request. */
	private static $flowbie_registered = array();

	/** @var array<string, true> Active Flowbie configs where the type existed before register_all. */
	private static $external_registrars = array();

	/** @var array<string, true>|null Cached slugs Flowbie manages for capability fixes. */
	private static $managed_slugs_cache = null;

	/** @var bool Guard against re-entrancy while patching caps. */
	private static $applying_capability_fixes = false;

	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'detect_external_registrars' ), 19 );
		add_action( 'init', array( __CLASS__, 'register_all' ), 20 );
		add_action( 'init', array( __CLASS__, 'apply_capability_fixes' ), 99 );
		add_action( 'admin_init', array( __CLASS__, 'apply_capability_fixes' ), 1 );
		add_filter( 'register_post_type_args', array( __CLASS__, 'filter_registration_args' ), 99, 2 );
	}

	/**
	 * Record CPTs already registered by another plugin (e.g. ACF) before Flowbie runs.
	 */
	public static function detect_external_registrars(): void {
		self::$external_registrars = array();
		foreach ( self::get_active_configs() as $config ) {
			$key = (string) ( $config['post_type'] ?? $config['key'] ?? '' );
			if ( $key !== '' && post_type_exists( $key ) ) {
				self::$external_registrars[ $key ] = true;
			}
		}
	}

	public static function register_all(): void {
		foreach ( self::get_active_configs() as $config ) {
			self::register_one( $config );
		}
	}

	/**
	 * Whether another plugin registered this slug before Flowbie's register_all.
	 */
	public static function is_external_registrar( string $slug ): bool {
		return $slug !== '' && ! empty( self::$external_registrars[ $slug ] );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_active_configs(): array {
		$out = array();
		foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_POST_TYPE ) as $config ) {
			if ( isset( $config['active'] ) && ! $config['active'] ) {
				continue;
			}
			$out[] = $config;
		}
		return $out;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function get_config_for_slug( string $slug ): ?array {
		if ( $slug === '' ) {
			return null;
		}
		foreach ( self::get_active_configs() as $config ) {
			if ( (string) ( $config['post_type'] ?? $config['key'] ?? '' ) === $slug ) {
				return $config;
			}
		}
		return null;
	}

	/**
	 * Capability args Flowbie should enforce for a post type, or null when not managed.
	 *
	 * @return array{capability_type: string, map_meta_cap: bool}|null
	 */
	public static function is_managed_post_type( string $post_type ): bool {
		if ( $post_type === '' ) {
			return false;
		}
		$managed = self::get_managed_post_type_slugs();
		return ! empty( $managed[ $post_type ] );
	}

	public static function get_capability_args_for_post_type( string $post_type ): ?array {
		if ( ! self::is_managed_post_type( $post_type ) ) {
			return null;
		}
		$config = self::get_config_for_slug( $post_type );
		if ( $config ) {
			return self::build_capability_args_from_config( $config );
		}
		return array(
			'capability_type' => 'post',
			'map_meta_cap'    => true,
		);
	}

	/**
	 * @return array<string, true>
	 */
	public static function get_managed_post_type_slugs(): array {
		if ( self::$managed_slugs_cache !== null ) {
			return self::$managed_slugs_cache;
		}
		if ( ! post_type_exists( Flowbie_Wp_Fields_Storage::CPT_GROUP ) ) {
			self::$managed_slugs_cache = array();
			return self::$managed_slugs_cache;
		}
		$slugs = Flowbie_Wp_Fields_Post_Type_Caps::get_field_group_post_types();
		foreach ( self::get_active_configs() as $config ) {
			$key = (string) ( $config['post_type'] ?? $config['key'] ?? '' );
			if ( $key !== '' ) {
				$slugs[ $key ] = true;
			}
		}
		self::$managed_slugs_cache = $slugs;
		return $slugs;
	}

	/**
	 * Merge capability args onto registrations from any source (ACF, theme, Flowbie).
	 *
	 * ACF often passes an explicit "capabilities" array; remove it so capability_type applies.
	 *
	 * @param array<string, mixed> $args      Registration args.
	 * @param string               $post_type Post type slug.
	 * @return array<string, mixed>
	 */
	public static function filter_registration_args( array $args, string $post_type ): array {
		if ( self::$applying_capability_fixes || ! self::is_managed_post_type( $post_type ) ) {
			return $args;
		}
		$cap_args = self::get_capability_args_for_post_type( $post_type );
		if ( ! $cap_args ) {
			return $args;
		}
		unset( $args['capabilities'] );
		return array_merge( $args, $cap_args );
	}

	/**
	 * Re-apply caps after all plugins register (ACF may register late or use explicit capabilities).
	 */
	public static function apply_capability_fixes(): void {
		if ( self::$applying_capability_fixes || ! function_exists( 'get_post_type_capabilities' ) ) {
			return;
		}
		self::$applying_capability_fixes = true;
		foreach ( array_keys( self::get_managed_post_type_slugs() ) as $post_type ) {
			$pto = get_post_type_object( $post_type );
			if ( ! $pto instanceof WP_Post_Type ) {
				continue;
			}
			$cap_args = self::get_capability_args_for_post_type( $post_type );
			if ( $cap_args ) {
				self::patch_post_type_capabilities( $pto, $cap_args );
			}
		}
		self::$applying_capability_fixes = false;
	}

	/**
	 * @param WP_Post_Type                              $pto      Post type object.
	 * @param array{capability_type: string, map_meta_cap: bool} $cap_args Capability args.
	 */
	public static function patch_post_type_capabilities( WP_Post_Type $pto, array $cap_args ): void {
		$capability_type = $cap_args['capability_type'] ?? 'post';
		if ( is_array( $capability_type ) ) {
			$capability_type = (string) ( $capability_type[0] ?? 'post' );
		}
		$pto->capability_type = (string) $capability_type;
		$pto->map_meta_cap    = ! empty( $cap_args['map_meta_cap'] );
		$pto->cap             = get_post_type_capabilities(
			(object) array(
				'capability_type' => $pto->capability_type,
				'map_meta_cap'    => $pto->map_meta_cap,
			)
		);
	}

	/**
	 * @param array<string, mixed> $config Post type config.
	 * @return array<string, mixed>
	 */
	public static function build_registration_args_from_config( array $config ): array {
		$key = (string) ( $config['post_type'] ?? $config['key'] ?? '' );
		$labels  = isset( $config['labels'] ) && is_array( $config['labels'] ) ? $config['labels'] : array();
		$rewrite = isset( $config['rewrite'] ) && is_array( $config['rewrite'] ) ? $config['rewrite'] : array();
		$rewrite_args = false;
		if ( ! empty( $config['has_archive'] ) || ! empty( $rewrite['slug'] ) || isset( $rewrite['with_front'] ) || ! empty( $rewrite['permalink_rewrite'] ) ) {
			$slug = (string) ( $rewrite['slug'] ?? '' );
			if ( $slug === '' && ( ( $rewrite['permalink_rewrite'] ?? '' ) === 'post_type_key' || $key !== '' ) ) {
				$slug = $key;
			}
			$rewrite_args = array(
				'slug'       => $slug !== '' ? $slug : $key,
				'with_front' => ! empty( $rewrite['with_front'] ),
			);
		}
		$menu_icon = Flowbie_Wp_Fields_Import_Export::normalize_menu_icon( $config['menu_icon'] ?? 'dashicons-admin-post' );
		$taxonomies = $config['taxonomies'] ?? array();
		if ( ! is_array( $taxonomies ) ) {
			$taxonomies = $taxonomies === '' || $taxonomies === null ? array() : array( (string) $taxonomies );
		}
		$args = array(
			'labels'            => $labels,
			'description'       => (string) ( $config['description'] ?? '' ),
			'public'            => ! empty( $config['public'] ),
			'hierarchical'      => ! empty( $config['hierarchical'] ),
			'show_ui'           => ! empty( $config['show_ui'] ),
			'show_in_menu'      => ! empty( $config['show_in_menu'] ),
			'show_in_admin_bar' => ! empty( $config['show_in_admin_bar'] ),
			'show_in_rest'      => ! empty( $config['show_in_rest'] ),
			'menu_icon'         => $menu_icon,
			'supports'          => isset( $config['supports'] ) ? (array) $config['supports'] : array( 'title', 'editor' ),
			'has_archive'       => ! empty( $config['has_archive'] ),
			'rewrite'           => $rewrite_args,
			'taxonomies'        => $taxonomies,
		);
		$args = array_merge( $args, self::build_capability_args_from_config( $config ) );
		if ( isset( $config['menu_position'] ) && $config['menu_position'] !== '' ) {
			$args['menu_position'] = (int) $config['menu_position'];
		}
		if ( ! empty( $config['rest_base'] ) ) {
			$args['rest_base'] = (string) $config['rest_base'];
		}
		if ( ! empty( $config['rest_namespace'] ) ) {
			$args['rest_namespace'] = (string) $config['rest_namespace'];
		}
		return $args;
	}

	/**
	 * @param array<string, mixed> $config Post type config.
	 * @return array<string, mixed>
	 */
	public static function build_capability_args_from_config( array $config ): array {
		$capability_type = $config['capability_type'] ?? 'post';
		if ( is_array( $capability_type ) ) {
			$capability_type = (string) ( $capability_type[0] ?? 'post' );
		} else {
			$capability_type = (string) $capability_type;
		}
		$map_meta_cap    = ! isset( $config['map_meta_cap'] ) || ! empty( $config['map_meta_cap'] );
		if ( $capability_type === 'post' ) {
			$map_meta_cap = true;
		}
		return array(
			'capability_type' => $capability_type,
			'map_meta_cap'    => $map_meta_cap,
		);
	}

	/**
	 * @param array<string, mixed> $config Post type config.
	 */
	public static function register_one( array $config ): void {
		$key = (string) ( $config['post_type'] ?? $config['key'] ?? '' );
		if ( $key === '' || post_type_exists( $key ) ) {
			return;
		}
		register_post_type( $key, self::build_registration_args_from_config( $config ) );
		self::$flowbie_registered[ $key ] = true;
	}

	/**
	 * @param array<string, mixed> $config Post type config.
	 */
	public static function save( array $config ): int {
		return Flowbie_Wp_Fields_Storage::save_entity(
			Flowbie_Wp_Fields_Storage::CPT_POST_TYPE,
			$config,
			'post_type'
		);
	}

	public static function delete( string $slug ): bool {
		return Flowbie_Wp_Fields_Storage::delete_entity(
			Flowbie_Wp_Fields_Storage::CPT_POST_TYPE,
			$slug,
			'post_type'
		);
	}
}
