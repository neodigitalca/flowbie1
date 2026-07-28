<?php
/**
 * Output buffer for Speed module.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Captures front-end HTML and runs optimization.
 */
class Flowbie_Wp_Speed_Buffer {

	/** @var bool */
	private static $started = false;

	public static function maybe_start(): void {
		if ( self::$started || ! Flowbie_Wp_Speed_Gate::should_optimize() ) {
			return;
		}
		self::$started = true;
		ob_start( array( __CLASS__, 'filter_output' ) );
	}

	/**
	 * @param string $html Buffered output.
	 */
	public static function filter_output( string $html ): string {
		$config = Flowbie_Wp_Speed_Settings::get_config();
		return Flowbie_Wp_Speed_Html::process( $html, $config );
	}
}
