<?php
/**
 * Image SEO config and attachment metadata helpers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Image_Seo {

	const OPTION_KEY = 'neo_pulse_wp_image_seo_config';

	const FIELD_KEYS = array( 'title', 'alt', 'caption', 'description' );

	public static function init(): void {
		add_action( 'add_attachment', array( __CLASS__, 'maybe_auto_on_upload' ), 20, 1 );
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function default_config(): array {
		return array(
			'overwrite_mode'    => 'missing_only',
			'fields'            => array(
				'title'       => true,
				'alt'         => true,
				'caption'     => true,
				'description' => false,
			),
			'auto_on_upload'    => false,
			'auto_in_gallery'   => false,
			'auto_mode'         => 'filename',
			'context_from_post' => true,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function get_config(): array {
		$stored = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}
		$config = array_merge( self::default_config(), $stored );
		$fields = is_array( $config['fields'] ?? null ) ? $config['fields'] : array();
		foreach ( self::FIELD_KEYS as $key ) {
			if ( ! array_key_exists( $key, $fields ) ) {
				$fields[ $key ] = (bool) ( self::default_config()['fields'][ $key ] ?? false );
			} else {
				$fields[ $key ] = (bool) $fields[ $key ];
			}
		}
		$config['fields'] = $fields;
		if ( ! in_array( $config['overwrite_mode'], array( 'missing_only', 'overwrite_all' ), true ) ) {
			$config['overwrite_mode'] = 'missing_only';
		}
		if ( ! in_array( $config['auto_mode'], array( 'filename', 'ai' ), true ) ) {
			$config['auto_mode'] = 'filename';
		}
		return $config;
	}

	/**
	 * @param array<string,mixed> $input
	 * @return array<string,mixed>
	 */
	public static function sanitize_config( array $input ): array {
		$defaults = self::default_config();
		$fields   = array();
		foreach ( self::FIELD_KEYS as $key ) {
			$fields[ $key ] = ! empty( $input[ 'field_' . $key ] );
		}
		$overwrite = isset( $input['overwrite_mode'] ) ? sanitize_key( (string) $input['overwrite_mode'] ) : 'missing_only';
		if ( ! in_array( $overwrite, array( 'missing_only', 'overwrite_all' ), true ) ) {
			$overwrite = 'missing_only';
		}
		$auto_mode = isset( $input['auto_mode'] ) ? sanitize_key( (string) $input['auto_mode'] ) : 'filename';
		if ( ! in_array( $auto_mode, array( 'filename', 'ai' ), true ) ) {
			$auto_mode = 'filename';
		}
		return array(
			'overwrite_mode'    => $overwrite,
			'fields'            => $fields,
			'auto_on_upload'    => ! empty( $input['auto_on_upload'] ),
			'auto_in_gallery'   => ! empty( $input['auto_in_gallery'] ),
			'auto_mode'         => $auto_mode,
			'context_from_post' => ! empty( $input['context_from_post'] ),
		);
	}

	/**
	 * @param array<string,mixed> $config
	 */
	public static function save_config( array $config ): void {
		update_option( self::OPTION_KEY, self::sanitize_config( $config ), false );
	}

	/**
	 * @return array<string,string>
	 */
	public static function read_meta( int $attachment_id ): array {
		$post = get_post( $attachment_id );
		if ( ! $post instanceof WP_Post ) {
			return array(
				'title'       => '',
				'alt'         => '',
				'caption'     => '',
				'description' => '',
				'filename'    => '',
			);
		}
		$file = get_attached_file( $attachment_id );
		return array(
			'title'       => (string) $post->post_title,
			'alt'         => (string) get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
			'caption'     => (string) $post->post_excerpt,
			'description' => (string) $post->post_content,
			'filename'    => $file ? basename( $file ) : '',
		);
	}

	/**
	 * @param array<string,string> $values
	 * @return true|WP_Error
	 */
	public static function save_meta( int $attachment_id, array $values ) {
		$check = Neo_Pulse_Wp_Image_Seo_Gate::can_edit_attachment( $attachment_id );
		if ( is_wp_error( $check ) ) {
			return $check;
		}

		$update = array( 'ID' => $attachment_id );
		if ( array_key_exists( 'title', $values ) ) {
			$update['post_title'] = sanitize_text_field( (string) $values['title'] );
		}
		if ( array_key_exists( 'caption', $values ) ) {
			$update['post_excerpt'] = sanitize_textarea_field( (string) $values['caption'] );
		}
		if ( array_key_exists( 'description', $values ) ) {
			$update['post_content'] = wp_kses_post( (string) $values['description'] );
		}

		if ( count( $update ) > 1 ) {
			$result = wp_update_post( $update, true );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}

		if ( array_key_exists( 'alt', $values ) ) {
			update_post_meta( $attachment_id, '_wp_attachment_image_alt', sanitize_text_field( (string) $values['alt'] ) );
		}

		return true;
	}

	/**
	 * @param array<string,string> $proposed
	 * @param array<string,string> $existing
	 * @param string               $overwrite_mode
	 * @param array<string,bool>   $fields
	 * @return array<string,string>
	 */
	public static function merge_values( array $proposed, array $existing, string $overwrite_mode, array $fields ): array {
		$out = array();
		foreach ( self::FIELD_KEYS as $key ) {
			if ( empty( $fields[ $key ] ) ) {
				continue;
			}
			$new_val = isset( $proposed[ $key ] ) ? trim( (string) $proposed[ $key ] ) : '';
			$old_val = isset( $existing[ $key ] ) ? trim( (string) $existing[ $key ] ) : '';
			if ( $new_val === '' ) {
				continue;
			}
			if ( $overwrite_mode === 'overwrite_all' || $old_val === '' ) {
				$out[ $key ] = $new_val;
			}
		}
		return $out;
	}

	public static function filename_from_attachment( int $attachment_id ): string {
		$file = get_attached_file( $attachment_id );
		return $file ? basename( $file ) : '';
	}

	public static function is_missing_alt( int $attachment_id ): bool {
		$alt = get_post_meta( $attachment_id, '_wp_attachment_image_alt', true );
		return trim( (string) $alt ) === '';
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function attachment_row( int $attachment_id ): array {
		$meta = self::read_meta( $attachment_id );
		$thumb = wp_get_attachment_image_src( $attachment_id, 'thumbnail' );
		return array(
			'id'          => $attachment_id,
			'filename'    => $meta['filename'],
			'title'       => $meta['title'],
			'alt'         => $meta['alt'],
			'caption'     => $meta['caption'],
			'description' => $meta['description'],
			'thumbUrl'    => $thumb ? $thumb[0] : '',
			'missingAlt'  => self::is_missing_alt( $attachment_id ),
		);
	}

	public static function maybe_auto_on_upload( int $attachment_id ): void {
		if ( ! wp_attachment_is_image( $attachment_id ) ) {
			return;
		}
		$config = self::get_config();
		if ( empty( $config['auto_on_upload'] ) ) {
			return;
		}
		self::auto_optimize( $attachment_id, 0, $config );
	}

	/**
	 * @param array<string,mixed>|null $config
	 */
	public static function auto_optimize( int $attachment_id, int $post_id = 0, ?array $config = null ): bool {
		$config = $config ?? self::get_config();
		$use_ai = ( $config['auto_mode'] ?? 'filename' ) === 'ai';

		if ( $use_ai && ! Neo_Pulse_Wp_Image_Seo_Gate::can_ai( $post_id ) ) {
			$use_ai = false;
		}

		$existing = self::read_meta( $attachment_id );
		$fields   = is_array( $config['fields'] ?? null ) ? $config['fields'] : self::default_config()['fields'];

		if ( $use_ai ) {
			$proposed = Neo_Pulse_Wp_Image_Seo_Ai::preview_ai( $attachment_id, $post_id, $fields, $config );
			if ( is_wp_error( $proposed ) ) {
				$proposed = Neo_Pulse_Wp_Image_Seo_Ai::preview_filename( $attachment_id, $fields );
			}
		} else {
			$proposed = Neo_Pulse_Wp_Image_Seo_Ai::preview_filename( $attachment_id, $fields );
		}

		$merged = self::merge_values(
			$proposed,
			$existing,
			(string) ( $config['overwrite_mode'] ?? 'missing_only' ),
			$fields
		);
		if ( empty( $merged ) ) {
			return false;
		}
		$result = self::save_meta( $attachment_id, $merged );
		return ! is_wp_error( $result );
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array{items:array<int,array<string,mixed>>,total:int,page:int,per_page:int}
	 */
	/**
	 * Render inline SEO metadata panel for image/gallery fields.
	 */
	public static function render_attachment_seo_panel( int $attachment_id, string $context = 'gallery' ): void {
		if ( $attachment_id < 1 ) {
			return;
		}
		$meta = self::read_meta( $attachment_id );
		$fields = array(
			'title'       => __( 'Title', 'neo-pulse-wp' ),
			'alt'         => __( 'Alt text', 'neo-pulse-wp' ),
			'caption'     => __( 'Caption', 'neo-pulse-wp' ),
			'description' => __( 'Description', 'neo-pulse-wp' ),
		);
		echo '<div class="neo-pulse-image-seo-panel" data-attachment-id="' . esc_attr( (string) $attachment_id ) . '" data-context="' . esc_attr( $context ) . '">';
		foreach ( $fields as $key => $label ) {
			$val = isset( $meta[ $key ] ) ? (string) $meta[ $key ] : '';
			echo '<div class="neo-pulse-image-seo-field neo-pulse-image-seo-field--' . esc_attr( $key ) . '">';
			echo '<label>' . esc_html( $label ) . '</label>';
			echo '<div class="neo-pulse-image-seo-field__row">';
			if ( $key === 'caption' || $key === 'description' ) {
				printf(
					'<textarea class="neo-pulse-image-seo-input" data-field="%1$s" rows="2">%2$s</textarea>',
					esc_attr( $key ),
					esc_textarea( $val )
				);
			} else {
				printf(
					'<input type="text" class="neo-pulse-image-seo-input" data-field="%1$s" value="%2$s" />',
					esc_attr( $key ),
					esc_attr( $val )
				);
			}
			printf(
				'<button type="button" class="button neo-pulse-image-seo-wand" data-field="%1$s" title="%2$s" aria-label="%2$s">✦</button>',
				esc_attr( $key ),
				esc_attr__( 'Optimize', 'neo-pulse-wp' )
			);
			echo '</div></div>';
		}
		echo '<button type="button" class="button neo-pulse-image-seo-optimize-all">' . esc_html__( 'Optimize all', 'neo-pulse-wp' ) . '</button>';
		echo '<button type="button" class="button neo-pulse-image-seo-save">' . esc_html__( 'Save metadata', 'neo-pulse-wp' ) . '</button>';
		echo '</div>';
	}

	/**
	 * Render a gallery list item card.
	 */
	public static function render_gallery_item( int $attachment_id ): void {
		if ( $attachment_id < 1 ) {
			return;
		}
		echo '<li class="neo-pulse-gallery-item" data-id="' . esc_attr( (string) $attachment_id ) . '">';
		echo '<div class="neo-pulse-gallery-item__thumb">';
		echo wp_get_attachment_image( $attachment_id, 'thumbnail' );
		echo '<button type="button" class="neo-pulse-gallery-item__remove" aria-label="' . esc_attr__( 'Remove', 'neo-pulse-wp' ) . '">&times;</button>';
		echo '</div>';
		self::render_attachment_seo_panel( $attachment_id, 'gallery' );
		echo '</li>';
	}

	public static function query_attachments( array $args = array() ): array {
		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
		$per_page = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
		$search   = isset( $args['search'] ) ? sanitize_text_field( (string) $args['search'] ) : '';
		$missing  = ! empty( $args['missing_alt'] );

		$query_args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'post_mime_type' => 'image',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => 'date',
			'order'          => 'DESC',
		);

		if ( $search !== '' ) {
			$query_args['s'] = $search;
		}

		if ( $missing ) {
			$query_args['meta_query'] = array(
				'relation' => 'OR',
				array(
					'key'     => '_wp_attachment_image_alt',
					'compare' => 'NOT EXISTS',
				),
				array(
					'key'     => '_wp_attachment_image_alt',
					'value'   => '',
					'compare' => '=',
				),
			);
		}

		$query = new WP_Query( $query_args );
		$items = array();
		foreach ( $query->posts as $post ) {
			if ( $post instanceof WP_Post ) {
				$items[] = self::attachment_row( (int) $post->ID );
			}
		}

		return array(
			'items'    => $items,
			'total'    => (int) $query->found_posts,
			'page'     => $page,
			'per_page' => $per_page,
		);
	}
}
