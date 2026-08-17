<?php
/**
 * Admin assets, menu, and global notice.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Wp_Shell {

	/**
	 * @return array<int, string>
	 */
	private static function neo_pulse_admin_screen_ids(): array {
		return array(
			'toplevel_page_neo_pulse-wp',
			'neo-pulse-wp_page_neo_pulse-wp-settings',
			'neo-pulse-wp_page_neo_pulse-wp-sitemap',
			'neo-pulse-wp_page_neo_pulse-wp-robots-txt',
			'neo-pulse-wp_page_neo_pulse-wp-analytics',
			'neo-pulse-wp_page_neo_pulse-wp-redirects',
			'neo-pulse-wp_page_neo_pulse-wp-chat-logs',
			'neo-pulse-wp_page_neo_pulse-wp-search-logs',
			'neo-pulse-wp_page_neo_pulse-wp-overseer',
			'neo-pulse-wp_page_neo_pulse-wp-script-manager',
			'neo-pulse-wp_page_neo_pulse-wp-speed',
			'neo-pulse-wp_page_neo_pulse-wp-image-seo',
			'neo-pulse-wp_page_neo_pulse-wp-fields',
			'admin_page_neo_pulse-wp-fields-edit',
			'neo-pulse-wp_page_neo_pulse-wp-fields-edit',
			'neo-pulse-wp_page_neo_pulse-wp-post-types',
			'admin_page_neo_pulse-wp-post-types-edit',
			'neo-pulse-wp_page_neo_pulse-wp-post-types-edit',
			'neo-pulse-wp_page_neo_pulse-wp-taxonomies',
			'neo-pulse-wp_page_neo_pulse-wp-options-pages',
			'neo-pulse-wp_page_neo_pulse-wp-tags',
			'admin_page_neo_pulse-wp-fields-elementor',
			'neo-pulse-wp_page_neo_pulse-wp-fields-elementor',
			'neo-pulse-wp_page_neo_pulse-wp-search',
			'neo-pulse-wp_page_neo_pulse-wp-chat',
			'neo-pulse-wp_page_neo_pulse-wp-backend-assist',
			'neo-pulse-wp_page_neo_pulse-wp-tool-library',
			'admin_page_neo_pulse-wp-fields-gallery',
			'neo-pulse-wp_page_neo_pulse-wp-fields-gallery',
			'neo-pulse-wp_page_neo_pulse-wp-fields-tools',
			'neo-pulse-wp_page_neo_pulse-wp-forms',
			'admin_page_neo_pulse-wp-forms-edit',
			'neo-pulse-wp_page_neo_pulse-wp-forms-edit',
			'admin_page_neo_pulse-wp-forms-entries',
			'neo-pulse-wp_page_neo_pulse-wp-forms-entries',
			'neo-pulse-wp_page_neo_pulse-wp-agent-hub',
			'admin_page_neo_pulse-wp-agent-hub-edit',
			'neo-pulse-wp_page_neo_pulse-wp-agent-hub-edit',
			'neo-pulse-wp_page_neo_pulse-wp-super-migrate',
		);
	}

	/**
	 * @param string $classes Space-separated admin body classes.
	 */
	public static function admin_body_class( string $classes ): string {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( $screen && in_array( $screen->id, self::neo_pulse_admin_screen_ids(), true ) ) {
			$classes .= ' neo-pulse-wp-admin-screen';
		}
		return $classes;
	}

	/**
	 * Strip third-party WP admin notices on NEO Pulse screens (ACF, SEO plugins, etc.).
	 */
	public static function suppress_foreign_admin_notices(): void {
		if ( ! is_admin() ) {
			return;
		}

		$page = isset( $_GET['page'] ) ? sanitize_key( (string) wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( $page === '' || strpos( $page, 'neo-pulse-wp' ) !== 0 ) {
			return;
		}

		remove_all_actions( 'admin_notices' );
		remove_all_actions( 'all_admin_notices' );
		remove_all_actions( 'network_admin_notices' );
		remove_all_actions( 'user_admin_notices' );
	}

	public static function enqueue_admin_assets( string $hook_suffix ): void {
		$neo_pulse_screens = self::neo_pulse_admin_screen_ids();
		if ( ! in_array( $hook_suffix, $neo_pulse_screens, true ) ) {
			return;
		}

		wp_enqueue_style( 'dashicons' );
		wp_enqueue_style(
			'neo-pulse-wp-lato',
			'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,600;0,700;1,400&display=swap',
			array(),
			null
		);

		$css_files = array(
			'neo-pulse-wp-admin-tokens'         => 'admin-tokens.css',
			'neo-pulse-wp-admin-shell'          => 'admin-shell.css',
			'neo-pulse-wp-admin-optimizer'      => 'admin-optimizer.css',
			'neo-pulse-wp-admin-scrape-preview' => 'admin-scrape-preview.css',
			'neo-pulse-wp-admin-post-table'     => 'admin-post-table.css',
			'neo-pulse-wp-admin-progress'       => 'admin-progress.css',
			'neo-pulse-wp-admin-dashboard'      => 'admin-dashboard.css',
			'neo-pulse-wp-admin-settings'       => 'admin-settings.css',
			'neo-pulse-wp-admin-panel'          => 'admin-panel.css',
			'neo-pulse-wp-admin-analytics'      => 'admin-analytics.css',
			'neo-pulse-wp-admin-redirects'       => 'admin-redirects.css',
			'neo-pulse-wp-admin-forms'           => 'admin-forms.css',
			'neo-pulse-wp-admin-chat-logs'       => 'admin-chat-logs.css',
			'neo-pulse-wp-admin-overseer'        => 'admin-overseer.css',
			'neo-pulse-wp-admin-script-manager'  => 'admin-script-manager.css',
			'neo-pulse-wp-admin-image-seo'       => 'admin-image-seo.css',
			'neo-pulse-wp-admin-typography'      => 'admin-typography-enforce.css',
			'neo-pulse-wp-admin-buttons'         => 'admin-buttons.css',
			'neo-pulse-wp-admin-search'          => 'admin-search.css',
			'neo-pulse-wp-admin-tool-library'    => 'admin-tool-library.css',
			'neo-pulse-wp-admin-contrast'        => 'admin-contrast-enforce.css',
			'neo-pulse-wp-admin-site-schema'    => 'admin-site-schema.css',
		);

		$deps = array( 'neo-pulse-wp-lato' );
		foreach ( $css_files as $handle => $file ) {
			$rel = 'assets/admin/' . $file;
			$abs = NEO_PULSE_WP_PLUGIN_DIR . $rel;
			$ver = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.5.0';
			if ( is_readable( $abs ) ) {
				$ver .= '.' . (string) filemtime( $abs );
			}
			wp_enqueue_style(
				$handle,
				plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . $rel,
				$deps,
				$ver
			);
			$deps[] = $handle;
		}

		$agent_hub_hooks = array(
			'neo-pulse-wp_page_neo_pulse-wp-agent-hub',
			'admin_page_neo_pulse-wp-agent-hub-edit',
			'neo-pulse-wp_page_neo_pulse-wp-agent-hub-edit',
		);
		if ( in_array( $hook_suffix, $agent_hub_hooks, true ) ) {
			$agent_hub_deps = ! empty( $deps ) ? array( (string) end( $deps ) ) : array( 'neo-pulse-wp-lato' );
			self::enqueue_agent_hub_styles( $agent_hub_deps );
		}

		if (
			in_array( $hook_suffix, array( 'neo-pulse-wp_page_neo_pulse-wp-backend-assist', 'neo-pulse-wp_page_neo_pulse-wp-chat' ), true )
			&& Neo_Pulse_Wp_OpenRouter::get_api_key() !== ''
		) {
			// Head load so inline page scripts can use NeoPulseVoice / safe unlock helpers.
			Neo_Pulse_Wp_Voice::enqueue_assets( array(), false );
		}

		if ( 'neo-pulse-wp_page_neo_pulse-wp-backend-assist' === $hook_suffix ) {
			self::enqueue_backend_assist_script();
		}

		if ( 'neo-pulse-wp_page_neo_pulse-wp-chat' === $hook_suffix ) {
			self::enqueue_chat_demo_assets();
		}

		if ( 'toplevel_page_neo_pulse-wp' === $hook_suffix ) {
			self::enqueue_dashboard_reorder_script();
		}
	}

	/**
	 * Dashboard module tile reorder (swap + per-user save).
	 */
	private static function enqueue_dashboard_reorder_script(): void {
		$rel = 'assets/admin/admin-dashboard-reorder.js';
		$abs = NEO_PULSE_WP_PLUGIN_DIR . $rel;
		if ( ! is_readable( $abs ) ) {
			return;
		}

		$ver = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.5.0';
		$ver .= '.' . (string) filemtime( $abs );

		wp_enqueue_script(
			'neo-pulse-wp-dashboard-reorder',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . $rel,
			array(),
			$ver,
			true
		);

		$modules = Neo_Pulse_Wp_Admin::dashboard_modules();
		$user_id = get_current_user_id();
		$groups  = Neo_Pulse_Wp_Dashboard_Preferences::resolve_layout_for_modules(
			$modules,
			Neo_Pulse_Wp_Dashboard_Preferences::get_layout_groups( $user_id )
		);
		$export  = Neo_Pulse_Wp_Dashboard_Preferences::export_groups_for_client( $groups );

		wp_localize_script(
			'neo-pulse-wp-dashboard-reorder',
			'neoPulseWpDashboardReorder',
			array(
				'restUrl'       => esc_url_raw( rest_url( Neo_Pulse_Wp_Dashboard_Preferences::REST_NAMESPACE . '/dashboard/module-order' ) ),
				'restLayoutUrl' => esc_url_raw( rest_url( Neo_Pulse_Wp_Dashboard_Preferences::REST_NAMESPACE . '/dashboard/layout' ) ),
				'nonce'         => wp_create_nonce( 'wp_rest' ),
				'groups'        => $export,
				'i18n'          => array(
					'customize'               => __( 'Customize layout', 'neo-pulse-wp' ),
					'done'                    => __( 'Done', 'neo-pulse-wp' ),
					'addSection'              => __( 'Add section', 'neo-pulse-wp' ),
					'sectionTitlePlaceholder' => __( 'Section title', 'neo-pulse-wp' ),
					'removeSection'           => __( 'Remove section', 'neo-pulse-wp' ),
					'sectionNotEmpty'         => __( 'Remove all modules from this section before deleting it.', 'neo-pulse-wp' ),
					'modulesLabel'            => __( 'Site modules', 'neo-pulse-wp' ),
				),
			)
		);
	}

	/**
	 * Chat admin demo: inline sidebar preview styles (matches frontend widget).
	 */
	private static function enqueue_chat_demo_assets(): void {
		$base = plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE );
		$ver  = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.9.33';

		Neo_Pulse_Wp_Voice::enqueue_thinking_card_assets( true );
		wp_enqueue_script( 'neo-pulse-display-text' );
		wp_enqueue_script( 'neo-pulse-markdown' );

		wp_enqueue_style( 'neo-pulse-ai-sidebar-shell', $base . 'assets/shared/neo-pulse-ai-sidebar-shell.css', array( 'neo-pulse-wp-lato' ), $ver );
		wp_enqueue_style( 'neo-pulse-chat-widget', $base . 'assets/frontend/neo-pulse-chat-widget.css', array( 'neo-pulse-wp-lato' ), $ver );
		wp_enqueue_style( 'neo-pulse-chat-chrome', $base . 'assets/frontend/neo-pulse-chat-chrome.css', array( 'neo-pulse-chat-widget' ), $ver );

		$demo_css = NEO_PULSE_WP_PLUGIN_DIR . 'assets/admin/admin-chat-demo.css';
		if ( is_readable( $demo_css ) ) {
			$ver .= '.' . (string) filemtime( $demo_css );
		}
		wp_enqueue_style(
			'neo-pulse-chat-demo',
			$base . 'assets/admin/admin-chat-demo.css',
			array( 'neo-pulse-chat-chrome', 'neo-pulse-ai-sidebar-shell', 'neo-pulse-wp-admin-contrast' ),
			$ver
		);

		if ( class_exists( 'Neo_Pulse_Wp_Forms' ) ) {
			Neo_Pulse_Wp_Forms::enqueue_frontend_assets();
		}

		$demo_js = NEO_PULSE_WP_PLUGIN_DIR . 'assets/admin/admin-chat-demo.js';
		$js_ver  = $ver;
		if ( is_readable( $demo_js ) ) {
			$js_ver .= '.' . (string) filemtime( $demo_js );
		}
		$demo_deps = array( 'neo-pulse-thinking-card', 'neo-pulse-chat-stream', 'neo-pulse-chat-prefetch', 'neo-pulse-chat-debug-log', 'neo-pulse-display-text', 'neo-pulse-markdown' );
		if ( class_exists( 'Neo_Pulse_Wp_Forms' ) ) {
			$demo_deps[] = 'neo-pulse-forms';
		}
		wp_enqueue_script(
			'neo-pulse-chat-demo',
			$base . 'assets/admin/admin-chat-demo.js',
			$demo_deps,
			$js_ver,
			true
		);

		$chat_settings = Neo_Pulse_Wp_Chat::get_settings();
		wp_localize_script(
			'neo-pulse-chat-demo',
			'neo-pulseChatDemo',
			array(
				'ajaxUrl'       => admin_url( 'admin-ajax.php' ),
				'streamNonce'   => wp_create_nonce( 'neo_pulse_chat_stream' ),
				'greetingStyle' => isset( $chat_settings['greeting_style'] ) ? (string) $chat_settings['greeting_style'] : 'friendly',
				'brainSvg'      => self::brand_icon_svg( '#4285f4', 24 ),
				'ui'            => Neo_Pulse_Wp_Ai_Widget_Design::get_settings()['chat_ui'] ?? array(),
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
		if ( $screen && in_array( $screen->id, self::neo_pulse_admin_screen_ids(), true ) ) {
			return;
		}
		if ( get_user_meta( get_current_user_id(), self::NOTICE_USER_META, true ) ) {
			return;
		}
		$dismiss_url = wp_nonce_url(
			add_query_arg( self::DISMISS_ACTION, '1', admin_url() ),
			self::DISMISS_ACTION
		);
		$app_url = admin_url( 'admin.php?page=neo-pulse-wp-settings' );
		?>
		<div class="notice notice-info">
			<p>
				<?php esc_html_e( 'NEO Pulse WP is active. Configure API keys under Settings.', 'neo-pulse-wp' ); ?>
				<a href="<?php echo esc_url( $app_url ); ?>">
					<?php esc_html_e( 'Open Settings', 'neo-pulse-wp' ); ?>
				</a>
				<span aria-hidden="true"> | </span>
				<a href="<?php echo esc_url( $dismiss_url ); ?>">
					<?php esc_html_e( 'Dismiss', 'neo-pulse-wp' ); ?>
				</a>
			</p>
		</div>
		<?php
	}
}
