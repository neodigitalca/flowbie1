<?php
/**
 * Post-activation welcome modal.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Welcome modal shown immediately after plugin activation.
 */
class Neo_Pulse_Wp_Welcome {

	const TRANSIENT_KEY    = 'neo_pulse_wp_activation_welcome';
	const OPTION_COMPLETED = 'neo_pulse_wp_welcome_completed';
	const DISMISS_ACTION   = 'neo_pulse_wp_dismiss_welcome';
	const QUERY_FLAG       = 'neo_pulse_welcome';

	public static function init(): void {
		add_action( 'admin_init', array( __CLASS__, 'maybe_redirect_after_activation' ), 1 );
		add_action( 'admin_init', array( __CLASS__, 'maybe_handle_dismiss' ), 1 );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'admin_footer', array( __CLASS__, 'render_modal' ) );
		add_action( 'wp_ajax_' . self::DISMISS_ACTION, array( __CLASS__, 'ajax_dismiss' ) );
	}

	public static function is_completed(): bool {
		return (bool) get_option( self::OPTION_COMPLETED, '' );
	}

	public static function has_pending_flag(): bool {
		return (bool) get_transient( self::TRANSIENT_KEY );
	}

	public static function should_show_welcome(): bool {
		if ( self::is_completed() ) {
			return false;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return false;
		}
		if ( self::has_pending_flag() ) {
			return true;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return isset( $_GET[ self::QUERY_FLAG ] ) && '1' === (string) wp_unslash( $_GET[ self::QUERY_FLAG ] );
	}

	public static function complete_welcome(): void {
		update_option( self::OPTION_COMPLETED, '1', false );
		delete_transient( self::TRANSIENT_KEY );
	}

	public static function maybe_redirect_after_activation(): void {
		if ( ! is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
			return;
		}
		if ( is_network_admin() ) {
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['activate-multi'] ) ) {
			return;
		}
		if ( ! self::has_pending_flag() || self::is_completed() ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		global $pagenow;
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( (string) $_GET['page'] ) ) : '';
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$welcome = isset( $_GET[ self::QUERY_FLAG ] ) ? (string) wp_unslash( $_GET[ self::QUERY_FLAG ] ) : '';

		if ( 'admin.php' === $pagenow && 'neo-pulse-wp' === $page && '1' === $welcome ) {
			return;
		}

		wp_safe_redirect(
			add_query_arg(
				array(
					'page'           => 'neo-pulse-wp',
					self::QUERY_FLAG => '1',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	public static function maybe_handle_dismiss(): void {
		if ( ! isset( $_GET[ self::DISMISS_ACTION ] ) || ! isset( $_GET['_wpnonce'] ) ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( (string) $_GET['_wpnonce'] ) ), self::DISMISS_ACTION ) ) {
			return;
		}
		self::complete_welcome();
		wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp' ) );
		exit;
	}

	public static function ajax_dismiss(): void {
		check_ajax_referer( self::DISMISS_ACTION, 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized.', 'neo-pulse-wp' ) ), 403 );
		}
		self::complete_welcome();
		wp_send_json_success( array( 'ok' => true ) );
	}

	public static function enqueue_assets( string $hook_suffix ): void {
		if ( 'toplevel_page_neo_pulse-wp' !== $hook_suffix || ! self::should_show_welcome() ) {
			return;
		}

		wp_enqueue_style(
			'neo-pulse-wp-lato',
			'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,600;0,700;1,400&display=swap',
			array(),
			null
		);

		$base = NEO_PULSE_WP_PLUGIN_DIR . 'assets/admin/';
		$url  = plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/admin/';

		$css_rel = 'admin-welcome.css';
		$css_ver = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.5.0';
		if ( is_readable( $base . $css_rel ) ) {
			$css_ver .= '.' . (string) filemtime( $base . $css_rel );
		}
		wp_enqueue_style(
			'neo-pulse-wp-admin-welcome',
			$url . $css_rel,
			array( 'neo-pulse-wp-lato' ),
			$css_ver
		);

		$js_rel = 'admin-welcome.js';
		$js_ver = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.5.0';
		if ( is_readable( $base . $js_rel ) ) {
			$js_ver .= '.' . (string) filemtime( $base . $js_rel );
		}
		wp_enqueue_script(
			'neo-pulse-wp-admin-welcome',
			$url . $js_rel,
			array(),
			$js_ver,
			true
		);

		wp_localize_script(
			'neo-pulse-wp-admin-welcome',
			'neoPulseWpWelcome',
			array(
				'ajaxUrl'        => admin_url( 'admin-ajax.php' ),
				'nonce'          => wp_create_nonce( self::DISMISS_ACTION ),
				'dismissAction'  => self::DISMISS_ACTION,
				'superImportUrl' => admin_url( 'admin.php?page=neo-pulse-wp-super-migrate' ),
				'i18n'           => array(
					'close' => __( 'Close welcome dialog', 'neo-pulse-wp' ),
				),
			)
		);
	}

	public static function render_modal(): void {
		if ( ! self::should_show_welcome() ) {
			return;
		}

		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || 'toplevel_page_neo_pulse-wp' !== $screen->id ) {
			return;
		}

		$super_import_url = admin_url( 'admin.php?page=neo-pulse-wp-super-migrate' );
		$robot_svg        = '';
		if ( class_exists( 'Neo_Pulse_Wp_Admin' ) && method_exists( 'Neo_Pulse_Wp_Admin', 'welcome_robot_svg' ) ) {
			$robot_svg = Neo_Pulse_Wp_Admin::welcome_robot_svg( '#22d3ee', 120 );
		}
		?>
		<div id="neo-pulse-welcome-modal" class="neo-pulse-welcome-modal" hidden>
			<div class="neo-pulse-welcome-modal__backdrop" tabindex="-1" aria-hidden="true"></div>
			<div
				class="neo-pulse-welcome-modal__panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="neo-pulse-welcome-modal-title"
			>
				<button
					type="button"
					class="neo-pulse-welcome-modal__close"
					id="neo-pulse-welcome-modal-close"
					aria-label="<?php esc_attr_e( 'Close welcome dialog', 'neo-pulse-wp' ); ?>"
				>&times;</button>

				<?php if ( $robot_svg !== '' ) : ?>
				<div class="neo-pulse-welcome-modal__robot" aria-hidden="true">
					<?php echo $robot_svg; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				</div>
				<?php endif; ?>

				<h2 id="neo-pulse-welcome-modal-title" class="neo-pulse-welcome-modal__title">
					<?php esc_html_e( 'Welcome to NEO Pulse!', 'neo-pulse-wp' ); ?>
				</h2>

				<p class="neo-pulse-welcome-modal__lead">
					<?php esc_html_e( 'Your site just got smarter. Super Import pulls in settings from ACF, Rank Math, scripts, speed tools, and more — all in one go.', 'neo-pulse-wp' ); ?>
				</p>

				<div class="neo-pulse-welcome-modal__actions">
					<a
						href="<?php echo esc_url( $super_import_url ); ?>"
						class="button button-primary neo-pulse-welcome-modal__cta"
						id="neo-pulse-welcome-modal-cta"
					>
						<?php esc_html_e( 'Beam me to Super Import', 'neo-pulse-wp' ); ?>
					</a>
					<button type="button" class="neo-pulse-welcome-modal__secondary" id="neo-pulse-welcome-modal-explore">
						<?php esc_html_e( 'Explore dashboard', 'neo-pulse-wp' ); ?>
					</button>
				</div>

				<button type="button" class="neo-pulse-welcome-modal__later" id="neo-pulse-welcome-modal-later">
					<?php esc_html_e( 'Maybe later', 'neo-pulse-wp' ); ?>
				</button>
			</div>
		</div>
		<?php
	}
}
