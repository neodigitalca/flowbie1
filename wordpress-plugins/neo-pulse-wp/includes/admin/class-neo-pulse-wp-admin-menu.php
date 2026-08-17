<?php
/**
 * Grouped NEO Pulse WP admin sidebar menu registry.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Central admin menu registration with section groups.
 */
class Neo_Pulse_Wp_Admin_Menu {

	const PARENT_SLUG = 'neo-pulse-wp';

	/**
	 * @var array<string, string> Page slug => group id (visible items only).
	 */
	private static $slug_group_map = array();

	public static function init(): void {
		add_action( 'admin_menu', array( __CLASS__, 'register' ) );
		add_action( 'admin_menu', array( __CLASS__, 'reorder_submenu' ), 999 );
		add_filter( 'parent_file', array( __CLASS__, 'filter_parent_file' ) );
		add_filter( 'submenu_file', array( __CLASS__, 'filter_submenu_file' ), 10, 2 );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
	}

	/**
	 * @return array<int, array{id:string,label:string,items:array<int, array<string, mixed>>}>
	 */
	public static function get_menu_definition(): array {
		$cap = Neo_Pulse_Wp_Admin::required_capability();

		return array(
			array(
				'id'    => 'general',
				'label' => __( 'General', 'neo-pulse-wp' ),
				'items' => array(
					array(
						'slug'       => 'neo-pulse-wp-settings',
						'page_title' => __( 'Settings', 'neo-pulse-wp' ),
						'menu_title' => __( 'Settings', 'neo-pulse-wp' ),
						'capability' => $cap,
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_settings_placeholder_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-analytics',
						'page_title' => __( 'Analytics', 'neo-pulse-wp' ),
						'menu_title' => __( 'Analytics', 'neo-pulse-wp' ),
						'capability' => $cap,
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_analytics_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-super-migrate',
						'page_title' => __( 'Super Import', 'neo-pulse-wp' ),
						'menu_title' => __( 'Super Import', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_super_migrate_page' ),
					),
				),
			),
			array(
				'id'    => 'seo',
				'label' => __( 'SEO', 'neo-pulse-wp' ),
				'items' => array(
					array(
						'slug'       => 'neo-pulse-wp-sitemap',
						'page_title' => __( 'Sitemap', 'neo-pulse-wp' ),
						'menu_title' => __( 'Sitemap', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_sitemap_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-robots-txt',
						'page_title' => __( 'robots.txt', 'neo-pulse-wp' ),
						'menu_title' => __( 'robots.txt', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_robots_txt_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-redirects',
						'page_title' => __( 'Redirects', 'neo-pulse-wp' ),
						'menu_title' => __( 'Redirects', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_redirects_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-image-seo',
						'page_title' => __( 'Image SEO', 'neo-pulse-wp' ),
						'menu_title' => __( 'Image SEO', 'neo-pulse-wp' ),
						'capability' => 'upload_files',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_image_seo_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-script-manager',
						'page_title' => __( 'Script Manager', 'neo-pulse-wp' ),
						'menu_title' => __( 'Script Manager', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_script_manager_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-speed',
						'page_title' => __( 'Speed', 'neo-pulse-wp' ),
						'menu_title' => __( 'Speed', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_speed_page' ),
					),
				),
			),
			array(
				'id'    => 'ai-tools',
				'label' => __( 'AI Tools', 'neo-pulse-wp' ),
				'items' => array(
					array(
						'slug'       => 'neo-pulse-wp-agent-hub',
						'page_title' => __( 'Block Builder', 'neo-pulse-wp' ),
						'menu_title' => __( 'Block Builder', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_agent_hub_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-chat',
						'page_title' => __( 'Chat', 'neo-pulse-wp' ),
						'menu_title' => __( 'Chat', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_chat_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-chat-logs',
						'page_title' => __( 'Chat Logs', 'neo-pulse-wp' ),
						'menu_title' => __( 'Chat Logs', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_chat_logs_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-search',
						'page_title' => __( 'Search', 'neo-pulse-wp' ),
						'menu_title' => __( 'Search', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_search_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-search-logs',
						'page_title' => __( 'Search Logs', 'neo-pulse-wp' ),
						'menu_title' => __( 'Search Logs', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_search_logs_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-overseer',
						'page_title' => __( 'Overseer', 'neo-pulse-wp' ),
						'menu_title' => __( 'Overseer', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_overseer_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-backend-assist',
						'page_title' => __( 'Backend Assist', 'neo-pulse-wp' ),
						'menu_title' => __( 'Backend Assist', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_backend_assist_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-tool-library',
						'page_title' => __( 'Tool Library', 'neo-pulse-wp' ),
						'menu_title' => __( 'Tool Library', 'neo-pulse-wp' ),
						'capability' => 'edit_posts',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_tool_library_page' ),
					),
				),
			),
			array(
				'id'    => 'fields',
				'label' => __( 'Fields', 'neo-pulse-wp' ),
				'items' => array(
					array(
						'slug'       => 'neo-pulse-wp-fields',
						'page_title' => __( 'Field Groups', 'neo-pulse-wp' ),
						'menu_title' => __( 'Field Groups', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_fields_list_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-post-types',
						'page_title' => __( 'Post Types', 'neo-pulse-wp' ),
						'menu_title' => __( 'Post Types', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_post_types_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-taxonomies',
						'page_title' => __( 'Taxonomies', 'neo-pulse-wp' ),
						'menu_title' => __( 'Taxonomies', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_taxonomies_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-options-pages',
						'page_title' => __( 'Options Pages', 'neo-pulse-wp' ),
						'menu_title' => __( 'Options Pages', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_options_pages_page' ),
					),
					array(
						'slug'       => 'neo-pulse-wp-fields-tools',
						'page_title' => __( 'Fields Tools', 'neo-pulse-wp' ),
						'menu_title' => __( 'Fields Tools', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_fields_tools_page' ),
					),
				),
			),
			array(
				'id'    => 'tags',
				'label' => __( 'Tags', 'neo-pulse-wp' ),
				'items' => array(
					array(
						'slug'       => 'neo-pulse-wp-tags',
						'page_title' => __( 'Elementor Dynamic Tags', 'neo-pulse-wp' ),
						'menu_title' => __( 'Elementor', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_tags_elementor_page' ),
					),
				),
			),
			array(
				'id'    => 'forms',
				'label' => __( 'Forms', 'neo-pulse-wp' ),
				'items' => array(
					array(
						'slug'       => 'neo-pulse-wp-forms',
						'page_title' => __( 'Forms', 'neo-pulse-wp' ),
						'menu_title' => __( 'Forms', 'neo-pulse-wp' ),
						'capability' => 'manage_options',
						'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_forms_page' ),
					),
				),
			),
		);
	}

	/**
	 * Hidden admin pages (no sidebar entry).
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_hidden_pages(): array {
		return array(
			array(
				'slug'       => 'neo-pulse-wp-fields-edit',
				'page_title' => __( 'Edit Field Group', 'neo-pulse-wp' ),
				'menu_title' => __( 'Edit Field Group', 'neo-pulse-wp' ),
				'capability' => 'manage_options',
				'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_field_group_edit_page' ),
			),
			array(
				'slug'       => 'neo-pulse-wp-post-types-edit',
				'page_title' => __( 'Edit Post Type', 'neo-pulse-wp' ),
				'menu_title' => __( 'Edit Post Type', 'neo-pulse-wp' ),
				'capability' => 'manage_options',
				'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_post_type_edit_page' ),
			),
			array(
				'slug'       => 'neo-pulse-wp-fields-gallery',
				'page_title' => __( 'Gallery', 'neo-pulse-wp' ),
				'menu_title' => __( 'Gallery', 'neo-pulse-wp' ),
				'capability' => 'manage_options',
				'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_fields_gallery_page' ),
			),
			array(
				'slug'       => 'neo-pulse-wp-fields-elementor',
				'page_title' => __( 'Elementor', 'neo-pulse-wp' ),
				'menu_title' => __( 'Elementor', 'neo-pulse-wp' ),
				'capability' => 'manage_options',
				'callback'   => array( 'Neo_Pulse_Wp_Admin', 'redirect_legacy_fields_elementor_page' ),
			),
			array(
				'slug'       => 'neo-pulse-wp-forms-edit',
				'page_title' => __( 'Edit Form', 'neo-pulse-wp' ),
				'menu_title' => __( 'Edit Form', 'neo-pulse-wp' ),
				'capability' => 'manage_options',
				'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_forms_edit_page' ),
			),
			array(
				'slug'       => 'neo-pulse-wp-forms-entries',
				'page_title' => __( 'Form Entries', 'neo-pulse-wp' ),
				'menu_title' => __( 'Form Entries', 'neo-pulse-wp' ),
				'capability' => 'manage_options',
				'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_forms_entries_page' ),
			),
			array(
				'slug'       => 'neo-pulse-wp-agent-hub-edit',
				'page_title' => __( 'Edit SEO Block', 'neo-pulse-wp' ),
				'menu_title' => __( 'Edit SEO Block', 'neo-pulse-wp' ),
				'capability' => 'manage_options',
				'callback'   => array( 'Neo_Pulse_Wp_Admin', 'render_agent_hub_edit_page' ),
			),
		);
	}

	/**
	 * Groups with only items the current user can access.
	 *
	 * @return array<int, array{id:string,label:string,items:array<int, array<string, mixed>>}>
	 */
	public static function get_visible_groups(): array {
		$visible = array();

		foreach ( self::get_menu_definition() as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$items = isset( $group['items'] ) && is_array( $group['items'] ) ? $group['items'] : array();
			$allowed_items = array();

			foreach ( $items as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				$cap = isset( $item['capability'] ) ? (string) $item['capability'] : 'manage_options';
				if ( current_user_can( $cap ) ) {
					$allowed_items[] = $item;
				}
			}

			if ( empty( $allowed_items ) ) {
				continue;
			}

			$group['items'] = $allowed_items;
			$visible[]      = $group;
		}

		return $visible;
	}

	public static function register(): void {
		self::$slug_group_map = array();

		foreach ( self::get_hidden_pages() as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$cap = isset( $item['capability'] ) ? (string) $item['capability'] : 'manage_options';
			if ( ! current_user_can( $cap ) ) {
				continue;
			}
			self::register_hidden_item( $item );
		}

		add_menu_page(
			__( 'NEO Pulse WP', 'neo-pulse-wp' ),
			__( 'NEO Pulse WP', 'neo-pulse-wp' ),
			Neo_Pulse_Wp_Admin::required_capability(),
			self::PARENT_SLUG,
			array( 'Neo_Pulse_Wp_Admin', 'render_app_page' ),
			Neo_Pulse_Wp_Admin::brand_icon_menu_url(),
			58
		);

		foreach ( self::get_visible_groups() as $group ) {
			$group_id = isset( $group['id'] ) ? sanitize_key( (string) $group['id'] ) : '';
			$label    = isset( $group['label'] ) ? (string) $group['label'] : '';
			$items    = isset( $group['items'] ) && is_array( $group['items'] ) ? $group['items'] : array();

			if ( $group_id === '' || $label === '' || empty( $items ) ) {
				continue;
			}

			self::register_group_header( $group_id, $label );

			foreach ( $items as $item ) {
				self::register_menu_item( $item, $group_id );
			}
		}
	}

	/**
	 * @param string $group_id Group key.
	 * @param string $label    Section label.
	 */
	private static function register_group_header( string $group_id, string $label ): void {
		$slug = self::group_slug( $group_id );
		$menu_title = sprintf(
			'<span class="neo-pulse-wp-menu-group" data-neo-pulse-group="%1$s">%2$s</span>',
			esc_attr( $group_id ),
			esc_html( $label )
		);

		add_submenu_page(
			self::PARENT_SLUG,
			$label,
			$menu_title,
			'read',
			$slug,
			array( __CLASS__, 'redirect_group_page' )
		);
	}

	/**
	 * @param array<string, mixed> $item     Menu item definition.
	 * @param string               $group_id Group key.
	 */
	private static function register_menu_item( array $item, string $group_id ): void {
		$slug = isset( $item['slug'] ) ? sanitize_key( (string) $item['slug'] ) : '';
		if ( $slug === '' ) {
			return;
		}

		self::$slug_group_map[ $slug ] = $group_id;

		$page_title = isset( $item['page_title'] ) ? (string) $item['page_title'] : '';
		$menu_title = isset( $item['menu_title'] ) ? (string) $item['menu_title'] : $page_title;
		$capability = isset( $item['capability'] ) ? (string) $item['capability'] : 'manage_options';
		$callback   = isset( $item['callback'] ) ? $item['callback'] : '__return_null';

		$menu_title_html = sprintf(
			'<span class="neo-pulse-wp-menu-item" data-neo-pulse-group="%1$s">%2$s</span>',
			esc_attr( $group_id ),
			esc_html( $menu_title )
		);

		add_submenu_page(
			self::PARENT_SLUG,
			$page_title,
			$menu_title_html,
			$capability,
			$slug,
			$callback
		);
	}

	/**
	 * @param array<string, mixed> $item Hidden page definition.
	 */
	private static function register_hidden_item( array $item ): void {
		$slug = isset( $item['slug'] ) ? sanitize_key( (string) $item['slug'] ) : '';
		if ( $slug === '' ) {
			return;
		}

		add_submenu_page(
			null,
			isset( $item['page_title'] ) ? (string) $item['page_title'] : '',
			isset( $item['menu_title'] ) ? (string) $item['menu_title'] : '',
			isset( $item['capability'] ) ? (string) $item['capability'] : 'manage_options',
			$slug,
			isset( $item['callback'] ) ? $item['callback'] : '__return_null'
		);
	}

	/**
	 * Keep submenu order aligned with grouped definition; Dashboard first for WP menu label.
	 */
	public static function reorder_submenu(): void {
		global $submenu;

		if ( ! isset( $submenu[ self::PARENT_SLUG ] ) || ! is_array( $submenu[ self::PARENT_SLUG ] ) ) {
			return;
		}

		$ordered_slugs = array();
		foreach ( self::get_visible_groups() as $group ) {
			if ( ! is_array( $group ) || empty( $group['id'] ) ) {
				continue;
			}
			$ordered_slugs[] = self::group_slug( (string) $group['id'] );
			$items           = isset( $group['items'] ) && is_array( $group['items'] ) ? $group['items'] : array();
			foreach ( $items as $item ) {
				if ( is_array( $item ) && ! empty( $item['slug'] ) ) {
					$ordered_slugs[] = sanitize_key( (string) $item['slug'] );
				}
			}
		}

		$by_slug = array();
		foreach ( $submenu[ self::PARENT_SLUG ] as $entry ) {
			if ( ! is_array( $entry ) || ! isset( $entry[2] ) ) {
				continue;
			}
			$by_slug[ (string) $entry[2] ] = $entry;
		}

		$new = array();
		if ( isset( $by_slug[ self::PARENT_SLUG ] ) ) {
			$new[] = $by_slug[ self::PARENT_SLUG ];
			unset( $by_slug[ self::PARENT_SLUG ] );
		}

		foreach ( $ordered_slugs as $slug ) {
			if ( isset( $by_slug[ $slug ] ) ) {
				$new[] = $by_slug[ $slug ];
				unset( $by_slug[ $slug ] );
			}
		}

		foreach ( $by_slug as $entry ) {
			$new[] = $entry;
		}

		if ( ! empty( $new ) ) {
			if ( isset( $new[0][2] ) && self::PARENT_SLUG === (string) $new[0][2] ) {
				$new[0][0] = __( 'Dashboard', 'neo-pulse-wp' );
			}
			$submenu[ self::PARENT_SLUG ] = $new;
		}
	}

	public static function redirect_group_page(): void {
		wp_safe_redirect( admin_url( 'admin.php?page=' . self::PARENT_SLUG ) );
		exit;
	}

	/**
	 * Keep NEO Pulse submenu highlight on real screens (including hidden pages like Gallery).
	 *
	 * @param string|false|null $submenu_file Active submenu file.
	 * @param string|false|null $parent_file  Parent menu file.
	 * @return string|false|null
	 */
	public static function filter_submenu_file( $submenu_file, $parent_file ) {
		if ( ! is_string( $parent_file ) || $parent_file !== self::PARENT_SLUG ) {
			return $submenu_file;
		}

		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( (string) $_GET['page'] ) ) : '';
		$is_neo_pulse_page = $page !== '' && 0 === strpos( $page, 'neo-pulse-wp' ) && ! self::is_group_slug( $page );

		if ( ! is_string( $submenu_file ) || $submenu_file === '' ) {
			return $is_neo_pulse_page ? $page : $submenu_file;
		}

		if ( strpos( $submenu_file, 'neo-pulse-wp-group-' ) !== 0 ) {
			return $submenu_file;
		}

		if ( $is_neo_pulse_page ) {
			return $page;
		}

		return self::PARENT_SLUG;
	}

	/**
	 * @param string $group_id Group key.
	 */
	public static function group_slug( string $group_id ): string {
		return 'neo-pulse-wp-group-' . sanitize_key( $group_id );
	}

	/**
	 * Whether a slug is a section header (not a real screen).
	 *
	 * @param string $slug Page slug.
	 */
	public static function is_group_slug( string $slug ): bool {
		return strpos( $slug, 'neo-pulse-wp-group-' ) === 0;
	}

	/**
	 * @param string $slug Admin page slug.
	 */
	/**
	 * Map admin page slugs to sidebar group ids (visible + hidden screens).
	 *
	 * @return array<string, string>
	 */
	public static function get_page_group_map(): array {
		$map = array();

		foreach ( self::get_menu_definition() as $group ) {
			if ( ! is_array( $group ) || empty( $group['id'] ) ) {
				continue;
			}
			$group_id = sanitize_key( (string) $group['id'] );
			$items    = isset( $group['items'] ) && is_array( $group['items'] ) ? $group['items'] : array();
			foreach ( $items as $item ) {
				if ( is_array( $item ) && ! empty( $item['slug'] ) ) {
					$map[ sanitize_key( (string) $item['slug'] ) ] = $group_id;
				}
			}
		}

		$hidden_groups = array(
			'neo-pulse-wp-fields-edit'      => 'fields',
			'neo-pulse-wp-post-types-edit'  => 'fields',
			'neo-pulse-wp-fields-elementor' => 'tags',
			'neo-pulse-wp-fields-gallery'   => 'fields',
			'neo-pulse-wp-forms-edit'      => 'forms',
			'neo-pulse-wp-forms-entries'    => 'forms',
			'neo-pulse-wp-agent-hub-edit'  => 'ai-tools',
		);
		foreach ( $hidden_groups as $slug => $group_id ) {
			$map[ $slug ] = $group_id;
		}

		return $map;
	}

	/**
	 * @return array{id:string,label:string,items:array<int,array<string,mixed>>}|null
	 */
	public static function get_group_for_page_slug( string $page_slug ): ?array {
		$page_slug = sanitize_key( $page_slug );
		if ( $page_slug === '' ) {
			return null;
		}

		$group_id = self::get_page_group_map()[ $page_slug ] ?? '';
		if ( $group_id === '' ) {
			return null;
		}

		foreach ( self::get_menu_definition() as $group ) {
			if ( is_array( $group ) && isset( $group['id'] ) && (string) $group['id'] === $group_id ) {
				return $group;
			}
		}

		return null;
	}

	/**
	 * @return array<int, array{slug:string,label:string,url:string}>
	 */
	public static function get_group_tier_nav_items( string $group_id ): array {
		$group_id = sanitize_key( $group_id );
		$items    = array();

		foreach ( self::get_visible_groups() as $group ) {
			if ( ! is_array( $group ) || empty( $group['id'] ) || sanitize_key( (string) $group['id'] ) !== $group_id ) {
				continue;
			}
			$group_items = isset( $group['items'] ) && is_array( $group['items'] ) ? $group['items'] : array();
			foreach ( $group_items as $item ) {
				if ( ! is_array( $item ) || empty( $item['slug'] ) ) {
					continue;
				}
				$slug = sanitize_key( (string) $item['slug'] );
				$items[] = array(
					'slug'  => $slug,
					'label' => isset( $item['menu_title'] ) ? (string) $item['menu_title'] : $slug,
					'url'   => admin_url( 'admin.php?page=' . $slug ),
				);
			}
			break;
		}

		if ( 'fields' === $group_id && current_user_can( 'manage_options' ) ) {
			$items[] = array(
				'slug'  => 'neo-pulse-wp-fields-gallery',
				'label' => __( 'Gallery', 'neo-pulse-wp' ),
				'url'   => admin_url( 'admin.php?page=neo-pulse-wp-fields-gallery' ),
			);
		}

		return $items;
	}

	public static function is_hidden_page_slug( string $slug ): bool {
		$slug = sanitize_key( $slug );
		if ( $slug === '' ) {
			return false;
		}
		foreach ( self::get_hidden_pages() as $item ) {
			if ( is_array( $item ) && isset( $item['slug'] ) && sanitize_key( (string) $item['slug'] ) === $slug ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Associate hidden NEO Pulse screens with the NEO Pulse WP menu for highlight/context.
	 *
	 * @param string|false|null $parent_file Parent menu file.
	 * @return string|false|null
	 */
	public static function filter_parent_file( $parent_file ) {
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( (string) $_GET['page'] ) ) : '';
		if ( $page !== '' && self::is_hidden_page_slug( $page ) ) {
			return self::PARENT_SLUG;
		}
		return $parent_file;
	}

	/**
	 * Menu tree for admin-menu.js flyout (avoids fragile DOM-only parsing).
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_menu_tree_for_script(): array {
		$current_page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( (string) $_GET['page'] ) ) : '';
		$tree         = array();

		foreach ( self::get_visible_groups() as $group ) {
			if ( ! is_array( $group ) || empty( $group['id'] ) ) {
				continue;
			}

			$group_id = sanitize_key( (string) $group['id'] );
			$label    = isset( $group['label'] ) ? (string) $group['label'] : $group_id;
			$items    = isset( $group['items'] ) && is_array( $group['items'] ) ? $group['items'] : array();
			$children = array();

			foreach ( $items as $item ) {
				if ( ! is_array( $item ) || empty( $item['slug'] ) ) {
					continue;
				}

				$slug = sanitize_key( (string) $item['slug'] );
				$children[] = array(
					'slug'      => $slug,
					'label'     => isset( $item['menu_title'] ) ? (string) $item['menu_title'] : $slug,
					'href'      => admin_url( 'admin.php?page=' . $slug ),
					'isCurrent' => $current_page !== '' && $current_page === $slug,
				);
			}

			if ( empty( $children ) ) {
				continue;
			}

			$tree[] = array(
				'id'    => $group_id,
				'label' => $label,
				'items' => $children,
			);
		}

		return $tree;
	}

	public static function enqueue_assets(): void {
		if ( ! is_admin() ) {
			return;
		}

		$has_neo_pulse = current_user_can( Neo_Pulse_Wp_Admin::required_capability() );
		if ( ! $has_neo_pulse ) {
			foreach ( self::get_menu_definition() as $group ) {
				if ( ! is_array( $group ) || ! isset( $group['items'] ) || ! is_array( $group['items'] ) ) {
					continue;
				}
				foreach ( $group['items'] as $item ) {
					if ( ! is_array( $item ) ) {
						continue;
					}
					$cap = isset( $item['capability'] ) ? (string) $item['capability'] : 'manage_options';
					if ( current_user_can( $cap ) ) {
						$has_neo_pulse = true;
						break 2;
					}
				}
			}
		}

		if ( ! $has_neo_pulse ) {
			return;
		}

		$base = NEO_PULSE_WP_PLUGIN_DIR . 'assets/admin/';
		$url  = plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/admin/';
		$ver  = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.5.0';

		wp_enqueue_style(
			'neo-pulse-wp-lato-menu',
			'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,600;0,700;1,400&display=swap',
			array(),
			null
		);

		$css_rel = 'admin-menu.css';
		$css_abs = $base . $css_rel;
		if ( is_readable( $css_abs ) ) {
			$css_ver = $ver . '.' . (string) filemtime( $css_abs );
			wp_enqueue_style(
				'neo-pulse-wp-admin-menu',
				$url . $css_rel,
				array( 'neo-pulse-wp-lato-menu' ),
				$css_ver
			);
		}

		$js_rel = 'admin-menu.js';
		$js_abs = $base . $js_rel;
		if ( is_readable( $js_abs ) ) {
			$js_ver = $ver . '.' . (string) filemtime( $js_abs );
			wp_enqueue_script(
				'neo-pulse-wp-admin-menu',
				$url . $js_rel,
				array(),
				$js_ver,
				true
			);

			$group_ids = array();
			foreach ( self::get_visible_groups() as $group ) {
				if ( ! empty( $group['id'] ) ) {
					$group_ids[] = sanitize_key( (string) $group['id'] );
				}
			}

			$current_page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( (string) $_GET['page'] ) ) : '';

			wp_localize_script(
				'neo-pulse-wp-admin-menu',
				'neoPulseWpAdminMenu',
				array(
					'parentSlug'       => self::PARENT_SLUG,
					'dashboardLabel'   => __( 'Dashboard', 'neo-pulse-wp' ),
					'groups'           => $group_ids,
					'pageGroups'       => self::get_page_group_map(),
					'currentPage'      => $current_page,
					'menuTree'         => self::get_menu_tree_for_script(),
				)
			);
		}
	}
}
