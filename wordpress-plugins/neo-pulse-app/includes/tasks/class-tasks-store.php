<?php
/**
 * Team tasks DB schema and data access.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Tasks_Store {

	const STATUSES = array( 'todo', 'in_progress', 'done' );

	const RECURRENCE_RULES = array( 'none', 'daily', 'weekly', 'monthly', 'yearly' );

	const EXECUTION_KINDS = array( 'content_optimizer', 'content_optimizer_meta', 'gsc_reporting', 'post_creator' );
	const EXECUTION_TARGET_BUCKETS = array( 'pages', 'posts', 'sap', 'all' );
	const SCHEDULE_MODES = array( 'calendar', 'trigger' );
	const TRIGGER_SOURCES = array( 'gsc', 'schedule', 'ga', 'semrush' );
	const TRIGGER_SIGNALS = array(
		'position_drop',
		'ctr_drop',
		'impressions_up_ctr_down',
		'clicks_drop',
		'quick_win_slipped',
	);
	const TRIGGER_MATCH_MODES = array( 'any', 'all' );

	public static function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset  = $wpdb->get_charset_collate();
		$projects = $wpdb->prefix . 'neo_pulse_team_task_projects';
		$tasks    = $wpdb->prefix . 'neo_pulse_team_tasks';
		$sections = $wpdb->prefix . 'neo_pulse_team_task_sections';
		$notes    = $wpdb->prefix . 'neo_pulse_team_task_notes';
		$files    = $wpdb->prefix . 'neo_pulse_team_task_files';

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
		return Neo_Pulse_App_Data_Paths::subdir( 'teams/' . (string) $team_id ) . '/task-templates.json';
	}

	public static function tags_path( int $team_id ): string {
		return Neo_Pulse_App_Data_Paths::subdir( 'teams/' . (string) $team_id ) . '/task-tags.json';
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
		$data = Neo_Pulse_App_Json_File_Store::read( self::tags_path( $team_id ) );
		if ( ! is_array( $data ) || ! isset( $data['tags'] ) || ! is_array( $data['tags'] ) ) {
			return self::default_tags();
		}
		return $data['tags'];
	}

	/**
	 * @param array<int,array<string,mixed>> $tags
	 */
	public static function save_tags( int $team_id, array $tags ): bool {
		return Neo_Pulse_App_Json_File_Store::write(
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
		$regular = array(
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

		if ( class_exists( 'Neo_Pulse_App_Automation_Recipe_Registry' ) ) {
			return array_merge( $regular, Neo_Pulse_App_Automation_Recipe_Registry::as_task_templates() );
		}

		return $regular;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_templates( int $team_id ): array {
		$path = self::templates_path( $team_id );
		$data = Neo_Pulse_App_Json_File_Store::read( $path );
		$stored = ( is_array( $data ) && isset( $data['templates'] ) && is_array( $data['templates'] ) )
			? $data['templates']
			: array();
		if ( count( $stored ) === 0 ) {
			return self::default_templates();
		}
		return self::merge_builtin_templates( $stored );
	}

	/**
	 * @param array<int,array<string,mixed>> $stored
	 * @return array<int,array<string,mixed>>
	 */
	private static function merge_builtin_templates( array $stored ): array {
		$keywords = array();
		foreach ( $stored as $template ) {
			if ( is_array( $template ) ) {
				$keywords[ sanitize_title( (string) ( $template['keyword'] ?? '' ) ) ] = true;
			}
		}
		$merged = $stored;
		foreach ( self::default_templates() as $builtin ) {
			$kw = sanitize_title( (string) ( $builtin['keyword'] ?? '' ) );
			if ( $kw === '' || isset( $keywords[ $kw ] ) ) {
				continue;
			}
			$merged[] = $builtin;
		}
		return $merged;
	}

	/**
	 * @param array<int,array<string,mixed>> $templates
	 */
	public static function save_templates( int $team_id, array $templates ): bool {
		return Neo_Pulse_App_Json_File_Store::write(
			self::templates_path( $team_id ),
			array(
				'templates' => $templates,
				'updatedAt' => gmdate( 'c' ),
			)
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_template_by_keyword( int $team_id, string $keyword ): ?array {
		$keyword = sanitize_title( $keyword );
		if ( $keyword === '' ) {
			return null;
		}
		if ( class_exists( 'Neo_Pulse_App_Automation_Recipe_Registry' ) ) {
			$recipe = Neo_Pulse_App_Automation_Recipe_Registry::get_by_keyword( $keyword );
			if ( is_array( $recipe ) ) {
				return array(
					'keyword'      => (string) $recipe['keyword'],
					'kind'         => 'template',
					'name'         => (string) $recipe['name'],
					'defaultTasks' => is_array( $recipe['defaultTasks'] ?? null ) ? $recipe['defaultTasks'] : array(),
				);
			}
		}
		foreach ( self::list_templates( $team_id ) as $template ) {
			if ( ! is_array( $template ) ) {
				continue;
			}
			if ( sanitize_title( (string) ( $template['keyword'] ?? '' ) ) === $keyword ) {
				return $template;
			}
		}
		return null;
	}

	/**
	 * @param array<string,mixed> $template
	 */
	public static function upsert_template( int $team_id, array $template ): bool {
		$keyword = sanitize_title( (string) ( $template['keyword'] ?? '' ) );
		$name    = sanitize_text_field( (string) ( $template['name'] ?? '' ) );
		if ( $keyword === '' || $name === '' ) {
			return false;
		}
		$default_tasks = array();
		if ( ! empty( $template['defaultTasks'] ) && is_array( $template['defaultTasks'] ) ) {
			foreach ( $template['defaultTasks'] as $task ) {
				if ( ! is_array( $task ) ) {
					continue;
				}
				$title = sanitize_text_field( (string) ( $task['title'] ?? '' ) );
				if ( $title === '' ) {
					continue;
				}
				$row = self::template_task_row_from_def( $team_id, $task );
				if ( ! empty( $task['clientSiteId'] ) ) {
					$row['clientSiteId'] = sanitize_text_field( (string) $task['clientSiteId'] );
				}
				$default_tasks[] = $row;
			}
		}
		$entry = array(
			'keyword'      => $keyword,
			'kind'         => 'template',
			'name'         => $name,
			'defaultTasks' => $default_tasks,
		);
		$templates = self::list_templates( $team_id );
		$found     = false;
		foreach ( $templates as $i => $existing ) {
			if ( ! is_array( $existing ) ) {
				continue;
			}
			if ( sanitize_title( (string) ( $existing['keyword'] ?? '' ) ) === $keyword ) {
				$templates[ $i ] = $entry;
				$found           = true;
				break;
			}
		}
		if ( ! $found ) {
			$templates[] = $entry;
		}
		return self::save_templates( $team_id, $templates );
	}

	public static function delete_template( int $team_id, string $keyword ): bool {
		$keyword   = sanitize_title( $keyword );
		$templates = self::list_templates( $team_id );
		$next      = array();
		$removed   = false;
		foreach ( $templates as $template ) {
			if ( ! is_array( $template ) ) {
				continue;
			}
			if ( sanitize_title( (string) ( $template['keyword'] ?? '' ) ) === $keyword ) {
				$removed = true;
				continue;
			}
			$next[] = $template;
		}
		if ( ! $removed ) {
			return false;
		}
		return self::save_templates( $team_id, $next );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function project_tasks_as_template( int $team_id, int $project_id, string $name, string $keyword ): ?array {
		$project = self::get_project( $team_id, $project_id );
		if ( ! $project ) {
			return null;
		}
		$name    = sanitize_text_field( $name );
		$keyword = sanitize_title( $keyword !== '' ? $keyword : $name );
		if ( $name === '' || $keyword === '' ) {
			return null;
		}
		$default_tasks = array();
		foreach ( self::list_tasks( $team_id, $project_id, true ) as $task ) {
			if ( ! is_array( $task ) ) {
				continue;
			}
			$title = trim( (string) ( $task['title'] ?? '' ) );
			if ( $title === '' ) {
				continue;
			}
			$row = array(
				'keyword' => sanitize_title( (string) ( $task['keyword'] ?? $title ) ),
				'title'   => $title,
				'status'  => in_array( (string) ( $task['status'] ?? 'todo' ), self::STATUSES, true ) ? (string) $task['status'] : 'todo',
			);
			$default_tasks[] = $row;
		}
		$template = array(
			'keyword'             => $keyword,
			'kind'                => 'template',
			'name'                => $name,
			'defaultTasks'        => $default_tasks,
			'defaultClientSiteId' => self::project_wordpress_site_id( $project ),
		);
		if ( ! self::upsert_template( $team_id, $template ) ) {
			return null;
		}
		return self::get_template_by_keyword( $team_id, $keyword );
	}

	private static function project_wordpress_site_id( ?array $project ): string {
		if ( ! is_array( $project ) ) {
			return '';
		}
		return trim( (string) ( $project['wordpressSiteId'] ?? '' ) );
	}

	public static function apply_client_to_task_title( string $title, string $client_name ): string {
		$title       = trim( $title );
		$client_name = trim( $client_name );
		if ( $title === '' || $client_name === '' ) {
			return $title;
		}
		if ( str_contains( $title, '{client}' ) ) {
			return str_replace( '{client}', $client_name, $title );
		}
		return $title . ' — ' . $client_name;
	}

	/**
	 * @param array<string,mixed> $body
	 */
	public static function resolve_site_display_name( array $body, string $site_id ): string {
		$site_id = trim( $site_id );
		if ( $site_id === '' ) {
			return '';
		}
		$sites = array();
		if ( ! empty( $body['wordpressSites'] ) && is_array( $body['wordpressSites'] ) ) {
			$sites = $body['wordpressSites'];
		} elseif ( ! empty( $body['team_context']['wordpressSites'] ) && is_array( $body['team_context']['wordpressSites'] ) ) {
			$sites = $body['team_context']['wordpressSites'];
		}
		foreach ( $sites as $site ) {
			if ( ! is_array( $site ) ) {
				continue;
			}
			if ( (string) ( $site['id'] ?? '' ) === $site_id ) {
				return trim( (string) ( $site['name'] ?? '' ) );
			}
		}
		return '';
	}

	/**
	 * @param array<int,array<string,mixed>> $task_clients
	 * @param array<string,mixed>            $body
	 * @return array<int,array<string,mixed>>
	 */
	public static function resolve_template_tasks( int $team_id, string $template_keyword, array $task_clients, array $body ): array {
		$template = self::get_template_by_keyword( $team_id, $template_keyword );
		if ( ! is_array( $template ) || empty( $template['defaultTasks'] ) || ! is_array( $template['defaultTasks'] ) ) {
			return array();
		}
		unset( $task_clients );
		$project_client = sanitize_text_field( (string) ( $body['wordpressSiteId'] ?? '' ) );
		$client_name    = $project_client !== '' ? self::resolve_site_display_name( $body, $project_client ) : '';
		$out            = array();
		foreach ( $template['defaultTasks'] as $task ) {
			if ( ! is_array( $task ) ) {
				continue;
			}
			$kw    = sanitize_title( (string) ( $task['keyword'] ?? '' ) );
			$title = sanitize_text_field( (string) ( $task['title'] ?? '' ) );
			if ( $title === '' ) {
				continue;
			}
			if ( $client_name !== '' ) {
				$title = self::apply_client_to_task_title( $title, $client_name );
			}
			$out[] = self::template_task_row_from_def(
				$team_id,
				array_merge(
					$task,
					array(
						'keyword' => $kw !== '' ? $kw : sanitize_title( $title ),
						'title'   => $title,
					)
				),
				''
			);
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<int,array<string,mixed>>
	 */
	private static function prepare_default_tasks_for_create( array $body ): array {
		$team_id = (int) ( $body['_teamId'] ?? 0 );
		if ( ! empty( $body['templateKeyword'] ) ) {
			$task_clients = isset( $body['taskClients'] ) && is_array( $body['taskClients'] ) ? $body['taskClients'] : array();
			return self::resolve_template_tasks( $team_id, (string) $body['templateKeyword'], $task_clients, $body );
		}
		if ( empty( $body['defaultTasks'] ) || ! is_array( $body['defaultTasks'] ) ) {
			return array();
		}
		$project_client = sanitize_text_field( (string) ( $body['wordpressSiteId'] ?? '' ) );
		$client_name    = $project_client !== '' ? self::resolve_site_display_name( $body, $project_client ) : '';
		$out            = array();
		foreach ( $body['defaultTasks'] as $task_def ) {
			if ( ! is_array( $task_def ) ) {
				continue;
			}
			$title = sanitize_text_field( (string) ( $task_def['title'] ?? '' ) );
			if ( $title === '' ) {
				continue;
			}
			if ( $client_name !== '' ) {
				$title = self::apply_client_to_task_title( $title, $client_name );
			}
			$out[] = self::template_task_row_from_def(
				$team_id,
				array_merge( $task_def, array( 'title' => $title ) ),
				''
			);
		}
		return $out;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_projects( int $team_id, bool $include_archived = false ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_projects';
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
		if ( ! empty( $body['wordpressSiteId'] ) ) {
			$payload['wordpressSiteId'] = sanitize_text_field( (string) $body['wordpressSiteId'] );
		}
		if ( ! empty( $body['isAutomation'] ) ) {
			$payload['isAutomation'] = true;
		} elseif ( ! empty( $body['templateKeyword'] ) && class_exists( 'Neo_Pulse_App_Automation_Recipe_Registry' ) ) {
			$tpl_kw = sanitize_title( (string) $body['templateKeyword'] );
			if ( Neo_Pulse_App_Automation_Recipe_Registry::is_automation_keyword( $tpl_kw ) ) {
				$payload['isAutomation'] = true;
			}
		}
		if ( ! empty( $body['sourceTemplateKeyword'] ) ) {
			$payload['sourceTemplateKeyword'] = sanitize_title( (string) $body['sourceTemplateKeyword'] );
		} elseif ( ! empty( $body['templateKeyword'] ) ) {
			$payload['sourceTemplateKeyword'] = sanitize_title( (string) $body['templateKeyword'] );
		}

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_projects';
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

		$body['_teamId']     = $team_id;
		$prepared_tasks      = self::prepare_default_tasks_for_create( $body );
		if ( count( $prepared_tasks ) > 0 ) {
			foreach ( $prepared_tasks as $idx => $task_def ) {
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
		$table = $wpdb->prefix . 'neo_pulse_team_task_projects';
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
		if ( array_key_exists( 'wordpressSiteId', $body ) ) {
			$payload['wordpressSiteId'] = sanitize_text_field( (string) $body['wordpressSiteId'] );
		}

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_projects';
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
		foreach ( self::list_tasks( $team_id, $project_id, false ) as $task ) {
			$task_id = (int) ( $task['id'] ?? 0 );
			if ( $task_id > 0 ) {
				self::delete_task( $team_id, $task_id );
			}
		}

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_task_projects';
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
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
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

		$assignee_ids = self::filter_team_assignee_ids(
			$team_id,
			is_array( $body['assigneeIds'] ?? null ) ? array_map( 'intval', $body['assigneeIds'] ) : array()
		);

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
			'dueDate'        => isset( $body['dueDate'] ) ? sanitize_text_field( (string) $body['dueDate'] ) : '',
			'dueTime'        => self::sanitize_due_time( $body['dueTime'] ?? '' ),
			'recurrenceRule' => self::sanitize_recurrence_rule( $body['recurrenceRule'] ?? 'none' ),
			'createdBy'      => $user_id,
		);
		if ( isset( $body['executionKind'] ) ) {
			$payload['executionKind'] = self::sanitize_execution_kind( $body['executionKind'] );
		}
		if ( isset( $body['executionPayload'] ) && is_array( $body['executionPayload'] ) ) {
			$payload['executionPayload'] = self::sanitize_execution_payload( $body['executionPayload'] );
		}
		if ( isset( $body['scheduleMode'] ) ) {
			$payload['scheduleMode'] = self::sanitize_schedule_mode( $body['scheduleMode'] );
		}
		if ( isset( $body['triggerConfig'] ) && is_array( $body['triggerConfig'] ) ) {
			$payload['triggerConfig'] = self::sanitize_trigger_config( $body['triggerConfig'] );
		}

		$sort_order = isset( $body['sortOrder'] ) ? (int) $body['sortOrder'] : 0;
		$completed  = $status === 'done' ? gmdate( 'Y-m-d H:i:s' ) : null;

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
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
		if ( $id <= 0 ) {
			return null;
		}
		$task = self::get_task( $team_id, $id );
		if ( is_array( $task ) && class_exists( 'Neo_Pulse_App_Tasks_Assignments' ) ) {
			Neo_Pulse_App_Tasks_Assignments::notify_new_assignees( $team_id, $user_id, $task, array() );
		}
		return $task;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_task( int $team_id, int $task_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
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
	public static function update_task( int $team_id, int $task_id, array $body, int $actor_user_id = 0 ): ?array {
		$row = self::get_task_row( $team_id, $task_id );
		if ( ! $row ) {
			return null;
		}
		$payload = self::decode_payload( $row['payload_json'] );
		$status  = (string) $row['status'];
		$previous_assignee_ids = is_array( $payload['assigneeIds'] ?? null )
			? array_map( 'intval', $payload['assigneeIds'] )
			: array();

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
		if ( array_key_exists( 'dueTime', $body ) ) {
			$payload['dueTime'] = self::sanitize_due_time( $body['dueTime'] );
		}
		if ( isset( $body['assigneeIds'] ) && is_array( $body['assigneeIds'] ) ) {
			$payload['assigneeIds'] = self::filter_team_assignee_ids(
				$team_id,
				array_map( 'intval', $body['assigneeIds'] )
			);
		}
		if ( isset( $body['recurrenceRule'] ) ) {
			$payload['recurrenceRule'] = self::sanitize_recurrence_rule( $body['recurrenceRule'] );
		}
		if ( isset( $body['executionKind'] ) ) {
			$payload['executionKind'] = self::sanitize_execution_kind( $body['executionKind'] );
		}
		if ( isset( $body['executionPayload'] ) && is_array( $body['executionPayload'] ) ) {
			$payload['executionPayload'] = self::sanitize_execution_payload( $body['executionPayload'] );
		}
		if ( isset( $body['scheduleMode'] ) ) {
			$payload['scheduleMode'] = self::sanitize_schedule_mode( $body['scheduleMode'] );
		}
		if ( isset( $body['triggerConfig'] ) && is_array( $body['triggerConfig'] ) ) {
			$payload['triggerConfig'] = self::sanitize_trigger_config( $body['triggerConfig'] );
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
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
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
		$task = self::get_task( $team_id, $task_id );
		if ( is_array( $task ) && class_exists( 'Neo_Pulse_App_Tasks_Assignments' ) ) {
			Neo_Pulse_App_Tasks_Assignments::notify_new_assignees(
				$team_id,
				$actor_user_id,
				$task,
				$previous_assignee_ids
			);
		}
		return $task;
	}

	public static function delete_task( int $team_id, int $task_id ): bool {
		global $wpdb;
		$tasks = $wpdb->prefix . 'neo_pulse_team_tasks';
		$notes = $wpdb->prefix . 'neo_pulse_team_task_notes';
		$files = $wpdb->prefix . 'neo_pulse_team_task_files';

		$file_rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT storage_path FROM {$files} WHERE team_id = %d AND task_id = %d", $team_id, $task_id ),
			ARRAY_A
		);
		if ( is_array( $file_rows ) ) {
			foreach ( $file_rows as $fr ) {
				$rel = (string) ( $fr['storage_path'] ?? '' );
				if ( $rel !== '' ) {
					$abs = Neo_Pulse_App_Data_Paths::root() . '/' . ltrim( $rel, '/' );
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
		$table = $wpdb->prefix . 'neo_pulse_team_task_notes';
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
		$table = $wpdb->prefix . 'neo_pulse_team_task_notes';
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
		$table = $wpdb->prefix . 'neo_pulse_team_task_projects';
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
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
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
			'wordpressSiteId' => (string) ( $payload['wordpressSiteId'] ?? '' ),
			'isAutomation' => ! empty( $payload['isAutomation'] ),
			'sourceTemplateKeyword' => (string) ( $payload['sourceTemplateKeyword'] ?? '' ),
		);
	}

	/**
	 * @return array<int,string>
	 */
	private static function editorial_post_creator_recipe_keywords(): array {
		return array( 'monthly-post-creator', 'monthly-3-posts-editorial' );
	}

	/**
	 * @return array<int,string>
	 */
	private static function editorial_post_creator_task_keywords(): array {
		return array( 'monthly-post-creator-run', 'monthly-3-posts-run' );
	}

	/**
	 * @return array<int,string>
	 */
	private static function gsc_reporting_recipe_keywords(): array {
		return array( 'gsc-monthly-mom-report', 'gsc-monthly-yoy-report' );
	}

	/**
	 * @return array<int,string>
	 */
	private static function gsc_reporting_task_keywords(): array {
		return array( 'gsc-mom-report', 'gsc-yoy-report' );
	}

	/**
	 * @param string $recipe_keyword
	 * @return array<string,mixed>
	 */
	private static function default_gsc_reporting_payload_for_recipe( string $recipe_keyword ): array {
		return array(
			'comparePreset' => $recipe_keyword === 'gsc-monthly-yoy-report' ? 'yoy' : 'mom',
			'saveToDisk'    => true,
		);
	}

	/**
	 * @param array<string,mixed> $payload
	 * @return array<string,mixed>
	 */
	private static function ensure_gsc_reporting_payload( array $payload ): array {
		$preset = sanitize_key( (string) ( $payload['comparePreset'] ?? 'mom' ) );
		if ( ! in_array( $preset, array( 'mom', 'yoy' ), true ) ) {
			$preset = 'mom';
		}
		$payload['comparePreset'] = $preset;
		if ( ! isset( $payload['saveToDisk'] ) ) {
			$payload['saveToDisk'] = true;
		}
		return $payload;
	}

	/**
	 * @param string $recipe_keyword
	 * @return array<string,mixed>
	 */
	private static function default_post_creator_payload_for_recipe( string $recipe_keyword ): array {
		if ( $recipe_keyword === 'monthly-3-posts-editorial' ) {
			return array(
				'postCount'                => 3,
				'keywordSource'            => 'prompt',
				'featuredImage'            => true,
				'sitemapType'              => 'post',
				'postDestination'          => 'wordpress',
				'scheduleTimesPerMonth'    => 3,
				'scheduleStartDay'         => 1,
				'scheduleStartTime'        => '09:00',
				'scheduleStaggerOptimized' => true,
				'targetBucket'             => 'posts',
			);
		}

		return array(
			'postCount'                => 1,
			'keywordSource'            => 'prompt',
			'featuredImage'            => true,
			'sitemapType'              => 'post',
			'postDestination'          => 'wordpress',
			'scheduleTimesPerMonth'    => 1,
			'scheduleStartDay'         => 1,
			'scheduleStartTime'        => '09:00',
			'scheduleStaggerOptimized' => true,
			'targetBucket'             => 'posts',
		);
	}

	/**
	 * @param array<string,mixed> $raw
	 * @return array<string,mixed>
	 */
	public static function ensure_post_creator_payload( array $raw ): array {
		$defaults = self::default_post_creator_payload_for_recipe( 'monthly-post-creator' );
		$merged   = array_merge( $defaults, $raw );
		$out      = self::sanitize_execution_payload( $merged );
		$out['targetBucket'] = 'posts';
		$out['sitemapType']  = 'post';
		if ( ! isset( $out['postCount'] ) ) {
			$out['postCount'] = 1;
		}
		if ( ! isset( $out['scheduleTimesPerMonth'] ) ) {
			$out['scheduleTimesPerMonth'] = (int) $out['postCount'];
		}
		return $out;
	}

	/**
	 * @param array<string,mixed>      $task
	 * @param array<string,mixed>|null $project
	 * @return array<string,mixed>
	 */
	private static function normalize_post_creator_task( array $task, ?array $project ): array {
		$recipe_kw = '';
		if ( is_array( $project ) ) {
			$recipe_kw = sanitize_title( (string) ( $project['sourceTemplateKeyword'] ?? '' ) );
			if ( $recipe_kw === '' ) {
				$recipe_kw = sanitize_title( (string) ( $project['keyword'] ?? '' ) );
			}
		}
		$task_kw = sanitize_title( (string) ( $task['keyword'] ?? '' ) );
		$kind    = self::sanitize_execution_kind( $task['executionKind'] ?? '' );

		$is_editorial = in_array( $recipe_kw, self::editorial_post_creator_recipe_keywords(), true )
			|| in_array( $task_kw, self::editorial_post_creator_task_keywords(), true );

		if ( ! $is_editorial && $kind !== 'post_creator' ) {
			return $task;
		}

		$recipe_for_defaults = 'monthly-post-creator';
		if ( $recipe_kw === 'monthly-3-posts-editorial' || $task_kw === 'monthly-3-posts-run' ) {
			$recipe_for_defaults = 'monthly-3-posts-editorial';
		}

		$defaults = self::default_post_creator_payload_for_recipe( $recipe_for_defaults );
		$existing = is_array( $task['executionPayload'] ?? null ) ? $task['executionPayload'] : array();

		$task['executionKind']     = 'post_creator';
		$task['scheduleMode']      = 'calendar';
		$task['executionPayload']  = self::ensure_post_creator_payload( array_merge( $defaults, $existing ) );
		if ( (string) ( $task['recurrenceRule'] ?? 'none' ) === 'none' ) {
			$task['recurrenceRule'] = 'monthly';
		}
		$task['triggerConfig'] = null;

		return $task;
	}

	/**
	 * @param array<string,mixed>      $task
	 * @param array<string,mixed>|null $project
	 * @return array<string,mixed>
	 */
	private static function normalize_gsc_reporting_task( array $task, ?array $project ): array {
		$recipe_kw = '';
		if ( is_array( $project ) ) {
			$recipe_kw = sanitize_title( (string) ( $project['sourceTemplateKeyword'] ?? '' ) );
			if ( $recipe_kw === '' ) {
				$recipe_kw = sanitize_title( (string) ( $project['keyword'] ?? '' ) );
			}
		}
		$task_kw = sanitize_title( (string) ( $task['keyword'] ?? '' ) );
		$kind    = self::sanitize_execution_kind( $task['executionKind'] ?? '' );

		$is_gsc = in_array( $recipe_kw, self::gsc_reporting_recipe_keywords(), true )
			|| in_array( $task_kw, self::gsc_reporting_task_keywords(), true );

		if ( ! $is_gsc && $kind !== 'gsc_reporting' ) {
			return $task;
		}

		$recipe_for_defaults = 'gsc-monthly-mom-report';
		if ( $recipe_kw === 'gsc-monthly-yoy-report' || $task_kw === 'gsc-yoy-report' ) {
			$recipe_for_defaults = 'gsc-monthly-yoy-report';
		}

		$defaults = self::default_gsc_reporting_payload_for_recipe( $recipe_for_defaults );
		$existing = is_array( $task['executionPayload'] ?? null ) ? $task['executionPayload'] : array();

		$task['executionKind']    = 'gsc_reporting';
		$task['scheduleMode']       = 'calendar';
		$task['executionPayload']   = self::ensure_gsc_reporting_payload( array_merge( $defaults, $existing ) );
		if ( (string) ( $task['recurrenceRule'] ?? 'none' ) === 'none' ) {
			$task['recurrenceRule'] = 'monthly';
		}
		$task['triggerConfig'] = null;

		return $task;
	}

	/**
	 * @param array<string,mixed> $stored_payload
	 * @param array<string,mixed> $normalized_task
	 */
	private static function maybe_persist_gsc_reporting_task(
		int $team_id,
		int $task_id,
		array $stored_payload,
		array $normalized_task
	): void {
		if ( self::sanitize_execution_kind( $normalized_task['executionKind'] ?? '' ) !== 'gsc_reporting' ) {
			return;
		}
		$stored_kind    = self::sanitize_execution_kind( $stored_payload['executionKind'] ?? '' );
		$stored_mode    = self::sanitize_schedule_mode( $stored_payload['scheduleMode'] ?? 'calendar' );
		$stored_preset  = sanitize_key( (string) ( $stored_payload['executionPayload']['comparePreset'] ?? '' ) );
		$target_preset  = sanitize_key( (string) ( $normalized_task['executionPayload']['comparePreset'] ?? '' ) );
		if ( $stored_kind === 'gsc_reporting' && $stored_mode === 'calendar' && $stored_preset === $target_preset ) {
			return;
		}

		$stored_payload['executionKind']    = 'gsc_reporting';
		$stored_payload['scheduleMode']     = 'calendar';
		$stored_payload['executionPayload']   = $normalized_task['executionPayload'];
		if ( (string) ( $stored_payload['recurrenceRule'] ?? 'none' ) === 'none' ) {
			$stored_payload['recurrenceRule'] = 'monthly';
		}
		unset( $stored_payload['triggerConfig'] );

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
		$wpdb->update(
			$table,
			array(
				'payload_json' => self::encode_payload( $stored_payload ),
				'updated_at'   => gmdate( 'Y-m-d H:i:s' ),
			),
			array(
				'team_id' => $team_id,
				'id'      => $task_id,
			),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);
	}

	/**
	 * @param array<string,mixed> $stored_payload
	 * @param array<string,mixed> $normalized_task
	 */
	private static function maybe_persist_post_creator_task(
		int $team_id,
		int $task_id,
		array $stored_payload,
		array $normalized_task
	): void {
		if ( self::sanitize_execution_kind( $normalized_task['executionKind'] ?? '' ) !== 'post_creator' ) {
			return;
		}
		$stored_kind   = self::sanitize_execution_kind( $stored_payload['executionKind'] ?? '' );
		$stored_mode   = self::sanitize_schedule_mode( $stored_payload['scheduleMode'] ?? 'calendar' );
		$stored_bucket = self::sanitize_execution_target_bucket( $stored_payload['executionPayload']['targetBucket'] ?? '' );
		if ( $stored_kind === 'post_creator' && $stored_mode === 'calendar' && $stored_bucket === 'posts' ) {
			return;
		}

		$stored_payload['executionKind']     = 'post_creator';
		$stored_payload['scheduleMode']      = 'calendar';
		$stored_payload['executionPayload']  = $normalized_task['executionPayload'];
		if ( (string) ( $stored_payload['recurrenceRule'] ?? 'none' ) === 'none' ) {
			$stored_payload['recurrenceRule'] = 'monthly';
		}
		unset( $stored_payload['triggerConfig'] );

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
		$wpdb->update(
			$table,
			array(
				'payload_json' => self::encode_payload( $stored_payload ),
				'updated_at'   => gmdate( 'Y-m-d H:i:s' ),
			),
			array(
				'id'      => $task_id,
				'team_id' => $team_id,
			),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);
	}

	/**
	 * @param array<string,mixed>|null $project
	 */
	public static function project_is_automation( ?array $project ): bool {
		if ( ! is_array( $project ) ) {
			return false;
		}
		if ( ! empty( $project['isAutomation'] ) ) {
			return true;
		}
		$kw = sanitize_title( (string) ( $project['sourceTemplateKeyword'] ?? '' ) );
		if ( $kw === '' ) {
			$kw = sanitize_title( (string) ( $project['keyword'] ?? '' ) );
		}
		if ( $kw === '' ) {
			return false;
		}
		return class_exists( 'Neo_Pulse_App_Automation_Recipe_Registry' )
			&& Neo_Pulse_App_Automation_Recipe_Registry::is_automation_keyword( $kw );
	}

	/**
	 * @param array<string,mixed>      $task
	 * @param array<string,mixed>|null $project
	 * @return array<string,mixed>
	 */
	private static function normalize_automation_pulse_assignee(
		array $task,
		?array $project,
		int $team_id,
		int $task_id
	): array {
		if ( ! self::project_is_automation( $project ) ) {
			return $task;
		}
		$kind = self::sanitize_execution_kind( $task['executionKind'] ?? '' );
		if ( $kind === '' ) {
			return $task;
		}
		$pulse_id = self::pulse_bot_user_id();
		if ( $pulse_id <= 0 ) {
			return $task;
		}
		$assignees = isset( $task['assigneeIds'] ) && is_array( $task['assigneeIds'] )
			? array_map( 'intval', $task['assigneeIds'] )
			: array();
		if ( in_array( $pulse_id, $assignees, true ) ) {
			return $task;
		}
		$assignees[] = $pulse_id;
		$task['assigneeIds'] = $assignees;

		$row = self::get_task_row( $team_id, $task_id );
		if ( ! $row ) {
			return $task;
		}
		$payload = self::decode_payload( $row['payload_json'] );
		$payload['assigneeIds'] = $assignees;

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
		$wpdb->update(
			$table,
			array(
				'payload_json' => self::encode_payload( $payload ),
				'updated_at'   => gmdate( 'Y-m-d H:i:s' ),
			),
			array(
				'id'      => $task_id,
				'team_id' => $team_id,
			),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);

		return $task;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function format_task( array $row ): ?array {
		$payload = self::decode_payload( $row['payload_json'] ?? '' );
		$project = self::get_project( (int) $row['team_id'], (int) $row['project_id'] );
		$task    = array(
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
			'dueTime'      => self::sanitize_due_time( $payload['dueTime'] ?? '' ),
			'assigneeIds'  => is_array( $payload['assigneeIds'] ?? null ) ? array_map( 'intval', $payload['assigneeIds'] ) : array(),
			'tagIds'          => is_array( $payload['tagIds'] ?? null ) ? array_map( 'strval', $payload['tagIds'] ) : array(),
			'projectTitle'    => is_array( $project ) ? (string) ( $project['title'] ?? '' ) : '',
			'wordpressSiteId' => self::project_wordpress_site_id( $project ),
			'recurrenceRule'  => self::sanitize_recurrence_rule( $payload['recurrenceRule'] ?? 'none' ),
			'scheduleMode'    => self::sanitize_schedule_mode( $payload['scheduleMode'] ?? 'calendar' ),
			'triggerConfig'   => is_array( $payload['triggerConfig'] ?? null )
				? self::sanitize_trigger_config( $payload['triggerConfig'] )
				: null,
			'triggerMeta'     => is_array( $payload['triggerMeta'] ?? null )
				? self::sanitize_trigger_meta( $payload['triggerMeta'] )
				: null,
			'scheduleMeta'    => is_array( $payload['scheduleMeta'] ?? null ) ? $payload['scheduleMeta'] : null,
			'executionKind'   => self::sanitize_execution_kind( $payload['executionKind'] ?? '' ),
			'executionPayload'=> is_array( $payload['executionPayload'] ?? null )
				? self::sanitize_execution_payload( $payload['executionPayload'] )
				: array(),
			'lastExecutionId' => isset( $payload['lastExecutionId'] ) ? (int) $payload['lastExecutionId'] : null,
			'lastExecutionStatus' => isset( $payload['lastExecutionStatus'] )
				? sanitize_key( (string) $payload['lastExecutionStatus'] )
				: null,
		);
		$task = self::normalize_post_creator_task( $task, $project );
		self::maybe_persist_post_creator_task( (int) $row['team_id'], (int) $row['id'], $payload, $task );
		$task = self::normalize_gsc_reporting_task( $task, $project );
		self::maybe_persist_gsc_reporting_task( (int) $row['team_id'], (int) $row['id'], $payload, $task );
		$task = self::normalize_automation_pulse_assignee( $task, $project, (int) $row['team_id'], (int) $row['id'] );
		return $task;
	}

	/**
	 * @param mixed $raw
	 */
	public static function sanitize_execution_kind( $raw ): string {
		$kind = sanitize_key( (string) $raw );
		return in_array( $kind, self::EXECUTION_KINDS, true ) ? $kind : '';
	}

	/**
	 * @param mixed $raw
	 */
	public static function is_execution_target_all( $raw ): bool {
		return strtoupper( trim( (string) $raw ) ) === 'ALL';
	}

	/**
	 * @param mixed $raw
	 */
	public static function sanitize_execution_target_url( $raw ): string {
		$trimmed = trim( (string) $raw );
		if ( self::is_execution_target_all( $trimmed ) ) {
			return 'ALL';
		}
		return esc_url_raw( $trimmed );
	}

	/**
	 * @param mixed $raw
	 */
	public static function sanitize_execution_target_bucket( $raw ): string {
		$bucket = sanitize_key( (string) $raw );
		return in_array( $bucket, self::EXECUTION_TARGET_BUCKETS, true ) ? $bucket : '';
	}

	/**
	 * @param array<string,mixed> $raw
	 * @return array<string,mixed>
	 */
	public static function sanitize_execution_payload( array $raw ): array {
		$out = array();
		if ( ! empty( $raw['targetUrl'] ) ) {
			$out['targetUrl'] = self::sanitize_execution_target_url( $raw['targetUrl'] );
		}
		if ( ! empty( $raw['targetBucket'] ) ) {
			$out['targetBucket'] = self::sanitize_execution_target_bucket( $raw['targetBucket'] );
		}
		if ( isset( $raw['postId'] ) ) {
			$out['postId'] = (int) $raw['postId'];
		}
		$mode = sanitize_key( (string) ( $raw['updateMode'] ?? 'update' ) );
		$out['updateMode'] = $mode === 'draft' ? 'draft' : 'update';
		if ( isset( $raw['optimizationOptions'] ) && is_array( $raw['optimizationOptions'] ) ) {
			$opts = $raw['optimizationOptions'];
			$out['optimizationOptions'] = array(
				'optimizeTitle'          => ! empty( $opts['optimizeTitle'] ),
				'optimizeMeta'           => ! empty( $opts['optimizeMeta'] ),
				'optimizeExcerpt'        => ! empty( $opts['optimizeExcerpt'] ),
				'optimizeContent'        => ! empty( $opts['optimizeContent'] ),
				'optimizeFeaturedImage'  => ! empty( $opts['optimizeFeaturedImage'] ),
				'useAcfKeyword'          => ! isset( $opts['useAcfKeyword'] ) || ! empty( $opts['useAcfKeyword'] ),
				'testMode'               => ! empty( $opts['testMode'] ),
				'autoOptimize'           => ! empty( $opts['autoOptimize'] ),
			);
			if ( ! empty( $opts['manualKeyword'] ) ) {
				$out['optimizationOptions']['manualKeyword'] = sanitize_text_field( (string) $opts['manualKeyword'] );
			}
		}
		if ( ! empty( $raw['targetUrls'] ) && is_array( $raw['targetUrls'] ) ) {
			$urls = array();
			foreach ( $raw['targetUrls'] as $url ) {
				$url = esc_url_raw( (string) $url );
				if ( $url !== '' ) {
					$urls[] = $url;
				}
			}
			if ( count( $urls ) > 0 ) {
				$out['targetUrls'] = array_values( array_unique( $urls ) );
			}
		}
		if ( ! empty( $raw['comparePreset'] ) ) {
			$preset = sanitize_key( (string) $raw['comparePreset'] );
			$out['comparePreset'] = $preset === 'yoy' ? 'yoy' : 'mom';
		}
		if ( array_key_exists( 'saveToDisk', $raw ) ) {
			$out['saveToDisk'] = ! empty( $raw['saveToDisk'] );
		}
		if ( isset( $raw['postCount'] ) ) {
			$out['postCount'] = max( 1, min( 31, (int) $raw['postCount'] ) );
		}
		if ( ! empty( $raw['keywordSource'] ) ) {
			$src = sanitize_key( (string) $raw['keywordSource'] );
			$out['keywordSource'] = in_array( $src, array( 'prompt', 'gsc', 'manual' ), true ) ? $src : 'prompt';
		}
		if ( ! empty( $raw['optionalPrompt'] ) ) {
			$out['optionalPrompt'] = sanitize_text_field( (string) $raw['optionalPrompt'] );
		}
		if ( ! empty( $raw['entityMode'] ) ) {
			$mode = sanitize_key( (string) $raw['entityMode'] );
			$out['entityMode'] = in_array( $mode, array( 'auto', 'manual', 'blank' ), true ) ? $mode : 'blank';
		}
		if ( ! empty( $raw['entityValue'] ) ) {
			$out['entityValue'] = sanitize_text_field( (string) $raw['entityValue'] );
		}
		if ( ! empty( $raw['keywordValue'] ) ) {
			$out['keywordValue'] = sanitize_text_field( (string) $raw['keywordValue'] );
		}
		if ( ! empty( $raw['titleTemplate'] ) ) {
			$out['titleTemplate'] = sanitize_text_field( (string) $raw['titleTemplate'] );
		}
		if ( array_key_exists( 'featuredImage', $raw ) ) {
			$out['featuredImage'] = ! empty( $raw['featuredImage'] );
		}
		if ( ! empty( $raw['sitemapType'] ) ) {
			$st = sanitize_key( (string) $raw['sitemapType'] );
			$out['sitemapType'] = $st === 'entity' ? 'entity' : 'post';
		}
		if ( ! empty( $raw['postDestination'] ) ) {
			$pd = sanitize_key( (string) $raw['postDestination'] );
			$out['postDestination'] = in_array( $pd, array( 'wordpress', 'bank', 'draft' ), true ) ? $pd : 'wordpress';
		}
		if ( isset( $raw['scheduleTimesPerMonth'] ) ) {
			$out['scheduleTimesPerMonth'] = max( 1, min( 31, (int) $raw['scheduleTimesPerMonth'] ) );
		}
		if ( isset( $raw['scheduleStartDay'] ) ) {
			$out['scheduleStartDay'] = max( 1, min( 28, (int) $raw['scheduleStartDay'] ) );
		}
		if ( ! empty( $raw['scheduleStartTime'] ) ) {
			$time = sanitize_text_field( (string) $raw['scheduleStartTime'] );
			if ( preg_match( '/^\d{2}:\d{2}$/', $time ) ) {
				$out['scheduleStartTime'] = $time;
			}
		}
		if ( array_key_exists( 'scheduleStaggerOptimized', $raw ) ) {
			$out['scheduleStaggerOptimized'] = ! empty( $raw['scheduleStaggerOptimized'] );
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $task
	 */
	public static function task_has_pulse_assignee( array $task ): bool {
		$pulse_id = self::pulse_bot_user_id();
		if ( $pulse_id <= 0 ) {
			return false;
		}
		$assignees = isset( $task['assigneeIds'] ) && is_array( $task['assigneeIds'] )
			? array_map( 'intval', $task['assigneeIds'] )
			: array();
		return in_array( $pulse_id, $assignees, true );
	}

	/**
	 * @param array<string,mixed> $patch
	 * @return array<string,mixed>|null
	 */
	public static function patch_task_schedule_meta( int $team_id, int $task_id, array $patch ): ?array {
		$row = self::get_task_row( $team_id, $task_id );
		if ( ! $row ) {
			return null;
		}
		$payload = self::decode_payload( $row['payload_json'] );
		$meta    = is_array( $payload['scheduleMeta'] ?? null ) ? $payload['scheduleMeta'] : array();
		foreach ( $patch as $key => $value ) {
			$meta[ sanitize_key( (string) $key ) ] = is_scalar( $value ) ? (string) $value : wp_json_encode( $value );
		}
		$payload['scheduleMeta'] = $meta;

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
		$wpdb->update(
			$table,
			array(
				'payload_json' => self::encode_payload( $payload ),
				'updated_at'   => gmdate( 'Y-m-d H:i:s' ),
			),
			array( 'id' => $task_id, 'team_id' => $team_id ),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);
		return self::get_task( $team_id, $task_id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function patch_task_execution_meta( int $team_id, int $task_id, int $execution_id, string $status ): ?array {
		$row = self::get_task_row( $team_id, $task_id );
		if ( ! $row ) {
			return null;
		}
		$payload = self::decode_payload( $row['payload_json'] );
		$payload['lastExecutionId']     = $execution_id;
		$payload['lastExecutionStatus'] = sanitize_key( $status );

		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
		$wpdb->update(
			$table,
			array(
				'payload_json' => self::encode_payload( $payload ),
				'updated_at'   => gmdate( 'Y-m-d H:i:s' ),
			),
			array( 'id' => $task_id, 'team_id' => $team_id ),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);
		return self::get_task( $team_id, $task_id );
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
		$table = $wpdb->prefix . 'neo_pulse_team_task_sections';
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
		$table = $wpdb->prefix . 'neo_pulse_team_task_sections';
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
		$table = $wpdb->prefix . 'neo_pulse_team_task_sections';
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
		$table = $wpdb->prefix . 'neo_pulse_team_task_sections';
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
		$tasks_table = $wpdb->prefix . 'neo_pulse_team_tasks';
		$table       = $wpdb->prefix . 'neo_pulse_team_task_sections';

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
		$table    = $wpdb->prefix . 'neo_pulse_team_tasks';
		$projects = $wpdb->prefix . 'neo_pulse_team_task_projects';
		$rows     = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT t.* FROM {$table} t
				INNER JOIN {$projects} p ON p.id = t.project_id AND p.team_id = t.team_id
				WHERE t.team_id = %d AND t.parent_task_id = 0 AND p.archived_at IS NULL
				ORDER BY t.sort_order ASC, t.id ASC",
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out    = array();
		$seen   = array();
		$flo_id = self::pulse_bot_user_id();

		foreach ( $rows as $row ) {
			$formatted = self::format_task( $row );
			if ( ! $formatted ) {
				continue;
			}
			$id = (int) ( $formatted['id'] ?? 0 );
			if ( $id <= 0 ) {
				continue;
			}
			$assignees = $formatted['assigneeIds'];
			if ( ! in_array( $user_id, $assignees, true ) ) {
				continue;
			}
			$out[]        = $formatted;
			$seen[ $id ] = true;
		}

		if ( $flo_id > 0 ) {
			foreach ( $rows as $row ) {
				$formatted = self::format_task( $row );
				if ( ! $formatted ) {
					continue;
				}
				$id = (int) ( $formatted['id'] ?? 0 );
				if ( $id <= 0 || isset( $seen[ $id ] ) ) {
					continue;
				}
				$assignees = $formatted['assigneeIds'];
				if ( ! in_array( $flo_id, $assignees, true ) ) {
					continue;
				}
				$out[] = $formatted;
			}
		}

		return $out;
	}

	/**
	 * Tasks assigned to the Pulse AI bot user (read-only context for Assist).
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_pulse_assigned_tasks( int $team_id ): array {
		$flo_id = self::pulse_bot_user_id();
		if ( $flo_id <= 0 ) {
			return array();
		}
		$tasks = self::list_my_tasks( $team_id, $flo_id );
		$out   = array();
		foreach ( $tasks as $task ) {
			if ( ! is_array( $task ) ) {
				continue;
			}
			$desc = (string) ( $task['description'] ?? '' );
			if ( strlen( $desc ) > 240 ) {
				$desc = substr( $desc, 0, 237 ) . '...';
			}
			$out[] = array(
				'id'                  => (int) ( $task['id'] ?? 0 ),
				'title'               => (string) ( $task['title'] ?? '' ),
				'keyword'             => (string) ( $task['keyword'] ?? '' ),
				'projectId'           => (int) ( $task['projectId'] ?? 0 ),
				'projectTitle'        => (string) ( $task['projectTitle'] ?? '' ),
				'dueDate'             => (string) ( $task['dueDate'] ?? '' ),
				'dueTime'             => self::sanitize_due_time( $task['dueTime'] ?? '' ),
				'recurrenceRule'      => self::sanitize_recurrence_rule( $task['recurrenceRule'] ?? 'none' ),
				'scheduleMode'        => self::sanitize_schedule_mode( $task['scheduleMode'] ?? 'calendar' ),
				'triggerConfig'       => is_array( $task['triggerConfig'] ?? null )
					? self::sanitize_trigger_config( $task['triggerConfig'] )
					: null,
				'triggerMeta'         => is_array( $task['triggerMeta'] ?? null )
					? self::sanitize_trigger_meta( $task['triggerMeta'] )
					: null,
				'wordpressSiteId'     => (string) ( $task['wordpressSiteId'] ?? '' ),
				'status'              => (string) ( $task['status'] ?? 'todo' ),
				'description'         => $desc,
				'executionKind'       => self::sanitize_execution_kind( $task['executionKind'] ?? '' ),
				'executionPayload'    => is_array( $task['executionPayload'] ?? null )
					? self::sanitize_execution_payload( $task['executionPayload'] )
					: array(),
				'lastExecutionId'     => isset( $task['lastExecutionId'] ) ? (int) $task['lastExecutionId'] : null,
				'lastExecutionStatus' => isset( $task['lastExecutionStatus'] )
					? sanitize_key( (string) $task['lastExecutionStatus'] )
					: null,
			);
		}
		return $out;
	}

	public static function pulse_bot_user_id(): int {
		if ( ! class_exists( 'Neo_Pulse_App_Chat_Flo' ) ) {
			return 0;
		}
		return Neo_Pulse_App_Chat_Flo::ensure_global_user();
	}

	/**
	 * @param mixed $raw
	 */
	public static function sanitize_recurrence_rule( $raw ): string {
		$rule = sanitize_key( (string) $raw );
		return in_array( $rule, self::RECURRENCE_RULES, true ) ? $rule : 'none';
	}

	/**
	 * @param mixed $raw
	 */
	public static function sanitize_due_time( $raw ): string {
		$time = sanitize_text_field( (string) $raw );
		if ( $time === '' ) {
			return '';
		}
		if ( ! preg_match( '/^(\d{1,2}):(\d{2})(?::\d{2})?$/', $time, $m ) ) {
			return '';
		}
		$hour   = (int) $m[1];
		$minute = (int) $m[2];
		if ( $hour < 0 || $hour > 23 || $minute < 0 || $minute > 59 ) {
			return '';
		}
		return sprintf( '%02d:%02d', $hour, $minute );
	}

	/**
	 * @param array<int,int> $ids
	 * @return array<int,int>
	 */
	private static function filter_team_assignee_ids( int $team_id, array $ids ): array {
		$allowed = array();
		foreach ( Neo_Pulse_App_Teams_Store::list_members( $team_id ) as $member ) {
			if ( ! is_array( $member ) ) {
				continue;
			}
			$uid = (int) ( $member['userId'] ?? 0 );
			if ( $uid > 0 ) {
				$allowed[ $uid ] = true;
			}
		}
		$flo_id = self::pulse_bot_user_id();
		if ( $flo_id > 0 ) {
			$allowed[ $flo_id ] = true;
		}
		$out = array();
		foreach ( $ids as $uid ) {
			$uid = (int) $uid;
			if ( $uid > 0 && isset( $allowed[ $uid ] ) ) {
				$out[] = $uid;
			}
		}
		return array_values( array_unique( $out ) );
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
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
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
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
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
		$tasks_table = $wpdb->prefix . 'neo_pulse_team_tasks';
		$files_table = $wpdb->prefix . 'neo_pulse_team_task_files';
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
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
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

	/**
	 * @param mixed $raw
	 */
	public static function sanitize_schedule_mode( $raw ): string {
		$mode = sanitize_key( (string) $raw );
		return in_array( $mode, self::SCHEDULE_MODES, true ) ? $mode : 'calendar';
	}

	/**
	 * @param array<string,mixed> $raw
	 * @return array<string,mixed>
	 */
	public static function sanitize_trigger_config( array $raw ): array {
		$sources = array();
		if ( ! empty( $raw['sources'] ) && is_array( $raw['sources'] ) ) {
			foreach ( $raw['sources'] as $source ) {
				$source = sanitize_key( (string) $source );
				if ( in_array( $source, self::TRIGGER_SOURCES, true ) ) {
					$sources[] = $source;
				}
			}
		}
		if ( count( $sources ) === 0 ) {
			$sources = array( 'gsc' );
		}
		$match = sanitize_key( (string) ( $raw['match'] ?? 'any' ) );
		if ( ! in_array( $match, self::TRIGGER_MATCH_MODES, true ) ) {
			$match = 'any';
		}
		$conditions = array();
		if ( ! empty( $raw['conditions'] ) && is_array( $raw['conditions'] ) ) {
			foreach ( $raw['conditions'] as $cond ) {
				if ( ! is_array( $cond ) ) {
					continue;
				}
				$signal = sanitize_key( (string) ( $cond['signal'] ?? '' ) );
				if ( ! in_array( $signal, self::TRIGGER_SIGNALS, true ) ) {
					continue;
				}
				$operator = sanitize_key( (string) ( $cond['operator'] ?? 'gte' ) );
				if ( ! in_array( $operator, array( 'gte', 'lte' ), true ) ) {
					$operator = 'gte';
				}
				$row = array(
					'signal'   => $signal,
					'operator' => $operator,
					'value'    => (float) ( $cond['value'] ?? 0 ),
				);
				if ( isset( $cond['minImpressions'] ) ) {
					$row['minImpressions'] = max( 0, (int) $cond['minImpressions'] );
				}
				$conditions[] = $row;
			}
		}
		return array(
			'sources'       => array_values( array_unique( $sources ) ),
			'match'         => $match,
			'conditions'    => $conditions,
			'lookbackDays'  => max( 1, min( 365, (int) ( $raw['lookbackDays'] ?? 28 ) ) ),
			'compareDays'   => max( 1, min( 365, (int) ( $raw['compareDays'] ?? 28 ) ) ),
			'pollHours'     => max( 1, min( 720, (int) ( $raw['pollHours'] ?? 24 ) ) ),
			'cooldownHours' => max( 1, min( 720, (int) ( $raw['cooldownHours'] ?? 72 ) ) ),
			'maxUrls'       => max( 1, min( 50, (int) ( $raw['maxUrls'] ?? 5 ) ) ),
		);
	}

	/**
	 * @param array<string,mixed> $raw
	 * @return array<string,mixed>
	 */
	public static function sanitize_trigger_meta( array $raw ): array {
		$out = array();
		foreach ( array( 'lastEvaluatedAt', 'lastFiredAt' ) as $key ) {
			if ( ! empty( $raw[ $key ] ) ) {
				$out[ $key ] = sanitize_text_field( (string) $raw[ $key ] );
			}
		}
		if ( isset( $raw['lastScannedCount'] ) ) {
			$out['lastScannedCount'] = max( 0, (int) $raw['lastScannedCount'] );
		}
		if ( isset( $raw['lastMatchedCount'] ) ) {
			$out['lastMatchedCount'] = max( 0, (int) $raw['lastMatchedCount'] );
		}
		if ( ! empty( $raw['lastSimulated'] ) ) {
			$out['lastSimulated'] = true;
		}
		if ( ! empty( $raw['urlCooldowns'] ) && is_array( $raw['urlCooldowns'] ) ) {
			$cooldowns = array();
			foreach ( $raw['urlCooldowns'] as $url => $iso ) {
				$url = esc_url_raw( (string) $url );
				$iso = sanitize_text_field( (string) $iso );
				if ( $url !== '' && $iso !== '' ) {
					$cooldowns[ $url ] = $iso;
				}
			}
			$out['urlCooldowns'] = $cooldowns;
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $task_def
	 * @return array<int,int>
	 */
	public static function resolve_template_assignee_ids( int $team_id, array $task_def ): array {
		if ( ! empty( $task_def['assignPulse'] ) ) {
			$pulse_id = self::pulse_bot_user_id();
			if ( $pulse_id > 0 ) {
				return array( $pulse_id );
			}
		}
		if ( ! empty( $task_def['assigneeIds'] ) && is_array( $task_def['assigneeIds'] ) ) {
			return self::filter_team_assignee_ids( $team_id, array_map( 'intval', $task_def['assigneeIds'] ) );
		}
		return array();
	}

	/**
	 * @param array<string,mixed> $task_def
	 * @return array<string,mixed>
	 */
	public static function template_task_row_from_def( int $team_id, array $task_def, string $client_name = '' ): array {
		$kw    = sanitize_title( (string) ( $task_def['keyword'] ?? '' ) );
		$title = sanitize_text_field( (string) ( $task_def['title'] ?? '' ) );
		if ( $client_name !== '' ) {
			$title = self::apply_client_to_task_title( $title, $client_name );
		}
		$row = array(
			'keyword' => $kw !== '' ? $kw : sanitize_title( $title ),
			'title'   => $title,
			'status'  => in_array( (string) ( $task_def['status'] ?? 'todo' ), self::STATUSES, true ) ? (string) $task_def['status'] : 'todo',
		);
		if ( isset( $task_def['description'] ) && (string) $task_def['description'] !== '' ) {
			$row['description'] = sanitize_textarea_field( (string) $task_def['description'] );
		}
		if ( isset( $task_def['dueDate'] ) && (string) $task_def['dueDate'] !== '' ) {
			$row['dueDate'] = sanitize_text_field( (string) $task_def['dueDate'] );
		}
		if ( isset( $task_def['dueTime'] ) && (string) $task_def['dueTime'] !== '' ) {
			$row['dueTime'] = self::sanitize_due_time( $task_def['dueTime'] );
		}
		if ( isset( $task_def['recurrenceRule'] ) ) {
			$row['recurrenceRule'] = self::sanitize_recurrence_rule( $task_def['recurrenceRule'] );
		}
		if ( isset( $task_def['scheduleMode'] ) ) {
			$row['scheduleMode'] = self::sanitize_schedule_mode( $task_def['scheduleMode'] );
		}
		if ( isset( $task_def['triggerConfig'] ) && is_array( $task_def['triggerConfig'] ) ) {
			$row['triggerConfig'] = self::sanitize_trigger_config( $task_def['triggerConfig'] );
		}
		$assignees = self::resolve_template_assignee_ids( $team_id, $task_def );
		if ( count( $assignees ) > 0 ) {
			$row['assigneeIds'] = $assignees;
		}
		if ( ! empty( $task_def['tagIds'] ) && is_array( $task_def['tagIds'] ) ) {
			$tag_ids = array();
			foreach ( $task_def['tagIds'] as $tag ) {
				$tag = sanitize_text_field( (string) $tag );
				if ( $tag !== '' ) {
					$tag_ids[] = $tag;
				}
			}
			if ( count( $tag_ids ) > 0 ) {
				$row['tagIds'] = $tag_ids;
			}
		}
		if ( isset( $task_def['executionKind'] ) ) {
			$row['executionKind'] = self::sanitize_execution_kind( $task_def['executionKind'] );
		}
		if ( isset( $task_def['executionPayload'] ) && is_array( $task_def['executionPayload'] ) ) {
			$row['executionPayload'] = self::sanitize_execution_payload( $task_def['executionPayload'] );
		}
		if ( ( $row['executionKind'] ?? '' ) === 'post_creator' ) {
			$row['scheduleMode']     = 'calendar';
			$row['executionPayload'] = self::ensure_post_creator_payload(
				is_array( $row['executionPayload'] ?? null ) ? $row['executionPayload'] : array()
			);
			unset( $row['triggerConfig'] );
		}
		return $row;
	}

	/**
	 * @param array<string,mixed> $meta_patch
	 */
	public static function patch_task_trigger_meta( int $team_id, int $task_id, array $meta_patch ): ?array {
		$row = self::get_task_row( $team_id, $task_id );
		if ( ! $row ) {
			return null;
		}
		$payload = self::decode_payload( $row['payload_json'] );
		$existing = is_array( $payload['triggerMeta'] ?? null ) ? $payload['triggerMeta'] : array();
		$payload['triggerMeta'] = self::sanitize_trigger_meta( array_merge( $existing, $meta_patch ) );
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_team_tasks';
		$wpdb->update(
			$table,
			array(
				'payload_json' => self::encode_payload( $payload ),
				'updated_at'   => gmdate( 'Y-m-d H:i:s' ),
			),
			array( 'id' => $task_id, 'team_id' => $team_id ),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);
		return self::get_task( $team_id, $task_id );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_calendar_automation_tasks( int $team_id ): array {
		$out = array();
		foreach ( self::list_projects( $team_id ) as $project ) {
			if ( ! is_array( $project ) || ! self::project_is_automation( $project ) ) {
				continue;
			}
			$project_id = (int) ( $project['id'] ?? 0 );
			if ( $project_id <= 0 ) {
				continue;
			}
			foreach ( self::list_tasks( $team_id, $project_id, true ) as $task ) {
				if ( ! is_array( $task ) ) {
					continue;
				}
				if ( self::sanitize_schedule_mode( $task['scheduleMode'] ?? 'calendar' ) !== 'calendar' ) {
					continue;
				}
				if ( (string) ( $task['status'] ?? '' ) === 'done' ) {
					continue;
				}
				$desc = (string) ( $task['description'] ?? '' );
				if ( strlen( $desc ) > 240 ) {
					$desc = substr( $desc, 0, 237 ) . '...';
				}
				$out[] = array(
					'id'                  => (int) ( $task['id'] ?? 0 ),
					'title'               => (string) ( $task['title'] ?? '' ),
					'keyword'             => (string) ( $task['keyword'] ?? '' ),
					'projectId'           => (int) ( $task['projectId'] ?? 0 ),
					'projectTitle'        => (string) ( $task['projectTitle'] ?? '' ),
					'dueDate'             => (string) ( $task['dueDate'] ?? '' ),
					'dueTime'             => self::sanitize_due_time( $task['dueTime'] ?? '' ),
					'recurrenceRule'      => self::sanitize_recurrence_rule( $task['recurrenceRule'] ?? 'none' ),
					'scheduleMode'        => 'calendar',
					'triggerConfig'       => null,
					'triggerMeta'         => is_array( $task['triggerMeta'] ?? null )
						? self::sanitize_trigger_meta( $task['triggerMeta'] )
						: null,
					'wordpressSiteId'     => (string) ( $task['wordpressSiteId'] ?? '' ),
					'status'              => (string) ( $task['status'] ?? 'todo' ),
					'description'         => $desc,
					'executionKind'       => self::sanitize_execution_kind( $task['executionKind'] ?? '' ),
					'executionPayload'    => is_array( $task['executionPayload'] ?? null )
						? self::sanitize_execution_payload( $task['executionPayload'] )
						: array(),
					'lastExecutionId'     => isset( $task['lastExecutionId'] ) ? (int) $task['lastExecutionId'] : null,
					'lastExecutionStatus' => isset( $task['lastExecutionStatus'] )
						? sanitize_key( (string) $task['lastExecutionStatus'] )
						: null,
				);
			}
		}
		return $out;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_trigger_tasks( int $team_id ): array {
		$out = array();
		foreach ( self::list_projects( $team_id ) as $project ) {
			if ( ! is_array( $project ) ) {
				continue;
			}
			$project_id = (int) ( $project['id'] ?? 0 );
			if ( $project_id <= 0 ) {
				continue;
			}
			foreach ( self::list_tasks( $team_id, $project_id, true ) as $task ) {
				if ( ! is_array( $task ) ) {
					continue;
				}
				if ( self::sanitize_schedule_mode( $task['scheduleMode'] ?? 'calendar' ) !== 'trigger' ) {
					continue;
				}
				if ( ! self::task_has_pulse_assignee( $task ) ) {
					continue;
				}
				if ( (string) ( $task['status'] ?? '' ) === 'done' ) {
					continue;
				}
				$out[] = $task;
			}
		}
		return $out;
	}
}
