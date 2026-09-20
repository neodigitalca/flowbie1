<?php
/**
 * Output buffer for Speed module.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Captures front-end HTML and runs optimization.
 */
class Neo_Pulse_Wp_Speed_Buffer {

	/** @var bool */
	private static $started = false;

	/** @var bool */
	private static $lcp_started = false;

	public static function maybe_start(): void {
		if ( self::$started || ! Neo_Pulse_Wp_Speed_Gate::should_optimize() ) {
			return;
		}
		self::$started = true;
		ob_start( array( __CLASS__, 'filter_output' ) );
	}

	/**
	 * Start early so this callback runs after NitroPack and can un-lazy the LCP.
	 */
	public static function maybe_start_lcp(): void {
		if ( self::$lcp_started || ! Neo_Pulse_Wp_Speed_Gate::should_optimize() ) {
			return;
		}
		self::$lcp_started = true;
		ob_start( array( __CLASS__, 'filter_lcp_output' ) );
	}

	/**
	 * @param string $html Buffered output.
	 */
	public static function filter_output( string $html ): string {
		$config = Neo_Pulse_Wp_Speed_Settings::get_config();
		return Neo_Pulse_Wp_Speed_Html::process( $html, $config );
	}

	/**
	 * @param string $html Buffered output.
	 */
	public static function filter_lcp_output( string $html ): string {
		if ( ! Neo_Pulse_Wp_Speed_Gate::is_valid_html_document( $html ) ) {
			return $html;
		}
		return Neo_Pulse_Wp_Speed_Front::preload_lcp_image( $html );
	}
}
