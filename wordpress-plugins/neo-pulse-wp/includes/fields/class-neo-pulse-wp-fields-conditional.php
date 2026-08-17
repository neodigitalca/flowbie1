<?php
/**
 * Conditional logic evaluation.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Conditional {

	/**
	 * @param array<string, mixed> $field  Field config.
	 * @param array<string, mixed> $values All field values keyed by name.
	 * @param array<int, array<string, mixed>> $fields Sibling fields for key resolution.
	 */
	public static function is_visible( array $field, array $values, array $fields = array() ): bool {
		$logic = $field['conditional_logic'] ?? 0;
		if ( empty( $logic ) || ! is_array( $logic ) ) {
			return true;
		}
		$key_index = self::build_key_index( $fields );
		foreach ( $logic as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$match = true;
			foreach ( $group as $rule ) {
				if ( ! is_array( $rule ) ) {
					continue;
				}
				if ( ! self::match_rule( $rule, $values, $key_index ) ) {
					$match = false;
					break;
				}
			}
			if ( $match ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Build field key => name map from a flat or nested field list.
	 *
	 * @param array<int, array<string, mixed>> $fields Fields.
	 * @return array<string, string>
	 */
	public static function build_key_index( array $fields ): array {
		$index = array();
		self::index_fields_recursive( $fields, $index );
		return $index;
	}

	/**
	 * @param array<int, array<string, mixed>> $fields Fields.
	 * @param array<string, string>            $index  Key => name map.
	 */
	private static function index_fields_recursive( array $fields, array &$index ): void {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$key  = (string) ( $field['key'] ?? '' );
			$name = (string) ( $field['name'] ?? '' );
			if ( $key !== '' && $name !== '' ) {
				$index[ $key ] = $name;
			}
			foreach ( array( 'sub_fields', 'fields' ) as $nested_key ) {
				if ( ! empty( $field[ $nested_key ] ) && is_array( $field[ $nested_key ] ) ) {
					self::index_fields_recursive( $field[ $nested_key ], $index );
				}
			}
			if ( ! empty( $field['layouts'] ) && is_array( $field['layouts'] ) ) {
				foreach ( $field['layouts'] as $layout ) {
					if ( is_array( $layout ) && ! empty( $layout['sub_fields'] ) && is_array( $layout['sub_fields'] ) ) {
						self::index_fields_recursive( $layout['sub_fields'], $index );
					}
				}
			}
		}
	}

	/**
	 * @param array<string, mixed> $rule      Conditional rule.
	 * @param array<string, mixed> $values    Field values keyed by name.
	 * @param array<string, string>  $key_index Field key => name.
	 */
	private static function match_rule( array $rule, array $values, array $key_index = array() ): bool {
		$selector = (string) ( $rule['field'] ?? '' );
		$operator = (string) ( $rule['operator'] ?? '==' );
		$expected = $rule['value'] ?? '';

		$field_name = $selector;
		if ( strpos( $selector, 'field_' ) === 0 && isset( $key_index[ $selector ] ) ) {
			$field_name = $key_index[ $selector ];
		}

		$actual = $values[ $field_name ] ?? '';
		if ( $actual === '' && $selector !== $field_name && isset( $values[ $selector ] ) ) {
			$actual = $values[ $selector ];
		}
		if ( is_array( $actual ) ) {
			$actual = implode( ',', $actual );
		}

		switch ( $operator ) {
			case '!=':
				return (string) $actual !== (string) $expected;
			case '==empty':
				return $actual === '' || $actual === null || $actual === array();
			case '!=empty':
				return $actual !== '' && $actual !== null && $actual !== array();
			case '==contains':
				return is_string( $actual ) && strpos( $actual, (string) $expected ) !== false;
			case '==pattern':
				return is_string( $actual ) && (bool) preg_match( '/' . preg_quote( (string) $expected, '/' ) . '/', $actual );
			default:
				return (string) $actual === (string) $expected;
		}
	}

	/**
	 * Export conditional rules as JSON for admin JS (key-based selectors preserved).
	 *
	 * @param array<int, array<string, mixed>> $fields Fields in the group.
	 * @return string JSON array of { field, conditional_logic }.
	 */
	public static function rules_json_for_fields( array $fields ): string {
		$rules = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) ) {
				continue;
			}
			$logic = $field['conditional_logic'] ?? 0;
			if ( empty( $logic ) || ! is_array( $logic ) ) {
				continue;
			}
			$rules[] = array(
				'name'               => (string) $field['name'],
				'key'                => (string) ( $field['key'] ?? '' ),
				'conditional_logic'  => $logic,
			);
		}
		return wp_json_encode( $rules );
	}
}
