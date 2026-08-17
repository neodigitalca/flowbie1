<?php
/**
 * Basic field validation on save.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Validation {

	/**
	 * @param array<string, mixed> $field Field config.
	 * @param mixed                $value Submitted value.
	 * @return true|WP_Error
	 */
	public static function validate( array $field, $value ) {
		if ( empty( $field['required'] ) ) {
			return true;
		}
		$empty = $value === null || $value === '' || $value === array();
		if ( $empty ) {
			$label = (string) ( $field['label'] ?? $field['name'] ?? 'Field' );
			return new WP_Error(
				'neo-pulse_field_required',
				sprintf(
					/* translators: %s field label */
					__( '%s is required.', 'neo-pulse-wp' ),
					$label
				)
			);
		}
		return true;
	}
}
