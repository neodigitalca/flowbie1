<?php
/**
 * Layout field types and nested containers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Field_Type_Message extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'message'; }
	public function label(): string { return __( 'Message', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'message' => '', 'new_lines' => 'wpautop' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $value, $post_id );
		echo '<div class="acf-field acf-field-message" data-type="message">';
		echo wp_kses_post( wpautop( (string) ( $field['message'] ?? '' ) ) );
		echo '</div>';
	}
}

class Flowbie_Wp_Field_Type_Accordion extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'accordion'; }
	public function label(): string { return __( 'Accordion', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'open' => 0, 'multi_expand' => 0 ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $value, $post_id );
		echo '<div class="acf-field acf-field-accordion"><strong>' . esc_html( (string) ( $field['label'] ?? '' ) ) . '</strong></div>';
	}
}

class Flowbie_Wp_Field_Type_Tab extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'tab'; }
	public function label(): string { return __( 'Tab', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'placement' => 'top' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $value, $post_id );
		echo '<div class="acf-field acf-field-tab"><h3>' . esc_html( (string) ( $field['label'] ?? '' ) ) . '</h3></div>';
	}
}

class Flowbie_Wp_Field_Type_Group extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'group'; }
	public function label(): string { return __( 'Group', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'sub_fields' => array(), 'layout' => 'block' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		$value = is_array( $value ) ? $value : array();
		$this->wrap_open( $field );
		echo '<div class="flowbie-field-group">';
		foreach ( isset( $field['sub_fields'] ) ? $field['sub_fields'] : array() as $sub ) {
			if ( ! is_array( $sub ) ) {
				continue;
			}
			$sub_val = $value[ (string) ( $sub['name'] ?? '' ) ] ?? '';
			Flowbie_Wp_Fields_Registry::render_input( $sub, $sub_val, $post_id );
		}
		echo '</div>';
		$this->wrap_close( $field );
	}
	public function load_value( $value, array $field, int $post_id ) {
		unset( $field );
		return is_array( $value ) ? $value : array();
	}
	public function update_value( $value, array $field, int $post_id ) {
		if ( ! is_array( $value ) ) {
			return array();
		}
		$out = array();
		foreach ( isset( $field['sub_fields'] ) ? $field['sub_fields'] : array() as $sub ) {
			if ( ! is_array( $sub ) || empty( $sub['name'] ) ) {
				continue;
			}
			$name = (string) $sub['name'];
			$out[ $name ] = Flowbie_Wp_Fields_Registry::update_value( $value[ $name ] ?? '', $sub, $post_id );
		}
		return $out;
	}
}

class Flowbie_Wp_Field_Type_Repeater extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'repeater'; }
	public function label(): string { return __( 'Repeater', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'sub_fields' => array(), 'min' => 0, 'max' => 0, 'layout' => 'table' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		$rows = is_array( $value ) ? $value : array();
		$this->wrap_open( $field );
		echo '<div class="flowbie-repeater" data-name="' . esc_attr( (string) $field['name'] ) . '">';
		$sub_fields = isset( $field['sub_fields'] ) ? $field['sub_fields'] : array();
		foreach ( $rows as $i => $row ) {
			echo '<div class="flowbie-repeater-row" data-row="' . esc_attr( (string) $i ) . '">';
			foreach ( $sub_fields as $sub ) {
				if ( ! is_array( $sub ) ) {
					continue;
				}
				$sub_name = (string) ( $sub['name'] ?? '' );
				$sub_copy = $sub;
				$sub_copy['name'] = (string) $field['name'] . '[' . $i . '][' . $sub_name . ']';
				$sub_val = is_array( $row ) ? ( $row[ $sub_name ] ?? '' ) : '';
				Flowbie_Wp_Fields_Registry::render_input( $sub_copy, $sub_val, $post_id );
			}
			echo '<button type="button" class="button flowbie-repeater-remove">' . esc_html__( 'Remove row', 'flowbie-wp' ) . '</button>';
			echo '</div>';
		}
		echo '<button type="button" class="button flowbie-repeater-add">' . esc_html__( 'Add Row', 'flowbie-wp' ) . '</button>';
		echo '</div>';
		$this->wrap_close( $field );
	}
	public function load_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_array( $value ) ? array_values( $value ) : array();
	}
	public function update_value( $value, array $field, int $post_id ) {
		if ( ! is_array( $value ) ) {
			return array();
		}
		$out        = array();
		$sub_fields = isset( $field['sub_fields'] ) ? $field['sub_fields'] : array();
		foreach ( array_values( $value ) as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$item = array();
			foreach ( $sub_fields as $sub ) {
				if ( ! is_array( $sub ) || empty( $sub['name'] ) ) {
					continue;
				}
				$name         = (string) $sub['name'];
				$item[ $name ] = Flowbie_Wp_Fields_Registry::update_value( $row[ $name ] ?? '', $sub, $post_id );
			}
			$out[] = $item;
		}
		return $out;
	}
}

class Flowbie_Wp_Field_Type_Flexible_Content extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'flexible_content'; }
	public function label(): string { return __( 'Flexible Content', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'layouts' => array(), 'min' => '', 'max' => '' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		$rows = is_array( $value ) ? $value : array();
		$this->wrap_open( $field );
		echo '<div class="flowbie-flexible-content">';
		foreach ( $rows as $i => $row ) {
			$layout_name = is_array( $row ) ? (string) ( $row['acf_fc_layout'] ?? '' ) : '';
			echo '<div class="flowbie-flex-row" data-layout="' . esc_attr( $layout_name ) . '">';
			printf( '<input type="hidden" name="%1$s[%2$d][acf_fc_layout]" value="%3$s" />', esc_attr( $this->field_name( $field ) ), (int) $i, esc_attr( $layout_name ) );
			foreach ( isset( $field['layouts'] ) ? $field['layouts'] : array() as $layout ) {
				if ( ! is_array( $layout ) || (string) ( $layout['name'] ?? '' ) !== $layout_name ) {
					continue;
				}
				foreach ( isset( $layout['sub_fields'] ) ? $layout['sub_fields'] : array() as $sub ) {
					if ( ! is_array( $sub ) ) {
						continue;
					}
					$sub['name'] = (string) $field['name'] . '[' . $i . '][' . (string) $sub['name'] . ']';
					$sub_val     = is_array( $row ) ? ( $row[ (string) ( $sub['name'] ?? '' ) ] ?? '' ) : '';
					Flowbie_Wp_Fields_Registry::render_input( $sub, $sub_val, $post_id );
				}
			}
			echo '</div>';
		}
		echo '<button type="button" class="button flowbie-flex-add">' . esc_html__( 'Add Layout', 'flowbie-wp' ) . '</button>';
		echo '</div>';
		$this->wrap_close( $field );
	}
	public function load_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_array( $value ) ? array_values( $value ) : array();
	}
}

class Flowbie_Wp_Field_Type_Clone extends Flowbie_Wp_Field_Type_Base {
	public function type(): string { return 'clone'; }
	public function label(): string { return __( 'Clone', 'flowbie-wp' ); }
	public function defaults(): array { return array( 'clone' => array(), 'display' => 'seamless', 'layout' => 'block' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		$value = is_array( $value ) ? $value : array();
		$this->wrap_open( $field );
		foreach ( isset( $field['sub_fields'] ) ? $field['sub_fields'] : array() as $sub ) {
			if ( ! is_array( $sub ) ) {
				continue;
			}
			$sub_val = $value[ (string) ( $sub['name'] ?? '' ) ] ?? '';
			Flowbie_Wp_Fields_Registry::render_input( $sub, $sub_val, $post_id );
		}
		$this->wrap_close( $field );
	}
}
