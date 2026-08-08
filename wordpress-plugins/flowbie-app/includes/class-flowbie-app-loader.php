<?php
/**
 * Bootstrap Flowbie App plugin modules and early /api/* dispatcher.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Loader {

	public static function init(): void {
		self::includes();
		Flowbie_App_Gmb_Oauth::maybe_migrate_legacy_config();
		Flowbie_App_Api_Dispatcher::init();
		Flowbie_App_Webhook_Dispatcher::init();
		Flowbie_App_Admin::init();
		Flowbie_App_Front_Shell::init();
		Flowbie_App_Gsc_Route_Handlers::register();
		Flowbie_App_Overview_Route_Handlers::register();
		Flowbie_App_Wp_Route_Handlers::register();
		Flowbie_App_Dataforseo_Route_Handlers::register();
		Flowbie_App_Semrush_Route_Handlers::register();
		Flowbie_App_Proposal_Route_Handlers::register();
	}

	public static function activate(): void {
		self::includes();
		Flowbie_App_Teams_Store::install_tables();
		Flowbie_App_Chat_Store::install_tables();
		Flowbie_App_Tasks_Store::install_tables();
		if ( class_exists( 'Flowbie_App_Chat_Flo' ) ) {
			Flowbie_App_Chat_Flo::ensure_global_user();
			Flowbie_App_Chat_Flo::ensure_all_teams();
		}
		Flowbie_App_Data_Paths::root();
		Flowbie_App_Data_Paths::subdir( 'gsc' );
		Flowbie_App_Data_Paths::subdir( 'seo-briefs' );
		Flowbie_App_Data_Paths::subdir( 'serp-dumps' );
		Flowbie_App_Data_Paths::subdir( 'semrush' );
		Flowbie_App_Data_Paths::subdir( 'vertical-benchmarks' );
		Flowbie_App_Data_Paths::subdir( 'knowledge-model-jobs' );
		Flowbie_App_Api_Dispatcher::register_rewrites();
		flush_rewrite_rules();
	}

	public static function deactivate(): void {
		flush_rewrite_rules();
	}

	private static function includes(): void {
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/config/class-secrets-loader.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/config/class-openrouter-attribution.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/storage/class-flowbie-data-paths.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/storage/class-json-file-store.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/router/class-api-dispatcher.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/webhook/class-chekkit-webhook.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/webhook/class-webhook-dispatcher.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/admin/class-flowbie-app-admin.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/front/class-flowbie-app-front-shell.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/class-flowbie-app-dataforseo.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/dataforseo/class-dataforseo-client.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/dataforseo/class-dataforseo-mcp-router.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/dataforseo/class-dataforseo-serp-dumps.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/dataforseo/class-dataforseo-google-images.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/dataforseo/class-dataforseo-ai-mode.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/dataforseo/class-dataforseo-organic-competitors-parse.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/dataforseo/class-dataforseo-organic-competitors.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/dataforseo/class-dataforseo-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/class-flowbie-app-semrush.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/semrush/class-semrush-client.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/semrush/class-semrush-table-parse.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/semrush/class-semrush-competitor-shared.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/semrush/class-semrush-bulk-enrichment.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/semrush/class-semrush-organic-competitors.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/semrush/class-semrush-projects-api.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/semrush/class-semrush-overview-json.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/semrush/class-semrush-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/proposal/class-proposal-lighthouse-parse.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/proposal/class-proposal-faq-inventory.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/proposal/class-proposal-site-audit.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/proposal/class-proposal-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gsc/class-gsc-service-account.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gsc/class-gsc-queries.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gsc/class-gsc-performance.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gsc/class-gsc-performance-batch.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gsc/class-gsc-entity-performance.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gsc/class-gsc-reporting-bundle.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gsc/class-gsc-indexing.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gsc/class-gsc-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/ga/class-ga-credentials.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/ga/class-ga-api.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/ga/class-ga-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gmb/class-gmb-oauth.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gmb/class-gmb-tokens.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gmb/class-gmb-performance.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gmb/class-gmb-posts.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/gmb/class-gmb-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/overview/class-overview-fetch-meta.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/overview/class-overview-meta-ai.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/overview/class-overview-seo-brief.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/overview/class-overview-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/integrations/class-sites-sync.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/integrations/class-integrations-route-handlers.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/integrations/class-manager-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/teams/class-teams-store.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-typing.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-calls.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-mentions.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-preferences.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-openrouter.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-flo.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-store.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-activity-log.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-assets.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-link-unfurl.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/mail/class-flowbie-app-mail.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/teams/class-teams-invites.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/chat/class-chat-route-handlers.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/tasks/class-tasks-store.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/tasks/class-tasks-assets.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/tasks/class-tasks-route-handlers.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/teams/class-teams-route-handlers.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/auth/class-auth-session.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/auth/class-auth-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/images/class-openrouter-image.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/images/class-images-route-handlers.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/bulk/class-validate-internal-links.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/proxy/class-wikipedia-proxy.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/maps/class-entity-maps-image.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/seo/class-local-business-schema-extract.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/seo/class-postal-geocode.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/seo/class-page-address-llm.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/seo/class-seo-http.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/seo/class-seo-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/grid-local/class-grid-local-maps-dfs.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/grid-local/class-grid-local-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/vertical-benchmark/class-vertical-benchmark-taxonomy.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/vertical-benchmark/class-vertical-benchmark-client-tag.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/vertical-benchmark/class-vertical-benchmark-openrouter.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/vertical-benchmark/class-vertical-benchmark-sites.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/vertical-benchmark/class-vertical-benchmark-classify.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/vertical-benchmark/class-vertical-benchmark-sitemap-urls.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/vertical-benchmark/class-vertical-benchmark-gsc-export.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/vertical-benchmark/class-vertical-benchmark-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/site-scraper/class-site-scraper-route-handlers.php';

		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/knowledge-model/class-knowledge-model-progress.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/knowledge-model/class-knowledge-model-service.php';
		require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/knowledge-model/class-knowledge-model-route-handlers.php';

		self::includes_wordpress();
	}

	private static function includes_wordpress(): void {
		$wp = FLOWBIE_APP_PLUGIN_DIR . 'includes/wordpress/';
		require_once $wp . 'class-wp-url-normalize.php';
		require_once $wp . 'class-wp-rest-client.php';
		require_once $wp . 'class-wp-connection.php';
		require_once $wp . 'class-wp-sitemap.php';
		require_once $wp . 'class-wp-inventory-collector.php';
		require_once $wp . 'class-wp-posts-inventory.php';
		require_once $wp . 'class-wp-post-content.php';
		require_once $wp . 'class-wp-url-resolver.php';
		require_once $wp . 'class-wp-post-crud.php';
		require_once $wp . 'class-wp-media.php';
		require_once $wp . 'class-wp-acf-protocol.php';
		require_once $wp . 'class-wp-flowbie-tools.php';
		require_once $wp . 'class-wp-acf-by-url.php';
		require_once $wp . 'class-wp-acf-discovery.php';
		require_once $wp . 'class-wp-editorial-counts.php';
		require_once $wp . 'class-wp-meta.php';
		require_once $wp . 'class-wp-overview-seo-item.php';
		require_once $wp . 'class-wp-bulk-overview-seo.php';
		require_once $wp . 'class-wp-featured-media.php';
		require_once $wp . 'class-wp-change-post-url.php';
		require_once $wp . 'class-wp-author-resolver.php';
		require_once $wp . 'class-wp-route-handlers.php';
	}
}
