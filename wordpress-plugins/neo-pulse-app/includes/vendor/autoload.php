<?php
/**
 * Minimal PSR-4 autoloader for vendored phpseclib3.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

spl_autoload_register(
	static function ( string $class ): void {
		if ( strncmp( $class, 'phpseclib3\\', 11 ) !== 0 ) {
			return;
		}
		$rel  = str_replace( '\\', '/', substr( $class, 11 ) );
		$file = __DIR__ . '/phpseclib/' . $rel . '.php';
		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}
);
