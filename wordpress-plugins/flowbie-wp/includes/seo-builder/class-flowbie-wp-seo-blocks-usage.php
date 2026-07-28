<?php
/**
 * Scan site for SEO block widget usage.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Seo_Blocks_Usage {

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function scan_all(): array {
		$query = new WP_Query(
			array(
				'post_type'      => array( 'page', 'post', 'elementor_library' ),
				'post_status'    => array( 'publish', 'draft', 'private', 'pending' ),
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
				'meta_query'     => array(
					array(
						'key'     => '_elementor_data',
						'compare' => 'EXISTS',
					),
				),
			)
		);

		$usage = array();
		foreach ( $query->posts as $post_id ) {
			$post_id = (int) $post_id;
			$found   = self::find_in_post( $post_id );
			foreach ( $found as $item ) {
				$block_id = (int) ( $item['block_id'] ?? 0 );
				if ( $block_id < 1 ) {
					continue;
				}
				if ( ! isset( $usage[ $block_id ] ) ) {
					$usage[ $block_id ] = array();
				}
				$usage[ $block_id ][] = $item;
			}
		}
		return $usage;
	}

	public static function count_for_block( int $block_id ): int {
		if ( $block_id < 1 ) {
			return 0;
		}
		$all = self::scan_all();
		return isset( $all[ $block_id ] ) ? count( $all[ $block_id ] ) : 0;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function find_in_post( int $post_id ): array {
		$raw = get_post_meta( $post_id, '_elementor_data', true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return array();
		}
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return array();
		}
		$found = array();
		self::walk_elements( $data, $post_id, $found );
		return $found;
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @param array<int,array<string,mixed>> $found
	 */
	private static function walk_elements( array $elements, int $post_id, array &$found ): void {
		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( ( $element['elType'] ?? '' ) === 'widget' && ( $element['widgetType'] ?? '' ) === 'flowbie_seo_section' ) {
				$settings = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();
				$found[]  = array(
					'post_id'    => $post_id,
					'post_title' => get_the_title( $post_id ),
					'post_url'   => get_permalink( $post_id ),
					'edit_url'   => admin_url( 'post.php?post=' . $post_id . '&action=elementor' ),
					'element_id' => (string) ( $element['id'] ?? '' ),
					'block_id'   => absint( $settings['registry_block_id'] ?? $settings['block_id'] ?? 0 ),
				);
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::walk_elements( $element['elements'], $post_id, $found );
			}
		}
	}
}
