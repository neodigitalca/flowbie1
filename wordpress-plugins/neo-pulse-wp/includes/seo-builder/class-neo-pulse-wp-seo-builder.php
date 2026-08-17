<?php
/**
 * Agentic SEO Builder bootstrap.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Builder {

	public static function init(): void {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-layout.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-slots.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-usage.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-library.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-storage.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-context.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-optimizer.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-mutation.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-page-insert.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-agent.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-rest.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-elementor.php';

		Neo_Pulse_Wp_Seo_Blocks_Storage::init();
		Neo_Pulse_Wp_Seo_Blocks_Rest::init();
		Neo_Pulse_Wp_Seo_Blocks_Elementor::init();
		Neo_Pulse_Wp_Admin::register_agent_hub_handlers();

		add_filter( 'neo_pulse_wp_flo_sheet_export', array( __CLASS__, 'augment_flo_sheet' ) );
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
		$sheet['sheets']['seo_blocks'] = Neo_Pulse_Wp_Seo_Blocks_Storage::export_for_flo_sheet();
		return $sheet;
	}

	/**
	 * @param array<string,mixed> $sheet
	 */
	public static function import_neo_pulse_sheet_blocks( array $sheet ): void {
		$blocks = $sheet['sheets']['seo_blocks'] ?? array();
		if ( ! is_array( $blocks ) ) {
			return;
		}
		foreach ( $blocks as $block ) {
			if ( is_array( $block ) ) {
				Neo_Pulse_Wp_Seo_Blocks_Storage::save( $block );
			}
		}
	}

	public static function install(): void {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-storage.php';
		Neo_Pulse_Wp_Seo_Blocks_Storage::install();
	}

	public static function maybe_elementor_notice(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$hub_screens = array(
			'neo-pulse-wp_page_neo_pulse-wp-agent-hub',
			'neo-pulse-wp_page_neo_pulse-wp-agent-hub-edit',
			'admin_page_neo_pulse-wp-agent-hub-edit',
		);
		if ( ! $screen || ! in_array( $screen->id, $hub_screens, true ) ) {
			return;
		}
		if ( Neo_Pulse_Wp_Seo_Blocks_Library::elementor_available() ) {
			return;
		}
		echo '<div class="notice notice-warning"><p>';
		echo esc_html__( 'Agent Hub library sync requires Elementor. Install and activate Elementor to create section templates.', 'neo-pulse-wp' );
		echo '</p></div>';
	}
}
