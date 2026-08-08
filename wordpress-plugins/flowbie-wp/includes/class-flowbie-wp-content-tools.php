<?php
/**
 * Post type switch and duplicate for native WordPress content.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Content_Tools {

	/** @var array<string, true> */
	private static $excluded_post_types = array(
		'flowbie-field-group'  => true,
		'flowbie-field'        => true,
		'flowbie-post-type'    => true,
		'flowbie-taxonomy'     => true,
		'flowbie-options-page' => true,
		'flowbie-form'         => true,
		'flowbie-form-field'   => true,
	);

	public static function init(): void {
		// Service-only class; admin UI and handlers live in Flowbie_Wp_Admin traits.
	}

	/**
	 * @return array<string, WP_Post_Type>
	 */
	public static function get_switchable_post_types(): array {
		$types = get_post_types( array( 'show_ui' => true ), 'objects' );
		if ( ! is_array( $types ) ) {
			return array();
		}
		foreach ( array_keys( self::$excluded_post_types ) as $slug ) {
			unset( $types[ $slug ] );
		}
		return $types;
	}

	public static function is_switchable_post_type( string $post_type ): bool {
		return $post_type !== '' && isset( self::get_switchable_post_types()[ $post_type ] );
	}

	public static function user_can_switch( int $post_id, string $new_type ): bool {
		if ( $post_id < 1 || ! self::is_switchable_post_type( $new_type ) ) {
			return false;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return false;
		}
		$target = get_post_type_object( $new_type );
		if ( ! $target instanceof WP_Post_Type ) {
			return false;
		}
		return current_user_can( $target->cap->edit_posts );
	}

	public static function user_can_duplicate( int $post_id ): bool {
		if ( $post_id < 1 || ! current_user_can( 'edit_post', $post_id ) ) {
			return false;
		}
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post || ! self::is_switchable_post_type( $post->post_type ) ) {
			return false;
		}
		$type_obj = get_post_type_object( $post->post_type );
		if ( ! $type_obj instanceof WP_Post_Type ) {
			return false;
		}
		return current_user_can( $type_obj->cap->create_posts );
	}

	/**
	 * @return int|WP_Error
	 */
	public static function switch_post_type( int $post_id, string $new_type ) {
		if ( ! self::user_can_switch( $post_id, $new_type ) ) {
			return new WP_Error( 'flowbie_forbidden', __( 'You cannot switch this content type.', 'flowbie-wp' ) );
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return new WP_Error( 'flowbie_missing_post', __( 'Content not found.', 'flowbie-wp' ) );
		}

		$old_type = $post->post_type;
		if ( $old_type === $new_type ) {
			return $post_id;
		}

		$updated = wp_update_post(
			array(
				'ID'        => $post_id,
				'post_type' => $new_type,
			),
			true
		);
		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		self::reconcile_taxonomies( $post_id, $old_type, $new_type );

		/** This action is documented in includes/class-flowbie-wp-content-tools.php */
		do_action( 'flowbie_wp_post_type_switched', $post_id, $old_type, $new_type );

		return (int) $updated;
	}

	/**
	 * @return int|WP_Error
	 */
	public static function duplicate_post( int $post_id ) {
		if ( ! self::user_can_duplicate( $post_id ) ) {
			return new WP_Error( 'flowbie_forbidden', __( 'You cannot duplicate this content.', 'flowbie-wp' ) );
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return new WP_Error( 'flowbie_missing_post', __( 'Content not found.', 'flowbie-wp' ) );
		}

		$base_title = self::strip_suffix( $post->post_title );
		$base_slug  = self::strip_suffix( $post->post_name !== '' ? $post->post_name : sanitize_title( $post->post_title ) );
		$suffix     = self::next_suffix_number( $base_title, $post->post_type );
		$new_title  = $base_title . '-' . $suffix;
		$new_slug   = $base_slug . '-' . $suffix;

		$new_id = wp_insert_post(
			array(
				'post_type'              => $post->post_type,
				'post_title'             => $new_title,
				'post_name'              => $new_slug,
				'post_status'            => 'draft',
				'post_content'           => $post->post_content,
				'post_excerpt'           => $post->post_excerpt,
				'post_content_filtered'  => $post->post_content_filtered,
				'post_author'            => get_current_user_id(),
				'post_parent'            => (int) $post->post_parent,
				'menu_order'             => (int) $post->menu_order,
				'comment_status'         => $post->comment_status,
				'ping_status'            => $post->ping_status,
			),
			true
		);
		if ( is_wp_error( $new_id ) ) {
			return $new_id;
		}

		self::copy_post_meta( $post_id, (int) $new_id );
		self::copy_taxonomies( $post_id, (int) $new_id, $post->post_type );

		$thumb_id = (int) get_post_thumbnail_id( $post_id );
		if ( $thumb_id > 0 ) {
			set_post_thumbnail( (int) $new_id, $thumb_id );
		}

		return (int) $new_id;
	}

	private static function strip_suffix( string $value ): string {
		if ( preg_match( '/^(.*)-(\d+)$/', $value, $matches ) ) {
			return (string) $matches[1];
		}
		return $value;
	}

	private static function next_suffix_number( string $base_title, string $post_type ): int {
		global $wpdb;

		$like = $wpdb->esc_like( $base_title ) . '-%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$titles = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT post_title FROM {$wpdb->posts}
				WHERE post_type = %s
				AND post_status != 'auto-draft'
				AND ( post_title = %s OR post_title LIKE %s )",
				$post_type,
				$base_title,
				$like
			)
		);
		if ( ! is_array( $titles ) ) {
			$titles = array();
		}

		$max = 0;
		foreach ( $titles as $title ) {
			$title = (string) $title;
			if ( $title === $base_title ) {
				continue;
			}
			if ( preg_match( '/^' . preg_quote( $base_title, '/' ) . '-(\d+)$/', $title, $matches ) ) {
				$max = max( $max, (int) $matches[1] );
			}
		}

		return $max + 1;
	}

	private static function reconcile_taxonomies( int $post_id, string $old_type, string $new_type ): void {
		$old_taxonomies = get_object_taxonomies( $old_type );
		$new_taxonomies = get_object_taxonomies( $new_type );
		$compatible     = array_intersect( $old_taxonomies, $new_taxonomies );

		foreach ( $old_taxonomies as $taxonomy ) {
			if ( in_array( $taxonomy, $compatible, true ) ) {
				continue;
			}
			wp_set_object_terms( $post_id, array(), $taxonomy );
		}
	}

	private static function copy_post_meta( int $source_id, int $target_id ): void {
		$meta = get_post_meta( $source_id );
		if ( ! is_array( $meta ) ) {
			return;
		}
		foreach ( $meta as $key => $values ) {
			if ( ! is_string( $key ) || self::should_skip_meta_key( $key ) ) {
				continue;
			}
			if ( ! is_array( $values ) ) {
				continue;
			}
			foreach ( $values as $value ) {
				add_post_meta( $target_id, $key, maybe_unserialize( $value ) );
			}
		}
	}

	private static function should_skip_meta_key( string $key ): bool {
		if ( strpos( $key, '_edit_' ) === 0 ) {
			return true;
		}
		if ( strpos( $key, '_wp_trash_meta_' ) === 0 ) {
			return true;
		}
		return $key === '_wp_old_slug';
	}

	private static function copy_taxonomies( int $source_id, int $target_id, string $post_type ): void {
		foreach ( get_object_taxonomies( $post_type ) as $taxonomy ) {
			$term_ids = wp_get_object_terms( $source_id, $taxonomy, array( 'fields' => 'ids' ) );
			if ( is_wp_error( $term_ids ) || ! is_array( $term_ids ) ) {
				continue;
			}
			wp_set_object_terms( $target_id, array_map( 'intval', $term_ids ), $taxonomy );
		}
	}
}
