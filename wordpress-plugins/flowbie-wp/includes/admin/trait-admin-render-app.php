<?php
/**
 * Main Flowbie WP client dashboard — property row from flowbie_user_wordpress_properties.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_App {

	public static function render_app_page(): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			return;
		}

		$flash        = self::get_and_clear_flash();
		$settings_url = admin_url( 'admin.php?page=flowbie-wp-settings' );
		$paired       = Flowbie_Wp_Api::is_paired();
		$dashboard_rs = $paired ? Flowbie_Wp_Api::fetch_plugin_dashboard_state() : null;
		$dashboard    = ( is_array( $dashboard_rs ) && ! empty( $dashboard_rs['ok'] ) && is_array( $dashboard_rs['dashboard'] ) ) ? $dashboard_rs['dashboard'] : null;
		$progress     = is_array( $dashboard ) && isset( $dashboard['progress'] ) && is_array( $dashboard['progress'] ) ? $dashboard['progress'] : null;
		$paired_ok    = $paired && is_array( $dashboard_rs ) && ! empty( $dashboard_rs['ok'] );

		$metrics_progress = null;
		if ( $paired_ok && is_array( $progress ) ) {
			$metrics_progress = $progress;
		} elseif ( $paired && is_array( $dashboard_rs ) && empty( $dashboard_rs['ok'] ) ) {
			$metrics_progress = array(
				'ok'    => false,
				'error' => isset( $dashboard_rs['error'] ) && is_string( $dashboard_rs['error'] ) ? $dashboard_rs['error'] : '',
			);
		}

		?>
		<div class="wrap flowbie-wp-app flowbie-wp-app--dashboard">
			<h1 class="screen-reader-text"><?php echo esc_html( get_admin_page_title() ); ?></h1>

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<?php if ( ! $paired ) : ?>
				<div class="flowbie-wp-card flowbie-wp-card--notice">
					<h2 class="flowbie-wp-card__title"><?php esc_html_e( 'Connect this site', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Copy the site ID from your property in Integrations and enter it under Settings.', 'flowbie-wp' ); ?></p>
					<p><a class="button button-primary" href="<?php echo esc_url( $settings_url ); ?>"><?php esc_html_e( 'Open Settings', 'flowbie-wp' ); ?></a></p>
				</div>
			<?php elseif ( ! $paired_ok ) : ?>
				<div class="flowbie-wp-card flowbie-wp-card--notice">
					<h2 class="flowbie-wp-card__title"><?php esc_html_e( 'Could not load property', 'flowbie-wp' ); ?></h2>
					<p><?php echo esc_html( is_array( $dashboard_rs ) && ! empty( $dashboard_rs['error'] ) ? (string) $dashboard_rs['error'] : __( 'Unknown error.', 'flowbie-wp' ) ); ?></p>
					<p><a href="<?php echo esc_url( $settings_url ); ?>"><?php esc_html_e( 'Check Settings', 'flowbie-wp' ); ?></a></p>
				</div>
			<?php endif; ?>

			<div class="flowbie-wp-dashboard">
				<?php
				self::render_dashboard_site_overview(
					$paired,
					$paired_ok,
					is_array( $dashboard ) ? $dashboard : null,
					$settings_url
				);
				?>
				<div class="flowbie-wp-dashboard__metrics-panel">
					<h2 class="flowbie-wp-dashboard__section-title"><?php esc_html_e( 'Property metrics', 'flowbie-wp' ); ?></h2>
					<div class="flowbie-wp-dashboard__metrics">
						<?php self::render_site_progress_strip( $metrics_progress, 'full' ); ?>
					</div>
				</div>

				<?php self::render_dashboard_module_grid(); ?>
			</div>
		</div>
		<?php
	}

	/**
	 * Site summary panel at the top of the dashboard.
	 *
	 * @param bool                        $paired       Site ID saved locally.
	 * @param bool                        $paired_ok    Flowbie dashboard payload loaded.
	 * @param array<string,mixed>|null    $dashboard    Dashboard payload when paired_ok.
	 * @param string                      $settings_url Settings admin URL.
	 */
	private static function render_dashboard_site_overview( bool $paired, bool $paired_ok, ?array $dashboard, string $settings_url ): void {
		$settings      = Flowbie_Wp_Api::get_settings();
		$paired_id     = isset( $settings['paired_site_id'] ) ? trim( (string) $settings['paired_site_id'] ) : '';
		$paired_name   = isset( $settings['paired_client_name'] ) ? trim( (string) $settings['paired_client_name'] ) : '';
		$client        = is_array( $dashboard ) && isset( $dashboard['client'] ) && is_array( $dashboard['client'] ) ? $dashboard['client'] : array();
		$client_name   = isset( $client['name'] ) ? trim( (string) $client['name'] ) : '';
		$display_name  = $client_name !== '' ? $client_name : ( $paired_name !== '' ? $paired_name : get_bloginfo( 'name' ) );
		$site_url      = isset( $client['siteUrl'] ) ? trim( (string) $client['siteUrl'] ) : '';
		$production    = isset( $client['productionSiteUrl'] ) ? trim( (string) $client['productionSiteUrl'] ) : '';
		$home         = home_url( '/' );
		$primary_url  = $production !== '' ? $production : ( $site_url !== '' ? $site_url : $home );
		$plugin_ver   = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '';


		$entity_slug = Flowbie_Wp_Site_Progress::resolve_entity_post_type_for_client( $client );
		if ( null === $entity_slug ) {
			foreach ( array( 'service-area', 'service-areas', 'service_areas' ) as $candidate ) {
				if ( post_type_exists( $candidate ) ) {
					$entity_slug = $candidate;
					break;
				}
			}
		}

		$facts = array();

		if ( $paired_id !== '' ) {
			$facts[] = array(
				'label' => __( 'Flowbie site ID', 'flowbie-wp' ),
				'value' => $paired_id,
				'mono'  => true,
			);
		}

		if ( is_string( $entity_slug ) && $entity_slug !== '' ) {
			$entity_counts = wp_count_posts( $entity_slug );
			$entity_live   = isset( $entity_counts->publish ) ? (int) $entity_counts->publish : 0;
			$facts[]       = array(
				'label' => __( 'Entity', 'flowbie-wp' ),
				'value' => (string) $entity_live,
			);
		}

		if ( $plugin_ver !== '' ) {
			$facts[] = array(
				'label' => __( 'Flowbie WP', 'flowbie-wp' ),
				'value' => $plugin_ver,
				'mono'  => true,
			);
		}

		?>
		<section class="flowbie-wp-dashboard-overview" aria-label="<?php esc_attr_e( 'Site overview', 'flowbie-wp' ); ?>">
			<div class="flowbie-wp-dashboard-overview__hero">
				<div class="flowbie-wp-dashboard-overview__identity">
					<h2 class="flowbie-wp-dashboard-overview__title"><?php echo esc_html( $display_name ); ?></h2>
					<p class="flowbie-wp-dashboard-overview__url">
						<a href="<?php echo esc_url( $primary_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $primary_url ); ?></a>
					</p>
					<?php if ( $site_url !== '' && $site_url !== $primary_url ) : ?>
						<p class="flowbie-wp-dashboard-overview__url flowbie-wp-dashboard-overview__url--secondary">
							<span class="flowbie-wp-dashboard-overview__url-prefix"><?php esc_html_e( 'Staging', 'flowbie-wp' ); ?>:</span>
							<a href="<?php echo esc_url( $site_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $site_url ); ?></a>
						</p>
					<?php endif; ?>
				</div>
				<div class="flowbie-wp-dashboard-overview__status">
					<?php if ( $paired_ok ) : ?>
						<span class="flowbie-wp-badge flowbie-wp-badge--connected"><?php esc_html_e( 'Connected', 'flowbie-wp' ); ?></span>
					<?php elseif ( $paired ) : ?>
						<span class="flowbie-wp-badge flowbie-wp-badge--warn"><?php esc_html_e( 'Sync issue', 'flowbie-wp' ); ?></span>
					<?php else : ?>
						<span class="flowbie-wp-badge flowbie-wp-badge--muted"><?php esc_html_e( 'Not connected', 'flowbie-wp' ); ?></span>
					<?php endif; ?>
					<?php if ( ! $paired ) : ?>
						<a class="button button-primary flowbie-wp-dashboard-overview__connect" href="<?php echo esc_url( $settings_url ); ?>"><?php esc_html_e( 'Connect site', 'flowbie-wp' ); ?></a>
					<?php elseif ( ! $paired_ok ) : ?>
						<a class="button flowbie-wp-dashboard-overview__connect" href="<?php echo esc_url( $settings_url ); ?>"><?php esc_html_e( 'Check settings', 'flowbie-wp' ); ?></a>
					<?php endif; ?>
				</div>
			</div>
			<dl class="flowbie-wp-dashboard-overview__facts">
				<?php foreach ( $facts as $fact ) : ?>
					<?php
					$label = isset( $fact['label'] ) ? (string) $fact['label'] : '';
					$value = isset( $fact['value'] ) ? (string) $fact['value'] : '';
					$link  = isset( $fact['link'] ) ? trim( (string) $fact['link'] ) : '';
					$mono  = ! empty( $fact['mono'] );
					if ( $label === '' || $value === '' ) {
						continue;
					}
					?>
					<div class="flowbie-wp-dashboard-overview__fact">
						<dt class="flowbie-wp-dashboard-overview__fact-label"><?php echo esc_html( $label ); ?></dt>
						<dd class="flowbie-wp-dashboard-overview__fact-value<?php echo $mono ? ' flowbie-wp-dashboard-overview__fact-value--mono' : ''; ?>">
							<?php
							if ( $link !== '' ) {
								printf(
									'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>',
									esc_url( $link ),
									esc_html( $value )
								);
							} else {
								echo esc_html( $value );
							}
							?>
						</dd>
					</div>
				<?php endforeach; ?>
			</dl>
		</section>
		<?php
	}

	/**
	 * Dashboard module tiles (cap-filtered).
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function dashboard_modules(): array {
		$modules = array();
		$paired  = Flowbie_Wp_Api::is_paired();

		if ( current_user_can( self::required_capability() ) ) {
			$modules[] = array(
				'slug'     => 'settings',
				'title'    => __( 'Settings', 'flowbie-wp' ),
				'desc'     => __( 'Connect and configure API keys.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-settings' ),
				'icon'     => 'dashicons-admin-generic',
				'tone'     => 'settings',
				'badge'    => $paired ? __( 'Connected', 'flowbie-wp' ) : __( 'Not connected', 'flowbie-wp' ),
				'badge_ok' => $paired,
			);

			$modules[] = array(
				'slug'  => 'analytics',
				'title' => __( 'Analytics', 'flowbie-wp' ),
				'desc'  => __( 'GSC performance for this site.', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-analytics' ),
				'icon'  => 'dashicons-chart-area',
				'tone'  => 'analytics',
			);
		}

		if ( current_user_can( 'manage_options' ) ) {
			try {
				self::dashboard_modules_for_manage_options( $modules );
			} catch ( Throwable $e ) {
				if ( function_exists( 'error_log' ) ) {
					error_log( 'Flowbie WP dashboard_modules: ' . $e->getMessage() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				}
			}
		}

		if ( current_user_can( 'edit_posts' ) ) {
			try {
				$tool_count = Flowbie_Wp_Tools_Library::tool_count();
				$modules[]  = array(
					'slug'     => 'tool-library',
					'title'    => __( 'Tool Library', 'flowbie-wp' ),
					'desc'     => __( 'MCP tools, parameters, and risk levels.', 'flowbie-wp' ),
					'url'      => admin_url( 'admin.php?page=flowbie-wp-tool-library' ),
					'icon'     => 'dashicons-book-alt',
					'tone'     => 'tool-library',
					'badge'    => sprintf(
						/* translators: %d: number of tools */
						_n( '%d tool', '%d tools', $tool_count, 'flowbie-wp' ),
						$tool_count
					),
					'badge_ok' => true,
				);
			} catch ( Throwable $e ) {
				if ( function_exists( 'error_log' ) ) {
					error_log( 'Flowbie WP dashboard_modules tool-library: ' . $e->getMessage() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				}
			}
		}

		return $modules;
	}

	/**
	 * @param array<int, array<string, mixed>> $modules Module list (by reference).
	 */
	private static function dashboard_modules_for_manage_options( array &$modules ): void {
			$modules[] = array(
				'slug'  => 'sitemap',
				'title' => __( 'Sitemap', 'flowbie-wp' ),
				'desc'  => __( 'XML sitemap generation.', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-sitemap' ),
				'icon'  => 'dashicons-networking',
				'tone'  => 'sitemap',
			);

			$chat_log_count = Flowbie_Wp_Chat_Logs::count_messages();

			$modules[] = array(
				'slug'     => 'chat-logs',
				'title'    => __( 'Chat Logs', 'flowbie-wp' ),
				'desc'     => __( 'Assist transcripts and AI reports.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-chat-logs' ),
				'icon'     => 'dashicons-format-chat',
				'tone'     => 'chat-logs',
				'badge'    => sprintf(
					/* translators: %d: number of logged messages */
					_n( '%d message', '%d messages', $chat_log_count, 'flowbie-wp' ),
					$chat_log_count
				),
				'badge_ok' => $chat_log_count > 0,
			);

			$redirect_counts = Flowbie_Wp_Redirects::status_counts();
			$active_count    = isset( $redirect_counts['active'] ) ? (int) $redirect_counts['active'] : 0;

			$modules[] = array(
				'slug'     => 'redirects',
				'title'    => __( 'Redirects', 'flowbie-wp' ),
				'desc'     => __( '301 and 302 URL redirects.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-redirects' ),
				'icon'     => 'dashicons-randomize',
				'tone'     => 'redirects',
				'badge'    => sprintf(
					/* translators: %d: number of active redirects */
					_n( '%d active', '%d active', $active_count, 'flowbie-wp' ),
					$active_count
				),
				'badge_ok' => $active_count > 0,
			);

			$form_count = count( Flowbie_Wp_Forms_Storage::get_all_forms( true ) );
			$modules[]  = array(
				'slug'     => 'forms',
				'title'    => __( 'Forms', 'flowbie-wp' ),
				'desc'     => __( 'Lead forms and on-site entries.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-forms' ),
				'icon'     => 'dashicons-feedback',
				'tone'     => 'forms',
				'badge'    => sprintf(
					/* translators: %d: number of active forms */
					_n( '%d active', '%d active', $form_count, 'flowbie-wp' ),
					$form_count
				),
				'badge_ok' => $form_count > 0,
			);

			$script_counts = Flowbie_Wp_Script_Manager::status_counts();
			$active_scripts = isset( $script_counts['active'] ) ? (int) $script_counts['active'] : 0;

			$modules[] = array(
				'slug'     => 'script-manager',
				'title'    => __( 'Script Manager', 'flowbie-wp' ),
				'desc'     => __( 'Header, footer, and body snippets.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-script-manager' ),
				'icon'     => 'dashicons-editor-code',
				'tone'     => 'scripts',
				'badge'    => sprintf(
					/* translators: %d: number of active scripts */
					_n( '%d active', '%d active', $active_scripts, 'flowbie-wp' ),
					$active_scripts
				),
				'badge_ok' => $active_scripts > 0,
			);

			$overseer_count = Flowbie_Wp_Overseer::count_visits();

			$modules[] = array(
				'slug'     => 'overseer',
				'title'    => __( 'Overseer', 'flowbie-wp' ),
				'desc'     => __( 'First-party pageview analytics.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-overseer&action=metrics' ),
				'icon'     => 'dashicons-visibility',
				'tone'     => 'overseer',
				'badge'    => sprintf(
					/* translators: %d: number of recorded visits */
					_n( '%d visit', '%d visits', $overseer_count, 'flowbie-wp' ),
					$overseer_count
				),
				'badge_ok' => $overseer_count > 0,
			);

			$speed_enabled = Flowbie_Wp_Speed_Settings::is_enabled();
			$modules[]     = array(
				'slug'     => 'speed',
				'title'    => __( 'Speed', 'flowbie-wp' ),
				'desc'     => __( 'Minify and cache CSS, JS, and HTML.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-speed' ),
				'icon'     => 'dashicons-performance',
				'tone'     => 'speed',
				'badge'    => $speed_enabled ? __( 'Enabled', 'flowbie-wp' ) : __( 'Disabled', 'flowbie-wp' ),
				'badge_ok' => $speed_enabled,
			);

			$missing_alt_query = Flowbie_Wp_Image_Seo::query_attachments(
				array(
					'page'        => 1,
					'per_page'    => 1,
					'missing_alt' => true,
				)
			);
			$missing_alt_count = (int) ( $missing_alt_query['total'] ?? 0 );

			$modules[] = array(
				'slug'     => 'image-seo',
				'title'    => __( 'Image SEO', 'flowbie-wp' ),
				'desc'     => __( 'AI alt text, titles, and captions.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-image-seo' ),
				'icon'     => 'dashicons-format-image',
				'tone'     => 'image-seo',
				'badge'    => $missing_alt_count > 0
					? sprintf(
						/* translators: %d: images missing alt text */
						_n( '%d missing alt', '%d missing alt', $missing_alt_count, 'flowbie-wp' ),
						$missing_alt_count
					)
					: __( 'All set', 'flowbie-wp' ),
				'badge_ok' => $missing_alt_count === 0,
			);

			$field_groups = Flowbie_Wp_Fields_Storage::get_all_groups( false );
			$group_count  = count( $field_groups );
			$active_groups = 0;
			foreach ( $field_groups as $group ) {
				if ( Flowbie_Wp_Admin::fields_group_is_active( is_array( $group ) ? $group : array() ) ) {
					++$active_groups;
				}
			}

			$modules[] = array(
				'slug'     => 'field-groups',
				'title'    => __( 'Field Groups', 'flowbie-wp' ),
				'desc'     => __( 'Custom fields and meta boxes.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-fields' ),
				'icon'     => 'dashicons-layout',
				'tone'     => 'field-groups',
				'badge'    => sprintf(
					/* translators: %d: number of field groups */
					_n( '%d group', '%d groups', $group_count, 'flowbie-wp' ),
					$group_count
				),
				'badge_ok' => $active_groups > 0,
			);

			$post_type_count = count( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_POST_TYPE ) );
			$modules[]       = array(
				'slug'     => 'post-types',
				'title'    => __( 'Post Types', 'flowbie-wp' ),
				'desc'     => __( 'Register custom post types.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-post-types' ),
				'icon'     => 'dashicons-admin-post',
				'tone'     => 'field-post-types',
				'badge'    => sprintf(
					/* translators: %d: number of post types */
					_n( '%d type', '%d types', $post_type_count, 'flowbie-wp' ),
					$post_type_count
				),
				'badge_ok' => $post_type_count > 0,
			);

			$taxonomy_count = count( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_TAXONOMY ) );
			$modules[]      = array(
				'slug'     => 'taxonomies',
				'title'    => __( 'Taxonomies', 'flowbie-wp' ),
				'desc'     => __( 'Register custom taxonomies.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-taxonomies' ),
				'icon'     => 'dashicons-tag',
				'tone'     => 'field-taxonomies',
				'badge'    => sprintf(
					/* translators: %d: number of taxonomies */
					_n( '%d taxonomy', '%d taxonomies', $taxonomy_count, 'flowbie-wp' ),
					$taxonomy_count
				),
				'badge_ok' => $taxonomy_count > 0,
			);

			$options_count = count( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_OPTIONS ) );
			$modules[]     = array(
				'slug'     => 'options-pages',
				'title'    => __( 'Options Pages', 'flowbie-wp' ),
				'desc'     => __( 'Global options screens.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-options-pages' ),
				'icon'     => 'dashicons-admin-settings',
				'tone'     => 'field-options',
				'badge'    => sprintf(
					/* translators: %d: number of options pages */
					_n( '%d page', '%d pages', $options_count, 'flowbie-wp' ),
					$options_count
				),
				'badge_ok' => $options_count > 0,
			);

			$modules[] = array(
				'slug'  => 'fields-gallery',
				'title' => __( 'Gallery', 'flowbie-wp' ),
				'desc'  => __( 'Templates and field setups.', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-fields-gallery' ),
				'icon'  => 'dashicons-images-alt2',
				'tone'  => 'field-gallery',
			);

			$modules[] = array(
				'slug'  => 'fields-tools',
				'title' => __( 'Fields Tools', 'flowbie-wp' ),
				'desc'  => __( 'Import and export field JSON.', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-fields-tools' ),
				'icon'  => 'dashicons-database-import',
				'tone'  => 'field-tools',
			);

			$modules[] = array(
				'slug'     => 'search',
				'title'    => __( 'Search', 'flowbie-wp' ),
				'desc'     => __( 'AI search with sentiment ranking.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-search' ),
				'icon'     => 'dashicons-search',
				'tone'     => 'search',
				'badge'    => Flowbie_Wp_OpenRouter::get_api_key() !== '' ? __( 'AI active', 'flowbie-wp' ) : __( 'Basic', 'flowbie-wp' ),
				'badge_ok' => Flowbie_Wp_OpenRouter::get_api_key() !== '',
			);

			$modules[] = array(
				'slug'     => 'backend-assist',
				'title'    => __( 'Backend Assist', 'flowbie-wp' ),
				'desc'     => __( 'AI for pages, posts, and backend ops.', 'flowbie-wp' ),
				'url'      => admin_url( 'admin.php?page=flowbie-wp-backend-assist' ),
				'icon'     => 'dashicons-admin-tools',
				'tone'     => 'backend-assist',
				'badge'    => Flowbie_Wp_OpenRouter::get_api_key() !== '' ? __( 'AI active', 'flowbie-wp' ) : __( 'Setup needed', 'flowbie-wp' ),
				'badge_ok' => Flowbie_Wp_OpenRouter::get_api_key() !== '',
			);
	}

	/**
	 * @param array<string, mixed> $module Module row.
	 */
	private static function render_dashboard_module_tile( array $module ): void {
		$slug     = isset( $module['slug'] ) ? (string) $module['slug'] : '';
		$tone     = isset( $module['tone'] ) ? (string) $module['tone'] : 'default';
		$icon     = isset( $module['icon'] ) ? (string) $module['icon'] : 'dashicons-admin-generic';
		$title    = isset( $module['title'] ) ? (string) $module['title'] : '';
		$desc     = isset( $module['desc'] ) ? (string) $module['desc'] : '';
		$url      = isset( $module['url'] ) ? (string) $module['url'] : '';
		$badge    = isset( $module['badge'] ) ? (string) $module['badge'] : '';
		$badge_ok = ! empty( $module['badge_ok'] );
		?>
		<a
			class="flowbie-wp-dashboard-tile flowbie-wp-dashboard-tile--<?php echo esc_attr( $tone ); ?>"
			href="<?php echo esc_url( $url ); ?>"
			id="flowbie-wp-dashboard-tile-<?php echo esc_attr( $slug ); ?>"
			data-slug="<?php echo esc_attr( $slug ); ?>"
		>
			<span
				class="flowbie-wp-dashboard-tile__drag"
				draggable="false"
				role="button"
				tabindex="-1"
				aria-hidden="true"
				aria-label="<?php echo esc_attr( sprintf( /* translators: %s: module title */ __( 'Reorder %s', 'flowbie-wp' ), $title ) ); ?>"
				title="<?php esc_attr_e( 'Drag to reorder', 'flowbie-wp' ); ?>"
			>&#8801;</span>
			<span class="flowbie-wp-dashboard-tile__icon" aria-hidden="true">
				<span class="dashicons <?php echo esc_attr( $icon ); ?>"></span>
			</span>
			<span class="flowbie-wp-dashboard-tile__body">
				<span class="flowbie-wp-dashboard-tile__head">
					<span class="flowbie-wp-dashboard-tile__title"><?php echo esc_html( $title ); ?></span>
					<?php if ( $badge !== '' ) : ?>
						<span class="flowbie-wp-dashboard-tile__badge<?php echo $badge_ok ? ' flowbie-wp-dashboard-tile__badge--ok' : ''; ?>">
							<?php echo esc_html( $badge ); ?>
						</span>
					<?php endif; ?>
				</span>
				<?php if ( $desc !== '' ) : ?>
					<span class="flowbie-wp-dashboard-tile__desc"><?php echo esc_html( $desc ); ?></span>
				<?php endif; ?>
			</span>
		</a>
		<?php
	}

	private static function render_dashboard_module_grid(): void {
		$modules = self::dashboard_modules();
		if ( empty( $modules ) ) {
			return;
		}

		$user_id = get_current_user_id();
		$groups  = Flowbie_Wp_Dashboard_Preferences::resolve_layout_for_modules(
			$modules,
			Flowbie_Wp_Dashboard_Preferences::get_layout_groups( $user_id )
		);
		$export  = Flowbie_Wp_Dashboard_Preferences::export_groups_for_client( $groups );
		?>
		<div
			class="flowbie-wp-dashboard-layout"
			data-reorderable="1"
			data-layout="<?php echo esc_attr( wp_json_encode( array( 'groups' => $export ) ) ); ?>"
		>
			<div class="flowbie-wp-dashboard-modules-bar">
				<button
					type="button"
					class="button flowbie-wp-dashboard__customize-btn"
					id="flowbie-wp-dashboard-customize"
					aria-pressed="false"
				>
					<?php esc_html_e( 'Customize layout', 'flowbie-wp' ); ?>
				</button>
				<button
					type="button"
					class="button flowbie-wp-dashboard__add-section-btn"
					id="flowbie-wp-dashboard-add-section"
					hidden
				>
					<?php esc_html_e( 'Add section', 'flowbie-wp' ); ?>
				</button>
			</div>
			<?php foreach ( $groups as $group ) : ?>
				<?php
				$group_id    = isset( $group['id'] ) ? (string) $group['id'] : '';
				$group_title = isset( $group['title'] ) ? (string) $group['title'] : '';
				$group_mods  = isset( $group['modules'] ) && is_array( $group['modules'] ) ? $group['modules'] : array();
				?>
				<section
					class="flowbie-wp-dashboard-section"
					data-group-id="<?php echo esc_attr( $group_id ); ?>"
				>
					<div class="flowbie-wp-dashboard-section__header">
						<?php if ( $group_title !== '' ) : ?>
							<h2 class="flowbie-wp-dashboard-section__title"><?php echo esc_html( $group_title ); ?></h2>
						<?php else : ?>
							<h2 class="flowbie-wp-dashboard-section__title flowbie-wp-dashboard-section__title--empty" hidden></h2>
						<?php endif; ?>
						<div class="flowbie-wp-dashboard-section__customize" hidden>
							<label class="screen-reader-text" for="flowbie-wp-section-title-<?php echo esc_attr( $group_id ); ?>">
								<?php esc_html_e( 'Section title', 'flowbie-wp' ); ?>
							</label>
							<input
								type="text"
								class="flowbie-wp-dashboard-section__title-input"
								id="flowbie-wp-section-title-<?php echo esc_attr( $group_id ); ?>"
								value="<?php echo esc_attr( $group_title ); ?>"
								placeholder="<?php esc_attr_e( 'Section title', 'flowbie-wp' ); ?>"
								maxlength="<?php echo esc_attr( (string) Flowbie_Wp_Dashboard_Preferences::MAX_SECTION_TITLE_LENGTH ); ?>"
							/>
							<button
								type="button"
								class="button-link flowbie-wp-dashboard-section__remove"
								data-group-id="<?php echo esc_attr( $group_id ); ?>"
							>
								<?php esc_html_e( 'Remove section', 'flowbie-wp' ); ?>
							</button>
						</div>
					</div>
					<nav
						class="flowbie-wp-dashboard-grid"
						data-group-id="<?php echo esc_attr( $group_id ); ?>"
						aria-label="<?php echo esc_attr( $group_title !== '' ? $group_title : __( 'Site modules', 'flowbie-wp' ) ); ?>"
					>
						<?php foreach ( $group_mods as $module ) : ?>
							<?php
							if ( is_array( $module ) ) {
								self::render_dashboard_module_tile( $module );
							}
							?>
						<?php endforeach; ?>
					</nav>
				</section>
			<?php endforeach; ?>
		</div>
		<?php
	}
}
