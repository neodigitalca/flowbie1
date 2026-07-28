<?php
/**
 * Admin assets, menu, and global notice.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Wp_Shell {

	/**
	 * @return array<int, string>
	 */
	private static function flowbie_admin_screen_ids(): array {
		return array(
			'toplevel_page_flowbie-wp',
			'flowbie-wp_page_flowbie-wp-settings',
			'flowbie-wp_page_flowbie-wp-sitemap',
			'flowbie-wp_page_flowbie-wp-robots-txt',
			'flowbie-wp_page_flowbie-wp-analytics',
			'flowbie-wp_page_flowbie-wp-redirects',
			'flowbie-wp_page_flowbie-wp-chat-logs',
			'flowbie-wp_page_flowbie-wp-overseer',
			'flowbie-wp_page_flowbie-wp-script-manager',
			'flowbie-wp_page_flowbie-wp-speed',
			'flowbie-wp_page_flowbie-wp-image-seo',
			'flowbie-wp_page_flowbie-wp-fields',
			'admin_page_flowbie-wp-fields-edit',
			'flowbie-wp_page_flowbie-wp-fields-edit',
			'flowbie-wp_page_flowbie-wp-post-types',
			'admin_page_flowbie-wp-post-types-edit',
			'flowbie-wp_page_flowbie-wp-post-types-edit',
			'flowbie-wp_page_flowbie-wp-taxonomies',
			'flowbie-wp_page_flowbie-wp-options-pages',
			'flowbie-wp_page_flowbie-wp-tags',
			'admin_page_flowbie-wp-fields-elementor',
			'flowbie-wp_page_flowbie-wp-fields-elementor',
			'flowbie-wp_page_flowbie-wp-search',
			'flowbie-wp_page_flowbie-wp-chat',
			'flowbie-wp_page_flowbie-wp-backend-assist',
			'flowbie-wp_page_flowbie-wp-tool-library',
			'admin_page_flowbie-wp-fields-gallery',
			'flowbie-wp_page_flowbie-wp-fields-gallery',
			'flowbie-wp_page_flowbie-wp-fields-tools',
			'flowbie-wp_page_flowbie-wp-forms',
			'admin_page_flowbie-wp-forms-edit',
			'flowbie-wp_page_flowbie-wp-forms-edit',
			'admin_page_flowbie-wp-forms-entries',
			'flowbie-wp_page_flowbie-wp-forms-entries',
			'flowbie-wp_page_flowbie-wp-agent-hub',
			'admin_page_flowbie-wp-agent-hub-edit',
			'flowbie-wp_page_flowbie-wp-agent-hub-edit',
			'flowbie-wp_page_flowbie-wp-super-migrate',
		);
	}

	/**
	 * @param string $classes Space-separated admin body classes.
	 */
	public static function admin_body_class( string $classes ): string {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( $screen && in_array( $screen->id, self::flowbie_admin_screen_ids(), true ) ) {
			$classes .= ' flowbie-wp-admin-screen';
		}
		return $classes;
	}

	public static function enqueue_admin_assets( string $hook_suffix ): void {
		$flowbie_screens = self::flowbie_admin_screen_ids();
		if ( ! in_array( $hook_suffix, $flowbie_screens, true ) ) {
			return;
		}

		wp_enqueue_style( 'dashicons' );
		wp_enqueue_style(
			'flowbie-wp-lato',
			'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,600;0,700;1,400&display=swap',
			array(),
			null
		);

		$css_files = array(
			'flowbie-wp-admin-tokens'         => 'admin-tokens.css',
			'flowbie-wp-admin-shell'          => 'admin-shell.css',
			'flowbie-wp-admin-optimizer'      => 'admin-optimizer.css',
			'flowbie-wp-admin-scrape-preview' => 'admin-scrape-preview.css',
			'flowbie-wp-admin-post-table'     => 'admin-post-table.css',
			'flowbie-wp-admin-progress'       => 'admin-progress.css',
			'flowbie-wp-admin-dashboard'      => 'admin-dashboard.css',
			'flowbie-wp-admin-settings'       => 'admin-settings.css',
			'flowbie-wp-admin-panel'          => 'admin-panel.css',
			'flowbie-wp-admin-analytics'      => 'admin-analytics.css',
			'flowbie-wp-admin-redirects'       => 'admin-redirects.css',
			'flowbie-wp-admin-forms'           => 'admin-forms.css',
			'flowbie-wp-admin-chat-logs'       => 'admin-chat-logs.css',
			'flowbie-wp-admin-overseer'        => 'admin-overseer.css',
			'flowbie-wp-admin-script-manager'  => 'admin-script-manager.css',
			'flowbie-wp-admin-image-seo'       => 'admin-image-seo.css',
			'flowbie-wp-admin-typography'      => 'admin-typography-enforce.css',
			'flowbie-wp-admin-buttons'         => 'admin-buttons.css',
			'flowbie-wp-admin-search'          => 'admin-search.css',
			'flowbie-wp-admin-tool-library'    => 'admin-tool-library.css',
			'flowbie-wp-admin-contrast'        => 'admin-contrast-enforce.css',
			'flowbie-wp-admin-site-schema'    => 'admin-site-schema.css',
		);

		$deps = array( 'flowbie-wp-lato' );
		foreach ( $css_files as $handle => $file ) {
			$rel = 'assets/admin/' . $file;
			$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
			$ver = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '0.5.0';
			if ( is_readable( $abs ) ) {
				$ver .= '.' . (string) filemtime( $abs );
			}
			wp_enqueue_style(
				$handle,
				plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . $rel,
				$deps,
				$ver
			);
			$deps[] = $handle;
		}

		$agent_hub_hooks = array(
			'flowbie-wp_page_flowbie-wp-agent-hub',
			'admin_page_flowbie-wp-agent-hub-edit',
			'flowbie-wp_page_flowbie-wp-agent-hub-edit',
		);
		if ( in_array( $hook_suffix, $agent_hub_hooks, true ) ) {
			$agent_hub_deps = ! empty( $deps ) ? array( (string) end( $deps ) ) : array( 'flowbie-wp-lato' );
			self::enqueue_agent_hub_styles( $agent_hub_deps );
		}

		if (
			in_array( $hook_suffix, array( 'flowbie-wp_page_flowbie-wp-backend-assist', 'flowbie-wp_page_flowbie-wp-chat' ), true )
			&& Flowbie_Wp_OpenRouter::get_api_key() !== ''
		) {
			// Head load so inline page scripts can use FlowbieVoice / safe unlock helpers.
			Flowbie_Wp_Voice::enqueue_assets( array(), false );
		}

		if ( 'flowbie-wp_page_flowbie-wp-backend-assist' === $hook_suffix ) {
			self::enqueue_backend_assist_script();
		}

		if ( 'toplevel_page_flowbie-wp' === $hook_suffix ) {
			self::enqueue_dashboard_reorder_script();
		}
	}

	/**
	 * Dashboard module tile reorder (swap + per-user save).
	 */
	private static function enqueue_dashboard_reorder_script(): void {
		$rel = 'assets/admin/admin-dashboard-reorder.js';
		$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
		if ( ! is_readable( $abs ) ) {
			return;
		}

		$ver = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '0.5.0';
		$ver .= '.' . (string) filemtime( $abs );

		wp_enqueue_script(
			'flowbie-wp-dashboard-reorder',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . $rel,
			array(),
			$ver,
			true
		);

		$modules = Flowbie_Wp_Admin::dashboard_modules();
		$user_id = get_current_user_id();
		$groups  = Flowbie_Wp_Dashboard_Preferences::resolve_layout_for_modules(
			$modules,
			Flowbie_Wp_Dashboard_Preferences::get_layout_groups( $user_id )
		);
		$export  = Flowbie_Wp_Dashboard_Preferences::export_groups_for_client( $groups );

		wp_localize_script(
			'flowbie-wp-dashboard-reorder',
			'flowbieWpDashboardReorder',
			array(
				'restUrl'       => esc_url_raw( rest_url( Flowbie_Wp_Dashboard_Preferences::REST_NAMESPACE . '/dashboard/module-order' ) ),
				'restLayoutUrl' => esc_url_raw( rest_url( Flowbie_Wp_Dashboard_Preferences::REST_NAMESPACE . '/dashboard/layout' ) ),
				'nonce'         => wp_create_nonce( 'wp_rest' ),
				'groups'        => $export,
				'i18n'          => array(
					'customize'               => __( 'Customize layout', 'flowbie-wp' ),
					'done'                    => __( 'Done', 'flowbie-wp' ),
					'addSection'              => __( 'Add section', 'flowbie-wp' ),
					'sectionTitlePlaceholder' => __( 'Section title', 'flowbie-wp' ),
					'removeSection'           => __( 'Remove section', 'flowbie-wp' ),
					'sectionNotEmpty'         => __( 'Remove all modules from this section before deleting it.', 'flowbie-wp' ),
					'modulesLabel'            => __( 'Site modules', 'flowbie-wp' ),
				),
			)
		);
	}

	public static function maybe_dismiss_notice(): void {
		if ( ! isset( $_GET[ self::DISMISS_ACTION ] ) || ! isset( $_GET['_wpnonce'] ) ) {
			return;
		}
		if ( ! current_user_can( self::required_capability() ) ) {
			return;
		}
		if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), self::DISMISS_ACTION ) ) {
			return;
		}
		update_user_meta( get_current_user_id(), self::NOTICE_USER_META, '1' );
		wp_safe_redirect( admin_url() );
		exit;
	}

	public static function render_notice(): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( $screen && in_array( $screen->id, self::flowbie_admin_screen_ids(), true ) ) {
			return;
		}
		if ( get_user_meta( get_current_user_id(), self::NOTICE_USER_META, true ) ) {
			return;
		}
		$dismiss_url = wp_nonce_url(
			add_query_arg( self::DISMISS_ACTION, '1', admin_url() ),
			self::DISMISS_ACTION
		);
		$app_url = admin_url( 'admin.php?page=flowbie-wp-settings' );
		?>
		<div class="notice notice-info">
			<p>
				<?php esc_html_e( 'Flowbie WP is active. Paste your site ID from Integrations under Settings and click Connect.', 'flowbie-wp' ); ?>
				<a href="<?php echo esc_url( $app_url ); ?>">
					<?php esc_html_e( 'Open Settings', 'flowbie-wp' ); ?>
				</a>
				<span aria-hidden="true"> | </span>
				<a href="<?php echo esc_url( $dismiss_url ); ?>">
					<?php esc_html_e( 'Dismiss', 'flowbie-wp' ); ?>
				</a>
			</p>
		</div>
		<?php
	}
}
