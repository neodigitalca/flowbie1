<?php
/**
 * Elementor library section sync for SEO blocks.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Blocks_Library {

	const META_BLOCK_ID = '_neo_pulse_seo_block_id';

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|WP_Error
	 */
	public static function sync_row( array $row ) {
		if ( ! self::elementor_available() ) {
			return new WP_Error( 'neo-pulse_elementor_missing', __( 'Elementor is required for library sync.', 'neo-pulse-wp' ) );
		}

		$block_id    = (int) ( $row['id'] ?? 0 );
		$library_id  = (int) ( $row['elementor_library_id'] ?? 0 );
		$title       = sanitize_text_field( (string) ( $row['title'] ?? '' ) );
		$settings    = self::row_to_widget_settings( $row );
		$elements    = self::build_section_elements( $settings );
		$json        = wp_json_encode( $elements );
		if ( ! is_string( $json ) ) {
			return new WP_Error( 'neo-pulse_seo_block_json', __( 'Could not encode Elementor data.', 'neo-pulse-wp' ) );
		}

		if ( $library_id > 0 && get_post( $library_id ) ) {
			$post_id = $library_id;
			wp_update_post(
				array(
					'ID'         => $post_id,
					'post_title' => $title,
					'post_status'=> 'publish',
				)
			);
		} else {
			$post_id = wp_insert_post(
				array(
					'post_title'  => $title,
					'post_type'   => 'elementor_library',
					'post_status' => 'publish',
				),
				true
			);
			if ( is_wp_error( $post_id ) ) {
				return $post_id;
			}
			$post_id = (int) $post_id;
		}

		update_post_meta( $post_id, '_elementor_template_type', 'section' );
		update_post_meta( $post_id, '_elementor_edit_mode', 'builder' );
		update_post_meta( $post_id, '_wp_page_template', 'default' );
		update_post_meta( $post_id, '_elementor_data', wp_slash( $json ) );
		update_post_meta( $post_id, self::META_BLOCK_ID, $block_id );

		if ( taxonomy_exists( 'elementor_library_category' ) ) {
			if ( ! term_exists( 'neo-pulse-seo', 'elementor_library_category' ) ) {
				wp_insert_term( 'NEO Pulse SEO', 'elementor_library_category', array( 'slug' => 'neo-pulse-seo' ) );
			}
			wp_set_object_terms( $post_id, array( 'neo-pulse-seo' ), 'elementor_library_category', false );
		}

		if ( $block_id > 0 && (int) ( $row['elementor_library_id'] ?? 0 ) !== $post_id ) {
			global $wpdb;
			$table = Neo_Pulse_Wp_Seo_Blocks_Storage::table_name();
			$wpdb->update(
				$table,
				array(
					'elementor_library_id' => $post_id,
					'updated_at'           => current_time( 'mysql' ),
				),
				array( 'id' => $block_id ),
				array( '%d', '%s' ),
				array( '%d' )
			);
		}

		$row['elementor_library_id'] = $post_id;
		$row['library_edit_url']       = admin_url( 'post.php?post=' . $post_id . '&action=elementor' );

		return $row;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	public static function row_to_widget_settings( array $row ): array {
		if ( ! class_exists( '\Elementor\Widget_Base' ) ) {
			$block_id = (string) (int) ( $row['id'] ?? 0 );
			return array(
				'block_id'          => $block_id,
				'registry_block_id' => $block_id,
				'focus_keyword'     => sanitize_text_field( (string) ( $row['focus_keyword'] ?? '' ) ),
				'topic_focus'       => sanitize_textarea_field( (string) ( $row['topic_focus'] ?? '' ) ),
				'content_slots'     => array(),
				'layout_config_json' => wp_json_encode( $row['layout_config'] ?? array() ),
			);
		}

		if ( ! class_exists( 'Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget', false ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-elementor-widget.php';
		}

		$slots = Neo_Pulse_Wp_Seo_Blocks_Slots::add_elementor_ids(
			Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $row['slots'] ?? array() )
		);
		$block_id = (string) (int) ( $row['id'] ?? 0 );

		return array(
			'block_id'          => $block_id,
			'registry_block_id' => $block_id,
			'focus_keyword'     => sanitize_text_field( (string) ( $row['focus_keyword'] ?? '' ) ),
			'topic_focus'       => sanitize_textarea_field( (string) ( $row['topic_focus'] ?? '' ) ),
			'content_slots'     => Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget::slots_to_repeater_settings( $slots ),
			'layout_config_json' => Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget::layout_to_json( $row['layout_config'] ?? array() ),
		);
	}

	/**
	 * @param array<string,mixed> $settings
	 * @return array<int,array<string,mixed>>
	 */
	public static function build_section_elements( array $settings ): array {
		$section_id = self::generate_element_id();
		$column_id  = self::generate_element_id();
		$widget_id  = self::generate_element_id();

		return array(
			array(
				'id'       => $section_id,
				'elType'   => 'section',
				'isInner'  => false,
				'settings' => array(),
				'elements' => array(
					array(
						'id'       => $column_id,
						'elType'   => 'column',
						'isInner'  => false,
						'settings' => array(
							'_column_size' => 100,
						),
						'elements' => array(
							array(
								'id'         => $widget_id,
								'elType'     => 'widget',
								'widgetType' => 'neo-pulse_seo_section',
								'settings'   => $settings,
								'elements'   => array(),
							),
						),
					),
				),
			),
		);
	}

	public static function elementor_available(): bool {
		return did_action( 'elementor/loaded' ) || defined( 'ELEMENTOR_VERSION' );
	}

	public static function generate_element_id(): string {
		return substr( md5( uniqid( (string) wp_rand(), true ) ), 0, 7 );
	}

	/**
	 * @return string
	 */
	public static function library_edit_url( int $library_id ): string {
		if ( $library_id < 1 ) {
			return '';
		}
		return admin_url( 'post.php?post=' . $library_id . '&action=elementor' );
	}
}
