<?php
/**
 * Sync Elementor widget forms to flowbie-form CPT on document save.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Forms_Elementor_Sync {

	const META_DOC_ID      = '_flowbie_elementor_doc_id';
	const META_ELEMENT_ID  = '_flowbie_elementor_element_id';

	public static function init(): void {
		add_filter( 'elementor/document/save/data', array( __CLASS__, 'sync_on_document_save' ), 10, 2 );
		add_action( 'before_delete_post', array( __CLASS__, 'maybe_trash_linked_forms' ), 10, 2 );
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
		$data['elements'] = self::walk_elements( $data['elements'], $doc_id );
		return $data;
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @return array<int,array<string,mixed>>
	 */
	private static function walk_elements( array $elements, int $doc_id ): array {
		foreach ( $elements as &$element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( ( $element['elType'] ?? '' ) === 'widget' && ( $element['widgetType'] ?? '' ) === 'flowbie_form' ) {
				$settings = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();
				if ( ( $settings['form_source'] ?? 'existing' ) === 'custom' ) {
					$form_id = self::sync_widget_form( $settings, $doc_id, (string) ( $element['id'] ?? '' ) );
					if ( $form_id > 0 ) {
						$element['settings']['linked_form_id'] = $form_id;
					}
				}
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$element['elements'] = self::walk_elements( $element['elements'], $doc_id );
			}
		}
		unset( $element );
		return $elements;
	}

	/**
	 * @param array<string,mixed> $settings
	 */
	public static function sync_widget_form( array $settings, int $doc_id, string $element_id ): int {
		$payload = Flowbie_Wp_Forms_Field_Controls::widget_settings_to_form_payload( $settings );
		$form_id = Flowbie_Wp_Forms_Storage::save_form( $payload );
		if ( $form_id < 1 ) {
			return 0;
		}
		update_post_meta( $form_id, self::META_DOC_ID, $doc_id );
		if ( $element_id !== '' ) {
			update_post_meta( $form_id, self::META_ELEMENT_ID, sanitize_text_field( $element_id ) );
		}
		return $form_id;
	}

	/**
	 * @param int      $post_id
	 * @param \WP_Post $post
	 */
	public static function maybe_trash_linked_forms( int $post_id, $post ): void {
		if ( ! $post instanceof WP_Post ) {
			return;
		}
		if ( $post->post_type !== 'page' && $post->post_type !== 'elementor_library' ) {
			return;
		}
		if ( ! class_exists( '\Elementor\Plugin', false ) ) {
			return;
		}

		$forms = get_posts(
			array(
				'post_type'      => Flowbie_Wp_Forms_Storage::CPT_FORM,
				'post_status'    => array( 'publish', 'draft' ),
				'posts_per_page' => -1,
				'meta_key'       => self::META_DOC_ID,
				'meta_value'     => (string) $post_id,
				'fields'         => 'ids',
			)
		);
		foreach ( $forms as $form_id ) {
			Flowbie_Wp_Forms_Storage::delete_form( (int) $form_id, false );
		}
	}

	public static function is_elementor_form( int $form_id ): bool {
		return (string) get_post_meta( $form_id, self::META_DOC_ID, true ) !== '';
	}

	/**
	 * @return int
	 */
	public static function get_elementor_doc_id( int $form_id ): int {
		return (int) get_post_meta( $form_id, self::META_DOC_ID, true );
	}
}
