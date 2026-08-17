<?php
/**
 * Analytics admin_post refresh handler.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Handlers_Analytics {

	const ACTION_REFRESH_ANALYTICS = 'neo_pulse_wp_refresh_analytics';

	public static function handle_refresh_analytics(): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			wp_die( esc_html__( 'You do not have permission to refresh analytics.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_REFRESH_ANALYTICS, 'neo_pulse_wp_analytics_refresh_nonce' );

		Neo_Pulse_Wp_Gsc::flush_stats_cache();

		$tab = isset( $_POST['neo-pulse_analytics_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['neo-pulse_analytics_tab'] ) ) : 'overview';

		self::set_flash(
			array(
				'kind'    => 'analytics',
				'success' => true,
				'message' => __( 'Analytics data refreshed.', 'neo-pulse-wp' ),
			)
		);
		self::redirect_to_analytics( $tab );
	}
}
