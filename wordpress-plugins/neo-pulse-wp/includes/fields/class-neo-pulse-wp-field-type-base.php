<?php
/**
 * Shared field type helpers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

abstract class Neo_Pulse_Wp_Field_Type_Base implements Neo_Pulse_Wp_Field_Type_Interface {

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	protected function field_id( array $field ): string {
		return 'neo-pulse-field-' . sanitize_key( (string) ( $field['key'] ?? $field['name'] ?? 'field' ) );
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	protected function field_name( array $field ): string {
		return 'neo_pulse_fields[' . esc_attr( (string) ( $field['name'] ?? '' ) ) . ']';
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	protected function wrap_open( array $field ): void {
		$name = esc_attr( (string) ( $field['name'] ?? '' ) );
		$type = esc_attr( (string) ( $field['type'] ?? '' ) );
		$key  = esc_attr( (string) ( $field['key'] ?? '' ) );
		$req  = ! empty( $field['required'] ) ? ' is-required' : '';
		echo '<div class="acf-field acf-field-' . esc_attr( $type ) . $req . '" data-name="' . $name . '" data-type="' . $type . '" data-key="' . $key . '">';
		echo '<div class="acf-label">';
		echo '<label for="' . esc_attr( $this->field_id( $field ) ) . '">' . esc_html( (string) ( $field['label'] ?? '' ) );
		if ( ! empty( $field['required'] ) ) {
			echo ' <span class="acf-required">*</span>';
		}
		echo '</label>';
		if ( ! empty( $field['instructions'] ) ) {
			echo '<p class="description">' . esc_html( (string) $field['instructions'] ) . '</p>';
		}
		echo '</div><div class="acf-input">';
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	protected function wrap_close( array $field ): void {
		unset( $field );
		echo '</div></div>';
	}

	public function load_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return $value;
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return $value;
	}

	public function format_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return $value;
	}
}
