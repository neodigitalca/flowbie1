<?php
/**
 * REST API registration for fields with show_in_rest.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Rest {

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_fields' ) );
	}

	public static function register_fields(): void {
		$post_types = get_post_types( array( 'show_in_rest' => true ), 'names' );
		foreach ( $post_types as $post_type ) {
			self::register_rest_field_for_type( $post_type, 'flowbie_fields' );
			self::register_rest_field_for_type( $post_type, 'acf' );
		}
	}

	private static function register_rest_field_for_type( string $post_type, string $field_name ): void {
		register_rest_field(
			$post_type,
			$field_name,
			array(
				'get_callback'    => array( __CLASS__, 'get_rest_fields' ),
				'update_callback' => array( __CLASS__, 'update_rest_fields' ),
				'schema'          => array(
					'description' => $field_name === 'acf'
						? __( 'ACF-compatible field values (Flowbie Fields)', 'flowbie-wp' )
						: __( 'Flowbie Fields values', 'flowbie-wp' ),
					'type'        => 'object',
					'context'     => array( 'view', 'edit' ),
				),
			)
		);
	}

	/**
	 * @param array<string, mixed> $object Post array.
	 * @return array<string, mixed>
	 */
	public static function get_rest_fields( array $object ): array {
		$post_id = (int) ( $object['id'] ?? 0 );
		if ( $post_id < 1 ) {
			return array();
		}
		$out    = array();
		$screen = Flowbie_Wp_Fields_Values::screen_for_post( $post_id );
		foreach ( Flowbie_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( empty( $group['show_in_rest'] ) || ! Flowbie_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				continue;
			}
			foreach ( isset( $group['fields'] ) ? $group['fields'] : array() as $field ) {
				if ( ! is_array( $field ) || empty( $field['name'] ) ) {
					continue;
				}
				$name         = (string) $field['name'];
				$out[ $name ] = Flowbie_Wp_Fields_Values::get_value( $post_id, $field, true );
			}
		}
		return $out;
	}

	/**
	 * @param array<string, mixed> $value  Field values.
	 * @param WP_Post              $object Post object.
	 */
	public static function update_rest_fields( $value, WP_Post $object ): bool {
		if ( ! is_array( $value ) ) {
			return false;
		}
		$screen = Flowbie_Wp_Fields_Values::screen_for_post( (int) $object->ID );
		foreach ( Flowbie_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( empty( $group['show_in_rest'] ) || ! Flowbie_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				continue;
			}
			foreach ( isset( $group['fields'] ) ? $group['fields'] : array() as $field ) {
				if ( ! is_array( $field ) || empty( $field['name'] ) ) {
					continue;
				}
				$name = (string) $field['name'];
				if ( array_key_exists( $name, $value ) ) {
					Flowbie_Wp_Fields_Values::update_value( (int) $object->ID, $field, $value[ $name ] );
				}
			}
		}
		return true;
	}
}
