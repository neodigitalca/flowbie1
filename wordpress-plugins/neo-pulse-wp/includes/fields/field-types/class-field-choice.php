<?php
/**
 * Choice field types.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Field_Type_Select extends Neo_Pulse_Wp_Field_Type_Base {

	public function type(): string {
		return 'select';
	}

	public function label(): string {
		return __( 'Select', 'neo-pulse-wp' );
	}

	public function defaults(): array {
		return array(
			'choices'       => array(),
			'default_value' => '',
			'allow_null'    => 0,
			'multiple'      => 0,
			'ui'            => 0,
			'return_format' => 'value',
		);
	}

	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		$choices  = isset( $field['choices'] ) && is_array( $field['choices'] ) ? $field['choices'] : array();
		$multiple = ! empty( $field['multiple'] );
		printf(
			'<select id="%1$s" name="%2$s%3$s">',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			$multiple ? '[]' : ''
		);
		if ( ! empty( $field['allow_null'] ) ) {
			echo '<option value="">' . esc_html__( '- Select -', 'neo-pulse-wp' ) . '</option>';
		}
		$selected = $multiple ? (array) $value : array( (string) $value );
		foreach ( $choices as $k => $label ) {
			printf(
				'<option value="%1$s" %2$s>%3$s</option>',
				esc_attr( (string) $k ),
				selected( true, in_array( (string) $k, array_map( 'strval', $selected ), true ), false ),
				esc_html( (string) $label )
			);
		}
		echo '</select>';
		$this->wrap_close( $field );
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $post_id );
		if ( ! empty( $field['multiple'] ) ) {
			return is_array( $value ) ? array_map( 'sanitize_text_field', $value ) : array();
		}
		return sanitize_text_field( is_scalar( $value ) ? (string) $value : '' );
	}
}

class Neo_Pulse_Wp_Field_Type_Checkbox extends Neo_Pulse_Wp_Field_Type_Base {

	public function type(): string {
		return 'checkbox';
	}

	public function label(): string {
		return __( 'Checkbox', 'neo-pulse-wp' );
	}

	public function defaults(): array {
		return array( 'choices' => array(), 'layout' => 'vertical', 'return_format' => 'value' );
	}

	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		$choices  = isset( $field['choices'] ) && is_array( $field['choices'] ) ? $field['choices'] : array();
		$selected = is_array( $value ) ? $value : array();
		echo '<ul class="neo-pulse-checkbox-list">';
		foreach ( $choices as $k => $label ) {
			printf(
				'<li><label><input type="checkbox" name="%1$s[]" value="%2$s" %3$s /> %4$s</label></li>',
				esc_attr( $this->field_name( $field ) ),
				esc_attr( (string) $k ),
				checked( in_array( (string) $k, array_map( 'strval', $selected ), true ), true, false ),
				esc_html( (string) $label )
			);
		}
		echo '</ul>';
		$this->wrap_close( $field );
	}

	public function load_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_array( $value ) ? $value : ( $value === '' ? array() : array( (string) $value ) );
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_array( $value ) ? array_map( 'sanitize_text_field', $value ) : array();
	}
}

class Neo_Pulse_Wp_Field_Type_Radio extends Neo_Pulse_Wp_Field_Type_Base {

	public function type(): string {
		return 'radio';
	}

	public function label(): string {
		return __( 'Radio Button', 'neo-pulse-wp' );
	}

	public function defaults(): array {
		return array( 'choices' => array(), 'layout' => 'vertical', 'return_format' => 'value' );
	}

	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		$choices = isset( $field['choices'] ) && is_array( $field['choices'] ) ? $field['choices'] : array();
		echo '<ul class="neo-pulse-radio-list">';
		foreach ( $choices as $k => $label ) {
			printf(
				'<li><label><input type="radio" name="%1$s" value="%2$s" %3$s /> %4$s</label></li>',
				esc_attr( $this->field_name( $field ) ),
				esc_attr( (string) $k ),
				checked( (string) $value, (string) $k, false ),
				esc_html( (string) $label )
			);
		}
		echo '</ul>';
		$this->wrap_close( $field );
	}
}

class Neo_Pulse_Wp_Field_Type_True_False extends Neo_Pulse_Wp_Field_Type_Base {

	public function type(): string {
		return 'true_false';
	}

	public function label(): string {
		return __( 'True / False', 'neo-pulse-wp' );
	}

	public function defaults(): array {
		return array( 'default_value' => 0, 'ui' => 0, 'message' => '' );
	}

	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<label><input type="hidden" name="%1$s" value="0" /><input type="checkbox" id="%2$s" name="%1$s" value="1" %3$s /> %4$s</label>',
			esc_attr( $this->field_name( $field ) ),
			esc_attr( $this->field_id( $field ) ),
			checked( ! empty( $value ), true, false ),
			esc_html( (string) ( $field['message'] ?? '' ) )
		);
		$this->wrap_close( $field );
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return ! empty( $value ) ? 1 : 0;
	}

	public function format_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return (bool) $value;
	}
}
