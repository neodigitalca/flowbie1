<?php
/**
 * Per-attachment image compression and WebP sidecars.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Optimizes media files without replacing originals.
 */
class Neo_Pulse_Wp_Speed_Image_Optimizer {

	const SIDECAR_SUFFIX = '.neo-pulse-opt';

	/**
	 * @param int  $attachment_id Attachment ID.
	 * @param bool $force         Re-optimize even if meta exists.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function optimize_attachment( int $attachment_id, bool $force = false ) {
		$config = Neo_Pulse_Wp_Speed_Image_Settings::get_config();
		if ( empty( $config['enabled'] ) ) {
			return new WP_Error( 'neo-pulse_speed_image_disabled', __( 'Image optimization is disabled.', 'neo-pulse-wp' ) );
		}

		if ( $attachment_id < 1 || get_post_type( $attachment_id ) !== 'attachment' ) {
			return new WP_Error( 'neo-pulse_speed_image_invalid', __( 'Invalid attachment.', 'neo-pulse-wp' ) );
		}

		if ( ! $force && get_post_meta( $attachment_id, Neo_Pulse_Wp_Speed_Image_Settings::VERSION_META, true ) ) {
			return array(
				'ok'      => true,
				'skipped' => true,
				'reason'  => 'already_optimized',
			);
		}

		$mime = get_post_mime_type( $attachment_id );
		if ( ! is_string( $mime ) || ! self::is_supported_mime( $mime, $config ) ) {
			return array(
				'ok'      => true,
				'skipped' => true,
				'reason'  => 'unsupported_mime',
			);
		}

		$file = get_attached_file( $attachment_id );
		if ( ! is_string( $file ) || $file === '' || ! is_readable( $file ) ) {
			return new WP_Error( 'neo-pulse_speed_image_missing', __( 'Attachment file not found.', 'neo-pulse-wp' ) );
		}

		$max_bytes = (int) ( $config['max_file_mb'] ?? 10 ) * 1024 * 1024;
		$original_bytes = (int) filesize( $file );
		if ( $max_bytes > 0 && $original_bytes > $max_bytes ) {
			return array(
				'ok'      => true,
				'skipped' => true,
				'reason'  => 'file_too_large',
			);
		}

		$targets = self::targets_for_attachment( $attachment_id, $config );
		$sizes_meta = array();
		$bytes_saved_total = 0;
		$webp_count = 0;

		foreach ( $targets as $size_key => $path ) {
			if ( ! is_readable( $path ) ) {
				continue;
			}
			$result = self::optimize_file( $path, $mime, $config );
			if ( is_wp_error( $result ) ) {
				continue;
			}
			$sizes_meta[ $size_key ] = $result;
			if ( ! empty( $result['bytes_saved'] ) ) {
				$bytes_saved_total += (int) $result['bytes_saved'];
			}
			if ( ! empty( $result['webp_path'] ) && is_readable( $result['webp_path'] ) ) {
				++$webp_count;
			}
		}

		if ( empty( $sizes_meta ) ) {
			return new WP_Error( 'neo-pulse_speed_image_failed', __( 'Could not optimize image.', 'neo-pulse-wp' ) );
		}

		$payload = array(
			'version'      => Neo_Pulse_Wp_Speed_Image_Settings::META_VERSION,
			'sizes'        => $sizes_meta,
			'optimized_at' => time(),
		);

		update_post_meta( $attachment_id, Neo_Pulse_Wp_Speed_Image_Settings::META_KEY, $payload );
		update_post_meta( $attachment_id, Neo_Pulse_Wp_Speed_Image_Settings::VERSION_META, Neo_Pulse_Wp_Speed_Image_Settings::META_VERSION );

		Neo_Pulse_Wp_Speed_Image_Stats::record( 1, $bytes_saved_total, $webp_count );

		return array(
			'ok'          => true,
			'attachment'  => $attachment_id,
			'bytes_saved' => $bytes_saved_total,
			'webp_count'  => $webp_count,
			'sizes'       => $sizes_meta,
		);
	}

	/**
	 * @param int                  $attachment_id Attachment ID.
	 * @param array<string, mixed> $config        Settings.
	 * @return array<string, string>
	 */
	public static function targets_for_attachment( int $attachment_id, array $config ): array {
		$file = get_attached_file( $attachment_id );
		if ( ! is_string( $file ) || $file === '' ) {
			return array();
		}

		$targets = array( 'full' => $file );
		if ( ( $config['optimize_sizes'] ?? 'full' ) !== 'all' ) {
			return $targets;
		}

		$meta = wp_get_attachment_metadata( $attachment_id );
		if ( ! is_array( $meta ) || empty( $meta['sizes'] ) || ! is_array( $meta['sizes'] ) ) {
			return $targets;
		}

		$dir = trailingslashit( dirname( $file ) );
		foreach ( $meta['sizes'] as $size_key => $size_data ) {
			if ( ! is_array( $size_data ) || empty( $size_data['file'] ) ) {
				continue;
			}
			$path = $dir . $size_data['file'];
			if ( is_readable( $path ) ) {
				$targets[ (string) $size_key ] = $path;
			}
		}

		return $targets;
	}

