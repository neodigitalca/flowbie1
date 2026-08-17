<?php
/**
 * Front-end WebP / optimized sidecar delivery.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Rewrites image URLs when sidecars exist.
 */
class Neo_Pulse_Wp_Speed_Image_Delivery {

	/**
	 * Hook registrations.
	 */
	public static function init(): void {
		add_filter( 'wp_get_attachment_image_src', array( __CLASS__, 'filter_attachment_image_src' ), 20, 4 );
		if ( function_exists( 'wp_content_img_tag' ) ) {
			add_filter( 'wp_content_img_tag', array( __CLASS__, 'filter_content_img_tag' ), 20, 3 );
		}
	}

	/**
	 * @param array|false  $image         Image data.
	 * @param int          $attachment_id Attachment ID.
	 * @param string|int[] $size          Size.
	 * @param bool         $icon          Icon.
	 * @return array|false
	 */
	public static function filter_attachment_image_src( $image, int $attachment_id, $size, bool $icon ) {
		unset( $size, $icon );
		if ( ! is_array( $image ) || empty( $image[0] ) ) {
			return $image;
		}

		$replacement = self::best_url_for_attachment( $attachment_id, 'full' );
		if ( $replacement !== null ) {
			$image[0] = $replacement;
		}

		return $image;
	}

	/**
	 * @param string $filtered_image Full img tag.
	 * @param string $context        Context.
	 * @param int    $attachment_id  Attachment ID.
	 */
	public static function filter_content_img_tag( string $filtered_image, string $context, int $attachment_id ): string {
		unset( $context );
		if ( $attachment_id < 1 || ! self::should_serve_webp() ) {
			return $filtered_image;
		}

		$url = self::best_url_for_attachment( $attachment_id, 'full' );
		if ( $url === null ) {
			return $filtered_image;
		}

		return preg_replace(
			'/(\ssrc=["\'])([^"\']+)(["\'])/i',
			'$1' . esc_url( $url ) . '$3',
			$filtered_image,
			1
		) ?? $filtered_image;
	}

	/**
	 * @return bool
	 */
	public static function should_serve_webp(): bool {
		$config = Neo_Pulse_Wp_Speed_Image_Settings::get_config();
		if ( empty( $config['enabled'] ) || empty( $config['serve_webp'] ) ) {
			return false;
		}
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
			return false;
		}
		return self::client_accepts_webp();
	}

	/**
	 * @return bool
	 */
	public static function client_accepts_webp(): bool {
		if ( empty( $_SERVER['HTTP_ACCEPT'] ) ) {
			return false;
		}
		$accept = strtolower( (string) wp_unslash( $_SERVER['HTTP_ACCEPT'] ) );
		return strpos( $accept, 'image/webp' ) !== false;
	}

	/**
	 * @param int    $attachment_id Attachment ID.
	 * @param string $size_key      Size key in meta.
	 */
	public static function best_url_for_attachment( int $attachment_id, string $size_key = 'full' ): ?string {
		if ( ! self::should_serve_webp() && ! Neo_Pulse_Wp_Speed_Image_Settings::is_enabled() ) {
			return null;
		}

		$meta = Neo_Pulse_Wp_Speed_Image_Optimizer::get_meta( $attachment_id );
		if ( $meta === null || empty( $meta['sizes'][ $size_key ] ) || ! is_array( $meta['sizes'][ $size_key ] ) ) {
			return null;
		}

		$size = $meta['sizes'][ $size_key ];

		if ( self::should_serve_webp() && ! empty( $size['webp_path'] ) && is_readable( (string) $size['webp_path'] ) ) {
			return self::path_to_url( (string) $size['webp_path'] );
		}

		if ( ! empty( $size['optimized_path'] ) && is_readable( (string) $size['optimized_path'] ) ) {
			return self::path_to_url( (string) $size['optimized_path'] );
		}

		return null;
	}

	/**
	 * @param string $path Absolute path under uploads.
	 */
	public static function path_to_url( string $path ): ?string {
		$upload = wp_get_upload_dir();
		$basedir = isset( $upload['basedir'] ) ? wp_normalize_path( $upload['basedir'] ) : '';
		$baseurl = isset( $upload['baseurl'] ) ? $upload['baseurl'] : '';
		if ( $basedir === '' || $baseurl === '' ) {
			return null;
		}
		$path = wp_normalize_path( $path );
		if ( 0 !== strpos( $path, $basedir ) ) {
			return null;
		}
		$rel = ltrim( substr( $path, strlen( $basedir ) ), '/' );
		return trailingslashit( $baseurl ) . str_replace( '\\', '/', $rel );
	}
}
