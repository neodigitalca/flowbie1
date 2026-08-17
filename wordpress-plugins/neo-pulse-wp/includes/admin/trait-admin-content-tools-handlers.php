<?php
/**
 * Content type switch and duplicate admin POST handlers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Content_Tools_Handlers {

	const ACTION_SWITCH_POST_TYPE = 'neo_pulse_wp_switch_post_type';
	const ACTION_DUPLICATE_POST   = 'neo_pulse_wp_duplicate_post';

	public static function register_content_tools_handlers(): void {
		add_action( 'admin_post_' . self::ACTION_SWITCH_POST_TYPE, array( __CLASS__, 'handle_switch_post_type' ) );
		add_action( 'admin_post_' . self::ACTION_DUPLICATE_POST, array( __CLASS__, 'handle_duplicate_post' ) );
		add_action( 'save_post', array( __CLASS__, 'save_bulk_edit_content_type' ), 10, 2 );
	}

	/**
	 * @param int     $post_id Post ID.
	 * @param WP_Post $post    Post object.
	 */
	public static function save_bulk_edit_content_type( int $post_id, WP_Post $post ): void {
		if ( ! isset( $_REQUEST['neo-pulse_new_post_type'] ) ) {
			return;
		}
		if ( ! isset( $_REQUEST['_inline_edit'] ) && empty( $_REQUEST['bulk_edit'] ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		$new_type = sanitize_key( wp_unslash( (string) $_REQUEST['neo-pulse_new_post_type'] ) );
		if ( $new_type === '' || $new_type === '-1' ) {
			return;
		}

		Neo_Pulse_Wp_Content_Tools::switch_post_type( $post_id, $new_type );
	}

	public static function handle_switch_post_type(): void {
		check_admin_referer( self::ACTION_SWITCH_POST_TYPE, 'neo-pulse_content_tools_nonce' );

		$post_id   = isset( $_REQUEST['post_id'] ) ? (int) $_REQUEST['post_id'] : 0;
		$new_type  = isset( $_REQUEST['new_post_type'] ) ? sanitize_key( wp_unslash( (string) $_REQUEST['new_post_type'] ) ) : '';
		$redirect  = isset( $_REQUEST['redirect_to'] ) ? esc_url_raw( wp_unslash( (string) $_REQUEST['redirect_to'] ) ) : '';
		$fallback  = $post_id > 0 ? get_edit_post_link( $post_id, 'raw' ) : admin_url( 'edit.php' );

		$result = $post_id > 0 ? Neo_Pulse_Wp_Content_Tools::switch_post_type( $post_id, $new_type ) : new WP_Error( 'neo-pulse_missing_post', '' );
		if ( is_wp_error( $result ) ) {
			wp_safe_redirect( $redirect !== '' ? $redirect : ( is_string( $fallback ) ? $fallback : admin_url( 'edit.php' ) ) );
			exit;
		}

		$edit_url = get_edit_post_link( (int) $result, 'raw' );
		wp_safe_redirect( is_string( $edit_url ) ? $edit_url : admin_url( 'edit.php' ) );
		exit;
	}

	public static function handle_duplicate_post(): void {
		check_admin_referer( self::ACTION_DUPLICATE_POST, 'neo-pulse_content_tools_nonce' );

		$post_id  = isset( $_REQUEST['post_id'] ) ? (int) $_REQUEST['post_id'] : 0;
		$redirect = isset( $_REQUEST['redirect_to'] ) ? esc_url_raw( wp_unslash( (string) $_REQUEST['redirect_to'] ) ) : '';
		$post     = $post_id > 0 ? get_post( $post_id ) : null;
		$fallback = $post instanceof WP_Post
			? admin_url( 'edit.php?post_type=' . $post->post_type )
			: admin_url( 'edit.php' );

		$result = $post_id > 0 ? Neo_Pulse_Wp_Content_Tools::duplicate_post( $post_id ) : new WP_Error( 'neo-pulse_missing_post', '' );
		if ( is_wp_error( $result ) ) {
			wp_safe_redirect( $redirect !== '' ? $redirect : $fallback );
			exit;
		}

		$edit_url = get_edit_post_link( (int) $result, 'raw' );
		wp_safe_redirect( is_string( $edit_url ) ? $edit_url : $fallback );
		exit;
	}
}
