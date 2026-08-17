<?php
/**
 * Relational and link field types.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Field_Type_Link extends Neo_Pulse_Wp_Field_Type_Base {

	public function type(): string { return 'link'; }
	public function label(): string { return __( 'Link', 'neo-pulse-wp' ); }
	public function defaults(): array { return array( 'return_format' => 'array' ); }

	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$data = is_array( $value ) ? $value : array( 'url' => '', 'title' => '', 'target' => '' );
		$this->wrap_open( $field );
		$base = $this->field_name( $field );
		printf( '<p><label>%1$s <input type="url" name="%2$s[url]" value="%3$s" class="widefat" /></label></p>',
			esc_html__( 'URL', 'neo-pulse-wp' ), esc_attr( $base ), esc_attr( (string) ( $data['url'] ?? '' ) ) );
		printf( '<p><label>%1$s <input type="text" name="%2$s[title]" value="%3$s" class="widefat" /></label></p>',
			esc_html__( 'Link Text', 'neo-pulse-wp' ), esc_attr( $base ), esc_attr( (string) ( $data['title'] ?? '' ) ) );
		printf( '<p><label><input type="checkbox" name="%1$s[target]" value="_blank" %2$s /> %3$s</label></p>',
			esc_attr( $base ), checked( ( $data['target'] ?? '' ) === '_blank', true, false ), esc_html__( 'Open in new tab', 'neo-pulse-wp' ) );
		$this->wrap_close( $field );
	}

	public function load_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_array( $value ) ? $value : array( 'url' => '', 'title' => '', 'target' => '' );
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		if ( ! is_array( $value ) ) {
			return array( 'url' => '', 'title' => '', 'target' => '' );
		}
		return array(
			'url'    => esc_url_raw( (string) ( $value['url'] ?? '' ) ),
			'title'  => sanitize_text_field( (string) ( $value['title'] ?? '' ) ),
			'target' => ( $value['target'] ?? '' ) === '_blank' ? '_blank' : '',
		);
	}
}

abstract class Neo_Pulse_Wp_Field_Type_Post_List_Base extends Neo_Pulse_Wp_Field_Type_Base {

	protected function render_post_select( array $field, $value, string $input_type = 'select' ): void {
		$this->wrap_open( $field );
		$multiple = ! empty( $field['multiple'] );
		$post_types = isset( $field['post_type'] ) ? (array) $field['post_type'] : array( 'post', 'page' );
		$posts = get_posts(
			array(
				'post_type'      => $post_types,
				'posts_per_page' => 500,
				'post_status'    => 'any',
				'orderby'        => 'title',
				'order'          => 'ASC',
			)
		);
		if ( $input_type === 'select' ) {
			printf( '<select id="%1$s" name="%2$s%3$s">', esc_attr( $this->field_id( $field ) ), esc_attr( $this->field_name( $field ) ), $multiple ? '[]' : '' );
			if ( ! empty( $field['allow_null'] ) ) {
				echo '<option value="">' . esc_html__( '- Select -', 'neo-pulse-wp' ) . '</option>';
			}
			$selected = $multiple ? array_map( 'intval', (array) $value ) : array( (int) $value );
			foreach ( $posts as $post ) {
				printf( '<option value="%1$d" %2$s>%3$s</option>', (int) $post->ID, selected( true, in_array( (int) $post->ID, $selected, true ), false ), esc_html( $post->post_title ) );
			}
			echo '</select>';
		}
		$this->wrap_close( $field );
	}

	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		if ( is_array( $value ) ) {
			return array_values( array_filter( array_map( 'intval', $value ) ) );
		}
		return is_numeric( $value ) ? (int) $value : 0;
	}

	public function format_value( $value, array $field, int $post_id ) {
		unset( $post_id );
		$format = (string) ( $field['return_format'] ?? 'object' );
		if ( is_array( $value ) ) {
			return array_map(
				function ( $id ) use ( $format ) {
					return self::format_post( (int) $id, $format );
				},
				$value
			);
		}
		return self::format_post( (int) $value, $format );
	}

	private static function format_post( int $id, string $format ) {
		if ( $id < 1 ) {
			return null;
		}
		if ( $format === 'id' ) {
			return $id;
		}
		$post = get_post( $id );
		if ( ! $post ) {
			return null;
		}
		if ( $format === 'object' ) {
			return $post;
		}
		return array( 'ID' => $id, 'title' => $post->post_title, 'url' => get_permalink( $post ) );
	}
}

class Neo_Pulse_Wp_Field_Type_Post_Object extends Neo_Pulse_Wp_Field_Type_Post_List_Base {
	public function type(): string { return 'post_object'; }
	public function label(): string { return __( 'Post Object', 'neo-pulse-wp' ); }
	public function defaults(): array { return array( 'post_type' => array( 'post' ), 'return_format' => 'object', 'multiple' => 0 ); }
	public function render_input( array $field, $value, int $post_id ): void { unset( $post_id ); $this->render_post_select( $field, $value ); }
}

class Neo_Pulse_Wp_Field_Type_Page_Link extends Neo_Pulse_Wp_Field_Type_Post_List_Base {
	public function type(): string { return 'page_link'; }
	public function label(): string { return __( 'Page Link', 'neo-pulse-wp' ); }
	public function defaults(): array { return array( 'post_type' => array( 'page' ), 'return_format' => 'url' ); }
	public function render_input( array $field, $value, int $post_id ): void { unset( $post_id ); $this->render_post_select( $field, $value ); }
	public function format_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		$id = is_array( $value ) ? (int) ( $value[0] ?? 0 ) : (int) $value;
		return $id > 0 ? get_permalink( $id ) : '';
	}
}

class Neo_Pulse_Wp_Field_Type_Relationship extends Neo_Pulse_Wp_Field_Type_Post_List_Base {
	public function type(): string { return 'relationship'; }
	public function label(): string { return __( 'Relationship', 'neo-pulse-wp' ); }
	public function defaults(): array { return array( 'post_type' => array( 'post' ), 'return_format' => 'object', 'multiple' => 1 ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$field['multiple'] = 1;
		$this->render_post_select( $field, $value );
	}
}

class Neo_Pulse_Wp_Field_Type_Taxonomy extends Neo_Pulse_Wp_Field_Type_Base {
	public function type(): string { return 'taxonomy'; }
	public function label(): string { return __( 'Taxonomy', 'neo-pulse-wp' ); }
	public function defaults(): array { return array( 'taxonomy' => 'category', 'field_type' => 'select', 'return_format' => 'id' ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$tax = (string) ( $field['taxonomy'] ?? 'category' );
		$this->wrap_open( $field );
		wp_dropdown_categories(
			array(
				'taxonomy'         => $tax,
				'name'             => $this->field_name( $field ) . ( ! empty( $field['multiple'] ) ? '[]' : '' ),
				'selected'         => is_numeric( $value ) ? (int) $value : 0,
				'show_option_none' => __( '- Select -', 'neo-pulse-wp' ),
				'hide_empty'       => 0,
			)
		);
		$this->wrap_close( $field );
	}
	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_numeric( $value ) ? (int) $value : 0;
	}
}

class Neo_Pulse_Wp_Field_Type_User extends Neo_Pulse_Wp_Field_Type_Base {
	public function type(): string { return 'user'; }
	public function label(): string { return __( 'User', 'neo-pulse-wp' ); }
	public function defaults(): array { return array( 'role' => '', 'return_format' => 'array', 'multiple' => 0 ); }
	public function render_input( array $field, $value, int $post_id ): void {
		unset( $post_id );
		$this->wrap_open( $field );
		wp_dropdown_users(
			array(
				'name'             => $this->field_name( $field ),
				'selected'         => is_numeric( $value ) ? (int) $value : 0,
				'show_option_none' => __( '- Select -', 'neo-pulse-wp' ),
			)
		);
		$this->wrap_close( $field );
	}
	public function update_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		return is_numeric( $value ) ? (int) $value : 0;
	}
	public function format_value( $value, array $field, int $post_id ) {
		unset( $field, $post_id );
		$user = get_user_by( 'id', (int) $value );
		if ( ! $user ) {
			return null;
		}
		if ( ( $field['return_format'] ?? 'array' ) === 'object' ) {
			return $user;
		}
		if ( ( $field['return_format'] ?? 'array' ) === 'id' ) {
			return (int) $user->ID;
		}
		return array( 'ID' => (int) $user->ID, 'display_name' => $user->display_name );
	}
}
