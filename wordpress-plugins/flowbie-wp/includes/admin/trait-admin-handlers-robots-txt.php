<?php
/**
 * robots.txt admin_post save and reset handlers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Robots_Txt {

	const ACTION_SAVE_ROBOTS_TXT  = 'flowbie_wp_save_robots_txt';
	const ACTION_RESET_ROBOTS_TXT = 'flowbie_wp_reset_robots_txt';

	public static function handle_save_robots_txt(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage robots.txt.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_ROBOTS_TXT, 'flowbie_wp_robots_txt_nonce' );

		Flowbie_Wp_Robots_Txt::save_content(
			isset( $_POST['flowbie_robots_txt_content'] ) ? wp_unslash( (string) $_POST['flowbie_robots_txt_content'] ) : ''
		);

		self::set_flash(
			array(
				'kind'    => 'robots-txt',
				'success' => true,
				'message' => __( 'robots.txt saved.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_robots_txt();
	}

	public static function handle_reset_robots_txt(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage robots.txt.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_RESET_ROBOTS_TXT, 'flowbie_wp_robots_txt_reset_nonce' );

		Flowbie_Wp_Robots_Txt::reset_settings();

		self::set_flash(
			array(
				'kind'    => 'robots-txt',
				'success' => true,
				'message' => __( 'robots.txt reset to WordPress defaults.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_robots_txt();
	}

	private static function redirect_to_robots_txt(): void {
		wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-robots-txt' ) );
		exit;
	}
}
