<?php
/**
 * Elementor → Flowbie Global CSS adapter.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-migrate-elementor-global-css.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-migrate-elementor-dynamic-tags.php';

class Flowbie_Wp_Migrate_Source_Elementor implements Flowbie_Wp_Migrate_Adapter {

	const BATCH_POSTS = 50;

	public function get_id(): string {
		return 'elementor';
	}

	public function get_macro_group(): string {
		return 'fields';
	}

	public function get_label(): string {
		return __( 'Elementor', 'flowbie-wp' );
	}

	public function is_available(): bool {
		return self::is_elementor_present();
	}

	/**
	 * @return array<string, mixed>
	 */
	public function detect(): array {
		$active = self::is_elementor_present();
		$info   = array(
			'active'  => $active,
			'version' => defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : '',
		);
		if ( Flowbie_Wp_Migrate_Elementor_Global_Css::kit_id() > 0 ) {
			$info['kit_id'] = Flowbie_Wp_Migrate_Elementor_Global_Css::kit_id();
		}
		return $info;
	}

	public function get_steps( string $phase ): array {
		if ( ! $this->is_available() ) {
			return array();
		}
		if ( 'crawl' === $phase ) {
			return array(
				array(
					'id'    => 'elementor_crawl_globals',
					'label' => __( 'Crawl Elementor global styles', 'flowbie-wp' ),
					'total' => 1,
				),
				array(
					'id'    => 'elementor_crawl_dynamic_tags',
					'label' => __( 'Scan Elementor ACF dynamic tags', 'flowbie-wp' ),
					'total' => max( 1, (int) ceil( count( $this->document_ids() ) / self::BATCH_POSTS ) ),
				),
			);
		}
		if ( 'apply' === $phase ) {
			return array(
				array(
					'id'    => 'elementor_apply_globals',
					'label' => __( 'Import global styles into Global CSS', 'flowbie-wp' ),
					'total' => 1,
				),
				array(
					'id'    => 'elementor_apply_dynamic_tags',
					'label' => __( 'Rewrite Elementor ACF tags to Flowbie', 'flowbie-wp' ),
					'total' => max( 1, (int) ceil( count( $this->document_ids() ) / self::BATCH_POSTS ) ),
				),
			);
		}
		return array();
	}

	/**
	 * @param array<string, mixed> $sheet   Flo Sheet.
	 * @param array<string, mixed> $context Job context.
	 */
	public function run_step( string $step_id, string $phase, array &$sheet, array $context ): array {
		$dry = ! empty( $context['dry_run'] );

		switch ( $step_id ) {
			case 'elementor_crawl_globals':
				return $this->crawl_globals( $sheet );
			case 'elementor_crawl_dynamic_tags':
				$offset = (int) ( $context['batch_offset'] ?? 0 );
				return $this->crawl_dynamic_tags_batch( $sheet, $offset );
			case 'elementor_apply_globals':
				return $this->apply_globals( $dry );
			case 'elementor_apply_dynamic_tags':
				$offset = (int) ( $context['batch_offset'] ?? 0 );
				return $this->apply_dynamic_tags_batch( $sheet, $offset, $dry );
		}

		return array(
			'ok'    => false,
			'error' => __( 'Unknown Elementor import step.', 'flowbie-wp' ),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 */
	private function crawl_globals( array &$sheet ): array {
		if ( ! Flowbie_Wp_Migrate_Elementor_Global_Css::kit_available() ) {
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'Elementor active kit not found.', 'flowbie-wp' ),
			);
		}

		if ( ! isset( $sheet['sheets']['elementor'] ) || ! is_array( $sheet['sheets']['elementor'] ) ) {
			$sheet['sheets']['elementor'] = array();
		}
		$sheet['sheets']['elementor']['globals'] = Flowbie_Wp_Migrate_Elementor_Global_Css::crawl_payload();

		return array(
			'ok'      => true,
			'done'    => true,
			'message' => __( 'Crawled Elementor global styles.', 'flowbie-wp' ),
			'stats'   => array( 'processed' => 1 ),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 */
	private function crawl_dynamic_tags_batch( array &$sheet, int $offset ): array {
		$ids = array_slice( $this->document_ids(), $offset, self::BATCH_POSTS );
		if ( empty( $ids ) ) {
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'Elementor dynamic tag scan complete.', 'flowbie-wp' ),
			);
		}

		if ( ! isset( $sheet['sheets']['elementor'] ) || ! is_array( $sheet['sheets']['elementor'] ) ) {
			$sheet['sheets']['elementor'] = array();
		}
		if ( ! isset( $sheet['sheets']['elementor']['dynamic_tags'] ) || ! is_array( $sheet['sheets']['elementor']['dynamic_tags'] ) ) {
			$sheet['sheets']['elementor']['dynamic_tags'] = array(
				'documents'    => 0,
				'replacements' => 0,
				'skipped'      => 0,
				'tags_found'   => array(),
				'posts'        => array(),
				'post_ids'     => array(),
			);
		}

		$batch = Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::crawl_documents( $ids );
		$store = &$sheet['sheets']['elementor']['dynamic_tags'];

		$store['documents']    = (int) ( $store['documents'] ?? 0 ) + (int) ( $batch['documents'] ?? 0 );
		$store['replacements'] = (int) ( $store['replacements'] ?? 0 ) + (int) ( $batch['replacements'] ?? 0 );
		$store['skipped']      = (int) ( $store['skipped'] ?? 0 ) + (int) ( $batch['skipped'] ?? 0 );

		foreach ( (array) ( $batch['tags_found'] ?? array() ) as $tag => $count ) {
			$store['tags_found'][ (string) $tag ] = (int) ( $store['tags_found'][ (string) $tag ] ?? 0 ) + (int) $count;
		}
		foreach ( (array) ( $batch['posts'] ?? array() ) as $row ) {
			if ( is_array( $row ) ) {
				$store['posts'][] = $row;
			}
		}
		foreach ( $ids as $id ) {
			$store['post_ids'][] = (int) $id;
		}
		$store['post_ids'] = array_values( array_unique( array_map( 'intval', (array) $store['post_ids'] ) ) );

		$done = count( $ids ) < self::BATCH_POSTS;

		return array(
			'ok'      => true,
			'done'    => $done,
			'message' => sprintf(
				/* translators: 1: batch size, 2: mappable tag count */
				__( 'Scanned %1$d Elementor document(s), %2$d mappable tag(s) found.', 'flowbie-wp' ),
				count( $ids ),
				(int) ( $batch['replacements'] ?? 0 )
			),
			'stats'   => array(
				'processed' => count( $ids ),
				'documents' => (int) ( $batch['documents'] ?? 0 ),
			),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 */
	private function apply_dynamic_tags_batch( array $sheet, int $offset, bool $dry ): array {
		$ids = array_slice( $this->document_ids_from_sheet( $sheet ), $offset, self::BATCH_POSTS );
		if ( empty( $ids ) ) {
			$ids = array_slice( $this->document_ids(), $offset, self::BATCH_POSTS );
		}

		if ( empty( $ids ) ) {
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'No Elementor documents to rewrite.', 'flowbie-wp' ),
			);
		}

		$stats = Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::apply_documents( $ids, $dry );
		$done  = count( $ids ) < self::BATCH_POSTS;

		if ( $done && ! $dry && (int) ( $stats['documents_updated'] ?? 0 ) > 0 ) {
			Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::clear_elementor_cache();
		}

		return array(
			'ok'      => true,
			'done'    => $done,
			'message' => sprintf(
				/* translators: 1: updated docs, 2: tag replacements */
				__( 'Rewrote Elementor dynamic tags on %1$d document(s), %2$d tag(s) updated.', 'flowbie-wp' ),
				(int) ( $stats['documents_updated'] ?? 0 ),
				(int) ( $stats['replacements'] ?? 0 )
			),
			'stats'   => $stats,
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	private function apply_globals( bool $dry ): array {
		$result = Flowbie_Wp_Migrate_Elementor_Global_Css::apply( $dry );
		if ( empty( $result['ok'] ) ) {
			return array(
				'ok'    => false,
				'done'  => true,
				'error' => (string) ( $result['error'] ?? __( 'Elementor global style import failed.', 'flowbie-wp' ) ),
			);
		}

		return array(
			'ok'      => true,
			'done'    => true,
			'message' => (string) ( $result['message'] ?? __( 'Elementor global styles imported.', 'flowbie-wp' ) ),
			'stats'   => isset( $result['stats'] ) && is_array( $result['stats'] ) ? $result['stats'] : array(),
		);
	}

	/**
	 * @return array<int, int>
	 */
	private function document_ids(): array {
		return Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::elementor_document_ids();
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 * @return array<int, int>
	 */
	private function document_ids_from_sheet( array $sheet ): array {
		$elementor = isset( $sheet['sheets']['elementor'] ) && is_array( $sheet['sheets']['elementor'] )
			? $sheet['sheets']['elementor']
			: array();
		$dynamic   = isset( $elementor['dynamic_tags'] ) && is_array( $elementor['dynamic_tags'] )
			? $elementor['dynamic_tags']
			: array();
		$ids       = isset( $dynamic['post_ids'] ) && is_array( $dynamic['post_ids'] )
			? array_map( 'intval', $dynamic['post_ids'] )
			: array();
		if ( ! empty( $ids ) ) {
			return array_values( array_filter( $ids ) );
		}
		return $this->document_ids();
	}

	public static function is_elementor_present(): bool {
		return defined( 'ELEMENTOR_VERSION' ) || Flowbie_Wp_Migrate_Elementor_Global_Css::kit_available();
	}

	/**
	 * @return array{ok: bool, error?: string, message?: string, stats?: array<string, mixed>}
	 */
	public static function import_all_from_database(): array {
		if ( ! self::is_elementor_present() ) {
			return array(
				'ok'    => false,
				'error' => __( 'Elementor data not found in the database.', 'flowbie-wp' ),
			);
		}

		$adapter = new self();
		$sheet   = array( 'sheets' => array() );
		$adapter->run_step( 'elementor_crawl_globals', 'crawl', $sheet, array() );

		$offset = 0;
		do {
			$crawl = $adapter->run_step( 'elementor_crawl_dynamic_tags', 'crawl', $sheet, array( 'batch_offset' => $offset ) );
			if ( empty( $crawl['ok'] ) ) {
				break;
			}
			$offset += self::BATCH_POSTS;
		} while ( empty( $crawl['done'] ) );

		$result = $adapter->run_step( 'elementor_apply_globals', 'apply', $sheet, array() );

		$tag_stats = array(
			'tag_documents_updated' => 0,
			'tag_replacements'      => 0,
		);
		$apply_offset = 0;
		do {
			$apply_tags = $adapter->run_step( 'elementor_apply_dynamic_tags', 'apply', $sheet, array( 'batch_offset' => $apply_offset ) );
			if ( empty( $apply_tags['ok'] ) ) {
				break;
			}
			$tag_stats['tag_documents_updated'] += (int) ( $apply_tags['stats']['documents_updated'] ?? 0 );
			$tag_stats['tag_replacements']      += (int) ( $apply_tags['stats']['replacements'] ?? 0 );
			$apply_offset += self::BATCH_POSTS;
		} while ( empty( $apply_tags['done'] ) );

		if ( ! class_exists( 'Flowbie_Wp_Super_Migrate_Cache', false ) ) {
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-super-migrate-cache.php';
		}
		$cache_stats = Flowbie_Wp_Super_Migrate_Cache::flush_after_import();

		return array(
			'ok'      => ! empty( $result['ok'] ),
			'message' => (string) ( $result['message'] ?? '' ),
			'stats'   => array_merge(
				isset( $result['stats'] ) && is_array( $result['stats'] ) ? $result['stats'] : array(),
				$tag_stats,
				array( 'cache' => $cache_stats )
			),
			'error'   => empty( $result['ok'] ) ? (string) ( $result['error'] ?? '' ) : '',
		);
	}
}
