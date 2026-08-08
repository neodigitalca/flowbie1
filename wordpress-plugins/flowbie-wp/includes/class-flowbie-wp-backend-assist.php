<?php
/**
 * Backend Assist: AI-powered WordPress admin tool-calling specialist.
 *
 * Public facade — implementation lives in includes/backend-assist/.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist {

	public static function init(): void {
		self::load_dependencies();
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		Flowbie_Wp_Backend_Assist_Registry::register_default_tools();
	}

	private static function load_dependencies(): void {
		$dir = FLOWBIE_WP_PLUGIN_DIR . 'includes/backend-assist/';
		require_once $dir . 'class-flowbie-wp-backend-assist-context.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-ai.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-cards.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-tools-wp.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-tools-seo.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-tools-analytics.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-registry.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-content.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-workflow-builder.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-workflow.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-pipeline-classify.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-pipeline-content-prep.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-pipeline-phases.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-pipeline.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-submode.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-rest.php';
		require_once $dir . 'class-flowbie-wp-backend-assist-sessions.php';
	}

	public static function register_routes(): void {
		Flowbie_Wp_Backend_Assist_Rest::register_routes();
	}

	public static function register_tool( string $tool_name, callable $handler, string $description = '' ): void {
		Flowbie_Wp_Backend_Assist_Registry::register_tool( $tool_name, $handler, $description );
	}

	public static function get_tool_descriptions(): string {
		return Flowbie_Wp_Backend_Assist_Registry::get_tool_descriptions();
	}

	public static function rest_handle( WP_REST_Request $request ): WP_REST_Response {
		return Flowbie_Wp_Backend_Assist_Rest::rest_handle( $request );
	}

	public static function rest_step_handle( WP_REST_Request $request ): WP_REST_Response {
		return Flowbie_Wp_Backend_Assist_Rest::rest_step_handle( $request );
	}

	public static function rest_workflow_status( WP_REST_Request $request ): WP_REST_Response {
		return Flowbie_Wp_Backend_Assist_Rest::rest_workflow_status( $request );
	}

	public static function rest_sessions_list( WP_REST_Request $request ): WP_REST_Response {
		return Flowbie_Wp_Backend_Assist_Sessions::rest_sessions_list( $request );
	}

	public static function rest_session_get( WP_REST_Request $request ): WP_REST_Response {
		return Flowbie_Wp_Backend_Assist_Sessions::rest_session_get( $request );
	}

	public static function rest_sessions_save( WP_REST_Request $request ): WP_REST_Response {
		return Flowbie_Wp_Backend_Assist_Sessions::rest_sessions_save( $request );
	}

	public static function rest_session_delete( WP_REST_Request $request ): WP_REST_Response {
		return Flowbie_Wp_Backend_Assist_Sessions::rest_session_delete( $request );
	}

	public static function rest_sessions_clear( WP_REST_Request $request ): WP_REST_Response {
		return Flowbie_Wp_Backend_Assist_Sessions::rest_sessions_clear( $request );
	}

	public static function tool_create_page( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Wp::tool_create_page( $params );
	}

	public static function tool_create_post( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Wp::tool_create_post( $params );
	}

	public static function tool_list_posts( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Wp::tool_list_posts( $params );
	}

	public static function tool_get_post( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Wp::tool_get_post( $params );
	}

	public static function tool_add_content( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Wp::tool_add_content( $params );
	}

	public static function tool_get_gsc_context( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Wp::tool_get_gsc_context( $params );
	}

	public static function tool_modify_seo_block_slots( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Seo::tool_modify_seo_block_slots( $params );
	}

	public static function tool_list_seo_blocks( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Seo::tool_list_seo_blocks( $params );
	}

	public static function tool_create_seo_block( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Seo::tool_create_seo_block( $params );
	}

	public static function tool_delete_seo_block( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Seo::tool_delete_seo_block( $params );
	}

	public static function tool_save_seo_block( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Seo::tool_save_seo_block( $params );
	}

	public static function tool_apply_seo_block_to_page( array $params ): array {
		return Flowbie_Wp_Backend_Assist_Tools_Seo::tool_apply_seo_block_to_page( $params );
	}
}
