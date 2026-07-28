<?php
/**
 * Form definition storage (hidden CPTs).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Forms_Storage {

	const CPT_FORM  = 'flowbie-form';
	const CPT_FIELD = 'flowbie-form-field';

	const META_FORM_KEY = '_flowbie_form_key';

	/** @var array<int, array<string, mixed>>|null */
	private static $forms_cache = null;

	public static function register_post_types(): void {
		register_post_type(
			self::CPT_FORM,
			array(
				'labels'              => array(
					'name'          => __( 'Forms', 'flowbie-wp' ),
					'singular_name' => __( 'Form', 'flowbie-wp' ),
				),
				'public'              => false,
				'show_ui'             => false,
				'show_in_menu'        => false,
				'capability_type'     => 'post',
				'map_meta_cap'        => true,
				'hierarchical'        => false,
				'supports'            => array( 'title' ),
				'delete_with_user'    => false,
				'can_export'          => true,
			)
		);

		register_post_type(
			self::CPT_FIELD,
			array(
				'public'           => false,
				'show_ui'          => false,
				'show_in_menu'     => false,
				'capability_type'  => 'post',
				'hierarchical'     => true,
				'supports'         => array( 'title' ),
				'delete_with_user' => false,
			)
		);
	}

	public static function flush_cache(): void {
		self::$forms_cache = null;
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_all_forms( bool $active_only = false ): array {
		if ( null === self::$forms_cache ) {
			$query = new WP_Query(
				array(
					'post_type'      => self::CPT_FORM,
					'post_status'    => array( 'publish', 'draft', 'trash' ),
					'posts_per_page' => -1,
					'orderby'        => 'title',
					'order'          => 'ASC',
					'no_found_rows'  => true,
				)
			);
			$forms = array();
			foreach ( $query->posts as $post ) {
				if ( ! $post instanceof WP_Post ) {
					continue;
				}
				$form = self::decode_form_post( $post );
				if ( $form ) {
					$forms[] = $form;
				}
			}
			self::$forms_cache = $forms;
		}

		$out = self::$forms_cache;
		if ( $active_only ) {
			$out = array_values(
				array_filter(
					$out,
					static function ( $f ) {
						return ! empty( $f['active'] ) && ( $f['status'] ?? '' ) !== 'trash';
					}
				)
			);
		}
		return $out;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function get_form_by_id( int $post_id ): ?array {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post || $post->post_type !== self::CPT_FORM ) {
			return null;
		}
		return self::decode_form_post( $post );
	}

	/**
	 * @param array<string, mixed> $form Form payload.
	 * @return int Post ID or 0 on failure.
	 */
	public static function save_form( array $form ): int {
		$post_id = isset( $form['ID'] ) ? (int) $form['ID'] : 0;
		$title   = sanitize_text_field( (string) ( $form['title'] ?? __( 'Untitled Form', 'flowbie-wp' ) ) );
		if ( $title === '' ) {
			$title = __( 'Untitled Form', 'flowbie-wp' );
		}

		$active = ! empty( $form['active'] );
		$status = isset( $form['status'] ) ? sanitize_key( (string) $form['status'] ) : '';
		if ( $status === 'trash' ) {
			$post_status = 'trash';
		} elseif ( $active ) {
			$post_status = 'publish';
		} else {
			$post_status = 'draft';
		}

		$settings = Flowbie_Wp_Forms_Field_Registry::normalize_settings(
			isset( $form['settings'] ) && is_array( $form['settings'] ) ? $form['settings'] : array()
		);

		$fields = array();
		if ( isset( $form['fields'] ) && is_array( $form['fields'] ) ) {
			$seen_names = array();
			foreach ( $form['fields'] as $raw_field ) {
				if ( ! is_array( $raw_field ) ) {
					continue;
				}
				$field = Flowbie_Wp_Forms_Field_Registry::normalize_field( $raw_field );
				if ( in_array( $field['name'], $seen_names, true ) ) {
					$field['name'] = $field['name'] . '_' . substr( uniqid(), -4 );
				}
				$seen_names[] = $field['name'];
				$fields[]     = $field;
			}
		}

		$key = isset( $form['key'] ) ? sanitize_key( (string) $form['key'] ) : '';
		if ( $key === '' ) {
			$key = 'form_' . uniqid();
		}

		$payload = array(
			'key'      => $key,
			'title'    => $title,
			'active'   => $active,
			'settings' => $settings,
			'fields'   => $fields,
		);

		$post_data = array(
			'post_type'    => self::CPT_FORM,
			'post_title'   => $title,
			'post_content' => wp_json_encode( $payload, JSON_UNESCAPED_UNICODE ),
			'post_status'  => $post_status,
		);

		if ( $post_id > 0 ) {
			$post_data['ID'] = $post_id;
			$result          = wp_update_post( $post_data, true );
		} else {
			$result = wp_insert_post( $post_data, true );
		}

		if ( is_wp_error( $result ) ) {
			return 0;
		}

		$post_id = (int) $result;
		update_post_meta( $post_id, self::META_FORM_KEY, $key );
		self::sync_child_fields( $post_id, $fields );
		self::flush_cache();
		return $post_id;
	}

	public static function delete_form( int $post_id, bool $force = false ): bool {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post || $post->post_type !== self::CPT_FORM ) {
			return false;
		}
		$result = wp_delete_post( $post_id, $force );
		self::flush_cache();
		return (bool) $result;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function duplicate_form( int $post_id ): ?array {
		$form = self::get_form_by_id( $post_id );
		if ( ! $form ) {
			return null;
		}
		unset( $form['ID'] );
		$form['title']  = $form['title'] . ' ' . __( '(Copy)', 'flowbie-wp' );
		$form['key']    = 'form_' . uniqid();
		$form['active'] = false;
		$new_id         = self::save_form( $form );
		if ( $new_id < 1 ) {
			return null;
		}
		return self::get_form_by_id( $new_id );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	private static function decode_form_post( WP_Post $post ): ?array {
		$decoded = json_decode( $post->post_content, true );
		if ( ! is_array( $decoded ) ) {
			$decoded = array();
		}

		$fields = isset( $decoded['fields'] ) && is_array( $decoded['fields'] ) ? $decoded['fields'] : array();
		if ( empty( $fields ) ) {
			$fields = self::load_fields_from_children( (int) $post->ID );
		}

		$settings = isset( $decoded['settings'] ) && is_array( $decoded['settings'] )
			? Flowbie_Wp_Forms_Field_Registry::normalize_settings( $decoded['settings'] )
			: Flowbie_Wp_Forms_Field_Registry::default_settings();

		$key = (string) ( $decoded['key'] ?? '' );
		if ( $key === '' ) {
			$meta = get_post_meta( $post->ID, self::META_FORM_KEY, true );
			if ( is_string( $meta ) && $meta !== '' ) {
				$key = $meta;
			} else {
				$key = 'form_' . $post->ID;
			}
		}

		$status = $post->post_status;
		if ( $status === 'trash' ) {
			$active = false;
		} else {
			$active = $status === 'publish';
		}

		return array(
			'ID'       => (int) $post->ID,
			'key'      => $key,
			'title'    => $post->post_title,
			'active'   => $active,
			'status'   => $status,
			'settings' => $settings,
			'fields'   => $fields,
		);
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	private static function load_fields_from_children( int $form_id ): array {
		$children = get_posts(
			array(
				'post_type'      => self::CPT_FIELD,
				'post_parent'    => $form_id,
				'posts_per_page' => -1,
				'post_status'    => 'publish',
				'orderby'        => 'menu_order',
				'order'          => 'ASC',
			)
		);
		$fields = array();
		foreach ( $children as $child ) {
			if ( ! $child instanceof WP_Post ) {
				continue;
			}
			$data = json_decode( $child->post_content, true );
			if ( is_array( $data ) ) {
				$fields[] = Flowbie_Wp_Forms_Field_Registry::normalize_field( $data );
			}
		}
		return $fields;
	}

	/**
	 * @param array<int, array<string, mixed>> $fields Fields.
	 */
	private static function sync_child_fields( int $form_id, array $fields ): void {
		$existing = get_posts(
			array(
				'post_type'      => self::CPT_FIELD,
				'post_parent'    => $form_id,
				'posts_per_page' => -1,
				'post_status'    => 'any',
				'fields'         => 'ids',
			)
		);
		foreach ( $existing as $fid ) {
			wp_delete_post( (int) $fid, true );
		}

		$order = 0;
		foreach ( $fields as $field ) {
			wp_insert_post(
				array(
					'post_type'    => self::CPT_FIELD,
					'post_parent'  => $form_id,
					'post_title'   => (string) ( $field['label'] ?? $field['name'] ?? 'Field' ),
					'post_content' => wp_json_encode( $field, JSON_UNESCAPED_UNICODE ),
					'post_status'  => 'publish',
					'menu_order'   => $order,
				)
			);
			++$order;
		}
	}
}
