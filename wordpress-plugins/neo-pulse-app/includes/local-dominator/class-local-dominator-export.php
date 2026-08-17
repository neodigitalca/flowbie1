<?php
/**
 * Local Dominator grid CSV export (worker stub until Render is wired).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Local_Dominator_Export {

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array<string,mixed>
	 */
	public static function export_grid( array $body ): array {
		unset( $body );

		return array(
			'ok'    => false,
			'error' => 'Local Dominator export worker is not configured.',
			'code'  => 'LD_EXPORT_WORKER_NOT_CONFIGURED',
		);
	}
}
