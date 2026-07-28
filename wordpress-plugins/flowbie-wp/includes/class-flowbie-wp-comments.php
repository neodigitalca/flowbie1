<?php
/**
 * Site-wide WordPress comments enable/disable.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Comments {

	const OPTION_KEY = 'flowbie_wp_comments_settings';

	public static function init(): void {
		if ( self::is_enabled() ) {
			return;
		}

		add_filter( 'comments_open', '__return_false', 20, 2 );
		add_filter( 'pings_open', '__return_false', 20, 2 );
		add_filter( 'comments_array', '__return_empty_array', 10, 2 );
		add_action( 'admin_init', array( __CLASS__, 'disable_admin_comments' ) );
	}

	public static function is_enabled(): bool {
		$settings = self::get_settings();
		return ! empty( $settings['enabled'] );
	}

	/**
	 * @return array{enabled:bool}
	 */
	public static function get_settings(): array {
		$defaults = array(
			'enabled' => true,
		);
		$stored = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}
		return wp_parse_args( $stored, $defaults );
	}

	/**
	 * @param array<string, mixed> $settings Settings.
	 */
	public static function save_settings( array $settings ): void {
		$current          = self::get_settings();
		$merged           = array_merge( $current, $settings );
		$merged['enabled'] = ! empty( $merged['enabled'] );
		update_option( self::OPTION_KEY, $merged, false );
	}

	public static function disable_admin_comments(): void {
		foreach ( get_post_types() as $post_type ) {
			if ( post_type_supports( $post_type, 'comments' ) ) {
				remove_post_type_support( $post_type, 'comments' );
				remove_post_type_support( $post_type, 'trackbacks' );
			}
		}
	}
}
