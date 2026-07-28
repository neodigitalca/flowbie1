<?php
/**
 * Search settings admin_post handlers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Search {

	const ACTION_SAVE_SEARCH  = 'flowbie_wp_save_search';
	const ACTION_RESET_SEARCH = 'flowbie_wp_reset_search';

	public static function handle_save_search(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save search settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_SEARCH, 'flowbie_wp_search_nonce' );

		$raw = isset( $_POST['flowbie_search'] ) ? (array) wp_unslash( $_POST['flowbie_search'] ) : array();
		$tab = isset( $_POST['flowbie_search_tab'] ) ? sanitize_key( wp_unslash( $_POST['flowbie_search_tab'] ) ) : 'general';

		$data = array();

		if ( $tab === 'general' ) {
			if ( isset( $raw['placeholder'] ) ) {
				$data['placeholder'] = (string) $raw['placeholder'];
			}
			if ( isset( $raw['button_label'] ) ) {
				$data['button_label'] = (string) $raw['button_label'];
			}
			if ( isset( $raw['max_results'] ) ) {
				$data['max_results'] = (int) $raw['max_results'];
			}
			$data['post_types'] = isset( $raw['post_types'] ) && is_array( $raw['post_types'] )
				? $raw['post_types']
				: array( 'post', 'page' );
			if ( isset( $raw['content_type_labels'] ) && is_array( $raw['content_type_labels'] ) ) {
				$data['content_type_labels'] = $raw['content_type_labels'];
			}
			$data['auto_front_page'] = ! empty( $raw['auto_front_page'] );
		}

		if ( $tab === 'appearance' ) {
			$raw_design = isset( $_POST['flowbie_design'] ) ? (array) wp_unslash( $_POST['flowbie_design'] ) : array();
			Flowbie_Wp_Ai_Widget_Design::save_from_admin_post( $raw_design, 'search' );

			$tokens = Flowbie_Wp_Ai_Widget_Design::editable_tokens( 'search' );
			$data['primary_color'] = (string) ( $tokens['accent'] ?? '#3b82f6' );
			$data['bg_color']      = (string) ( $tokens['bg'] ?? '#ffffff' );
			$data['border_radius'] = (int) ( $tokens['radius'] ?? 8 );
			$data['font_size']     = (int) ( $tokens['font_size'] ?? 16 );
		}

		if ( ! empty( $data ) ) {
			Flowbie_Wp_Search::save_search_settings( $data );
		}

		self::set_flash(
			array(
				'kind'    => 'search',
				'success' => true,
				'message' => __( 'Search settings saved. Flowbie Speed cache was cleared; purge WP Engine or CDN page cache if guests still see an old search bar.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_search( $tab );
	}

	public static function handle_reset_search(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to reset search settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_RESET_SEARCH, 'flowbie_wp_search_reset_nonce' );

		$tab = isset( $_POST['flowbie_search_tab'] ) ? sanitize_key( wp_unslash( $_POST['flowbie_search_tab'] ) ) : 'general';

		Flowbie_Wp_Search::reset_search_settings();
		Flowbie_Wp_Search::purge_public_caches();

		self::set_flash(
			array(
				'kind'    => 'search',
				'success' => true,
				'message' => __( 'Search settings reset to defaults. Purge your host page cache so guests see the update.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_search( $tab );
	}
}
