<?php
/**
 * Bundled site templates shown in Fields → Gallery.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Gallery_Templates {

	/**
	 * @return array<string, array{title: string, description: string, path: string, delete_confirm: string}>
	 */
	public static function all(): array {
		return array(
			'window-coverings' => array(
				'title'           => __( 'Window Coverings', 'flowbie-wp' ),
				'description'     => __( 'Full field structure for a window coverings site: custom post types, taxonomies, field groups, and the Contact Information options page.', 'flowbie-wp' ),
				'path'            => Flowbie_Wp_Fields_Import_Export::bundled_window_coverings_path(),
				'delete_confirm'  => __( 'Remove all Window Coverings template items from Flowbie Fields? This does not delete your site content.', 'flowbie-wp' ),
			),
			'smb-starter'      => array(
				'title'           => __( 'SMB Starter', 'flowbie-wp' ),
				'description'     => __( 'Starter setup for small business sites: Flowbie page and post fields, service areas, our work, and related taxonomy.', 'flowbie-wp' ),
				'path'            => Flowbie_Wp_Fields_Import_Export::bundled_smb_starter_path(),
				'delete_confirm'  => __( 'Remove all SMB Starter template items from Flowbie Fields? This does not delete your site content.', 'flowbie-wp' ),
			),
		);
	}

	public static function exists( string $id ): bool {
		$id = sanitize_key( $id );
		return $id !== '' && isset( self::all()[ $id ] );
	}

	/**
	 * @return array{title: string, description: string, path: string, delete_confirm: string}|null
	 */
	public static function get( string $id ): ?array {
		$id = sanitize_key( $id );
		if ( ! self::exists( $id ) ) {
			return null;
		}
		return self::all()[ $id ];
	}

	/**
	 * @return array{groups: int, post_types: int, taxonomies: int, options_pages: int}|null
	 */
	public static function counts_for( string $id ): ?array {
		$template = self::get( $id );
		if ( ! $template ) {
			return null;
		}
		return Flowbie_Wp_Fields_Import_Export::count_entities_in_json_file( $template['path'] );
	}

	/**
	 * @return array{success: bool, message: string, stats?: array<string, int>}
	 */
	public static function import( string $id ): array {
		$template = self::get( $id );
		if ( ! $template ) {
			return array(
				'success' => false,
				'message' => __( 'Unknown template.', 'flowbie-wp' ),
			);
		}
		return Flowbie_Wp_Fields_Import_Export::import_bundled_json( $template['path'] );
	}

	/**
	 * @return array{success: bool, message: string}
	 */
	public static function delete( string $id ): array {
		$template = self::get( $id );
		if ( ! $template ) {
			return array(
				'success' => false,
				'message' => __( 'Unknown template.', 'flowbie-wp' ),
			);
		}
		return Flowbie_Wp_Fields_Import_Export::delete_bundled_json( $template['path'] );
	}

	/**
	 * @param array<int, string> $ids Template slugs.
	 * @return array{success: bool, message: string}
	 */
	public static function delete_many( array $ids ): array {
		$ids = array_values(
			array_unique(
				array_filter(
					array_map( 'sanitize_key', $ids ),
					array( __CLASS__, 'exists' )
				)
			)
		);

		if ( empty( $ids ) ) {
			return array(
				'success' => false,
				'message' => __( 'Select at least one template.', 'flowbie-wp' ),
			);
		}

		$removed = 0;
		$last    = '';
		foreach ( $ids as $id ) {
			$result = self::delete( $id );
			$last   = (string) ( $result['message'] ?? '' );
			if ( ! empty( $result['success'] ) ) {
				++$removed;
			}
		}

		if ( $removed < 1 ) {
			return array(
				'success' => true,
				'message' => $last !== '' ? $last : __( 'Nothing from the selected templates was installed yet.', 'flowbie-wp' ),
			);
		}

		return array(
			'success' => true,
			/* translators: %d: number of templates processed */
			'message' => sprintf( _n( 'Removed items for %d template.', 'Removed items for %d templates.', $removed, 'flowbie-wp' ), $removed ),
		);
	}

	/** Nonce action for gallery bulk delete. */
	public static function bulk_delete_nonce_action(): string {
		return 'flowbie_wp_gallery_bulk_delete';
	}

	/**
	 * Nonce action for gallery import/delete forms.
	 *
	 * @param string $operation import|delete
	 */
	public static function nonce_action( string $id, string $operation ): string {
		$id        = sanitize_key( $id );
		$operation = sanitize_key( $operation );
		if ( $id === '' || ! in_array( $operation, array( 'import', 'delete' ), true ) ) {
			return 'flowbie_wp_gallery_invalid';
		}
		return 'flowbie_wp_gallery_' . $operation . '_' . $id;
	}
}
