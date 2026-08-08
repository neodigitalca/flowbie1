<?php
/**
 * Settings: tabbed panel (site, OpenRouter, GSC, DataForSEO).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Settings_Placeholder {

	public static function render_settings_placeholder_page(): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			return;
		}

		$openrouter_configured = Flowbie_Wp_OpenRouter::get_api_key() !== '';
		$openrouter_source     = Flowbie_Wp_OpenRouter::get_openrouter_source();
		$has_site_openrouter   = Flowbie_Wp_Api::get_agency_openrouter_api_key() !== '';
		$dfs_configured        = Flowbie_Wp_Research_Keys::dataforseo_configured();
		$dfs_source            = Flowbie_Wp_Research_Keys::get_dataforseo_source();
		$has_site_dfs          = Flowbie_Wp_Api::get_agency_dataforseo_login() !== '' || Flowbie_Wp_Api::get_agency_dataforseo_password() !== '';
		$site_dfs_login        = Flowbie_Wp_Api::get_agency_dataforseo_login();
		if ( $site_dfs_login === '' && $dfs_configured ) {
			$site_dfs_login = Flowbie_Wp_Research_Keys::dataforseo()['login'];
		}

		$tab = self::panel_active_tab( 'property' );
		if ( ! in_array( $tab, array( 'property', 'openrouter', 'gsc', 'dataforseo', 'gmb', 'comments' ), true ) ) {
			$tab = 'property';
		}

		$nav_groups = array(
			array(
				'heading' => __( 'Settings', 'flowbie-wp' ),
				'tabs'    => array(
					'property'   => __( 'Site', 'flowbie-wp' ),
					'openrouter' => __( 'Editor AI', 'flowbie-wp' ),
					'gsc'        => __( 'Search Console', 'flowbie-wp' ),
					'dataforseo' => __( 'SEO research', 'flowbie-wp' ),
					'gmb'        => __( 'GMB', 'flowbie-wp' ),
					'comments'   => __( 'Comments', 'flowbie-wp' ),
				),
			),
		);

		self::flowbie_group_shell_open( 'flowbie-wp-settings', 'flowbie-wp-settings flowbie-wp-panel-page' );

		self::panel_layout_start( 'flowbie-wp-settings', $nav_groups, $tab, __( 'Settings sections', 'flowbie-wp' ) );
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

		self::flowbie_group_shell_close();
	}

	private static function render_settings_section_property(): void {
		$plugin_ver = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Site', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'This WordPress site runs Flowbie WP standalone. API keys load from the plugin .env file or the tabs below.', 'flowbie-wp' ); ?>
		</p>

		<div class="flowbie-wp-panel-info-box" role="status">
			<p><strong><?php echo esc_html( get_bloginfo( 'name' ) ); ?></strong></p>
			<p><a href="<?php echo esc_url( home_url( '/' ) ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( home_url( '/' ) ); ?></a></p>
			<?php if ( $plugin_ver !== '' ) : ?>
				<p><?php echo esc_html( sprintf( /* translators: %s: plugin version */ __( 'Flowbie WP %s', 'flowbie-wp' ), $plugin_ver ) ); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}

	private static function render_settings_section_openrouter(
		bool $openrouter_configured,
		string $openrouter_source,
		bool $has_site_openrouter
	): void {
		$form_id = 'flowbie-wp-settings-openrouter-form';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Editor AI (OpenRouter)', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Required for AI wands in the post editor and Flow Assist chat. Keys can live in the plugin .env file or here.', 'flowbie-wp' ); ?>
		</p>

		<div class="flowbie-wp-panel-info-box" role="status">
			<p>
				<?php
				if ( $openrouter_configured ) {
					if ( 'site' === $openrouter_source ) {
						esc_html_e( 'Status: configured (saved on this site).', 'flowbie-wp' );
					} elseif ( 'wp-config' === $openrouter_source || 'environment' === $openrouter_source ) {
						esc_html_e( 'Status: configured (wp-config / plugin .env).', 'flowbie-wp' );
					} else {
						esc_html_e( 'Status: configured.', 'flowbie-wp' );
					}
				} else {
					esc_html_e( 'Status: not configured yet.', 'flowbie-wp' );
				}
				?>
			</p>
		</div>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form flowbie-wp-settings__form--openrouter" autocomplete="off">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_OPENROUTER ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_OPENROUTER, 'flowbie_wp_openrouter_nonce' ); ?>
				<?php
				self::panel_form_group_open();
				self::panel_form_field_input(
					'flowbie-wp-openrouter-api-key',
					'flowbie_openrouter_api_key',
					__( 'OpenRouter API key', 'flowbie-wp' ),
					'',
					'full',
					'password',
					false,
					__( 'Leave blank to keep the current key. Clear the field and save to remove it.', 'flowbie-wp' ),
					' placeholder="' . esc_attr( $has_site_openrouter ? '••••••••••••••••' : __( 'sk-or-v1-…', 'flowbie-wp' ) ) . '" autocomplete="off"'
				);
				self::panel_form_group_close();
				?>
			</form>
		<?php else : ?>
			<p class="description"><?php esc_html_e( 'Ask a site administrator to add the OpenRouter key here.', 'flowbie-wp' ); ?></p>
		<?php endif; ?>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<div class="flowbie-wp-panel-footer">
				<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
					<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn"><?php esc_html_e( 'Save OpenRouter key', 'flowbie-wp' ); ?></button>
				</p>
			</div>
		<?php endif; ?>
		<?php
	}

	private static function render_settings_section_gsc(): void {
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Google Search Console', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Analytics uses this service account to read Search Console stats for this WordPress site.', 'flowbie-wp' ); ?>
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
		$form_id = 'flowbie-wp-settings-dataforseo-form';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'SEO research (DataForSEO)', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Required for editor SEO research briefs. Use your DataForSEO account login and API password (from app.dataforseo.com → API Access).', 'flowbie-wp' ); ?>
		</p>

		<div class="flowbie-wp-panel-info-box" role="status">
			<p>
				<?php
				if ( $dfs_configured ) {
					if ( 'wp-config' === $dfs_source || 'environment' === $dfs_source ) {
						esc_html_e( 'Status: configured (wp-config / server env).', 'flowbie-wp' );
					} elseif ( 'site' === $dfs_source ) {
						esc_html_e( 'Status: configured (saved on this site).', 'flowbie-wp' );
					} else {
						esc_html_e( 'Status: configured.', 'flowbie-wp' );
					}
				} else {
					esc_html_e( 'Status: not configured yet.', 'flowbie-wp' );
				}
				?>
			</p>
		</div>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form flowbie-wp-settings__form--dataforseo" autocomplete="off">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_DATAFORSEO ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_DATAFORSEO, 'flowbie_wp_dataforseo_nonce' ); ?>
				<?php
				self::panel_form_group_open();
				self::panel_form_field_input(
					'flowbie-wp-dataforseo-login',
					'flowbie_dataforseo_login',
					__( 'DataForSEO login', 'flowbie-wp' ),
					$site_dfs_login,
					'half',
					'text',
					false,
					'',
					' placeholder="' . esc_attr__( 'your@email.com', 'flowbie-wp' ) . '" autocomplete="off"'
				);
				self::panel_form_field_input(
					'flowbie-wp-dataforseo-password',
					'flowbie_dataforseo_password',
					__( 'DataForSEO API password', 'flowbie-wp' ),
					'',
					'half',
					'password',
					false,
					__( 'Leave password blank to keep the current value. Clear both fields and save to remove stored credentials.', 'flowbie-wp' ),
					' placeholder="' . esc_attr( $has_site_dfs ? '••••••••••••••••' : __( 'API password from DataForSEO dashboard', 'flowbie-wp' ) ) . '" autocomplete="new-password"'
				);
				self::panel_form_group_close();
				?>
			</form>
		<?php else : ?>
			<p class="description"><?php esc_html_e( 'Ask a site administrator to add DataForSEO credentials here.', 'flowbie-wp' ); ?></p>
		<?php endif; ?>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<div class="flowbie-wp-panel-footer">
				<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
					<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
						<?php esc_html_e( 'Save DataForSEO credentials', 'flowbie-wp' ); ?>
					</button>
				</p>
			</div>
		<?php endif; ?>
		<?php
	}

	private static function render_settings_section_gmb(): void {
		$configured   = Flowbie_Wp_Gmb::is_configured();
		$connected    = Flowbie_Wp_Gmb::is_connected();
		$location_id  = Flowbie_Wp_Gmb::get_location_id();
		$redirect_uri = Flowbie_Wp_Gmb::get_redirect_uri();
		$form_id      = 'flowbie-wp-settings-gmb-form';

		$notice = isset( $_GET['flowbie_gmb_notice'] ) ? sanitize_text_field( wp_unslash( $_GET['flowbie_gmb_notice'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$notice_type = '';
		$notice_msg  = '';
		if ( $notice !== '' && strpos( $notice, '|' ) !== false ) {
			list( $notice_type, $notice_msg ) = explode( '|', $notice, 2 );
		}
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Google Business Profile (GMB)', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Connect your Google Business Profile to publish social posts directly from the editor sidebar. Enter your OAuth credentials from Google Cloud, set your GBP Location ID, then click Connect.', 'flowbie-wp' ); ?>
		</p>

		<?php if ( $notice_msg !== '' ) : ?>
			<div class="flowbie-wp-panel-info-box<?php echo $notice_type === 'error' ? ' flowbie-wp-panel-info-box--error' : ''; ?>" role="alert">
				<p><?php echo esc_html( $notice_msg ); ?></p>
			</div>
		<?php endif; ?>

		<div class="flowbie-wp-panel-info-box" role="status">
			<p>
				<?php
				if ( $connected ) {
					esc_html_e( 'Status: connected to Google Business Profile.', 'flowbie-wp' );
				} elseif ( $configured ) {
					esc_html_e( 'Status: credentials saved but not connected. Click Connect below.', 'flowbie-wp' );
				} else {
					esc_html_e( 'Status: not configured yet. Enter your Client ID and Secret below.', 'flowbie-wp' );
				}
				?>
			</p>
		</div>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form" autocomplete="off">
				<input type="hidden" name="action" value="flowbie_wp_save_gmb" />
				<?php wp_nonce_field( 'flowbie_wp_save_gmb', 'flowbie_wp_gmb_nonce' ); ?>
				<?php
				self::panel_form_group_open();
				self::panel_form_field_input(
					'flowbie-wp-gmb-client-id',
					'flowbie_gmb_client_id',
					__( 'OAuth Client ID', 'flowbie-wp' ),
					Flowbie_Wp_Gmb::get_client_id(),
					'full',
					'text',
					false,
					'',
					' placeholder="' . esc_attr__( 'xxxxx.apps.googleusercontent.com', 'flowbie-wp' ) . '" autocomplete="off"'
				);
				self::panel_form_field_input(
					'flowbie-wp-gmb-client-secret',
					'flowbie_gmb_client_secret',
					__( 'OAuth Client Secret', 'flowbie-wp' ),
					'',
					'full',
					'password',
					false,
					__( 'Leave blank to keep the current secret.', 'flowbie-wp' ),
					' placeholder="' . esc_attr( $configured ? '••••••••••••••••' : 'GOCSPX-...' ) . '" autocomplete="new-password"'
				);
				self::panel_form_field_input(
					'flowbie-wp-gmb-location-id',
					'flowbie_gmb_location_id',
					__( 'GBP Location ID', 'flowbie-wp' ),
					$location_id,
					'full',
					'text',
					false,
					__( 'Find this in your Google Business Profile URL or via the Advanced settings → Copy ID.', 'flowbie-wp' ),
					' placeholder="' . esc_attr__( 'Numeric location ID or full locations/123 path', 'flowbie-wp' ) . '" autocomplete="off"'
				);
				self::panel_form_group_close();
				?>
			</form>

			<?php if ( $redirect_uri ) : ?>
				<div class="flowbie-wp-panel-info-box">
					<p><strong><?php esc_html_e( 'Redirect URI (add this in Google Cloud → OAuth client → Authorized redirect URIs)', 'flowbie-wp' ); ?></strong></p>
					<p><code><?php echo esc_html( $redirect_uri ); ?></code></p>
				</div>
			<?php endif; ?>
		<?php else : ?>
			<p class="description"><?php esc_html_e( 'Ask a site administrator to configure GMB credentials.', 'flowbie-wp' ); ?></p>
		<?php endif; ?>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<div class="flowbie-wp-panel-footer">
				<div class="flowbie-wp-panel-footer__left">
					<?php if ( $configured ) : ?>
						<a href="<?php echo esc_url( Flowbie_Wp_Gmb::get_authorize_url() ); ?>" class="button button-secondary">
							<?php echo $connected ? esc_html__( 'Re-connect Google Business', 'flowbie-wp' ) : esc_html__( 'Connect Google Business', 'flowbie-wp' ); ?>
						</a>
					<?php endif; ?>
				</div>
				<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
					<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
						<?php esc_html_e( 'Save GMB credentials', 'flowbie-wp' ); ?>
					</button>
				</p>
			</div>
		<?php endif; ?>
		<?php
	}

	private static function render_settings_section_comments(): void {
		$enabled = Flowbie_Wp_Comments::is_enabled();
		$form_id = 'flowbie-wp-settings-comments-form';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Comments', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Enable or disable WordPress comments site-wide.', 'flowbie-wp' ); ?>
		</p>

		<div class="flowbie-wp-panel-info-box" role="status">
			<p>
				<?php
				echo esc_html(
					$enabled
						? __( 'Status: enabled — comments are open according to each post or page.', 'flowbie-wp' )
						: __( 'Status: disabled — comments are closed on the public site and in the editor.', 'flowbie-wp' )
				);
				?>
			</p>
		</div>

		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_COMMENTS ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_COMMENTS, 'flowbie_wp_comments_nonce' ); ?>
				<?php
				self::panel_form_group_open();
				self::panel_form_toggle(
					'flowbie_comments_enabled',
					__( 'Enable comments site-wide', 'flowbie-wp' ),
					$enabled,
					'',
					'1',
					'flowbie_comments_enabled'
				);
				self::panel_form_group_close();
				?>
			</form>

			<div class="flowbie-wp-panel-footer">
				<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
					<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
						<?php esc_html_e( 'Save comments setting', 'flowbie-wp' ); ?>
					</button>
				</p>
			</div>
		<?php else : ?>
			<p class="description"><?php esc_html_e( 'Ask a site administrator to change comment settings.', 'flowbie-wp' ); ?></p>
		<?php endif; ?>
		<?php
	}
}
