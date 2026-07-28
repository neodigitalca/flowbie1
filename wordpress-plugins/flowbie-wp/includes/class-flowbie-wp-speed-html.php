<?php
/**
 * HTML output processor orchestrator.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Runs asset optimization then optional HTML minify on buffered output.
 */
class Flowbie_Wp_Speed_Html {

	/**
	 * @param string $html Buffered document HTML.
	 * @param array<string, mixed> $config Settings.
	 */
	public static function process( string $html, array $config ): string {
		if ( ! Flowbie_Wp_Speed_Gate::is_valid_html_document( $html ) ) {
			return $html;
		}

		$config = Flowbie_Wp_Speed_Gate::config_for_html( $config, $html );
		$html   = Flowbie_Wp_Speed_Front::process( $html, $config );
		$html   = Flowbie_Wp_Speed_Assets::process( $html, $config );

		if ( ! empty( $config['minify_html'] ) && ! Flowbie_Wp_Speed_Gate::html_uses_elementor( $html ) ) {
			$html = Flowbie_Wp_Speed_Minify::html( $html );
		}

		return $html;
	}
}
