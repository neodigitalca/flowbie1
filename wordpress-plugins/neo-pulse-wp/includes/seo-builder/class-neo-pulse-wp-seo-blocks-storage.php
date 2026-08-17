<?php
/**
 * SEO block registry storage.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-layout.php';

class Neo_Pulse_Wp_Seo_Blocks_Storage {

	const TABLE_VERSION = '1.2';
	const STATUSES      = array( 'draft', 'published', 'needs_optimize' );

	/**
	 * @return string
	 */
	public static function table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'neo_pulse_wp_seo_blocks';
	}

	public static function init(): void {
		add_action( 'plugins_loaded', array( __CLASS__, 'maybe_install' ), 20 );
	}

	public static function maybe_install(): void {
		if ( get_option( 'neo_pulse_wp_seo_blocks_db_version', '' ) !== self::TABLE_VERSION ) {
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
			slug varchar(200) NOT NULL,
			title varchar(255) NOT NULL,
			focus_keyword varchar(255) NOT NULL DEFAULT '',
			topic_focus longtext NOT NULL,
			slots longtext NOT NULL,
			layout_config longtext NOT NULL,
			elementor_library_id bigint(20) unsigned NOT NULL DEFAULT 0,
			primary_post_id bigint(20) unsigned NOT NULL DEFAULT 0,
			status varchar(20) NOT NULL DEFAULT 'draft',
			last_optimized_at datetime DEFAULT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY slug (slug(191)),
			KEY status (status),
			KEY elementor_library_id (elementor_library_id),
			KEY primary_post_id (primary_post_id)
		) {$charset};";

		dbDelta( $sql );
		self::maybe_add_layout_column();
		self::maybe_add_primary_post_column();
		update_option( 'neo_pulse_wp_seo_blocks_db_version', self::TABLE_VERSION, false );
	}

	private static function maybe_add_primary_post_column(): void {
		global $wpdb;
		$table  = self::table_name();
		$column = $wpdb->get_results( $wpdb->prepare( 'SHOW COLUMNS FROM `' . $table . '` LIKE %s', 'primary_post_id' ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( ! empty( $column ) ) {
			return;
		}
		$wpdb->query( "ALTER TABLE {$table} ADD primary_post_id bigint(20) unsigned NOT NULL DEFAULT 0 AFTER elementor_library_id, ADD KEY primary_post_id (primary_post_id)" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	private static function maybe_add_layout_column(): void {
		global $wpdb;
		$table  = self::table_name();
		$column = $wpdb->get_results( $wpdb->prepare( 'SHOW COLUMNS FROM `' . $table . '` LIKE %s', 'layout_config' ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( ! empty( $column ) ) {
			return;
		}
		$wpdb->query( "ALTER TABLE {$table} ADD layout_config longtext NOT NULL AFTER slots" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_all(): array {
		global $wpdb;
		$table = self::table_name();
		$rows  = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY updated_at DESC, id DESC", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( ! is_array( $rows ) ) {
			return array();
		}
		return array_map( array( __CLASS__, 'decode_row' ), $rows );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $id ): ?array {
		global $wpdb;
		if ( $id < 1 ) {
			return null;
		}
		$table = self::table_name();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( ! is_array( $row ) ) {
			return null;
		}
		return self::decode_row( $row );
	}

	/**
	 * @param array<string,mixed> $input
	 * @return array<string,mixed>|WP_Error
	 */
	public static function save( array $input ) {
		global $wpdb;

		$id            = absint( $input['id'] ?? 0 );
		$title         = sanitize_text_field( (string) ( $input['title'] ?? '' ) );
		$focus_keyword = sanitize_text_field( (string) ( $input['focus_keyword'] ?? '' ) );
		$topic_focus   = sanitize_textarea_field( (string) ( $input['topic_focus'] ?? '' ) );
		$status        = sanitize_key( (string) ( $input['status'] ?? 'draft' ) );
		$library_id    = absint( $input['elementor_library_id'] ?? 0 );
		$primary_post  = absint( $input['primary_post_id'] ?? 0 );

		if ( $primary_post > 0 ) {
			$valid = self::validate_primary_post( $primary_post );
			if ( is_wp_error( $valid ) ) {
				return $valid;
			}
		}

		if ( $title === '' && $focus_keyword !== '' ) {
			$title = $focus_keyword;
		}
		if ( $title === '' ) {
			return new WP_Error( 'neo-pulse_seo_block_title', __( 'Theme / title is required.', 'neo-pulse-wp' ) );
		}

		$existing_slots  = null;
		$existing_layout = null;
		if ( $id > 0 ) {
			$existing_row = self::get( $id );
			if ( is_array( $existing_row ) ) {
				$existing_slots  = $existing_row['slots'] ?? array();
				$existing_layout = $existing_row['layout_config'] ?? null;
			}
		}

		$slots = Neo_Pulse_Wp_Seo_Blocks_Slots::slots_from_row( $input, $existing_slots );
		if ( empty( $slots ) && ! empty( $input['h2'] ) ) {
			$slots = Neo_Pulse_Wp_Seo_Blocks_Slots::slots_from_row( $input, null );
		}
		$slots = Neo_Pulse_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots );

		$layout_raw = $input['layout_config'] ?? null;
		if ( is_array( $layout_raw ) ) {
			$layout_config = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $layout_raw, $slots );
		} elseif ( is_array( $existing_layout ) ) {
			$layout_config = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $existing_layout, $slots );
		} else {
			$layout_config = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( array(), $slots );
		}

		$slug = self::unique_slug( self::make_slug( $title, $focus_keyword ), $id );
		if ( ! in_array( $status, self::STATUSES, true ) ) {
			$status = 'draft';
		}

		$now   = current_time( 'mysql' );
		$table = self::table_name();
		$data  = array(
			'slug'                 => $slug,
			'title'                => $title,
			'focus_keyword'        => $focus_keyword,
			'topic_focus'          => $topic_focus,
			'slots'                => wp_json_encode( Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $slots ) ),
			'layout_config'        => wp_json_encode( $layout_config ),
			'elementor_library_id' => $library_id,
			'primary_post_id'      => $primary_post,
			'status'               => $status,
			'updated_at'           => $now,
		);

		if ( $id > 0 ) {
			$updated = $wpdb->update( $table, $data, array( 'id' => $id ), null, array( '%d' ) );
			if ( false === $updated ) {
				return new WP_Error( 'neo-pulse_seo_block_save', __( 'Could not update SEO block.', 'neo-pulse-wp' ) );
			}
			$row = self::get( $id );
		} else {
			$data['created_at'] = $now;
			$inserted           = $wpdb->insert( $table, $data );
			if ( ! $inserted ) {
				return new WP_Error( 'neo-pulse_seo_block_save', __( 'Could not create SEO block.', 'neo-pulse-wp' ) );
			}
			$row = self::get( (int) $wpdb->insert_id );
		}

		if ( ! is_array( $row ) ) {
			return new WP_Error( 'neo-pulse_seo_block_save', __( 'Could not load saved SEO block.', 'neo-pulse-wp' ) );
		}

		$sync = Neo_Pulse_Wp_Seo_Blocks_Library::sync_row( $row );
		if ( is_wp_error( $sync ) ) {
			$row = self::get( (int) $row['id'] );
			if ( ! is_array( $row ) ) {
				return $sync;
			}
			$row['library_sync_error'] = $sync->get_error_message();
			return self::format_block_response( $row );
		}

		$fresh = self::get( (int) $row['id'] );
		return self::format_block_response( is_array( $fresh ) ? $fresh : $row );
	}

	/**
	 * Attach Elementor widget settings so editor can mirror Agent Hub exactly.
	 *
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	public static function format_block_response( array $row ): array {
		$row['widget_settings'] = Neo_Pulse_Wp_Seo_Blocks_Library::row_to_widget_settings( $row );
		return $row;
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 * @return true|WP_Error
	 */
	public static function update_slots( int $id, array $slots, bool $mark_optimized = false ) {
		global $wpdb;
		if ( $id < 1 ) {
			return new WP_Error( 'neo-pulse_seo_block_id', __( 'Invalid block ID.', 'neo-pulse-wp' ) );
		}

		$update = array(
			'slots'      => wp_json_encode( Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $slots ) ),
			'updated_at' => current_time( 'mysql' ),
		);
		if ( $mark_optimized ) {
			$update['last_optimized_at'] = current_time( 'mysql' );
			$update['status']            = 'published';
		}

		$table = self::table_name();
		$ok    = $wpdb->update( $table, $update, array( 'id' => $id ) );
		if ( false === $ok ) {
			return new WP_Error( 'neo-pulse_seo_block_update', __( 'Could not update block slots.', 'neo-pulse-wp' ) );
		}

		$row = self::get( $id );
		if ( is_array( $row ) ) {
			Neo_Pulse_Wp_Seo_Blocks_Library::sync_row( $row );
		}

		return true;
	}

	/**
	 * @return true|WP_Error
	 */
	public static function delete( int $id, bool $trash_library = false ) {
		global $wpdb;
		if ( $id < 1 ) {
			return new WP_Error( 'neo-pulse_seo_block_id', __( 'Invalid block ID.', 'neo-pulse-wp' ) );
		}

		$row = self::get( $id );
		if ( ! is_array( $row ) ) {
			return new WP_Error( 'neo-pulse_seo_block_missing', __( 'SEO block not found.', 'neo-pulse-wp' ) );
		}

		if ( $trash_library && ! empty( $row['elementor_library_id'] ) ) {
			wp_trash_post( (int) $row['elementor_library_id'] );
		}

		$table = self::table_name();
		$wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );

		return true;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	public static function decode_row( array $row ): array {
		$slots = json_decode( (string) ( $row['slots'] ?? '[]' ), true );
		if ( ! is_array( $slots ) ) {
			$slots = array();
		}
		$row['slots']                 = Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $slots );
		$layout_raw = json_decode( (string) ( $row['layout_config'] ?? '{}' ), true );
		$row['layout_config']         = Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config(
			is_array( $layout_raw ) ? $layout_raw : array(),
			$row['slots']
		);
		$row['id']                    = (int) ( $row['id'] ?? 0 );
		$row['elementor_library_id']  = (int) ( $row['elementor_library_id'] ?? 0 );
		$row['primary_post_id']       = (int) ( $row['primary_post_id'] ?? 0 );
		$row['primary_post']          = self::primary_post_summary( (int) $row['primary_post_id'] );
		$row['slot_summary']          = Neo_Pulse_Wp_Seo_Blocks_Slots::summary( $row['slots'] );
		$row['h2']                    = self::first_h2( $row['slots'] );
		$row['usage_count']           = Neo_Pulse_Wp_Seo_Blocks_Usage::count_for_block( (int) $row['id'] );
		$row['choice_label']          = self::format_choice_label( $row );
		return $row;
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 */
	public static function first_h2( array $slots ): string {
		foreach ( Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $slots ) as $slot ) {
			if ( ( $slot['type'] ?? '' ) === 'h2' && ! empty( $slot['text'] ) ) {
				return (string) $slot['text'];
			}
		}
		return '';
	}

	public static function make_slug( string $title, string $focus_keyword = '' ): string {
		$base = $focus_keyword !== '' ? $focus_keyword : $title;
		$slug = sanitize_title( $base );
		if ( $slug === '' ) {
			$slug = sanitize_title( $title );
		}
		if ( $slug === '' ) {
			$slug = 'seo-block';
		}
		return $slug;
	}

	private static function unique_slug( string $slug, int $exclude_id = 0 ): string {
		global $wpdb;
		$table    = self::table_name();
		$base     = $slug;
		$attempt  = $base;
		$counter  = 2;
		while ( true ) {
			$existing = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$table} WHERE slug = %s AND id != %d LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$attempt,
					$exclude_id
				)
			);
			if ( $existing < 1 ) {
				return $attempt;
			}
			$attempt = $base . '-' . $counter;
			++$counter;
		}
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function export_for_flo_sheet(): array {
		return self::list_all();
	}

	/**
	 * Dropdown choices for Elementor widget: id => "#ID — H2".
	 *
	 * @return array<string,string>
	 */
	public static function get_registry_choices(): array {
		$choices = array(
			'' => __( '— Select Agent Hub block —', 'neo-pulse-wp' ),
		);
		foreach ( self::list_all() as $block ) {
			$id = (int) ( $block['id'] ?? 0 );
			if ( $id < 1 ) {
				continue;
			}
			$choices[ (string) $id ] = self::format_choice_label( $block );
		}
		return $choices;
	}

	/**
	 * @param array<string,mixed> $block
	 */
	public static function format_choice_label( array $block ): string {
		$id  = (int) ( $block['id'] ?? 0 );
		$h2  = isset( $block['h2'] ) ? (string) $block['h2'] : self::first_h2( $block['slots'] ?? array() );
		$label = $h2 !== '' ? $h2 : (string) ( $block['title'] ?? '' );
		if ( $label === '' ) {
			$label = __( 'Untitled block', 'neo-pulse-wp' );
		}
		return sprintf( '#%d — %s', $id, $label );
	}

	/**
	 * Create a draft block and return it (auto-assigns DB id).
	 *
	 * @return array<string,mixed>|WP_Error
	 */
	public static function create_draft() {
		return self::save(
			array(
				'title'  => __( 'New SEO block', 'neo-pulse-wp' ),
				'status' => 'draft',
			)
		);
	}

	/**
	 * @return array<int,string>
	 */
	public static function allowed_primary_post_types(): array {
		$types = array( 'page', 'post' );
		/**
		 * Filter post types allowed as SEO block primary page context.
		 *
		 * @param array<int,string> $types
		 */
		return apply_filters( 'neo_pulse_wp_seo_block_primary_post_types', $types );
	}

	/**
	 * @return true|WP_Error
	 */
	public static function validate_primary_post( int $post_id ) {
		if ( $post_id < 1 ) {
			return true;
		}
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return new WP_Error( 'neo-pulse_seo_block_primary_post', __( 'Linked page not found.', 'neo-pulse-wp' ) );
		}
		if ( ! in_array( $post->post_type, self::allowed_primary_post_types(), true ) ) {
			return new WP_Error( 'neo-pulse_seo_block_primary_post', __( 'Linked page must be a page or post.', 'neo-pulse-wp' ) );
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error( 'neo-pulse_seo_block_primary_post', __( 'You cannot link this page.', 'neo-pulse-wp' ) );
		}
		return true;
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function primary_post_summary( int $post_id ): array {
		if ( $post_id < 1 ) {
			return array();
		}
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return array();
		}
		return array(
			'id'            => $post_id,
			'title'         => get_the_title( $post ),
			'type'          => $post->post_type,
			'edit_url'      => get_edit_post_link( $post_id, 'raw' ) ?: '',
			'view_url'      => get_permalink( $post_id ) ?: '',
			'focus_keyword' => Neo_Pulse_Wp_Ai_Context::read_focus_keyword( $post_id ),
		);
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function duplicate_block( int $id ) {
		$source = self::get( $id );
		if ( ! is_array( $source ) ) {
			return new WP_Error( 'neo-pulse_seo_block_missing', __( 'SEO block not found.', 'neo-pulse-wp' ) );
		}

		$title = sanitize_text_field( (string) ( $source['title'] ?? '' ) );
		if ( $title === '' ) {
			$title = __( 'SEO block', 'neo-pulse-wp' );
		}
		$title .= ' ' . __( '(Copy)', 'neo-pulse-wp' );

		return self::save(
			array(
				'title'           => $title,
				'focus_keyword'   => (string) ( $source['focus_keyword'] ?? '' ),
				'topic_focus'     => (string) ( $source['topic_focus'] ?? '' ),
				'slots'           => $source['slots'] ?? array(),
				'layout_config'   => $source['layout_config'] ?? array(),
				'primary_post_id' => (int) ( $source['primary_post_id'] ?? 0 ),
				'status'          => 'draft',
			)
		);
	}
}
