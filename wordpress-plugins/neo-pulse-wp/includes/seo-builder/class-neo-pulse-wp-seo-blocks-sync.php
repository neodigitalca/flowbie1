<?php
/**
 * Sync SEO block widgets with registry and Elementor pages.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Blocks_Sync {

	public static function init(): void {
		add_filter( 'elementor/document/save/data', array( __CLASS__, 'sync_on_document_save' ), 10, 2 );
	}

	/**
	 * @param array<string,mixed> $data
	 * @param \Elementor\Core\Base\Document $document
	 * @return array<string,mixed>
	 */
	public static function sync_on_document_save( array $data, $document ): array {
		if ( empty( $data['elements'] ) || ! is_array( $data['elements'] ) ) {
			return $data;
		}

		$doc_id = (int) $document->get_main_id();
		$data['elements'] = self::walk_and_sync( $data['elements'], $doc_id );
		return $data;
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @return array<int,array<string,mixed>>
	 */
	private static function walk_and_sync( array $elements, int $doc_id ): array {
		foreach ( $elements as &$element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( ( $element['elType'] ?? '' ) === 'widget' && ( $element['widgetType'] ?? '' ) === 'neo-pulse_seo_section' ) {
				$settings = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();
				$block_id = absint( $settings['registry_block_id'] ?? $settings['block_id'] ?? 0 );
				if ( $block_id > 0 ) {
					$element['settings']['block_id']          = (string) $block_id;
					$element['settings']['registry_block_id'] = (string) $block_id;
					$slots = Neo_Pulse_Wp_Seo_Blocks_Slots::from_elementor_settings( $settings );
					$row   = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $block_id );
					if ( is_array( $row ) ) {
						$row['slots']          = $slots;
						$row['focus_keyword']  = (string) ( $settings['focus_keyword'] ?? $row['focus_keyword'] ?? '' );
						$row['topic_focus']    = (string) ( $settings['topic_focus'] ?? $row['topic_focus'] ?? '' );
						$row['title']          = $row['title'] !== '' ? $row['title'] : Neo_Pulse_Wp_Seo_Blocks_Storage::first_h2( $slots );
						$layout = Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget::settings_to_layout( $settings, $slots );
						if ( is_array( $layout ) ) {
							$row['layout_config'] = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $layout, $slots );
						}
						Neo_Pulse_Wp_Seo_Blocks_Storage::save( $row );
					}
				}
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$element['elements'] = self::walk_and_sync( $element['elements'], $doc_id );
			}
		}
		unset( $element );
		return $elements;
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 * @param array<string,mixed>            $meta
	 * @return true|WP_Error
	 */
	public static function apply_to_page_element( int $post_id, string $element_id, array $slots, array $meta = array() ) {
		if ( $post_id < 1 || $element_id === '' ) {
			return new WP_Error( 'neo-pulse_seo_block_apply', __( 'Missing post or element ID.', 'neo-pulse-wp' ) );
		}

		if ( ! Neo_Pulse_Wp_Ai_Gate::can_apply( $post_id ) ) {
			return new WP_Error( 'neo-pulse_seo_block_gate', __( 'Apply is not allowed for this post.', 'neo-pulse-wp' ) );
		}

		$raw = get_post_meta( $post_id, '_elementor_data', true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return new WP_Error( 'neo-pulse_seo_block_elementor', __( 'Elementor data not found on this post.', 'neo-pulse-wp' ) );
		}

		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return new WP_Error( 'neo-pulse_seo_block_elementor', __( 'Invalid Elementor data.', 'neo-pulse-wp' ) );
		}

		$updated = self::update_element_settings(
			$data,
			$element_id,
			array(
				'content_slots'     => Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget::slots_to_repeater_settings( $slots ),
				'topic_focus'       => (string) ( $meta['topic_focus'] ?? '' ),
				'focus_keyword'     => (string) ( $meta['focus_keyword'] ?? '' ),
				'block_id'          => (string) absint( $meta['block_id'] ?? 0 ),
				'registry_block_id' => (string) absint( $meta['block_id'] ?? 0 ),
			)
		);

		if ( ! $updated ) {
			return new WP_Error( 'neo-pulse_seo_block_element', __( 'Could not find the target widget on this page.', 'neo-pulse-wp' ) );
		}

		$json = wp_json_encode( $data );
		if ( ! is_string( $json ) ) {
			return new WP_Error( 'neo-pulse_seo_block_json', __( 'Could not encode Elementor data.', 'neo-pulse-wp' ) );
		}

		update_post_meta( $post_id, '_elementor_data', wp_slash( $json ) );

		if ( class_exists( '\Elementor\Plugin', false ) ) {
			$document = \Elementor\Plugin::$instance->documents->get( $post_id );
			if ( $document ) {
				$document->save( array( 'elements' => $data ) );
			}
		}

		return true;
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @param array<string,mixed>            $patch
	 */
	private static function update_element_settings( array &$elements, string $element_id, array $patch ): bool {
		$found = false;
		foreach ( $elements as &$element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( (string) ( $element['id'] ?? '' ) === $element_id ) {
				$settings = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();
				foreach ( $patch as $key => $value ) {
					if ( $value === '' || $value === null || ( is_array( $value ) && empty( $value ) && $key !== 'content_slots' ) ) {
						continue;
					}
					$settings[ $key ] = $value;
				}
				$element['settings'] = $settings;
				return true;
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				if ( self::update_element_settings( $element['elements'], $element_id, $patch ) ) {
					$found = true;
					break;
				}
			}
		}
		unset( $element );
		return $found;
	}
}