	/**
	 * @param string               $mime   Mime type.
	 * @param array<string, mixed> $config Config.
	 */
	public static function is_supported_mime( string $mime, array $config ): bool {
		$mime = strtolower( $mime );
		if ( in_array( $mime, Neo_Pulse_Wp_Speed_Image_Settings::skip_mime_list(), true ) ) {
			return false;
		}
		return in_array( $mime, array( 'image/jpeg', 'image/jpg', 'image/png' ), true );
	}

	/**
	 * @param string               $path   Absolute file path.
	 * @param string               $mime   Mime type.
	 * @param array<string, mixed> $config Config.
	 * @return array<string, mixed>|WP_Error
	 */
	private static function optimize_file( string $path, string $mime, array $config ) {
		$original_bytes = (int) filesize( $path );

		$editor = wp_get_image_editor( $path );
		if ( is_wp_error( $editor ) ) {
			return $editor;
		}

		$max_w = (int) ( $config['max_width'] ?? 0 );
		$max_h = (int) ( $config['max_height'] ?? 0 );
		if ( $max_w > 0 || $max_h > 0 ) {
			$editor->resize( $max_w > 0 ? $max_w : null, $max_h > 0 ? $max_h : null, false );
		}

		if ( 'image/png' === $mime ) {
			$editor->set_quality( (int) ( $config['png_compression'] ?? 6 ) );
		} else {
			$editor->set_quality( (int) ( $config['jpeg_quality'] ?? 82 ) );
		}

		$info     = pathinfo( $path );
		$dir      = isset( $info['dirname'] ) ? $info['dirname'] : dirname( $path );
		$basename = isset( $info['filename'] ) ? $info['filename'] : 'image';
		$ext      = isset( $info['extension'] ) ? strtolower( (string) $info['extension'] ) : 'jpg';

		$opt_path = $dir . '/' . $basename . self::SIDECAR_SUFFIX . '.' . $ext;
		$saved    = $editor->save( $opt_path, self::mime_to_editor_type( $mime ) );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		$optimized_bytes = is_readable( $opt_path ) ? (int) filesize( $opt_path ) : 0;
		$bytes_saved     = max( 0, $original_bytes - $optimized_bytes );

		$webp_path = null;
		if ( ! empty( $config['generate_webp'] ) && Neo_Pulse_Wp_Speed_Image_Settings::supports_webp_editor() ) {
			$webp_target = $dir . '/' . $basename . '.webp';
			$webp_saved  = $editor->save( $webp_target, 'image/webp' );
			if ( ! is_wp_error( $webp_saved ) && is_readable( $webp_target ) ) {
				$webp_path = $webp_target;
			}
		}

		return array(
			'original_bytes'  => $original_bytes,
			'optimized_bytes' => $optimized_bytes,
			'optimized_path'  => $opt_path,
			'webp_path'       => $webp_path,
			'bytes_saved'     => $bytes_saved,
		);
	}

