<?php
/**
 * Central tool registry for MCP and Backend Assist.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Tools {

	const VERSION = 1;

	/** @var array<string, array<string, mixed>>|null */
	private static $registry = null;

	/** Tools that require params.confirm === true. */
	private static $confirm_tools = array(
		'wp_replace_content',
		'wp_delete_post',
		'wp_fields_update',
		'wp_ai_apply_field',
		'wp_ai_save_meta',
		'wp_ai_optimize_meta_bundle',
		'wp_body_section_apply',
		'wp_body_insert_element',
		'wp_image_seo_apply',
		'wp_image_seo_bulk',
		'wp_sitemap_put',
		'wp_redirects_create',
		'wp_redirects_update',
		'wp_redirects_delete',
		'wp_scripts_create',
		'wp_scripts_update',
		'wp_scripts_delete',
		'wp_fields_import_json',
		'wp_gmb_create_post',
		'wp_revision_restore',
		'wp_speed_image_batch',
		'wp_speed_image_flush_meta',
		'wp_super_migrate_start',
		'wp_super_migrate_flo_sheet_import',
		'wp_seo_block_sync_library',
		'wp_theme_functions_put',
	);

	/**
	 * @return array<string, array<string, mixed>>
	 */
	public static function get_registry(): array {
		if ( null !== self::$registry ) {
			return self::$registry;
		}

		$defs = array(
			array( 'wp_ping', 'read', 'Plugin health ping', 'wp_ping', 'read' ),
			array( 'wp_whoami', 'read', 'Current WordPress user', 'wp_whoami', 'read' ),
			array( 'wp_site_dashboard', 'read', 'Flowbie property dashboard state', 'wp_site_dashboard', 'read' ),
			array( 'wp_site_index', 'read', 'Site content graph index', 'wp_site_index', 'read' ),
			array( 'wp_site_index_search', 'read', 'Search site index by query', 'wp_site_index_search', 'read' ),
			array( 'wp_openrouter_status', 'read', 'Whether OpenRouter is configured', 'wp_openrouter_status', 'read' ),
			array( 'wp_theme_functions_get', 'read', 'Read active theme functions.php', 'wp_theme_functions_get', 'edit_themes' ),
			array( 'wp_theme_functions_put', 'destructive', 'Write active theme functions.php (backs up first)', 'wp_theme_functions_put', 'edit_themes' ),
			array( 'wp_list_posts', 'read', 'List posts or pages', 'wp_list_posts', 'edit_posts' ),
			array( 'wp_get_post', 'read', 'Get post by ID or title', 'wp_get_post', 'edit_posts' ),
			array( 'wp_get_post_content', 'read', 'Get rendered and raw post content', 'wp_get_post_content', 'post' ),
			array( 'wp_create_post', 'write', 'Create a post', 'wp_create_post', 'edit_posts' ),
			array( 'wp_create_page', 'write', 'Create a page', 'wp_create_page', 'edit_posts' ),
			array( 'wp_update_post', 'write', 'Update post title, status, excerpt, slug', 'wp_update_post', 'post' ),
			array( 'wp_add_content', 'write', 'Append HTML to post body', 'wp_add_content', 'post' ),
			array( 'wp_replace_content', 'destructive', 'Replace full post_content', 'wp_replace_content', 'post' ),
			array( 'wp_delete_post', 'destructive', 'Trash or delete a post', 'wp_delete_post', 'post' ),
			array( 'wp_resolve_url', 'read', 'Resolve URL to post_id', 'wp_resolve_url', 'read' ),
			array( 'wp_fields_list_groups', 'read', 'List Flowbie field groups', 'wp_fields_list_groups', 'edit_posts' ),
			array( 'wp_fields_get', 'read', 'Get field values for a post', 'wp_fields_get', 'post' ),
			array( 'wp_fields_update', 'write', 'Update a Flowbie field', 'wp_fields_update', 'post' ),
			array( 'wp_fields_get_object', 'read', 'Get field object metadata', 'wp_fields_get_object', 'post' ),
			array( 'wp_fields_export_json', 'read', 'Export field groups as JSON', 'wp_fields_export_json', 'manage_options' ),
			array( 'wp_fields_import_json', 'write', 'Import ACF-compatible field JSON', 'wp_fields_import_json', 'manage_options' ),
			array( 'wp_ai_status', 'read', 'AI wand eligibility for a post', 'wp_ai_status', 'post' ),
			array( 'wp_ai_preview_field', 'read', 'Preview AI wand output', 'wp_ai_preview_field', 'post' ),
			array( 'wp_ai_apply_field', 'write', 'Apply AI wand value', 'wp_ai_apply_field', 'post' ),
			array( 'wp_ai_save_meta', 'write', 'Save meta bundle without AI', 'wp_ai_save_meta', 'post' ),
			array( 'wp_ai_gsc_suggestions', 'read', 'GSC keyword suggestions', 'wp_ai_gsc_suggestions', 'post' ),
			array( 'wp_ai_seo_research_brief', 'read', 'Build SEO research brief', 'wp_ai_seo_research_brief', 'post' ),
			array( 'wp_ai_optimize_meta_bundle', 'write', 'Run meta optimizer bundle', 'wp_ai_optimize_meta_bundle', 'post' ),
			array( 'wp_ai_lint_post', 'read', 'Lint post for SEO readiness', 'wp_ai_lint_post', 'post' ),
			array( 'wp_body_sections', 'read', 'List H2 body sections', 'wp_body_sections', 'post' ),
			array( 'wp_body_posts_inventory', 'read', 'Posts inventory for internal links', 'wp_body_posts_inventory', 'post' ),
			array( 'wp_body_plan', 'write', 'Plan body harness sections', 'wp_body_plan', 'post' ),
			array( 'wp_body_session_get', 'read', 'Get body harness session', 'wp_body_session_get', 'post' ),
			array( 'wp_body_session_delete', 'write', 'Clear body harness session', 'wp_body_session_delete', 'post' ),
			array( 'wp_body_section_preview', 'read', 'Preview one body section', 'wp_body_section_preview', 'post' ),
			array( 'wp_body_section_apply', 'write', 'Apply body section HTML', 'wp_body_section_apply', 'post' ),
			array( 'wp_body_suggest_link', 'read', 'Suggest internal link', 'wp_body_suggest_link', 'post' ),
			array( 'wp_body_insert_element', 'write', 'Insert element into section', 'wp_body_insert_element', 'post' ),
			array( 'wp_image_seo_status', 'read', 'Image SEO module status', 'wp_image_seo_status', 'upload' ),
			array( 'wp_image_seo_list', 'read', 'List media for image SEO', 'wp_image_seo_list', 'upload' ),
			array( 'wp_image_seo_get_attachment', 'read', 'Get attachment image SEO row', 'wp_image_seo_get_attachment', 'upload' ),
			array( 'wp_image_seo_preview', 'read', 'Preview image SEO AI', 'wp_image_seo_preview', 'attachment' ),
			array( 'wp_image_seo_apply', 'write', 'Apply image SEO fields', 'wp_image_seo_apply', 'attachment' ),
			array( 'wp_image_seo_bulk', 'write', 'Bulk image SEO', 'wp_image_seo_bulk', 'upload' ),
			array( 'wp_sitemap_get', 'read', 'Get sitemap settings', 'wp_sitemap_get', 'manage_options' ),
			array( 'wp_sitemap_put', 'write', 'Update sitemap settings', 'wp_sitemap_put', 'manage_options' ),
			array( 'wp_sitemap_flush', 'write', 'Flush sitemap cache', 'wp_sitemap_flush', 'manage_options' ),
			array( 'wp_speed_status', 'read', 'Speed module status and cache stats', 'wp_speed_status', 'manage_options' ),
			array( 'wp_speed_flush', 'write', 'Flush Speed optimized asset cache', 'wp_speed_flush', 'manage_options' ),
			array( 'wp_speed_image_status', 'read', 'Speed image optimization status and stats', 'wp_speed_image_status', 'manage_options' ),
			array( 'wp_speed_image_batch', 'write', 'Batch optimize media library images', 'wp_speed_image_batch', 'manage_options' ),
			array( 'wp_speed_image_flush_meta', 'write', 'Clear Speed image optimization attachment meta', 'wp_speed_image_flush_meta', 'manage_options' ),
			array( 'wp_redirects_list', 'read', 'List redirects', 'wp_redirects_list', 'manage_options' ),
			array( 'wp_redirects_get', 'read', 'Get one redirect', 'wp_redirects_get', 'manage_options' ),
			array( 'wp_redirects_create', 'write', 'Create redirect', 'wp_redirects_create', 'manage_options' ),
			array( 'wp_redirects_update', 'write', 'Update redirect', 'wp_redirects_update', 'manage_options' ),
			array( 'wp_redirects_delete', 'destructive', 'Delete or trash redirect', 'wp_redirects_delete', 'manage_options' ),
			array( 'wp_scripts_list', 'read', 'List scripts (header/footer/body)', 'wp_scripts_list', 'manage_options' ),
			array( 'wp_scripts_get', 'read', 'Get one script', 'wp_scripts_get', 'manage_options' ),
			array( 'wp_scripts_create', 'write', 'Create script snippet', 'wp_scripts_create', 'manage_options' ),
			array( 'wp_scripts_update', 'write', 'Update script snippet', 'wp_scripts_update', 'manage_options' ),
			array( 'wp_scripts_delete', 'destructive', 'Delete or trash script', 'wp_scripts_delete', 'manage_options' ),
			array( 'wp_gmb_status', 'read', 'Google Business Profile connection status', 'wp_gmb_status', 'edit_posts' ),
			array( 'wp_gmb_locations', 'read', 'Configured GBP location', 'wp_gmb_locations', 'edit_posts' ),
			array( 'wp_gmb_posts_list', 'read', 'List GBP posts (placeholder)', 'wp_gmb_posts_list', 'edit_posts' ),
			array( 'wp_gmb_create_post', 'write', 'Publish GBP post from WordPress post', 'wp_gmb_create_post', 'post' ),
			array( 'wp_assist_chat', 'write', 'Backend Assist natural language', 'wp_assist_chat', 'edit_posts' ),
			array( 'wp_assist_workflow_status', 'read', 'Workflow status', 'wp_assist_workflow_status', 'edit_posts' ),
			array( 'wp_assist_workflow_step', 'write', 'Execute workflow step', 'wp_assist_workflow_step', 'edit_posts' ),
			array( 'wp_super_migrate_plan', 'read', 'Super Import scan plan preview', 'wp_super_migrate_plan', 'manage_options' ),
			array( 'wp_super_migrate_start', 'write', 'Start Super Import job', 'wp_super_migrate_start', 'manage_options' ),
			array( 'wp_super_migrate_step', 'write', 'Run next Super Import step', 'wp_super_migrate_step', 'manage_options' ),
			array( 'wp_super_migrate_status', 'read', 'Super Import job status', 'wp_super_migrate_status', 'manage_options' ),
			array( 'wp_super_migrate_flo_sheet', 'read', 'Get Flo Sheet JSON workbook', 'wp_super_migrate_flo_sheet', 'manage_options' ),
			array( 'wp_super_migrate_flo_sheet_import', 'write', 'Import Flo Sheet and apply', 'wp_super_migrate_flo_sheet_import', 'manage_options' ),
			array( 'wp_seo_blocks_list', 'read', 'List Agent Hub SEO blocks', 'wp_seo_blocks_list', 'edit_posts' ),
			array( 'wp_seo_block_save', 'write', 'Save Agent Hub SEO block', 'wp_seo_block_save', 'manage_options' ),
			array( 'wp_seo_block_optimize', 'write', 'Preview or apply SEO block optimization', 'wp_seo_block_optimize', 'edit_posts' ),
			array( 'wp_seo_block_sync_library', 'write', 'Sync SEO block to Elementor library', 'wp_seo_block_sync_library', 'manage_options' ),
			array( 'wp_seo_blocks_usage', 'read', 'Scan SEO block usage across site', 'wp_seo_blocks_usage', 'edit_posts' ),
			array( 'wp_audit_list', 'read', 'Recent tool audit log', 'wp_audit_list', 'edit_posts' ),
			array( 'wp_revision_restore', 'destructive', 'Restore pre-agent content snapshot', 'wp_revision_restore', 'post' ),
		);

		$registry = array();
		foreach ( $defs as $d ) {
			$registry[ $d[0] ] = array(
				'risk'        => $d[1],
				'description' => $d[2],
				'handler'     => array( 'Flowbie_Wp_Tools_Handlers', $d[3] ),
				'capability'  => $d[4],
				'schema'      => array( 'type' => 'object' ),
			);
		}

		self::$registry = $registry;
		return self::$registry;
	}

	/**
	 * Tool names used by Backend Assist registry.
	 *
	 * @return array<int, string>
	 */
	public static function backend_assist_tool_names(): array {
		return array(
			'create_page',
			'create_post',
			'list_posts',
			'get_post',
			'add_content',
		);
	}

	/**
	 * @param string $ba_name Backend assist internal name.
	 * @return array<string, mixed>|null
	 */
	public static function get_backend_assist_entry( string $ba_name ): ?array {
		$map = array(
			'create_page'  => 'wp_create_page',
			'create_post'  => 'wp_create_post',
			'list_posts'   => 'wp_list_posts',
			'get_post'     => 'wp_get_post',
			'add_content'  => 'wp_add_content',
		);
		if ( ! isset( $map[ $ba_name ] ) ) {
			return null;
		}
		$registry = self::get_registry();
		return $registry[ $map[ $ba_name ] ] ?? null;
	}

	/**
	 * @param string               $tool_name Tool.
	 * @param array<string, mixed> $params    Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function execute( string $tool_name, array $params ) {
		$registry = self::get_registry();
		if ( ! isset( $registry[ $tool_name ] ) ) {
			return new WP_Error( 'flowbie_unknown_tool', __( 'Unknown tool.', 'flowbie-wp' ), array( 'status' => 404 ) );
		}

		$def = $registry[ $tool_name ];
		$perm = self::check_permission( $tool_name, $def, $params );
		if ( is_wp_error( $perm ) ) {
			return $perm;
		}

		if ( self::requires_confirm( $tool_name ) && empty( $params['confirm'] ) ) {
			return new WP_Error(
				'flowbie_confirm_required',
				__( 'This tool requires confirm: true in params.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		$handler = $def['handler'];
		if ( ! is_callable( $handler ) ) {
			return new WP_Error( 'flowbie_tool_handler', __( 'Tool handler missing.', 'flowbie-wp' ), array( 'status' => 500 ) );
		}

		$result = call_user_func( $handler, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return array(
			'ok'   => ! isset( $result['ok'] ) || $result['ok'],
			'data' => $result,
		);
	}

	/**
	 * @param string               $tool_name Tool.
	 * @param array<string, mixed> $def       Definition.
	 * @param array<string, mixed> $params    Params.
	 * @return true|WP_Error
	 */
	private static function check_permission( string $tool_name, array $def, array $params ) {
		if ( $tool_name === 'wp_ping' ) {
			return true;
		}

		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_not_logged_in', __( 'Authentication required.', 'flowbie-wp' ), array( 'status' => 401 ) );
		}

		$cap = isset( $def['capability'] ) ? (string) $def['capability'] : 'edit_posts';

		switch ( $cap ) {
			case 'read':
				return true;
			case 'manage_options':
				if ( ! current_user_can( 'manage_options' ) ) {
					return new WP_Error( 'rest_forbidden', __( 'Forbidden.', 'flowbie-wp' ), array( 'status' => 403 ) );
				}
				return true;
			case 'edit_themes':
				if ( ! current_user_can( 'edit_themes' ) ) {
					return new WP_Error(
						'rest_forbidden',
						__( 'edit_themes capability is required to read or write functions.php.', 'flowbie-wp' ),
						array( 'status' => 403 )
					);
				}
				return true;
			case 'upload':
				if ( ! Flowbie_Wp_Image_Seo_Gate::can_list() ) {
					return new WP_Error( 'rest_forbidden', __( 'Forbidden.', 'flowbie-wp' ), array( 'status' => 403 ) );
				}
				return true;
			case 'attachment':
				$aid = (int) ( $params['attachment_id'] ?? $params['id'] ?? 0 );
				$pid = (int) ( $params['post_id'] ?? 0 );
				$check = Flowbie_Wp_Image_Seo_Gate::can_edit_attachment( $aid, $pid );
				if ( is_wp_error( $check ) ) {
					return $check;
				}
				return true;
			case 'post':
				$post_id = self::resolve_post_id_from_params( $params );
				if ( $post_id < 1 ) {
					return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
				}
				if ( ! current_user_can( 'edit_post', $post_id ) ) {
					return new WP_Error( 'rest_forbidden', __( 'Forbidden.', 'flowbie-wp' ), array( 'status' => 403 ) );
				}
				if ( in_array( $tool_name, array( 'wp_delete_post' ), true ) && ! current_user_can( 'delete_post', $post_id ) ) {
					return new WP_Error( 'rest_forbidden', __( 'Cannot delete this post.', 'flowbie-wp' ), array( 'status' => 403 ) );
				}
				return true;
			case 'edit_posts':
			default:
				if ( ! current_user_can( 'edit_posts' ) ) {
					return new WP_Error( 'rest_forbidden', __( 'Forbidden.', 'flowbie-wp' ), array( 'status' => 403 ) );
				}
				return true;
		}
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return int
	 */
	private static function resolve_post_id_from_params( array $params ): int {
		if ( ! empty( $params['post_id'] ) ) {
			return (int) $params['post_id'];
		}
		return 0;
	}

	/**
	 * @param string $tool_name Tool.
	 * @return bool
	 */
	public static function requires_confirm( string $tool_name ): bool {
		return in_array( $tool_name, self::$confirm_tools, true );
	}

	/**
	 * @param string               $key    Idempotency key.
	 * @param string               $tool   Tool name.
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|null
	 */
	public static function get_idempotent_result( string $key, string $tool, array $params ): ?array {
		$hash = md5( wp_json_encode( array( $tool, $params ) ) );
		$stored = get_transient( 'flowbie_idem_' . md5( $key . $hash ) );
		return is_array( $stored ) ? $stored : null;
	}

	/**
	 * @param string               $key     Key.
	 * @param string               $tool    Tool.
	 * @param array<string, mixed> $params  Params.
	 * @param array<string, mixed> $payload Response.
	 */
	public static function store_idempotent_result( string $key, string $tool, array $params, array $payload ): void {
		$hash = md5( wp_json_encode( array( $tool, $params ) ) );
		set_transient( 'flowbie_idem_' . md5( $key . $hash ), $payload, DAY_IN_SECONDS );
	}
}
