<?php
/**
 * Admin shell for Flowbie Tags (Elementor dynamic tags settings).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Tags_Shell {

	/**
	 * @return array<int, array{slug: string, label: string, url: string}>
	 */
	private static function tags_shell_primary_nav(): array {
		return array(
			array(
				'slug'  => 'elementor',
				'label' => __( 'Elementor', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-tags' ),
			),
		);
	}

	/**
	 * @param string                    $active_slug Legacy nav key (elementor).
	 * @param array<string, mixed>|null $flash       Unused; flash is handled by the group shell.
	 */
	private static function render_tags_shell_open( string $active_slug, ?array $flash = null, string $body_class = '' ): void {
		unset( $flash, $active_slug );
		$page_slug  = 'flowbie-wp-tags';
		$body_class = trim( 'flowbie-fields-admin flowbie-fields-acf-body flowbie-tags-admin' . ( $body_class !== '' ? ' ' . $body_class : '' ) );
		self::flowbie_group_shell_open( $page_slug, $body_class );
	}

	private static function render_tags_shell_close(): void {
		self::flowbie_group_shell_close();
	}
}
