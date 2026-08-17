<?php
/**
 * Plugin Name:       NEO Pulse WP
 * Plugin URI:        https://github.com/neo-pulse/neo-pulse
 * Description:       NEO Pulse AI tools for WordPress — chat, search, SEO, and editor wands.
	 * Version:           0.9.124
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            NEO Pulse
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       neo-pulse-wp
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

define( 'NEO_PULSE_WP_VERSION', '0.9.124' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', __FILE__ );
define( 'NEO_PULSE_WP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-env.php';
Neo_Pulse_Wp_Env::load();
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-migrate-from-flowbie.php';

/** Set true in wp-config to re-enable optimization cap on Apply. */
if ( ! defined( 'NEO_PULSE_WP_AI_CAP_ENFORCED' ) ) {
	define( 'NEO_PULSE_WP_AI_CAP_ENFORCED', false );
}

$gsc_config_file = NEO_PULSE_WP_PLUGIN_DIR . 'includes/neo-pulse-wp-gsc-config.php';
if ( is_readable( $gsc_config_file ) ) {
	require_once $gsc_config_file;
}

/** Legacy NEO Pulse Node API origin (optional; publish tooling only). */
if ( ! defined( 'NEO_PULSE_WP_DEFAULT_API_BASE' ) ) {
	define( 'NEO_PULSE_WP_DEFAULT_API_BASE', '' );
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-gsc.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-gsc-prompt.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-site-progress.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-api.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-openrouter.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-voice.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-research-keys.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-dataforseo.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-semrush.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-seo-brief-merge.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-fields.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-seo-limits.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-context.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-meta.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-backend.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-gsc.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-seo-research.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-enhance.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-apply.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/harness/class-neo-pulse-wp-harness-prompts.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/harness/class-neo-pulse-wp-harness-outline.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/harness/class-neo-pulse-wp-harness-session.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/harness/class-neo-pulse-wp-content-sections.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/harness/class-neo-pulse-wp-harness-blueprint.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/harness/class-neo-pulse-wp-harness-runner.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/harness/class-neo-pulse-wp-harness-links.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-body.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-gate.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-url.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-overview-seo-bulk.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-body-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-editor.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-global-css.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-sitemap-settings.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-sitemap-cache.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-sitemap-generator.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-sitemap.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-robots-txt.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-redirects-csv.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-redirects.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-script-manager-rules.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-script-manager.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-script-manager-csv.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-script-manager-import.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-script-manager-output.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-script-manager-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-settings.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-export.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-import.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-diagnostics.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-cache-flush.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-excludes.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-gate.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-cache.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-warm.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-minify.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-front.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-html.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-assets.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-aggregator.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-buffer.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-image-settings.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-image-stats.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-image-optimizer.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-image-delivery.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-image-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-images.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-image-seo-gate.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-image-seo-ai.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-image-seo.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-image-seo-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-gmb.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-gmb-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-comments.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/search/class-neo-pulse-wp-search-icons.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-search.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-widget-design.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-rag.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-display-text.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-history.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-links.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-lead.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-starters.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-page-context.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-page-summary.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-suggestion-templates.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-agents.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-logs-csv.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-logs.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-logs-analysis.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-insights.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-site-inventory.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-logs-gap-csv.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-super-admin.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-search-logs-csv.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-search-logs.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-overseer.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-overseer-conversions.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-overseer-collect.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-overseer-csv.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-markdown.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-overseer-tasks.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-overseer-gsc.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-overseer-reports.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-overseer-analysis.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chekkit.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chekkit-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-tools-audit.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-tools-handlers.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-tools.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-tools-library.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-tools-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-redirects-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-backend-assist.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-flo-sheet.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-super-migrate.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-super-migrate-rest.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-builder.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/admin/class-neo-pulse-wp-admin-menu.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-admin.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-dashboard-preferences.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-content-tools.php';

register_activation_hook(
	NEO_PULSE_WP_PLUGIN_FILE,
	static function () {
		Neo_Pulse_Wp_Sitemap::flush_rewrites();
		Neo_Pulse_Wp_Redirects::install();
		Neo_Pulse_Wp_Chat_Logs::install();
		Neo_Pulse_Wp_Search_Logs::install();
		Neo_Pulse_Wp_Script_Manager::install();
		Neo_Pulse_Wp_Overseer::install();
		Neo_Pulse_Wp_Forms::install();
		Neo_Pulse_Wp_Seo_Builder::install();
		Neo_Pulse_Wp_Speed_Cache::ensure_dirs();
		Neo_Pulse_Wp_Speed_Settings::seed_default_config_if_missing();
	}
);

add_action(
	'plugins_loaded',
	static function () {
		load_plugin_textdomain( 'neo-pulse-wp', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
		Neo_Pulse_Wp_Fields::init();
		Neo_Pulse_Wp_Content_Tools::init();

		$installed = (string) get_option( 'neo_pulse_wp_installed_version', '' );
		if ( $installed !== NEO_PULSE_WP_VERSION ) {
			update_option( 'neo_pulse_wp_installed_version', NEO_PULSE_WP_VERSION, false );
			if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush', false ) ) {
				Neo_Pulse_Wp_Cache_Flush::flush_all();
			}
		}
	},
	4
);

add_action(
	'plugins_loaded',
	static function () {
		Neo_Pulse_Wp_Migrate_From_Flowbie::maybe_run();
		Neo_Pulse_Wp_Api::maybe_migrate_legacy_data();
		Neo_Pulse_Wp_Admin::init();
		$neo_pulse_welcome_file = NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-welcome.php';
		if ( is_readable( $neo_pulse_welcome_file ) ) {
			require_once $neo_pulse_welcome_file;
			Neo_Pulse_Wp_Welcome::init();
		}
		Neo_Pulse_Wp_Dashboard_Preferences::init();
		Neo_Pulse_Wp_Rest::init();
		Neo_Pulse_Wp_Global_Css::init();
		Neo_Pulse_Wp_Sitemap::init();
		Neo_Pulse_Wp_Robots_Txt::init();
		Neo_Pulse_Wp_Redirects::init();
		Neo_Pulse_Wp_Script_Manager::init();
		Neo_Pulse_Wp_Script_Manager_Output::init();
		Neo_Pulse_Wp_Script_Manager_Rest::init();
		Neo_Pulse_Wp_Cache_Flush::init();
		Neo_Pulse_Wp_Speed::init();
		Neo_Pulse_Wp_Speed_Images::init();
		Neo_Pulse_Wp_Ai_Rest::init();
		Neo_Pulse_Wp_Overview_Seo_Bulk::init();
		Neo_Pulse_Wp_Ai_Body_Rest::init();
		Neo_Pulse_Wp_Editor::init();
		Neo_Pulse_Wp_Image_Seo::init();
		Neo_Pulse_Wp_Image_Seo_Rest::init();
		Neo_Pulse_Wp_Gmb::init();
		Neo_Pulse_Wp_Gmb_Rest::init();
		Neo_Pulse_Wp_Comments::init();
		Neo_Pulse_Wp_Search::init();
		Neo_Pulse_Wp_Ai_Widget_Design::init();
		Neo_Pulse_Wp_Chat_Logs::init();
		Neo_Pulse_Wp_Search_Logs::init();
		Neo_Pulse_Wp_Overseer::init();
		Neo_Pulse_Wp_Overseer_Collect::init();
		Neo_Pulse_Wp_Chat::init();
		Neo_Pulse_Wp_Chekkit_Rest::init();
		Neo_Pulse_Wp_Voice::init();
		Neo_Pulse_Wp_Seo_Builder::init();
		Neo_Pulse_Wp_Backend_Assist::init();
		Neo_Pulse_Wp_Super_Migrate_Rest::init();
		Neo_Pulse_Wp_Tools_Rest::init();
		Neo_Pulse_Wp_Redirects_Rest::init();
		Neo_Pulse_Wp_Forms::init();
	},
	5
);
