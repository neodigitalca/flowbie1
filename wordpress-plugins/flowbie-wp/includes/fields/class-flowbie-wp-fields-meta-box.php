<?php
/**
 * Meta boxes and post save for field groups.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Meta_Box {

	public static function init(): void {
		add_action( 'add_meta_boxes', array( __CLASS__, 'register_meta_boxes' ), 10 );
		add_action( 'save_post', array( __CLASS__, 'save_post' ), 10, 2 );
		add_action( 'admin_head', array( __CLASS__, 'apply_hide_on_screen' ) );
	}

	public static function register_meta_boxes(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || ! in_array( $screen->base, array( 'post', 'post-new' ), true ) ) {
			return;
		}
		$post_type = (string) ( $screen->post_type ?? '' );
		if ( $post_type === '' ) {
			return;
		}

		global $post;
		$post_id = $post instanceof WP_Post ? (int) $post->ID : 0;
		$screen_args = array(
			'post_type'   => $post_type,
			'post_id'     => $post_id,
			'post_status' => $post instanceof WP_Post ? $post->post_status : 'draft',
		);

		foreach ( Flowbie_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( ! Flowbie_Wp_Fields_Location::matches_group( $group, $screen_args ) ) {
				continue;
			}
			$key = (string) ( $group['key'] ?? '' );
			add_meta_box(
				'flowbie_fields_' . $key,
				(string) ( $group['title'] ?? __( 'Fields', 'flowbie-wp' ) ),
				array( __CLASS__, 'render_meta_box' ),
				$post_type,
				(string) ( $group['position'] ?? 'normal' ),
				'high',
				array( 'group' => $group )
			);
		}
	}

	/**
	 * @param WP_Post              $post Post.
	 * @param array<string, mixed> $box  Meta box args.
	 */
	public static function render_meta_box( WP_Post $post, array $box ): void {
		$group = isset( $box['args']['group'] ) && is_array( $box['args']['group'] ) ? $box['args']['group'] : null;
		if ( ! $group ) {
			return;
		}
		wp_nonce_field( 'flowbie_fields_save_' . (string) $group['key'], 'flowbie_fields_nonce_' . (string) $group['key'] );
		$fields = isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array();
		$values = Flowbie_Wp_Fields_Values::get_all_values( (int) $post->ID, $fields, false );
		$rules_json = Flowbie_Wp_Fields_Conditional::rules_json_for_fields( $fields );
		echo '<div class="acf-fields flowbie-fields-root" data-flowbie-conditional-rules="' . esc_attr( $rules_json ) . '">';
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) ) {
				continue;
			}
			$visible = Flowbie_Wp_Fields_Conditional::is_visible( $field, $values, $fields );
			$name    = (string) $field['name'];
			$value   = $values[ $name ] ?? '';
			if ( ! $visible ) {
				echo '<div class="flowbie-conditional-hidden-wrap" style="display:none">';
			}
			Flowbie_Wp_Fields_Registry::render_input( $field, $value, (int) $post->ID );
			if ( ! $visible ) {
				echo '</div>';
			}
		}
		echo '</div>';
	}

	public static function save_post( int $post_id, WP_Post $post ): void {
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( wp_is_post_revision( $post_id ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		if ( ! isset( $_POST['flowbie_fields'] ) || ! is_array( $_POST['flowbie_fields'] ) ) {
			return;
		}
		$submitted = wp_unslash( $_POST['flowbie_fields'] );
		$screen    = Flowbie_Wp_Fields_Values::screen_for_post( $post_id );
		foreach ( Flowbie_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( ! Flowbie_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				continue;
			}
			$key = (string) ( $group['key'] ?? '' );
			if ( $key === '' || ! isset( $_POST[ 'flowbie_fields_nonce_' . $key ] ) ) {
				continue;
			}
			if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( (string) $_POST[ 'flowbie_fields_nonce_' . $key ] ) ), 'flowbie_fields_save_' . $key ) ) {
				continue;
			}
			foreach ( isset( $group['fields'] ) ? $group['fields'] : array() as $field ) {
				if ( ! is_array( $field ) || empty( $field['name'] ) ) {
					continue;
				}
				$name = (string) $field['name'];
				if ( ! array_key_exists( $name, $submitted ) ) {
					continue;
				}
				Flowbie_Wp_Fields_Values::update_value( $post_id, $field, $submitted[ $name ] );
			}
		}
	}

	public static function apply_hide_on_screen(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || ! in_array( $screen->base, array( 'post', 'post-new' ), true ) ) {
			return;
		}
		global $post;
		$post_id = $post instanceof WP_Post ? (int) $post->ID : 0;
		$screen_args = array(
			'post_type' => (string) ( $screen->post_type ?? '' ),
			'post_id'   => $post_id,
		);
		foreach ( Flowbie_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( ! Flowbie_Wp_Fields_Location::matches_group( $group, $screen_args ) ) {
				continue;
			}
			$hide = $group['hide_on_screen'] ?? '';
			if ( ! is_array( $hide ) ) {
				continue;
			}
			foreach ( $hide as $item ) {
				if ( $item === 'the_content' ) {
					echo '<style>#postdivrich { display:none !important; }</style>';
				} elseif ( $item === 'excerpt' ) {
					echo '<style>#postexcerpt, .editor-post-excerpt { display:none !important; }</style>';
				} elseif ( $item === 'featured_image' ) {
					echo '<style>#postimagediv, .editor-post-featured-image { display:none !important; }</style>';
				}
			}
		}
	}
}
