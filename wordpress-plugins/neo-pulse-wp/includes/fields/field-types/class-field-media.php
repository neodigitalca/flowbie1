<?php
/**
 * Image and file field types.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Field_Type_Image extends Neo_Pulse_Wp_Field_Type_Base {

	public function type(): string {
		return 'image';
	}

	public function label(): string {
		return __( 'Image', 'neo-pulse-wp' );
	}

	public function defaults(): array {
		return array(
			'return_format' => 'array',
			'preview_size'  => 'medium',
			'library'       => 'all',
		);
	}

	public function render_input( array $field, $value, int $post_id ): void {
		$this->wrap_open( $field );
		$id = is_numeric( $value ) ? (int) $value : 0;
		echo '<div class="neo-pulse-media-field neo-pulse-media-field--image-seo" data-type="image" data-post-id="' . esc_attr( (string) $post_id ) . '">';
		printf(
			'<input type="hidden" class="neo-pulse-media-id" id="%1$s" name="%2$s" value="%3$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( (string) $id )
		);
		echo '<div class="neo-pulse-media-preview">';
		if ( $id > 0 ) {
			echo wp_get_attachment_image( $id, 'thumbnail' );
		}
		echo '</div>';
		echo '<div class="neo-pulse-media-seo-wrap">';
		if ( $id > 0 && class_exists( 'Neo_Pulse_Wp_Image_Seo', false ) ) {
			Neo_Pulse_Wp_Image_Seo::render_attachment_seo_panel( $id, 'image' );
		}
		echo '</div>';
		echo '<button type="button" class="button neo-pulse-media-select">' . esc_html__( 'Select Image', 'neo-pulse-wp' ) . '</button> ';
		echo '<button type="button" class="button neo-pulse-media-remove">' . esc_html__( 'Remove', 'neo-pulse-wp' ) . '</button>';
		echo '</div>';
		$this->wrap_close( $field );
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_numeric( $value ) ? (int) $value : 0;
	}

	public function format_value( $value, array $field, int $post_id ) {
		unset( $post_id );
		$id = is_numeric( $value ) ? (int) $value : 0;
		if ( $id < 1 ) {
			return '';
		}
		$format = (string) ( $field['return_format'] ?? 'array' );
		if ( $format === 'url' ) {
			return wp_get_attachment_url( $id ) ?: '';
		}
		if ( $format === 'id' ) {
			return $id;
		}
		$src = wp_get_attachment_image_src( $id, 'full' );
		return array(
			'ID'  => $id,
			'id'  => $id,
			'url' => $src ? $src[0] : '',
			'alt' => get_post_meta( $id, '_wp_attachment_image_alt', true ),
		);
	}
}

class Neo_Pulse_Wp_Field_Type_File extends Neo_Pulse_Wp_Field_Type_Base {

	public function type(): string {
		return 'file';
	}

	public function label(): string {
		return __( 'File', 'neo-pulse-wp' );
	}

	public function defaults(): array {
		return array( 'return_format' => 'array', 'library' => 'all' );
	}

	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		$id = is_numeric( $value ) ? (int) $value : 0;
		echo '<div class="neo-pulse-media-field" data-type="file">';
		printf(
			'<input type="hidden" class="neo-pulse-media-id" id="%1$s" name="%2$s" value="%3$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( (string) $id )
		);
		echo '<span class="neo-pulse-media-filename">';
		if ( $id > 0 ) {
			echo esc_html( basename( get_attached_file( $id ) ?: '' ) );
		}
		echo '</span> ';
		echo '<button type="button" class="button neo-pulse-media-select">' . esc_html__( 'Select File', 'neo-pulse-wp' ) . '</button> ';
		echo '<button type="button" class="button neo-pulse-media-remove">' . esc_html__( 'Remove', 'neo-pulse-wp' ) . '</button>';
		echo '</div>';
		$this->wrap_close( $field );
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_numeric( $value ) ? (int) $value : 0;
	}

	public function format_value( $value, array $field, int $post_id ) {
		unset( $post_id );
		$id = is_numeric( $value ) ? (int) $value : 0;
		if ( $id < 1 ) {
			return '';
		}
		if ( ( $field['return_format'] ?? 'array' ) === 'url' ) {
			return wp_get_attachment_url( $id ) ?: '';
		}
		if ( ( $field['return_format'] ?? 'array' ) === 'id' ) {
			return $id;
		}
		return array(
			'ID'   => $id,
			'url'  => wp_get_attachment_url( $id ) ?: '',
			'name' => basename( get_attached_file( $id ) ?: '' ),
		);
	}
}

class Neo_Pulse_Wp_Field_Type_Gallery extends Neo_Pulse_Wp_Field_Type_Base {

	public function type(): string {
		return 'gallery';
	}

	public function label(): string {
		return __( 'Gallery', 'neo-pulse-wp' );
	}

	public function defaults(): array {
		return array( 'return_format' => 'array', 'preview_size' => 'medium' );
	}

	public function render_input( array $field, $value, int $post_id ): void {
		$ids = is_array( $value ) ? array_map( 'intval', $value ) : array();
		$this->wrap_open( $field );
		echo '<div class="neo-pulse-gallery-field" data-post-id="' . esc_attr( (string) $post_id ) . '">';
		printf(
			'<input type="hidden" class="neo-pulse-gallery-ids" id="%1$s" name="%2$s" value="%3$s" />',
			esc_attr( $this->field_id( $field ) ),
			esc_attr( $this->field_name( $field ) ),
			esc_attr( implode( ',', $ids ) )
		);
		echo '<ul class="neo-pulse-gallery-preview">';
		foreach ( $ids as $id ) {
			if ( $id > 0 && class_exists( 'Neo_Pulse_Wp_Image_Seo', false ) ) {
				Neo_Pulse_Wp_Image_Seo::render_gallery_item( $id );
			} elseif ( $id > 0 ) {
				echo '<li class="neo-pulse-gallery-item" data-id="' . esc_attr( (string) $id ) . '">' . wp_get_attachment_image( $id, 'thumbnail' ) . '</li>';
			}
		}
		echo '</ul>';
		echo '<button type="button" class="button neo-pulse-gallery-select">' . esc_html__( 'Add to gallery', 'neo-pulse-wp' ) . '</button>';
		echo '</div>';
		$this->wrap_close( $field );
	}

	public function load_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		if ( is_string( $value ) && $value !== '' ) {
			return array_map( 'intval', explode( ',', $value ) );
		}
		return is_array( $value ) ? $value : array();
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		if ( is_string( $value ) ) {
			$value = $value === '' ? array() : explode( ',', $value );
		}
		if ( ! is_array( $value ) ) {
			return array();
		}
		return array_values( array_filter( array_map( 'intval', $value ) ) );
	}

	public function format_value( $value, array $field, int $post_id ) {
		unset( $post_id );
		if ( ! is_array( $value ) ) {
			return array();
		}
		$out = array();
		foreach ( $value as $id ) {
			$id = (int) $id;
			if ( $id < 1 ) {
				continue;
			}
			if ( ( $field['return_format'] ?? 'array' ) === 'id' ) {
				$out[] = $id;
			} else {
				$src   = wp_get_attachment_image_src( $id, 'full' );
				$out[] = array(
					'ID'  => $id,
					'url' => $src ? $src[0] : '',
				);
			}
		}
		return $out;
	}
}
