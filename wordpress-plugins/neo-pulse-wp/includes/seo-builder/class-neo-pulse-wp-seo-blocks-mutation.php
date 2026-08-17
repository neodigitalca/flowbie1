<?php
/**
 * Surgical SEO block slot add/remove/update for Flow Assist.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Blocks_Mutation {

	/**
	 * @param array<string,mixed>      $block
	 * @param array<string,mixed>      $slot
	 * @param array<string,mixed>|null $placement Optional row/col for layout.
	 * @return array<string,mixed>|WP_Error
	 */
	public static function add_slot( array $block, array $slot, ?array $placement = null ) {
		$slots      = isset( $block['slots'] ) && is_array( $block['slots'] ) ? $block['slots'] : array();
		$normalized = Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_slot( $slot );
		if ( ! $normalized ) {
			return new WP_Error( 'neo-pulse_seo_slot_invalid', __( 'Invalid slot type or content.', 'neo-pulse-wp' ) );
		}

		$slots[]       = $normalized;
		$slots         = Neo_Pulse_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots );
		$block['slots'] = $slots;

		$layout = isset( $block['layout_config'] ) && is_array( $block['layout_config'] ) ? $block['layout_config'] : array();
		$block['layout_config'] = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $layout, $slots );

		if ( is_array( $placement ) && isset( $placement['row'], $placement['col'] ) ) {
			$new_id = (string) ( $normalized['_id'] ?? '' );
			if ( $new_id === '' && ! empty( $slots ) ) {
				$last   = end( $slots );
				$new_id = is_array( $last ) ? (string) ( $last['_id'] ?? '' ) : '';
			}
			if ( $new_id !== '' ) {
				$block = self::place_slot_in_layout( $block, $new_id, (int) $placement['row'], (int) $placement['col'] );
			}
		}

		return $block;
	}

	/**
	 * @param array<string,mixed> $block
	 * @param mixed               $target slot_id, index, heading text, or array with keys.
	 * @return array<string,mixed>|WP_Error
	 */
	public static function remove_slot( array $block, $target ) {
		$index = self::resolve_slot_index( $block, $target );
		if ( $index === null ) {
			return new WP_Error( 'neo-pulse_seo_slot_missing', __( 'Could not find the slot to remove.', 'neo-pulse-wp' ) );
		}

		$slots = isset( $block['slots'] ) && is_array( $block['slots'] ) ? $block['slots'] : array();
		array_splice( $slots, $index, 1 );
		$block['slots'] = $slots;

		$layout = isset( $block['layout_config'] ) && is_array( $block['layout_config'] ) ? $block['layout_config'] : array();
		$block['layout_config'] = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $layout, $slots );

		return $block;
	}

	/**
	 * @param array<string,mixed> $block
	 * @param mixed               $target
	 * @param array<string,mixed> $patch
	 * @return array<string,mixed>|WP_Error
	 */
	public static function update_slot( array $block, $target, array $patch ) {
		$index = self::resolve_slot_index( $block, $target );
		if ( $index === null ) {
			return new WP_Error( 'neo-pulse_seo_slot_missing', __( 'Could not find the slot to update.', 'neo-pulse-wp' ) );
		}

		$slots = isset( $block['slots'] ) && is_array( $block['slots'] ) ? $block['slots'] : array();
		if ( ! isset( $slots[ $index ] ) || ! is_array( $slots[ $index ] ) ) {
			return new WP_Error( 'neo-pulse_seo_slot_missing', __( 'Could not find the slot to update.', 'neo-pulse-wp' ) );
		}

		$merged = array_merge( $slots[ $index ], $patch );
		if ( ! empty( $slots[ $index ]['_id'] ) ) {
			$merged['_id'] = $slots[ $index ]['_id'];
		}
		if ( ! empty( $slots[ $index ]['attachment_id'] ) && empty( $patch['attachment_id'] ) ) {
			$merged['attachment_id'] = $slots[ $index ]['attachment_id'];
		}

		$normalized = Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_slot( $merged );
		if ( ! $normalized ) {
			return new WP_Error( 'neo-pulse_seo_slot_invalid', __( 'Invalid slot update.', 'neo-pulse-wp' ) );
		}
		if ( ! empty( $slots[ $index ]['_id'] ) ) {
			$normalized['_id'] = $slots[ $index ]['_id'];
		}

		$slots[ $index ] = $normalized;
		$block['slots']  = $slots;

		$layout = isset( $block['layout_config'] ) && is_array( $block['layout_config'] ) ? $block['layout_config'] : array();
		$block['layout_config'] = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $layout, $slots );

		return $block;
	}

	/**
	 * @param array<string,mixed> $block
	 * @param mixed               $target
	 */
	public static function resolve_slot_index( array $block, $target ): ?int {
		$slots = isset( $block['slots'] ) && is_array( $block['slots'] ) ? $block['slots'] : array();

		if ( is_array( $target ) ) {
			if ( isset( $target['index'] ) && is_numeric( $target['index'] ) ) {
				$index = (int) $target['index'];
				return isset( $slots[ $index ] ) ? $index : null;
			}
			if ( ! empty( $target['slot_id'] ) ) {
				$target = (string) $target['slot_id'];
			} elseif ( ! empty( $target['heading'] ) ) {
				$target = (string) $target['heading'];
			} elseif ( ! empty( $target['text'] ) ) {
				$target = (string) $target['text'];
			}
		}

		if ( is_numeric( $target ) ) {
			$index = (int) $target;
			return isset( $slots[ $index ] ) ? $index : null;
		}

		if ( ! is_string( $target ) || $target === '' ) {
			return null;
		}

		foreach ( $slots as $i => $slot ) {
			if ( ! is_array( $slot ) ) {
				continue;
			}
			if ( ! empty( $slot['_id'] ) && (string) $slot['_id'] === $target ) {
				return (int) $i;
			}
		}

		$needle = strtolower( trim( $target ) );
		foreach ( $slots as $i => $slot ) {
			if ( ! is_array( $slot ) ) {
				continue;
			}
			$label = '';
			if ( ( $slot['type'] ?? '' ) === 'h2' && ! empty( $slot['text'] ) ) {
				$label = (string) $slot['text'];
			} elseif ( ( $slot['type'] ?? '' ) === 'cta' && ! empty( $slot['label'] ) ) {
				$label = (string) $slot['label'];
			}
			if ( $label !== '' && stripos( $label, $needle ) !== false ) {
				return (int) $i;
			}
		}

		return null;
	}

	/**
	 * @param array<string,mixed> $block
	 */
	private static function place_slot_in_layout( array $block, string $slot_id, int $row, int $col ): array {
		$layout   = isset( $block['layout_config'] ) && is_array( $block['layout_config'] ) ? $block['layout_config'] : array();
		$sections = isset( $layout['sections'] ) && is_array( $layout['sections'] ) ? $layout['sections'] : array();
		$grid     = isset( $layout['grid'] ) && is_array( $layout['grid'] ) ? $layout['grid'] : Neo_Pulse_Wp_Seo_Blocks_Layout::default_grid();

		foreach ( $sections as $i => $section ) {
			if ( ! is_array( $section ) ) {
				continue;
			}
			if ( (int) ( $section['row'] ?? -1 ) === $row && (int) ( $section['col'] ?? -1 ) === $col ) {
				$ids = isset( $section['slot_ids'] ) && is_array( $section['slot_ids'] ) ? $section['slot_ids'] : array();
				if ( ! in_array( $slot_id, $ids, true ) ) {
					$ids[] = $slot_id;
				}
				$sections[ $i ]['slot_ids'] = $ids;
				$layout['sections']         = $sections;
				$block['layout_config']     = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $layout, $block['slots'] ?? array() );
				return $block;
			}
		}

		$sections[] = array(
			'id'       => (string) ( count( $sections ) + 1 ),
			'row'      => max( 0, $row ),
			'col'      => max( 0, $col ),
			'col_span' => 1,
			'align_h'  => 'left',
			'width'    => Neo_Pulse_Wp_Seo_Blocks_Layout::width_for_cols( (int) ( $grid['cols'] ?? 3 ) ),
			'slot_ids' => array( $slot_id ),
		);
		$layout['sections']     = $sections;
		$block['layout_config'] = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $layout, $block['slots'] ?? array() );

		return $block;
	}
}
