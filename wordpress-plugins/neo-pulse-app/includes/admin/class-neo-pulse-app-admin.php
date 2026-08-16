<?php
/**
 * WP Admin entry point for the NEO Pulse React app at /neo-pulse/.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Admin {

	const MENU_SLUG = 'neo-pulse-app';

	public static function init(): void {
		if ( is_admin() ) {
			add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		}
		add_action( 'admin_bar_menu', array( __CLASS__, 'admin_bar_link' ), 100 );
	}

	public static function app_url(): string {
		return home_url( '/neo-pulse/' );
	}

	public static function register_menu(): void {
		add_menu_page(
			__( 'NEO Pulse App', 'neo-pulse-app' ),
			__( 'NEO Pulse App', 'neo-pulse-app' ),
			'manage_options',
			self::MENU_SLUG,
			array( __CLASS__, 'render_page' ),
			'dashicons-chart-area',
			57
		);
	}

	/**
	 * @param WP_Admin_Bar $bar Admin bar.
	 */
	public static function admin_bar_link( $bar ): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$href = is_admin()
			? admin_url( 'admin.php?page=' . self::MENU_SLUG )
			: self::app_url();

		$bar->add_node(
			array(
				'id'    => 'neo-pulse-app',
				'title' => 'NEO Pulse App',
				'href'  => $href,
				'meta'  => array(
					'title' => __( 'Open NEO Pulse App workspace', 'neo-pulse-app' ),
				),
			)
		);
	}

	public static function render_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access NEO Pulse App.', 'neo-pulse-app' ) );
		}

		$app_url   = esc_url( self::app_url() );
		$api_probe = esc_url( home_url( '/api/manager-cloud-settings/status' ) );
		?>
		<div class="wrap neo-pulse-admin-wrap" style="margin:0;padding:0;max-width:none;">
			<style>
				.neo-pulse-admin-bar {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 12px;
					padding: 10px 16px;
					background: #111;
					color: #fff;
					border-bottom: 1px solid #333;
				}
				.neo-pulse-admin-bar a.button {
					margin-left: 8px;
				}
				.neo-pulse-admin-frame {
					display: block;
					width: 100%;
					height: calc(100vh - 32px);
					border: 0;
					background: #000;
				}
				@media screen and (max-width: 782px) {
					.neo-pulse-admin-frame { height: calc(100vh - 46px); }
				}
			</style>
			<div class="neo-pulse-admin-bar">
				<div>
					<strong style="font-size:16px;">NEO Pulse App</strong>
					<span style="opacity:.75;margin-left:8px;">SEO workspace at <?php echo esc_html( wp_parse_url( $app_url, PHP_URL_PATH ) ?: '/neo-pulse/' ); ?></span>
				</div>
				<div>
					<a class="button button-primary" href="<?php echo $app_url; ?>" target="_blank" rel="noopener noreferrer">
						<?php esc_html_e( 'Open in new tab', 'neo-pulse-app' ); ?>
					</a>
					<a class="button" href="<?php echo $app_url; ?>">
						<?php esc_html_e( 'Open front-end URL', 'neo-pulse-app' ); ?>
					</a>
				</div>
			</div>
			<iframe
				class="neo-pulse-admin-frame"
				src="<?php echo $app_url; ?>"
				title="<?php esc_attr_e( 'NEO Pulse App', 'neo-pulse-app' ); ?>"
				loading="lazy"
			></iframe>
			<script>
				(function () {
					var probe = <?php echo wp_json_encode( $api_probe ); ?>;
					fetch(probe, { credentials: 'same-origin' })
						.then(function (r) { return r.ok ? r.json() : null; })
						.catch(function () { return null; });
				})();
			</script>
		</div>
		<?php
	}
}
