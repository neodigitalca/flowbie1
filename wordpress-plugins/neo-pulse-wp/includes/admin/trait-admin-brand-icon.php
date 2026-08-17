<?php
/**
 * Shared NEO Pulse brand icon (brain — Lucide-style two-hemisphere mark).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Brand_Icon {

	/**
	 * Plugin URL for the wp-admin sidebar menu icon.
	 */
	public static function brand_icon_menu_url(): string {
		return plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/admin/neo-pulse-icon.svg';
	}

	/**
	 * Inline SVG brain icon for the admin bar.
	 *
	 * @param string $color Stroke color.
	 * @param int    $size  Pixel width/height.
	 */
	public static function brand_icon_svg( string $color = '#22d3ee', int $size = 20 ): string {
		$color = sanitize_hex_color( $color );
		if ( ! is_string( $color ) || $color === '' ) {
			$color = '#22d3ee';
		}

		$size = max( 14, min( 32, $size ) );

		return '<svg class="neo-pulse-wp-brand-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' . (int) $size . '" height="' . (int) $size . '" fill="none" stroke="' . esc_attr( $color ) . '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
			. '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>'
			. '<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>'
			. '<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>'
			. '<path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>'
			. '<path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>'
			. '<path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>'
			. '<path d="M19.938 10.5a4 4 0 0 1 .585.396"/>'
			. '<path d="M6 18a4 4 0 0 1-1.967-.516"/>'
			. '<path d="M19.967 17.484A4 4 0 0 1 18 18"/>'
			. '</svg>';
	}

	/**
	 * Friendly robot mascot for the post-activation welcome modal.
	 *
	 * @param string $color Primary accent color.
	 * @param int    $size  Pixel width/height.
	 */
	public static function welcome_robot_svg( string $color = '#22d3ee', int $size = 120 ): string {
		$color = sanitize_hex_color( $color );
		if ( ! is_string( $color ) || $color === '' ) {
			$color = '#22d3ee';
		}

		$size = max( 64, min( 200, $size ) );

		return '<svg class="neo-pulse-wp-welcome-robot" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="' . (int) $size . '" height="' . (int) $size . '" aria-hidden="true" focusable="false">'
			. '<defs>'
			. '<filter id="neo-pulse-robot-glow" x="-20%" y="-20%" width="140%" height="140%">'
			. '<feGaussianBlur stdDeviation="3" result="blur"/>'
			. '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>'
			. '</filter>'
			. '</defs>'
			. '<rect x="28" y="38" width="64" height="52" rx="12" fill="#181b21" stroke="' . esc_attr( $color ) . '" stroke-width="2.5"/>'
			. '<rect x="38" y="48" width="18" height="18" rx="4" fill="' . esc_attr( $color ) . '" opacity="0.9" filter="url(#neo-pulse-robot-glow)"/>'
			. '<rect x="64" y="48" width="18" height="18" rx="4" fill="' . esc_attr( $color ) . '" opacity="0.9" filter="url(#neo-pulse-robot-glow)"/>'
			. '<path d="M48 72h24" stroke="' . esc_attr( $color ) . '" stroke-width="2.5" stroke-linecap="round"/>'
			. '<path d="M54 76h12" stroke="' . esc_attr( $color ) . '" stroke-width="2" stroke-linecap="round" opacity="0.7"/>'
			. '<line x1="60" y1="38" x2="60" y2="24" stroke="' . esc_attr( $color ) . '" stroke-width="2.5" stroke-linecap="round"/>'
			. '<circle cx="60" cy="20" r="5" fill="' . esc_attr( $color ) . '" filter="url(#neo-pulse-robot-glow)"/>'
			. '<rect x="18" y="52" width="12" height="24" rx="6" fill="#141619" stroke="' . esc_attr( $color ) . '" stroke-width="2"/>'
			. '<rect x="90" y="52" width="12" height="24" rx="6" fill="#141619" stroke="' . esc_attr( $color ) . '" stroke-width="2"/>'
			. '<rect x="40" y="92" width="14" height="16" rx="4" fill="#141619" stroke="' . esc_attr( $color ) . '" stroke-width="2"/>'
			. '<rect x="66" y="92" width="14" height="16" rx="4" fill="#141619" stroke="' . esc_attr( $color ) . '" stroke-width="2"/>'
			. '</svg>';
	}
}
