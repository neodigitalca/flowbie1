<?php
/**
 * Location rule matching (ACF-style OR groups, AND rules).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Location {

	/**
	 * @param array<string, mixed> $group Field group.
	 */
	public static function matches_group( array $group, array $screen ): bool {
		$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
		if ( empty( $location ) ) {
			return false;
		}
		foreach ( $location as $rule_group ) {
			if ( ! is_array( $rule_group ) ) {
				continue;
			}
			if ( self::matches_rule_group( $rule_group, $screen ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<int, array<string, mixed>> $rule_group AND rules.
	 * @param array<string, mixed>             $screen     Screen context.
	 */
	public static function matches_rule_group( array $rule_group, array $screen ): bool {
		foreach ( $rule_group as $rule ) {
			if ( ! is_array( $rule ) || ! self::matches_rule( $rule, $screen ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @param array<string, mixed> $rule   Single rule.
	 * @param array<string, mixed> $screen Screen context.
	 */
	public static function matches_rule( array $rule, array $screen ): bool {
		$param    = (string) ( $rule['param'] ?? '' );
		$operator = (string) ( $rule['operator'] ?? '==' );
		$value    = (string) ( $rule['value'] ?? '' );

		$match = self::evaluate_param( $param, $value, $screen );
		if ( $operator === '!=' ) {
			return ! $match;
		}
		return $match;
	}

	/**
	 * @param array<string, mixed> $screen Screen context.
	 */
	private static function evaluate_param( string $param, string $value, array $screen ): bool {
		switch ( $param ) {
			case 'post_type':
				return (string) ( $screen['post_type'] ?? '' ) === $value;
			case 'page_template':
				$template = (string) ( $screen['page_template'] ?? '' );
				if ( $template === '' && ! empty( $screen['post_id'] ) ) {
					$template = (string) get_page_template_slug( (int) $screen['post_id'] );
				}
				return $template === $value || ( $value === 'default' && $template === '' );
			case 'page':
				return (int) ( $screen['post_id'] ?? 0 ) === (int) $value;
			case 'post':
				return (int) ( $screen['post_id'] ?? 0 ) === (int) $value;
			case 'post_category':
				$post_id = (int) ( $screen['post_id'] ?? 0 );
				if ( $post_id < 1 ) {
					return false;
				}
				return has_category( (int) $value, $post_id ) || has_term( (int) $value, 'category', $post_id );
			case 'post_format':
				$post_id = (int) ( $screen['post_id'] ?? 0 );
				return $post_id > 0 && get_post_format( $post_id ) === $value;
			case 'post_status':
				return (string) ( $screen['post_status'] ?? '' ) === $value;
			case 'user_role':
				$user = wp_get_current_user();
				return $user instanceof WP_User && in_array( $value, (array) $user->roles, true );
			case 'user_form':
				return (string) ( $screen['user_form'] ?? '' ) === $value;
			case 'taxonomy':
				$post_id = (int) ( $screen['post_id'] ?? 0 );
				if ( $post_id < 1 ) {
					return false;
				}
				$parts = explode( ':', $value );
				if ( count( $parts ) === 2 ) {
					return has_term( $parts[1], $parts[0], $post_id );
				}
				return has_term( $value, '', $post_id );
			case 'options_page':
				return (string) ( $screen['options_page'] ?? '' ) === $value;
			default:
				return apply_filters( 'flowbie_wp_fields_location_match', false, $param, $value, $screen );
		}
	}

	/**
	 * Human-readable location summary for list table.
	 *
	 * @param array<string, mixed> $group Field group.
	 */
	public static function summarize( array $group ): string {
		$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
		$labels   = array();
		foreach ( $location as $rule_group ) {
			if ( ! is_array( $rule_group ) ) {
				continue;
			}
			foreach ( $rule_group as $rule ) {
				if ( ! is_array( $rule ) ) {
					continue;
				}
				$param = (string) ( $rule['param'] ?? '' );
				$value = (string) ( $rule['value'] ?? '' );
				if ( $param === 'post_type' && $value !== '' ) {
					$obj = get_post_type_object( $value );
					$labels[] = $obj ? $obj->labels->name : $value;
				} elseif ( $param === 'options_page' ) {
					$labels[] = $value;
				} else {
					$labels[] = $param . ': ' . $value;
				}
			}
		}
		$labels = array_unique( array_filter( $labels ) );
		return implode( ', ', $labels );
	}

	/**
	 * @return array<string, string>
	 */
	public static function param_choices(): array {
		return array(
			'post_type'     => __( 'Post Type', 'flowbie-wp' ),
			'page_template' => __( 'Page Template', 'flowbie-wp' ),
			'page'          => __( 'Page', 'flowbie-wp' ),
			'post'          => __( 'Post', 'flowbie-wp' ),
			'post_category' => __( 'Post Category', 'flowbie-wp' ),
			'post_format'   => __( 'Post Format', 'flowbie-wp' ),
			'post_status'   => __( 'Post Status', 'flowbie-wp' ),
			'taxonomy'      => __( 'Taxonomy', 'flowbie-wp' ),
			'user_role'     => __( 'User Role', 'flowbie-wp' ),
			'user_form'     => __( 'User Form', 'flowbie-wp' ),
			'options_page'  => __( 'Options Page', 'flowbie-wp' ),
		);
	}

	/**
	 * @return array<string, string>
	 */
	public static function operator_choices(): array {
		return array(
			'==' => __( 'is equal to', 'flowbie-wp' ),
			'!=' => __( 'is not equal to', 'flowbie-wp' ),
		);
	}

	/**
	 * @return array<string, string>
	 */
	public static function value_choices( string $param ): array {
		switch ( $param ) {
			case 'post_type':
				$types = get_post_types( array( 'show_ui' => true ), 'objects' );
				$out   = array();
				foreach ( $types as $slug => $obj ) {
					$out[ $slug ] = $obj->labels->singular_name;
				}
				return $out;
			case 'post_status':
				return get_post_statuses();
			case 'user_role':
				global $wp_roles;
				$out = array();
				if ( $wp_roles instanceof WP_Roles ) {
					foreach ( $wp_roles->roles as $slug => $role ) {
						$out[ $slug ] = translate_user_role( $role['name'] );
					}
				}
				return $out;
			case 'page_template':
				$templates = wp_get_theme()->get_page_templates();
				$out       = array( 'default' => __( 'Default Template', 'flowbie-wp' ) );
				foreach ( $templates as $file => $name ) {
					$out[ $file ] = $name;
				}
				return $out;
			default:
				return array();
		}
	}
}
