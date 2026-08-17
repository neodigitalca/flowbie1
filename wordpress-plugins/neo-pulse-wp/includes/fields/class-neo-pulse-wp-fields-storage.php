<?php
/**
 * Field group CPT storage (ACF-compatible JSON).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Storage {

	const CPT_GROUP     = 'neo-pulse-field-group';
	const CPT_FIELD     = 'neo-pulse-field';
	const CPT_POST_TYPE = 'neo-pulse-post-type';
	const CPT_TAXONOMY  = 'neo-pulse-taxonomy';
	const CPT_OPTIONS   = 'neo-pulse-options-page';

	/** @var array<string, array<string, mixed>>|null */
	private static $groups_cache = null;

	public static function register_post_types(): void {
		register_post_type(
			self::CPT_GROUP,
			array(
				'labels'              => array(
					'name'          => __( 'Field Groups', 'neo-pulse-wp' ),
					'singular_name' => __( 'Field Group', 'neo-pulse-wp' ),
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

		register_post_type(
			self::CPT_POST_TYPE,
			array(
				'public'           => false,
				'show_ui'          => false,
				'show_in_menu'     => false,
				'capability_type'  => 'post',
				'supports'         => array( 'title' ),
				'delete_with_user' => false,
			)
		);

		register_post_type(
			self::CPT_TAXONOMY,
			array(
				'public'           => false,
				'show_ui'          => false,
				'show_in_menu'     => false,
				'capability_type'  => 'post',
				'supports'         => array( 'title' ),
				'delete_with_user' => false,
			)
		);

		register_post_type(
			self::CPT_OPTIONS,
			array(
				'public'           => false,
				'show_ui'          => false,
				'show_in_menu'     => false,
				'capability_type'  => 'post',
				'supports'         => array( 'title' ),
				'delete_with_user' => false,
			)
		);
	}

	public static function flush_cache(): void {
		self::$groups_cache = null;
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_all_groups( bool $active_only = false ): array {
		if ( null !== self::$groups_cache ) {
			$groups = self::$groups_cache;
		} else {
			$groups = array();
			$local  = Neo_Pulse_Wp_Fields_Local_Json::load_all();
			foreach ( $local as $group ) {
				if ( is_array( $group ) && ! empty( $group['key'] ) ) {
					$groups[ (string) $group['key'] ] = $group;
				}
			}

			$query = new WP_Query(
				array(
					'post_type'      => self::CPT_GROUP,
					'post_status'    => array( 'publish', 'draft' ),
					'posts_per_page' => -1,
					'orderby'        => 'menu_order title',
					'order'          => 'ASC',
					'no_found_rows'  => true,
				)
			);

			foreach ( $query->posts as $post ) {
				if ( ! $post instanceof WP_Post ) {
					continue;
				}
				$group = self::decode_group_post( $post );
				if ( $group ) {
					$groups[ (string) $group['key'] ] = $group;
				}
			}
			self::$groups_cache = $groups;
		}

		$out = array_values( $groups );
		if ( $active_only ) {
			$out = array_values(
				array_filter(
					$out,
					static function ( $g ) {
						return ! empty( $g['active'] );
					}
				)
			);
		}
		usort(
			$out,
			static function ( $a, $b ) {
				return (int) ( $a['menu_order'] ?? 0 ) <=> (int) ( $b['menu_order'] ?? 0 );
			}
		);
		return $out;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function get_group_by_key( string $key ): ?array {
		$key = trim( $key );
		if ( $key === '' ) {
			return null;
		}
		foreach ( self::get_all_groups( false ) as $group ) {
			if ( (string) ( $group['key'] ?? '' ) === $key ) {
				return $group;
			}
		}
		return null;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function get_group_by_id( int $post_id ): ?array {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post || $post->post_type !== self::CPT_GROUP ) {
			return null;
		}
		return self::decode_group_post( $post );
	}

	/**
	 * @param array<string, mixed> $group ACF-shaped field group.
	 * @return int Post ID
	 */
	public static function save_group( array $group ): int {
		$key = (string) ( $group['key'] ?? '' );
		if ( $key === '' ) {
			$key           = 'group_' . uniqid();
			$group['key']  = $key;
		}

		$existing_id = self::find_group_post_id( $key );
		$post_data   = array(
			'post_type'    => self::CPT_GROUP,
			'post_title'   => (string) ( $group['title'] ?? $key ),
			'post_content' => wp_json_encode( $group, JSON_UNESCAPED_UNICODE ),
			'post_status'  => ! empty( $group['active'] ) ? 'publish' : 'draft',
			'menu_order'   => (int) ( $group['menu_order'] ?? 0 ),
		);

		if ( $existing_id > 0 ) {
			$post_data['ID'] = $existing_id;
			$post_id         = wp_update_post( $post_data, true );
		} else {
			$post_id = wp_insert_post( $post_data, true );
		}

		if ( is_wp_error( $post_id ) ) {
			return 0;
		}

		update_post_meta( (int) $post_id, '_neo_pulse_field_group_key', $key );
		self::sync_child_fields( (int) $post_id, $group );
		Neo_Pulse_Wp_Fields_Local_Json::sync_group( $group );
		self::flush_cache();
		return (int) $post_id;
	}

	/**
	 * @param array<int, array<string, mixed>> $groups Field groups.
	 * @return array{created: int, updated: int, deleted: int}
	 */
	public static function import_groups( array $groups, bool $delete_missing = false ): array {
		$stats   = array( 'created' => 0, 'updated' => 0, 'deleted' => 0 );
		$seen    = array();
		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) || empty( $group['key'] ) ) {
				continue;
			}
			$key        = (string) $group['key'];
			$seen[]     = $key;
			$existing   = self::find_group_post_id( $key );
			$post_id    = self::save_group( $group );
			if ( $post_id < 1 ) {
				continue;
			}
			if ( $existing > 0 ) {
				++$stats['updated'];
			} else {
				++$stats['created'];
			}
		}

		if ( $delete_missing ) {
			$query = new WP_Query(
				array(
					'post_type'      => self::CPT_GROUP,
					'post_status'    => array( 'publish', 'draft' ),
					'posts_per_page' => -1,
					'fields'         => 'ids',
					'no_found_rows'  => true,
				)
			);
			foreach ( $query->posts as $pid ) {
				$meta_key = get_post_meta( (int) $pid, '_neo_pulse_field_group_key', true );
				if ( is_string( $meta_key ) && $meta_key !== '' && ! in_array( $meta_key, $seen, true ) ) {
					wp_delete_post( (int) $pid, true );
					++$stats['deleted'];
				}
			}
		}

		self::flush_cache();
		return $stats;
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function export_groups( array $keys = array() ): array {
		$all = self::get_all_groups( false );
		if ( empty( $keys ) ) {
			return $all;
		}
		$keys = array_map( 'strval', $keys );
		return array_values(
			array_filter(
				$all,
				static function ( $g ) use ( $keys ) {
					return in_array( (string) ( $g['key'] ?? '' ), $keys, true );
				}
			)
		);
	}

	public static function delete_group( string $key ): bool {
		$post_id = self::find_group_post_id( $key );
		if ( $post_id < 1 ) {
			return false;
		}
		$result = wp_delete_post( $post_id, true );
		Neo_Pulse_Wp_Fields_Local_Json::delete_group_file( $key );
		self::flush_cache();
		return (bool) $result;
	}

	private static function find_group_post_id( string $key ): int {
		$query = new WP_Query(
			array(
				'post_type'      => self::CPT_GROUP,
				'post_status'    => array( 'publish', 'draft', 'trash' ),
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'meta_key'       => '_neo_pulse_field_group_key',
				'meta_value'     => $key,
				'no_found_rows'  => true,
			)
		);
		return ! empty( $query->posts ) ? (int) $query->posts[0] : 0;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	private static function decode_group_post( WP_Post $post ): ?array {
		$decoded = json_decode( $post->post_content, true );
		if ( ! is_array( $decoded ) ) {
			$decoded = array();
		}
		if ( empty( $decoded['key'] ) ) {
			$meta_key = get_post_meta( $post->ID, '_neo_pulse_field_group_key', true );
			if ( is_string( $meta_key ) && $meta_key !== '' ) {
				$decoded['key'] = $meta_key;
			}
		}
		if ( empty( $decoded['title'] ) ) {
			$decoded['title'] = $post->post_title;
		}
		$decoded['ID']     = (int) $post->ID;
		$decoded['active'] = $post->post_status === 'publish';
		return $decoded;
	}

	/**
	 * @param array<string, mixed> $group Field group.
	 */
	private static function sync_child_fields( int $group_id, array $group ): void {
		$existing = get_posts(
			array(
				'post_type'      => self::CPT_FIELD,
				'post_parent'    => $group_id,
				'posts_per_page' => -1,
				'post_status'    => 'any',
				'fields'         => 'ids',
			)
		);
		foreach ( $existing as $fid ) {
			wp_delete_post( (int) $fid, true );
		}

		$fields = isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array();
		$order  = 0;
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			wp_insert_post(
				array(
					'post_type'    => self::CPT_FIELD,
					'post_parent'  => $group_id,
					'post_title'   => (string) ( $field['label'] ?? $field['name'] ?? 'Field' ),
					'post_content' => wp_json_encode( $field, JSON_UNESCAPED_UNICODE ),
					'post_status'  => 'publish',
					'menu_order'   => $order,
				)
			);
			++$order;
		}
	}

	/**
	 * Generic JSON entity storage for post types, taxonomies, options pages.
	 *
	 * @param array<string, mixed> $data Entity config.
	 */
	public static function save_entity( string $cpt, array $data, string $meta_key_field ): int {
		$key = (string) ( $data[ $meta_key_field ] ?? $data['key'] ?? '' );
		if ( $key === '' ) {
			return 0;
		}
		$existing = self::find_entity_post_id( $cpt, $meta_key_field, $key );
		$post     = array(
			'post_type'    => $cpt,
			'post_title'   => (string) ( $data['title'] ?? $data['labels']['name'] ?? $key ),
			'post_content' => wp_json_encode( $data, JSON_UNESCAPED_UNICODE ),
			'post_status'  => 'publish',
		);
		if ( $existing > 0 ) {
			$post['ID'] = $existing;
			$id         = wp_update_post( $post, true );
		} else {
			$id = wp_insert_post( $post, true );
		}
		if ( is_wp_error( $id ) ) {
			return 0;
		}
		update_post_meta( (int) $id, '_neo_pulse_entity_key', $key );
		return (int) $id;
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_entities( string $cpt ): array {
		$query = new WP_Query(
			array(
				'post_type'      => $cpt,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'no_found_rows'  => true,
			)
		);
		$out = array();
		foreach ( $query->posts as $post ) {
			if ( ! $post instanceof WP_Post ) {
				continue;
			}
			$data = json_decode( $post->post_content, true );
			if ( is_array( $data ) ) {
				$data['ID'] = (int) $post->ID;
				if ( self::CPT_POST_TYPE === $cpt ) {
					$data = self::normalize_post_type_entity( $data, $post );
				}
				if ( self::CPT_TAXONOMY === $cpt ) {
					$data = self::normalize_taxonomy_entity( $data, $post );
				}
				$out[] = $data;
			}
		}
		return $out;
	}

	/**
	 * @param array<string, mixed> $data Post type entity JSON.
	 * @return array<string, mixed>
	 */
	private static function normalize_post_type_entity( array $data, WP_Post $post ): array {
		$slug = sanitize_key( (string) ( $data['post_type'] ?? $data['key'] ?? '' ) );
		if ( $slug !== '' ) {
			$data['post_type'] = $slug;
		}
		if ( ! isset( $data['labels'] ) || ! is_array( $data['labels'] ) ) {
			$data['labels'] = array();
		}
		if ( (string) ( $data['labels']['name'] ?? '' ) === '' ) {
			$name = (string) ( $data['title'] ?? $data['label'] ?? $data['plural_label'] ?? $post->post_title ?? '' );
			if ( $name === '' ) {
				$name = $slug;
			}
			$data['labels']['name'] = $name;
		}
		return $data;
	}

	/**
	 * @param array<string, mixed> $data Taxonomy entity JSON.
	 * @return array<string, mixed>
	 */
	private static function normalize_taxonomy_entity( array $data, WP_Post $post ): array {
		$slug = sanitize_key( (string) ( $data['taxonomy'] ?? $data['key'] ?? '' ) );
		if ( $slug !== '' ) {
			$data['taxonomy'] = $slug;
		}
		if ( ! isset( $data['labels'] ) || ! is_array( $data['labels'] ) ) {
			$data['labels'] = array();
		}
		if ( (string) ( $data['labels']['name'] ?? '' ) === '' ) {
			$name = (string) ( $data['title'] ?? $data['label'] ?? $post->post_title ?? '' );
			if ( $name === '' ) {
				$name = $slug;
			}
			$data['labels']['name'] = $name;
		}
		if ( empty( $data['object_type'] ) || ! is_array( $data['object_type'] ) ) {
			$data['object_type'] = array( 'post' );
		}
		return $data;
	}

	/**
	 * @return bool True when the entity post was deleted.
	 */
	public static function delete_entity( string $cpt, string $key, string $meta_key_field ): bool {
		$key = sanitize_key( $key );
		if ( $key === '' ) {
			return false;
		}
		$id = self::find_entity_post_id( $cpt, $meta_key_field, $key );
		if ( $id <= 0 ) {
			return false;
		}
		$deleted = wp_delete_post( $id, true );
		return $deleted instanceof WP_Post;
	}

	private static function find_entity_post_id( string $cpt, string $meta_key_field, string $key ): int {
		$query = new WP_Query(
			array(
				'post_type'      => $cpt,
				'post_status'    => 'any',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'meta_key'       => '_neo_pulse_entity_key',
				'meta_value'     => $key,
				'no_found_rows'  => true,
			)
		);
		if ( ! empty( $query->posts ) ) {
			return (int) $query->posts[0];
		}

		$fallback = new WP_Query(
			array(
				'post_type'      => $cpt,
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'no_found_rows'  => true,
			)
		);
		foreach ( $fallback->posts as $post ) {
			if ( ! $post instanceof WP_Post ) {
				continue;
			}
			$data = json_decode( $post->post_content, true );
			if ( ! is_array( $data ) ) {
				continue;
			}
			$stored = sanitize_key( (string) ( $data[ $meta_key_field ] ?? $data['key'] ?? '' ) );
			if ( $stored === $key ) {
				return (int) $post->ID;
			}
		}
		return 0;
	}
}
