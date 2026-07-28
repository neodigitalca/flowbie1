<?php
/**
 * SEO block slot schema helpers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Seo_Blocks_Slots {

	/**
	 * @return array<int,string>
	 */
	public static function slot_types(): array {
		return array( 'h2', 'paragraph', 'cta', 'image', 'list' );
	}

	/**
	 * @param mixed $slots Raw slots from widget or DB.
	 * @return array<int,array<string,mixed>>
	 */
	public static function normalize_list( $slots ): array {
		if ( ! is_array( $slots ) ) {
			return array();
		}
		$out = array();
		foreach ( $slots as $slot ) {
			if ( ! is_array( $slot ) ) {
				continue;
			}
			$normalized = self::normalize_slot( $slot );
			if ( $normalized ) {
				$out[] = $normalized;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $slot
	 * @return array<string,mixed>|null
	 */
	public static function normalize_slot( array $slot ): ?array {
		$type = sanitize_key( (string) ( $slot['type'] ?? '' ) );
		if ( ! in_array( $type, self::slot_types(), true ) ) {
			return null;
		}

		$base = array( 'type' => $type );
		if ( ! empty( $slot['_id'] ) ) {
			$base['_id'] = sanitize_key( (string) $slot['_id'] );
		}

		switch ( $type ) {
			case 'h2':
				$base['text'] = sanitize_text_field( (string) ( $slot['text'] ?? '' ) );
				$level          = absint( $slot['heading_level'] ?? 2 );
				$base['heading_level'] = ( $level >= 1 && $level <= 6 ) ? $level : 2;
				break;
			case 'paragraph':
				$base['html'] = wp_kses_post( (string) ( $slot['html'] ?? $slot['text'] ?? '' ) );
				break;
			case 'cta':
				$base['label'] = sanitize_text_field( (string) ( $slot['label'] ?? '' ) );
				$base['url']   = esc_url_raw( (string) ( $slot['url'] ?? '' ) );
				$style         = sanitize_key( (string) ( $slot['style'] ?? 'primary' ) );
				$base['style'] = in_array( $style, array( 'primary', 'secondary', 'outline' ), true ) ? $style : 'primary';
				break;
			case 'image':
				$base['attachment_id'] = absint( $slot['attachment_id'] ?? $slot['id'] ?? 0 );
				$base['alt']           = sanitize_text_field( (string) ( $slot['alt'] ?? '' ) );
				break;
			case 'list':
				$html = (string) ( $slot['html'] ?? '' );
				if ( $html !== '' ) {
					$base['html'] = wp_kses_post( $html );
				}
				$style         = sanitize_key( (string) ( $slot['style'] ?? 'bullet' ) );
				$base['style'] = in_array( $style, array( 'bullet', 'number' ), true ) ? $style : 'bullet';
				$items         = isset( $slot['items'] ) && is_array( $slot['items'] ) ? $slot['items'] : array();
				$base['items'] = array_values(
					array_filter(
						array_map(
							static function ( $item ) {
								return sanitize_text_field( (string) $item );
							},
							$items
						),
						static function ( $item ) {
							return $item !== '';
						}
					)
				);
				break;
		}

		$align_h = sanitize_key( (string) ( $slot['align_h'] ?? 'left' ) );
		$base['align_h'] = in_array( $align_h, array( 'left', 'center', 'right' ), true ) ? $align_h : 'left';

		$align_v = sanitize_key( (string) ( $slot['align_v'] ?? 'middle' ) );
		$base['align_v'] = in_array( $align_v, array( 'top', 'middle', 'bottom' ), true ) ? $align_v : 'middle';

		return $base;
	}

	/**
	 * Build slots from hub row fields when user only fills H2 column.
	 *
	 * @param array<string,mixed>              $row
	 * @param array<int,array<string,mixed>>|null $existing_slots
	 * @return array<int,array<string,mixed>>
	 */
	public static function slots_from_row( array $row, ?array $existing_slots = null ): array {
		if ( ! empty( $row['slots'] ) && is_array( $row['slots'] ) ) {
			$first = reset( $row['slots'] );
			if ( is_array( $first ) && isset( $first['type'] ) ) {
				return self::normalize_list( $row['slots'] );
			}
		}

		$h2       = sanitize_text_field( (string) ( $row['h2'] ?? '' ) );
		$existing = self::normalize_list( $existing_slots ?? array() );
		if ( ! empty( $existing ) ) {
			if ( $h2 !== '' ) {
				return self::merge_h2_text( $existing, $h2 );
			}
			return $existing;
		}

		if ( $h2 === '' ) {
			return array();
		}

		return array(
			array(
				'type' => 'h2',
				'text' => $h2,
			),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 * @return array<int,array<string,mixed>>
	 */
	public static function merge_h2_text( array $slots, string $h2 ): array {
		$slots = self::normalize_list( $slots );
		foreach ( $slots as &$slot ) {
			if ( ( $slot['type'] ?? '' ) === 'h2' ) {
				$slot['text'] = $h2;
				return $slots;
			}
		}
		unset( $slot );

		array_unshift(
			$slots,
			array(
				'type' => 'h2',
				'text' => $h2,
			)
		);

		return $slots;
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 */
	public static function summary( array $slots ): string {
		if ( empty( $slots ) ) {
			return __( 'No slots', 'flowbie-wp' );
		}
		$parts = array();
		foreach ( $slots as $slot ) {
			$type = (string) ( $slot['type'] ?? '' );
			switch ( $type ) {
				case 'h2':
					$parts[] = 'H' . absint( $slot['heading_level'] ?? 2 ) . ': ' . (string) ( $slot['text'] ?? '' );
					break;
				case 'paragraph':
					$parts[] = 'P';
					break;
				case 'cta':
					$parts[] = 'CTA: ' . (string) ( $slot['label'] ?? '' );
					break;
				case 'image':
					$parts[] = 'Image';
					break;
				case 'list':
					$parts[] = 'List (' . count( $slot['items'] ?? array() ) . ')';
					break;
				default:
					$parts[] = ucfirst( $type );
			}
		}
		return implode( ' · ', $parts );
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 * @param array<string,mixed>|null        $layout_config
	 */
	public static function render_html( array $slots, ?array $layout_config = null ): string {
		if ( ! empty( $layout_config ) && ! empty( $layout_config['sections'] ) ) {
			return Flowbie_Wp_Seo_Blocks_Layout::render_html( $slots, $layout_config );
		}
		$html = '';
		foreach ( self::normalize_list( $slots ) as $slot ) {
			$html .= self::render_slot( $slot );
		}
		return $html;
	}

	/**
	 * @param array<string,mixed> $slot
	 */
	public static function render_slot( array $slot ): string {
		$inner = self::render_slot_inner( $slot );
		if ( $inner === '' ) {
			return '';
		}

		$align_h = sanitize_key( (string) ( $slot['align_h'] ?? 'left' ) );
		if ( ! in_array( $align_h, array( 'left', 'center', 'right' ), true ) ) {
			$align_h = 'left';
		}
		$align_v = sanitize_key( (string) ( $slot['align_v'] ?? 'middle' ) );
		if ( ! in_array( $align_v, array( 'top', 'middle', 'bottom' ), true ) ) {
			$align_v = 'middle';
		}

		return '<div class="flowbie-seo-block__slot flowbie-seo-block__slot--align-h-' . esc_attr( $align_h ) . ' flowbie-seo-block__slot--align-v-' . esc_attr( $align_v ) . '">' . $inner . '</div>';
	}

	/**
	 * @param array<string,mixed> $slot
	 */
	private static function render_slot_inner( array $slot ): string {
		$type = (string) ( $slot['type'] ?? '' );
		switch ( $type ) {
			case 'h2':
				$text = (string) ( $slot['text'] ?? '' );
				if ( $text === '' ) {
					return '';
				}
				$level = absint( $slot['heading_level'] ?? 2 );
				if ( $level < 1 || $level > 6 ) {
					$level = 2;
				}
				$tag = 'h' . $level;
				return '<' . $tag . ' class="flowbie-seo-block__heading flowbie-seo-block__h' . esc_attr( (string) $level ) . ' flowbie-seo-block__h2">' . esc_html( $text ) . '</' . $tag . '>';
			case 'paragraph':
				$content = (string) ( $slot['html'] ?? '' );
				if ( $content === '' ) {
					return '';
				}
				return '<div class="flowbie-seo-block__paragraph">' . wp_kses_post( $content ) . '</div>';
			case 'cta':
				$label = (string) ( $slot['label'] ?? '' );
				$url   = (string) ( $slot['url'] ?? '' );
				if ( $label === '' ) {
					return '';
				}
				$style = sanitize_html_class( (string) ( $slot['style'] ?? 'primary' ) );
				if ( $url !== '' ) {
					return '<p class="flowbie-seo-block__cta"><a class="flowbie-seo-block__cta-link flowbie-seo-block__cta-link--' . esc_attr( $style ) . '" href="' . esc_url( $url ) . '">' . esc_html( $label ) . '</a></p>';
				}
				return '<p class="flowbie-seo-block__cta"><span class="flowbie-seo-block__cta-link flowbie-seo-block__cta-link--' . esc_attr( $style ) . '">' . esc_html( $label ) . '</span></p>';
			case 'image':
				$id = absint( $slot['attachment_id'] ?? 0 );
				if ( $id < 1 ) {
					return '';
				}
				$alt = (string) ( $slot['alt'] ?? '' );
				$img = wp_get_attachment_image( $id, 'large', false, array( 'class' => 'flowbie-seo-block__image', 'loading' => 'lazy', 'alt' => $alt ) );
				return $img ? '<figure class="flowbie-seo-block__figure">' . $img . '</figure>' : '';
			case 'list':
				$html = (string) ( $slot['html'] ?? '' );
				if ( $html !== '' ) {
					return '<div class="flowbie-seo-block__list flowbie-seo-block__list--rich">' . wp_kses_post( $html ) . '</div>';
				}
				$items = isset( $slot['items'] ) && is_array( $slot['items'] ) ? $slot['items'] : array();
				if ( empty( $items ) ) {
					return '';
				}
				$tag = ( ( $slot['style'] ?? 'bullet' ) === 'number' ) ? 'ol' : 'ul';
				$lis = '';
				foreach ( $items as $item ) {
					$item = sanitize_text_field( (string) $item );
					if ( $item === '' ) {
						continue;
					}
					$lis .= '<li>' . esc_html( $item ) . '</li>';
				}
				return $lis ? '<' . $tag . ' class="flowbie-seo-block__list">' . $lis . '</' . $tag . '>' : '';
			default:
				return '';
		}
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 * @return array<int,array<string,mixed>>
	 */
	public static function add_elementor_ids( array $slots ): array {
		$out = array();
		foreach ( self::normalize_list( $slots ) as $slot ) {
			if ( empty( $slot['_id'] ) ) {
				$slot['_id'] = substr( md5( uniqid( (string) wp_rand(), true ) ), 0, 7 );
			}
			$out[] = $slot;
		}
		return $out;
	}

	/**
	 * Parse Elementor widget repeater settings into normalized slots (no Elementor dependency).
	 *
	 * @param array<string,mixed> $settings
	 * @return array<int,array<string,mixed>>
	 */
	public static function from_elementor_settings( array $settings ): array {
		$raw = isset( $settings['content_slots'] ) && is_array( $settings['content_slots'] ) ? $settings['content_slots'] : array();
		$out = array();
		foreach ( $raw as $slot ) {
			if ( ! is_array( $slot ) ) {
				continue;
			}
			$mapped = array(
				'type'    => (string) ( $slot['type'] ?? '' ),
				'_id'     => (string) ( $slot['_id'] ?? '' ),
				'align_h' => (string) ( $slot['align_h'] ?? 'left' ),
				'align_v' => 'middle',
			);
			switch ( $mapped['type'] ) {
				case 'h2':
					$mapped['text']          = (string) ( $slot['text'] ?? '' );
					$mapped['heading_level'] = absint( $slot['heading_level'] ?? 2 );
					break;
				case 'paragraph':
					$mapped['html'] = (string) ( $slot['html'] ?? '' );
					break;
				case 'cta':
					$mapped['label'] = (string) ( $slot['label'] ?? '' );
					$url             = isset( $slot['url'] ) && is_array( $slot['url'] ) ? (string) ( $slot['url']['url'] ?? '' ) : (string) ( $slot['url'] ?? '' );
					$mapped['url']   = $url;
					$mapped['style'] = (string) ( $slot['style'] ?? 'primary' );
					break;
				case 'image':
					$media = isset( $slot['attachment_id'] ) && is_array( $slot['attachment_id'] ) ? $slot['attachment_id'] : array();
					$mapped['attachment_id'] = absint( $media['id'] ?? $slot['attachment_id'] ?? 0 );
					$mapped['alt']           = (string) ( $slot['alt'] ?? '' );
					break;
				case 'list':
					$mapped['style'] = (string) ( $slot['list_style'] ?? $slot['style'] ?? 'bullet' );
					$mapped['html']  = (string) ( $slot['html'] ?? '' );
					$items_raw       = (string) ( $slot['items'] ?? '' );
					$mapped['items'] = array_values(
						array_filter(
							array_map( 'trim', preg_split( '/\r\n|\r|\n/', $items_raw ) ?: array() ),
							static function ( $item ) {
								return $item !== '';
							}
						)
					);
					break;
			}
			$normalized = self::normalize_slot( $mapped );
			if ( $normalized ) {
				$out[] = $normalized;
			}
		}
		return $out;
	}
}
