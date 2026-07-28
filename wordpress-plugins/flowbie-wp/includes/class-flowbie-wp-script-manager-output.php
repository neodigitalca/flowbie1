<?php
/**
 * Front-end script injection for Script Manager.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Script_Manager_Output {

	public static function init(): void {
		add_action( 'wp_head', array( __CLASS__, 'render_header' ), 99 );
		add_action( 'wp_body_open', array( __CLASS__, 'render_body' ), 1 );
		add_action( 'wp_footer', array( __CLASS__, 'render_footer' ), 99 );
	}

	public static function should_skip_output(): bool {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || is_feed() ) {
			return true;
		}
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return true;
		}
		$settings = Flowbie_Wp_Script_Manager::get_settings();
		if ( is_customize_preview() && empty( $settings['customizer_preview'] ) ) {
			return true;
		}
		return false;
	}

	public static function render_header(): void {
		self::render_placement( 'header' );
	}

	public static function render_body(): void {
		self::render_placement( 'body' );
	}

	public static function render_footer(): void {
		self::render_placement( 'footer' );
	}

	private static function render_placement( string $placement ): void {
		if ( self::should_skip_output() ) {
			return;
		}

		$rows = Flowbie_Wp_Script_Manager::get_active_for_placement( $placement );
		foreach ( $rows as $row ) {
			$rules = Flowbie_Wp_Script_Manager_Rules::decode( isset( $row->display_rules ) ? (string) $row->display_rules : '' );
			if ( ! Flowbie_Wp_Script_Manager_Rules::matches_current_request( $rules ) ) {
				continue;
			}
			$code = isset( $row->code ) ? (string) $row->code : '';
			if ( trim( $code ) === '' ) {
				continue;
			}
			/**
			 * @param string $code Script HTML/JS.
			 * @param object $row  Script row.
			 */
			$code = apply_filters( 'flowbie_wp_script_manager_render_code', $code, $row );
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Intentional raw HTML/JS for trusted admins.
			echo "\n" . $code . "\n";
		}
	}
}
