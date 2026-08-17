<?php
/**
 * Script Manager storage and CRUD.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Script_Manager {

	const TABLE_VERSION = '1.0';
	const OPTION_KEY    = 'neo_pulse_wp_script_manager_settings';

	const PLACEMENTS = array( 'header', 'footer', 'body' );

	public static function table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'neo_pulse_wp_scripts';
	}

	public static function init(): void {
		add_action( 'plugins_loaded', array( __CLASS__, 'maybe_install' ), 20 );
	}

	public static function maybe_install(): void {
		if ( get_option( 'neo_pulse_wp_scripts_db_version', '' ) !== self::TABLE_VERSION ) {
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
			name varchar(255) NOT NULL,
			placement varchar(20) NOT NULL DEFAULT 'header',
			code longtext NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'active',
			priority smallint(5) unsigned NOT NULL DEFAULT 10,
			category varchar(100) NOT NULL DEFAULT 'Uncategorized',
			display_rules longtext NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY status (status),
			KEY placement (placement),
			KEY priority (priority),
			KEY category (category(50))
		) {$charset};";

		dbDelta( $sql );
		update_option( 'neo_pulse_wp_scripts_db_version', self::TABLE_VERSION, false );

		if ( get_option( self::OPTION_KEY, null ) === null ) {
			add_option(
				self::OPTION_KEY,
				array(
					'default_category'        => __( 'Uncategorized', 'neo-pulse-wp' ),
					'customizer_preview'    => false,
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
		$default_category = isset( $raw['default_category'] ) ? sanitize_text_field( (string) $raw['default_category'] ) : __( 'Uncategorized', 'neo-pulse-wp' );
		if ( $default_category === '' ) {
			$default_category = __( 'Uncategorized', 'neo-pulse-wp' );
		}
		return array(
			'default_category'     => $default_category,
			'customizer_preview'   => ! empty( $raw['customizer_preview'] ),
		);
	}

	/**
	 * @param array<string, mixed> $settings Settings.
	 */
	public static function save_settings( array $settings ): void {
		$default_category = isset( $settings['default_category'] ) ? sanitize_text_field( (string) $settings['default_category'] ) : __( 'Uncategorized', 'neo-pulse-wp' );
		if ( $default_category === '' ) {
			$default_category = __( 'Uncategorized', 'neo-pulse-wp' );
		}
		update_option(
			self::OPTION_KEY,
			array(
				'default_category'   => $default_category,
				'customizer_preview' => ! empty( $settings['customizer_preview'] ),
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

		$placement = isset( $args['placement'] ) ? sanitize_key( (string) $args['placement'] ) : '';
		if ( $placement !== '' && in_array( $placement, self::PLACEMENTS, true ) ) {
			$where[]  = 'placement = %s';
			$params[] = $placement;
		}

		$category = isset( $args['category'] ) ? sanitize_text_field( (string) $args['category'] ) : '';
		if ( $category !== '' ) {
			$where[]  = 'category = %s';
			$params[] = $category;
		}

		$search = isset( $args['search'] ) ? sanitize_text_field( (string) $args['search'] ) : '';
		if ( $search !== '' ) {
			$like     = '%' . $wpdb->esc_like( $search ) . '%';
			$where[]  = '(name LIKE %s OR category LIKE %s)';
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
			'name'       => 'name',
			'placement'  => 'placement',
			'priority'   => 'priority',
			'category'   => 'category',
			'created_at' => 'created_at',
			'updated_at' => 'updated_at',
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
	 * Active scripts for a placement, ordered by priority.
	 *
	 * @return array<int, object>
	 */
	public static function get_active_for_placement( string $placement ): array {
		global $wpdb;

		if ( ! in_array( $placement, self::PLACEMENTS, true ) ) {
			return array();
		}

		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE status = 'active' AND placement = %s ORDER BY priority ASC, id ASC",
				$placement
			)
		);

		return is_array( $rows ) ? $rows : array();
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
	public static function get_by_name( string $name ) {
		global $wpdb;
		$norm = self::normalize_name( $name );
		if ( $norm === '' ) {
			return null;
		}
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE name = %s LIMIT 1", $norm ) );
		return $row ? $row : null;
	}

	public static function normalize_name( string $name ): string {
		return sanitize_text_field( trim( $name ) );
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
	 * Count non-trashed scripts in a category.
	 */
	public static function count_by_category( string $category ): int {
		global $wpdb;
		$category = sanitize_text_field( $category );
		if ( $category === '' ) {
			return 0;
		}
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$count = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE category = %s AND status != 'trash'",
				$category
			)
		);
		return is_numeric( $count ) ? (int) $count : 0;
	}

	/**
	 * @param array<string, mixed> $data Script data.
	 * @return array{ok: bool, id?: int, error?: string}
	 */
	public static function save( array $data ) {
		global $wpdb;

		$name = isset( $data['name'] ) ? self::normalize_name( (string) $data['name'] ) : '';
		if ( $name === '' ) {
			return array(
				'ok'    => false,
				'error' => __( 'Script name is required.', 'neo-pulse-wp' ),
			);
		}

		$code = isset( $data['code'] ) ? (string) $data['code'] : '';
		if ( trim( $code ) === '' ) {
			return array(
				'ok'    => false,
				'error' => __( 'Script code is required.', 'neo-pulse-wp' ),
			);
		}

		$placement = isset( $data['placement'] ) ? sanitize_key( (string) $data['placement'] ) : 'header';
		if ( ! in_array( $placement, self::PLACEMENTS, true ) ) {
			$placement = 'header';
		}

		$priority = isset( $data['priority'] ) ? (int) $data['priority'] : 10;
		$priority = max( 0, min( 9999, $priority ) );

		$settings = self::get_settings();
		$category = isset( $data['category'] ) ? sanitize_text_field( (string) $data['category'] ) : $settings['default_category'];
		if ( $category === '' ) {
			$category = $settings['default_category'];
		}

		$status = isset( $data['status'] ) ? sanitize_key( (string) $data['status'] ) : 'active';
		if ( ! in_array( $status, array( 'active', 'inactive', 'trash' ), true ) ) {
			$status = 'active';
		}

		$rules_raw = isset( $data['display_rules'] ) ? $data['display_rules'] : Neo_Pulse_Wp_Script_Manager_Rules::defaults();
		$normalized = Neo_Pulse_Wp_Script_Manager_Rules::normalize( $rules_raw );
		if ( empty( $normalized['ok'] ) ) {
			return array(
				'ok'    => false,
				'error' => isset( $normalized['error'] ) ? (string) $normalized['error'] : __( 'Invalid display rules.', 'neo-pulse-wp' ),
			);
		}
		$display_rules = Neo_Pulse_Wp_Script_Manager_Rules::encode( $normalized['rules'] );

		$now   = current_time( 'mysql', true );
		$table = self::table_name();
		$id    = isset( $data['id'] ) ? (int) $data['id'] : 0;

		$row = array(
			'name'          => $name,
			'placement'     => $placement,
			'code'          => $code,
			'priority'      => $priority,
			'category'      => $category,
			'status'        => $status,
			'display_rules' => $display_rules,
			'updated_at'    => $now,
		);

		if ( $id > 0 ) {
			$existing = self::get( $id );
			if ( ! $existing ) {
				return array(
					'ok'    => false,
					'error' => __( 'Script not found.', 'neo-pulse-wp' ),
				);
			}
			$conflict = self::get_by_name( $name );
			if ( $conflict && (int) $conflict->id !== $id ) {
				return array(
					'ok'    => false,
					'error' => __( 'Another script already uses this name.', 'neo-pulse-wp' ),
				);
			}
			$updated = $wpdb->update( $table, $row, array( 'id' => $id ) );
			if ( false === $updated ) {
				return array(
					'ok'    => false,
					'error' => $wpdb->last_error ? $wpdb->last_error : __( 'Database update failed.', 'neo-pulse-wp' ),
				);
			}
			return array(
				'ok' => true,
				'id' => $id,
			);
		}

		$conflict = self::get_by_name( $name );
		if ( $conflict ) {
			return array(
				'ok'    => false,
				'error' => __( 'Another script already uses this name.', 'neo-pulse-wp' ),
			);
		}

		$row['created_at'] = $now;
		$inserted          = $wpdb->insert( $table, $row );
		if ( false === $inserted ) {
			return array(
				'ok'    => false,
				'error' => $wpdb->last_error ? $wpdb->last_error : __( 'Database insert failed.', 'neo-pulse-wp' ),
			);
		}
		$new_id = (int) $wpdb->insert_id;

		return array(
			'ok' => $new_id > 0,
			'id' => $new_id,
		);
	}

	/**
	 * @param array<int, array<string, mixed>> $rows Parsed CSV rows.
	 * @return array{added: int, updated: int, skipped: int, errors: array<int, string>}
	 */
	public static function merge_import( array $rows ): array {
		$added   = 0;
		$updated = 0;
		$skipped = 0;
		$errors  = array();

		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				++$skipped;
				$errors[] = __( 'Skipped invalid import row.', 'neo-pulse-wp' );
				continue;
			}
			$id = isset( $row['id'] ) ? (int) $row['id'] : 0;
			$name = isset( $row['name'] ) ? (string) $row['name'] : __( 'Unnamed script', 'neo-pulse-wp' );
			if ( $id > 0 && self::get( $id ) ) {
				$row['id'] = $id;
				$result    = self::save( $row );
				if ( ! empty( $result['ok'] ) ) {
					++$updated;
				} else {
					++$skipped;
					$errors[] = sprintf(
						/* translators: 1: script name, 2: error message */
						__( '%1$s — %2$s', 'neo-pulse-wp' ),
						$name,
						isset( $result['error'] ) ? (string) $result['error'] : __( 'Save failed.', 'neo-pulse-wp' )
					);
				}
				continue;
			}
			$existing = self::get_by_name( $name );
			if ( $existing ) {
				$row['id'] = (int) $existing->id;
				$result    = self::save( $row );
				if ( ! empty( $result['ok'] ) ) {
					++$updated;
				} else {
					++$skipped;
					$errors[] = sprintf(
						/* translators: 1: script name, 2: error message */
						__( '%1$s — %2$s', 'neo-pulse-wp' ),
						$name,
						isset( $result['error'] ) ? (string) $result['error'] : __( 'Save failed.', 'neo-pulse-wp' )
					);
				}
			} else {
				$result = self::save( $row );
				if ( ! empty( $result['ok'] ) ) {
					++$added;
				} else {
					++$skipped;
					$errors[] = sprintf(
						/* translators: 1: script name, 2: error message */
						__( '%1$s — %2$s', 'neo-pulse-wp' ),
						$name,
						isset( $result['error'] ) ? (string) $result['error'] : __( 'Save failed.', 'neo-pulse-wp' )
					);
				}
			}
		}

		return array(
			'added'   => $added,
			'updated' => $updated,
			'skipped' => $skipped,
			'errors'  => $errors,
		);
	}

	/**
	 * @param array<int, int> $ids Script IDs.
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
		$rows = $wpdb->get_results( "SELECT * FROM {$table} WHERE status != 'trash' ORDER BY name ASC" );
		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * Detect common header/footer script plugins for admin notice.
	 *
	 * @return array<int, string> Plugin names.
	 */
	public static function conflicting_plugins(): array {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		$conflicts = array();
		$checks    = array(
			'header-footer-code-manager/99robots-header-footer-code-manager.php' => 'Header Footer Code Manager',
			'99robots-header-footer-code-manager-pro/99robots-header-footer-code-manager-pro.php' => 'Header Footer Code Manager Pro',
			'header-footer-code-manager-pro/99robots-header-footer-code-manager-pro.php' => 'Header Footer Code Manager Pro',
			'insert-headers-and-footers/ihaf.php' => 'WPCode',
			'wp-headers-and-footers/wp-headers-and-footers.php' => 'WP Headers and Footers',
		);
		foreach ( $checks as $file => $label ) {
			if ( is_plugin_active( $file ) ) {
				$conflicts[] = $label;
			}
		}
		return $conflicts;
	}
}
