<?php
/**
 * Team tasks DB schema and data access.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Tasks_Store {

	const STATUSES = array( 'todo', 'in_progress', 'done' );

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset  = $wpdb->get_charset_collate();
		$projects = $wpdb->prefix . 'flowbie_team_task_projects';
		$tasks    = $wpdb->prefix . 'flowbie_team_tasks';
		$sections = $wpdb->prefix . 'flowbie_team_task_sections';
		$notes    = $wpdb->prefix . 'flowbie_team_task_notes';
		$files    = $wpdb->prefix . 'flowbie_team_task_files';

		dbDelta(
			"CREATE TABLE {$projects} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				payload_json longtext NOT NULL,
				status varchar(32) NOT NULL DEFAULT 'active',
				sort_order int(11) NOT NULL DEFAULT 0,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				archived_at datetime DEFAULT NULL,
				PRIMARY KEY (id),
				KEY team_id (team_id),
				KEY status (status)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$sections} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				project_id bigint(20) unsigned NOT NULL,
				payload_json longtext NOT NULL,
				sort_order int(11) NOT NULL DEFAULT 0,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY team_project (team_id, project_id)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$tasks} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				project_id bigint(20) unsigned NOT NULL,
				section_id bigint(20) unsigned NOT NULL DEFAULT 0,
				parent_task_id bigint(20) unsigned NOT NULL DEFAULT 0,
				payload_json longtext NOT NULL,
				status varchar(32) NOT NULL DEFAULT 'todo',
				sort_order int(11) NOT NULL DEFAULT 0,
				completed_at datetime DEFAULT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY team_project (team_id, project_id),
				KEY section_id (section_id),
				KEY parent_task_id (parent_task_id),
				KEY status (status)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$notes} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				task_id bigint(20) unsigned NOT NULL,
				payload_json longtext NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY team_task (team_id, task_id)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$files} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				team_id bigint(20) unsigned NOT NULL,
				task_id bigint(20) unsigned NOT NULL,
				storage_path varchar(512) NOT NULL,
				payload_json longtext NOT NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				KEY team_task (team_id, task_id)
			) {$charset};"
		);
	}

	/**
	 * @param array<string,mixed> $payload
	 */
	public static function encode_payload( array $payload ): string {
		$keyword = isset( $payload['keyword'] ) ? (string) $payload['keyword'] : '';
		$ordered = array( 'keyword' => $keyword );
		foreach ( $payload as $key => $value ) {
			if ( $key === 'keyword' ) {
				continue;
			}
			$ordered[ $key ] = $value;
		}
		$json = wp_json_encode( $ordered, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		return is_string( $json ) ? $json : '{}';
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function decode_payload( ?string $json ): array {
		if ( ! is_string( $json ) || $json === '' ) {
			return array();
		}
		$data = json_decode( $json, true );
		return is_array( $data ) ? $data : array();
	}

	public static function is_active_member( array $member ): bool {
		return (string) ( $member['status'] ?? '' ) === 'active';
	}

	public static function templates_path( int $team_id ): string {
		return Flowbie_App_Data_Paths::subdir( 'teams/' . (string) $team_id ) . '/task-templates.json';
	}

	public static function tags_path( int $team_id ): string {
		return Flowbie_App_Data_Paths::subdir( 'teams/' . (string) $team_id ) . '/task-tags.json';
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function default_tags(): array {
		return array(
			array( 'keyword' => 'annual', 'kind' => 'tag', 'name' => 'Annual project', 'color' => '#7c3aed' ),
			array( 'keyword' => 'customer', 'kind' => 'tag', 'name' => 'Customer', 'color' => '#0891b2' ),
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_tags( int $team_id ): array {
		$data = Flowbie_App_Json_File_Store::read( self::tags_path( $team_id ) );
		if ( ! is_array( $data ) || ! isset( $data['tags'] ) || ! is_array( $data['tags'] ) ) {
			return self::default_tags();
		}
		return $data['tags'];
	}

	/**
	 * @param array<int,array<string,mixed>> $tags
	 */
	public static function save_tags( int $team_id, array $tags ): bool {
		return Flowbie_App_Json_File_Store::write(
			self::tags_path( $team_id ),
			array(
				'tags'      => $tags,
				'updatedAt' => gmdate( 'c' ),
			)
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function default_templates(): array {
		return array(
			array(
				'keyword'      => 'seo-campaign',
				'kind'         => 'template',
				'name'         => 'SEO Campaign',
				'defaultTasks' => array(
					array( 'keyword' => 'kickoff', 'title' => 'Kickoff call', 'status' => 'todo' ),
					array( 'keyword' => 'audit', 'title' => 'Site audit', 'status' => 'todo' ),
					array( 'keyword' => 'content-plan', 'title' => 'Content plan', 'status' => 'todo' ),
				),
			),
			array(
				'keyword'      => 'client-onboarding',
				'kind'         => 'template',
				'name'         => 'Client Onboarding',
				'defaultTasks' => array(
					array( 'keyword' => 'access', 'title' => 'Collect site access', 'status' => 'todo' ),
					array( 'keyword' => 'brief', 'title' => 'Review client brief', 'status' => 'todo' ),
				),
			),
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_templates( int $team_id ): array {
		$path = self::templates_path( $team_id );
		$data = Flowbie_App_Json_File_Store::read( $path );
		if ( ! is_array( $data ) || ! isset( $data['templates'] ) || ! is_array( $data['templates'] ) ) {
			return self::default_templates();
		}
		return $data['templates'];
	}

	/**
	 * @param array<int,array<string,mixed>> $templates
	 */
	public static function save_templates( int $team_id, array $templates ): bool {
		return Flowbie_App_Json_File_Store::write(
			self::templates_path( $team_id ),
			array(
				'templates' => $templates,
				'updatedAt' => gmdate( 'c' ),
			)
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_projects( int $team_id, bool $include_archived = false ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_projects';
		$sql   = "SELECT * FROM {$table} WHERE team_id = %d";
		if ( ! $include_archived ) {
			$sql .= " AND archived_at IS NULL";
		}
		$sql .= ' ORDER BY sort_order ASC, id ASC';
		$rows  = $wpdb->get_results( $wpdb->prepare( $sql, $team_id ), ARRAY_A );
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_project( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function create_project( int $team_id, int $user_id, array $body ): ?array {
		$keyword = isset( $body['keyword'] ) ? sanitize_text_field( (string) $body['keyword'] ) : '';
		$title   = isset( $body['title'] ) ? sanitize_text_field( (string) $body['title'] ) : '';
		if ( $title === '' ) {
			return null;
		}
		if ( $keyword === '' ) {
			$keyword = sanitize_title( $title );
		}

		$payload = array(
			'keyword'     => $keyword,
			'kind'        => 'project',
			'title'       => $title,
			'description' => isset( $body['description'] ) ? sanitize_textarea_field( (string) $body['description'] ) : '',
			'status'      => 'active',
			'createdBy'   => $user_id,
		);

		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_projects';
		$wpdb->insert(
			$table,
			array(
				'team_id'      => $team_id,
				'payload_json' => self::encode_payload( $payload ),
				'status'       => 'active',
				'sort_order'   => 0,
			),
			array( '%d', '%s', '%s', '%d' )
		);
		$id = (int) $wpdb->insert_id;
		if ( $id <= 0 ) {
			return null;
		}

		$default_section = self::create_section(
			$team_id,
			$id,
			array(
				'keyword' => 'recently-assigned',
				'title'   => 'Recently assigned',
			)
		);
		$default_section_id = is_array( $default_section ) ? (int) $default_section['id'] : 0;

		if ( ! empty( $body['defaultTasks'] ) && is_array( $body['defaultTasks'] ) ) {
			foreach ( $body['defaultTasks'] as $idx => $task_def ) {
				if ( ! is_array( $task_def ) ) {
					continue;
				}
				self::create_task(
					$team_id,
					$id,
					$user_id,
					array_merge(
						$task_def,
						array(
							'sortOrder' => $idx,
							'sectionId' => $default_section_id,
						)
					)
				);
			}
		}

		return self::get_project( $team_id, $id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_project( int $team_id, int $project_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_projects';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d AND team_id = %d", $project_id, $team_id ),
			ARRAY_A
		);
		return is_array( $row ) ? self::format_project( $row ) : null;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function update_project( int $team_id, int $project_id, array $body ): ?array {
		$row = self::get_project_row( $team_id, $project_id );
		if ( ! $row ) {
			return null;
		}
		$payload = self::decode_payload( $row['payload_json'] );
		if ( isset( $body['keyword'] ) ) {
			$payload['keyword'] = sanitize_text_field( (string) $body['keyword'] );
		}
		if ( isset( $body['title'] ) ) {
			$payload['title'] = sanitize_text_field( (string) $body['title'] );
		}
		if ( isset( $body['description'] ) ) {
			$payload['description'] = sanitize_textarea_field( (string) $body['description'] );
		}

		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_projects';
		$wpdb->update(
			$table,
			array( 'payload_json' => self::encode_payload( $payload ), 'updated_at' => gmdate( 'Y-m-d H:i:s' ) ),
			array( 'id' => $project_id, 'team_id' => $team_id ),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);
		return self::get_project( $team_id, $project_id );
	}

	public static function archive_project( int $team_id, int $project_id ): bool {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_projects';
		$n     = $wpdb->update(
			$table,
			array( 'archived_at' => gmdate( 'Y-m-d H:i:s' ), 'status' => 'archived' ),
			array( 'id' => $project_id, 'team_id' => $team_id ),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);
		return $n !== false;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_tasks( int $team_id, int $project_id, bool $top_level_only = true ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_tasks';
		$sql   = "SELECT * FROM {$table} WHERE team_id = %d AND project_id = %d";
		if ( $top_level_only ) {
			$sql .= ' AND parent_task_id = 0';
		}
		$sql .= ' ORDER BY sort_order ASC, id ASC';
		$rows  = $wpdb->get_results( $wpdb->prepare( $sql, $team_id, $project_id ), ARRAY_A );
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_task( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function create_task( int $team_id, int $project_id, int $user_id, array $body ): ?array {
		if ( ! self::get_project_row( $team_id, $project_id ) ) {
			return null;
		}

		$keyword = isset( $body['keyword'] ) ? sanitize_text_field( (string) $body['keyword'] ) : '';
		$title   = isset( $body['title'] ) ? sanitize_text_field( (string) $body['title'] ) : '';
		if ( $title === '' ) {
			return null;
		}
		if ( $keyword === '' ) {
			$keyword = sanitize_title( $title );
		}

		$status = isset( $body['status'] ) ? sanitize_text_field( (string) $body['status'] ) : 'todo';
		if ( ! in_array( $status, self::STATUSES, true ) ) {
			$status = 'todo';
		}

		$assignee_ids = array();
		if ( ! empty( $body['assigneeIds'] ) && is_array( $body['assigneeIds'] ) ) {
			foreach ( $body['assigneeIds'] as $uid ) {
				$uid = (int) $uid;
				if ( $uid > 0 ) {
					$assignee_ids[] = $uid;
				}
			}
		}

		$tag_ids = array();
		if ( ! empty( $body['tagIds'] ) && is_array( $body['tagIds'] ) ) {
			foreach ( $body['tagIds'] as $tag ) {
				$tag = sanitize_text_field( (string) $tag );
				if ( $tag !== '' ) {
					$tag_ids[] = $tag;
				}
			}
		}

		$section_id     = isset( $body['sectionId'] ) ? (int) $body['sectionId'] : 0;
		$parent_task_id = isset( $body['parentTaskId'] ) ? (int) $body['parentTaskId'] : 0;

		$payload = array(
			'keyword'      => $keyword,
			'kind'         => 'task',
			'title'        => $title,
			'status'       => $status,
			'assigneeIds'  => $assignee_ids,
			'tagIds'       => $tag_ids,
			'description'  => isset( $body['description'] ) ? sanitize_textarea_field( (string) $body['description'] ) : '',
			'dueDate'      => isset( $body['dueDate'] ) ? sanitize_text_field( (string) $body['dueDate'] ) : '',
			'createdBy'    => $user_id,
		);

		$sort_order = isset( $body['sortOrder'] ) ? (int) $body['sortOrder'] : 0;
		$completed  = $status === 'done' ? gmdate( 'Y-m-d H:i:s' ) : null;

		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_tasks';
		$wpdb->insert(
			$table,
			array(
				'team_id'        => $team_id,
				'project_id'     => $project_id,
				'section_id'     => $section_id,
				'parent_task_id' => $parent_task_id,
				'payload_json'   => self::encode_payload( $payload ),
				'status'         => $status,
				'sort_order'     => $sort_order,
				'completed_at'   => $completed,
			),
			array( '%d', '%d', '%d', '%d', '%s', '%s', '%d', '%s' )
		);
		$id = (int) $wpdb->insert_id;
		return $id > 0 ? self::get_task( $team_id, $id ) : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_task( int $team_id, int $task_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_tasks';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d AND team_id = %d", $task_id, $team_id ),
			ARRAY_A
		);
		return is_array( $row ) ? self::format_task( $row ) : null;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function update_task( int $team_id, int $task_id, array $body ): ?array {
		$row = self::get_task_row( $team_id, $task_id );
		if ( ! $row ) {
			return null;
		}
		$payload = self::decode_payload( $row['payload_json'] );
		$status  = (string) $row['status'];

		if ( isset( $body['keyword'] ) ) {
			$payload['keyword'] = sanitize_text_field( (string) $body['keyword'] );
		}
		if ( isset( $body['title'] ) ) {
			$payload['title'] = sanitize_text_field( (string) $body['title'] );
		}
		if ( isset( $body['description'] ) ) {
			$payload['description'] = sanitize_textarea_field( (string) $body['description'] );
		}
		if ( isset( $body['dueDate'] ) ) {
			$payload['dueDate'] = sanitize_text_field( (string) $body['dueDate'] );
		}
		if ( isset( $body['assigneeIds'] ) && is_array( $body['assigneeIds'] ) ) {
			$assignee_ids = array();
			foreach ( $body['assigneeIds'] as $uid ) {
				$uid = (int) $uid;
				if ( $uid > 0 ) {
					$assignee_ids[] = $uid;
				}
			}
			$payload['assigneeIds'] = $assignee_ids;
		}
		if ( isset( $body['tagIds'] ) && is_array( $body['tagIds'] ) ) {
			$tag_ids = array();
			foreach ( $body['tagIds'] as $tag ) {
				$tag = sanitize_text_field( (string) $tag );
				if ( $tag !== '' ) {
					$tag_ids[] = $tag;
				}
			}
			$payload['tagIds'] = $tag_ids;
		}
		if ( isset( $body['sectionId'] ) ) {
			$section_id = (int) $body['sectionId'];
		} else {
			$section_id = (int) ( $row['section_id'] ?? 0 );
		}
		if ( isset( $body['sortOrder'] ) ) {
			$sort_order = (int) $body['sortOrder'];
		} else {
			$sort_order = (int) ( $row['sort_order'] ?? 0 );
		}
		if ( isset( $body['status'] ) ) {
			$new_status = sanitize_text_field( (string) $body['status'] );
			if ( in_array( $new_status, self::STATUSES, true ) ) {
				$status           = $new_status;
				$payload['status'] = $new_status;
			}
		}

		$completed = $status === 'done' ? gmdate( 'Y-m-d H:i:s' ) : null;

		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_tasks';
		$wpdb->update(
			$table,
			array(
				'payload_json' => self::encode_payload( $payload ),
				'status'       => $status,
				'section_id'   => $section_id,
				'sort_order'   => $sort_order,
				'completed_at' => $completed,
				'updated_at'   => gmdate( 'Y-m-d H:i:s' ),
			),
			array( 'id' => $task_id, 'team_id' => $team_id ),
			array( '%s', '%s', '%d', '%d', '%s', '%s' ),
			array( '%d', '%d' )
		);
		return self::get_task( $team_id, $task_id );
	}

	public static function delete_task( int $team_id, int $task_id ): bool {
		global $wpdb;
		$tasks = $wpdb->prefix . 'flowbie_team_tasks';
		$notes = $wpdb->prefix . 'flowbie_team_task_notes';
		$files = $wpdb->prefix . 'flowbie_team_task_files';

		$file_rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT storage_path FROM {$files} WHERE team_id = %d AND task_id = %d", $team_id, $task_id ),
			ARRAY_A
		);
		if ( is_array( $file_rows ) ) {
			foreach ( $file_rows as $fr ) {
				$rel = (string) ( $fr['storage_path'] ?? '' );
				if ( $rel !== '' ) {
					$abs = Flowbie_App_Data_Paths::root() . '/' . ltrim( $rel, '/' );
					wp_delete_file( $abs );
				}
			}
		}

		$wpdb->delete( $notes, array( 'team_id' => $team_id, 'task_id' => $task_id ), array( '%d', '%d' ) );
		$wpdb->delete( $files, array( 'team_id' => $team_id, 'task_id' => $task_id ), array( '%d', '%d' ) );
		$n = $wpdb->delete( $tasks, array( 'id' => $task_id, 'team_id' => $team_id ), array( '%d', '%d' ) );
		return $n !== false && $n > 0;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_notes( int $team_id, int $task_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_notes';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND task_id = %d ORDER BY id ASC",
				$team_id,
				$task_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_note( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function add_note( int $team_id, int $task_id, int $user_id, array $body ): ?array {
		if ( ! self::get_task_row( $team_id, $task_id ) ) {
			return null;
		}
		$body_text = isset( $body['body'] ) ? sanitize_textarea_field( (string) $body['body'] ) : '';
		if ( $body_text === '' ) {
			return null;
		}
		$keyword = isset( $body['keyword'] ) ? sanitize_text_field( (string) $body['keyword'] ) : 'note';
		$mention_ids = array();
		if ( ! empty( $body['mentionUserIds'] ) && is_array( $body['mentionUserIds'] ) ) {
			foreach ( $body['mentionUserIds'] as $uid ) {
				$uid = (int) $uid;
				if ( $uid > 0 ) {
					$mention_ids[] = $uid;
				}
			}
		}
		$payload = array(
			'keyword'         => $keyword,
			'kind'            => 'note',
			'body'            => $body_text,
			'authorId'        => $user_id,
			'mentionUserIds'  => $mention_ids,
		);

		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_notes';
		$wpdb->insert(
			$table,
			array(
				'team_id'      => $team_id,
				'task_id'      => $task_id,
				'payload_json' => self::encode_payload( $payload ),
			),
			array( '%d', '%d', '%s' )
		);
		$id = (int) $wpdb->insert_id;
		if ( $id <= 0 ) {
			return null;
		}
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A );
		return is_array( $row ) ? self::format_note( $row ) : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function get_project_row( int $team_id, int $project_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_projects';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d AND team_id = %d", $project_id, $team_id ),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function get_task_row( int $team_id, int $task_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_tasks';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d AND team_id = %d", $task_id, $team_id ),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_project( array $row ): ?array {
		$payload = self::decode_payload( $row['payload_json'] ?? '' );
		return array(
			'id'         => (int) $row['id'],
			'teamId'     => (int) $row['team_id'],
			'status'     => (string) $row['status'],
			'sortOrder'  => (int) $row['sort_order'],
			'createdAt'  => (string) $row['created_at'],
			'updatedAt'  => (string) $row['updated_at'],
			'archivedAt' => $row['archived_at'],
			'payload'    => $payload,
			'keyword'    => (string) ( $payload['keyword'] ?? '' ),
			'title'      => (string) ( $payload['title'] ?? '' ),
			'description'=> (string) ( $payload['description'] ?? '' ),
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_task( array $row ): ?array {
		$payload = self::decode_payload( $row['payload_json'] ?? '' );
		$project = self::get_project( (int) $row['team_id'], (int) $row['project_id'] );
		return array(
			'id'           => (int) $row['id'],
			'teamId'       => (int) $row['team_id'],
			'projectId'    => (int) $row['project_id'],
			'sectionId'    => (int) ( $row['section_id'] ?? 0 ),
			'parentTaskId' => (int) ( $row['parent_task_id'] ?? 0 ),
			'status'       => (string) $row['status'],
			'sortOrder'    => (int) $row['sort_order'],
			'completedAt'  => $row['completed_at'],
			'createdAt'    => (string) $row['created_at'],
			'updatedAt'    => (string) $row['updated_at'],
			'payload'      => $payload,
			'keyword'      => (string) ( $payload['keyword'] ?? '' ),
			'title'        => (string) ( $payload['title'] ?? '' ),
			'description'  => (string) ( $payload['description'] ?? '' ),
			'dueDate'      => (string) ( $payload['dueDate'] ?? '' ),
			'assigneeIds'  => is_array( $payload['assigneeIds'] ?? null ) ? array_map( 'intval', $payload['assigneeIds'] ) : array(),
			'tagIds'       => is_array( $payload['tagIds'] ?? null ) ? array_map( 'strval', $payload['tagIds'] ) : array(),
			'projectTitle' => is_array( $project ) ? (string) ( $project['title'] ?? '' ) : '',
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_note( array $row ): ?array {
		$payload = self::decode_payload( $row['payload_json'] ?? '' );
		return array(
			'id'        => (int) $row['id'],
			'teamId'    => (int) $row['team_id'],
			'taskId'    => (int) $row['task_id'],
			'createdAt' => (string) $row['created_at'],
			'payload'   => $payload,
			'body'      => (string) ( $payload['body'] ?? '' ),
			'authorId'       => (int) ( $payload['authorId'] ?? 0 ),
			'keyword'        => (string) ( $payload['keyword'] ?? '' ),
			'mentionUserIds' => is_array( $payload['mentionUserIds'] ?? null ) ? array_map( 'intval', $payload['mentionUserIds'] ) : array(),
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	public static function format_file( array $row ): ?array {
		$payload = self::decode_payload( $row['payload_json'] ?? '' );
		return array(
			'id'          => (int) $row['id'],
			'teamId'      => (int) $row['team_id'],
			'taskId'      => (int) $row['task_id'],
			'storagePath' => (string) $row['storage_path'],
			'createdAt'   => (string) $row['created_at'],
			'payload'     => $payload,
			'fileName'    => (string) ( $payload['fileName'] ?? '' ),
			'mime'        => (string) ( $payload['mime'] ?? '' ),
			'uploadedBy'  => (int) ( $payload['uploadedBy'] ?? 0 ),
			'keyword'     => (string) ( $payload['keyword'] ?? '' ),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function create_section( int $team_id, int $project_id, array $body ): ?array {
		if ( ! self::get_project_row( $team_id, $project_id ) ) {
			return null;
		}
		$keyword = isset( $body['keyword'] ) ? sanitize_text_field( (string) $body['keyword'] ) : '';
		$title   = isset( $body['title'] ) ? sanitize_text_field( (string) $body['title'] ) : '';
		if ( $title === '' ) {
			return null;
		}
		if ( $keyword === '' ) {
			$keyword = sanitize_title( $title );
		}
		$payload = array(
			'keyword' => $keyword,
			'kind'    => 'section',
			'title'   => $title,
		);
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_sections';
		$wpdb->insert(
			$table,
			array(
				'team_id'      => $team_id,
				'project_id'   => $project_id,
				'payload_json' => self::encode_payload( $payload ),
				'sort_order'   => isset( $body['sortOrder'] ) ? (int) $body['sortOrder'] : 0,
			),
			array( '%d', '%d', '%s', '%d' )
		);
		$id = (int) $wpdb->insert_id;
		return $id > 0 ? self::get_section( $team_id, $id ) : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_section( int $team_id, int $section_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_sections';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d AND team_id = %d", $section_id, $team_id ),
			ARRAY_A
		);
		return is_array( $row ) ? self::format_section( $row ) : null;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_sections( int $team_id, int $project_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_sections';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND project_id = %d ORDER BY sort_order ASC, id ASC",
				$team_id,
				$project_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_section( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function update_section( int $team_id, int $section_id, array $body ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_task_sections';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d AND team_id = %d", $section_id, $team_id ),
			ARRAY_A
		);
		if ( ! is_array( $row ) ) {
			return null;
		}
		$payload = self::decode_payload( $row['payload_json'] );
		if ( isset( $body['title'] ) ) {
			$payload['title'] = sanitize_text_field( (string) $body['title'] );
		}
		if ( isset( $body['keyword'] ) ) {
			$payload['keyword'] = sanitize_text_field( (string) $body['keyword'] );
		}
		$sort_order = isset( $body['sortOrder'] ) ? (int) $body['sortOrder'] : (int) $row['sort_order'];
		$wpdb->update(
			$table,
			array(
				'payload_json' => self::encode_payload( $payload ),
				'sort_order'   => $sort_order,
			),
			array( 'id' => $section_id, 'team_id' => $team_id ),
			array( '%s', '%d' ),
			array( '%d', '%d' )
		);
		return self::get_section( $team_id, $section_id );
	}

	public static function delete_section( int $team_id, int $section_id ): bool {
		global $wpdb;
		$tasks_table = $wpdb->prefix . 'flowbie_team_tasks';
		$table       = $wpdb->prefix . 'flowbie_team_task_sections';

		$parent_rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id FROM {$tasks_table} WHERE team_id = %d AND section_id = %d AND parent_task_id = 0",
				$team_id,
				$section_id
			),
			ARRAY_A
		);
		if ( is_array( $parent_rows ) ) {
			foreach ( $parent_rows as $row ) {
				$task_id = (int) ( $row['id'] ?? 0 );
				if ( $task_id <= 0 ) {
					continue;
				}
				$subtasks = self::list_subtasks( $team_id, $task_id );
				foreach ( $subtasks as $sub ) {
					self::delete_task( $team_id, (int) $sub['id'] );
				}
				self::delete_task( $team_id, $task_id );
			}
		}

		$remaining = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT id FROM {$tasks_table} WHERE team_id = %d AND section_id = %d",
				$team_id,
				$section_id
			)
		);
		if ( is_array( $remaining ) ) {
			foreach ( $remaining as $task_id ) {
				self::delete_task( $team_id, (int) $task_id );
			}
		}

		$n = $wpdb->delete( $table, array( 'id' => $section_id, 'team_id' => $team_id ), array( '%d', '%d' ) );
		return $n !== false && $n > 0;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_section( array $row ): ?array {
		$payload = self::decode_payload( $row['payload_json'] ?? '' );
		return array(
			'id'        => (int) $row['id'],
			'teamId'    => (int) $row['team_id'],
			'projectId' => (int) $row['project_id'],
			'sortOrder' => (int) $row['sort_order'],
			'createdAt' => (string) $row['created_at'],
			'payload'   => $payload,
			'keyword'   => (string) ( $payload['keyword'] ?? '' ),
			'title'     => (string) ( $payload['title'] ?? '' ),
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_my_tasks( int $team_id, int $user_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_tasks';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND parent_task_id = 0 ORDER BY sort_order ASC, id ASC",
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_task( $row );
			if ( ! $formatted ) {
				continue;
			}
			$assignees = $formatted['assigneeIds'];
			if ( ! in_array( $user_id, $assignees, true ) ) {
				continue;
			}
			$out[] = $formatted;
		}
		return $out;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function search_tasks( int $team_id, string $query ): array {
		$query = trim( $query );
		if ( $query === '' ) {
			return array();
		}
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_tasks';
		$like  = '%' . $wpdb->esc_like( $query ) . '%';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND parent_task_id = 0 AND payload_json LIKE %s ORDER BY id DESC LIMIT 100",
				$team_id,
				$like
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_task( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_subtasks( int $team_id, int $parent_task_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_tasks';
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE team_id = %d AND parent_task_id = %d ORDER BY sort_order ASC, id ASC",
				$team_id,
				$parent_task_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_task( $row );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_project_files( int $team_id, int $project_id ): array {
		global $wpdb;
		$tasks_table = $wpdb->prefix . 'flowbie_team_tasks';
		$files_table = $wpdb->prefix . 'flowbie_team_task_files';
		$rows        = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT f.* FROM {$files_table} f
				INNER JOIN {$tasks_table} t ON t.id = f.task_id AND t.team_id = f.team_id
				WHERE f.team_id = %d AND t.project_id = %d
				ORDER BY f.id DESC",
				$team_id,
				$project_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$formatted = self::format_file( $row );
			if ( $formatted ) {
				$task = self::get_task( $team_id, (int) $row['task_id'] );
				if ( $task ) {
					$formatted['taskTitle'] = (string) $task['title'];
				}
				$out[] = $formatted;
			}
		}
		return $out;
	}

	/**
	 * @return int
	 */
	public static function count_completed_today( int $team_id ): int {
		global $wpdb;
		$table = $wpdb->prefix . 'flowbie_team_tasks';
		$today = gmdate( 'Y-m-d' );
		$count = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE team_id = %d AND status = 'done' AND DATE(completed_at) = %s",
				$team_id,
				$today
			)
		);
		return is_numeric( $count ) ? (int) $count : 0;
	}
}
