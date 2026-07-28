<?php
/**
 * Speed image optimization module bootstrap.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Hooks upload optimization and delivery filters.
 */
class Flowbie_Wp_Speed_Images {

	/**
	 * Hook registrations.
	 */
	public static function init(): void {
		add_action( 'add_attachment', array( __CLASS__, 'maybe_optimize_on_upload' ), 120, 1 );
		Flowbie_Wp_Speed_Image_Delivery::init();
		Flowbie_Wp_Speed_Image_Rest::init();
	}

	/**
	 * @param int $attachment_id Attachment ID.
	 */
	public static function maybe_optimize_on_upload( int $attachment_id ): void {
		$config = Flowbie_Wp_Speed_Image_Settings::get_config();
		if ( empty( $config['enabled'] ) || empty( $config['auto_on_upload'] ) ) {
			return;
		}

		if ( wp_doing_cron() && ! apply_filters( 'flowbie_wp_speed_image_optimize_on_cron', false ) ) {
			return;
		}

		Flowbie_Wp_Speed_Image_Optimizer::optimize_attachment( $attachment_id, false );
	}

	/**
	 * @return bool
	 */
	public static function is_active(): bool {
		return Flowbie_Wp_Speed_Image_Settings::is_enabled();
	}
}
