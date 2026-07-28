<?php
/**
 * Eligibility checks for Image SEO (OpenRouter only, no Flowbie API).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Image_Seo_Gate {

	/**
	 * @return array<int,string>
	 */
	public static function collect_reasons( int $post_id = 0, bool $require_ai = false ): array {
		$reasons = array();

		if ( $post_id > 0 ) {
			if ( ! current_user_can( 'edit_post', $post_id ) ) {
				$reasons[] = __( 'You do not have permission to edit this post.', 'flowbie-wp' );
			}
		} elseif ( ! current_user_can( 'upload_files' ) ) {
			$reasons[] = __( 'You do not have permission to manage media.', 'flowbie-wp' );
		}

		if ( $require_ai && Flowbie_Wp_OpenRouter::get_api_key() === '' ) {
			$reasons[] = __( 'Add an OpenRouter API key under Flowbie WP → Settings → Editor AI.', 'flowbie-wp' );
		}

		return $reasons;
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function get_status(): array {
		$reasons = self::collect_reasons( 0, false );
		$ai_ok   = Flowbie_Wp_OpenRouter::get_api_key() !== '';

		return array(
			'ok'                   => empty( $reasons ),
			'openRouterConfigured' => $ai_ok,
			'config'               => Flowbie_Wp_Image_Seo::get_config(),
			'reasons'              => $reasons,
			'aiReasons'            => self::collect_reasons( 0, true ),
		);
	}

	public static function can_list(): bool {
		return empty( self::collect_reasons( 0, false ) );
	}

	public static function can_ai( int $post_id = 0 ): bool {
		return empty( self::collect_reasons( $post_id, true ) );
	}

	/**
	 * @param int $attachment_id
	 * @param int $post_id
	 * @return bool|\WP_Error
	 */
	public static function can_edit_attachment( int $attachment_id, int $post_id = 0 ) {
		if ( $attachment_id < 1 ) {
			return new WP_Error( 'flowbie_attachment', __( 'Invalid attachment.', 'flowbie-wp' ) );
		}
		$post = get_post( $attachment_id );
		if ( ! $post instanceof WP_Post || $post->post_type !== 'attachment' ) {
			return new WP_Error( 'flowbie_attachment', __( 'Attachment not found.', 'flowbie-wp' ) );
		}
		if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
			return new WP_Error( 'flowbie_forbidden', __( 'You do not have permission to edit this attachment.', 'flowbie-wp' ), array( 'status' => 403 ) );
		}
		if ( $post_id > 0 && ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error( 'flowbie_forbidden', __( 'You do not have permission to edit this post.', 'flowbie-wp' ), array( 'status' => 403 ) );
		}
		return true;
	}
}