	/**
	 * @param string $mime Mime type.
	 */
	private static function mime_to_editor_type( string $mime ): string {
		if ( 'image/png' === $mime ) {
			return 'image/png';
		}
		return 'image/jpeg';
	}

	/**
	 * @param int $attachment_id Attachment ID.
	 * @return array<string, mixed>|null
	 */
	public static function get_meta( int $attachment_id ): ?array {
		$raw = get_post_meta( $attachment_id, Neo_Pulse_Wp_Speed_Image_Settings::META_KEY, true );
		return is_array( $raw ) ? $raw : null;
	}

	/**
	 * Clear optimization meta for all attachments (does not delete files).
	 */
	public static function flush_all_meta(): void {
		global $wpdb;

		$wpdb->delete( $wpdb->postmeta, array( 'meta_key' => Neo_Pulse_Wp_Speed_Image_Settings::META_KEY ), array( '%s' ) );
		$wpdb->delete( $wpdb->postmeta, array( 'meta_key' => Neo_Pulse_Wp_Speed_Image_Settings::VERSION_META ), array( '%s' ) );

		Neo_Pulse_Wp_Speed_Image_Stats::reset();
	}

	/**
	 * @param int  $per_page Items per batch.
	 * @param int  $page     Page number (1-based).
	 * @param bool $force    Force re-optimize.
	 * @return array{processed: int, results: array<int, mixed>, done: bool, total_pending: int}
	 */
	public static function batch_optimize( int $per_page, int $page, bool $force ): array {
		$per_page = max( 1, min( 20, $per_page ) );
		$page     = max( 1, $page );

		$ids = self::pending_attachment_ids( $per_page, $page, $force );
		$results = array();
		foreach ( $ids as $id ) {
			$results[ $id ] = self::optimize_attachment( $id, $force );
		}

		return array(
			'processed'      => count( $ids ),
			'results'        => $results,
			'done'           => count( $ids ) < $per_page,
			'total_pending'  => self::count_pending( $force ),
		);
	}

	/**
	 * @param bool $force Include already optimized.
	 */
	public static function count_pending( bool $force ): int {
		global $wpdb;

		if ( $force ) {
			return (int) $wpdb->get_var(
				"SELECT COUNT(ID) FROM {$wpdb->posts} WHERE post_type = 'attachment' AND post_mime_type IN ('image/jpeg','image/jpg','image/png')"
			);
		}

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(p.ID) FROM {$wpdb->posts} p
				LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = %s
				WHERE p.post_type = 'attachment'
				AND p.post_mime_type IN ('image/jpeg','image/jpg','image/png')
				AND pm.meta_id IS NULL",
				Neo_Pulse_Wp_Speed_Image_Settings::VERSION_META
			)
		);
	}

	/**
	 * @param int  $per_page Per page.
	 * @param int  $page     Page.
	 * @param bool $force    Force.
	 * @return array<int, int>
	 */
	private static function pending_attachment_ids( int $per_page, int $page, bool $force ): array {
		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'post_mime_type' => array( 'image/jpeg', 'image/jpg', 'image/png' ),
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => 'ID',
			'order'          => 'ASC',
			'fields'         => 'ids',
		);

		if ( ! $force ) {
			$args['meta_query'] = array(
				array(
					'key'     => Neo_Pulse_Wp_Speed_Image_Settings::VERSION_META,
					'compare' => 'NOT EXISTS',
				),
			);
		}

		$query = new WP_Query( $args );
		$ids   = $query->posts;
		if ( ! is_array( $ids ) ) {
			return array();
		}
		return array_map( 'intval', $ids );
	}
}
