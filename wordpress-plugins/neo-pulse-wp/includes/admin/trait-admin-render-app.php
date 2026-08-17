<?php
/**
 * Main NEO Pulse WP client dashboard — property row from neo-pulse_user_wordpress_properties.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Render_App {

	public static function render_app_page(): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			return;
		}

		$flash        = self::get_and_clear_flash();
		$settings_url = admin_url( 'admin.php?page=neo-pulse-wp-settings' );
		$dashboard_rs = Neo_Pulse_Wp_Api::fetch_plugin_dashboard_state();
		$dashboard    = ( is_array( $dashboard_rs ) && ! empty( $dashboard_rs['ok'] ) && is_array( $dashboard_rs['dashboard'] ) ) ? $dashboard_rs['dashboard'] : null;
		$progress     = is_array( $dashboard ) && isset( $dashboard['progress'] ) && is_array( $dashboard['progress'] ) ? $dashboard['progress'] : null;

		?>
		<div class="wrap neo-pulse-wp-app neo-pulse-wp-app--dashboard">
			<h1 class="screen-reader-text"><?php echo esc_html( get_admin_page_title() ); ?></h1>

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<div class="neo-pulse-wp-dashboard">
				<?php
				self::render_dashboard_site_overview(
					is_array( $dashboard ) ? $dashboard : null,
					$settings_url
				);
				?>
				<div class="neo-pulse-wp-dashboard__metrics-panel">
					<h2 class="neo-pulse-wp-dashboard__section-title"><?php esc_html_e( 'Property metrics', 'neo-pulse-wp' ); ?></h2>
					<div class="neo-pulse-wp-dashboard__metrics">
						<?php self::render_site_progress_strip( $progress, 'full' ); ?>
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
	 * @param array<string,mixed>|null $dashboard    Dashboard payload.
	 * @param string                   $settings_url Settings admin URL.
	 */
	private static function render_dashboard_site_overview( ?array $dashboard, string $settings_url ): void {
		$client       = is_array( $dashboard ) && isset( $dashboard['client'] ) && is_array( $dashboard['client'] ) ? $dashboard['client'] : array();
		$client_name  = isset( $client['name'] ) ? trim( (string) $client['name'] ) : '';
		$display_name = $client_name !== '' ? $client_name : get_bloginfo( 'name' );
		$site_url     = isset( $client['siteUrl'] ) ? trim( (string) $client['siteUrl'] ) : '';
		$home         = home_url( '/' );
		$primary_url  = $site_url !== '' ? $site_url : $home;
		$plugin_ver   = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '';
		$openrouter_ok = Neo_Pulse_Wp_OpenRouter::get_api_key() !== '';


		$entity_slug = Neo_Pulse_Wp_Site_Progress::resolve_entity_post_type_for_client( $client );
		if ( null === $entity_slug ) {
			foreach ( array( 'service-area', 'service-areas', 'service_areas' ) as $candidate ) {
				if ( post_type_exists( $candidate ) ) {
					$entity_slug = $candidate;
					break;
				}
			}
		}

		$facts = array();

		if ( is_string( $entity_slug ) && $entity_slug !== '' ) {
			$entity_counts = wp_count_posts( $entity_slug );
			$entity_live   = isset( $entity_counts->publish ) ? (int) $entity_counts->publish : 0;
			$facts[]       = array(
				'label' => __( 'Entity', 'neo-pulse-wp' ),
				'value' => (string) $entity_live,
			);
		}

		if ( $plugin_ver !== '' ) {
			$facts[] = array(
				'label' => __( 'NEO Pulse WP', 'neo-pulse-wp' ),
				'value' => $plugin_ver,
				'mono'  => true,
			);
		}

		if ( $openrouter_ok ) {
			$facts[] = array(
				'label' => __( 'OpenRouter', 'neo-pulse-wp' ),
				'value' => __( 'Configured', 'neo-pulse-wp' ),
			);
		}

		?>
		<section class="neo-pulse-wp-dashboard-overview" aria-label="<?php esc_attr_e( 'Site overview', 'neo-pulse-wp' ); ?>">
			<div class="neo-pulse-wp-dashboard-overview__hero">
				<div class="neo-pulse-wp-dashboard-overview__identity">
					<h2 class="neo-pulse-wp-dashboard-overview__title"><?php echo esc_html( $display_name ); ?></h2>
					<p class="neo-pulse-wp-dashboard-overview__url">
						<a href="<?php echo esc_url( $primary_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $primary_url ); ?></a>
					</p>
					<?php if ( $site_url !== '' && $site_url !== $primary_url ) : ?>
						<p class="neo-pulse-wp-dashboard-overview__url neo-pulse-wp-dashboard-overview__url--secondary">
							<span class="neo-pulse-wp-dashboard-overview__url-prefix"><?php esc_html_e( 'Site URL', 'neo-pulse-wp' ); ?>:</span>
							<a href="<?php echo esc_url( $site_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $site_url ); ?></a>
						</p>
					<?php endif; ?>
				</div>
				<div class="neo-pulse-wp-dashboard-overview__status">
					<?php if ( $openrouter_ok ) : ?>
						<span class="neo-pulse-wp-badge neo-pulse-wp-badge--connected"><?php esc_html_e( 'AI ready', 'neo-pulse-wp' ); ?></span>
					<?php else : ?>
						<span class="neo-pulse-wp-badge neo-pulse-wp-badge--warn"><?php esc_html_e( 'OpenRouter missing', 'neo-pulse-wp' ); ?></span>
						<a class="button button-primary neo-pulse-wp-dashboard-overview__connect" href="<?php echo esc_url( $settings_url . '&tab=openrouter' ); ?>"><?php esc_html_e( 'Add API key', 'neo-pulse-wp' ); ?></a>
					<?php endif; ?>
				</div>
			</div>
			<dl class="neo-pulse-wp-dashboard-overview__facts">
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
					<div class="neo-pulse-wp-dashboard-overview__fact">
						<dt class="neo-pulse-wp-dashboard-overview__fact-label"><?php echo esc_html( $label ); ?></dt>
						<dd class="neo-pulse-wp-dashboard-overview__fact-value<?php echo $mono ? ' neo-pulse-wp-dashboard-overview__fact-value--mono' : ''; ?>">
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
		$openrouter_ok = Neo_Pulse_Wp_OpenRouter::get_api_key() !== '';

		if ( current_user_can( self::required_capability() ) ) {
			$modules[] = array(
				'slug'     => 'settings',
				'title'    => __( 'Settings', 'neo-pulse-wp' ),
				'desc'     => __( 'Configure API keys.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-settings' ),
				'icon'     => 'dashicons-admin-generic',
				'tone'     => 'settings',
				'badge'    => $openrouter_ok ? __( 'AI ready', 'neo-pulse-wp' ) : __( 'Needs OpenRouter', 'neo-pulse-wp' ),
				'badge_ok' => $openrouter_ok,
			);

			$modules[] = array(
				'slug'  => 'analytics',
				'title' => __( 'Analytics', 'neo-pulse-wp' ),
				'desc'  => __( 'GSC performance for this site.', 'neo-pulse-wp' ),
				'url'   => admin_url( 'admin.php?page=neo-pulse-wp-analytics' ),
				'icon'  => 'dashicons-chart-area',
				'tone'  => 'analytics',
			);
		}

		if ( current_user_can( 'manage_options' ) ) {
			try {
				self::dashboard_modules_for_manage_options( $modules );
			} catch ( Throwable $e ) {
				if ( function_exists( 'error_log' ) ) {
					error_log( 'NEO Pulse WP dashboard_modules: ' . $e->getMessage() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				}
			}
		}

		if ( current_user_can( 'edit_posts' ) ) {
			try {
				$tool_count = Neo_Pulse_Wp_Tools_Library::tool_count();
				$modules[]  = array(
					'slug'     => 'tool-library',
					'title'    => __( 'Tool Library', 'neo-pulse-wp' ),
					'desc'     => __( 'MCP tools, parameters, and risk levels.', 'neo-pulse-wp' ),
					'url'      => admin_url( 'admin.php?page=neo-pulse-wp-tool-library' ),
					'icon'     => 'dashicons-book-alt',
					'tone'     => 'tool-library',
					'badge'    => sprintf(
						/* translators: %d: number of tools */
						_n( '%d tool', '%d tools', $tool_count, 'neo-pulse-wp' ),
						$tool_count
					),
					'badge_ok' => true,
				);
			} catch ( Throwable $e ) {
				if ( function_exists( 'error_log' ) ) {
					error_log( 'NEO Pulse WP dashboard_modules tool-library: ' . $e->getMessage() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
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
				'title' => __( 'Sitemap', 'neo-pulse-wp' ),
				'desc'  => __( 'XML sitemap generation.', 'neo-pulse-wp' ),
				'url'   => admin_url( 'admin.php?page=neo-pulse-wp-sitemap' ),
				'icon'  => 'dashicons-networking',
				'tone'  => 'sitemap',
			);

			$chat_log_count = Neo_Pulse_Wp_Chat_Logs::count_messages();

			$modules[] = array(
				'slug'     => 'chat-logs',
				'title'    => __( 'Chat Logs', 'neo-pulse-wp' ),
				'desc'     => __( 'Assist transcripts and AI reports.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-chat-logs' ),
				'icon'     => 'dashicons-format-chat',
				'tone'     => 'chat-logs',
				'badge'    => sprintf(
					/* translators: %d: number of logged messages */
					_n( '%d message', '%d messages', $chat_log_count, 'neo-pulse-wp' ),
					$chat_log_count
				),
				'badge_ok' => $chat_log_count > 0,
			);

			$redirect_counts = Neo_Pulse_Wp_Redirects::status_counts();
			$active_count    = isset( $redirect_counts['active'] ) ? (int) $redirect_counts['active'] : 0;

			$modules[] = array(
				'slug'     => 'redirects',
				'title'    => __( 'Redirects', 'neo-pulse-wp' ),
				'desc'     => __( '301 and 302 URL redirects.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-redirects' ),
				'icon'     => 'dashicons-randomize',
				'tone'     => 'redirects',
				'badge'    => sprintf(
					/* translators: %d: number of active redirects */
					_n( '%d active', '%d active', $active_count, 'neo-pulse-wp' ),
					$active_count
				),
				'badge_ok' => $active_count > 0,
			);

			$form_count = count( Neo_Pulse_Wp_Forms_Storage::get_all_forms( true ) );
			$modules[]  = array(
				'slug'     => 'forms',
				'title'    => __( 'Forms', 'neo-pulse-wp' ),
				'desc'     => __( 'Lead forms and on-site entries.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-forms' ),
				'icon'     => 'dashicons-feedback',
				'tone'     => 'forms',
				'badge'    => sprintf(
					/* translators: %d: number of active forms */
					_n( '%d active', '%d active', $form_count, 'neo-pulse-wp' ),
					$form_count
				),
				'badge_ok' => $form_count > 0,
			);

			$script_counts = Neo_Pulse_Wp_Script_Manager::status_counts();
			$active_scripts = isset( $script_counts['active'] ) ? (int) $script_counts['active'] : 0;

			$modules[] = array(
				'slug'     => 'script-manager',
				'title'    => __( 'Script Manager', 'neo-pulse-wp' ),
				'desc'     => __( 'Header, footer, and body snippets.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-script-manager' ),
				'icon'     => 'dashicons-editor-code',
				'tone'     => 'scripts',
				'badge'    => sprintf(
					/* translators: %d: number of active scripts */
					_n( '%d active', '%d active', $active_scripts, 'neo-pulse-wp' ),
					$active_scripts
				),
				'badge_ok' => $active_scripts > 0,
			);

			$overseer_count = Neo_Pulse_Wp_Overseer::count_visits();

			$modules[] = array(
				'slug'     => 'overseer',
				'title'    => __( 'Overseer', 'neo-pulse-wp' ),
				'desc'     => __( 'First-party pageview analytics.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-overseer&action=metrics' ),
				'icon'     => 'dashicons-visibility',
				'tone'     => 'overseer',
				'badge'    => sprintf(
					/* translators: %d: number of recorded visits */
					_n( '%d visit', '%d visits', $overseer_count, 'neo-pulse-wp' ),
					$overseer_count
				),
				'badge_ok' => $overseer_count > 0,
			);

			$speed_enabled = Neo_Pulse_Wp_Speed_Settings::is_enabled();
			$modules[]     = array(
				'slug'     => 'speed',
				'title'    => __( 'Speed', 'neo-pulse-wp' ),
				'desc'     => __( 'Minify and cache CSS, JS, and HTML.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-speed' ),
				'icon'     => 'dashicons-performance',
				'tone'     => 'speed',
				'badge'    => $speed_enabled ? __( 'Enabled', 'neo-pulse-wp' ) : __( 'Disabled', 'neo-pulse-wp' ),
				'badge_ok' => $speed_enabled,
			);

			$missing_alt_query = Neo_Pulse_Wp_Image_Seo::query_attachments(
				array(
					'page'        => 1,
					'per_page'    => 1,
					'missing_alt' => true,
				)
			);
			$missing_alt_count = (int) ( $missing_alt_query['total'] ?? 0 );

			$modules[] = array(
				'slug'     => 'image-seo',
				'title'    => __( 'Image SEO', 'neo-pulse-wp' ),
				'desc'     => __( 'AI alt text, titles, and captions.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-image-seo' ),
				'icon'     => 'dashicons-format-image',
				'tone'     => 'image-seo',
				'badge'    => $missing_alt_count > 0
					? sprintf(
						/* translators: %d: images missing alt text */
						_n( '%d missing alt', '%d missing alt', $missing_alt_count, 'neo-pulse-wp' ),
						$missing_alt_count
					)
					: __( 'All set', 'neo-pulse-wp' ),
				'badge_ok' => $missing_alt_count === 0,
			);

			$field_groups = Neo_Pulse_Wp_Fields_Storage::get_all_groups( false );
			$group_count  = count( $field_groups );
			$active_groups = 0;
			foreach ( $field_groups as $group ) {
				if ( Neo_Pulse_Wp_Admin::fields_group_is_active( is_array( $group ) ? $group : array() ) ) {
					++$active_groups;
				}
			}

			$modules[] = array(
				'slug'     => 'field-groups',
				'title'    => __( 'Field Groups', 'neo-pulse-wp' ),
				'desc'     => __( 'Custom fields and meta boxes.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-fields' ),
				'icon'     => 'dashicons-layout',
				'tone'     => 'field-groups',
				'badge'    => sprintf(
					/* translators: %d: number of field groups */
					_n( '%d group', '%d groups', $group_count, 'neo-pulse-wp' ),
					$group_count
				),
				'badge_ok' => $active_groups > 0,
			);

			$post_type_count = count( Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_POST_TYPE ) );
			$modules[]       = array(
				'slug'     => 'post-types',
				'title'    => __( 'Post Types', 'neo-pulse-wp' ),
				'desc'     => __( 'Register custom post types.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-post-types' ),
				'icon'     => 'dashicons-admin-post',
				'tone'     => 'field-post-types',
				'badge'    => sprintf(
					/* translators: %d: number of post types */
					_n( '%d type', '%d types', $post_type_count, 'neo-pulse-wp' ),
					$post_type_count
				),
				'badge_ok' => $post_type_count > 0,
			);

			$taxonomy_count = count( Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_TAXONOMY ) );
			$modules[]      = array(
				'slug'     => 'taxonomies',
				'title'    => __( 'Taxonomies', 'neo-pulse-wp' ),
				'desc'     => __( 'Register custom taxonomies.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-taxonomies' ),
				'icon'     => 'dashicons-tag',
				'tone'     => 'field-taxonomies',
				'badge'    => sprintf(
					/* translators: %d: number of taxonomies */
					_n( '%d taxonomy', '%d taxonomies', $taxonomy_count, 'neo-pulse-wp' ),
					$taxonomy_count
				),
				'badge_ok' => $taxonomy_count > 0,
			);

			$options_count = count( Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_OPTIONS ) );
			$modules[]     = array(
				'slug'     => 'options-pages',
				'title'    => __( 'Options Pages', 'neo-pulse-wp' ),
				'desc'     => __( 'Global options screens.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-options-pages' ),
				'icon'     => 'dashicons-admin-settings',
				'tone'     => 'field-options',
				'badge'    => sprintf(
					/* translators: %d: number of options pages */
					_n( '%d page', '%d pages', $options_count, 'neo-pulse-wp' ),
					$options_count
				),
				'badge_ok' => $options_count > 0,
			);

			$modules[] = array(
				'slug'  => 'fields-gallery',
				'title' => __( 'Gallery', 'neo-pulse-wp' ),
				'desc'  => __( 'Templates and field setups.', 'neo-pulse-wp' ),
				'url'   => admin_url( 'admin.php?page=neo-pulse-wp-fields-gallery' ),
				'icon'  => 'dashicons-images-alt2',
				'tone'  => 'field-gallery',
			);

			$modules[] = array(
				'slug'  => 'fields-tools',
				'title' => __( 'Fields Tools', 'neo-pulse-wp' ),
				'desc'  => __( 'Import and export field JSON.', 'neo-pulse-wp' ),
				'url'   => admin_url( 'admin.php?page=neo-pulse-wp-fields-tools' ),
				'icon'  => 'dashicons-database-import',
				'tone'  => 'field-tools',
			);

			$modules[] = array(
				'slug'     => 'search',
				'title'    => __( 'Search', 'neo-pulse-wp' ),
				'desc'     => __( 'AI search with sentiment ranking.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-search' ),
				'icon'     => 'dashicons-search',
				'tone'     => 'search',
				'badge'    => Neo_Pulse_Wp_OpenRouter::get_api_key() !== '' ? __( 'AI active', 'neo-pulse-wp' ) : __( 'Basic', 'neo-pulse-wp' ),
				'badge_ok' => Neo_Pulse_Wp_OpenRouter::get_api_key() !== '',
			);

			$modules[] = array(
				'slug'     => 'backend-assist',
				'title'    => __( 'Backend Assist', 'neo-pulse-wp' ),
				'desc'     => __( 'AI for pages, posts, and backend ops.', 'neo-pulse-wp' ),
				'url'      => admin_url( 'admin.php?page=neo-pulse-wp-backend-assist' ),
				'icon'     => 'dashicons-admin-tools',
				'tone'     => 'backend-assist',
				'badge'    => Neo_Pulse_Wp_OpenRouter::get_api_key() !== '' ? __( 'AI active', 'neo-pulse-wp' ) : __( 'Setup needed', 'neo-pulse-wp' ),
				'badge_ok' => Neo_Pulse_Wp_OpenRouter::get_api_key() !== '',
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
			class="neo-pulse-wp-dashboard-tile neo-pulse-wp-dashboard-tile--<?php echo esc_attr( $tone ); ?>"
			href="<?php echo esc_url( $url ); ?>"
			id="neo-pulse-wp-dashboard-tile-<?php echo esc_attr( $slug ); ?>"
			data-slug="<?php echo esc_attr( $slug ); ?>"
		>
			<span
				class="neo-pulse-wp-dashboard-tile__drag"
				draggable="false"
				role="button"
				tabindex="-1"
				aria-hidden="true"
				aria-label="<?php echo esc_attr( sprintf( /* translators: %s: module title */ __( 'Reorder %s', 'neo-pulse-wp' ), $title ) ); ?>"
				title="<?php esc_attr_e( 'Drag to reorder', 'neo-pulse-wp' ); ?>"
			>&#8801;</span>
			<span class="neo-pulse-wp-dashboard-tile__icon" aria-hidden="true">
				<span class="dashicons <?php echo esc_attr( $icon ); ?>"></span>
			</span>
			<span class="neo-pulse-wp-dashboard-tile__body">
				<span class="neo-pulse-wp-dashboard-tile__head">
					<span class="neo-pulse-wp-dashboard-tile__title"><?php echo esc_html( $title ); ?></span>
					<?php if ( $badge !== '' ) : ?>
						<span class="neo-pulse-wp-dashboard-tile__badge<?php echo $badge_ok ? ' neo-pulse-wp-dashboard-tile__badge--ok' : ''; ?>">
							<?php echo esc_html( $badge ); ?>
						</span>
					<?php endif; ?>
				</span>
				<?php if ( $desc !== '' ) : ?>
					<span class="neo-pulse-wp-dashboard-tile__desc"><?php echo esc_html( $desc ); ?></span>
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
		$groups  = Neo_Pulse_Wp_Dashboard_Preferences::resolve_layout_for_modules(
			$modules,
			Neo_Pulse_Wp_Dashboard_Preferences::get_layout_groups( $user_id )
		);
		$export  = Neo_Pulse_Wp_Dashboard_Preferences::export_groups_for_client( $groups );
		?>
		<div
			class="neo-pulse-wp-dashboard-layout"
			data-reorderable="1"
			data-layout="<?php echo esc_attr( wp_json_encode( array( 'groups' => $export ) ) ); ?>"
		>
			<div class="neo-pulse-wp-dashboard-modules-bar">
				<button
					type="button"
					class="button neo-pulse-wp-dashboard__customize-btn"
					id="neo-pulse-wp-dashboard-customize"
					aria-pressed="false"
				>
					<?php esc_html_e( 'Customize layout', 'neo-pulse-wp' ); ?>
				</button>
				<button
					type="button"
					class="button neo-pulse-wp-dashboard__add-section-btn"
					id="neo-pulse-wp-dashboard-add-section"
					hidden
				>
					<?php esc_html_e( 'Add section', 'neo-pulse-wp' ); ?>
				</button>
			</div>
			<?php foreach ( $groups as $group ) : ?>
				<?php
				$group_id    = isset( $group['id'] ) ? (string) $group['id'] : '';
				$group_title = isset( $group['title'] ) ? (string) $group['title'] : '';
				$group_mods  = isset( $group['modules'] ) && is_array( $group['modules'] ) ? $group['modules'] : array();
				?>
				<section
					class="neo-pulse-wp-dashboard-section"
					data-group-id="<?php echo esc_attr( $group_id ); ?>"
				>
					<div class="neo-pulse-wp-dashboard-section__header">
						<?php if ( $group_title !== '' ) : ?>
							<h2 class="neo-pulse-wp-dashboard-section__title"><?php echo esc_html( $group_title ); ?></h2>
						<?php else : ?>
							<h2 class="neo-pulse-wp-dashboard-section__title neo-pulse-wp-dashboard-section__title--empty" hidden></h2>
						<?php endif; ?>
						<div class="neo-pulse-wp-dashboard-section__customize" hidden>
							<label class="screen-reader-text" for="neo-pulse-wp-section-title-<?php echo esc_attr( $group_id ); ?>">
								<?php esc_html_e( 'Section title', 'neo-pulse-wp' ); ?>
							</label>
							<input
								type="text"
								class="neo-pulse-wp-dashboard-section__title-input"
								id="neo-pulse-wp-section-title-<?php echo esc_attr( $group_id ); ?>"
								value="<?php echo esc_attr( $group_title ); ?>"
								placeholder="<?php esc_attr_e( 'Section title', 'neo-pulse-wp' ); ?>"
								maxlength="<?php echo esc_attr( (string) Neo_Pulse_Wp_Dashboard_Preferences::MAX_SECTION_TITLE_LENGTH ); ?>"
							/>
							<button
								type="button"
								class="button-link neo-pulse-wp-dashboard-section__remove"
								data-group-id="<?php echo esc_attr( $group_id ); ?>"
							>
								<?php esc_html_e( 'Remove section', 'neo-pulse-wp' ); ?>
							</button>
						</div>
					</div>
					<nav
						class="neo-pulse-wp-dashboard-grid"
						data-group-id="<?php echo esc_attr( $group_id ); ?>"
						aria-label="<?php echo esc_attr( $group_title !== '' ? $group_title : __( 'Site modules', 'neo-pulse-wp' ) ); ?>"
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
