<?php
/**
 * Register taxonomies from Flowbie Fields UI.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Taxonomies {

	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'register_all' ), 21 );
	}

	public static function register_all(): void {
		foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_TAXONOMY ) as $config ) {
			self::register_one( $config );
		}
	}

	/**
	 * @param array<string, mixed> $config Taxonomy config.
	 */
	public static function register_one( array $config ): void {
		$key = (string) ( $config['taxonomy'] ?? $config['key'] ?? '' );
		if ( $key === '' || taxonomy_exists( $key ) ) {
			return;
		}
		$object_types = isset( $config['object_type'] ) ? (array) $config['object_type'] : array( 'post' );
		$labels       = isset( $config['labels'] ) && is_array( $config['labels'] ) ? $config['labels'] : array();
		$rewrite      = isset( $config['rewrite'] ) && is_array( $config['rewrite'] ) ? $config['rewrite'] : array();
		$rewrite_args = true;
		if ( ! empty( $rewrite ) ) {
			$slug = (string) ( $rewrite['slug'] ?? '' );
			if ( $slug === '' && ( ( $rewrite['permalink_rewrite'] ?? '' ) === 'taxonomy_key' || $key !== '' ) ) {
				$slug = $key;
			}
			$rewrite_args = array(
				'slug'       => $slug !== '' ? $slug : $key,
				'with_front' => ! empty( $rewrite['with_front'] ),
			);
		}
		$args         = array(
			'labels'       => $labels,
			'public'       => ! empty( $config['public'] ),
			'show_ui'      => ! empty( $config['show_ui'] ),
			'show_in_rest' => ! empty( $config['show_in_rest'] ),
			'hierarchical' => ! empty( $config['hierarchical'] ),
			'rewrite'      => $rewrite_args,
		);
		register_taxonomy( $key, $object_types, $args );
	}

	/**
	 * @param array<string, mixed> $config Taxonomy config.
	 */
	public static function save( array $config ): int {
		return Flowbie_Wp_Fields_Storage::save_entity(
			Flowbie_Wp_Fields_Storage::CPT_TAXONOMY,
			$config,
			'taxonomy'
		);
	}

	public static function delete( string $slug ): bool {
		return Flowbie_Wp_Fields_Storage::delete_entity(
			Flowbie_Wp_Fields_Storage::CPT_TAXONOMY,
			$slug,
			'taxonomy'
		);
	}
}
