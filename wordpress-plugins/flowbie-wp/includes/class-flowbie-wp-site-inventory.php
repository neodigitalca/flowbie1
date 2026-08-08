<?php
/**
 * Full-site content inventory cache for God Mode and CSV export.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Site_Inventory {

	const CACHE_META_KEY = 'flowbie_site_inventory_meta_v1';

	/** @var array<int, array<string, mixed>>|null */
	private static $items = null;

	/** @var bool */
	private static $include_drafts = false;

	/**
	 * Warm and return the full inventory (published + optional drafts).
	 *
	 * @param bool $include_drafts Include non-published rows for logged-in God Mode.
	 * @return array<int, array<string, mixed>>
	 */
	public static function warm( bool $include_drafts = false ): array {
		self::$include_drafts = $include_drafts;
		self::$items          = self::build_items( $include_drafts );
		self::store_meta( self::$items );
		return self::$items;
	}

	/**
	 * @param array<string, mixed> $filters post_type, status, query, limit.
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_items( array $filters = array() ): array {
		if ( null === self::$items ) {
			self::warm( ! empty( $filters['include_drafts'] ) );
		}

		$items = is_array( self::$items ) ? self::$items : array();

		if ( ! empty( $filters['post_type'] ) ) {
			$pt    = sanitize_key( (string) $filters['post_type'] );
			$items = array_values(
				array_filter(
					$items,
					static function ( $item ) use ( $pt ) {
						return isset( $item['type'] ) && sanitize_key( (string) $item['type'] ) === $pt;
					}
				)
			);
		}

		if ( ! empty( $filters['status'] ) ) {
			$status = sanitize_key( (string) $filters['status'] );
			$items  = array_values(
				array_filter(
					$items,
					static function ( $item ) use ( $status ) {
						return isset( $item['status'] ) && sanitize_key( (string) $item['status'] ) === $status;
					}
				)
			);
		}

		$query = isset( $filters['query'] ) ? trim( (string) $filters['query'] ) : '';
		if ( $query !== '' ) {
			$limit   = isset( $filters['limit'] ) ? max( 1, min( 100, (int) $filters['limit'] ) ) : 20;
			$terms   = Flowbie_Wp_Chat_Rag::extract_terms( $query );
			$scored  = array();
			foreach ( $items as $item ) {
				$haystack = strtolower(
					wp_strip_all_tags(
						(string) ( $item['title'] ?? '' ) . ' '
						. (string) ( $item['url'] ?? '' ) . ' '
						. (string) ( $item['focus_keyword'] ?? '' ) . ' '
						. (string) ( $item['excerpt'] ?? '' )
					)
				);
				$score = 0.0;
				foreach ( $terms as $term ) {
					if ( $term !== '' && strpos( $haystack, strtolower( $term ) ) !== false ) {
						$score += strlen( $term );
					}
				}
				if ( $score > 0 ) {
					$item['score'] = $score;
					$scored[]      = $item;
				}
			}
			usort(
				$scored,
				static function ( $a, $b ) {
					return ( $b['score'] ?? 0 ) <=> ( $a['score'] ?? 0 );
				}
			);
			$items = array_slice( $scored, 0, $limit );
		} elseif ( ! empty( $filters['limit'] ) ) {
			$items = array_slice( $items, 0, max( 1, min( 500, (int) $filters['limit'] ) ) );
		}

		return $items;
	}

	/**
	 * @return array{count:int,cached_at:int,by_type:array<string,int>}
	 */
	public static function get_meta(): array {
		$cached = get_transient( self::CACHE_META_KEY );
		if ( is_array( $cached ) && ! empty( $cached['count'] ) ) {
			return $cached;
		}

		$items = self::get_items();
		return self::store_meta( $items );
	}

	/**
	 * Compact inventory for LLM prompts (all post types, fair cap).
	 */
	public static function build_prompt_summary( int $max = 150 ): string {
		$items = self::get_items();
		if ( empty( $items ) ) {
			return '';
		}

		$by_type = array();
		foreach ( $items as $item ) {
			$type = sanitize_key( (string) ( $item['type'] ?? 'post' ) );
			if ( ! isset( $by_type[ $type ] ) ) {
				$by_type[ $type ] = array();
			}
			$by_type[ $type ][] = $item;
		}

		$type_count = count( $by_type );
		$per_type   = $type_count > 0 ? max( 1, (int) floor( $max / $type_count ) ) : $max;
		$lines      = array();

		foreach ( $by_type as $type => $rows ) {
			$lines[] = '[' . $type . ']';
			foreach ( array_slice( $rows, 0, $per_type ) as $item ) {
				$kw = ! empty( $item['focus_keyword'] ) ? ' | kw:' . $item['focus_keyword'] : '';
				$lines[] = sprintf(
					'ID:%d | %s | %s | %s%s',
					(int) ( $item['id'] ?? 0 ),
					$type,
					(string) ( $item['title'] ?? '' ),
					(string) ( $item['url'] ?? '' ),
					$kw
				);
			}
			if ( count( $rows ) > $per_type ) {
				$lines[] = sprintf( '… +%d more %s', count( $rows ) - $per_type, $type );
			}
		}

		return implode( "\n", $lines );
	}

	/**
	 * Full inventory summary for one post type (e.g. all blog posts).
	 */
	public static function build_type_inventory_summary( string $post_type, int $max = 0 ): string {
		$post_type = sanitize_key( $post_type );
		$items     = self::get_items(
			array(
				'post_type'      => $post_type,
				'include_drafts' => self::$include_drafts,
			)
		);
		if ( empty( $items ) ) {
			return '';
		}

		if ( $max > 0 ) {
			$items = array_slice( $items, 0, $max );
		}

		$lines = array( '[' . $post_type . ' — ' . count( $items ) . ' items]' );
		foreach ( $items as $item ) {
			$kw = ! empty( $item['focus_keyword'] ) ? ' | kw:' . $item['focus_keyword'] : '';
			$lines[] = sprintf(
				'ID:%d | %s | %s%s',
				(int) ( $item['id'] ?? 0 ),
				(string) ( $item['title'] ?? '' ),
				(string) ( $item['url'] ?? '' ),
				$kw
			);
		}

		return implode( "\n", $lines );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_type_items( string $post_type ): array {
		return self::get_items(
			array(
				'post_type'      => sanitize_key( $post_type ),
				'include_drafts' => self::$include_drafts,
			)
		);
	}

	/**
	 * Coverage snapshot for analytics tools.
	 *
	 * @return array<int, array{type:string,title:string,url:string,focus_keyword:string}>
	 */
	public static function build_coverage_snapshot( int $limit = 0, string $post_type = '' ): array {
		$filters = array( 'include_drafts' => true );
		if ( $post_type !== '' ) {
			$filters['post_type'] = sanitize_key( $post_type );
		}
		if ( $limit > 0 ) {
			$filters['limit'] = $limit;
		}
		$items = self::get_items( $filters );
		$out    = array();
		foreach ( $items as $item ) {
			$out[] = array(
				'type'           => sanitize_key( (string) ( $item['type'] ?? 'post' ) ),
				'title'          => (string) ( $item['title'] ?? '' ),
				'url'            => (string) ( $item['url'] ?? '' ),
				'focus_keyword'  => (string) ( $item['focus_keyword'] ?? '' ),
			);
		}
		return $out;
	}

	/**
	 * Full-site CSV (UTF-8 BOM + CRLF).
	 */
	public static function build_csv( bool $include_drafts = false ): string {
		$items = self::warm( $include_drafts );
		$headers = array(
			'id',
			'url',
			'slug',
			'collection',
			'title',
			'date_gmt',
			'keyword',
			'excerpt_plain',
			'acf_faq',
			'acf_seo_research',
			'acf_keyword_focus',
			'status',
			'categories',
			'tags',
		);

		$lines = array( implode( ',', $headers ) );
		foreach ( $items as $item ) {
			$post_id = (int) ( $item['id'] ?? 0 );
			$faq     = $post_id > 0 ? Flowbie_Wp_Ai_Context::read_field_value( $post_id, 'faq' ) : '';
			$research = $post_id > 0 ? Flowbie_Wp_Ai_Context::read_field_value( $post_id, 'seo_research' ) : '';
			$kw_focus = $post_id > 0 ? Flowbie_Wp_Ai_Context::read_field_value( $post_id, 'focus_keyword' ) : '';
			$cats     = ! empty( $item['categories'] ) && is_array( $item['categories'] )
				? implode( '; ', $item['categories'] )
				: '';
			$tags     = ! empty( $item['tags'] ) && is_array( $item['tags'] )
				? implode( '; ', $item['tags'] )
				: '';

			$row = array(
				self::csv_cell( (string) ( $item['id'] ?? '' ) ),
				self::csv_cell( (string) ( $item['url'] ?? '' ) ),
				self::csv_cell( (string) ( $item['slug'] ?? '' ) ),
				self::csv_cell( (string) ( $item['type'] ?? '' ) ),
				self::csv_cell( (string) ( $item['title'] ?? '' ) ),
				self::csv_cell( (string) ( $item['date_gmt'] ?? '' ) ),
				self::csv_cell( (string) ( $item['focus_keyword'] ?? '' ) ),
				self::csv_cell( (string) ( $item['excerpt'] ?? '' ) ),
				self::csv_cell( $faq ),
				self::csv_cell( $research ),
				self::csv_cell( $kw_focus ),
				self::csv_cell( (string) ( $item['status'] ?? 'publish' ) ),
				self::csv_cell( $cats ),
				self::csv_cell( $tags ),
			);
			$lines[] = implode( ',', $row );
		}

		return "\xEF\xBB\xBF" . implode( "\r\n", $lines );
	}

	/**
	 * @return string
	 */
	public static function download_filename(): string {
		$slug = sanitize_title( get_bloginfo( 'name' ) );
		if ( $slug === '' ) {
			$slug = 'site';
		}
		return 'flowbie-site-cache-' . $slug . '.csv';
	}

	/**
	 * @param bool $include_drafts Include draft/private rows.
	 * @return array<int, array<string, mixed>>
	 */
	private static function build_items( bool $include_drafts ): array {
		$settings = Flowbie_Wp_Chat::get_settings();
		$raw      = Flowbie_Wp_Chat_Rag::get_raw_site_index( $settings );
		$items    = array();
		$seen     = array();

		foreach ( $raw as $row ) {
			if ( ! is_array( $row ) || empty( $row['id'] ) ) {
				continue;
			}
			$id = (int) $row['id'];
			$seen[ $id ] = true;
			$items[]     = self::normalize_row( $row, 'publish' );
		}

		if ( $include_drafts ) {
			foreach ( Flowbie_Wp_Chat_Rag::get_agent_site_index( true ) as $row ) {
				if ( ! is_array( $row ) || empty( $row['id'] ) ) {
					continue;
				}
				$id = (int) $row['id'];
				if ( isset( $seen[ $id ] ) ) {
					continue;
				}
				$seen[ $id ] = true;
				$items[]     = self::normalize_row( $row, (string) ( $row['status'] ?? 'draft' ) );
			}
		}

		return $items;
	}

	/**
	 * @param array<string, mixed> $row Source row.
	 * @param string               $default_status Default status when missing.
	 * @return array<string, mixed>
	 */
	private static function normalize_row( array $row, string $default_status ): array {
		$post_id = (int) ( $row['id'] ?? 0 );
		$post    = $post_id > 0 ? get_post( $post_id ) : null;
		$status  = ! empty( $row['status'] )
			? sanitize_key( (string) $row['status'] )
			: ( $post instanceof WP_Post ? $post->post_status : $default_status );

		return array(
			'id'             => $post_id,
			'title'          => (string) ( $row['title'] ?? ( $post instanceof WP_Post ? get_the_title( $post ) : '' ) ),
			'url'            => (string) ( $row['url'] ?? ( $post instanceof WP_Post ? (string) get_permalink( $post ) : '' ) ),
			'slug'           => (string) ( $row['slug'] ?? ( $post instanceof WP_Post ? $post->post_name : '' ) ),
			'excerpt'        => (string) ( $row['excerpt'] ?? '' ),
			'type'           => sanitize_key( (string) ( $row['type'] ?? ( $post instanceof WP_Post ? $post->post_type : 'post' ) ) ),
			'status'         => $status,
			'date_gmt'       => $post instanceof WP_Post ? (string) $post->post_date_gmt : (string) ( $row['modified'] ?? '' ),
			'focus_keyword'  => (string) ( $row['focus_keyword'] ?? ( $post_id > 0 ? Flowbie_Wp_Ai_Context::read_focus_keyword( $post_id ) : '' ) ),
			'categories'     => ! empty( $row['categories'] ) && is_array( $row['categories'] ) ? $row['categories'] : array(),
			'tags'           => ! empty( $row['tags'] ) && is_array( $row['tags'] ) ? $row['tags'] : array(),
		);
	}

	/**
	 * @param array<int, array<string, mixed>> $items Inventory rows.
	 * @return array{count:int,cached_at:int,by_type:array<string,int>}
	 */
	private static function store_meta( array $items ): array {
		$by_type = array();
		foreach ( $items as $item ) {
			$type = sanitize_key( (string) ( $item['type'] ?? 'post' ) );
			if ( ! isset( $by_type[ $type ] ) ) {
				$by_type[ $type ] = 0;
			}
			$by_type[ $type ]++;
		}

		$meta = array(
			'count'     => count( $items ),
			'cached_at' => time(),
			'by_type'   => $by_type,
		);

		set_transient( self::CACHE_META_KEY, $meta, Flowbie_Wp_Chat_Rag::CACHE_TTL );

		return $meta;
	}

	private static function csv_cell( string $value ): string {
		if ( strpbrk( $value, ",\n\r\"" ) !== false ) {
			return '"' . str_replace( '"', '""', $value ) . '"';
		}
		return $value;
	}
}
