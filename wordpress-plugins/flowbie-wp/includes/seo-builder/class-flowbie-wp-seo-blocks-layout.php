<?php
/**
 * SEO block layout config — sections grid + responsive settings.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Seo_Blocks_Layout {

	const GRID_MAX = 24;

	const SECTION_ALIGN_H = array( 'left', 'center', 'right' );

	const WIDTHS = array( 'full', 'half', 'third', 'two-thirds' );

	const DIRECTIONS = array( 'row', 'column' );

	const ALIGNS = array( 'start', 'center', 'end', 'stretch' );

	const GRID_PRESETS = array(
		'2x2' => array( 'rows' => 2, 'cols' => 2 ),
		'3x3' => array( 'rows' => 3, 'cols' => 3 ),
		'3x4' => array( 'rows' => 3, 'cols' => 4 ),
		'4x3' => array( 'rows' => 4, 'cols' => 3 ),
	);

	/**
	 * @return array<string,mixed>
	 */
	public static function default_grid(): array {
		return array(
			'rows' => 3,
			'cols' => 3,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function default_responsive(): array {
		return array(
			'desktop' => array(
				'direction'  => 'row',
				'align'      => 'stretch',
				'gap'        => 24,
				'force_full' => false,
			),
			'tablet'  => array(
				'direction'  => 'column',
				'align'      => 'start',
				'gap'        => 16,
				'breakpoint' => 1024,
				'force_full' => true,
			),
			'mobile'  => array(
				'direction'  => 'column',
				'align'      => 'start',
				'gap'        => 12,
				'breakpoint' => 767,
				'force_full' => true,
			),
		);
	}

	/**
	 * @param mixed                          $config
	 * @param array<int,array<string,mixed>> $slots
	 * @return array<string,mixed>
	 */
	public static function normalize_config( $config, array $slots ): array {
		$slots  = Flowbie_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots );
		$config = is_array( $config ) ? $config : array();

		$grid     = self::normalize_grid( $config['grid'] ?? null );
		$sections = isset( $config['sections'] ) && is_array( $config['sections'] ) ? $config['sections'] : array();
		$sections = self::normalize_sections( $sections, $slots, $grid );

		$responsive = isset( $config['responsive'] ) && is_array( $config['responsive'] ) ? $config['responsive'] : array();
		$defaults   = self::default_responsive();

		$out_responsive = array();
		foreach ( $defaults as $key => $default ) {
			$raw = isset( $responsive[ $key ] ) && is_array( $responsive[ $key ] ) ? $responsive[ $key ] : array();
			$out_responsive[ $key ] = self::normalize_breakpoint( $raw, $default );
		}

		return array(
			'grid'       => $grid,
			'sections'   => $sections,
			'responsive' => $out_responsive,
		);
	}

	/**
	 * @param mixed $raw
	 * @return array{rows:int,cols:int}
	 */
	public static function normalize_grid( $raw ): array {
		$defaults = self::default_grid();
		if ( ! is_array( $raw ) ) {
			return $defaults;
		}

		$rows = absint( $raw['rows'] ?? $defaults['rows'] );
		$cols = absint( $raw['cols'] ?? $defaults['cols'] );

		if ( $rows < 1 || $rows > self::GRID_MAX ) {
			$rows = $rows < 1 ? 1 : min( $rows, self::GRID_MAX );
		}
		if ( $cols < 1 || $cols > self::GRID_MAX ) {
			$cols = $cols < 1 ? 1 : min( $cols, self::GRID_MAX );
		}

		return array(
			'rows' => $rows,
			'cols' => $cols,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $sections
	 * @param array<int,array<string,mixed>> $slots
	 * @param array{rows:int,cols:int}       $grid
	 * @return array<int,array<string,mixed>>
	 */
	private static function normalize_sections( array $sections, array $slots, array $grid ): array {
		$slot_ids = array();
		foreach ( $slots as $slot ) {
			if ( ! empty( $slot['_id'] ) ) {
				$slot_ids[] = (string) $slot['_id'];
			}
		}

		if ( empty( $sections ) && ! empty( $slot_ids ) ) {
			return self::default_sections_from_slots( $slots, $grid );
		}

		$sections = self::merge_sections_by_cell( $sections );

		$out          = array();
		$used_cells   = array();
		$used_slots   = array();
		$needs_coords = false;

		foreach ( $sections as $index => $section ) {
			if ( ! is_array( $section ) ) {
				continue;
			}

			if ( ! isset( $section['row'] ) || ! isset( $section['col'] ) ) {
				$needs_coords = true;
			}

			$normalized = self::normalize_section( $section, $index, $slot_ids, $grid, $used_slots );
			if ( $normalized === null ) {
				continue;
			}

			$row      = (int) $normalized['row'];
			$col      = (int) $normalized['col'];
			$col_span = (int) ( $normalized['col_span'] ?? 1 );

			if ( $row < 0 || $col < 0 || $row >= $grid['rows'] || $col >= $grid['cols'] ) {
				$needs_coords = true;
				continue;
			}

			if ( ! self::span_fits_grid( $row, $col, $col_span, $grid ) ) {
				$needs_coords = true;
				continue;
			}

			if ( self::span_overlaps_used( $row, $col, $col_span, $used_cells ) ) {
				continue;
			}

			self::mark_span_cells( $row, $col, $col_span, $used_cells );

			foreach ( $normalized['slot_ids'] as $sid ) {
				$used_slots[ $sid ] = true;
			}

			$out[] = $normalized;
		}

		if ( empty( $out ) && ! empty( $slot_ids ) ) {
			return self::default_sections_from_slots( $slots, $grid );
		}

		if ( $needs_coords ) {
			$out = self::auto_place_sections_without_coords( $out, $grid );
		}

		return self::assign_unmapped_slots( $out, $slots, $grid );
	}

	/**
	 * @param array<int,array<string,mixed>> $sections
	 * @return array<int,array<string,mixed>>
	 */
	private static function merge_sections_by_cell( array $sections ): array {
		$by_cell   = array();
		$no_coords = array();

		foreach ( $sections as $section ) {
			if ( ! is_array( $section ) ) {
				continue;
			}
			$row = isset( $section['row'] ) ? (int) $section['row'] : -1;
			$col = isset( $section['col'] ) ? (int) $section['col'] : -1;
			if ( $row < 0 || $col < 0 ) {
				$no_coords[] = $section;
				continue;
			}
			$key = $row . ':' . $col;
			if ( ! isset( $by_cell[ $key ] ) ) {
				$by_cell[ $key ] = $section;
				continue;
			}
			$merged = array();
			foreach ( array_merge( (array) ( $by_cell[ $key ]['slot_ids'] ?? array() ), (array) ( $section['slot_ids'] ?? array() ) ) as $sid ) {
				$sid = sanitize_key( (string) $sid );
				if ( $sid !== '' && ! in_array( $sid, $merged, true ) ) {
					$merged[] = $sid;
				}
			}
			$by_cell[ $key ]['slot_ids'] = $merged;
			if ( empty( $by_cell[ $key ]['col_span'] ) && ! empty( $section['col_span'] ) ) {
				$by_cell[ $key ]['col_span'] = $section['col_span'];
			}
			if ( ( $by_cell[ $key ]['align_h'] ?? 'left' ) === 'left' && ! empty( $section['align_h'] ) ) {
				$by_cell[ $key ]['align_h'] = $section['align_h'];
			}
		}

		return array_merge( array_values( $by_cell ), $no_coords );
	}

	/**
	 * @param array<string,bool> $used_cells
	 */
	private static function mark_span_cells( int $row, int $col, int $col_span, array &$used_cells ): void {
		for ( $c = $col; $c < $col + $col_span; $c++ ) {
			$used_cells[ $row . ':' . $c ] = true;
		}
	}

	/**
	 * @param array<string,bool> $used_cells
	 */
	private static function span_overlaps_used( int $row, int $col, int $col_span, array $used_cells ): bool {
		for ( $c = $col; $c < $col + $col_span; $c++ ) {
			if ( isset( $used_cells[ $row . ':' . $c ] ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array{rows:int,cols:int} $grid
	 */
	private static function span_fits_grid( int $row, int $col, int $col_span, array $grid ): bool {
		if ( $row < 0 || $col < 0 || $col_span < 1 ) {
			return false;
		}
		return $row < $grid['rows'] && ( $col + $col_span ) <= $grid['cols'];
	}

	/**
	 * @param array<int,string>              $slot_ids
	 * @param array{rows:int,cols:int}       $grid
	 * @param array<string,bool>             $used_slots
	 * @return array<string,mixed>|null
	 */
	private static function normalize_section( array $section, int $index, array $slot_ids, array $grid, array $used_slots ): ?array {
		$id = sanitize_text_field( (string) ( $section['id'] ?? (string) ( $index + 1 ) ) );
		if ( $id === '' ) {
			$id = (string) ( $index + 1 );
		}

		$assigned = array();
		if ( ! empty( $section['slot_ids'] ) && is_array( $section['slot_ids'] ) ) {
			foreach ( $section['slot_ids'] as $sid ) {
				$sid = sanitize_key( (string) $sid );
				if ( $sid !== '' && in_array( $sid, $slot_ids, true ) && ! isset( $used_slots[ $sid ] ) && ! in_array( $sid, $assigned, true ) ) {
					$assigned[] = $sid;
				}
			}
		}

		if ( empty( $assigned ) ) {
			return null;
		}

		$row = isset( $section['row'] ) ? (int) $section['row'] : -1;
		$col = isset( $section['col'] ) ? (int) $section['col'] : -1;

		if ( $row < 0 || $col < 0 || $row >= $grid['rows'] || $col >= $grid['cols'] ) {
			$row = -1;
			$col = -1;
		}

		$col_span = absint( $section['col_span'] ?? 1 );
		if ( $col_span < 1 ) {
			$col_span = 1;
		}
		if ( $col >= 0 && ( $col + $col_span ) > $grid['cols'] ) {
			$col_span = max( 1, $grid['cols'] - $col );
		}

		$align_h = sanitize_key( (string) ( $section['align_h'] ?? 'left' ) );
		if ( ! in_array( $align_h, self::SECTION_ALIGN_H, true ) ) {
			$align_h = 'left';
		}

		$width = self::width_for_cols( $grid['cols'] );

		return array(
			'id'       => $id,
			'row'      => $row,
			'col'      => $col,
			'col_span' => $col_span,
			'align_h'  => $align_h,
			'width'    => $width,
			'slot_ids' => $assigned,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $sections
	 * @param array{rows:int,cols:int}       $grid
	 * @return array<int,array<string,mixed>>
	 */
	private static function auto_place_sections_without_coords( array $sections, array $grid ): array {
		$used_cells = array();
		$out        = array();

		foreach ( $sections as $section ) {
			$row      = (int) ( $section['row'] ?? -1 );
			$col      = (int) ( $section['col'] ?? -1 );
			$col_span = max( 1, (int) ( $section['col_span'] ?? 1 ) );

			if ( $row >= 0 && $col >= 0 && self::span_fits_grid( $row, $col, $col_span, $grid ) && ! self::span_overlaps_used( $row, $col, $col_span, $used_cells ) ) {
				self::mark_span_cells( $row, $col, $col_span, $used_cells );
				$out[] = $section;
				continue;
			}

			$placed = self::next_free_cell_for_span( $grid, $used_cells, $col_span );
			if ( $placed === null ) {
				continue;
			}

			$section['row']      = $placed['row'];
			$section['col']      = $placed['col'];
			$section['col_span'] = min( $col_span, $grid['cols'] - $placed['col'] );
			self::mark_span_cells( $section['row'], $section['col'], (int) $section['col_span'], $used_cells );
			$out[] = $section;
		}

		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 * @param array{rows:int,cols:int}       $grid
	 * @return array<int,array<string,mixed>>
	 */
	public static function default_sections_from_slots( array $slots, ?array $grid = null ): array {
		$grid     = $grid ?? self::default_grid();
		$sections = array();
		$used     = array();
		$index    = 1;

		foreach ( Flowbie_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots ) as $slot ) {
			if ( empty( $slot['_id'] ) ) {
				continue;
			}

			$cell = self::next_free_cell( $grid, $used );
			if ( $cell === null ) {
				break;
			}

			$used[ $cell['row'] . ':' . $cell['col'] ] = true;
			$sections[] = array(
				'id'       => (string) $index,
				'row'      => $cell['row'],
				'col'      => $cell['col'],
				'col_span' => 1,
				'align_h'  => 'left',
				'width'    => self::width_for_cols( $grid['cols'] ),
				'slot_ids' => array( (string) $slot['_id'] ),
			);
			++$index;
		}

		return $sections;
	}

	/**
	 * @param array<int,array<string,mixed>> $sections
	 * @param array<int,array<string,mixed>> $slots
	 * @param array{rows:int,cols:int}       $grid
	 * @return array<int,array<string,mixed>>
	 */
	private static function assign_unmapped_slots( array $sections, array $slots, array $grid ): array {
		$mapped = array();
		$used   = array();

		foreach ( $sections as $section ) {
			foreach ( $section['slot_ids'] as $sid ) {
				$mapped[ $sid ] = true;
			}
			if ( isset( $section['row'], $section['col'] ) ) {
				$row      = (int) $section['row'];
				$col      = (int) $section['col'];
				$col_span = max( 1, (int) ( $section['col_span'] ?? 1 ) );
				self::mark_span_cells( $row, $col, $col_span, $used );
			}
		}

		$index = count( $sections ) + 1;
		foreach ( Flowbie_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots ) as $slot ) {
			$sid = (string) ( $slot['_id'] ?? '' );
			if ( $sid === '' || isset( $mapped[ $sid ] ) ) {
				continue;
			}

			$cell = self::next_free_cell( $grid, $used );
			if ( $cell === null ) {
				break;
			}

			$used[ $cell['row'] . ':' . $cell['col'] ] = true;
			$sections[] = array(
				'id'       => (string) $index,
				'row'      => $cell['row'],
				'col'      => $cell['col'],
				'col_span' => 1,
				'align_h'  => 'left',
				'width'    => self::width_for_cols( $grid['cols'] ),
				'slot_ids' => array( $sid ),
			);
			$mapped[ $sid ] = true;
			++$index;
		}

		usort(
			$sections,
			static function ( array $a, array $b ): int {
				$row_cmp = (int) ( $a['row'] ?? 0 ) <=> (int) ( $b['row'] ?? 0 );
				if ( $row_cmp !== 0 ) {
					return $row_cmp;
				}
				return (int) ( $a['col'] ?? 0 ) <=> (int) ( $b['col'] ?? 0 );
			}
		);

		return $sections;
	}

	/**
	 * @param array{rows:int,cols:int} $grid
	 * @param array<string,bool>       $used
	 * @return array{row:int,col:int}|null
	 */
	private static function next_free_cell( array $grid, array $used ): ?array {
		return self::next_free_cell_for_span( $grid, $used, 1 );
	}

	/**
	 * @param array{rows:int,cols:int} $grid
	 * @param array<string,bool>       $used
	 */
	private static function next_free_cell_for_span( array $grid, array $used, int $col_span ): ?array {
		$col_span = max( 1, $col_span );
		for ( $row = 0; $row < $grid['rows']; $row++ ) {
			for ( $col = 0; $col <= $grid['cols'] - $col_span; $col++ ) {
				if ( ! self::span_overlaps_used( $row, $col, $col_span, $used ) ) {
					return array(
						'row' => $row,
						'col' => $col,
					);
				}
			}
		}
		return null;
	}

	/**
	 * @param int $cols
	 */
	public static function width_for_cols( int $cols ): string {
		if ( $cols <= 1 ) {
			return 'full';
		}
		if ( $cols === 2 ) {
			return 'half';
		}
		if ( $cols === 3 ) {
			return 'third';
		}
		if ( $cols === 4 ) {
			return 'third';
		}
		return 'full';
	}

	/**
	 * @param int $cols
	 */
	public static function col_span_for_grid( int $cols ): int {
		if ( $cols < 1 ) {
			return 12;
		}
		return (int) max( 1, floor( 12 / $cols ) );
	}

	/**
	 * @param array<string,mixed> $raw
	 * @param array<string,mixed> $defaults
	 * @return array<string,mixed>
	 */
	private static function normalize_breakpoint( array $raw, array $defaults ): array {
		$direction = sanitize_key( (string) ( $raw['direction'] ?? $defaults['direction'] ?? 'row' ) );
		if ( ! in_array( $direction, self::DIRECTIONS, true ) ) {
			$direction = 'row';
		}
		$align = sanitize_key( (string) ( $raw['align'] ?? $defaults['align'] ?? 'stretch' ) );
		if ( ! in_array( $align, self::ALIGNS, true ) ) {
			$align = 'stretch';
		}
		$gap = absint( $raw['gap'] ?? $defaults['gap'] ?? 24 );
		$out = array(
			'direction'  => $direction,
			'align'      => $align,
			'gap'        => max( 0, $gap ),
			'force_full' => ! empty( $raw['force_full'] ),
		);
		if ( isset( $defaults['breakpoint'] ) ) {
			$out['breakpoint'] = absint( $raw['breakpoint'] ?? $defaults['breakpoint'] );
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 * @param array<string,mixed>            $layout_config
	 */
	public static function render_html( array $slots, array $layout_config ): string {
		$config = self::normalize_config( $layout_config, $slots );
		$slots  = Flowbie_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots );
		$grid   = $config['grid'];
		$cols   = max( 1, (int) ( $grid['cols'] ?? 3 ) );
		$rows   = max( 1, (int) ( $grid['rows'] ?? 3 ) );

		$by_id = array();
		foreach ( $slots as $slot ) {
			if ( ! empty( $slot['_id'] ) ) {
				$by_id[ (string) $slot['_id'] ] = $slot;
			}
		}

		$sections = $config['sections'];
		usort(
			$sections,
			static function ( array $a, array $b ): int {
				$row_cmp = (int) ( $a['row'] ?? 0 ) <=> (int) ( $b['row'] ?? 0 );
				if ( $row_cmp !== 0 ) {
					return $row_cmp;
				}
				return (int) ( $a['col'] ?? 0 ) <=> (int) ( $b['col'] ?? 0 );
			}
		);

		$has_spatial = false;
		foreach ( $sections as $section ) {
			if ( isset( $section['row'], $section['col'] ) && (int) $section['row'] >= 0 && (int) $section['col'] >= 0 ) {
				$has_spatial = true;
				break;
			}
		}

		$style = self::inline_style_attr( $config['responsive'], $grid, $has_spatial );
		$html  = '<div class="flowbie-seo-block__layout' . ( $has_spatial ? ' flowbie-seo-block__layout--spatial' : '' ) . '"' . $style . '>';

		foreach ( $sections as $section ) {
			$section_id = esc_attr( (string) ( $section['id'] ?? '' ) );
			$width      = sanitize_html_class( (string) ( $section['width'] ?? self::width_for_cols( $cols ) ) );
			$row        = isset( $section['row'] ) ? (int) $section['row'] : -1;
			$col        = isset( $section['col'] ) ? (int) $section['col'] : -1;
			$col_span   = max( 1, (int) ( $section['col_span'] ?? 1 ) );
			$align_h    = sanitize_key( (string) ( $section['align_h'] ?? 'left' ) );
			if ( ! in_array( $align_h, self::SECTION_ALIGN_H, true ) ) {
				$align_h = 'left';
			}

			$section_style = '';
			$width_class   = ' flowbie-seo-block__section--' . esc_attr( $width );
			if ( $has_spatial && $row >= 0 && $col >= 0 ) {
				$width_class   = ' flowbie-seo-block__section--placed';
				$section_style = ' style="' . esc_attr(
					'grid-row:' . ( $row + 1 ) . ';grid-column:' . ( $col + 1 ) . ' / span ' . $col_span
				) . '"';
			}

			$section_align_v = 'middle';

			$html .= '<div class="flowbie-seo-block__section' . $width_class . ' flowbie-seo-block__section--align-v-' . esc_attr( $section_align_v ) . ' flowbie-seo-block__section--align-h-' . esc_attr( $align_h ) . '" data-section-id="' . $section_id . '"' . $section_style . '>';
			foreach ( $section['slot_ids'] as $sid ) {
				if ( ! isset( $by_id[ $sid ] ) ) {
					continue;
				}
				$slot = $by_id[ $sid ];
				if ( $has_spatial ) {
					$slot['align_h'] = $align_h;
				}
				$html .= Flowbie_Wp_Seo_Blocks_Slots::render_slot( $slot );
			}
			$html .= '</div>';
		}

		$html .= '</div>';
		return $html;
	}

	/**
	 * @param array<string,array<string,mixed>> $responsive
	 * @param array{rows:int,cols:int}          $grid
	 */
	private static function inline_style_attr( array $responsive, array $grid, bool $has_spatial ): string {
		$desktop = $responsive['desktop'] ?? self::default_responsive()['desktop'];
		$styles  = array(
			'--flowbie-layout-direction:' . esc_attr( (string) ( $desktop['direction'] ?? 'row' ) ),
			'--flowbie-layout-align:' . esc_attr( self::align_to_flex( (string) ( $desktop['align'] ?? 'stretch' ) ) ),
			'--flowbie-layout-gap:' . absint( $desktop['gap'] ?? 24 ) . 'px',
		);

		if ( $has_spatial ) {
			$styles[] = '--flowbie-grid-rows:' . absint( $grid['rows'] ?? 3 );
			$styles[] = '--flowbie-grid-cols:' . absint( $grid['cols'] ?? 3 );
		}

		foreach ( array( 'tablet', 'mobile' ) as $bp ) {
			if ( empty( $responsive[ $bp ] ) || ! is_array( $responsive[ $bp ] ) ) {
				continue;
			}
			$r      = $responsive[ $bp ];
			$prefix = '--flowbie-' . $bp;
			$styles[] = $prefix . '-direction:' . esc_attr( (string) ( $r['direction'] ?? 'column' ) );
			$styles[] = $prefix . '-align:' . esc_attr( self::align_to_flex( (string) ( $r['align'] ?? 'start' ) ) );
			$styles[] = $prefix . '-gap:' . absint( $r['gap'] ?? 16 ) . 'px';
			if ( ! empty( $r['force_full'] ) ) {
				$styles[] = $prefix . '-force-full:1';
			}
		}

		return ' style="' . esc_attr( implode( ';', $styles ) ) . '"';
	}

	private static function align_to_flex( string $align ): string {
		$map = array(
			'start'   => 'flex-start',
			'center'  => 'center',
			'end'     => 'flex-end',
			'stretch' => 'stretch',
		);
		return $map[ $align ] ?? 'stretch';
	}

	/**
	 * @param mixed $raw
	 * @return array<string,mixed>
	 */
	public static function decode( $raw ): array {
		if ( is_string( $raw ) && $raw !== '' ) {
			$decoded = json_decode( $raw, true );
			$raw     = is_array( $decoded ) ? $decoded : array();
		}
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}
		return self::normalize_config( $raw, array() );
	}
}
