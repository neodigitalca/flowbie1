<?php
/**
 * Settings: tabbed panel (site, OpenRouter, GSC, DataForSEO).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Render_Settings_Placeholder {

	public static function render_settings_placeholder_page(): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			return;
		}

		$openrouter_configured = Neo_Pulse_Wp_OpenRouter::get_api_key() !== '';
		$openrouter_source     = Neo_Pulse_Wp_OpenRouter::get_openrouter_source();
		$has_site_openrouter   = Neo_Pulse_Wp_Api::get_agency_openrouter_api_key() !== '';
		$dfs_configured        = Neo_Pulse_Wp_Research_Keys::dataforseo_configured();
		$dfs_source            = Neo_Pulse_Wp_Research_Keys::get_dataforseo_source();
		$has_site_dfs          = Neo_Pulse_Wp_Api::get_agency_dataforseo_login() !== '' || Neo_Pulse_Wp_Api::get_agency_dataforseo_password() !== '';
		$site_dfs_login        = Neo_Pulse_Wp_Api::get_agency_dataforseo_login();
		if ( $site_dfs_login === '' && $dfs_configured ) {
			$site_dfs_login = Neo_Pulse_Wp_Research_Keys::dataforseo()['login'];
		}

		$tab = self::panel_active_tab( 'property' );
		if ( ! in_array( $tab, array( 'property', 'openrouter', 'gsc', 'dataforseo', 'gmb', 'comments' ), true ) ) {
			$tab = 'property';
		}

		$nav_groups = array(
			array(
				'heading' => __( 'Settings', 'neo-pulse-wp' ),
				'tabs'    => array(
					'property'   => __( 'Site', 'neo-pulse-wp' ),
					'openrouter' => __( 'Editor AI', 'neo-pulse-wp' ),
					'gsc'        => __( 'Search Console', 'neo-pulse-wp' ),
					'dataforseo' => __( 'SEO research', 'neo-pulse-wp' ),
					'gmb'        => __( 'GMB', 'neo-pulse-wp' ),
					'comments'   => __( 'Comments', 'neo-pulse-wp' ),
				),
			),
		);

		self::neo_pulse_group_shell_open( 'neo-pulse-wp-settings', 'neo-pulse-wp-settings neo-pulse-wp-panel-page' );

		self::panel_layout_start( 'neo-pulse-wp-settings', $nav_groups, $tab, __( 'Settings sections', 'neo-pulse-wp' ) );
		switch ( $tab ) {
			case 'openrouter':
				self::render_settings_section_openrouter( $openrouter_configured, $openrouter_source, $has_site_openrouter );
				break;
			case 'gsc':
				self::render_settings_section_gsc();
				break;
			case 'dataforseo':
				self::render_settings_section_dataforseo( $dfs_configured, $dfs_source, $has_site_dfs, $site_dfs_login );
				break;
			case 'gmb':
				self::render_settings_section_gmb();
				break;
			case 'comments':
				self::render_settings_section_comments();
				break;
			default:
				self::render_settings_section_property();
				break;
		}
		self::panel_layout_end();

		self::neo_pulse_group_shell_close();
	}

	private static function render_settings_section_property(): void {
		$plugin_ver = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '';
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Site', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'This WordPress site runs NEO Pulse WP standalone. API keys load from the plugin .env file or the tabs below.', 'neo-pulse-wp' ); ?>
		</p>

		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p><strong><?php echo esc_html( get_bloginfo( 'name' ) ); ?></strong></p>
			<p><a href="<?php echo esc_url( home_url( '/' ) ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( home_url( '/' ) ); ?></a></p>
			<?php if ( $plugin_ver !== '' ) : ?>
				<p><?php echo esc_html( sprintf( /* translators: %s: plugin version */ __( 'NEO Pulse WP %s', 'neo-pulse-wp' ), $plugin_ver ) ); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}

	private static function render_settings_section_openrouter(
		bool $openrouter_configured,
		string $openrouter_source,
		bool $has_site_openrouter
	): void {
		$form_id = 'neo-pulse-wp-settings-openrouter-form';
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Editor AI (OpenRouter)', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'Required for AI wands in the post editor and Flow Assist chat. Keys can live in the plugin .env file or here.', 'neo-pulse-wp' ); ?>
		</p>

		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p>
				<?php
				if ( $openrouter_configured ) {
					if ( 'site' === $openrouter_source ) {
						esc_html_e( 'Status: configured (saved on this site).', 'neo-pulse-wp' );
					} elseif ( 'wp-config' === $openrouter_source || 'environment' === $openrouter_source ) {
						esc_html_e( 'Status: configured (wp-config / plugin .env).', 'neo-pulse-wp' );
					} else {
						esc_html_e( 'Status: configured.', 'neo-pulse-wp' );
					}
				} else {
					esc_html_e( 'Status: not configured yet.', 'neo-pulse-wp' );
				}
				?>
			</p>
		</div>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form neo-pulse-wp-settings__form--openrouter" autocomplete="off">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_OPENROUTER ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_OPENROUTER, 'neo_pulse_wp_openrouter_nonce' ); ?>
				<?php
				self::panel_form_group_open();
				self::panel_form_field_input(
					'neo-pulse-wp-openrouter-api-key',
					'neo-pulse_openrouter_api_key',
					__( 'OpenRouter API key', 'neo-pulse-wp' ),
					'',
					'full',
					'password',
					false,
					__( 'Leave blank to keep the current key. Clear the field and save to remove it.', 'neo-pulse-wp' ),
					' placeholder="' . esc_attr( $has_site_openrouter ? '••••••••••••••••' : __( 'sk-or-v1-…', 'neo-pulse-wp' ) ) . '" autocomplete="off"'
				);
				self::panel_form_group_close();
				?>
			</form>
		<?php else : ?>
			<p class="description"><?php esc_html_e( 'Ask a site administrator to add the OpenRouter key here.', 'neo-pulse-wp' ); ?></p>
		<?php endif; ?>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<div class="neo-pulse-wp-panel-footer">
				<p class="neo-pulse-wp-settings__actions neo-pulse-wp-panel-footer__right">
					<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary neo-pulse-wp-settings__btn"><?php esc_html_e( 'Save OpenRouter key', 'neo-pulse-wp' ); ?></button>
				</p>
			</div>
		<?php endif; ?>
		<?php
	}

	private static function render_settings_section_gsc(): void {
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Google Search Console', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'Analytics uses this service account to read Search Console stats for this WordPress site.', 'neo-pulse-wp' ); ?>
		</p>
		<?php self::render_gsc_connection_panel( false ); ?>
		<?php
	}

	private static function render_settings_section_dataforseo(
		bool $dfs_configured,
		string $dfs_source,
		bool $has_site_dfs,
		string $site_dfs_login
	): void {
		$form_id = 'neo-pulse-wp-settings-dataforseo-form';
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'SEO research (DataForSEO)', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'Required for editor SEO research briefs. Use your DataForSEO account login and API password (from app.dataforseo.com → API Access).', 'neo-pulse-wp' ); ?>
		</p>

		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p>
				<?php
				if ( $dfs_configured ) {
					if ( 'wp-config' === $dfs_source || 'environment' === $dfs_source ) {
						esc_html_e( 'Status: configured (wp-config / server env).', 'neo-pulse-wp' );
					} elseif ( 'site' === $dfs_source ) {
						esc_html_e( 'Status: configured (saved on this site).', 'neo-pulse-wp' );
					} else {
						esc_html_e( 'Status: configured.', 'neo-pulse-wp' );
					}
				} else {
					esc_html_e( 'Status: not configured yet.', 'neo-pulse-wp' );
				}
				?>
			</p>
		</div>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form neo-pulse-wp-settings__form--dataforseo" autocomplete="off">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_DATAFORSEO ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_DATAFORSEO, 'neo_pulse_wp_dataforseo_nonce' ); ?>
				<?php
				self::panel_form_group_open();
				self::panel_form_field_input(
					'neo-pulse-wp-dataforseo-login',
					'neo-pulse_dataforseo_login',
					__( 'DataForSEO login', 'neo-pulse-wp' ),
					$site_dfs_login,
					'half',
					'text',
					false,
					'',
					' placeholder="' . esc_attr__( 'your@email.com', 'neo-pulse-wp' ) . '" autocomplete="off"'
				);
				self::panel_form_field_input(
					'neo-pulse-wp-dataforseo-password',
					'neo-pulse_dataforseo_password',
					__( 'DataForSEO API password', 'neo-pulse-wp' ),
					'',
					'half',
					'password',
					false,
					__( 'Leave password blank to keep the current value. Clear both fields and save to remove stored credentials.', 'neo-pulse-wp' ),
					' placeholder="' . esc_attr( $has_site_dfs ? '••••••••••••••••' : __( 'API password from DataForSEO dashboard', 'neo-pulse-wp' ) ) . '" autocomplete="new-password"'
				);
				self::panel_form_group_close();
				?>
			</form>
		<?php else : ?>
			<p class="description"><?php esc_html_e( 'Ask a site administrator to add DataForSEO credentials here.', 'neo-pulse-wp' ); ?></p>
		<?php endif; ?>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<div class="neo-pulse-wp-panel-footer">
				<p class="neo-pulse-wp-settings__actions neo-pulse-wp-panel-footer__right">
					<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary neo-pulse-wp-settings__btn">
						<?php esc_html_e( 'Save DataForSEO credentials', 'neo-pulse-wp' ); ?>
					</button>
				</p>
			</div>
		<?php endif; ?>
		<?php
	}

	private static function render_settings_section_gmb(): void {
		$configured   = Neo_Pulse_Wp_Gmb::is_configured();
		$connected    = Neo_Pulse_Wp_Gmb::is_connected();
		$location_id  = Neo_Pulse_Wp_Gmb::get_location_id();
		$redirect_uri = Neo_Pulse_Wp_Gmb::get_redirect_uri();
		$form_id      = 'neo-pulse-wp-settings-gmb-form';

		$notice = isset( $_GET['neo-pulse_gmb_notice'] ) ? sanitize_text_field( wp_unslash( $_GET['neo-pulse_gmb_notice'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$notice_type = '';
		$notice_msg  = '';
		if ( $notice !== '' && strpos( $notice, '|' ) !== false ) {
			list( $notice_type, $notice_msg ) = explode( '|', $notice, 2 );
		}
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Google Business Profile (GMB)', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'Connect your Google Business Profile to publish social posts directly from the editor sidebar. Enter your OAuth credentials from Google Cloud, set your GBP Location ID, then click Connect.', 'neo-pulse-wp' ); ?>
		</p>

		<?php if ( $notice_msg !== '' ) : ?>
			<div class="neo-pulse-wp-panel-info-box<?php echo $notice_type === 'error' ? ' neo-pulse-wp-panel-info-box--error' : ''; ?>" role="alert">
				<p><?php echo esc_html( $notice_msg ); ?></p>
			</div>
		<?php endif; ?>

		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p>
				<?php
				if ( $connected ) {
					esc_html_e( 'Status: connected to Google Business Profile.', 'neo-pulse-wp' );
				} elseif ( $configured ) {
					esc_html_e( 'Status: credentials saved but not connected. Click Connect below.', 'neo-pulse-wp' );
				} else {
					esc_html_e( 'Status: not configured yet. Enter your Client ID and Secret below.', 'neo-pulse-wp' );
				}
				?>
			</p>
		</div>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form" autocomplete="off">
				<input type="hidden" name="action" value="neo_pulse_wp_save_gmb" />
				<?php wp_nonce_field( 'neo_pulse_wp_save_gmb', 'neo_pulse_wp_gmb_nonce' ); ?>
				<?php
				self::panel_form_group_open();
				self::panel_form_field_input(
					'neo-pulse-wp-gmb-client-id',
					'neo-pulse_gmb_client_id',
					__( 'OAuth Client ID', 'neo-pulse-wp' ),
					Neo_Pulse_Wp_Gmb::get_client_id(),
					'full',
					'text',
					false,
					'',
					' placeholder="' . esc_attr__( 'xxxxx.apps.googleusercontent.com', 'neo-pulse-wp' ) . '" autocomplete="off"'
				);
				self::panel_form_field_input(
					'neo-pulse-wp-gmb-client-secret',
					'neo-pulse_gmb_client_secret',
					__( 'OAuth Client Secret', 'neo-pulse-wp' ),
					'',
					'full',
					'password',
					false,
					__( 'Leave blank to keep the current secret.', 'neo-pulse-wp' ),
					' placeholder="' . esc_attr( $configured ? '••••••••••••••••' : 'GOCSPX-...' ) . '" autocomplete="new-password"'
				);
				self::panel_form_field_input(
					'neo-pulse-wp-gmb-location-id',
					'neo-pulse_gmb_location_id',
					__( 'GBP Location ID', 'neo-pulse-wp' ),
					$location_id,
					'full',
					'text',
					false,
					__( 'Find this in your Google Business Profile URL or via the Advanced settings → Copy ID.', 'neo-pulse-wp' ),
					' placeholder="' . esc_attr__( 'Numeric location ID or full locations/123 path', 'neo-pulse-wp' ) . '" autocomplete="off"'
				);
				self::panel_form_group_close();
				?>
			</form>

			<?php if ( $redirect_uri ) : ?>
				<div class="neo-pulse-wp-panel-info-box">
					<p><strong><?php esc_html_e( 'Redirect URI (add this in Google Cloud → OAuth client → Authorized redirect URIs)', 'neo-pulse-wp' ); ?></strong></p>
					<p><code><?php echo esc_html( $redirect_uri ); ?></code></p>
				</div>
			<?php endif; ?>
		<?php else : ?>
			<p class="description"><?php esc_html_e( 'Ask a site administrator to configure GMB credentials.', 'neo-pulse-wp' ); ?></p>
		<?php endif; ?>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<div class="neo-pulse-wp-panel-footer">
				<div class="neo-pulse-wp-panel-footer__left">
					<?php if ( $configured ) : ?>
						<a href="<?php echo esc_url( Neo_Pulse_Wp_Gmb::get_authorize_url() ); ?>" class="button button-secondary">
							<?php echo $connected ? esc_html__( 'Re-connect Google Business', 'neo-pulse-wp' ) : esc_html__( 'Connect Google Business', 'neo-pulse-wp' ); ?>
						</a>
					<?php endif; ?>
				</div>
				<p class="neo-pulse-wp-settings__actions neo-pulse-wp-panel-footer__right">
					<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary neo-pulse-wp-settings__btn">
						<?php esc_html_e( 'Save GMB credentials', 'neo-pulse-wp' ); ?>
					</button>
				</p>
			</div>
		<?php endif; ?>
		<?php
	}

	private static function render_settings_section_comments(): void {
		$enabled = Neo_Pulse_Wp_Comments::is_enabled();
		$form_id = 'neo-pulse-wp-settings-comments-form';
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Comments', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'Enable or disable WordPress comments site-wide.', 'neo-pulse-wp' ); ?>
		</p>

		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p>
				<?php
				echo esc_html(
					$enabled
						? __( 'Status: enabled — comments are open according to each post or page.', 'neo-pulse-wp' )
						: __( 'Status: disabled — comments are closed on the public site and in the editor.', 'neo-pulse-wp' )
				);
				?>
			</p>
		</div>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_COMMENTS ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_COMMENTS, 'neo_pulse_wp_comments_nonce' ); ?>
				<?php
				self::panel_form_group_open();
				self::panel_form_toggle(
					'neo-pulse_comments_enabled',
					__( 'Enable comments site-wide', 'neo-pulse-wp' ),
					$enabled,
					'',
					'1',
					'neo-pulse_comments_enabled'
				);
				self::panel_form_group_close();
				?>
			</form>

			<div class="neo-pulse-wp-panel-footer">
				<p class="neo-pulse-wp-settings__actions neo-pulse-wp-panel-footer__right">
					<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary neo-pulse-wp-settings__btn">
						<?php esc_html_e( 'Save comments setting', 'neo-pulse-wp' ); ?>
					</button>
				</p>
			</div>
		<?php else : ?>
			<p class="description"><?php esc_html_e( 'Ask a site administrator to change comment settings.', 'neo-pulse-wp' ); ?></p>
		<?php endif; ?>
		<?php
	}
}
