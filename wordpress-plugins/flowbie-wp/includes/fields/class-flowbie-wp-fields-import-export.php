<?php
/**
 * ACF JSON import and export.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Import_Export {

	/**
	 * @return array{success: bool, message: string, stats?: array<string, int>}
	 */
	public static function import_json_string( string $json, bool $delete_missing = false ): array {
		$json = self::strip_utf8_bom( trim( $json ) );
		if ( $json === '' ) {
			return array(
				'success' => false,
				'message' => __( 'File is empty.', 'flowbie-wp' ),
			);
		}

		$data = json_decode( $json, true );
		if ( ! is_array( $data ) ) {
			return array(
				'success' => false,
				'message' => sprintf(
					/* translators: %s: json_last_error_msg() */
					__( 'Invalid JSON file (%s).', 'flowbie-wp' ),
					json_last_error_msg()
				),
			);
		}

		$data = self::unwrap_import_payload( $data );

		$groups       = array();
		$post_types   = array();
		$taxonomies   = array();
		$options_pages = array();

		foreach ( $data as $item ) {
			if ( ! is_array( $item ) || empty( $item['key'] ) ) {
				continue;
			}
			$key = (string) $item['key'];
			if ( 0 === strpos( $key, 'group_' ) ) {
				$groups[] = self::normalize_group( $item );
			} elseif ( 0 === strpos( $key, 'post_type_' ) ) {
				$post_types[] = self::normalize_post_type( $item );
			} elseif ( 0 === strpos( $key, 'taxonomy_' ) ) {
				$taxonomies[] = self::normalize_taxonomy( $item );
			} elseif ( 0 === strpos( $key, 'ui_options_page_' ) || 0 === strpos( $key, 'options_page_' ) ) {
				$options_pages[] = self::normalize_options_page( $item );
			}
		}

		if ( empty( $groups ) && empty( $post_types ) && empty( $taxonomies ) && empty( $options_pages ) ) {
			return array(
				'success' => false,
				'message' => __( 'No field groups, post types, taxonomies, or options pages found in JSON.', 'flowbie-wp' ),
			);
		}

		$stats = array(
			'groups_created'         => 0,
			'groups_updated'         => 0,
			'groups_deleted'         => 0,
			'post_types_created'     => 0,
			'post_types_updated'     => 0,
			'taxonomies_created'     => 0,
			'taxonomies_updated'     => 0,
			'options_pages_created'  => 0,
			'options_pages_updated'  => 0,
		);

		if ( ! empty( $groups ) ) {
			$group_stats = Flowbie_Wp_Fields_Storage::import_groups( $groups, $delete_missing );
			$stats['groups_created'] = (int) $group_stats['created'];
			$stats['groups_updated'] = (int) $group_stats['updated'];
			$stats['groups_deleted'] = (int) $group_stats['deleted'];
		}

		foreach ( $post_types as $pt ) {
			$slug     = (string) ( $pt['post_type'] ?? '' );
			$existing = self::entity_exists( Flowbie_Wp_Fields_Storage::CPT_POST_TYPE, 'post_type', $slug );
			Flowbie_Wp_Fields_Post_Types::save( $pt );
			if ( $existing ) {
				++$stats['post_types_updated'];
			} else {
				++$stats['post_types_created'];
			}
		}

		foreach ( $taxonomies as $tax ) {
			$slug     = (string) ( $tax['taxonomy'] ?? '' );
			$existing = self::entity_exists( Flowbie_Wp_Fields_Storage::CPT_TAXONOMY, 'taxonomy', $slug );
			Flowbie_Wp_Fields_Taxonomies::save( $tax );
			if ( $existing ) {
				++$stats['taxonomies_updated'];
			} else {
				++$stats['taxonomies_created'];
			}
		}

		foreach ( $options_pages as $page ) {
			$slug     = (string) ( $page['menu_slug'] ?? '' );
			$existing = self::entity_exists( Flowbie_Wp_Fields_Storage::CPT_OPTIONS, 'menu_slug', $slug );
			Flowbie_Wp_Fields_Options::register_page( $page );
			if ( $existing ) {
				++$stats['options_pages_updated'];
			} else {
				++$stats['options_pages_created'];
			}
		}

		return array(
			'success' => true,
			'message' => self::build_import_message( $stats ),
			'stats'   => $stats,
		);
	}

	/**
	 * Check whether a stored entity already exists for a given slug.
	 */
	private static function entity_exists( string $cpt, string $slug_field, string $slug ): bool {
		if ( $slug === '' ) {
			return false;
		}
		foreach ( Flowbie_Wp_Fields_Storage::get_entities( $cpt ) as $item ) {
			if ( (string) ( $item[ $slug_field ] ?? '' ) === $slug ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<string, int> $stats Import stats.
	 */
	private static function build_import_message( array $stats ): string {
		$parts = array();
		$g_total = $stats['groups_created'] + $stats['groups_updated'];
		if ( $g_total > 0 || ( $stats['groups_deleted'] ?? 0 ) > 0 ) {
			$parts[] = sprintf(
				/* translators: 1: created count, 2: updated count, 3: deleted count */
				__( '%1$d new, %2$d updated, %3$d deleted field group(s)', 'flowbie-wp' ),
				$stats['groups_created'],
				$stats['groups_updated'],
				$stats['groups_deleted']
			);
		}
		$pt_total = $stats['post_types_created'] + $stats['post_types_updated'];
		if ( $pt_total > 0 ) {
			$parts[] = sprintf(
				/* translators: 1: created count, 2: updated count */
				__( '%1$d new, %2$d updated post type(s)', 'flowbie-wp' ),
				$stats['post_types_created'],
				$stats['post_types_updated']
			);
		}
		$tax_total = $stats['taxonomies_created'] + $stats['taxonomies_updated'];
		if ( $tax_total > 0 ) {
			$parts[] = sprintf(
				/* translators: 1: created count, 2: updated count */
				__( '%1$d new, %2$d updated taxonomy(ies)', 'flowbie-wp' ),
				$stats['taxonomies_created'],
				$stats['taxonomies_updated']
			);
		}
		$opt_total = ( $stats['options_pages_created'] ?? 0 ) + ( $stats['options_pages_updated'] ?? 0 );
		if ( $opt_total > 0 ) {
			$parts[] = sprintf(
				/* translators: 1: created count, 2: updated count */
				__( '%1$d new, %2$d updated options page(s)', 'flowbie-wp' ),
				$stats['options_pages_created'],
				$stats['options_pages_updated']
			);
		}
		if ( empty( $parts ) ) {
			return __( 'No changes were made.', 'flowbie-wp' );
		}
		return __( 'Imported: ', 'flowbie-wp' ) . implode( '; ', $parts ) . '.';
	}

	/**
	 * @param array<string, mixed> $group Field group.
	 * @return array<string, mixed>
	 */
	public static function normalize_group( array $group ): array {
		$defaults = array(
			'fields'                => array(),
			'location'              => array(),
			'menu_order'            => 0,
			'position'              => 'normal',
			'style'                 => 'default',
			'label_placement'       => 'top',
			'instruction_placement' => 'label',
			'hide_on_screen'        => '',
			'active'                => true,
			'description'           => '',
			'show_in_rest'          => 0,
		);
		return array_merge( $defaults, $group );
	}

	/**
	 * @param array<string, mixed> $item ACF post type export row.
	 * @return array<string, mixed>
	 */
	public static function normalize_post_type( array $item ): array {
		$slug = (string) ( $item['post_type'] ?? '' );
		if ( $slug === '' && ! empty( $item['key'] ) ) {
			$slug = (string) preg_replace( '/^post_type_/', '', (string) $item['key'] );
			$item['post_type'] = $slug;
		}

		$item['menu_icon'] = self::normalize_menu_icon( $item['menu_icon'] ?? 'dashicons-admin-post' );

		$taxonomies = $item['taxonomies'] ?? array();
		if ( ! is_array( $taxonomies ) ) {
			$item['taxonomies'] = $taxonomies === '' || $taxonomies === null ? array() : array( (string) $taxonomies );
		}

		$rewrite = isset( $item['rewrite'] ) && is_array( $item['rewrite'] ) ? $item['rewrite'] : array();
		$item['rewrite'] = self::normalize_rewrite_config( $rewrite, $slug, 'post_type_key' );

		return $item;
	}

	/**
	 * @param array<string, mixed> $item ACF taxonomy export row.
	 * @return array<string, mixed>
	 */
	public static function normalize_taxonomy( array $item ): array {
		$slug = (string) ( $item['taxonomy'] ?? '' );
		if ( $slug === '' && ! empty( $item['key'] ) ) {
			$slug = (string) preg_replace( '/^taxonomy_/', '', (string) $item['key'] );
			$item['taxonomy'] = $slug;
		}

		$rewrite = isset( $item['rewrite'] ) && is_array( $item['rewrite'] ) ? $item['rewrite'] : array();
		$item['rewrite'] = self::normalize_rewrite_config( $rewrite, $slug, 'taxonomy_key' );

		return $item;
	}

	/**
	 * @param array<string, mixed> $item ACF options page export row.
	 * @return array<string, mixed>
	 */
	public static function normalize_options_page( array $item ): array {
		$menu_slug = (string) ( $item['menu_slug'] ?? '' );
		if ( $menu_slug === '' && ! empty( $item['key'] ) ) {
			$menu_slug = sanitize_key( (string) ( $item['key'] ?? '' ) );
		}

		$icon = self::normalize_menu_icon( $item['menu_icon'] ?? ( $item['icon_url'] ?? '' ) );

		return array(
			'key'          => (string) ( $item['key'] ?? 'ui_options_page_' . $menu_slug ),
			'menu_slug'    => $menu_slug,
			'page_title'   => (string) ( $item['page_title'] ?? $item['title'] ?? $menu_slug ),
			'menu_title'   => (string) ( $item['menu_title'] ?? $item['title'] ?? $menu_slug ),
			'parent_slug'  => (string) ( $item['parent_slug'] ?? '' ),
			'capability'   => (string) ( $item['capability'] ?? 'manage_options' ),
			'position'     => isset( $item['position'] ) ? (int) $item['position'] : null,
			'icon_url'     => is_string( $icon ) ? $icon : '',
			'menu_icon'    => $icon,
			'active'       => ! isset( $item['active'] ) || ! empty( $item['active'] ),
			'redirect'     => ! empty( $item['redirect'] ),
			'description'  => (string) ( $item['description'] ?? '' ),
			'data_storage' => (string) ( $item['data_storage'] ?? 'options' ),
		);
	}

	/**
	 * @param mixed $icon ACF menu_icon (string or {type,value}).
	 */
	public static function normalize_menu_icon( $icon ): string {
		if ( is_string( $icon ) && $icon !== '' ) {
			return $icon;
		}
		if ( ! is_array( $icon ) ) {
			return 'dashicons-admin-post';
		}
		$type  = (string) ( $icon['type'] ?? '' );
		$value = (string) ( $icon['value'] ?? '' );
		if ( $type === 'dashicons' && $value !== '' ) {
			return $value;
		}
		if ( $type === 'media_library' && $value !== '' && is_numeric( $value ) ) {
			$url = wp_get_attachment_image_url( (int) $value, 'full' );
			return is_string( $url ) && $url !== '' ? $url : 'dashicons-admin-post';
		}
		if ( $value !== '' && strpos( $value, 'dashicons-' ) === 0 ) {
			return $value;
		}
		return 'dashicons-admin-post';
	}

	/**
	 * @param array<string, mixed> $rewrite Rewrite config from ACF export.
	 * @return array<string, mixed>
	 */
	public static function normalize_rewrite_config( array $rewrite, string $slug, string $default_mode ): array {
		$mode = (string) ( $rewrite['permalink_rewrite'] ?? '' );
		if ( $mode === $default_mode || ( $mode === '' && $slug !== '' ) ) {
			$rewrite['slug'] = (string) ( $rewrite['slug'] ?? $slug );
		}
		if ( isset( $rewrite['with_front'] ) ) {
			$rewrite['with_front'] = ! empty( $rewrite['with_front'] ) && $rewrite['with_front'] !== '0';
		}
		return $rewrite;
	}

	/**
	 * @param array<int, string> $keys       Group keys to export; empty = all.
	 * @param array<string, bool> $include   Entity types to include.
	 */
	public static function export_json_string( array $keys = array(), array $include = array() ): string {
		$defaults = array(
			'groups'        => true,
			'post_types'    => true,
			'taxonomies'    => true,
			'options_pages' => true,
		);
		$include  = array_merge( $defaults, $include );

		$items = array();

		if ( ! empty( $include['groups'] ) ) {
			$groups = Flowbie_Wp_Fields_Storage::export_groups( $keys );
			foreach ( $groups as $group ) {
				unset( $group['ID'] );
				$items[] = $group;
			}
		}

		if ( ! empty( $include['taxonomies'] ) ) {
			foreach ( self::export_taxonomies() as $tax ) {
				$items[] = $tax;
			}
		}

		if ( ! empty( $include['post_types'] ) ) {
			foreach ( self::export_post_types() as $pt ) {
				$items[] = $pt;
			}
		}

		if ( ! empty( $include['options_pages'] ) ) {
			foreach ( self::export_options_pages() as $page ) {
				$items[] = $page;
			}
		}

		return wp_json_encode( array_values( $items ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function export_post_types(): array {
		$items = Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_POST_TYPE );
		foreach ( $items as &$item ) {
			unset( $item['ID'] );
		}
		unset( $item );
		return array_values( $items );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function export_taxonomies(): array {
		$items = Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_TAXONOMY );
		foreach ( $items as &$item ) {
			unset( $item['ID'] );
		}
		unset( $item );
		return array_values( $items );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function export_options_pages(): array {
		$items = Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_OPTIONS );
		foreach ( $items as &$item ) {
			unset( $item['ID'] );
		}
		unset( $item );
		return array_values( $items );
	}

	/**
	 * Normalize decoded JSON into a flat list of ACF export items.
	 *
	 * @param array<string|int, mixed> $data Decoded root.
	 * @return array<int, array<string, mixed>>
	 */
	private static function unwrap_import_payload( array $data ): array {
		if ( isset( $data['key'] ) && is_string( $data['key'] ) ) {
			return array( $data );
		}

		if ( self::is_list_array( $data ) ) {
			$items = array();
			foreach ( $data as $item ) {
				if ( is_array( $item ) ) {
					$items[] = $item;
				}
			}
			return $items;
		}

		$items = array();
		foreach ( array( 'groups', 'field_groups', 'acf_field_groups', 'items' ) as $list_key ) {
			if ( ! empty( $data[ $list_key ] ) && is_array( $data[ $list_key ] ) ) {
				foreach ( $data[ $list_key ] as $item ) {
					if ( is_array( $item ) ) {
						$items[] = $item;
					}
				}
			}
		}
		foreach ( array( 'post_types', 'taxonomies', 'options_pages', 'ui_options_pages' ) as $list_key ) {
			if ( ! empty( $data[ $list_key ] ) && is_array( $data[ $list_key ] ) ) {
				foreach ( $data[ $list_key ] as $item ) {
					if ( is_array( $item ) ) {
						$items[] = $item;
					}
				}
			}
		}

		return ! empty( $items ) ? $items : array( $data );
	}

	/**
	 * @param array<string|int, mixed> $data Array.
	 */
	private static function is_list_array( array $data ): bool {
		if ( array() === $data ) {
			return true;
		}
		return array_keys( $data ) === range( 0, count( $data ) - 1 );
	}

	private static function strip_utf8_bom( string $text ): string {
		if ( strncmp( $text, "\xEF\xBB\xBF", 3 ) === 0 ) {
			return substr( $text, 3 );
		}
		return $text;
	}

	public static function bundled_starter_path(): string {
		return FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/fixtures/acf-export-starter.json';
	}

	public static function bundled_window_coverings_path(): string {
		return FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/fixtures/acf-export-window-coverings.json';
	}

	public static function bundled_smb_starter_path(): string {
		return FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/fixtures/acf-export-smb-starter.json';
	}

	/**
	 * @return array{success: bool, message: string, stats?: array<string, int>}
	 */
	public static function import_bundled_json( string $path ): array {
		if ( ! is_readable( $path ) ) {
			return array(
				'success' => false,
				'message' => __( 'Bundled config file is missing.', 'flowbie-wp' ),
			);
		}
		$json = file_get_contents( $path );
		if ( ! is_string( $json ) ) {
			return array(
				'success' => false,
				'message' => __( 'Could not read bundled config.', 'flowbie-wp' ),
			);
		}
		return self::import_json_string( $json, false );
	}

	/**
	 * @return array{success: bool, message: string, stats?: array<string, int>}
	 */
	public static function import_bundled_starter(): array {
		return self::import_bundled_json( self::bundled_starter_path() );
	}

	/**
	 * @return array{success: bool, message: string, stats?: array<string, int>}
	 */
	public static function import_bundled_window_coverings(): array {
		return self::import_bundled_json( self::bundled_window_coverings_path() );
	}

	public static function import_bundled_smb_starter(): array {
		return self::import_bundled_json( self::bundled_smb_starter_path() );
	}

	/**
	 * Entity keys/slugs defined in a bundled fixture file.
	 *
	 * @return array{group_keys: array<int, string>, post_types: array<int, string>, taxonomies: array<int, string>, options_pages: array<int, string>}|null
	 */
	public static function parse_fixture_entity_keys( string $path ): ?array {
		if ( ! is_readable( $path ) ) {
			return null;
		}
		$json = file_get_contents( $path );
		if ( ! is_string( $json ) ) {
			return null;
		}
		$data = json_decode( self::strip_utf8_bom( trim( $json ) ), true );
		if ( ! is_array( $data ) ) {
			return null;
		}

		$keys = array(
			'group_keys'     => array(),
			'post_types'     => array(),
			'taxonomies'     => array(),
			'options_pages'  => array(),
		);

		foreach ( self::unwrap_import_payload( $data ) as $item ) {
			if ( ! is_array( $item ) || empty( $item['key'] ) ) {
				continue;
			}
			$key = (string) $item['key'];
			if ( 0 === strpos( $key, 'group_' ) ) {
				$keys['group_keys'][] = $key;
			} elseif ( 0 === strpos( $key, 'post_type_' ) ) {
				$slug = (string) ( $item['post_type'] ?? '' );
				if ( $slug !== '' ) {
					$keys['post_types'][] = $slug;
				}
			} elseif ( 0 === strpos( $key, 'taxonomy_' ) ) {
				$slug = (string) ( $item['taxonomy'] ?? '' );
				if ( $slug !== '' ) {
					$keys['taxonomies'][] = $slug;
				}
			} elseif ( 0 === strpos( $key, 'ui_options_page_' ) || 0 === strpos( $key, 'options_page_' ) ) {
				$slug = (string) ( $item['menu_slug'] ?? '' );
				if ( $slug !== '' ) {
					$keys['options_pages'][] = $slug;
				}
			}
		}

		return $keys;
	}

	/**
	 * Remove all field structure defined in a bundled fixture (stored configs only).
	 *
	 * @return array{success: bool, message: string}
	 */
	public static function delete_bundled_json( string $path ): array {
		$parsed = self::parse_fixture_entity_keys( $path );
		if ( ! is_array( $parsed ) ) {
			return array(
				'success' => false,
				'message' => __( 'Template definition file is missing.', 'flowbie-wp' ),
			);
		}

		$deleted = array(
			'groups'        => 0,
			'post_types'    => 0,
			'taxonomies'    => 0,
			'options_pages' => 0,
		);

		foreach ( $parsed['group_keys'] as $group_key ) {
			if ( Flowbie_Wp_Fields_Storage::delete_group( $group_key ) ) {
				++$deleted['groups'];
			}
		}
		foreach ( $parsed['post_types'] as $slug ) {
			if ( Flowbie_Wp_Fields_Post_Types::delete( $slug ) ) {
				++$deleted['post_types'];
			}
		}
		foreach ( $parsed['taxonomies'] as $slug ) {
			if ( Flowbie_Wp_Fields_Taxonomies::delete( $slug ) ) {
				++$deleted['taxonomies'];
			}
		}
		foreach ( $parsed['options_pages'] as $slug ) {
			if ( Flowbie_Wp_Fields_Options::delete( $slug ) ) {
				++$deleted['options_pages'];
			}
		}

		$total = $deleted['groups'] + $deleted['post_types'] + $deleted['taxonomies'] + $deleted['options_pages'];
		if ( $total < 1 ) {
			return array(
				'success' => true,
				'message' => __( 'Nothing from this template was installed yet.', 'flowbie-wp' ),
			);
		}

		return array(
			'success' => true,
			'message' => sprintf(
				/* translators: 1: groups, 2: post types, 3: taxonomies, 4: options pages */
				__( 'Removed template: %1$d field group(s), %2$d post type(s), %3$d taxonomy(ies), %4$d options page(s).', 'flowbie-wp' ),
				$deleted['groups'],
				$deleted['post_types'],
				$deleted['taxonomies'],
				$deleted['options_pages']
			),
		);
	}

	/**
	 * Expected entity counts in the window coverings fixture (for tests).
	 *
	 * @return array{groups: int, post_types: int, taxonomies: int, options_pages: int}
	 */
	public static function window_coverings_fixture_counts(): array {
		return array(
			'groups'         => 15,
			'post_types'     => 11,
			'taxonomies'     => 6,
			'options_pages'  => 1,
		);
	}

	/**
	 * @return array{groups: int, post_types: int, taxonomies: int, options_pages: int}
	 */
	public static function smb_starter_fixture_counts(): array {
		return array(
			'groups'        => 3,
			'post_types'    => 2,
			'taxonomies'    => 1,
			'options_pages' => 0,
		);
	}

	/** @return array{success: bool, message: string} */
	public static function delete_bundled_window_coverings(): array {
		return self::delete_bundled_json( self::bundled_window_coverings_path() );
	}

	/** @return array{success: bool, message: string} */
	public static function delete_bundled_smb_starter(): array {
		return self::delete_bundled_json( self::bundled_smb_starter_path() );
	}

	/**
	 * Count entities in a bundled JSON file without importing.
	 *
	 * @return array{groups: int, post_types: int, taxonomies: int, options_pages: int}|null
	 */
	public static function count_entities_in_json_file( string $path ): ?array {
		if ( ! is_readable( $path ) ) {
			return null;
		}
		$json = file_get_contents( $path );
		if ( ! is_string( $json ) ) {
			return null;
		}
		$data = json_decode( self::strip_utf8_bom( trim( $json ) ), true );
		if ( ! is_array( $data ) ) {
			return null;
		}
		$counts = array(
			'groups'        => 0,
			'post_types'    => 0,
			'taxonomies'    => 0,
			'options_pages' => 0,
		);
		foreach ( self::unwrap_import_payload( $data ) as $item ) {
			if ( ! is_array( $item ) || empty( $item['key'] ) ) {
				continue;
			}
			$key = (string) $item['key'];
			if ( 0 === strpos( $key, 'group_' ) ) {
				++$counts['groups'];
			} elseif ( 0 === strpos( $key, 'post_type_' ) ) {
				++$counts['post_types'];
			} elseif ( 0 === strpos( $key, 'taxonomy_' ) ) {
				++$counts['taxonomies'];
			} elseif ( 0 === strpos( $key, 'ui_options_page_' ) || 0 === strpos( $key, 'options_page_' ) ) {
				++$counts['options_pages'];
			}
		}
		return $counts;
	}
}
