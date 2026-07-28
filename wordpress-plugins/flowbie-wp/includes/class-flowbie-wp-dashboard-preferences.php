<?php
/**
 * Per-user dashboard module layout (order + section groups).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Dashboard layout preferences (user meta + REST).
 */
class Flowbie_Wp_Dashboard_Preferences {

	const USER_META_ORDER  = 'flowbie_wp_dashboard_module_order';
	const USER_META_LAYOUT = 'flowbie_wp_dashboard_layout';

	const REST_NAMESPACE = 'flowbie/v1';

	const DEFAULT_GROUP_ID = 'default';

	const MAX_SECTION_TITLE_LENGTH = 80;

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/dashboard/module-order',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'rest_get_order' ),
					'permission_callback' => array( __CLASS__, 'rest_permission' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'rest_put_order' ),
					'permission_callback' => array( __CLASS__, 'rest_permission' ),
					'args'                => array(
						'order' => array(
							'required' => true,
							'type'     => 'array',
							'items'    => array(
								'type' => 'string',
							),
						),
					),
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/dashboard/layout',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'rest_get_layout' ),
					'permission_callback' => array( __CLASS__, 'rest_permission' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'rest_put_layout' ),
					'permission_callback' => array( __CLASS__, 'rest_permission' ),
					'args'                => array(
						'groups' => array(
							'required' => true,
							'type'     => 'array',
						),
					),
				),
			)
		);
	}

	public static function rest_permission(): bool {
		return current_user_can( Flowbie_Wp_Admin::required_capability() );
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function rest_get_order(): WP_REST_Response {
		$user_id = get_current_user_id();
		return new WP_REST_Response(
			array(
				'order' => self::flatten_layout_modules( self::get_layout_groups( $user_id ) ),
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_put_order( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		if ( $user_id < 1 ) {
			return new WP_Error(
				'flowbie_dashboard_order',
				__( 'You must be logged in to save dashboard order.', 'flowbie-wp' ),
				array( 'status' => 401 )
			);
		}

		$submitted = $request->get_param( 'order' );
		if ( ! is_array( $submitted ) ) {
			return new WP_Error(
				'flowbie_dashboard_order',
				__( 'Invalid order payload.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		$allowed = self::allowed_slugs_for_current_user();
		$clean   = self::sanitize_slug_list( $submitted, $allowed );
		if ( count( $clean ) !== count( $allowed ) ) {
			return new WP_Error(
				'flowbie_dashboard_order',
				__( 'Order must include each visible module exactly once.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		$groups = array(
			array(
				'id'      => self::DEFAULT_GROUP_ID,
				'title'   => '',
				'modules' => $clean,
			),
		);
		self::save_layout_groups( $user_id, $groups );

		return new WP_REST_Response(
			array(
				'order' => $clean,
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function rest_get_layout(): WP_REST_Response {
		$user_id = get_current_user_id();
		$modules = Flowbie_Wp_Admin::dashboard_modules();
		$groups  = self::resolve_layout_for_modules( $modules, self::get_layout_groups( $user_id ) );

		return new WP_REST_Response(
			array(
				'groups' => self::export_groups_for_client( $groups ),
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_put_layout( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		if ( $user_id < 1 ) {
			return new WP_Error(
				'flowbie_dashboard_layout',
				__( 'You must be logged in to save dashboard layout.', 'flowbie-wp' ),
				array( 'status' => 401 )
			);
		}

		$submitted = $request->get_param( 'groups' );
		if ( ! is_array( $submitted ) ) {
			return new WP_Error(
				'flowbie_dashboard_layout',
				__( 'Invalid layout payload.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		$allowed = self::allowed_slugs_for_current_user();
		$clean   = self::sanitize_layout_groups( $submitted, $allowed );
		if ( is_wp_error( $clean ) ) {
			return $clean;
		}

		self::save_layout_groups( $user_id, $clean );

		return new WP_REST_Response(
			array(
				'groups' => self::export_groups_for_client( $clean ),
			),
			200
		);
	}

	/**
	 * @return array<int, string>
	 */
	public static function allowed_slugs_for_current_user(): array {
		$modules = Flowbie_Wp_Admin::dashboard_modules();
		$slugs   = array();
		foreach ( $modules as $module ) {
			if ( ! is_array( $module ) ) {
				continue;
			}
			$slug = isset( $module['slug'] ) ? sanitize_key( (string) $module['slug'] ) : '';
			if ( $slug !== '' ) {
				$slugs[] = $slug;
			}
		}
		return $slugs;
	}

	/**
	 * @param int $user_id User ID.
	 * @return array<int, string>
	 */
	public static function get_module_order( int $user_id ): array {
		return self::flatten_layout_modules( self::get_layout_groups( $user_id ) );
	}

	/**
	 * @param int              $user_id User ID.
	 * @param array<int,mixed> $slugs   Ordered slugs.
	 */
	public static function save_module_order( int $user_id, array $slugs ): bool {
		if ( $user_id < 1 ) {
			return false;
		}
		$allowed = null;
		if ( $user_id === get_current_user_id() ) {
			$allowed = self::allowed_slugs_for_current_user();
		}
		$clean = self::sanitize_slug_list( $slugs, $allowed );
		return self::save_layout_groups(
			$user_id,
			array(
				array(
					'id'      => self::DEFAULT_GROUP_ID,
					'title'   => '',
					'modules' => $clean,
				),
			)
		);
	}

	/**
	 * @param int $user_id User ID.
	 * @return array<int, array{id:string,title:string,modules:array<int,string>}>
	 */
	public static function get_layout_groups( int $user_id ): array {
		if ( $user_id < 1 ) {
			return array();
		}

		$raw = get_user_meta( $user_id, self::USER_META_LAYOUT, true );
		if ( is_array( $raw ) && isset( $raw['groups'] ) && is_array( $raw['groups'] ) ) {
			$groups = self::sanitize_layout_groups_structure( $raw['groups'], null );
			if ( ! empty( $groups ) ) {
				return $groups;
			}
		}

		$legacy = get_user_meta( $user_id, self::USER_META_ORDER, true );
		if ( is_array( $legacy ) && ! empty( $legacy ) ) {
			$order = self::sanitize_slug_list( $legacy, null );
			if ( ! empty( $order ) ) {
				return array(
					array(
						'id'      => self::DEFAULT_GROUP_ID,
						'title'   => '',
						'modules' => $order,
					),
				);
			}
		}

		return array();
	}

	/**
	 * @param int   $user_id User ID.
	 * @param array $groups  Sanitized groups.
	 */
	public static function save_layout_groups( int $user_id, array $groups ): bool {
		if ( $user_id < 1 ) {
			return false;
		}
		return (bool) update_user_meta(
			$user_id,
			self::USER_META_LAYOUT,
			array(
				'groups' => $groups,
			)
		);
	}

	/**
	 * @param array<int, array<string, mixed>> $modules Cap-filtered modules.
	 * @param array<int, array<string, mixed>> $groups  Stored layout groups.
	 * @return array<int, array{id:string,title:string,modules:array<int,array<string,mixed>>}>
	 */
	public static function resolve_layout_for_modules( array $modules, array $groups ): array {
		$by_slug = array();
		foreach ( $modules as $module ) {
			if ( ! is_array( $module ) ) {
				continue;
			}
			$slug = isset( $module['slug'] ) ? sanitize_key( (string) $module['slug'] ) : '';
			if ( $slug !== '' ) {
				$by_slug[ $slug ] = $module;
			}
		}

		if ( empty( $by_slug ) ) {
			return array();
		}

		if ( empty( $groups ) ) {
			$groups = array(
				array(
					'id'      => self::DEFAULT_GROUP_ID,
					'title'   => '',
					'modules' => array_keys( $by_slug ),
				),
			);
		}

		$resolved = array();
		$used     = array();

		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$id      = isset( $group['id'] ) ? sanitize_key( (string) $group['id'] ) : '';
			$title   = isset( $group['title'] ) ? self::sanitize_section_title( (string) $group['title'] ) : '';
			$slugs   = isset( $group['modules'] ) && is_array( $group['modules'] ) ? $group['modules'] : array();
			$mod_out = array();

			foreach ( $slugs as $slug ) {
				$key = sanitize_key( (string) $slug );
				if ( $key === '' || ! isset( $by_slug[ $key ] ) || isset( $used[ $key ] ) ) {
					continue;
				}
				$mod_out[]     = $by_slug[ $key ];
				$used[ $key ] = true;
			}

			if ( $id === '' ) {
				$id = self::generate_group_id();
			}

			$resolved[] = array(
				'id'      => $id,
				'title'   => $title,
				'modules' => $mod_out,
			);
		}

		$orphans = array();
		foreach ( $by_slug as $slug => $module ) {
			if ( ! isset( $used[ $slug ] ) ) {
				$orphans[] = $module;
			}
		}

		if ( ! empty( $orphans ) ) {
			if ( empty( $resolved ) ) {
				$resolved[] = array(
					'id'      => self::DEFAULT_GROUP_ID,
					'title'   => '',
					'modules' => array(),
				);
			}
			$last = count( $resolved ) - 1;
			foreach ( $orphans as $module ) {
				$resolved[ $last ]['modules'][] = $module;
			}
		}

		if ( empty( $resolved ) ) {
			$resolved[] = array(
				'id'      => self::DEFAULT_GROUP_ID,
				'title'   => '',
				'modules' => array_values( $by_slug ),
			);
		}

		return $resolved;
	}

	/**
	 * @param array<int, array{id:string,title:string,modules:array<int,array<string,mixed>>}> $groups Resolved groups.
	 * @return array<int, array{id:string,title:string,modules:array<int,string>}>
	 */
	public static function export_groups_for_client( array $groups ): array {
		$out = array();
		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$slugs = array();
			if ( isset( $group['modules'] ) && is_array( $group['modules'] ) ) {
				foreach ( $group['modules'] as $module ) {
					if ( is_array( $module ) && isset( $module['slug'] ) ) {
						$slugs[] = sanitize_key( (string) $module['slug'] );
					} elseif ( is_string( $module ) ) {
						$slugs[] = sanitize_key( $module );
					}
				}
			}
			$out[] = array(
				'id'      => isset( $group['id'] ) ? sanitize_key( (string) $group['id'] ) : self::generate_group_id(),
				'title'   => isset( $group['title'] ) ? self::sanitize_section_title( (string) $group['title'] ) : '',
				'modules' => $slugs,
			);
		}
		return $out;
	}

	/**
	 * @param array<int, array{id:string,title:string,modules:array<int,string>}> $groups Groups.
	 * @return array<int, string>
	 */
	public static function flatten_layout_modules( array $groups ): array {
		$flat = array();
		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) || ! isset( $group['modules'] ) || ! is_array( $group['modules'] ) ) {
				continue;
			}
			foreach ( $group['modules'] as $slug ) {
				$key = sanitize_key( (string) $slug );
				if ( $key !== '' ) {
					$flat[] = $key;
				}
			}
		}
		return $flat;
	}

	/**
	 * @param array<int, array<string, mixed>> $modules     Cap-filtered modules.
	 * @param array<int, string>               $saved_order Stored slug order.
	 * @return array<int, array<string, mixed>>
	 */
	public static function apply_order_to_modules( array $modules, array $saved_order ): array {
		$groups = array(
			array(
				'id'      => self::DEFAULT_GROUP_ID,
				'title'   => '',
				'modules' => $saved_order,
			),
		);
		$resolved = self::resolve_layout_for_modules( $modules, $groups );
		$flat     = array();
		foreach ( $resolved as $group ) {
			foreach ( $group['modules'] as $module ) {
				$flat[] = $module;
			}
		}
		return $flat;
	}

	public static function generate_group_id(): string {
		$suffix = '';
		if ( function_exists( 'wp_generate_password' ) ) {
			$suffix = wp_generate_password( 6, false, false );
		} else {
			$suffix = substr( md5( uniqid( (string) wp_rand(), true ) ), 0, 6 );
		}
		return 'grp_' . sanitize_key( strtolower( $suffix ) );
	}

	/**
	 * @param string $title Section title.
	 */
	public static function sanitize_section_title( string $title ): string {
		$title = wp_strip_all_tags( $title );
		$title = trim( $title );
		if ( function_exists( 'mb_strlen' ) && mb_strlen( $title ) > self::MAX_SECTION_TITLE_LENGTH ) {
			$title = mb_substr( $title, 0, self::MAX_SECTION_TITLE_LENGTH );
		} elseif ( strlen( $title ) > self::MAX_SECTION_TITLE_LENGTH ) {
			$title = substr( $title, 0, self::MAX_SECTION_TITLE_LENGTH );
		}
		return $title;
	}

	/**
	 * @param array<int,mixed>   $groups  Raw groups.
	 * @param array<int,string>|null $allowed Allowed slugs.
	 * @return array<int, array{id:string,title:string,modules:array<int,string>}>|WP_Error
	 */
	public static function sanitize_layout_groups( array $groups, ?array $allowed ) {
		if ( empty( $groups ) ) {
			return new WP_Error(
				'flowbie_dashboard_layout',
				__( 'At least one section is required.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		$clean = self::sanitize_layout_groups_structure( $groups, $allowed );
		if ( empty( $clean ) ) {
			return new WP_Error(
				'flowbie_dashboard_layout',
				__( 'Invalid layout sections.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		if ( is_array( $allowed ) ) {
			$flat    = self::flatten_layout_modules( $clean );
			$unique  = array_unique( $flat );
			if ( count( $flat ) !== count( $allowed ) || count( $unique ) !== count( $allowed ) ) {
				return new WP_Error(
					'flowbie_dashboard_layout',
					__( 'Layout must include each visible module exactly once.', 'flowbie-wp' ),
					array( 'status' => 400 )
				);
			}
		}

		return $clean;
	}

	/**
	 * @param array<int,mixed>        $groups  Input groups.
	 * @param array<int,string>|null $allowed Allowed module slugs.
	 * @return array<int, array{id:string,title:string,modules:array<int,string>}>
	 */
	private static function sanitize_layout_groups_structure( array $groups, ?array $allowed ): array {
		$out  = array();
		$seen = array();

		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$id = isset( $group['id'] ) ? sanitize_key( (string) $group['id'] ) : '';
			if ( $id === '' || isset( $seen[ $id ] ) ) {
				$id = self::generate_group_id();
			}
			$seen[ $id ] = true;

			$modules_raw = isset( $group['modules'] ) && is_array( $group['modules'] ) ? $group['modules'] : array();
			$modules     = self::sanitize_slug_list( $modules_raw, $allowed );

			$out[] = array(
				'id'      => $id,
				'title'   => isset( $group['title'] ) ? self::sanitize_section_title( (string) $group['title'] ) : '',
				'modules' => $modules,
			);
		}

		return $out;
	}

	/**
	 * @param array<int,mixed>        $slugs   Input slugs.
	 * @param array<int,string>|null $allowed If set, only these slugs are kept.
	 * @return array<int, string>
	 */
	private static function sanitize_slug_list( array $slugs, ?array $allowed ): array {
		$allowed_lookup = null;
		if ( is_array( $allowed ) ) {
			$allowed_lookup = array_fill_keys( $allowed, true );
		}

		$out  = array();
		$seen = array();
		foreach ( $slugs as $slug ) {
			$key = sanitize_key( (string) $slug );
			if ( $key === '' || isset( $seen[ $key ] ) ) {
				continue;
			}
			if ( is_array( $allowed_lookup ) && ! isset( $allowed_lookup[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$out[]        = $key;
		}
		return $out;
	}
}
