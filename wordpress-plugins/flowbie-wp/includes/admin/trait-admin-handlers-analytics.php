<?php
/**
 * Analytics admin_post refresh handler.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Analytics {

	const ACTION_REFRESH_ANALYTICS = 'flowbie_wp_refresh_analytics';

	public static function handle_refresh_analytics(): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			wp_die( esc_html__( 'You do not have permission to refresh analytics.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_REFRESH_ANALYTICS, 'flowbie_wp_analytics_refresh_nonce' );

		Flowbie_Wp_Gsc::flush_stats_cache();

		$tab = isset( $_POST['flowbie_analytics_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_analytics_tab'] ) ) : 'overview';

		self::set_flash(
			array(
				'kind'    => 'analytics',
				'success' => true,
				'message' => __( 'Analytics data refreshed.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_analytics( $tab );
	}
}
