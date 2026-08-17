<?php
/**
 * Local WordPress editorial + optimization counts for the dashboard strip.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Site_Progress {

	const PACKAGE_CAPS = array(
		'basic' => 50,
		'pro'   => 100,
		'plus'  => 200,
	);

	/**
	 * @param array<string,mixed> $client
	 * @return array<string,mixed>
	 */
	public static function compute( array $client ): array {
		$editorial = isset( $client['editorialCountsPeriodStartYmd'] ) ? trim( (string) $client['editorialCountsPeriodStartYmd'] ) : '';
		$opt_pkg   = isset( $client['optimizationPackage'] ) ? trim( (string) $client['optimizationPackage'] ) : '';
		$manual    = isset( $client['manualEndpoint'] ) ? trim( (string) $client['manualEndpoint'] ) : '';
		$sitemap   = isset( $client['entitySitemapUrl'] ) ? trim( (string) $client['entitySitemapUrl'] ) : '';

		$range     = self::get_editorial_counts_range( $editorial );
		$secondary = self::resolve_secondary_post_type( $manual, $sitemap );
		$cap       = self::optimization_cap_for_package( $opt_pkg );
		$quarter   = self::get_quarter_counts( $range['after'], $range['before'], $secondary );
		$optimization = null;

		if ( null !== $cap ) {
			$optimization = self::get_optimization_counts( $range['after'], $range['before'], $secondary, $cap );
		}

		return array(
			'ok'           => true,
			'quarterLabel' => $range['quarterLabel'],
			'quarter'      => $quarter,
			'optimization' => $optimization,
		);
	}

	/**
	 * @param array<string,mixed> $rpc_progress
	 * @param array<string,mixed> $client
	 * @return array<string,mixed>
	 */
	public static function merge_progress( array $rpc_progress, array $client ): array {
		$local = self::compute( $client );
		$merged = array_merge(
			is_array( $rpc_progress ) ? $rpc_progress : array(),
			$local
		);
		$merged['ok'] = true;
		return $merged;
	}

	private static function optimization_cap_for_package( string $tier ): ?int {
		return self::package_cap_for_tier( $tier );
	}

	public static function package_cap_for_tier( string $tier ): ?int {
		$key = strtolower( trim( $tier ) );
		return isset( self::PACKAGE_CAPS[ $key ] ) ? (int) self::PACKAGE_CAPS[ $key ] : null;
	}

	/**
	 * @param array<string,mixed> $client
	 */
	public static function resolve_entity_post_type_for_client( array $client ): ?string {
		$manual  = isset( $client['manualEndpoint'] ) ? trim( (string) $client['manualEndpoint'] ) : '';
		$sitemap = isset( $client['entitySitemapUrl'] ) ? trim( (string) $client['entitySitemapUrl'] ) : '';
		return self::resolve_secondary_post_type( $manual, $sitemap );
	}

	/**
	 * @param array<string,mixed> $client
	 * @return array{used:int,cap:int,remaining:int}|null
	 */
	public static function optimization_usage_for_client( array $client ): ?array {
		$opt_pkg = isset( $client['optimizationPackage'] ) ? trim( (string) $client['optimizationPackage'] ) : '';
		$cap     = self::package_cap_for_tier( $opt_pkg );
		if ( null === $cap ) {
			return null;
		}
		$progress = self::compute( $client );
		$opt      = isset( $progress['optimization'] ) && is_array( $progress['optimization'] ) ? $progress['optimization'] : array();
		$used     = isset( $opt['totalOptimized'] ) ? (int) $opt['totalOptimized'] : 0;
		return array(
			'used'      => $used,
			'cap'       => $cap,
			'remaining' => max( 0, $cap - $used ),
		);
	}

	/**
	 * @return array{after:string,before:string,quarterLabel:string}
	 */
	private static function get_editorial_counts_range( string $editorial_start_ymd ): array {
		$now = new DateTimeImmutable( 'now', wp_timezone() );
		if ( $editorial_start_ymd !== '' ) {
			$anchor = DateTimeImmutable::createFromFormat( 'Y-m-d', $editorial_start_ymd, wp_timezone() );
			if ( $anchor instanceof DateTimeImmutable ) {
				return self::get_rolling_three_month_range_from_anchor( $anchor, $now );
			}
		}
		return self::get_local_quarter_range( $now );
	}

	/**
	 * @return array{after:string,before:string,quarterLabel:string}
	 */
	private static function get_local_quarter_range( DateTimeImmutable $now ): array {
		$year  = (int) $now->format( 'Y' );
		$month = (int) $now->format( 'n' ) - 1;
		$q     = (int) floor( $month / 3 );
		$start = $now->setDate( $year, ( $q * 3 ) + 1, 1 )->setTime( 0, 0, 0 );
		$end   = $start->modify( '+3 months' );
		return array(
			'after'        => $start->format( 'c' ),
			'before'       => $end->format( 'c' ),
			'quarterLabel' => 'Q' . (string) ( $q + 1 ) . ' ' . (string) $year,
		);
	}

	/**
	 * @return array{after:string,before:string,quarterLabel:string}
	 */
	private static function get_rolling_three_month_range_from_anchor( DateTimeImmutable $anchor, DateTimeImmutable $now ): array {
		$window_start = $anchor->setTime( 0, 0, 0 );
		if ( $now->getTimestamp() < $window_start->getTimestamp() ) {
			$end = $window_start->modify( '+3 months' );
			return array(
				'after'        => $window_start->format( 'c' ),
				'before'       => $end->format( 'c' ),
				'quarterLabel' => self::format_rolling_counts_label( $window_start, $end ),
			);
		}
		for ( $i = 0; $i < 500; $i++ ) {
			$end = $window_start->modify( '+3 months' );
			if ( $now->getTimestamp() < $end->getTimestamp() ) {
				return array(
					'after'        => $window_start->format( 'c' ),
					'before'       => $end->format( 'c' ),
					'quarterLabel' => self::format_rolling_counts_label( $window_start, $end ),
				);
			}
			$window_start = $end;
		}
		return self::get_local_quarter_range( $now );
	}

	private static function format_rolling_counts_label( DateTimeImmutable $start, DateTimeImmutable $end_exclusive ): string {
		$last = $end_exclusive->modify( '-1 day' );
		$y1   = (int) $start->format( 'Y' );
		$y2   = (int) $last->format( 'Y' );
		$m1   = $start->format( 'M' );
		$m2   = $last->format( 'M' );
		if ( $y1 === $y2 ) {
			return $m1 . '-' . $m2 . " '" . substr( (string) $y1, -2 );
		}
		return $m1 . " '" . substr( (string) $y1, -2 ) . '-' . $m2 . " '" . substr( (string) $y2, -2 );
	}

	private static function resolve_secondary_post_type( string $manual_endpoint, string $entity_sitemap_url ): ?string {
		$candidate = '';
		if ( $manual_endpoint !== '' ) {
			$candidate = trim( $manual_endpoint, '/' );
		} elseif ( $entity_sitemap_url !== '' ) {
			$parts    = explode( '/', trim( $entity_sitemap_url ) );
			$filename = end( $parts );
			$candidate = self::strip_sitemap_filename_to_stem( is_string( $filename ) ? $filename : '' );
		}
		if ( $candidate === '' ) {
			return null;
		}
		$lower = strtolower( $candidate );
		if ( in_array( $lower, array( 'posts', 'post', 'pages', 'page' ), true ) ) {
			return null;
		}
		return post_type_exists( $candidate ) ? $candidate : null;
	}

	private static function strip_sitemap_filename_to_stem( string $filename ): string {
		$lower = strtolower( $filename );
		if ( self::string_ends_with( $lower, '-sitemap.xml' ) ) {
			return substr( $filename, 0, -strlen( '-sitemap.xml' ) );
		}
		if ( self::string_ends_with( $lower, '_sitemap.xml' ) ) {
			return substr( $filename, 0, -strlen( '_sitemap.xml' ) );
		}
		if ( self::string_ends_with( $lower, '.xml' ) ) {
			return substr( $filename, 0, -4 );
		}
		return $filename;
	}

	private static function string_ends_with( string $haystack, string $needle ): bool {
		if ( $needle === '' ) {
			return true;
		}
		$len = strlen( $needle );
		if ( $len > strlen( $haystack ) ) {
			return false;
		}
		return substr( $haystack, -$len ) === $needle;
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function get_quarter_counts( string $after_iso, string $before_iso, ?string $secondary_post_type ): array {
		$posts_live    = self::count_posts_in_range( 'post', 'publish', $after_iso, $before_iso );
		$posts_sched   = self::count_posts_in_range( 'post', 'future', $after_iso, $before_iso );
		$entity_live   = null;
		$entity_sched  = null;
		$entity_counts = false;

		if ( null !== $secondary_post_type ) {
			$entity_live   = self::count_posts_in_range( $secondary_post_type, 'publish', $after_iso, $before_iso );
			$entity_sched  = self::count_posts_in_range( $secondary_post_type, 'future', $after_iso, $before_iso );
			$entity_counts = true;
		}

		return array(
			'postsLive'             => $posts_live,
			'postsScheduled'        => $posts_sched,
			'entityLive'            => $entity_live,
			'entityScheduled'       => $entity_sched,
			'entityConfigured'      => null !== $secondary_post_type,
			'entityCountsAvailable' => $entity_counts,
		);
	}

	private static function count_posts_in_range( string $post_type, string $status, string $after_iso, string $before_iso ): int {
		$after  = self::iso_to_mysql_gmt( $after_iso );
		$before = self::iso_to_mysql_gmt( $before_iso );
		if ( $after === '' || $before === '' ) {
			return 0;
		}

		$query = new WP_Query(
			array(
				'post_type'              => $post_type,
				'post_status'            => $status,
				'posts_per_page'         => 1,
				'fields'                 => 'ids',
				'no_found_rows'          => false,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
				'date_query'             => array(
					array(
						'column'    => 'post_date_gmt',
						'after'     => $after,
						'before'    => $before,
						'inclusive' => false,
					),
				),
			)
		);

		return (int) $query->found_posts;
	}

	/**
	 * @return array<string,int>|null
	 */
	private static function get_optimization_counts( string $after_iso, string $before_iso, ?string $secondary_post_type, int $cap ): ?array {
		$start_ms = self::iso_to_epoch_ms( $after_iso );
		$end_ms   = self::iso_to_epoch_ms( $before_iso );
		if ( null === $start_ms || null === $end_ms || $end_ms <= $start_ms ) {
			return null;
		}

		$posts_optimized = self::count_optimized_in_period( 'post', $start_ms, $end_ms );
		$entity_optimized = 0;
		$entity_available = false;

		if ( null !== $secondary_post_type ) {
			$entity_optimized = self::count_optimized_in_period( $secondary_post_type, $start_ms, $end_ms );
			$entity_available = true;
		}

		$total = $posts_optimized + ( $entity_available ? $entity_optimized : 0 );
		return array(
			'totalOptimized' => $total,
			'cap'            => $cap,
			'remaining'      => max( 0, $cap - $total ),
		);
	}

	private static function count_optimized_in_period( string $post_type, int $start_ms, int $end_ms ): int {
		$page     = 1;
		$per_page = 100;
		$count    = 0;

		do {
			$ids = get_posts(
				array(
					'post_type'              => $post_type,
					'post_status'            => 'publish',
					'posts_per_page'         => $per_page,
					'paged'                  => $page,
					'fields'                 => 'ids',
					'no_found_rows'          => true,
					'update_post_meta_cache' => true,
					'update_post_term_cache' => false,
					'orderby'                => 'ID',
					'order'                  => 'ASC',
				)
			);

			if ( empty( $ids ) ) {
				break;
			}

			foreach ( $ids as $post_id ) {
				$dm_ms = self::read_date_modifier_ms( (int) $post_id );
				if ( null === $dm_ms || $dm_ms < $start_ms || $dm_ms >= $end_ms ) {
					continue;
				}
				$pub_ms = self::read_published_ms( (int) $post_id );
				if ( null !== $pub_ms && self::utc_calendar_day_key( $dm_ms ) === self::utc_calendar_day_key( $pub_ms ) ) {
					continue;
				}
				++$count;
			}

			if ( count( $ids ) < $per_page ) {
				break;
			}
			++$page;
		} while ( $page <= 500 );

		return $count;
	}

	private static function read_date_modifier_ms( int $post_id ): ?int {
		$raw = '';
		if ( function_exists( 'get_field' ) ) {
			$acf = get_field( 'date_modifier', $post_id, false );
			if ( is_string( $acf ) || is_numeric( $acf ) ) {
				$raw = trim( (string) $acf );
			}
		}
		if ( $raw === '' ) {
			$raw = trim( (string) get_post_meta( $post_id, 'date_modifier', true ) );
		}
		return self::parse_date_modifier_to_ms( $raw );
	}

	private static function read_published_ms( int $post_id ): ?int {
		$gmt = get_post_field( 'post_date_gmt', $post_id );
		if ( ! is_string( $gmt ) || $gmt === '' || $gmt === '0000-00-00 00:00:00' ) {
			return null;
		}
		$ts = strtotime( $gmt . ' UTC' );
		return is_int( $ts ) ? $ts * 1000 : null;
	}

	private static function parse_date_modifier_to_ms( string $raw ): ?int {
		if ( $raw === '' ) {
			return null;
		}
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $raw ) ) {
			$parts = array_map( 'intval', explode( '-', $raw ) );
			return gmmktime( 0, 0, 0, $parts[1], $parts[2], $parts[0] ) * 1000;
		}
		$ts = strtotime( $raw );
		return is_int( $ts ) ? $ts * 1000 : null;
	}

	private static function utc_calendar_day_key( int $ms ): string {
		return gmdate( 'Y-m-d', (int) floor( $ms / 1000 ) );
	}

	private static function iso_to_mysql_gmt( string $iso ): string {
		$ms = self::iso_to_epoch_ms( $iso );
		if ( null === $ms ) {
			return '';
		}
		return gmdate( 'Y-m-d H:i:s', (int) floor( $ms / 1000 ) );
	}

	private static function iso_to_epoch_ms( string $iso ): ?int {
		$ts = strtotime( $iso );
		if ( ! is_int( $ts ) ) {
			return null;
		}
		return $ts * 1000;
	}
}
