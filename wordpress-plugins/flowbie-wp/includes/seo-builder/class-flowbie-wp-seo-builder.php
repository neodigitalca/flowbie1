<?php
/**
 * Agentic SEO Builder bootstrap.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Seo_Builder {

	public static function init(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-layout.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-slots.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-usage.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-library.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-storage.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-context.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-optimizer.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-mutation.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-page-insert.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-agent.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-rest.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-elementor.php';

		Flowbie_Wp_Seo_Blocks_Storage::init();
		Flowbie_Wp_Seo_Blocks_Rest::init();
		Flowbie_Wp_Seo_Blocks_Elementor::init();
		Flowbie_Wp_Admin::register_agent_hub_handlers();

		add_filter( 'flowbie_wp_flo_sheet_export', array( __CLASS__, 'augment_flo_sheet' ) );
		add_action( 'admin_notices', array( __CLASS__, 'maybe_elementor_notice' ) );
	}

	/**
	 * @param array<string,mixed> $sheet
	 * @return array<string,mixed>
	 */
	public static function augment_flo_sheet( array $sheet ): array {
		if ( ! isset( $sheet['sheets'] ) || ! is_array( $sheet['sheets'] ) ) {
			$sheet['sheets'] = array();
		}
		$sheet['sheets']['seo_blocks'] = Flowbie_Wp_Seo_Blocks_Storage::export_for_flo_sheet();
		return $sheet;
	}

	/**
	 * @param array<string,mixed> $sheet
	 */
	public static function import_flo_sheet_blocks( array $sheet ): void {
		$blocks = $sheet['sheets']['seo_blocks'] ?? array();
		if ( ! is_array( $blocks ) ) {
			return;
		}
		foreach ( $blocks as $block ) {
			if ( is_array( $block ) ) {
				Flowbie_Wp_Seo_Blocks_Storage::save( $block );
			}
		}
	}

	public static function install(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-storage.php';
		Flowbie_Wp_Seo_Blocks_Storage::install();
	}

	public static function maybe_elementor_notice(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$hub_screens = array(
			'flowbie-wp_page_flowbie-wp-agent-hub',
			'flowbie-wp_page_flowbie-wp-agent-hub-edit',
			'admin_page_flowbie-wp-agent-hub-edit',
		);
		if ( ! $screen || ! in_array( $screen->id, $hub_screens, true ) ) {
			return;
		}
		if ( Flowbie_Wp_Seo_Blocks_Library::elementor_available() ) {
			return;
		}
		echo '<div class="notice notice-warning"><p>';
		echo esc_html__( 'Agent Hub library sync requires Elementor. Install and activate Elementor to create section templates.', 'flowbie-wp' );
		echo '</p></div>';
	}
}
