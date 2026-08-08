<?php
/**
 * Curated SVG icon library for Flowbie Search.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Search_Icons {

	/**
	 * @return array<string,string> id => human label
	 */
	public static function catalog(): array {
		return array(
			'search'       => __( 'Search', 'flowbie-wp' ),
			'search-bold'  => __( 'Search (bold)', 'flowbie-wp' ),
			'zoom-in'      => __( 'Zoom in', 'flowbie-wp' ),
			'filter'       => __( 'Filter', 'flowbie-wp' ),
			'compass'      => __( 'Compass', 'flowbie-wp' ),
			'book-open'    => __( 'Book open', 'flowbie-wp' ),
			'file-text'    => __( 'Document', 'flowbie-wp' ),
			'help-circle'  => __( 'Help', 'flowbie-wp' ),
			'sparkles'     => __( 'Sparkles', 'flowbie-wp' ),
			'globe'        => __( 'Globe', 'flowbie-wp' ),
			'list'         => __( 'List', 'flowbie-wp' ),
			'scan'         => __( 'Scan', 'flowbie-wp' ),
		);
	}

	/**
	 * @return array<int,string>
	 */
	public static function ids(): array {
		return array_keys( self::catalog() );
	}

	public static function sanitize_id( string $id ): string {
		$id = sanitize_key( $id );
		return in_array( $id, self::ids(), true ) ? $id : 'search';
	}

	/**
	 * @param array<string,mixed> $attrs
	 */
	public static function render( string $id, array $attrs = array() ): string {
		$id   = self::sanitize_id( $id );
		$path = self::paths()[ $id ] ?? self::paths()['search'];

		$width  = isset( $attrs['width'] ) ? (int) $attrs['width'] : 18;
		$height = isset( $attrs['height'] ) ? (int) $attrs['height'] : 18;
		$class  = isset( $attrs['class'] ) ? sanitize_html_class( (string) $attrs['class'] ) : '';

		$stroke = ! empty( $attrs['fill'] ) ? '' : ' stroke="currentColor" fill="none"';
		if ( ! empty( $attrs['fill'] ) ) {
			$stroke = ' fill="currentColor" stroke="none"';
		}

		$class_attr = $class !== '' ? ' class="' . esc_attr( $class ) . '"' : '';

		return sprintf(
			'<svg viewBox="0 0 24 24" width="%1$d" height="%2$d"%3$s%4$s stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">%5$s</svg>',
			$width,
			$height,
			$class_attr,
			$stroke,
			$path
		);
	}

	public static function render_close( array $attrs = array() ): string {
		$width  = isset( $attrs['width'] ) ? (int) $attrs['width'] : 18;
		$height = isset( $attrs['height'] ) ? (int) $attrs['height'] : 18;

		return sprintf(
			'<svg viewBox="0 0 24 24" width="%1$d" height="%2$d" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
			$width,
			$height
		);
	}

	/**
	 * @return array<string,string>
	 */
	private static function paths(): array {
		return array(
			'search'      => '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/>',
			'search-bold' => '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
			'zoom-in'     => '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
			'filter'      => '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
			'compass'     => '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
			'book-open'   => '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
			'file-text'   => '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
			'help-circle' => '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
			'sparkles'    => '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/>',
			'globe'       => '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
			'list'        => '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
			'scan'        => '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>',
		);
	}
}
