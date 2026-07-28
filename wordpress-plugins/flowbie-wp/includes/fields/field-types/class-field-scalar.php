<?php
/**
 * Scalar field types.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Field_Type_Text extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'text'; }
	public function label(): string { return __( 'Text', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'default_value' => '', 'maxlength' => '', 'placeholder' => '' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="text" class="widefat" id="%1$s" name="%2$s" value="%3$s" placeholder="%4$s" maxlength="%5$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) ? (string) $value : '' ),
			esc_attr( (string) ( $field['placeholder'] ?? '' ) ),
			esc_attr( (string) ( $field['maxlength'] ?? '' ) )
		);
		$this->wrap_close( $field );
	}
	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return sanitize_text_field( is_scalar( $value ) ? (string) $value : '' );
	}
}

class Flowbie_Wp_Field_Type_Textarea extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'textarea'; }
	public function label(): string { return __( 'Textarea', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'default_value' => '', 'rows' => 4, 'new_lines' => '' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<textarea class="widefat" id="%1$s" name="%2$s" rows="%3$d" placeholder="%4$s">%5$s</textarea>',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			max( 2, (int) ( $field['rows'] ?? 4 ) ),
			esc_attr( (string) ( $field['placeholder'] ?? '' ) ),
			esc_textarea( is_scalar( $value ) ? (string) $value : '' )
		);
		$this->wrap_close( $field );
	}
	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return sanitize_textarea_field( is_scalar( $value ) ? (string) $value : '' );
	}
}

class Flowbie_Wp_Field_Type_Number extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'number'; }
	public function label(): string { return __( 'Number', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'default_value' => '', 'min' => '', 'max' => '', 'step' => '' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="number" class="widefat" id="%1$s" name="%2$s" value="%3$s" min="%4$s" max="%5$s" step="%6$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) ? (string) $value : '' ),
			esc_attr( (string) ( $field['min'] ?? '' ) ),
			esc_attr( (string) ( $field['max'] ?? '' ) ),
			esc_attr( (string) ( $field['step'] ?? '' ) )
		);
		$this->wrap_close( $field );
	}
	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_numeric( $value ) ? 0 + $value : '';
	}
}

class Flowbie_Wp_Field_Type_Email extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'email'; }
	public function label(): string { return __( 'Email', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'default_value' => '', 'placeholder' => '' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="email" class="widefat" id="%1$s" name="%2$s" value="%3$s" placeholder="%4$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) ? (string) $value : '' ),
			esc_attr( (string) ( $field['placeholder'] ?? '' ) )
		);
		$this->wrap_close( $field );
	}
	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return sanitize_email( is_scalar( $value ) ? (string) $value : '' );
	}
}

class Flowbie_Wp_Field_Type_Url extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'url'; }
	public function label(): string { return __( 'URL', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'default_value' => '', 'placeholder' => '' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="url" class="widefat" id="%1$s" name="%2$s" value="%3$s" placeholder="%4$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) ? (string) $value : '' ),
			esc_attr( (string) ( $field['placeholder'] ?? '' ) )
		);
		$this->wrap_close( $field );
	}
	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return esc_url_raw( is_scalar( $value ) ? (string) $value : '' );
	}
}

class Flowbie_Wp_Field_Type_Password extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'password'; }
	public function label(): string { return __( 'Password', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'default_value' => '', 'placeholder' => '' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="password" id="%1$s" name="%2$s" value="%3$s" autocomplete="new-password" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) ? (string) $value : '' )
		);
		$this->wrap_close( $field );
	}
}

class Flowbie_Wp_Field_Type_Range extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'range'; }
	public function label(): string { return __( 'Range', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'default_value' => '', 'min' => 0, 'max' => 100, 'step' => 1 ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="range" id="%1$s" name="%2$s" value="%3$s" min="%4$s" max="%5$s" step="%6$s" /> <output>%3$s</output>',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) ? (string) $value : (string) ( $field['default_value'] ?? 0 ) ),
			esc_attr( (string) ( $field['min'] ?? 0 ) ),
			esc_attr( (string) ( $field['max'] ?? 100 ) ),
			esc_attr( (string) ( $field['step'] ?? 1 ) )
		);
		$this->wrap_close( $field );
	}
}
