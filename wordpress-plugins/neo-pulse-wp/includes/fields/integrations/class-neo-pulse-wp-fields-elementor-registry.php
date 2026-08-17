<?php
/**
 * Field discovery for Elementor dynamic tags.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Elementor_Registry {

	private static function include_layout_fields_in_pickers(): bool {
		return class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Settings', false )
			&& Neo_Pulse_Wp_Fields_Elementor_Settings::show_layout_fields();
	}

	/** @var array<int, string> */
	private static $layout_types = array(
		'message',
		'accordion',
		'tab',
		'group',
		'repeater',
		'flexible_content',
		'clone',
	);

	/**
	 * @return array<string, string> menu_slug => label
	 */
	public static function get_options_page_choices(): array {
		$choices = array();
		foreach ( Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_OPTIONS ) as $page ) {
			if ( ! is_array( $page ) || empty( $page['menu_slug'] ) ) {
				continue;
			}
			$slug = (string) $page['menu_slug'];
			$choices[ $slug ] = (string) ( $page['page_title'] ?? $page['menu_title'] ?? $slug );
		}
		return apply_filters( 'neo_pulse_wp_fields_elementor_options_pages', $choices );
	}

	/**
	 * @param array<int, string>|null $types Allowed field types; null = all non-layout.
	 * @return array<string, string> field_key => label
	 */
	/**
	 * @param array<int, string>|null $types Allowed field types.
	 * @return array<string, string> field_key => label
	 */
	public static function get_unified_field_choices( ?array $types = null ): array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-location.php';

		$options_titles = self::get_options_page_choices();
		$post_entries   = array();
		$choices        = array();

		foreach ( Neo_Pulse_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$options_slug = self::options_slug_for_group( $group );
			if ( $options_slug !== null && $options_slug !== '' ) {
				$page_title = $options_titles[ $options_slug ] ?? $options_slug;
				$context    = sprintf(
					/* translators: %s: options page title */
					__( 'Options: %s', 'neo-pulse-wp' ),
					$page_title
				);
				foreach ( self::collect_fields( array( $group ), $types ) as $field ) {
					$name = (string) ( $field['name'] ?? '' );
					if ( $name === '' ) {
						continue;
					}
					$key     = self::options_field_key( $options_slug, $name );
					$choices[ $key ] = self::format_unified_choice_label( $field, $context, $name );
				}
				continue;
			}

			$context_label = self::group_context_label( $group );
			$post_types    = self::post_types_for_group( $group );
			$group_key     = sanitize_key( (string) ( $group['key'] ?? '' ) );
			foreach ( self::collect_fields( array( $group ), $types ) as $field ) {
				$name = (string) ( $field['name'] ?? '' );
				if ( $name === '' ) {
					continue;
				}
				$post_entries[] = array(
					'name'          => $name,
					'field'         => $field,
					'context_label' => $context_label,
					'post_types'    => $post_types,
					'group_key'     => $group_key,
				);
			}
		}

		$name_counts = array();
		foreach ( $post_entries as $entry ) {
			$n = (string) $entry['name'];
			$name_counts[ $n ] = (int) ( $name_counts[ $n ] ?? 0 ) + 1;
		}

		foreach ( $post_entries as $entry ) {
			$name          = (string) $entry['name'];
			$field         = (array) $entry['field'];
			$context_label = (string) $entry['context_label'];
			$post_types    = (array) $entry['post_types'];
			$use_composite = ( $name_counts[ $name ] ?? 0 ) > 1;
			if ( $use_composite && ! empty( $post_types ) ) {
				foreach ( $post_types as $post_type ) {
					$key             = self::post_field_key( (string) $post_type, $name );
					$choices[ $key ] = self::format_unified_choice_label( $field, $context_label, $name );
				}
			} elseif ( $use_composite ) {
				$group_key       = (string) ( $entry['group_key'] ?? '' );
				$disambiguator   = $group_key !== '' ? $group_key : 'group';
				$key             = self::post_field_key( $disambiguator, $name );
				$choices[ $key ] = self::format_unified_choice_label( $field, $context_label, $name );
			} else {
				$choices[ $name ] = self::format_unified_choice_label( $field, $context_label, $name );
			}
		}

		asort( $choices, SORT_NATURAL | SORT_FLAG_CASE );

		return apply_filters( 'neo_pulse_wp_fields_elementor_field_choices', $choices, 'unified', '', $types );
	}

	/**
	 * @return array{field_name: string, options_slug: string, post_type: string}
	 */
	public static function parse_field_key( string $key ): array {
		$key = trim( $key );
		if ( preg_match( '#^post:([^:]+):(.+)$#', $key, $matches ) ) {
			return array(
				'field_name'   => (string) $matches[2],
				'options_slug' => '',
				'post_type'    => sanitize_key( (string) $matches[1] ),
			);
		}
		if ( strpos( $key, '::' ) !== false ) {
			list( $slug, $name ) = self::parse_options_field_key( $key );
			return array(
				'field_name'   => $name,
				'options_slug' => $slug,
				'post_type'    => '',
			);
		}
		return array(
			'field_name'   => $key,
			'options_slug' => '',
			'post_type'    => '',
		);
	}

	public static function post_field_key( string $post_type, string $field_name ): string {
		$post_type   = sanitize_key( $post_type );
		$field_name  = sanitize_key( $field_name );
		if ( $post_type === '' || $field_name === '' ) {
			return $field_name;
		}
		return 'post:' . $post_type . ':' . $field_name;
	}

	/**
	 * @param array<string, mixed> $group Field group.
	 */
	public static function group_context_label( array $group ): string {
		$summary = Neo_Pulse_Wp_Fields_Location::summarize( $group );
		if ( $summary !== '' ) {
			return $summary;
		}
		return (string) ( $group['title'] ?? __( 'Post', 'neo-pulse-wp' ) );
	}

	/**
	 * @param array<string, mixed> $group Field group.
	 * @return array<int, string>
	 */
	public static function post_types_for_group( array $group ): array {
		$types    = array();
		$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
		foreach ( $location as $rule_group ) {
			if ( ! is_array( $rule_group ) ) {
				continue;
			}
			foreach ( $rule_group as $rule ) {
				if ( ! is_array( $rule ) ) {
					continue;
				}
				if ( (string) ( $rule['param'] ?? '' ) !== 'post_type' ) {
					continue;
				}
				if ( (string) ( $rule['operator'] ?? '==' ) === '!=' ) {
					continue;
				}
				$value = sanitize_key( (string) ( $rule['value'] ?? '' ) );
				if ( $value !== '' ) {
					$types[] = $value;
				}
			}
		}
		return array_values( array_unique( $types ) );
	}

	/**
	 * @param array<string, mixed> $group Field group.
	 */
	public static function options_slug_for_group( array $group ): ?string {
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
				$value = sanitize_key( (string) ( $rule['value'] ?? '' ) );
				if ( $value !== '' ) {
					return $value;
				}
			}
		}
		return null;
	}

	/**
	 * @param array<string, mixed> $field         Field config.
	 * @param string               $context_label Context label.
	 */
	private static function format_unified_choice_label( array $field, string $context_label, string $name ): string {
		$label = (string) ( $field['label'] ?? $name );
		$group = (string) ( $field['_group_title'] ?? '' );
		$type  = (string) ( $field['type'] ?? '' );
		$detail = $group !== ''
			? sprintf( '%s » %s » %s (%s)', $context_label, $group, $label, $type )
			: sprintf( '%s » %s (%s)', $context_label, $label, $type );
		return self::format_field_choice_label( $name, $detail );
	}

	public static function get_field_choices( string $context, string $options_slug = '', ?array $types = null ): array {
		if ( $context === 'post'
			&& class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Settings', false )
			&& Neo_Pulse_Wp_Fields_Elementor_Settings::use_unified_field_picker() ) {
			return self::get_unified_field_choices( $types );
		}
		if ( $context === 'options'
			&& class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Settings', false )
			&& Neo_Pulse_Wp_Fields_Elementor_Settings::use_unified_field_picker() ) {
			return self::get_unified_field_choices( $types );
		}
		if ( $context === 'options' ) {
			$choices = array();
			$pages   = self::get_options_page_choices();
			if ( $options_slug !== '' ) {
				$pages = isset( $pages[ $options_slug ] )
					? array( $options_slug => $pages[ $options_slug ] )
					: array();
			}
			foreach ( $pages as $slug => $title ) {
				$groups = self::get_groups_for_context( 'options', (string) $slug );
				foreach ( self::collect_fields( $groups, $types ) as $field ) {
					$name = (string) ( $field['name'] ?? '' );
					if ( $name === '' ) {
						continue;
					}
					$label = (string) ( $field['label'] ?? $name );
					$group = (string) ( $field['_group_title'] ?? '' );
					$type  = (string) ( $field['type'] ?? '' );
					$field_label = $group !== ''
						? sprintf( '%s » %s (%s)', $group, $label, $type )
						: sprintf( '%s (%s)', $label, $type );
					$key = self::options_field_key( (string) $slug, $name );
					$display = count( $pages ) > 1
						? sprintf( '%s — %s', $title, $field_label )
						: $field_label;
					$choices[ $key ] = self::format_field_choice_label( $name, $display );
				}
			}
			return apply_filters( 'neo_pulse_wp_fields_elementor_field_choices', $choices, $context, $options_slug, $types );
		}

		$groups = self::get_groups_for_context( $context, $options_slug );
		$fields = self::collect_fields( $groups, $types );
		$choices = array();
		foreach ( $fields as $field ) {
			$name = (string) ( $field['name'] ?? '' );
			if ( $name === '' ) {
				continue;
			}
			$label = (string) ( $field['label'] ?? $name );
			$group = (string) ( $field['_group_title'] ?? '' );
			$type  = (string) ( $field['type'] ?? '' );
			$detail = $group !== ''
				? sprintf( '%s » %s (%s)', $group, $label, $type )
				: sprintf( '%s (%s)', $label, $type );
			$choices[ $name ] = self::format_field_choice_label( $name, $detail );
		}
		return apply_filters( 'neo_pulse_wp_fields_elementor_field_choices', $choices, $context, $options_slug, $types );
	}

	private static function format_field_choice_label( string $name, string $detail ): string {
		return sprintf( 'NeoPulse_%s — %s', $name, $detail );
	}

	public static function options_field_key( string $options_slug, string $field_name ): string {
		return $options_slug . '::' . $field_name;
	}

	/**
	 * @return array{0: string, 1: string} [options_slug, field_name]
	 */
	public static function parse_options_field_key( string $key ): array {
		if ( strpos( $key, '::' ) !== false ) {
			$parts = explode( '::', $key, 2 );
			return array( (string) $parts[0], (string) ( $parts[1] ?? '' ) );
		}
		return array( '', $key );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_groups_for_context( string $context, string $options_slug = '' ): array {
		$all = Neo_Pulse_Wp_Fields_Storage::get_all_groups( true );
		if ( $context === 'options' ) {
			if ( $options_slug === '' ) {
				return array();
			}
			$screen = array( 'options_page' => $options_slug );
			$matched = array();
			foreach ( $all as $group ) {
				if ( Neo_Pulse_Wp_Fields_Location::matches_group( $group, $screen ) ) {
					$matched[] = $group;
				}
			}
			return $matched;
		}

		$post_id = self::resolve_editor_post_id();
		if ( $post_id < 1 ) {
			return $all;
		}
		$screen  = Neo_Pulse_Wp_Fields_Values::screen_for_post( $post_id );
		$matched = array();
		foreach ( $all as $group ) {
			if ( Neo_Pulse_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				$matched[] = $group;
			}
		}
		return $matched ?: $all;
	}

	/**
	 * @param array<int, array<string, mixed>> $groups Field groups.
	 * @param array<int, string>|null        $types  Allowed types.
	 * @return array<int, array<string, mixed>>
	 */
	public static function collect_fields( array $groups, ?array $types = null ): array {
		$out = array();
		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$group_title = (string) ( $group['title'] ?? '' );
			foreach ( isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array() as $field ) {
				self::collect_field_tree( $field, $group_title, $types, $out );
			}
		}
		return $out;
	}

	/**
	 * @param array<int, array<string, mixed>> $out Output list.
	 */
	private static function collect_field_tree( $field, string $group_title, ?array $types, array &$out, string $prefix = '' ): void {
		if ( ! is_array( $field ) || empty( $field['name'] ) ) {
			return;
		}
		$type = (string) ( $field['type'] ?? '' );
		if ( in_array( $type, self::$layout_types, true ) ) {
			if ( $type === 'group' && ! empty( $field['sub_fields'] ) && is_array( $field['sub_fields'] ) ) {
				$parent = (string) ( $field['label'] ?? $field['name'] );
				foreach ( $field['sub_fields'] as $sub ) {
					self::collect_field_tree( $sub, $group_title, $types, $out, $prefix . $parent . ' » ' );
				}
			}
			if ( ! self::include_layout_fields_in_pickers() ) {
				return;
			}
		}
		if ( is_array( $types ) && ! in_array( $type, $types, true ) ) {
			return;
		}
		$field['_group_title'] = $group_title;
		if ( $prefix !== '' ) {
			$field['label'] = $prefix . (string) ( $field['label'] ?? $field['name'] );
		}
		$out[] = $field;
	}

	public static function resolve_editor_post_id(): int {
		if ( class_exists( '\Elementor\Plugin', false ) ) {
			$plugin = \Elementor\Plugin::$instance;
			if ( isset( $plugin->documents ) ) {
				$doc = $plugin->documents->get_current();
				if ( $doc && method_exists( $doc, 'get_main_id' ) ) {
					$main_id = (int) $doc->get_main_id();
					if ( $main_id > 0 ) {
						return $main_id;
					}
				}
			}
		}
		$post_id = get_the_ID();
		return $post_id ? (int) $post_id : 0;
	}

	/**
	 * @param mixed $value Raw or formatted field value.
	 */
	public static function format_text_value( $value, array $field ): string {
		if ( is_array( $value ) ) {
			if ( isset( $value['url'] ) ) {
				return (string) ( $value['url'] ?? '' );
			}
			if ( isset( $value['label'] ) ) {
				return (string) $value['label'];
			}
			$flat = array();
			foreach ( $value as $item ) {
				if ( is_scalar( $item ) ) {
					$flat[] = (string) $item;
				} elseif ( is_array( $item ) && isset( $item['label'] ) ) {
					$flat[] = (string) $item['label'];
				} elseif ( is_object( $item ) && isset( $item->post_title ) ) {
					$flat[] = (string) $item->post_title;
				}
			}
			return implode( ', ', array_filter( $flat ) );
		}
		if ( is_bool( $value ) ) {
			return $value ? '1' : '0';
		}
		if ( is_object( $value ) && isset( $value->post_title ) ) {
			return (string) $value->post_title;
		}
		return is_scalar( $value ) ? (string) $value : '';
	}

	/**
	 * @param mixed $value Field value.
	 * @return array{id?: int, url?: string}
	 */
	public static function format_image_value( $value ): array {
		if ( is_numeric( $value ) ) {
			$id = (int) $value;
			$url = wp_get_attachment_image_url( $id, 'full' );
			return $id > 0 && $url ? array( 'id' => $id, 'url' => $url ) : array();
		}
		if ( is_string( $value ) && $value !== '' ) {
			return array( 'url' => $value );
		}
		if ( is_array( $value ) ) {
			$id  = (int) ( $value['ID'] ?? $value['id'] ?? 0 );
			$url = (string) ( $value['url'] ?? '' );
			if ( $url === '' && $id > 0 ) {
				$url = (string) wp_get_attachment_image_url( $id, 'full' );
			}
			return $url !== '' ? array_filter( array( 'id' => $id ?: null, 'url' => $url ) ) : array();
		}
		return array();
	}

	/**
	 * @param mixed $value Field value.
	 */
	public static function format_url_value( $value, array $field ): string {
		$type = (string) ( $field['type'] ?? '' );
		if ( is_string( $value ) ) {
			if ( $type === 'email' && $value !== '' && strpos( $value, 'mailto:' ) !== 0 ) {
				return 'mailto:' . $value;
			}
			return $value;
		}
		if ( is_array( $value ) && isset( $value['url'] ) ) {
			return (string) $value['url'];
		}
		if ( is_numeric( $value ) && in_array( $type, array( 'post_object', 'page_link', 'file' ), true ) ) {
			$id = (int) $value;
			if ( $type === 'file' ) {
				return (string) wp_get_attachment_url( $id );
			}
			return (string) get_permalink( $id );
		}
		if ( is_object( $value ) && isset( $value->ID ) ) {
			return (string) get_permalink( (int) $value->ID );
		}
		return '';
	}

	/**
	 * @param mixed $value Field value.
	 * @return array<int, array{id?: int, url: string}>
	 */
	public static function format_gallery_value( $value ): array {
		if ( ! is_array( $value ) ) {
			return array();
		}
		$images = array();
		foreach ( $value as $item ) {
			$formatted = self::format_image_value( $item );
			if ( ! empty( $formatted['url'] ) ) {
				$images[] = $formatted;
			}
		}
		return $images;
	}
}
