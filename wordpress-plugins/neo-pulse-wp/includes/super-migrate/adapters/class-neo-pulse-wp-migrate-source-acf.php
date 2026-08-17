<?php
/**
 * ACF → NEO Pulse Fields Super Migrate adapter.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Migrate_Source_Acf implements Neo_Pulse_Wp_Migrate_Adapter {

	const BATCH_POSTS = 50;

	public function get_id(): string {
		return 'acf';
	}

	public function get_macro_group(): string {
		return 'fields';
	}

	public function get_label(): string {
		return __( 'Advanced Custom Fields', 'neo-pulse-wp' );
	}

	public function is_available(): bool {
		return $this->detect()['active'] || $this->has_local_json();
	}

	/**
	 * @return array<string, mixed>
	 */
	public function detect(): array {
		$active = class_exists( 'Neo_Pulse_Wp_Fields', false ) && Neo_Pulse_Wp_Fields::acf_is_active();
		$info   = array(
			'active'  => $active || $this->has_local_json(),
			'version' => defined( 'ACF_VERSION' ) ? ACF_VERSION : ( defined( 'ACF_PRO' ) ? 'pro' : '' ),
		);
		if ( $this->has_local_json() ) {
			$info['local_json_groups'] = count( Neo_Pulse_Wp_Fields_Local_Json::load_all() );
		}
		return $info;
	}

	public function get_steps( string $phase ): array {
		if ( ! $this->is_available() ) {
			return array();
		}
		if ( 'crawl' === $phase ) {
			$steps = array(
				array(
					'id'    => 'acf_crawl_structure',
					'label' => __( 'Crawl ACF field structure', 'neo-pulse-wp' ),
					'total' => 1,
				),
			);
			if ( $this->acf_plugin_active() ) {
				$steps[] = array(
					'id'    => 'acf_crawl_options_values',
					'label' => __( 'Crawl ACF options page values', 'neo-pulse-wp' ),
					'total' => 1,
				);
				$steps[] = array(
					'id'    => 'acf_crawl_values',
					'label' => __( 'Crawl ACF post field values', 'neo-pulse-wp' ),
					'total' => max( 1, (int) ceil( $this->count_acf_posts() / self::BATCH_POSTS ) ),
				);
			}
			return $steps;
		}
		if ( 'apply' === $phase ) {
			return array(
				array(
					'id'    => 'acf_apply_structure',
					'label' => __( 'Import field structure into NEO Pulse Fields', 'neo-pulse-wp' ),
					'total' => 1,
				),
				array(
					'id'    => 'acf_apply_options_values',
					'label' => __( 'Apply ACF options page values', 'neo-pulse-wp' ),
					'total' => 1,
				),
				array(
					'id'    => 'acf_apply_values',
					'label' => __( 'Apply ACF field values to posts', 'neo-pulse-wp' ),
					'total' => max( 1, (int) ceil( $this->count_sheet_value_posts() / self::BATCH_POSTS ) ),
				),
			);
		}
		return array();
	}

	/**
	 * @param array<string, mixed> $sheet   Flo Sheet.
	 * @param array<string, mixed> $context Job context.
	 */
	public function run_step( string $step_id, string $phase, array &$sheet, array $context ): array {
		$dry = ! empty( $context['dry_run'] );

		if ( 'acf_crawl_structure' === $step_id ) {
			return $this->crawl_structure( $sheet );
		}
		if ( 'acf_crawl_options_values' === $step_id ) {
			return $this->crawl_options_values( $sheet );
		}
		if ( 'acf_crawl_values' === $step_id ) {
			$offset = (int) ( $context['batch_offset'] ?? 0 );
			return $this->crawl_values_batch( $sheet, $offset );
		}
		if ( 'acf_apply_structure' === $step_id ) {
			return $this->apply_structure( $sheet, $dry );
		}
		if ( 'acf_apply_options_values' === $step_id ) {
			return $this->apply_options_values( $sheet, $dry );
		}
		if ( 'acf_apply_values' === $step_id ) {
			$offset = (int) ( $context['batch_offset'] ?? 0 );
			return $this->apply_values_batch( $sheet, $offset, $dry );
		}

		return array(
			'ok'    => false,
			'error' => __( 'Unknown ACF import step.', 'neo-pulse-wp' ),
		);
	}

	private function acf_plugin_active(): bool {
		return self::is_acf_plugin_active();
	}

	/**
	 * Whether ACF (free or Pro) is active.
	 */
	public static function is_acf_plugin_active(): bool {
		return class_exists( 'Neo_Pulse_Wp_Fields', false ) && Neo_Pulse_Wp_Fields::acf_is_active();
	}

	private function has_local_json(): bool {
		return class_exists( 'Neo_Pulse_Wp_Fields_Local_Json', false ) && ! empty( Neo_Pulse_Wp_Fields_Local_Json::load_all() );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function fetch_structure_items(): array {
		$items = array();

		if ( self::is_acf_plugin_active() ) {
			if ( function_exists( 'acf_get_internal_post_type_posts' ) ) {
				foreach ( array(
					'acf-field-group',
					'acf-post-type',
					'acf-taxonomy',
					'acf-ui-options-page',
				) as $acf_post_type ) {
					$items = array_merge( $items, self::fetch_acf_internal_posts( $acf_post_type ) );
				}
			}

			$has_groups = false;
			foreach ( $items as $item ) {
				if ( is_array( $item ) && ! empty( $item['key'] ) && 0 === strpos( (string) $item['key'], 'group_' ) ) {
					$has_groups = true;
					break;
				}
			}

			if ( ! $has_groups && function_exists( 'acf_get_field_groups' ) ) {
				$groups = acf_get_field_groups();
				if ( is_array( $groups ) ) {
					foreach ( $groups as $group ) {
						if ( ! is_array( $group ) || empty( $group['key'] ) ) {
							continue;
						}
						$full = function_exists( 'acf_get_field_group' ) ? acf_get_field_group( $group['key'] ) : $group;
						if ( ! is_array( $full ) ) {
							$full = $group;
						}
						if ( function_exists( 'acf_get_fields' ) ) {
							$full['fields'] = acf_get_fields( $group['key'] );
						}
						$items[] = $full;
					}
				}
			}
		} elseif ( class_exists( 'Neo_Pulse_Wp_Fields_Local_Json', false ) ) {
			$local = Neo_Pulse_Wp_Fields_Local_Json::load_all();
			if ( ! empty( $local ) ) {
				$items = $local;
			}
		}

		return $items;
	}

	/**
	 * Load one ACF internal entity type (field groups, post types, taxonomies, options pages).
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function fetch_acf_internal_posts( string $acf_post_type ): array {
		if ( ! function_exists( 'acf_get_internal_post_type_posts' ) ) {
			return array();
		}

		$posts = acf_get_internal_post_type_posts( $acf_post_type );
		if ( ! is_array( $posts ) || empty( $posts ) ) {
			return array();
		}

		$items = array();
		foreach ( $posts as $post ) {
			if ( ! is_array( $post ) || empty( $post['key'] ) ) {
				continue;
			}
			if ( function_exists( 'acf_prepare_internal_post_type_for_export' ) ) {
				$post = acf_prepare_internal_post_type_for_export( $post, $acf_post_type );
			}
			if ( ! is_array( $post ) || empty( $post['key'] ) ) {
				continue;
			}
			if ( 'acf-field-group' === $acf_post_type && function_exists( 'acf_get_fields' ) && empty( $post['fields'] ) ) {
				$fields = acf_get_fields( $post['key'] );
				if ( is_array( $fields ) ) {
					$post['fields'] = $fields;
				}
			}
			$items[] = $post;
		}

		return $items;
	}

	/**
	 * Split ACF export rows by entity type for Flo Sheet storage.
	 *
	 * @param array<int, array<string, mixed>> $items
	 * @return array{groups: array<int, array<string, mixed>>, post_types: array<int, array<string, mixed>>, taxonomies: array<int, array<string, mixed>>, options_pages: array<int, array<string, mixed>>}
	 */
	public static function categorize_structure_items( array $items ): array {
		$groups        = array();
		$post_types    = array();
		$taxonomies    = array();
		$options_pages = array();

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) || empty( $item['key'] ) ) {
				continue;
			}
			$key = (string) $item['key'];
			if ( 0 === strpos( $key, 'group_' ) ) {
				$groups[] = $item;
			} elseif ( 0 === strpos( $key, 'post_type_' ) ) {
				$post_types[] = $item;
			} elseif ( 0 === strpos( $key, 'taxonomy_' ) ) {
				$taxonomies[] = $item;
			} elseif ( 0 === strpos( $key, 'ui_options_page_' ) || 0 === strpos( $key, 'options_page_' ) ) {
				$options_pages[] = $item;
			}
		}

		return array(
			'groups'        => $groups,
			'post_types'    => $post_types,
			'taxonomies'    => $taxonomies,
			'options_pages' => $options_pages,
		);
	}

	/**
	 * @return array<int, string>
	 */
	public static function resolve_options_page_slugs( array $sheet = array() ): array {
		$slugs = array();

		$fields = isset( $sheet['sheets']['fields'] ) && is_array( $sheet['sheets']['fields'] ) ? $sheet['sheets']['fields'] : array();
		if ( ! empty( $fields['options_pages'] ) && is_array( $fields['options_pages'] ) ) {
			foreach ( $fields['options_pages'] as $page ) {
				if ( is_array( $page ) && ! empty( $page['menu_slug'] ) ) {
					$slugs[] = sanitize_key( (string) $page['menu_slug'] );
				}
			}
		}

		if ( empty( $slugs ) && class_exists( 'Neo_Pulse_Wp_Fields_Storage', false ) ) {
			foreach ( Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_OPTIONS ) as $page ) {
				if ( is_array( $page ) && ! empty( $page['menu_slug'] ) ) {
					$slugs[] = sanitize_key( (string) $page['menu_slug'] );
				}
			}
		}

		if ( empty( $slugs ) ) {
			foreach ( self::categorize_structure_items( self::fetch_structure_items() )['options_pages'] as $page ) {
				if ( is_array( $page ) && ! empty( $page['menu_slug'] ) ) {
					$slugs[] = sanitize_key( (string) $page['menu_slug'] );
				}
			}
		}

		foreach ( self::fetch_acf_registered_options_pages() as $page ) {
			if ( is_array( $page ) && ! empty( $page['menu_slug'] ) ) {
				$slugs[] = sanitize_key( (string) $page['menu_slug'] );
			}
		}

		$slugs = array_merge( $slugs, self::collect_options_page_slugs_from_groups( self::resolve_field_groups( $sheet ) ) );

		return array_values( array_unique( array_filter( $slugs ) ) );
	}

	/**
	 * Extract options page slugs referenced by field group location rules.
	 *
	 * @param array<int, array<string, mixed>> $groups
	 * @return array<int, string>
	 */
	public static function collect_options_page_slugs_from_groups( array $groups ): array {
		$slugs = array();
		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
			foreach ( $location as $rule_group ) {
				if ( ! is_array( $rule_group ) ) {
					continue;
				}
				foreach ( $rule_group as $rule ) {
					if ( ! is_array( $rule ) ) {
						continue;
					}
					if ( (string) ( $rule['param'] ?? '' ) !== 'options_page' ) {
						continue;
					}
					if ( (string) ( $rule['operator'] ?? '==' ) === '!=' ) {
						continue;
					}
					$value = (string) ( $rule['value'] ?? '' );
					if ( $value !== '' ) {
						$slugs[] = sanitize_key( $value );
					}
				}
			}
		}
		return array_values( array_unique( array_filter( $slugs ) ) );
	}

	/**
	 * Code-registered ACF options pages (acf_add_options_page), not always stored as ui_options_page entities.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function fetch_acf_registered_options_pages(): array {
		if ( ! function_exists( 'acf_get_options_pages' ) ) {
			return array();
		}
		$pages = acf_get_options_pages();
		if ( ! is_array( $pages ) || empty( $pages ) ) {
			return array();
		}

		$out = array();
		foreach ( $pages as $slug => $page ) {
			if ( ! is_array( $page ) ) {
				continue;
			}
			if ( empty( $page['menu_slug'] ) && is_string( $slug ) && $slug !== '' ) {
				$page['menu_slug'] = $slug;
			}
			$out[] = $page;
		}
		return $out;
	}

	/**
	 * Ensure every referenced options slug has a page definition for Flo Sheet import.
	 *
	 * @param array<int, string>               $slugs
	 * @param array<int, array<string, mixed>> $existing_pages
	 * @return array<int, array<string, mixed>>
	 */
	public static function synthesize_options_pages_from_slugs( array $slugs, array $existing_pages ): array {
		$known = array();
		foreach ( $existing_pages as $page ) {
			if ( is_array( $page ) && ! empty( $page['menu_slug'] ) ) {
				$known[ sanitize_key( (string) $page['menu_slug'] ) ] = true;
			}
		}

		foreach ( self::fetch_acf_registered_options_pages() as $page ) {
			if ( ! is_array( $page ) || empty( $page['menu_slug'] ) ) {
				continue;
			}
			$slug = sanitize_key( (string) $page['menu_slug'] );
			if ( isset( $known[ $slug ] ) ) {
				continue;
			}
			$existing_pages[] = $page;
			$known[ $slug ]     = true;
		}

		foreach ( $slugs as $slug ) {
			$slug = sanitize_key( (string) $slug );
			if ( $slug === '' || isset( $known[ $slug ] ) ) {
				continue;
			}
			$label              = ucwords( str_replace( array( '-', '_' ), ' ', $slug ) );
			$existing_pages[] = array(
				'key'        => 'ui_options_page_' . $slug,
				'menu_slug'  => $slug,
				'page_title' => $label,
				'menu_title' => $label,
				'active'     => true,
			);
			$known[ $slug ] = true;
		}

		return $existing_pages;
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function resolve_field_groups( array $sheet = array() ): array {
		$fields = isset( $sheet['sheets']['fields'] ) && is_array( $sheet['sheets']['fields'] ) ? $sheet['sheets']['fields'] : array();
		if ( ! empty( $fields['groups'] ) && is_array( $fields['groups'] ) ) {
			return $fields['groups'];
		}
		if ( class_exists( 'Neo_Pulse_Wp_Fields_Storage', false ) ) {
			return Neo_Pulse_Wp_Fields_Storage::get_all_groups( true );
		}
		return array();
	}

	/**
	 * @param array<int, array<string, mixed>> $groups
	 * @return array<int, array<string, mixed>>
	 */
	public static function top_level_fields_for_options_page( array $groups, string $menu_slug ): array {
		$screen = array( 'options_page' => $menu_slug );
		$fields = array();
		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) || ! class_exists( 'Neo_Pulse_Wp_Fields_Location', false ) ) {
				continue;
			}
			if ( ! Neo_Pulse_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				continue;
			}
			foreach ( self::top_level_fields( isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array() ) as $field ) {
				$fields[] = $field;
			}
		}
		return $fields;
	}

	/**
	 * @param array<int, array<string, mixed>> $groups
	 * @return array<int, array<string, mixed>>
	 */
	public static function top_level_fields_for_post( array $groups, int $post_id ): array {
		if ( $post_id < 1 || ! class_exists( 'Neo_Pulse_Wp_Fields_Values', false ) ) {
			return array();
		}
		$screen = Neo_Pulse_Wp_Fields_Values::screen_for_post( $post_id );
		$fields = array();
		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) || ! class_exists( 'Neo_Pulse_Wp_Fields_Location', false ) ) {
				continue;
			}
			if ( ! Neo_Pulse_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				continue;
			}
			foreach ( self::top_level_fields( isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array() ) as $field ) {
				$fields[] = $field;
			}
		}
		return $fields;
	}

	/**
	 * @param array<int, array<string, mixed>> $fields
	 * @return array<int, array<string, mixed>>
	 */
	public static function top_level_fields( array $fields ): array {
		$out = array();
		foreach ( $fields as $field ) {
			if ( is_array( $field ) && ! empty( $field['name'] ) ) {
				$out[] = $field;
			}
		}
		return $out;
	}

	/**
	 * Option key prefixes ACF may use in wp_options.
	 *
	 * @return array<int, string>
	 */
	public static function acf_option_key_prefixes( string $menu_slug ): array {
		$slug = sanitize_key( $menu_slug );
		return array_values(
			array_unique(
				array_filter(
					array(
						$slug . '_',
						$menu_slug . '_',
						'options_',
						'option_',
					)
				)
			)
		);
	}

	/**
	 * Read a raw ACF options page field value.
	 *
	 * @param array<string, mixed> $field
	 * @return mixed
	 */
	public static function read_acf_option_value( array $field, string $menu_slug ) {
		$name = (string) ( $field['name'] ?? '' );
		if ( $name === '' ) {
			return null;
		}

		$post_ids = array_values(
			array_unique(
				array_filter(
					array(
						$menu_slug,
						sanitize_key( $menu_slug ),
						'options',
						'option',
					)
				)
			)
		);

		if ( function_exists( 'get_field' ) ) {
			foreach ( $post_ids as $post_id ) {
				$value = get_field( $name, $post_id, false );
				if ( self::acf_value_is_present( $value ) ) {
					return $value;
				}
			}
		}

		foreach ( self::acf_option_storage_keys( $menu_slug, $name ) as $option_key ) {
			if ( self::option_key_exists( $option_key ) ) {
				return get_option( $option_key );
			}
		}

		return null;
	}

	/**
	 * @return array<int, string>
	 */
	public static function acf_option_storage_keys( string $menu_slug, string $field_name ): array {
		$keys = array();
		foreach ( self::acf_option_key_prefixes( $menu_slug ) as $prefix ) {
			$keys[] = $prefix . $field_name;
		}
		return array_values( array_unique( $keys ) );
	}

	public static function acf_option_key_exists( string $menu_slug, string $field_name, string $post_id = '' ): bool {
		if ( $post_id !== '' && $post_id !== 'options' && $post_id !== 'option' ) {
			if ( self::option_key_exists( $post_id . '_' . $field_name ) ) {
				return true;
			}
			if ( self::option_key_exists( '_' . $post_id . '_' . $field_name ) ) {
				return true;
			}
		}
		foreach ( self::acf_option_storage_keys( $menu_slug, $field_name ) as $option_key ) {
			if ( self::option_key_exists( $option_key ) ) {
				return true;
			}
		}
		return false;
	}

	public static function option_key_exists( string $option_key ): bool {
		if ( $option_key === '' ) {
			return false;
		}
		return get_option( $option_key, null ) !== null;
	}

	/**
	 * @param mixed $value Raw ACF value.
	 */
	public static function acf_value_is_present( $value ): bool {
		if ( $value === null || $value === false ) {
			return false;
		}
		if ( $value === '' || $value === array() ) {
			return false;
		}
		return true;
	}

	/**
	 * Crawl options page values directly from wp_options when get_field misses them.
	 *
	 * @return array<string, mixed>
	 */
	public static function crawl_raw_options_from_db( string $menu_slug ): array {
		$values   = array();
		$prefixes = self::acf_option_key_prefixes( $menu_slug );
		$all      = wp_load_alloptions();
		if ( ! is_array( $all ) ) {
			return $values;
		}

		foreach ( $all as $key => $val ) {
			if ( ! is_string( $key ) || $key === '' || $key[0] === '_' ) {
				continue;
			}
			foreach ( $prefixes as $prefix ) {
				if ( strpos( $key, $prefix ) !== 0 ) {
					continue;
				}
				$name = substr( $key, strlen( $prefix ) );
				if ( $name === '' || $name[0] === '_' ) {
					break;
				}
				$values[ $name ] = maybe_unserialize( $val );
				break;
			}
		}

		return $values;
	}

	/**
	 * @param array<int, array<string, mixed>> $groups
	 * @return array<string, array<string, mixed>>
	 */
	public static function indexed_fields_for_options_page( array $groups, string $menu_slug ): array {
		$fields = array();
		foreach ( self::top_level_fields_for_options_page( $groups, $menu_slug ) as $field ) {
			if ( is_array( $field ) && ! empty( $field['name'] ) ) {
				$fields[ (string) $field['name'] ] = $field;
			}
		}
		return $fields;
	}

	/**
	 * Resolve field configs for applying crawled options values.
	 *
	 * @param array<string, mixed>             $values Crawled values keyed by field name.
	 * @param array<int, array<string, mixed>> $groups Field groups.
	 * @return array<int, array<string, mixed>>
	 */
	public static function fields_for_options_apply( array $groups, string $menu_slug, array $values ): array {
		$indexed = self::indexed_fields_for_options_page( $groups, $menu_slug );
		if ( empty( $indexed ) && class_exists( 'Neo_Pulse_Wp_Fields_Storage', false ) ) {
			$indexed = self::indexed_fields_for_options_page(
				Neo_Pulse_Wp_Fields_Storage::get_all_groups( true ),
				$menu_slug
			);
		}

		$fields = array();
		foreach ( array_keys( $values ) as $name ) {
			$name = (string) $name;
			if ( $name === '' || $name[0] === '_' ) {
				continue;
			}
			if ( isset( $indexed[ $name ] ) ) {
				$fields[] = $indexed[ $name ];
				continue;
			}
			if ( class_exists( 'Neo_Pulse_Wp_Fields_Values', false ) ) {
				$found = Neo_Pulse_Wp_Fields_Values::find_field( $name );
				if ( is_array( $found ) ) {
					$fields[] = $found;
					continue;
				}
			}
			$fields[] = array(
				'name' => $name,
				'type' => 'text',
				'key'  => '',
			);
		}

		return $fields;
	}

	/**
	 * Read a raw ACF field value (post ID or options page slug).
	 *
	 * @param array<string, mixed> $field
	 * @param int|string           $post_id
	 * @return mixed
	 */
	public static function read_acf_value( array $field, $post_id ) {
		$name = (string) ( $field['name'] ?? '' );
		if ( $name === '' ) {
			return null;
		}
		if ( is_string( $post_id ) && $post_id !== '' && ! is_numeric( $post_id ) ) {
			return self::read_acf_option_value( $field, $post_id );
		}
		if ( function_exists( 'get_field' ) ) {
			return get_field( $name, $post_id, false );
		}
		if ( is_int( $post_id ) || is_numeric( $post_id ) ) {
			return get_post_meta( (int) $post_id, $name, true );
		}
		return get_option( (string) $post_id . '_' . $name, null );
	}

	/**
	 * @param array<int, array<string, mixed>> $fields
	 * @param int|string                       $post_id
	 * @return array<string, mixed>
	 */
	public static function crawl_field_values_for_target( array $fields, $post_id ): array {
		$values = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) ) {
				continue;
			}
			$name = (string) $field['name'];
			$value = self::read_acf_value( $field, $post_id );
			if ( ! self::acf_value_is_present( $value ) ) {
				if ( is_int( $post_id ) || is_numeric( $post_id ) ) {
					if ( ! metadata_exists( 'post', (int) $post_id, $name ) ) {
						continue;
					}
				} elseif ( ! self::acf_option_key_exists( (string) $post_id, $name ) ) {
					continue;
				}
			}
			$values[ $name ] = $value;
		}
		return $values;
	}

	/**
	 * @param array<int, array<string, mixed>> $fields
	 */
	public static function apply_field_values_to_post( int $post_id, array $fields, array $values, bool $dry = false ): int {
		self::load_values_dependencies();
		$updated = 0;
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) ) {
				continue;
			}
			$name = (string) $field['name'];
			if ( ! array_key_exists( $name, $values ) ) {
				continue;
			}
			if ( $dry ) {
				++$updated;
				continue;
			}
			if ( Neo_Pulse_Wp_Fields_Values::update_value( $post_id, $field, $values[ $name ] ) ) {
				++$updated;
			}
		}
		return $updated;
	}

	/**
	 * @param array<int, array<string, mixed>> $fields
	 */
	public static function apply_field_values_to_options( string $menu_slug, array $fields, array $values, bool $dry = false ): int {
		self::load_values_dependencies();
		$updated = 0;
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) ) {
				continue;
			}
			$name = (string) $field['name'];
			if ( ! array_key_exists( $name, $values ) ) {
				continue;
			}
			if ( $dry ) {
				++$updated;
				continue;
			}
			Neo_Pulse_Wp_Fields_Values::update_option( $menu_slug, $field, $values[ $name ] );
			++$updated;
		}
		return $updated;
	}

	private static function load_values_dependencies(): void {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-location.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/interface-neo-pulse-wp-field-type.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-field-type-base.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/field-types/loader.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-registry.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-validation.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-values.php';
	}

	/**
	 * @return array<int, string>
	 */
	public static function acf_import_post_types(): array {
		if ( ! function_exists( 'get_post_types' ) ) {
			return array( 'post', 'page' );
		}
		$exclude = array(
			'revision',
			'attachment',
			'nav_menu_item',
			'custom_css',
			'customize_changeset',
			'oembed_cache',
			'user_request',
			'wp_block',
			'acf-field-group',
			'acf-field',
			'acf-post-type',
			'acf-taxonomy',
			'acf-ui-options-page',
		);
		$types = get_post_types( array(), 'names' );
		if ( ! is_array( $types ) ) {
			return array( 'post', 'page' );
		}
		return array_values( array_diff( $types, $exclude ) );
	}

	/**
	 * @return array<int, string>
	 */
	public static function acf_source_group_keys(): array {
		$keys = array();
		foreach ( self::fetch_structure_items() as $item ) {
			if ( ! is_array( $item ) || empty( $item['key'] ) ) {
				continue;
			}
			$key = (string) $item['key'];
			if ( 0 === strpos( $key, 'group_' ) ) {
				$keys[] = $key;
			}
		}

		return array_values( array_unique( $keys ) );
	}

	/**
	 * Import ACF field structure (groups, post types, taxonomies, options pages).
	 *
	 * @return array{ok: bool, error?: string, stats?: array<string, int>, message?: string}
	 */
	public static function import_structure_from_sources(): array {
		$items = array();
		foreach ( self::fetch_structure_items() as $item ) {
			if ( is_array( $item ) && ! empty( $item['key'] ) ) {
				$items[] = $item;
			}
		}

		if ( empty( $items ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'No ACF field structure found to import.', 'neo-pulse-wp' ),
			);
		}

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-import-export.php';
		$json   = wp_json_encode( array_values( $items ) );
		$result = Neo_Pulse_Wp_Fields_Import_Export::import_json_string( is_string( $json ) ? $json : '[]', false );

		return array(
			'ok'      => ! empty( $result['success'] ),
			'message' => isset( $result['message'] ) ? (string) $result['message'] : '',
			'error'   => empty( $result['success'] ) ? (string) ( $result['message'] ?? __( 'ACF structure import failed.', 'neo-pulse-wp' ) ) : '',
			'stats'   => isset( $result['stats'] ) && is_array( $result['stats'] ) ? $result['stats'] : array(),
		);
	}

	/**
	 * One-click import: ACF structure plus post field values when ACF is active.
	 *
	 * @return array{ok: bool, error?: string, stats?: array<string, int>, message?: string}
	 */
	public static function import_all_from_database(): array {
		$adapter = new self();
		if ( ! $adapter->is_available() ) {
			return array(
				'ok'    => false,
				'error' => __( 'ACF is not installed and no ACF local JSON was found.', 'neo-pulse-wp' ),
			);
		}

		$structure = self::import_structure_from_sources();
		if ( empty( $structure['ok'] ) ) {
			return $structure;
		}

		$value_stats = array(
			'post_values_updated'     => 0,
			'post_values_skipped'     => 0,
			'options_values_updated'  => 0,
			'options_values_skipped'  => 0,
			'values_updated'          => 0,
			'values_skipped'          => 0,
		);

		if ( self::is_acf_plugin_active() && function_exists( 'get_posts' ) && function_exists( 'get_field' ) ) {
			$sheet = array( 'sheets' => array() );

			$crawl_opts = $adapter->run_step( 'acf_crawl_options_values', 'crawl', $sheet, array() );
			if ( ! empty( $crawl_opts['ok'] ) ) {
				$apply_opts = $adapter->run_step( 'acf_apply_options_values', 'apply', $sheet, array() );
				if ( ! empty( $apply_opts['ok'] ) ) {
					$value_stats['options_values_updated'] = (int) ( $apply_opts['stats']['updated'] ?? 0 );
					$value_stats['options_values_skipped'] = (int) ( $apply_opts['stats']['skipped'] ?? 0 );
				}
			}

			$offset   = 0;
			$crawl_ok = true;

			do {
				$crawl = $adapter->run_step( 'acf_crawl_values', 'crawl', $sheet, array( 'batch_offset' => $offset ) );
				if ( empty( $crawl['ok'] ) ) {
					$crawl_ok = false;
					break;
				}
				$offset += self::BATCH_POSTS;
			} while ( empty( $crawl['done'] ) );

			if ( $crawl_ok ) {
				$apply_offset = 0;
				do {
					$apply_val = $adapter->run_step( 'acf_apply_values', 'apply', $sheet, array( 'batch_offset' => $apply_offset ) );
					if ( empty( $apply_val['ok'] ) ) {
						break;
					}
					$value_stats['post_values_updated'] += (int) ( $apply_val['stats']['updated'] ?? 0 );
					$value_stats['post_values_skipped'] += (int) ( $apply_val['stats']['skipped'] ?? 0 );
					$apply_offset += self::BATCH_POSTS;
				} while ( empty( $apply_val['done'] ) );
			}
		}

		$value_stats['values_updated'] = $value_stats['post_values_updated'] + $value_stats['options_values_updated'];
		$value_stats['values_skipped'] = $value_stats['post_values_skipped'] + $value_stats['options_values_skipped'];

		$stats = array_merge(
			isset( $structure['stats'] ) && is_array( $structure['stats'] ) ? $structure['stats'] : array(),
			$value_stats
		);

		return array(
			'ok'      => true,
			'message' => isset( $structure['message'] ) ? (string) $structure['message'] : '',
			'stats'   => $stats,
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 * @return array{ok: bool, done: bool, message?: string, stats?: array<string, int>}
	 */
	private function crawl_structure( array &$sheet ): array {
		$items  = self::fetch_structure_items();
		$split  = self::categorize_structure_items( $items );
		$groups = $split['groups'];
		$post_types = $split['post_types'];
		$taxonomies = $split['taxonomies'];
		$options_pages = $split['options_pages'];
		$options_pages = self::synthesize_options_pages_from_slugs(
			self::collect_options_page_slugs_from_groups( $groups ),
			$options_pages
		);

		$sheet['sheets']['fields'] = array(
			'groups'        => $groups,
			'post_types'    => $post_types,
			'taxonomies'    => $taxonomies,
			'options_pages' => $options_pages,
		);

		return array(
			'ok'      => true,
			'done'    => true,
			'message' => sprintf(
				/* translators: 1: field groups, 2: post types, 3: taxonomies, 4: options pages */
				__( 'Crawled %1$d field group(s), %2$d post type(s), %3$d taxonomy(ies), %4$d options page(s).', 'neo-pulse-wp' ),
				count( $groups ),
				count( $post_types ),
				count( $taxonomies ),
				count( $options_pages )
			),
			'stats'   => array(
				'groups'        => count( $groups ),
				'post_types'    => count( $post_types ),
				'taxonomies'    => count( $taxonomies ),
				'options_pages' => count( $options_pages ),
			),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 * @return array{ok: bool, done: bool, message?: string, stats?: array<string, int>}
	 */
	private function crawl_options_values( array &$sheet ): array {
		if ( ! function_exists( 'get_field' ) ) {
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'ACF get_field unavailable; skipped options value crawl.', 'neo-pulse-wp' ),
			);
		}

		$groups = self::resolve_field_groups( $sheet );
		$slugs  = self::resolve_options_page_slugs( $sheet );
		if ( empty( $slugs ) ) {
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'No ACF options pages to crawl.', 'neo-pulse-wp' ),
				'stats'   => array( 'pages' => 0 ),
			);
		}

		if ( ! isset( $sheet['sheets']['field_values']['options'] ) || ! is_array( $sheet['sheets']['field_values']['options'] ) ) {
			$sheet['sheets']['field_values']['options'] = array();
		}

		$field_count = 0;
		foreach ( $slugs as $slug ) {
			$fields = self::top_level_fields_for_options_page( $groups, $slug );
			$values = self::crawl_field_values_for_target( $fields, $slug );
			if ( empty( $values ) && function_exists( 'get_fields' ) ) {
				foreach ( array( $slug, sanitize_key( $slug ), 'options', 'option' ) as $acf_post_id ) {
					$acf_values = get_fields( $acf_post_id, false );
					if ( ! is_array( $acf_values ) || empty( $acf_values ) ) {
						continue;
					}
					foreach ( $acf_values as $key => $value ) {
						if ( is_string( $key ) && $key !== '' && $key[0] !== '_' ) {
							$values[ $key ] = $value;
						}
					}
					if ( ! empty( $values ) ) {
						break;
					}
				}
			}
			if ( empty( $values ) ) {
				$values = self::crawl_raw_options_from_db( $slug );
			}
			$field_count += count( $values );
			$sheet['sheets']['field_values']['options'][] = array(
				'menu_slug' => $slug,
				'fields'    => $values,
			);
		}

		return array(
			'ok'      => true,
			'done'    => true,
			'message' => sprintf(
				/* translators: 1: options page count, 2: field count */
				__( 'Crawled options values for %1$d page(s), %2$d field(s).', 'neo-pulse-wp' ),
				count( $slugs ),
				$field_count
			),
			'stats'   => array(
				'pages'  => count( $slugs ),
				'fields' => $field_count,
			),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 */
	private function crawl_values_batch( array &$sheet, int $offset ): array {
		if ( ! function_exists( 'get_posts' ) || ! function_exists( 'get_field' ) ) {
			return array(
				'ok'   => true,
				'done' => true,
				'message' => __( 'ACF get_field unavailable; skipped value crawl.', 'neo-pulse-wp' ),
			);
		}

		$post_ids = get_posts(
			array(
				'post_type'      => self::acf_import_post_types(),
				'post_status'    => array( 'publish', 'draft', 'private', 'pending', 'future' ),
				'posts_per_page' => self::BATCH_POSTS,
				'offset'         => $offset,
				'fields'         => 'ids',
				'orderby'        => 'ID',
				'order'          => 'ASC',
			)
		);

		if ( ! is_array( $post_ids ) || empty( $post_ids ) ) {
			return array(
				'ok'   => true,
				'done' => true,
				'message' => __( 'ACF value crawl complete.', 'neo-pulse-wp' ),
			);
		}

		if ( ! isset( $sheet['sheets']['field_values']['posts'] ) || ! is_array( $sheet['sheets']['field_values']['posts'] ) ) {
			$sheet['sheets']['field_values']['posts'] = array();
		}

		$groups = self::resolve_field_groups( $sheet );

		foreach ( $post_ids as $post_id ) {
			$post_id = (int) $post_id;
			$fields  = self::top_level_fields_for_post( $groups, $post_id );
			$values  = self::crawl_field_values_for_target( $fields, $post_id );
			if ( empty( $values ) && function_exists( 'get_fields' ) ) {
				$acf_values = get_fields( $post_id );
				if ( is_array( $acf_values ) ) {
					foreach ( $acf_values as $key => $value ) {
						if ( is_string( $key ) && $key !== '' && $key[0] !== '_' ) {
							$values[ $key ] = $value;
						}
					}
				}
			}
			if ( empty( $values ) ) {
				continue;
			}
			$sheet['sheets']['field_values']['posts'][] = array(
				'post_id' => $post_id,
				'fields'  => $values,
			);
		}

		$done = count( $post_ids ) < self::BATCH_POSTS;

		return array(
			'ok'      => true,
			'done'    => $done,
			'message' => sprintf(
				/* translators: %d: batch size */
				__( 'Crawled ACF values for %d post(s).', 'neo-pulse-wp' ),
				count( $post_ids )
			),
			'stats'   => array(
				'processed' => count( $post_ids ),
			),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 */
	private function apply_structure( array $sheet, bool $dry ): array {
		$fields = isset( $sheet['sheets']['fields'] ) && is_array( $sheet['sheets']['fields'] ) ? $sheet['sheets']['fields'] : array();
		$items  = array();
		foreach ( array( 'groups', 'post_types', 'taxonomies', 'options_pages' ) as $key ) {
			if ( ! empty( $fields[ $key ] ) && is_array( $fields[ $key ] ) ) {
				foreach ( $fields[ $key ] as $item ) {
					if ( is_array( $item ) ) {
						$items[] = $item;
					}
				}
			}
		}
		if ( empty( $items ) ) {
			if ( ! $dry ) {
				$direct = self::import_structure_from_sources();
				if ( ! empty( $direct['ok'] ) ) {
					return array(
						'ok'      => true,
						'done'    => true,
						'message' => isset( $direct['message'] ) ? (string) $direct['message'] : __( 'ACF structure imported.', 'neo-pulse-wp' ),
						'stats'   => isset( $direct['stats'] ) && is_array( $direct['stats'] ) ? $direct['stats'] : array(),
					);
				}
			}
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'No ACF structure to import.', 'neo-pulse-wp' ),
				'stats'   => array( 'skipped' => 1 ),
			);
		}
		if ( $dry ) {
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => sprintf(
					/* translators: %d: entity count */
					__( 'Dry run: would import %d ACF entities.', 'neo-pulse-wp' ),
					count( $items )
				),
				'stats'   => array( 'would_import' => count( $items ) ),
			);
		}

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-import-export.php';
		$json   = wp_json_encode( array_values( $items ) );
		$result = Neo_Pulse_Wp_Fields_Import_Export::import_json_string( is_string( $json ) ? $json : '[]', false );

		return array(
			'ok'      => ! empty( $result['success'] ),
			'done'    => true,
			'message' => isset( $result['message'] ) ? (string) $result['message'] : '',
			'error'   => empty( $result['success'] ) ? (string) ( $result['message'] ?? '' ) : '',
			'stats'   => isset( $result['stats'] ) && is_array( $result['stats'] ) ? $result['stats'] : array(),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 */
	private function apply_options_values( array $sheet, bool $dry ): array {
		$pages = isset( $sheet['sheets']['field_values']['options'] ) && is_array( $sheet['sheets']['field_values']['options'] )
			? $sheet['sheets']['field_values']['options']
			: array();

		if ( empty( $pages ) && ! $dry && self::is_acf_plugin_active() && function_exists( 'get_field' ) ) {
			$crawl_sheet = $sheet;
			$this->crawl_options_values( $crawl_sheet );
			$pages = isset( $crawl_sheet['sheets']['field_values']['options'] ) && is_array( $crawl_sheet['sheets']['field_values']['options'] )
				? $crawl_sheet['sheets']['field_values']['options']
				: array();
		}

		if ( empty( $pages ) ) {
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'No ACF options page values to apply.', 'neo-pulse-wp' ),
			);
		}

		$groups  = self::resolve_field_groups( $sheet );
		$updated = 0;
		$skipped = 0;

		foreach ( $pages as $row ) {
			if ( ! is_array( $row ) || empty( $row['menu_slug'] ) || ! is_array( $row['fields'] ?? null ) ) {
				++$skipped;
				continue;
			}
			$slug    = sanitize_key( (string) $row['menu_slug'] );
			$values  = is_array( $row['fields'] ) ? $row['fields'] : array();
			$fields  = self::fields_for_options_apply( $groups, $slug, $values );
			if ( empty( $fields ) || empty( $values ) ) {
				++$skipped;
				continue;
			}
			$updated += self::apply_field_values_to_options( $slug, $fields, $values, $dry );
		}

		return array(
			'ok'      => true,
			'done'    => true,
			'message' => sprintf(
				/* translators: 1: updated count, 2: skipped count */
				__( 'Applied ACF options values: %1$d field(s) updated, %2$d page(s) skipped.', 'neo-pulse-wp' ),
				$updated,
				$skipped
			),
			'stats'   => array(
				'updated' => $updated,
				'skipped' => $skipped,
			),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 */
	private function apply_values_batch( array $sheet, int $offset, bool $dry ): array {
		$posts = isset( $sheet['sheets']['field_values']['posts'] ) && is_array( $sheet['sheets']['field_values']['posts'] )
			? $sheet['sheets']['field_values']['posts']
			: array();
		$batch = array_slice( $posts, $offset, self::BATCH_POSTS );
		if ( empty( $batch ) ) {
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'No ACF field values to apply.', 'neo-pulse-wp' ),
			);
		}

		$groups  = self::resolve_field_groups( $sheet );
		$updated = 0;
		$skipped = 0;

		foreach ( $batch as $row ) {
			if ( ! is_array( $row ) || empty( $row['post_id'] ) || ! is_array( $row['fields'] ?? null ) ) {
				++$skipped;
				continue;
			}
			$post_id = (int) $row['post_id'];
			if ( $post_id < 1 || ! get_post( $post_id ) ) {
				++$skipped;
				continue;
			}
			$fields = self::top_level_fields_for_post( $groups, $post_id );
			if ( empty( $fields ) ) {
				++$skipped;
				continue;
			}
			$updated += self::apply_field_values_to_post( $post_id, $fields, $row['fields'], $dry );
		}

		$done = ( $offset + count( $batch ) ) >= count( $posts );

		return array(
			'ok'      => true,
			'done'    => $done,
			'message' => sprintf(
				/* translators: 1: updated count, 2: skipped count */
				__( 'Applied ACF post values: %1$d field(s) updated, %2$d post(s) skipped.', 'neo-pulse-wp' ),
				$updated,
				$skipped
			),
			'stats'   => array(
				'updated' => $updated,
				'skipped' => $skipped,
			),
		);
	}

	private function count_acf_posts(): int {
		if ( ! function_exists( 'wp_count_posts' ) ) {
			return 0;
		}
		$total = 0;
		foreach ( self::acf_import_post_types() as $type ) {
			$counts = wp_count_posts( $type );
			if ( is_object( $counts ) ) {
				foreach ( array( 'publish', 'draft', 'private', 'pending', 'future' ) as $st ) {
					$total += isset( $counts->$st ) ? (int) $counts->$st : 0;
				}
			}
		}
		return max( 1, $total );
	}

	private function count_sheet_value_posts(): int {
		$sheet = Neo_Pulse_Wp_Neo_Pulse_Sheet::get();
		$posts = isset( $sheet['sheets']['field_values']['posts'] ) && is_array( $sheet['sheets']['field_values']['posts'] )
			? $sheet['sheets']['field_values']['posts']
			: array();
		return max( 1, count( $posts ) );
	}
}
