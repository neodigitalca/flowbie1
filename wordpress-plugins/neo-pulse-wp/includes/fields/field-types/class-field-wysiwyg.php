<?php
/**
 * WYSIWYG field type.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Field_Type_Wysiwyg extends Neo_Pulse_Wp_Field_Type_Base {

	public function type(): string {
		return 'wysiwyg';
	}

	public function label(): string {
		return __( 'WYSIWYG Editor', 'neo-pulse-wp' );
	}

	public function defaults(): array {
		return array(
			'default_value' => '',
			'tabs'          => 'all',
			'toolbar'       => 'full',
			'media_upload'  => 1,
			'delay'         => 0,
		);
	}

	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		$settings = array(
			'textarea_name' => $this->field_name( $field ),
			'editor_height' => 200,
			'media_buttons' => ! empty( $field['media_upload'] ),
			'textarea_rows' => 8,
			'teeny'         => ( $field['toolbar'] ?? 'full' ) === 'basic',
		);
		wp_editor(
			is_scalar( $value ) ? (string) $value : '',
			$this->field_id( $field ),
			$settings
		);
		$this->wrap_close( $field );
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_string( $value ) ? wp_kses_post( $value ) : '';
	}
}
