<?php
/**
 * Insert registry-linked SEO block widgets into Elementor pages.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Blocks_Page_Insert {

	/**
	 * Enable Elementor builder mode on a page when missing.
	 */
	public static function ensure_elementor_page( int $post_id ): void {
		if ( $post_id < 1 ) {
			return;
		}

		if ( get_post_meta( $post_id, '_elementor_edit_mode', true ) !== 'builder' ) {
			update_post_meta( $post_id, '_elementor_edit_mode', 'builder' );
		}

		$settings = get_post_meta( $post_id, '_elementor_page_settings', true );
		if ( ! is_array( $settings ) ) {
			update_post_meta( $post_id, '_elementor_page_settings', array() );
		}

		$raw = get_post_meta( $post_id, '_elementor_data', true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			update_post_meta( $post_id, '_elementor_data', wp_slash( '[]' ) );
		}
	}

	/**
	 * Insert a registry-linked neo-pulse_seo_section widget on a page.
	 *
	 * @param array<string,mixed> $opts mode (append|replace), sync_library, include_dynamic_heading.
	 * @return array<string,mixed>|WP_Error
	 */
	public static function insert_registry_widget( int $post_id, int $block_id, array $opts = array() ) {
		if ( $post_id < 1 || $block_id < 1 ) {
			return new WP_Error( 'neo-pulse_seo_page_insert', __( 'Missing post or block ID.', 'neo-pulse-wp' ) );
		}

		if ( ! Neo_Pulse_Wp_Seo_Blocks_Library::elementor_available() ) {
			return new WP_Error( 'neo-pulse_elementor_missing', __( 'Elementor is required to apply SEO blocks to pages.', 'neo-pulse-wp' ) );
		}

		if ( ! Neo_Pulse_Wp_Ai_Gate::can_apply( $post_id ) ) {
			return new WP_Error( 'neo-pulse_seo_block_gate', __( 'Apply is not allowed for this post.', 'neo-pulse-wp' ) );
		}

		$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $block_id );
		if ( ! is_array( $row ) ) {
			return new WP_Error( 'neo-pulse_seo_block_missing', __( 'SEO block not found.', 'neo-pulse-wp' ) );
		}

		$row['primary_post_id'] = $post_id;
		$saved                  = Neo_Pulse_Wp_Seo_Blocks_Storage::save( $row );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		$row = $saved;

		$mode                    = isset( $opts['mode'] ) ? sanitize_key( (string) $opts['mode'] ) : 'append';
		$sync_library            = ! empty( $opts['sync_library'] );
		$include_dynamic_heading = ! isset( $opts['include_dynamic_heading'] ) || ! empty( $opts['include_dynamic_heading'] );

		self::ensure_elementor_page( $post_id );

		$new_sections = array();
		$heading_note = '';

		if ( $include_dynamic_heading ) {
			$heading_section = self::build_dynamic_heading_section( $post_id );
			if ( is_array( $heading_section ) ) {
				$new_sections[] = $heading_section;
			} else {
				$heading_note = __( 'Dynamic heading skipped (Elementor Pro dynamic tags unavailable).', 'neo-pulse-wp' );
			}
		}

		$widget_settings = self::registry_widget_settings( $row );
		$block_section   = Neo_Pulse_Wp_Seo_Blocks_Library::build_section_elements( $widget_settings );
		$new_sections    = array_merge( $new_sections, $block_section );

		$element_id = self::find_widget_id( $block_section );

		$existing = self::decode_elementor_data( $post_id );
		if ( is_wp_error( $existing ) ) {
			$existing = array();
		}

		if ( $mode === 'replace' || empty( $existing ) ) {
			$merged = $new_sections;
		} else {
			$merged = array_merge( $existing, $new_sections );
		}

		$written = self::write_elementor_data( $post_id, $merged );
		if ( is_wp_error( $written ) ) {
			return $written;
		}

		if ( $sync_library ) {
			$synced = Neo_Pulse_Wp_Seo_Blocks_Library::sync_row( $row );
			if ( is_wp_error( $synced ) ) {
				return $synced;
			}
			$row = $synced;
		}

		$summary = sprintf(
			/* translators: 1: block title, 2: page title */
			__( 'Applied SEO block "%1$s" to page "%2$s" with registry link.', 'neo-pulse-wp' ),
			(string) ( $row['title'] ?? $block_id ),
			get_the_title( $post_id )
		);
		if ( $heading_note !== '' ) {
			$summary .= ' ' . $heading_note;
		}

		return array(
			'success'           => true,
			'post_id'           => $post_id,
			'block_id'          => $block_id,
			'element_id'        => $element_id,
			'title'             => get_the_title( $post_id ),
			'summary'           => $summary,
			'edit_url'          => get_edit_post_link( $post_id, 'raw' ),
			'view_url'          => get_permalink( $post_id ),
			'elementor_edit_url'=> admin_url( 'post.php?post=' . $post_id . '&action=elementor' ),
			'block_edit_url'    => admin_url( 'admin.php?page=neo-pulse-wp-agent-hub-edit&block_id=' . $block_id ),
			'dynamic_heading'   => $heading_note === '',
			'heading_note'      => $heading_note,
		);
	}

	/**
	 * Registry-only widget settings (live content from Agent Hub).
	 *
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	public static function registry_widget_settings( array $row ): array {
		$block_id = (string) absint( $row['id'] ?? 0 );

		if ( ! class_exists( 'Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget', false ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-elementor-widget.php';
		}

		return array(
			'block_id'           => $block_id,
			'registry_block_id'  => $block_id,
			'focus_keyword'      => sanitize_text_field( (string) ( $row['focus_keyword'] ?? '' ) ),
			'topic_focus'        => sanitize_textarea_field( (string) ( $row['topic_focus'] ?? '' ) ),
			'content_slots'      => array(),
			'layout_config_json' => Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget::layout_to_json(
				is_array( $row['layout_config'] ?? null ) ? $row['layout_config'] : array()
			),
		);
	}

	/**
	 * Optional H1 section with focus keyword bound via dynamic tag.
	 *
	 * @return array<string,mixed>|null
	 */
	private static function build_dynamic_heading_section( int $post_id ): ?array {
		if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Elementor', false ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor.php';
		}

		$tag = Neo_Pulse_Wp_Fields_Elementor::build_post_meta_text_tag( '_neo_pulse_focus_keyword' );
		if ( $tag === '' ) {
			return null;
		}

		$section_id = Neo_Pulse_Wp_Seo_Blocks_Library::generate_element_id();
		$column_id  = Neo_Pulse_Wp_Seo_Blocks_Library::generate_element_id();
		$widget_id  = Neo_Pulse_Wp_Seo_Blocks_Library::generate_element_id();

		return array(
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
							'widgetType' => 'heading',
							'settings'   => array(
								'title'           => get_post_meta( $post_id, '_neo_pulse_focus_keyword', true ) ?: get_the_title( $post_id ),
								'header_size'     => 'h1',
								'__dynamic__'     => array(
									'title' => $tag,
								),
								'__dynamic__title' => $tag,
							),
							'elements'   => array(),
						),
					),
				),
			),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $sections
	 */
	private static function find_widget_id( array $sections ): string {
		foreach ( $sections as $section ) {
			if ( ! is_array( $section ) ) {
				continue;
			}
			$id = self::walk_find_seo_widget( $section );
			if ( $id !== '' ) {
				return $id;
			}
		}
		return '';
	}

	/**
	 * @param array<string,mixed> $element
	 */
	private static function walk_find_seo_widget( array $element ): string {
		if ( ( $element['elType'] ?? '' ) === 'widget' && ( $element['widgetType'] ?? '' ) === 'neo-pulse_seo_section' ) {
			return (string) ( $element['id'] ?? '' );
		}
		if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
			foreach ( $element['elements'] as $child ) {
				if ( ! is_array( $child ) ) {
					continue;
				}
				$found = self::walk_find_seo_widget( $child );
				if ( $found !== '' ) {
					return $found;
				}
			}
		}
		return '';
	}

	/**
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	private static function decode_elementor_data( int $post_id ) {
		$raw = get_post_meta( $post_id, '_elementor_data', true );
		if ( ! is_string( $raw ) || $raw === '' || $raw === '[]' ) {
			return array();
		}
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return new WP_Error( 'neo-pulse_seo_block_elementor', __( 'Invalid Elementor data.', 'neo-pulse-wp' ) );
		}
		return $data;
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @return true|WP_Error
	 */
	private static function write_elementor_data( int $post_id, array $elements ) {
		$json = wp_json_encode( $elements );
		if ( ! is_string( $json ) ) {
			return new WP_Error( 'neo-pulse_seo_block_json', __( 'Could not encode Elementor data.', 'neo-pulse-wp' ) );
		}
		update_post_meta( $post_id, '_elementor_data', wp_slash( $json ) );
		delete_post_meta( $post_id, '_elementor_element_cache' );
		return true;
	}
}
