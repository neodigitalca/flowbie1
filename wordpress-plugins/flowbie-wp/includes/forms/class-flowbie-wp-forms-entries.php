<?php
/**
 * Form entry (lead) storage in custom tables.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Forms_Entries {

	const TABLE_VERSION = '1.0';

	const DB_VERSION_OPTION = 'flowbie_wp_forms_db_version';

	public static function entries_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'flowbie_wp_form_entries';
	}

	public static function meta_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'flowbie_wp_form_entry_meta';
	}

	public static function install(): void {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset  = $wpdb->get_charset_collate();
		$entries  = self::entries_table_name();
		$meta     = self::meta_table_name();

		$sql_entries = "CREATE TABLE {$entries} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			entry_uid varchar(36) NOT NULL,
			form_id bigint(20) unsigned NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'active',
			ip_address varchar(45) DEFAULT NULL,
			user_agent varchar(512) DEFAULT NULL,
			source_url varchar(512) DEFAULT NULL,
			user_id bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY entry_uid (entry_uid),
			KEY form_created (form_id, created_at),
			KEY status (status)
		) {$charset};";

		$sql_meta = "CREATE TABLE {$meta} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			entry_id bigint(20) unsigned NOT NULL,
			meta_key varchar(191) NOT NULL,
			meta_value longtext NOT NULL,
			PRIMARY KEY  (id),
			KEY entry_id (entry_id),
			KEY meta_key (meta_key(100))
		) {$charset};";

		dbDelta( $sql_entries );
		dbDelta( $sql_meta );
		update_option( self::DB_VERSION_OPTION, self::TABLE_VERSION, false );
	}

	public static function maybe_install(): void {
		if ( get_option( self::DB_VERSION_OPTION, '' ) !== self::TABLE_VERSION ) {
			self::install();
		}
	}

	/**
	 * @param array<string, mixed> $args Entry args.
	 * @return int Entry ID or 0.
	 */
	public static function insert_entry( array $args ): int {
		global $wpdb;

		$form_id = isset( $args['form_id'] ) ? (int) $args['form_id'] : 0;
		if ( $form_id < 1 ) {
			return 0;
		}

		$uid = isset( $args['entry_uid'] ) ? sanitize_text_field( (string) $args['entry_uid'] ) : '';
		if ( $uid === '' ) {
			$uid = function_exists( 'wp_generate_uuid4' ) ? wp_generate_uuid4() : uniqid( 'entry_', true );
		}

		$status = isset( $args['status'] ) ? sanitize_key( (string) $args['status'] ) : 'active';
		if ( ! in_array( $status, array( 'active', 'spam', 'trash' ), true ) ) {
			$status = 'active';
		}

		$now = current_time( 'mysql', true );

		$inserted = $wpdb->insert(
			self::entries_table_name(),
			array(
				'entry_uid'  => $uid,
				'form_id'    => $form_id,
				'status'     => $status,
				'ip_address' => isset( $args['ip_address'] ) ? (string) $args['ip_address'] : null,
				'user_agent' => isset( $args['user_agent'] ) ? substr( (string) $args['user_agent'], 0, 512 ) : null,
				'source_url' => isset( $args['source_url'] ) ? substr( (string) $args['source_url'], 0, 512 ) : null,
				'user_id'    => isset( $args['user_id'] ) ? (int) $args['user_id'] : 0,
				'created_at' => $now,
			),
			array( '%s', '%d', '%s', '%s', '%s', '%s', '%d', '%s' )
		);

		if ( ! $inserted ) {
			return 0;
		}

		$entry_id = (int) $wpdb->insert_id;
		$meta     = isset( $args['meta'] ) && is_array( $args['meta'] ) ? $args['meta'] : array();
		foreach ( $meta as $key => $value ) {
			self::add_meta( $entry_id, (string) $key, $value );
		}

		return $entry_id;
	}

	public static function add_meta( int $entry_id, string $key, $value ): void {
		global $wpdb;
		if ( $entry_id < 1 || $key === '' ) {
			return;
		}
		if ( is_array( $value ) || is_object( $value ) ) {
			$value = wp_json_encode( $value, JSON_UNESCAPED_UNICODE );
		} else {
			$value = (string) $value;
		}
		$wpdb->insert(
			self::meta_table_name(),
			array(
				'entry_id'   => $entry_id,
				'meta_key'   => sanitize_key( $key ),
				'meta_value' => $value,
			),
			array( '%d', '%s', '%s' )
		);
	}

	/**
	 * @return array<string, string>
	 */
	public static function get_meta( int $entry_id ): array {
		global $wpdb;
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT meta_key, meta_value FROM ' . self::meta_table_name() . ' WHERE entry_id = %d',
				$entry_id
			),
			ARRAY_A
		);
		$out = array();
		if ( ! is_array( $rows ) ) {
			return $out;
		}
		foreach ( $rows as $row ) {
			$key = (string) ( $row['meta_key'] ?? '' );
			if ( $key === '' ) {
				continue;
			}
			$raw = (string) ( $row['meta_value'] ?? '' );
			$decoded = json_decode( $raw, true );
			$out[ $key ] = ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded ) ) ? $decoded : $raw;
		}
		return $out;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function get_entry( int $entry_id ): ?array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::entries_table_name() . ' WHERE id = %d',
				$entry_id
			)
		);
		if ( ! $row ) {
			return null;
		}
		return self::format_entry_row( $row );
	}

	/**
	 * @param object $row DB row.
	 * @return array<string, mixed>
	 */
	private static function format_entry_row( $row ): array {
		$entry_id = (int) $row->id;
		return array(
			'id'         => $entry_id,
			'entry_uid'  => (string) $row->entry_uid,
			'form_id'    => (int) $row->form_id,
			'status'     => (string) $row->status,
			'ip_address' => $row->ip_address,
			'user_agent' => $row->user_agent,
			'source_url' => $row->source_url,
			'user_id'    => (int) $row->user_id,
			'created_at' => (string) $row->created_at,
			'meta'       => self::get_meta( $entry_id ),
		);
	}

	/**
	 * @param array<string, mixed> $args Query args.
	 * @return array{items: array<int, array<string, mixed>>, total: int}
	 */
	public static function list_entries( array $args ): array {
		global $wpdb;

		$form_id = isset( $args['form_id'] ) ? (int) $args['form_id'] : 0;
		$status  = isset( $args['status'] ) ? sanitize_key( (string) $args['status'] ) : 'active';
		$page    = max( 1, (int) ( $args['page'] ?? 1 ) );
		$per     = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
		$offset  = ( $page - 1 ) * $per;

		$table = self::entries_table_name();
		$where = array( '1=1' );
		$bind  = array();

		if ( $form_id > 0 ) {
			$where[] = 'form_id = %d';
			$bind[]  = $form_id;
		}
		if ( $status !== 'all' && $status !== '' ) {
			$where[] = 'status = %s';
			$bind[]  = $status;
		}

		$where_sql = implode( ' AND ', $where );

		$count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$total = (int) $wpdb->get_var( $bind ? $wpdb->prepare( $count_sql, $bind ) : $count_sql );

		$list_sql = "SELECT * FROM {$table} WHERE {$where_sql} ORDER BY created_at DESC LIMIT %d OFFSET %d";
		$bind[]   = $per;
		$bind[]   = $offset;
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $list_sql, $bind ) );

		$items = array();
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row ) {
				$items[] = self::format_entry_row( $row );
			}
		}

		return array(
			'items' => $items,
			'total' => $total,
		);
	}

	public static function count_for_form( int $form_id, string $status = 'active' ): int {
		global $wpdb;
		if ( $form_id < 1 ) {
			return 0;
		}
		$table = self::entries_table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			return 0;
		}
		if ( $status === 'all' ) {
			return (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM ' . self::entries_table_name() . ' WHERE form_id = %d',
					$form_id
				)
			);
		}
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM ' . self::entries_table_name() . ' WHERE form_id = %d AND status = %s',
				$form_id,
				$status
			)
		);
	}

	/**
	 * @param array<int> $entry_ids Entry IDs.
	 */
	public static function delete_entries( array $entry_ids ): int {
		global $wpdb;
		$deleted = 0;
		foreach ( $entry_ids as $id ) {
			$id = (int) $id;
			if ( $id < 1 ) {
				continue;
			}
			$wpdb->delete( self::meta_table_name(), array( 'entry_id' => $id ), array( '%d' ) );
			$result = $wpdb->delete( self::entries_table_name(), array( 'id' => $id ), array( '%d' ) );
			if ( $result ) {
				++$deleted;
			}
		}
		return $deleted;
	}

	/**
	 * @param array<int> $entry_ids Entry IDs.
	 */
	public static function update_status( array $entry_ids, string $status ): int {
		global $wpdb;
		if ( ! in_array( $status, array( 'active', 'spam', 'trash' ), true ) ) {
			return 0;
		}
		$updated = 0;
		foreach ( $entry_ids as $id ) {
			$id = (int) $id;
			if ( $id < 1 ) {
				continue;
			}
			$result = $wpdb->update(
				self::entries_table_name(),
				array( 'status' => $status ),
				array( 'id' => $id ),
				array( '%s' ),
				array( '%d' )
			);
			if ( false !== $result ) {
				++$updated;
			}
		}
		return $updated;
	}

	/**
	 * Export entries for a form as CSV string.
	 *
	 * @param int   $form_id Form post ID.
	 * @param array<int, array<string, mixed>> $fields Form fields for headers.
	 */
	public static function export_csv( int $form_id, array $fields ): string {
		return Flowbie_Wp_Forms_Entries_Csv::build_export_string( $form_id, $fields );
	}
}
