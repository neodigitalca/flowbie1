<?php
/**
 * Redirect storage, matching, and front-end execution.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Redirects {

	const TABLE_VERSION = '1.0';
	const OPTION_KEY    = 'neo_pulse_wp_redirects_settings';

	/**
	 * @return string
	 */
	public static function table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'neo_pulse_wp_redirects';
	}

	public static function init(): void {
		add_action( 'template_redirect', array( __CLASS__, 'maybe_redirect' ), 1 );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_fallback_home' ), 20 );
		add_action( 'plugins_loaded', array( __CLASS__, 'maybe_install' ), 20 );
	}

	public static function maybe_install(): void {
		if ( get_option( 'neo_pulse_wp_redirects_db_version', '' ) !== self::TABLE_VERSION ) {
			self::install();
		}
	}

	public static function install(): void {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table   = self::table_name();
		$charset = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			source varchar(512) NOT NULL,
			matching varchar(20) NOT NULL DEFAULT 'exact',
			destination varchar(512) NOT NULL,
			type smallint(5) unsigned NOT NULL DEFAULT 301,
			category varchar(100) NOT NULL DEFAULT 'Uncategorized',
			status varchar(20) NOT NULL DEFAULT 'active',
			ignore_case tinyint(1) NOT NULL DEFAULT 0,
			hits bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			last_accessed_at datetime DEFAULT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY source (source(191)),
			KEY status (status),
			KEY category (category(50))
		) {$charset};";

		dbDelta( $sql );
		update_option( 'neo_pulse_wp_redirects_db_version', self::TABLE_VERSION, false );

		if ( get_option( self::OPTION_KEY, null ) === null ) {
			add_option(
				self::OPTION_KEY,
				array(
					'default_type' => 301,
				),
				'',
				false
			);
		}
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function get_settings(): array {
		$raw = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}
		$type = isset( $raw['default_type'] ) ? (int) $raw['default_type'] : 301;
		if ( ! in_array( $type, array( 301, 302 ), true ) ) {
			$type = 301;
		}
		$fallback_type = isset( $raw['fallback_home_type'] ) ? (int) $raw['fallback_home_type'] : $type;
		if ( ! in_array( $fallback_type, array( 301, 302 ), true ) ) {
			$fallback_type = $type;
		}
		return array(
			'default_type'          => $type,
			'fallback_home_enabled' => ! empty( $raw['fallback_home_enabled'] ),
			'fallback_home_type'    => $fallback_type,
		);
	}

	/**
	 * @param array<string, mixed> $settings Settings.
	 */
	public static function save_settings( array $settings ): void {
		$type = isset( $settings['default_type'] ) ? (int) $settings['default_type'] : 301;
		if ( ! in_array( $type, array( 301, 302 ), true ) ) {
			$type = 301;
		}
		$fallback_type = isset( $settings['fallback_home_type'] ) ? (int) $settings['fallback_home_type'] : $type;
		if ( ! in_array( $fallback_type, array( 301, 302 ), true ) ) {
			$fallback_type = $type;
		}
		update_option(
			self::OPTION_KEY,
			array(
				'default_type'          => $type,
				'fallback_home_enabled' => ! empty( $settings['fallback_home_enabled'] ),
				'fallback_home_type'    => $fallback_type,
			),
			false
		);
	}

	/**
	 * @param array<string, mixed> $args Query args.
	 * @return array{items: array<int, object>, total: int}
	 */
	public static function query( array $args = array() ): array {
		global $wpdb;

		$table  = self::table_name();
		$where  = array( '1=1' );
		$params = array();

		$status = isset( $args['status'] ) ? sanitize_key( (string) $args['status'] ) : '';
		if ( $status === 'all' || $status === '' ) {
			$where[] = "status != 'trash'";
		} elseif ( in_array( $status, array( 'active', 'inactive', 'trash' ), true ) ) {
			$where[]  = 'status = %s';
			$params[] = $status;
		} else {
			$where[] = "status != 'trash'";
		}

		$category = isset( $args['category'] ) ? sanitize_text_field( (string) $args['category'] ) : '';
		if ( $category !== '' ) {
			$where[]  = 'category = %s';
			$params[] = $category;
		}

		$search = isset( $args['search'] ) ? sanitize_text_field( (string) $args['search'] ) : '';
		if ( $search !== '' ) {
			$like     = '%' . $wpdb->esc_like( $search ) . '%';
			$where[]  = '(source LIKE %s OR destination LIKE %s)';
			$params[] = $like;
			$params[] = $like;
		}

		$where_sql = implode( ' AND ', $where );

		$count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}";
		if ( ! empty( $params ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$total = (int) $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) );
		} else {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$total = (int) $wpdb->get_var( $count_sql );
		}

		$orderby = isset( $args['orderby'] ) ? sanitize_key( (string) $args['orderby'] ) : 'created_at';
		$allowed = array(
			'source'           => 'source',
			'destination'      => 'destination',
			'type'             => 'type',
			'hits'             => 'hits',
			'created_at'       => 'created_at',
			'last_accessed_at' => 'last_accessed_at',
		);
		$order_col = isset( $allowed[ $orderby ] ) ? $allowed[ $orderby ] : 'created_at';
		$order     = isset( $args['order'] ) && 'asc' === strtolower( (string) $args['order'] ) ? 'ASC' : 'DESC';

		$per_page = isset( $args['per_page'] ) ? max( 1, min( 200, (int) $args['per_page'] ) ) : 20;
		$page     = isset( $args['page'] ) ? max( 1, (int) $args['page'] ) : 1;
		$offset   = ( $page - 1 ) * $per_page;

		$list_sql    = "SELECT * FROM {$table} WHERE {$where_sql} ORDER BY {$order_col} {$order} LIMIT %d OFFSET %d";
		$list_params = array_merge( $params, array( $per_page, $offset ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$items = $wpdb->get_results( $wpdb->prepare( $list_sql, $list_params ) );

		return array(
			'items' => is_array( $items ) ? $items : array(),
			'total' => $total,
		);
	}

	/**
	 * @return object|null
	 */
	public static function get( int $id ) {
		global $wpdb;
		if ( $id < 1 ) {
			return null;
		}
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ) );
		return $row ? $row : null;
	}

	/**
	 * @return object|null
	 */
	public static function get_by_source( string $source ) {
		global $wpdb;
		$norm = Neo_Pulse_Wp_Redirects_Csv::normalize_relative_path( $source );
		if ( ! $norm ) {
			return null;
		}
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE source = %s", $norm ) );
		return $row ? $row : null;
	}

	/**
	 * @return array<string, int>
	 */
	public static function status_counts(): array {
		global $wpdb;
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results( "SELECT status, COUNT(*) AS cnt FROM {$table} GROUP BY status", ARRAY_A );
		$counts = array(
			'active'   => 0,
			'inactive' => 0,
			'trash'    => 0,
		);
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row ) {
				$st = isset( $row['status'] ) ? (string) $row['status'] : '';
				if ( isset( $counts[ $st ] ) ) {
					$counts[ $st ] = (int) $row['cnt'];
				}
			}
		}
		$counts['all'] = $counts['active'] + $counts['inactive'];
		return $counts;
	}

	/**
	 * @return array<int, string>
	 */
	public static function distinct_categories(): array {
		global $wpdb;
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_col( "SELECT DISTINCT category FROM {$table} WHERE status != 'trash' ORDER BY category ASC" );
		return is_array( $rows ) ? array_values( array_filter( array_map( 'strval', $rows ) ) ) : array();
	}

	/**
	 * Count non-trash redirects in a category (e.g. imported from Rank Math).
	 */
	public static function count_by_category( string $category ): int {
		global $wpdb;

		$category = sanitize_text_field( $category );
		if ( $category === '' ) {
			return 0;
		}

		$table = self::table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE category = %s AND status != 'trash'",
				$category
			)
		);
	}

	/**
	 * @param array<string, mixed> $data Redirect data.
	 * @return array{ok: bool, id?: int, error?: string}
	 */
	public static function save( array $data ) {
		global $wpdb;

		$source = isset( $data['source'] ) ? Neo_Pulse_Wp_Redirects_Csv::normalize_relative_path( (string) $data['source'] ) : null;
		if ( ! $source ) {
			return array(
				'ok'    => false,
				'error' => __( 'Source path is required.', 'neo-pulse-wp' ),
			);
		}

		$destination = isset( $data['destination'] ) ? trim( (string) $data['destination'] ) : '';
		if ( $destination === '' || ! Neo_Pulse_Wp_Redirects_Csv::destination_path_key( $destination ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'Destination URL or path is required.', 'neo-pulse-wp' ),
			);
		}

		$matching = isset( $data['matching'] ) ? sanitize_key( (string) $data['matching'] ) : 'exact';
		if ( $matching === '' ) {
			$matching = 'exact';
		}

		$type = isset( $data['type'] ) ? (int) $data['type'] : self::get_settings()['default_type'];
		if ( ! in_array( $type, array( 301, 302 ), true ) ) {
			$type = 301;
		}

		$category = isset( $data['category'] ) ? sanitize_text_field( (string) $data['category'] ) : __( 'Uncategorized', 'neo-pulse-wp' );
		if ( $category === '' ) {
			$category = __( 'Uncategorized', 'neo-pulse-wp' );
		}

		$status = isset( $data['status'] ) ? sanitize_key( (string) $data['status'] ) : 'active';
		if ( ! in_array( $status, array( 'active', 'inactive', 'trash' ), true ) ) {
			$status = 'active';
		}

		$ignore = ! empty( $data['ignore'] ) ? 1 : 0;
		$now    = current_time( 'mysql', true );
		$table  = self::table_name();
		$id     = isset( $data['id'] ) ? (int) $data['id'] : 0;

		$row = array(
			'source'      => $source,
			'matching'    => $matching,
			'destination' => $destination,
			'type'        => $type,
			'category'    => $category,
			'status'      => $status,
			'ignore_case' => $ignore,
			'updated_at'  => $now,
		);

		if ( $id > 0 ) {
			$existing = self::get( $id );
			if ( ! $existing ) {
				return array(
					'ok'    => false,
					'error' => __( 'Redirect not found.', 'neo-pulse-wp' ),
				);
			}
			$conflict = self::get_by_source( $source );
			if ( $conflict && (int) $conflict->id !== $id ) {
				return array(
					'ok'    => false,
					'error' => __( 'Another redirect already uses this source path.', 'neo-pulse-wp' ),
				);
			}
			$wpdb->update( $table, $row, array( 'id' => $id ) );
			return array(
				'ok' => true,
				'id' => $id,
			);
		}

		$conflict = self::get_by_source( $source );
		if ( $conflict ) {
			return array(
				'ok'    => false,
				'error' => __( 'Another redirect already uses this source path.', 'neo-pulse-wp' ),
			);
		}

		$row['created_at'] = $now;
		$row['hits']       = 0;
		$wpdb->insert( $table, $row );
		$new_id = (int) $wpdb->insert_id;

		return array(
			'ok' => $new_id > 0,
			'id' => $new_id,
		);
	}

	/**
	 * Merge import rows by source path.
	 *
	 * @param array<int, array<string, mixed>> $rows Parsed CSV rows.
	 * @return array{added: int, updated: int, skipped: int}
	 */
	public static function merge_import( array $rows ): array {
		$added   = 0;
		$updated = 0;
		$skipped = 0;

		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				++$skipped;
				continue;
			}
			$existing = self::get_by_source( isset( $row['source'] ) ? (string) $row['source'] : '' );
			if ( $existing ) {
				$row['id'] = (int) $existing->id;
				$result    = self::save( $row );
				if ( ! empty( $result['ok'] ) ) {
					++$updated;
				} else {
					++$skipped;
				}
			} else {
				$result = self::save( $row );
				if ( ! empty( $result['ok'] ) ) {
					++$added;
				} else {
					++$skipped;
				}
			}
		}

		return array(
			'added'   => $added,
			'updated' => $updated,
			'skipped' => $skipped,
		);
	}

	/**
	 * @param array<int, int> $ids Redirect IDs.
	 * @param string          $action Bulk action.
	 * @return int
	 */
	public static function bulk_action( array $ids, string $action ): int {
		global $wpdb;
		$table   = self::table_name();
		$ids     = array_values( array_filter( array_map( 'intval', $ids ) ) );
		$changed = 0;
		if ( empty( $ids ) ) {
			return 0;
		}
		$now = current_time( 'mysql', true );
		foreach ( $ids as $id ) {
			if ( $id < 1 ) {
				continue;
			}
			switch ( $action ) {
				case 'trash':
					$wpdb->update( $table, array( 'status' => 'trash', 'updated_at' => $now ), array( 'id' => $id ) );
					++$changed;
					break;
				case 'restore':
					$wpdb->update( $table, array( 'status' => 'active', 'updated_at' => $now ), array( 'id' => $id ) );
					++$changed;
					break;
				case 'activate':
					$wpdb->update( $table, array( 'status' => 'active', 'updated_at' => $now ), array( 'id' => $id ) );
					++$changed;
					break;
				case 'deactivate':
					$wpdb->update( $table, array( 'status' => 'inactive', 'updated_at' => $now ), array( 'id' => $id ) );
					++$changed;
					break;
				case 'delete':
					$wpdb->delete( $table, array( 'id' => $id ) );
					++$changed;
					break;
			}
		}
		return $changed;
	}

	public static function delete( int $id ): bool {
		global $wpdb;
		if ( $id < 1 ) {
			return false;
		}
		$table = self::table_name();
		return false !== $wpdb->delete( $table, array( 'id' => $id ) );
	}

	/**
	 * @return array<int, object>
	 */
	public static function export_rows(): array {
		global $wpdb;
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results( "SELECT * FROM {$table} WHERE status != 'trash' ORDER BY source ASC" );
		return is_array( $rows ) ? $rows : array();
	}

	public static function maybe_redirect(): void {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		if ( $request_uri === '' ) {
			return;
		}

		$path = wp_parse_url( $request_uri, PHP_URL_PATH );
		if ( ! is_string( $path ) || $path === '' ) {
			return;
		}

		$source = Neo_Pulse_Wp_Redirects_Csv::normalize_relative_path( $path );
		if ( ! $source ) {
			return;
		}

		global $wpdb;
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE source = %s AND status = 'active' LIMIT 1", $source ) );
		if ( ! $row ) {
			return;
		}

		if ( isset( $row->matching ) && 'exact' !== (string) $row->matching ) {
			return;
		}

		$target = Neo_Pulse_Wp_Redirects_Csv::resolve_destination_url( (string) $row->destination );
		if ( ! $target ) {
			return;
		}

		$current = home_url( $path );
		if ( untrailingslashit( strtolower( $current ) ) === untrailingslashit( strtolower( $target ) ) ) {
			return;
		}

		$code = isset( $row->type ) ? (int) $row->type : 301;
		if ( ! in_array( $code, array( 301, 302 ), true ) ) {
			$code = 301;
		}

		$now = current_time( 'mysql', true );
		$wpdb->update(
			$table,
			array(
				'hits'             => (int) $row->hits + 1,
				'last_accessed_at' => $now,
				'updated_at'       => $now,
			),
			array( 'id' => (int) $row->id )
		);

		wp_safe_redirect( $target, $code );
		exit;
	}

	/**
	 * Redirect unmatched 404 requests to the site homepage when enabled in settings.
	 */
	public static function maybe_fallback_home(): void {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}

		$settings = self::get_settings();
		if ( empty( $settings['fallback_home_enabled'] ) ) {
			return;
		}

		if ( ! is_404() ) {
			return;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path        = is_string( $request_uri ) ? wp_parse_url( $request_uri, PHP_URL_PATH ) : '';
		if ( ! is_string( $path ) || $path === '' || $path === '/' ) {
			return;
		}

		$normalized = Neo_Pulse_Wp_Redirects_Csv::normalize_relative_path( $path );
		if ( ! $normalized ) {
			return;
		}

		$home_url = home_url( '/' );
		$current  = home_url( $path );
		if ( untrailingslashit( strtolower( $current ) ) === untrailingslashit( strtolower( $home_url ) ) ) {
			return;
		}

		$code = isset( $settings['fallback_home_type'] ) ? (int) $settings['fallback_home_type'] : 301;
		if ( ! in_array( $code, array( 301, 302 ), true ) ) {
			$code = 301;
		}

		wp_safe_redirect( $home_url, $code );
		exit;
	}
}
