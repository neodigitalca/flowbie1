<?php
/**
 * Plugin Name:       Flowbie WP
 * Plugin URI:        https://github.com/flowbie/flowbie
 * Description:       Flowbie AI tools for WordPress — chat, search, SEO, and editor wands.
	 * Version:           0.9.49
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Flowbie
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       flowbie-wp
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

define( 'FLOWBIE_WP_VERSION', '0.9.63' );
define( 'FLOWBIE_WP_PLUGIN_FILE', __FILE__ );
define( 'FLOWBIE_WP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-env.php';
Flowbie_Wp_Env::load();

/** Set true in wp-config to re-enable optimization cap on Apply. */
if ( ! defined( 'FLOWBIE_WP_AI_CAP_ENFORCED' ) ) {
	define( 'FLOWBIE_WP_AI_CAP_ENFORCED', false );
}

$gsc_config_file = FLOWBIE_WP_PLUGIN_DIR . 'includes/flowbie-wp-gsc-config.php';
if ( is_readable( $gsc_config_file ) ) {
	require_once $gsc_config_file;
}

/** Legacy Flowbie Node API origin (optional; publish tooling only). */
if ( ! defined( 'FLOWBIE_WP_DEFAULT_API_BASE' ) ) {
	define( 'FLOWBIE_WP_DEFAULT_API_BASE', '' );
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-gsc.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-gsc-prompt.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-site-progress.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-api.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-openrouter.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-voice.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-research-keys.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-dataforseo.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-semrush.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-seo-brief-merge.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-fields.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-seo-limits.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-context.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-meta.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-backend.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-gsc.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-seo-research.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-enhance.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-apply.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/harness/class-flowbie-wp-harness-prompts.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/harness/class-flowbie-wp-harness-outline.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/harness/class-flowbie-wp-harness-session.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/harness/class-flowbie-wp-content-sections.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/harness/class-flowbie-wp-harness-blueprint.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/harness/class-flowbie-wp-harness-runner.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/harness/class-flowbie-wp-harness-links.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-body.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-gate.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-url.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overview-seo-bulk.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-body-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-editor.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-global-css.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-sitemap-settings.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-sitemap-cache.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-sitemap-generator.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-sitemap.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-robots-txt.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-redirects-csv.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-redirects.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-script-manager-rules.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-script-manager.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-script-manager-csv.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-script-manager-import.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-script-manager-output.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-script-manager-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-settings.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-export.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-import.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-diagnostics.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-cache-flush.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-excludes.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-gate.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-cache.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-warm.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-minify.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-front.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-html.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-assets.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-aggregator.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-buffer.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-image-settings.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-image-stats.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-image-optimizer.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-image-delivery.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-image-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-speed-images.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-image-seo-gate.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-image-seo-ai.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-image-seo.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-image-seo-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-gmb.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-gmb-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-comments.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/search/class-flowbie-wp-search-icons.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-search.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-ai-widget-design.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-rag.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-display-text.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-history.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-links.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-lead.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-starters.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-page-context.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-page-summary.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-suggestion-templates.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-agents.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-logs-csv.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-logs.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-logs-analysis.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-insights.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-logs-gap-csv.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-super-admin.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-search-logs-csv.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-search-logs.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer-conversions.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer-collect.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer-csv.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-markdown.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer-tasks.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer-gsc.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer-reports.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer-analysis.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chekkit.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chekkit-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-tools-audit.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-tools-handlers.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-tools.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-tools-library.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-tools-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-redirects-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-backend-assist.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-flo-sheet.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-super-migrate.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-super-migrate-rest.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-builder.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/admin/class-flowbie-wp-admin-menu.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-admin.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-dashboard-preferences.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-content-tools.php';

register_activation_hook(
	FLOWBIE_WP_PLUGIN_FILE,
	static function () {
		Flowbie_Wp_Sitemap::flush_rewrites();
		Flowbie_Wp_Redirects::install();
		Flowbie_Wp_Chat_Logs::install();
		Flowbie_Wp_Search_Logs::install();
		Flowbie_Wp_Script_Manager::install();
		Flowbie_Wp_Overseer::install();
		Flowbie_Wp_Forms::install();
		Flowbie_Wp_Seo_Builder::install();
		Flowbie_Wp_Speed_Cache::ensure_dirs();
		Flowbie_Wp_Speed_Settings::seed_default_config_if_missing();
	}
);

add_action(
	'plugins_loaded',
	static function () {
		load_plugin_textdomain( 'flowbie-wp', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
		Flowbie_Wp_Fields::init();
		Flowbie_Wp_Content_Tools::init();

		$installed = (string) get_option( 'flowbie_wp_installed_version', '' );
		if ( $installed !== FLOWBIE_WP_VERSION ) {
			update_option( 'flowbie_wp_installed_version', FLOWBIE_WP_VERSION, false );
			if ( class_exists( 'Flowbie_Wp_Cache_Flush', false ) ) {
				Flowbie_Wp_Cache_Flush::flush_all();
			}
		}
	},
	4
);

add_action(
	'plugins_loaded',
	static function () {
		Flowbie_Wp_Api::maybe_migrate_legacy_data();
		Flowbie_Wp_Admin::init();
		$flowbie_welcome_file = FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-welcome.php';
		if ( is_readable( $flowbie_welcome_file ) ) {
			require_once $flowbie_welcome_file;
			Flowbie_Wp_Welcome::init();
		}
		Flowbie_Wp_Dashboard_Preferences::init();
		Flowbie_Wp_Rest::init();
		Flowbie_Wp_Global_Css::init();
		Flowbie_Wp_Sitemap::init();
		Flowbie_Wp_Robots_Txt::init();
		Flowbie_Wp_Redirects::init();
		Flowbie_Wp_Script_Manager::init();
		Flowbie_Wp_Script_Manager_Output::init();
		Flowbie_Wp_Script_Manager_Rest::init();
		Flowbie_Wp_Cache_Flush::init();
		Flowbie_Wp_Speed::init();
		Flowbie_Wp_Speed_Images::init();
		Flowbie_Wp_Ai_Rest::init();
		Flowbie_Wp_Overview_Seo_Bulk::init();
		Flowbie_Wp_Ai_Body_Rest::init();
		Flowbie_Wp_Editor::init();
		Flowbie_Wp_Image_Seo::init();
		Flowbie_Wp_Image_Seo_Rest::init();
		Flowbie_Wp_Gmb::init();
		Flowbie_Wp_Gmb_Rest::init();
		Flowbie_Wp_Comments::init();
		Flowbie_Wp_Search::init();
		Flowbie_Wp_Ai_Widget_Design::init();
		Flowbie_Wp_Chat_Logs::init();
		Flowbie_Wp_Search_Logs::init();
		Flowbie_Wp_Overseer::init();
		Flowbie_Wp_Overseer_Collect::init();
		Flowbie_Wp_Chat::init();
		Flowbie_Wp_Chekkit_Rest::init();
		Flowbie_Wp_Voice::init();
		Flowbie_Wp_Seo_Builder::init();
		Flowbie_Wp_Backend_Assist::init();
		Flowbie_Wp_Super_Migrate_Rest::init();
		Flowbie_Wp_Tools_Rest::init();
		Flowbie_Wp_Redirects_Rest::init();
		Flowbie_Wp_Forms::init();
	},
	5
);
