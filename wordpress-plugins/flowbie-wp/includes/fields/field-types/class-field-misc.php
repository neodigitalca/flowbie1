<?php
/**
 * Date, color, map, oembed field types.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Field_Type_Date_Picker extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'date_picker'; }
	public function label(): string { return __( 'Date Picker', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'display_format' => 'Y-m-d', 'return_format' => 'Y-m-d' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="date" class="flowbie-date-picker" id="%1$s" name="%2$s" value="%3$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) ? (string) $value : '' )
		);
		$this->wrap_close( $field );
	}
}

class Flowbie_Wp_Field_Type_Date_Time_Picker extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'date_time_picker'; }
	public function label(): string { return __( 'Date Time Picker', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'display_format' => 'Y-m-d H:i:s', 'return_format' => 'Y-m-d H:i:s' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="datetime-local" id="%1$s" name="%2$s" value="%3$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) ? (string) $value : '' )
		);
		$this->wrap_close( $field );
	}
}

class Flowbie_Wp_Field_Type_Time_Picker extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'time_picker'; }
	public function label(): string { return __( 'Time Picker', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'display_format' => 'H:i:s', 'return_format' => 'H:i:s' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="time" id="%1$s" name="%2$s" value="%3$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) ? (string) $value : '' )
		);
		$this->wrap_close( $field );
	}
}

class Flowbie_Wp_Field_Type_Color_Picker extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'color_picker'; }
	public function label(): string { return __( 'Color Picker', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'default_value' => '' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="color" class="flowbie-color-picker" id="%1$s" name="%2$s" value="%3$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( is_scalar( $value ) && $value !== '' ? (string) $value : '#000000' )
		);
		$this->wrap_close( $field );
	}
}

class Flowbie_Wp_Field_Type_Google_Map extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'google_map'; }
	public function label(): string { return __( 'Google Map', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'center_lat' => '', 'center_lng' => '', 'zoom' => 14 ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$data = is_array( $value ) ? $value : array( 'address' => '', 'lat' => '', 'lng' => '' );
		$this->wrap_open( $field );
		$base = $this->field_name( $field );
		printf( '<p><input type="text" class="widefat flowbie-map-address" name="%1$s[address]" value="%2$s" placeholder="%3$s" /></p>',
			esc_attr( $base ), esc_attr( (string) ( $data['address'] ?? '' ) ), esc_attr__( 'Address', 'flowbie-wp' ) );
		printf( '<input type="hidden" name="%1$s[lat]" value="%2$s" class="flowbie-map-lat" />', esc_attr( $base ), esc_attr( (string) ( $data['lat'] ?? '' ) ) );
		printf( '<input type="hidden" name="%1$s[lng]" value="%2$s" class="flowbie-map-lng" />', esc_attr( $base ), esc_attr( (string) ( $data['lng'] ?? '' ) ) );
		echo '<div class="flowbie-map-canvas" style="height:200px;background:#eee;">' . esc_html__( 'Map preview', 'flowbie-wp' ) . '</div>';
		$this->wrap_close( $field );
	}
	public function load_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_array( $value ) ? $value : array( 'address' => '', 'lat' => '', 'lng' => '' );
	}
}

class Flowbie_Wp_Field_Type_Oembed extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'oembed'; }
	public function label(): string { return __( 'oEmbed', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'width' => '', 'height' => '' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		printf(
			'<input type="url" class="widefat flowbie-oembed-url" id="%1$s" name="%2$s" value="%3$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_url( is_scalar( $value ) ? (string) $value : '' )
		);
		if ( is_string( $value ) && $value !== '' ) {
			echo '<div class="flowbie-oembed-preview">' . wp_oembed_get( $value ) . '</div>';
		}
		$this->wrap_close( $field );
	}
	public function format_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_string( $value ) && $value !== '' ? wp_oembed_get( $value ) : '';
	}
}
