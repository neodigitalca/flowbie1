<?php
/**
 * Register NEO Pulse field keys with register_post_meta for REST / Elementor discovery.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Post_Meta_Registry {

	/** @var array<int, string> */
	private static $layout_types = array(
		'message',
		'accordion',
		'tab',
		'repeater',
		'flexible_content',
		'clone',
	);

	public static function init(): void {
		if ( Neo_Pulse_Wp_Fields::acf_is_active() ) {
			return;
		}
		add_action( 'init', array( __CLASS__, 'register_field_meta' ), 20 );
	}

	public static function register_field_meta(): void {
		/** @var array<string, true> $registered */
		$registered = array();

		foreach ( Neo_Pulse_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( empty( $group['active'] ) ) {
				continue;
			}
			$post_types = self::post_types_for_group( $group );
			if ( empty( $post_types ) ) {
				continue;
			}
			$fields = self::collect_registerable_fields( isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array() );
			foreach ( $post_types as $post_type ) {
				if ( ! post_type_exists( $post_type ) ) {
					continue;
				}
				foreach ( $fields as $field ) {
					$name = (string) ( $field['name'] ?? '' );
					if ( $name === '' ) {
						continue;
					}
					$key = $post_type . ':' . $name;
					if ( isset( $registered[ $key ] ) ) {
						continue;
					}
					register_post_meta(
						$post_type,
						$name,
						array(
							'single'        => true,
							'type'          => self::meta_type_for_field( $field ),
							'description'   => self::meta_label_for_field( $name, $field ),
							'show_in_rest'  => array(
								'schema' => array(
									'type'  => self::meta_type_for_field( $field ),
									'title' => self::meta_label_for_field( $name, $field ),
								),
							),
							'auth_callback' => static function () {
								return current_user_can( 'edit_posts' );
							},
						)
					);
					$registered[ $key ] = true;
				}
			}
		}
	}

	/**
	 * @param array<string, mixed> $group Field group.
	 * @return array<int, string>
	 */
	public static function post_types_for_group( array $group ): array {
		$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
		$post_types = array();
		foreach ( $location as $rule_group ) {
			if ( ! is_array( $rule_group ) ) {
				continue;
			}
			$types = self::post_types_for_rule_group( $rule_group );
			foreach ( $types as $type ) {
				$post_types[ $type ] = true;
			}
		}
		return array_keys( $post_types );
	}

	/**
	 * @param array<int, array<string, mixed>> $rule_group Location rule group.
	 * @return array<int, string>
	 */
	private static function post_types_for_rule_group( array $rule_group ): array {
		$post_types = array();
		foreach ( $rule_group as $rule ) {
			if ( ! is_array( $rule ) ) {
				continue;
			}
			$param    = (string) ( $rule['param'] ?? '' );
			$operator = (string) ( $rule['operator'] ?? '==' );
			$value    = (string) ( $rule['value'] ?? '' );
			if ( $value === '' || $operator === '!=' ) {
				continue;
			}
			if ( $param === 'post_type' ) {
				$post_types[] = $value;
			} elseif ( $param === 'post' || $param === 'page' ) {
				$post_id = (int) $value;
				if ( $post_id > 0 ) {
					$type = get_post_type( $post_id );
					if ( is_string( $type ) && $type !== '' ) {
						$post_types[] = $type;
					}
				}
			}
		}
		return $post_types;
	}

	/**
	 * @param array<int, array<string, mixed>> $fields Field definitions.
	 * @return array<int, array<string, mixed>>
	 */
	public static function collect_registerable_fields( array $fields ): array {
		$out = array();
		foreach ( $fields as $field ) {
			self::collect_field_tree( $field, $out );
		}
		return $out;
	}

	/**
	 * @param array<int, array<string, mixed>> $out Output list.
	 */
	private static function collect_field_tree( $field, array &$out ): void {
		if ( ! is_array( $field ) || empty( $field['name'] ) ) {
			return;
		}
		$type = (string) ( $field['type'] ?? '' );
		if ( $type === 'group' && ! empty( $field['sub_fields'] ) && is_array( $field['sub_fields'] ) ) {
			foreach ( $field['sub_fields'] as $sub ) {
				self::collect_field_tree( $sub, $out );
			}
			return;
		}
		if ( in_array( $type, self::$layout_types, true ) ) {
			return;
		}
		$out[] = $field;
	}

	/**
	 * @param array<string, mixed> $field Field definition.
	 */
	public static function meta_type_for_field( array $field ): string {
		$type = (string) ( $field['type'] ?? 'text' );
		if ( in_array( $type, array( 'true_false' ), true ) ) {
			return 'boolean';
		}
		if ( in_array( $type, array( 'number', 'range' ), true ) ) {
			return 'number';
		}
		if ( in_array( $type, array( 'gallery', 'repeater', 'flexible_content', 'group', 'clone' ), true ) ) {
			return 'array';
		}
		return 'string';
	}

	public static function meta_label_for_field( string $name, array $field ): string {
		$label = (string) ( $field['label'] ?? $name );
		return sprintf( 'NeoPulse_%s — %s', $name, $label );
	}
}
