<?php
/**
 * Speed → Images tab admin_post handlers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Handlers_Speed_Images {

	const ACTION_SAVE_SPEED_IMAGES = 'neo_pulse_wp_save_speed_images';

	const ACTION_FLUSH_SPEED_IMAGE_META = 'neo_pulse_wp_flush_speed_image_meta';

	public static function handle_save_speed_images(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed image settings.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_SPEED_IMAGES, 'neo_pulse_wp_speed_images_nonce' );

		$config = self::speed_image_config_from_post();
		Neo_Pulse_Wp_Speed_Image_Settings::save_config( $config );

		self::set_flash(
			array(
				'kind'    => 'speed',
				'success' => true,
				'message' => __( 'Image optimization settings saved.', 'neo-pulse-wp' ),
			)
		);
		self::redirect_to_speed_images();
	}

	public static function handle_flush_speed_image_meta(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed image settings.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_FLUSH_SPEED_IMAGE_META, 'neo_pulse_wp_speed_images_flush_nonce' );

		Neo_Pulse_Wp_Speed_Image_Optimizer::flush_all_meta();

		self::set_flash(
			array(
				'kind'    => 'speed',
				'success' => true,
				'message' => __( 'Image optimization metadata cleared. Media files on disk were not deleted.', 'neo-pulse-wp' ),
			)
		);
		self::redirect_to_speed_images();
	}

	private static function redirect_to_speed_images(): void {
		wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-speed&tab=images' ) );
		exit;
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function speed_image_config_from_post(): array {
		$existing = Neo_Pulse_Wp_Speed_Image_Settings::get_config();

		$config = array(
			'enabled'         => ! empty( $_POST['neo-pulse_speed_image_enabled'] ),
			'auto_on_upload'  => ! empty( $_POST['neo-pulse_speed_image_auto_on_upload'] ),
			'jpeg_quality'    => isset( $_POST['neo-pulse_speed_image_jpeg_quality'] ) ? (int) wp_unslash( $_POST['neo-pulse_speed_image_jpeg_quality'] ) : $existing['jpeg_quality'],
			'png_compression' => isset( $_POST['neo-pulse_speed_image_png_compression'] ) ? (int) wp_unslash( $_POST['neo-pulse_speed_image_png_compression'] ) : $existing['png_compression'],
			'max_width'       => isset( $_POST['neo-pulse_speed_image_max_width'] ) ? (int) wp_unslash( $_POST['neo-pulse_speed_image_max_width'] ) : $existing['max_width'],
			'max_height'      => isset( $_POST['neo-pulse_speed_image_max_height'] ) ? (int) wp_unslash( $_POST['neo-pulse_speed_image_max_height'] ) : $existing['max_height'],
			'generate_webp'   => ! empty( $_POST['neo-pulse_speed_image_generate_webp'] ),
			'serve_webp'      => ! empty( $_POST['neo-pulse_speed_image_serve_webp'] ),
			'optimize_sizes'  => isset( $_POST['neo-pulse_speed_image_optimize_sizes'] ) ? sanitize_key( wp_unslash( (string) $_POST['neo-pulse_speed_image_optimize_sizes'] ) ) : $existing['optimize_sizes'],
			'max_file_mb'     => isset( $_POST['neo-pulse_speed_image_max_file_mb'] ) ? (int) wp_unslash( $_POST['neo-pulse_speed_image_max_file_mb'] ) : $existing['max_file_mb'],
			'skip_mimes'      => isset( $_POST['neo-pulse_speed_image_skip_mimes'] ) ? wp_unslash( (string) $_POST['neo-pulse_speed_image_skip_mimes'] ) : $existing['skip_mimes'],
		);

		if ( ! Neo_Pulse_Wp_Speed_Image_Settings::supports_webp_editor() ) {
			$config['generate_webp'] = false;
			$config['serve_webp']    = false;
		}

		return $config;
	}
}
