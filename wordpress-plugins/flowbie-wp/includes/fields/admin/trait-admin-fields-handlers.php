<?php
/**
 * Field admin handlers (save, import, export, delete).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Fields_Handlers {

	const ACTION_SAVE_FIELD_GROUP   = 'flowbie_wp_save_field_group';
	const ACTION_DELETE_FIELD_GROUP = 'flowbie_wp_delete_field_group';
	const ACTION_IMPORT_FIELDS      = 'flowbie_wp_import_fields';
	const ACTION_IMPORT_FIELDS_ACF_DB = 'flowbie_wp_import_fields_acf_db';
	const ACTION_EXPORT_FIELDS      = 'flowbie_wp_export_fields';
	const ACTION_IMPORT_STARTER     = 'flowbie_wp_import_fields_starter';
	const ACTION_IMPORT_GALLERY_TEMPLATE = 'flowbie_wp_import_gallery_template';
	const ACTION_DELETE_GALLERY_TEMPLATE      = 'flowbie_wp_delete_gallery_template';
	const ACTION_BULK_DELETE_GALLERY_TEMPLATES = 'flowbie_wp_bulk_delete_gallery_templates';
	const ACTION_BULK_FIELD_GROUPS  = 'flowbie_wp_bulk_field_groups';
	const ACTION_SAVE_POST_TYPE     = 'flowbie_wp_save_post_type';
	const ACTION_DELETE_POST_TYPE   = 'flowbie_wp_delete_post_type';
	const ACTION_BULK_POST_TYPES    = 'flowbie_wp_bulk_post_types';
	const ACTION_SAVE_TAXONOMY      = 'flowbie_wp_save_taxonomy';
	const ACTION_DELETE_TAXONOMY    = 'flowbie_wp_delete_taxonomy';
	const ACTION_BULK_TAXONOMIES    = 'flowbie_wp_bulk_taxonomies';
	const ACTION_SAVE_OPTIONS_PAGE  = 'flowbie_wp_save_options_page_def';
	const ACTION_DELETE_OPTIONS_PAGE = 'flowbie_wp_delete_options_page';
	const ACTION_BULK_OPTIONS_PAGES = 'flowbie_wp_bulk_options_pages';
	const ACTION_SAVE_FIELDS_ELEMENTOR = 'flowbie_wp_save_fields_elementor_settings';

	public static function register_fields_handlers(): void {
		add_action( 'admin_init', array( __CLASS__, 'maybe_process_fields_bulk_actions' ), 5 );
		add_action( 'admin_post_' . self::ACTION_SAVE_FIELD_GROUP, array( __CLASS__, 'handle_save_field_group' ) );
		add_action( 'admin_post_' . self::ACTION_DELETE_FIELD_GROUP, array( __CLASS__, 'handle_delete_field_group' ) );
		add_action( 'admin_post_' . self::ACTION_IMPORT_FIELDS, array( __CLASS__, 'handle_import_fields' ) );
		add_action( 'admin_post_' . self::ACTION_IMPORT_FIELDS_ACF_DB, array( __CLASS__, 'handle_import_fields_acf_db' ) );
		add_action( 'admin_post_' . self::ACTION_EXPORT_FIELDS, array( __CLASS__, 'handle_export_fields' ) );
		add_action( 'admin_post_' . self::ACTION_IMPORT_STARTER, array( __CLASS__, 'handle_import_starter_fields' ) );
		add_action( 'admin_post_' . self::ACTION_IMPORT_GALLERY_TEMPLATE, array( __CLASS__, 'handle_import_gallery_template' ) );
		add_action( 'admin_post_' . self::ACTION_DELETE_GALLERY_TEMPLATE, array( __CLASS__, 'handle_delete_gallery_template' ) );
		add_action( 'admin_post_' . self::ACTION_BULK_DELETE_GALLERY_TEMPLATES, array( __CLASS__, 'handle_bulk_delete_gallery_templates' ) );
		add_action( 'admin_post_' . self::ACTION_BULK_FIELD_GROUPS, array( __CLASS__, 'handle_bulk_field_groups' ) );
		add_action( 'admin_post_' . self::ACTION_SAVE_POST_TYPE, array( __CLASS__, 'handle_save_post_type' ) );
		add_action( 'admin_post_' . self::ACTION_DELETE_POST_TYPE, array( __CLASS__, 'handle_delete_post_type' ) );
		add_action( 'admin_post_' . self::ACTION_BULK_POST_TYPES, array( __CLASS__, 'handle_bulk_post_types' ) );
		add_action( 'admin_post_' . self::ACTION_SAVE_TAXONOMY, array( __CLASS__, 'handle_save_taxonomy' ) );
		add_action( 'admin_post_' . self::ACTION_DELETE_TAXONOMY, array( __CLASS__, 'handle_delete_taxonomy' ) );
		add_action( 'admin_post_' . self::ACTION_BULK_TAXONOMIES, array( __CLASS__, 'handle_bulk_taxonomies' ) );
		add_action( 'admin_post_' . self::ACTION_SAVE_OPTIONS_PAGE, array( __CLASS__, 'handle_save_options_page_def' ) );
		add_action( 'admin_post_' . self::ACTION_DELETE_OPTIONS_PAGE, array( __CLASS__, 'handle_delete_options_page' ) );
		add_action( 'admin_post_' . self::ACTION_BULK_OPTIONS_PAGES, array( __CLASS__, 'handle_bulk_options_pages' ) );
		add_action( 'admin_post_' . self::ACTION_SAVE_FIELDS_ELEMENTOR, array( __CLASS__, 'handle_save_fields_elementor_settings' ) );
	}

	/**
	 * List-table bulk forms POST to admin.php; WP_List_Table also submits name="action"
	 * for the bulk verb, which would overwrite admin-post routing if we used admin-post.php.
	 */
	public static function maybe_process_fields_bulk_actions(): void {
		if ( ! is_admin() || ( $_SERVER['REQUEST_METHOD'] ?? '' ) !== 'POST' ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( ! isset( $_POST['flowbie_fields_bulk_nonce'] ) ) {
			return;
		}
		$page = '';
		if ( isset( $_POST['page'] ) ) {
			$page = sanitize_key( wp_unslash( (string) $_POST['page'] ) );
		} elseif ( isset( $_GET['page'] ) ) {
			$page = sanitize_key( wp_unslash( (string) $_GET['page'] ) );
		}
		$handlers = array(
			'flowbie-wp-fields'        => 'handle_bulk_field_groups',
			'flowbie-wp-post-types'    => 'handle_bulk_post_types',
			'flowbie-wp-taxonomies'    => 'handle_bulk_taxonomies',
			'flowbie-wp-options-pages' => 'handle_bulk_options_pages',
		);
		if ( ! isset( $handlers[ $page ] ) ) {
			return;
		}
		call_user_func( array( __CLASS__, $handlers[ $page ] ) );
	}

	public static function handle_save_field_group(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_FIELD_GROUP, 'flowbie_fields_save_group_nonce' );
		$raw = isset( $_POST['field_group_json'] ) ? wp_unslash( (string) $_POST['field_group_json'] ) : '';
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			$data = self::parse_field_group_form();
		}
		if ( empty( $data['title'] ) ) {
			self::set_flash( array( 'success' => false, 'message' => __( 'Field group title is required.', 'flowbie-wp' ) ) );
			self::redirect_to_fields( 'edit', (string) ( $data['key'] ?? '' ) );
		}
		if ( empty( $data['key'] ) ) {
			$data['key'] = 'group_' . uniqid();
		}
		$post_id = Flowbie_Wp_Fields_Storage::save_group( Flowbie_Wp_Fields_Import_Export::normalize_group( $data ) );
		self::set_flash(
			array(
				'success' => $post_id > 0,
				'message' => $post_id > 0 ? __( 'Field group saved.', 'flowbie-wp' ) : __( 'Could not save field group.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_fields( 'edit', (string) $data['key'] );
	}

	public static function handle_delete_field_group(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_DELETE_FIELD_GROUP );
		$key = isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['key'] ) ) : '';
		if ( $key !== '' ) {
			Flowbie_Wp_Fields_Storage::delete_group( $key );
		}
		self::set_flash( array( 'success' => true, 'message' => __( 'Field group deleted.', 'flowbie-wp' ) ) );
		self::redirect_to_fields( 'list' );
	}

	public static function handle_import_fields(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_FIELDS, 'flowbie_fields_import_nonce' );
		if ( empty( $_FILES['fields_json']['tmp_name'] ) ) {
			self::set_flash( array( 'success' => false, 'message' => __( 'Choose a JSON file to import.', 'flowbie-wp' ) ) );
			self::redirect_to_fields( 'tools' );
		}
		$json = file_get_contents( (string) $_FILES['fields_json']['tmp_name'] );
		$delete_missing = ! empty( $_POST['delete_missing'] );
		$result = Flowbie_Wp_Fields_Import_Export::import_json_string( is_string( $json ) ? $json : '', $delete_missing );
		self::set_flash( array( 'success' => $result['success'], 'message' => $result['message'] ) );
		self::redirect_to_fields( 'tools' );
	}

	public static function handle_export_fields(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_EXPORT_FIELDS, 'flowbie_fields_export_nonce' );
		$keys    = isset( $_POST['group_keys'] ) ? array_map( 'sanitize_text_field', (array) wp_unslash( $_POST['group_keys'] ) ) : array();
		$include = array(
			'groups'         => ! empty( $_POST['include_groups'] ),
			'post_types'     => ! empty( $_POST['include_post_types'] ),
			'taxonomies'     => ! empty( $_POST['include_taxonomies'] ),
			'options_pages'  => ! empty( $_POST['include_options_pages'] ),
		);
		if ( ! $include['groups'] && ! $include['post_types'] && ! $include['taxonomies'] && ! $include['options_pages'] ) {
			$include = array(
				'groups'        => true,
				'post_types'    => true,
				'taxonomies'    => true,
				'options_pages' => true,
			);
		}
		$json     = Flowbie_Wp_Fields_Import_Export::export_json_string( $keys, $include );
		$filename = 'flowbie-acf-export-' . gmdate( 'Y-m-d' ) . '.json';
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		echo $json; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	public static function handle_import_starter_fields(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_STARTER, 'flowbie_fields_starter_nonce' );
		$result = Flowbie_Wp_Fields_Import_Export::import_bundled_starter();
		self::set_flash( array( 'success' => $result['success'], 'message' => $result['message'] ) );
		self::redirect_to_fields( 'tools' );
	}

	public static function handle_import_gallery_template(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		$template_id = isset( $_POST['template_id'] ) ? sanitize_key( wp_unslash( (string) $_POST['template_id'] ) ) : '';
		check_admin_referer( Flowbie_Wp_Fields_Gallery_Templates::nonce_action( $template_id, 'import' ) );
		$result = Flowbie_Wp_Fields_Gallery_Templates::import( $template_id );
		self::set_flash( array( 'success' => $result['success'], 'message' => $result['message'] ) );
		self::redirect_to_fields( 'gallery' );
	}

	public static function handle_delete_gallery_template(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		$template_id = isset( $_POST['template_id'] ) ? sanitize_key( wp_unslash( (string) $_POST['template_id'] ) ) : '';
		check_admin_referer( Flowbie_Wp_Fields_Gallery_Templates::nonce_action( $template_id, 'delete' ) );
		$result = Flowbie_Wp_Fields_Gallery_Templates::delete( $template_id );
		self::set_flash( array( 'success' => $result['success'], 'message' => $result['message'] ) );
		self::redirect_to_fields( 'gallery' );
	}

	public static function handle_bulk_delete_gallery_templates(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( Flowbie_Wp_Fields_Gallery_Templates::bulk_delete_nonce_action() );
		$template_ids = isset( $_POST['template_ids'] ) ? array_map( 'sanitize_key', (array) wp_unslash( $_POST['template_ids'] ) ) : array();
		$result       = Flowbie_Wp_Fields_Gallery_Templates::delete_many( $template_ids );
		self::set_flash( array( 'success' => $result['success'], 'message' => $result['message'] ) );
		self::redirect_to_fields( 'gallery' );
	}

	public static function handle_bulk_field_groups(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_BULK_FIELD_GROUPS, 'flowbie_fields_bulk_nonce' );
		$action = self::get_list_table_bulk_action();
		$keys = isset( $_POST['group_keys'] ) ? array_map( 'sanitize_text_field', (array) wp_unslash( $_POST['group_keys'] ) ) : array();
		if ( $action === 'delete' ) {
			foreach ( $keys as $key ) {
				Flowbie_Wp_Fields_Storage::delete_group( $key );
			}
			self::set_flash( array( 'success' => true, 'message' => __( 'Selected field groups deleted.', 'flowbie-wp' ) ) );
		} elseif ( $action === 'export' && ! empty( $keys ) ) {
			check_admin_referer( self::ACTION_BULK_FIELD_GROUPS, 'flowbie_fields_bulk_nonce' );
			$json = Flowbie_Wp_Fields_Import_Export::export_json_string( $keys );
			header( 'Content-Type: application/json; charset=utf-8' );
			header( 'Content-Disposition: attachment; filename=flowbie-fields-export.json' );
			echo $json; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			exit;
		}
		self::redirect_to_fields( 'list' );
	}

	public static function handle_save_post_type(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_POST_TYPE, 'flowbie_post_type_nonce' );

		$slug = sanitize_key( (string) ( $_POST['post_type_slug'] ?? '' ) );
		if ( $slug === '' ) {
			self::set_flash( array( 'success' => false, 'message' => __( 'Post type key is required.', 'flowbie-wp' ) ) );
			self::redirect_to_fields_page( 'flowbie-wp-post-types-edit' );
		}

		$supports = isset( $_POST['supports'] ) && is_array( $_POST['supports'] )
			? array_values( array_unique( array_map( 'sanitize_key', wp_unslash( $_POST['supports'] ) ) ) )
			: array( 'title', 'editor' );

		$taxonomies = isset( $_POST['taxonomies'] ) && is_array( $_POST['taxonomies'] )
			? array_values( array_unique( array_map( 'sanitize_key', wp_unslash( $_POST['taxonomies'] ) ) ) )
			: array();

		$plural = sanitize_text_field( (string) ( $_POST['post_type_title'] ?? $slug ) );
		$advanced = ! empty( $_POST['advanced_configuration'] );
		$existing = self::get_post_type_config( $slug );
		$prev_map_meta_cap = true;
		if ( is_array( $existing ) && array_key_exists( 'map_meta_cap', $existing ) ) {
			$prev_map_meta_cap = ! empty( $existing['map_meta_cap'] );
		}
		if ( isset( $_POST['map_meta_cap_present'] ) ) {
			$map_meta_cap = ! empty( $_POST['map_meta_cap'] );
		} else {
			$map_meta_cap = $prev_map_meta_cap;
		}
		$config = array(
			'post_type'              => $slug,
			'description'            => sanitize_textarea_field( (string) ( $_POST['description'] ?? '' ) ),
			'public'                 => ! empty( $_POST['public'] ),
			'hierarchical'           => ! empty( $_POST['hierarchical'] ),
			'advanced_configuration' => $advanced,
			'taxonomies'             => $taxonomies,
			'supports'               => $supports,
			'show_ui'                => $advanced ? ! empty( $_POST['show_ui'] ) : ! empty( $_POST['public'] ),
			'show_in_menu'           => $advanced ? ! empty( $_POST['show_in_menu'] ) : true,
			'show_in_admin_bar'      => $advanced ? ! empty( $_POST['show_in_admin_bar'] ) : true,
			'show_in_rest'           => $advanced ? ! empty( $_POST['show_in_rest'] ) : true,
			'has_archive'            => $advanced && ! empty( $_POST['has_archive'] ),
			'menu_icon'              => sanitize_text_field( (string) ( $_POST['menu_icon'] ?? 'dashicons-admin-post' ) ),
			'menu_position'          => isset( $_POST['menu_position'] ) && $_POST['menu_position'] !== '' ? (int) $_POST['menu_position'] : '',
			'capability_type'        => sanitize_text_field( (string) ( $_POST['capability_type'] ?? 'post' ) ),
			'map_meta_cap'           => $map_meta_cap,
			'rest_base'              => sanitize_text_field( (string) ( $_POST['rest_base'] ?? '' ) ),
			'rest_namespace'         => sanitize_text_field( (string) ( $_POST['rest_namespace'] ?? 'wp/v2' ) ),
			'rewrite'                => array(
				'slug'       => sanitize_title( (string) ( $_POST['rewrite_slug'] ?? '' ) ),
				'with_front' => ! empty( $_POST['rewrite_with_front'] ),
			),
			'labels'                 => array(
				'name'          => $plural,
				'singular_name' => sanitize_text_field( (string) ( $_POST['label_singular_name'] ?? $plural ) ),
				'menu_name'     => sanitize_text_field( (string) ( $_POST['label_menu_name'] ?? $plural ) ),
			),
			'active'                 => $advanced ? ! empty( $_POST['active'] ) : true,
		);

		if ( empty( $config['labels']['singular_name'] ) ) {
			$config['labels']['singular_name'] = $plural;
		}
		if ( empty( $config['labels']['menu_name'] ) ) {
			$config['labels']['menu_name'] = $plural;
		}

		Flowbie_Wp_Fields_Post_Types::save( $config );
		self::set_flash( array( 'success' => true, 'message' => __( 'Post type saved.', 'flowbie-wp' ) ) );
		wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-post-types-edit&post_type=' . rawurlencode( $slug ) ) );
		exit;
	}

	public static function handle_save_taxonomy(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_TAXONOMY, 'flowbie_taxonomy_nonce' );
		$config = self::parse_json_post( 'taxonomy_json' );
		if ( empty( $config['taxonomy'] ) ) {
			$config['taxonomy'] = sanitize_key( (string) ( $_POST['taxonomy_slug'] ?? '' ) );
		}
		$config['object_type'] = array( sanitize_key( (string) ( $_POST['taxonomy_post_type'] ?? 'post' ) ) );
		$config['labels']      = array( 'name' => sanitize_text_field( (string) ( $_POST['taxonomy_title'] ?? $config['taxonomy'] ) ) );
		Flowbie_Wp_Fields_Taxonomies::save( $config );
		self::set_flash( array( 'success' => true, 'message' => __( 'Taxonomy saved.', 'flowbie-wp' ) ) );
		wp_safe_redirect(
			admin_url(
				'admin.php?page=flowbie-wp-taxonomies&action=edit&taxonomy=' . rawurlencode( (string) ( $config['taxonomy'] ?? '' ) )
			)
		);
		exit;
	}

	public static function handle_delete_taxonomy(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_DELETE_TAXONOMY );
		$slug = isset( $_GET['taxonomy'] ) ? sanitize_key( wp_unslash( (string) $_GET['taxonomy'] ) ) : '';
		if ( $slug === '' || ! Flowbie_Wp_Fields_Taxonomies::delete( $slug ) ) {
			self::set_flash( array( 'success' => false, 'message' => __( 'Could not delete taxonomy.', 'flowbie-wp' ) ) );
		} else {
			self::set_flash( array( 'success' => true, 'message' => __( 'Taxonomy deleted.', 'flowbie-wp' ) ) );
		}
		self::redirect_to_fields_page( 'flowbie-wp-taxonomies' );
	}

	public static function handle_bulk_taxonomies(): void {
		self::handle_bulk_entity_delete(
			self::ACTION_BULK_TAXONOMIES,
			'flowbie_fields_bulk_nonce',
			'taxonomy_keys',
			static function ( string $key ): bool {
				return Flowbie_Wp_Fields_Taxonomies::delete( $key );
			},
			'flowbie-wp-taxonomies',
			__( 'Selected taxonomies deleted.', 'flowbie-wp' )
		);
	}

	public static function handle_delete_post_type(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_DELETE_POST_TYPE );
		$slug = isset( $_GET['post_type'] ) ? sanitize_key( wp_unslash( (string) $_GET['post_type'] ) ) : '';
		if ( $slug === '' || ! Flowbie_Wp_Fields_Post_Types::delete( $slug ) ) {
			self::set_flash( array( 'success' => false, 'message' => __( 'Could not delete post type.', 'flowbie-wp' ) ) );
		} else {
			self::set_flash( array( 'success' => true, 'message' => __( 'Post type deleted.', 'flowbie-wp' ) ) );
		}
		self::redirect_to_fields_page( 'flowbie-wp-post-types' );
	}

	public static function handle_bulk_post_types(): void {
		self::handle_bulk_entity_delete(
			self::ACTION_BULK_POST_TYPES,
			'flowbie_fields_bulk_nonce',
			'post_type_keys',
			static function ( string $key ): bool {
				return Flowbie_Wp_Fields_Post_Types::delete( $key );
			},
			'flowbie-wp-post-types',
			__( 'Selected post types deleted.', 'flowbie-wp' )
		);
	}

	public static function handle_delete_options_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_DELETE_OPTIONS_PAGE );
		$slug = isset( $_GET['menu_slug'] ) ? sanitize_key( wp_unslash( (string) $_GET['menu_slug'] ) ) : '';
		if ( $slug === '' || ! Flowbie_Wp_Fields_Options::delete( $slug ) ) {
			self::set_flash( array( 'success' => false, 'message' => __( 'Could not delete options page.', 'flowbie-wp' ) ) );
		} else {
			self::set_flash( array( 'success' => true, 'message' => __( 'Options page deleted.', 'flowbie-wp' ) ) );
		}
		self::redirect_to_fields_page( 'flowbie-wp-options-pages' );
	}

	public static function handle_bulk_options_pages(): void {
		self::handle_bulk_entity_delete(
			self::ACTION_BULK_OPTIONS_PAGES,
			'flowbie_fields_bulk_nonce',
			'options_keys',
			static function ( string $key ): bool {
				return Flowbie_Wp_Fields_Options::delete( $key );
			},
			'flowbie-wp-options-pages',
			__( 'Selected options pages deleted.', 'flowbie-wp' )
		);
	}

	/**
	 * @param callable(string): bool $delete_fn Delete callback.
	 */
	private static function handle_bulk_entity_delete(
		string $action,
		string $nonce_field,
		string $keys_field,
		callable $delete_fn,
		string $redirect_page,
		string $success_message
	): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( $action, $nonce_field );
		if ( self::get_list_table_bulk_action() !== 'delete' ) {
			self::redirect_to_fields_page( $redirect_page );
		}
		$keys = isset( $_POST[ $keys_field ] ) ? array_map( 'sanitize_key', (array) wp_unslash( $_POST[ $keys_field ] ) ) : array();
		foreach ( $keys as $key ) {
			if ( $key !== '' ) {
				$delete_fn( $key );
			}
		}
		self::set_flash( array( 'success' => true, 'message' => $success_message ) );
		self::redirect_to_fields_page( $redirect_page );
	}

	public static function handle_save_fields_elementor_settings(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_FIELDS_ELEMENTOR, 'flowbie_fields_elementor_nonce' );
		$scope = isset( $_POST['field_picker_scope'] )
			? sanitize_key( (string) wp_unslash( $_POST['field_picker_scope'] ) )
			: 'all';
		Flowbie_Wp_Fields_Elementor_Settings::save_config(
			array(
				'enabled'              => ! empty( $_POST['enabled'] ),
				'enable_post_tags'     => ! empty( $_POST['enable_post_tags'] ),
				'enable_options_tags'  => ! empty( $_POST['enable_options_tags'] ),
				'show_layout_fields'   => ! empty( $_POST['show_layout_fields'] ),
				'field_picker_scope'   => $scope,
			)
		);
		self::set_flash( array( 'success' => true, 'message' => __( 'Elementor settings saved.', 'flowbie-wp' ) ) );
		self::redirect_to_fields_page( 'flowbie-wp-tags' );
	}

	public static function handle_save_options_page_def(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_OPTIONS_PAGE, 'flowbie_options_page_nonce' );
		$page = array(
			'menu_slug'   => sanitize_key( (string) ( $_POST['menu_slug'] ?? '' ) ),
			'page_title'  => sanitize_text_field( (string) ( $_POST['page_title'] ?? '' ) ),
			'menu_title'  => sanitize_text_field( (string) ( $_POST['menu_title'] ?? '' ) ),
			'capability'  => sanitize_text_field( (string) ( $_POST['capability'] ?? 'manage_options' ) ),
			'parent_slug' => sanitize_text_field( (string) ( $_POST['parent_slug'] ?? '' ) ),
		);
		Flowbie_Wp_Fields_Options::register_page( $page );
		self::set_flash( array( 'success' => true, 'message' => __( 'Options page saved.', 'flowbie-wp' ) ) );
		wp_safe_redirect(
			admin_url(
				'admin.php?page=flowbie-wp-options-pages&action=edit&menu_slug=' . rawurlencode( (string) ( $page['menu_slug'] ?? '' ) )
			)
		);
		exit;
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function parse_field_group_form(): array {
		$fields_raw = isset( $_POST['fields'] ) && is_array( $_POST['fields'] ) ? wp_unslash( $_POST['fields'] ) : array();
		$fields     = array();
		foreach ( $fields_raw as $field ) {
			if ( is_array( $field ) && ! empty( $field['name'] ) ) {
				if ( empty( $field['key'] ) ) {
					$field['key'] = 'field_' . uniqid();
				}
				$fields[] = $field;
			}
		}
		$location_raw = isset( $_POST['location'] ) && is_array( $_POST['location'] ) ? wp_unslash( $_POST['location'] ) : array();
		return array(
			'key'                   => sanitize_text_field( (string) ( $_POST['group_key'] ?? '' ) ),
			'title'                 => sanitize_text_field( (string) ( $_POST['group_title'] ?? '' ) ),
			'description'           => sanitize_textarea_field( (string) ( $_POST['group_description'] ?? '' ) ),
			'fields'                => $fields,
			'location'              => $location_raw,
			'menu_order'            => (int) ( $_POST['menu_order'] ?? 0 ),
			'position'              => sanitize_key( (string) ( $_POST['position'] ?? 'normal' ) ),
			'style'                 => sanitize_key( (string) ( $_POST['style'] ?? 'default' ) ),
			'label_placement'       => sanitize_key( (string) ( $_POST['label_placement'] ?? 'top' ) ),
			'instruction_placement' => sanitize_key( (string) ( $_POST['instruction_placement'] ?? 'label' ) ),
			'hide_on_screen'        => isset( $_POST['hide_on_screen'] ) ? array_map( 'sanitize_key', (array) wp_unslash( $_POST['hide_on_screen'] ) ) : '',
			'active'                => ! empty( $_POST['active'] ),
			'show_in_rest'          => ! empty( $_POST['show_in_rest'] ) ? 1 : 0,
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function parse_json_post( string $field ): array {
		$raw  = isset( $_POST[ $field ] ) ? wp_unslash( (string) $_POST[ $field ] ) : '';
		$data = json_decode( $raw, true );
		return is_array( $data ) ? $data : array();
	}

	public static function handle_import_fields_acf_db(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage fields.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_IMPORT_FIELDS_ACF_DB, 'flowbie_fields_import_acf_db_nonce' );

		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-flowbie-wp-migrate-adapter.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-flowbie-wp-migrate-source-acf.php';
		$result = Flowbie_Wp_Migrate_Source_Acf::import_all_from_database();

		if ( empty( $result['ok'] ) ) {
			self::set_flash(
				array(
					'success' => false,
					'message' => isset( $result['error'] ) ? (string) $result['error'] : __( 'ACF import failed.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_fields( 'list' );
		}

		$stats   = isset( $result['stats'] ) && is_array( $result['stats'] ) ? $result['stats'] : array();
		$message = isset( $result['message'] ) && (string) $result['message'] !== ''
			? (string) $result['message']
			: sprintf(
				/* translators: 1: groups created, 2: groups updated */
				__( 'ACF import complete: %1$d created, %2$d updated field group(s).', 'flowbie-wp' ),
				(int) ( $stats['groups_created'] ?? 0 ),
				(int) ( $stats['groups_updated'] ?? 0 )
			);

		$pt_total = (int) ( $stats['post_types_created'] ?? 0 ) + (int) ( $stats['post_types_updated'] ?? 0 );
		if ( $pt_total > 0 ) {
			$message .= ' ' . sprintf(
				/* translators: %d: post type count */
				__( '%d post type(s) imported.', 'flowbie-wp' ),
				$pt_total
			);
		}

		if ( ! empty( $stats['options_values_updated'] ) ) {
			$message .= ' ' . sprintf(
				/* translators: %d: field count */
				__( 'Options page values: %d field(s) imported.', 'flowbie-wp' ),
				(int) $stats['options_values_updated']
			);
		}

		if ( ! empty( $stats['post_values_updated'] ) ) {
			$message .= ' ' . sprintf(
				/* translators: %d: field count */
				__( 'Post field values: %d field(s) imported.', 'flowbie-wp' ),
				(int) $stats['post_values_updated']
			);
		} elseif ( ! empty( $stats['values_updated'] ) ) {
			$message .= ' ' . sprintf(
				/* translators: %d: field count */
				__( 'Field values applied: %d field(s).', 'flowbie-wp' ),
				(int) $stats['values_updated']
			);
		}

		self::set_flash(
			array(
				'success' => true,
				'message' => $message,
			)
		);
		self::redirect_to_fields( 'list' );
	}

	/**
	 * @return array{available: bool, count: int, plugin_active: bool, pending_count: int, imported_count: int}
	 */
	public static function acf_database_import_status(): array {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-flowbie-wp-migrate-adapter.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-flowbie-wp-migrate-source-acf.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-storage.php';

		$plugin_active = Flowbie_Wp_Migrate_Source_Acf::is_acf_plugin_active();
		$source_keys   = Flowbie_Wp_Migrate_Source_Acf::acf_source_group_keys();
		$source_total  = count( $source_keys );
		$flowbie_keys  = array();
		foreach ( Flowbie_Wp_Fields_Storage::get_all_groups() as $group ) {
			if ( ! empty( $group['key'] ) ) {
				$flowbie_keys[] = (string) $group['key'];
			}
		}
		$imported_count = count( array_intersect( $source_keys, $flowbie_keys ) );
		$pending_count  = $source_total > 0 ? max( 0, $source_total - $imported_count ) : 0;

		$available = $pending_count > 0;
		if ( ! $available && $plugin_active && $source_total === 0 && $imported_count === 0 ) {
			$adapter = new Flowbie_Wp_Migrate_Source_Acf();
			if ( $adapter->is_available() ) {
				$available = true;
			}
		}

		return array(
			'available'      => $available,
			'count'          => $pending_count > 0 ? $pending_count : $source_total,
			'pending_count'  => $pending_count,
			'imported_count' => $imported_count,
			'plugin_active'  => $plugin_active,
		);
	}

	/**
	 * @param string $view list|edit|tools|gallery
	 */
	private static function redirect_to_fields( string $view = 'list', string $key = '' ): void {
		if ( 'edit' === $view && $key !== '' ) {
			wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-fields-edit&key=' . rawurlencode( $key ) ) );
			exit;
		}
		if ( 'gallery' === $view ) {
			wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-fields-gallery' ) );
			exit;
		}
		if ( 'tools' === $view ) {
			wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-fields-tools' ) );
			exit;
		}
		wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-fields' ) );
		exit;
	}

	private static function redirect_to_fields_page( string $page ): void {
		wp_safe_redirect( admin_url( 'admin.php?page=' . $page ) );
		exit;
	}

	private static function get_list_table_bulk_action(): string {
		$action = isset( $_POST['action'] ) ? sanitize_key( wp_unslash( (string) $_POST['action'] ) ) : '';
		if ( $action === '' || $action === '-1' ) {
			$action = isset( $_POST['action2'] ) ? sanitize_key( wp_unslash( (string) $_POST['action2'] ) ) : '';
		}
		return $action;
	}
}
