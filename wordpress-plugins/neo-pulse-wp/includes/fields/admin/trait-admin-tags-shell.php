<?php
/**
 * Admin shell for NEO Pulse Tags (Elementor dynamic tags settings).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Tags_Shell {

	/**
	 * @return array<int, array{slug: string, label: string, url: string}>
	 */
	private static function tags_shell_primary_nav(): array {
		return array(
			array(
				'slug'  => 'elementor',
				'label' => __( 'Elementor', 'neo-pulse-wp' ),
				'url'   => admin_url( 'admin.php?page=neo-pulse-wp-tags' ),
			),
		);
	}

	/**
	 * @param string                    $active_slug Legacy nav key (elementor).
	 * @param array<string, mixed>|null $flash       Unused; flash is handled by the group shell.
	 */
	private static function render_tags_shell_open( string $active_slug, ?array $flash = null, string $body_class = '' ): void {
		unset( $flash, $active_slug );
		$page_slug  = 'neo-pulse-wp-tags';
		$body_class = trim( 'neo-pulse-fields-admin neo-pulse-fields-acf-body neo-pulse-tags-admin' . ( $body_class !== '' ? ' ' . $body_class : '' ) );
		self::neo_pulse_group_shell_open( $page_slug, $body_class );
	}

	private static function render_tags_shell_close(): void {
		self::neo_pulse_group_shell_close();
	}
}
