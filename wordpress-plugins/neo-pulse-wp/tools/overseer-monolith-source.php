<?php
/**
 * Overseer: first-party pageview tracking storage and built-in Script Manager tag.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Overseer {

	const TABLE_VERSION            = '2.2';
	const REPORTS_VERSION          = '1.1';
	const TASKS_VERSION            = '1.0';

	/** @var array<int, string> */
	const ALLOWED_EVENT_TYPES = array(
		'pageview',
		'page_exit',
		'page_heartbeat',
		'click',
		'form_submit',
		'outbound_click',
		'conversion',
	);
	const DB_VERSION_OPTION        = 'neo_pulse_wp_overseer_db_version';
	const OPTION_KEY               = 'neo_pulse_wp_overseer_settings';
	const BUILTIN_SCRIPT_ID_OPTION = 'neo_pulse_wp_overseer_builtin_script_id';
	const BUILTIN_SCRIPT_NAME      = 'NEO Pulse Page View';
	const BUILTIN_SCRIPT_CATEGORY  = 'NEO Pulse Tags';
	const CONFIG_PLACEHOLDER       = '%%NEO_PULSE_OVERSEER_CONFIG%%';
	const JS_URL_PLACEHOLDER       = '%%NEO_PULSE_OVERSEER_JS_URL%%';
	const CONFIG_SCRIPT_ID         = 'neo-pulse-overseer-config';
	const SESSION_ID_PATTERN       = '/^ovsess_[0-9]+_[a-z0-9]{6,32}$/';
	const CRON_HOOK                = 'neo_pulse_wp_overseer_prune';
	const SCRIPT_TEMPLATE_VERSION  = '4';
	const SCRIPT_TEMPLATE_OPTION   = 'neo_pulse_wp_overseer_script_template_version';

	/**
	 * @return string
	 */
	public static function table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'neo_pulse_wp_overseer_visits';
	}

	public static function reports_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'neo_pulse_wp_overseer_reports';
	}

	public static function tasks_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'neo_pulse_wp_overseer_tasks';
	}

	public static function init(): void {
		add_action( 'plugins_loaded', array( __CLASS__, 'maybe_install' ), 20 );
		add_action( 'plugins_loaded', array( __CLASS__, 'ensure_builtin_script' ), 25 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'maybe_enqueue_beacon_fallback' ), 20 );
		add_filter( 'neo_pulse_wp_script_manager_render_code', array( __CLASS__, 'filter_script_code' ), 10, 2 );
		add_action( self::CRON_HOOK, array( __CLASS__, 'prune_retention' ) );
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CRON_HOOK );
		}
		Neo_Pulse_Wp_Overseer_Conversions::init();
	}

	public static function maybe_install(): void {
		if ( get_option( self::DB_VERSION_OPTION, '' ) !== self::TABLE_VERSION ) {
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
			visit_uid varchar(36) NOT NULL,
			session_id varchar(64) NOT NULL,
			event_type varchar(32) NOT NULL DEFAULT 'pageview',
			page_url varchar(512) NOT NULL DEFAULT '',
			page_title varchar(512) NOT NULL DEFAULT '',
			referrer varchar(512) NOT NULL DEFAULT '',
			post_id bigint(20) unsigned NOT NULL DEFAULT 0,
			screen_width smallint(5) unsigned NOT NULL DEFAULT 0,
			screen_height smallint(5) unsigned NOT NULL DEFAULT 0,
			language varchar(32) NOT NULL DEFAULT '',
			timezone varchar(64) NOT NULL DEFAULT '',
			client_meta longtext NOT NULL,
			duration_ms bigint(20) unsigned NOT NULL DEFAULT 0,
			active_duration_ms bigint(20) unsigned NOT NULL DEFAULT 0,
			page_load_ms int(11) unsigned NOT NULL DEFAULT 0,
			scroll_depth_pct tinyint(3) unsigned NOT NULL DEFAULT 0,
			parent_visit_uid varchar(36) NOT NULL DEFAULT '',
			element_tag varchar(32) NOT NULL DEFAULT '',
			element_text varchar(256) NOT NULL DEFAULT '',
			element_href varchar(512) NOT NULL DEFAULT '',
			ip_address varchar(45) NOT NULL DEFAULT '',
			user_agent varchar(512) NOT NULL DEFAULT '',
			device varchar(20) NOT NULL DEFAULT 'unknown',
			wp_user_id bigint(20) unsigned NOT NULL DEFAULT 0,
			is_logged_in tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY visit_uid (visit_uid),
			KEY session_id (session_id),
			KEY created_at (created_at),
			KEY page_url (page_url(191)),
			KEY post_id (post_id),
			KEY event_type (event_type),
			KEY parent_visit_uid (parent_visit_uid)
		) {$charset};";

		$reports = self::reports_table_name();
		$sql_reports = "CREATE TABLE {$reports} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			report_uid varchar(36) NOT NULL,
			date_from date NOT NULL,
			date_to date NOT NULL,
			session_count int(11) unsigned NOT NULL DEFAULT 0,
			event_count int(11) unsigned NOT NULL DEFAULT 0,
			model varchar(80) NOT NULL DEFAULT '',
			body longtext NOT NULL,
			gsc_included tinyint(1) NOT NULL DEFAULT 0,
			gsc_date_from date DEFAULT NULL,
			gsc_date_to date DEFAULT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY report_uid (report_uid),
			KEY created_at (created_at)
		) {$charset};";

		$tasks = self::tasks_table_name();
		$sql_tasks = "CREATE TABLE {$tasks} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			task_uid varchar(36) NOT NULL,
			report_id bigint(20) unsigned NOT NULL DEFAULT 0,
			title varchar(512) NOT NULL DEFAULT '',
			description longtext NOT NULL,
			category varchar(32) NOT NULL DEFAULT 'content',
			priority tinyint(3) unsigned NOT NULL DEFAULT 3,
			status varchar(20) NOT NULL DEFAULT 'pending',
			evidence_json longtext NOT NULL,
			assist_message longtext NOT NULL,
			assist_result_json longtext NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY task_uid (task_uid),
			KEY report_id (report_id),
			KEY status (status),
			KEY priority (priority)
		) {$charset};";

		dbDelta( $sql );
		dbDelta( $sql_reports );
		dbDelta( $sql_tasks );
		update_option( self::DB_VERSION_OPTION, self::TABLE_VERSION, false );

		if ( get_option( self::OPTION_KEY, null ) === null ) {
			add_option(
				self::OPTION_KEY,
				array(
					'tracking_enabled'    => true,
					'retention_days'      => 90,
					'anonymize_ip'        => false,
					'exclude_admins'      => true,
					'track_interactions'  => true,
					'track_outbound_only' => false,
					'include_gsc'         => true,
				),
				'',
				false
			);
		}

		self::ensure_builtin_script();
	}

	/**
	 * @return array{tracking_enabled: bool, retention_days: int, anonymize_ip: bool, exclude_admins: bool, track_interactions: bool, track_outbound_only: bool, include_gsc: bool}
	 */
	public static function get_settings(): array {
		$raw = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}
		$days = isset( $raw['retention_days'] ) ? (int) $raw['retention_days'] : 90;
		if ( $days < 1 ) {
			$days = 90;
		}
		if ( $days > 3650 ) {
			$days = 3650;
		}
		return array(
			'tracking_enabled'    => ! array_key_exists( 'tracking_enabled', $raw ) || ! empty( $raw['tracking_enabled'] ),
			'retention_days'      => $days,
			'anonymize_ip'        => ! empty( $raw['anonymize_ip'] ),
			'exclude_admins'      => ! array_key_exists( 'exclude_admins', $raw ) || ! empty( $raw['exclude_admins'] ),
			'track_interactions'  => ! array_key_exists( 'track_interactions', $raw ) || ! empty( $raw['track_interactions'] ),
			'track_outbound_only' => ! empty( $raw['track_outbound_only'] ),
			'include_gsc'         => ! array_key_exists( 'include_gsc', $raw ) || ! empty( $raw['include_gsc'] ),
		);
	}

	/**
	 * @param array<string, mixed> $settings Settings.
	 */
	public static function save_settings( array $settings ): void {
		$days = isset( $settings['retention_days'] ) ? (int) $settings['retention_days'] : 90;
		if ( $days < 1 ) {
			$days = 90;
		}
		if ( $days > 3650 ) {
			$days = 3650;
		}
		update_option(
			self::OPTION_KEY,
			array(
				'tracking_enabled'    => ! empty( $settings['tracking_enabled'] ),
				'retention_days'      => $days,
				'anonymize_ip'        => ! empty( $settings['anonymize_ip'] ),
				'exclude_admins'      => ! empty( $settings['exclude_admins'] ),
				'track_interactions'  => ! empty( $settings['track_interactions'] ),
				'track_outbound_only' => ! empty( $settings['track_outbound_only'] ),
				'include_gsc'         => ! empty( $settings['include_gsc'] ),
			),
			false
		);
	}

	public static function is_tracking_active(): bool {
		$settings = self::get_settings();
		return ! empty( $settings['tracking_enabled'] );
	}

	/**
	 * Whether the front-end beacon should load on the current request.
	 *
	 * Mirrors Script Manager: active Page View tag + matching display rules.
	 */
	public static function should_load_beacon_on_frontend(): bool {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || is_feed() ) {
			return false;
		}
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return false;
		}
		if ( ! self::is_tracking_active() ) {
			return false;
		}
		if ( ! class_exists( 'Neo_Pulse_Wp_Script_Manager', false ) ) {
			return false;
		}

		$builtin_id = self::get_builtin_script_id();
		if ( $builtin_id < 1 ) {
			return false;
		}

		$row = Neo_Pulse_Wp_Script_Manager::get( $builtin_id );
		if ( ! $row ) {
			return false;
		}
		if ( isset( $row->status ) && 'active' !== (string) $row->status ) {
			return false;
		}

		$rules = Neo_Pulse_Wp_Script_Manager_Rules::decode(
			isset( $row->display_rules ) ? (string) $row->display_rules : ''
		);

		return Neo_Pulse_Wp_Script_Manager_Rules::matches_current_request( $rules );
	}

	public static function get_builtin_script_id(): int {
		return (int) get_option( self::BUILTIN_SCRIPT_ID_OPTION, 0 );
	}

	public static function is_builtin_script_id( int $id ): bool {
		$builtin = self::get_builtin_script_id();
		return $builtin > 0 && $builtin === $id;
	}

	public static function is_builtin_protected(): bool {
		return self::is_tracking_active();
	}

	/**
	 * @param string $session_id Session id from client.
	 */
	public static function is_valid_session_id( string $session_id ): bool {
		return (bool) preg_match( self::SESSION_ID_PATTERN, $session_id );
	}

	public static function new_session_id(): string {
		return 'ovsess_' . time() . '_' . strtolower( wp_generate_password( 8, false, false ) );
	}

	/**
	 * @return string
	 */
	public static function beacon_js_url(): string {
		return plugins_url( 'assets/frontend/neo-pulse-overseer.js', NEO_PULSE_WP_PLUGIN_FILE );
	}

	/**
	 * Stored Script Manager snippet (placeholders replaced on the front end).
	 *
	 * @return string
	 */
	public static function builtin_script_template(): string {
		return "<!-- NEO Pulse Page View Tag (Overseer) — first-party pageview beacon. Do not remove. -->\n"
			. '<script type="application/json" id="' . self::CONFIG_SCRIPT_ID . '">' . self::CONFIG_PLACEHOLDER . "</script>\n"
			. '<script src="' . self::JS_URL_PLACEHOLDER . '"></script>' . "\n";
	}

	/**
	 * Replace dynamic placeholders in a Script Manager snippet.
	 *
	 * @param string $code Script HTML/JS.
	 * @return string
	 */
	public static function resolve_script_placeholders( string $code ): string {
		if ( strpos( $code, self::CONFIG_PLACEHOLDER ) !== false ) {
			$code = str_replace( self::CONFIG_PLACEHOLDER, self::beacon_config_json(), $code );
		}
		if ( strpos( $code, self::JS_URL_PLACEHOLDER ) !== false ) {
			$code = str_replace( self::JS_URL_PLACEHOLDER, esc_url( self::beacon_js_url() ), $code );
		}
		return $code;
	}

	/**
	 * Fresh inline config (replaced at render time).
	 *
	 * @return array{endpoint: string, nonce: string}
	 */
	public static function beacon_config(): array {
		$settings = self::get_settings();
		return array(
			'endpoint'            => rest_url( 'neo-pulse/v1/overseer/collect' ),
			'nonce'               => wp_create_nonce( 'wp_rest' ),
			'track_interactions'  => ! empty( $settings['track_interactions'] ),
			'track_outbound_only' => ! empty( $settings['track_outbound_only'] ),
		);
	}

	/**
	 * JSON for application/json config script tag.
	 *
	 * @return string
	 */
	public static function beacon_config_json(): string {
		$json = wp_json_encode(
			self::beacon_config(),
			JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
		);
		return is_string( $json ) ? $json : '{}';
	}

	/**
	 * @param string $code Stored Script Manager snippet.
	 */
	public static function is_stub_script_code( string $code ): bool {
		return strpos( $code, 'NEO Pulse Page View Tag (Overseer)' ) !== false
			&& strpos( $code, '<script' ) === false;
	}

	/**
	 * @param string $code Stored Script Manager snippet.
	 */
	public static function needs_builtin_script_resync( string $code ): bool {
		if ( self::is_stub_script_code( $code ) ) {
			return true;
		}
		return strpos( $code, self::CONFIG_PLACEHOLDER ) === false
			|| strpos( $code, self::JS_URL_PLACEHOLDER ) === false;
	}

	/**
	 * Whether Script Manager already stores the full overseer snippet.
	 */
	public static function has_script_manager_beacon_template(): bool {
		if ( ! class_exists( 'Neo_Pulse_Wp_Script_Manager', false ) ) {
			return false;
		}
		$builtin_id = self::get_builtin_script_id();
		if ( $builtin_id < 1 ) {
			return false;
		}
		$row = Neo_Pulse_Wp_Script_Manager::get( $builtin_id );
		if ( ! $row ) {
			return false;
		}
		$code = isset( $row->code ) ? (string) $row->code : '';
		return ! self::needs_builtin_script_resync( $code );
	}

	/**
	 * Load beacon via wp_enqueue when Script Manager still has the legacy stub.
	 */
	public static function maybe_enqueue_beacon_fallback(): void {
		if ( ! self::should_load_beacon_on_frontend() ) {
			return;
		}
		if ( self::has_script_manager_beacon_template() ) {
			return;
		}

		$ver = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '1';
		wp_enqueue_script(
			'neo-pulse-overseer',
			self::beacon_js_url(),
			array(),
			$ver,
			true
		);
		wp_localize_script(
			'neo-pulse-overseer',
			'neo-pulseOverseer',
			self::beacon_config()
		);
	}

	public static function maybe_upgrade_script_template(): void {
		if ( get_option( self::SCRIPT_TEMPLATE_OPTION, '1' ) === self::SCRIPT_TEMPLATE_VERSION ) {
			return;
		}
		update_option( self::SCRIPT_TEMPLATE_OPTION, self::SCRIPT_TEMPLATE_VERSION, false );
		if ( self::get_builtin_script_id() > 0 ) {
			self::sync_builtin_script();
		}
	}

	public static function flush_optimization_cache(): void {
		if ( class_exists( 'Neo_Pulse_Wp_Speed', false ) ) {
			Neo_Pulse_Wp_Speed::flush_cache();
		}
	}

	public static function ensure_builtin_script(): void {
		if ( ! class_exists( 'Neo_Pulse_Wp_Script_Manager', false ) ) {
			return;
		}

		$by_name = Neo_Pulse_Wp_Script_Manager::get_by_name( self::BUILTIN_SCRIPT_NAME );
		if ( $by_name ) {
			$canonical_id = (int) $by_name->id;
			if ( self::get_builtin_script_id() !== $canonical_id ) {
				update_option( self::BUILTIN_SCRIPT_ID_OPTION, $canonical_id, false );
			}
			self::maybe_sync_builtin_script();
			self::maybe_upgrade_script_template();
			return;
		}

		$result = Neo_Pulse_Wp_Script_Manager::save(
			array(
				'name'          => self::BUILTIN_SCRIPT_NAME,
				'placement'     => 'footer',
				'code'          => self::builtin_script_template(),
				'priority'      => 5,
				'category'      => self::BUILTIN_SCRIPT_CATEGORY,
				'status'        => 'active',
				'display_rules' => Neo_Pulse_Wp_Script_Manager_Rules::defaults(),
			)
		);

		if ( ! empty( $result['ok'] ) && ! empty( $result['id'] ) ) {
			update_option( self::BUILTIN_SCRIPT_ID_OPTION, (int) $result['id'], false );
			self::sync_builtin_script();
		}
	}

	/**
	 * Update stored tag snippet when plugin URL changes (not on every request).
	 */
	public static function maybe_sync_builtin_script(): void {
		$builtin_id = self::get_builtin_script_id();
		if ( $builtin_id < 1 ) {
			return;
		}
		$row = Neo_Pulse_Wp_Script_Manager::get( $builtin_id );
		if ( ! $row ) {
			return;
		}
		$existing = isset( $row->code ) ? (string) $row->code : '';
		if ( self::needs_builtin_script_resync( $existing ) ) {
			self::sync_builtin_script();
		}
	}

	public static function sync_builtin_script(): void {
		$builtin_id = self::get_builtin_script_id();
		if ( $builtin_id < 1 ) {
			return;
		}
		$row = Neo_Pulse_Wp_Script_Manager::get( $builtin_id );
		if ( ! $row ) {
			return;
		}

		Neo_Pulse_Wp_Script_Manager::save(
			array(
				'id'            => $builtin_id,
				'name'          => self::BUILTIN_SCRIPT_NAME,
				'placement'     => 'footer',
				'code'          => self::builtin_script_template(),
				'priority'      => 5,
				'category'      => self::BUILTIN_SCRIPT_CATEGORY,
				'status'        => isset( $row->status ) ? (string) $row->status : 'active',
				'display_rules' => Neo_Pulse_Wp_Script_Manager_Rules::decode( isset( $row->display_rules ) ? (string) $row->display_rules : '' ),
			)
		);

		self::flush_optimization_cache();
	}

	/**
	 * @param string $code   Script code.
	 * @param object $row    Script row.
	 * @return string
	 */
	public static function is_overseer_tag_row( $row ): bool {
		if ( ! is_object( $row ) ) {
			return false;
		}
		if ( self::is_builtin_script_id( (int) $row->id ) ) {
			return true;
		}
		$name = isset( $row->name ) ? Neo_Pulse_Wp_Script_Manager::normalize_name( (string) $row->name ) : '';
		return $name === self::BUILTIN_SCRIPT_NAME;
	}

	public static function filter_script_code( string $code, $row ): string {
		if ( is_object( $row ) && self::is_overseer_tag_row( $row ) ) {
			if ( ! self::is_tracking_active() ) {
				return '';
			}
			$canonical_id = (int) $row->id;
			if ( self::get_builtin_script_id() !== $canonical_id ) {
				update_option( self::BUILTIN_SCRIPT_ID_OPTION, $canonical_id, false );
			}
			$template = self::needs_builtin_script_resync( $code )
				? self::builtin_script_template()
				: $code;
			return self::resolve_script_placeholders( $template );
		}

		if ( strpos( $code, self::CONFIG_PLACEHOLDER ) === false
			&& strpos( $code, self::JS_URL_PLACEHOLDER ) === false ) {
			return $code;
		}
		if ( ! self::is_tracking_active() ) {
			return $code;
		}
		return self::resolve_script_placeholders( $code );
	}

	/**
	 * @return string
	 */
	public static function get_client_ip(): string {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : '';
		$ip = sanitize_text_field( $ip );
		return apply_filters( 'neo_pulse_wp_overseer_client_ip', $ip );
	}

	/**
	 * @param string $ip IP address.
	 * @return string
	 */
	public static function anonymize_ip( string $ip ): string {
		if ( $ip === '' ) {
			return '';
		}
		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
			$parts = explode( '.', $ip );
			if ( count( $parts ) === 4 ) {
				$parts[3] = '0';
				return implode( '.', $parts );
			}
		}
		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
			$parts = explode( ':', $ip );
			$keep  = min( 4, count( $parts ) );
			return implode( ':', array_slice( $parts, 0, $keep ) ) . '::';
		}
		return $ip;
	}

	/**
	 * @param string $user_agent User agent.
	 * @return string mobile|desktop|unknown
	 */
	public static function detect_device( string $user_agent ): string {
		$ua = strtolower( $user_agent );
		if ( $ua === '' ) {
			return 'unknown';
		}
		if ( preg_match( '/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i', $ua ) ) {
			return 'mobile';
		}
		return 'desktop';
	}

	/**
	 * @param array<string, mixed> $data Event payload.
	 * @return array{ok: bool, visit_uid?: string, session_id?: string, error?: string}
	 */
	public static function record_event( array $data ) {
		if ( ! self::is_tracking_active() ) {
			return array( 'ok' => false, 'error' => 'tracking_disabled' );
		}

		$settings = self::get_settings();
		if ( ! empty( $settings['exclude_admins'] ) && is_user_logged_in() && current_user_can( 'manage_options' ) ) {
			return array( 'ok' => false, 'error' => 'excluded_admin' );
		}

		$event_type = isset( $data['event_type'] ) ? sanitize_key( (string) $data['event_type'] ) : 'pageview';
		if ( ! in_array( $event_type, self::ALLOWED_EVENT_TYPES, true ) ) {
			$event_type = 'pageview';
		}

		if ( in_array( $event_type, array( 'click', 'form_submit', 'outbound_click' ), true ) && empty( $settings['track_interactions'] ) ) {
			return array( 'ok' => false, 'error' => 'interactions_disabled' );
		}

		$session_id = isset( $data['session_id'] ) ? sanitize_text_field( (string) $data['session_id'] ) : '';
		if ( ! self::is_valid_session_id( $session_id ) ) {
			$session_id = self::new_session_id();
		}

		$page_url = isset( $data['page_url'] ) ? esc_url_raw( (string) $data['page_url'] ) : '';
		if ( strlen( $page_url ) > 512 ) {
			$page_url = substr( $page_url, 0, 512 );
		}
		if ( $page_url === '' && 'pageview' === $event_type ) {
			return array( 'ok' => false, 'error' => 'missing_page_url' );
		}
		if ( $page_url === '' ) {
			$page_url = isset( $data['current_page_url'] ) ? esc_url_raw( (string) $data['current_page_url'] ) : '';
			if ( strlen( $page_url ) > 512 ) {
				$page_url = substr( $page_url, 0, 512 );
			}
		}
		if ( $page_url === '' ) {
			return array( 'ok' => false, 'error' => 'missing_page_url' );
		}

		$page_title = isset( $data['page_title'] ) ? sanitize_text_field( (string) $data['page_title'] ) : '';
		if ( strlen( $page_title ) > 512 ) {
			$page_title = substr( $page_title, 0, 512 );
		}

		$referrer = isset( $data['referrer'] ) ? esc_url_raw( (string) $data['referrer'] ) : '';
		if ( strlen( $referrer ) > 512 ) {
			$referrer = substr( $referrer, 0, 512 );
		}

		$post_id = isset( $data['post_id'] ) ? absint( $data['post_id'] ) : 0;
		if ( $post_id < 1 ) {
			$post_id = url_to_postid( $page_url );
		}

		$screen_width  = isset( $data['screen_width'] ) ? max( 0, min( 99999, (int) $data['screen_width'] ) ) : 0;
		$screen_height = isset( $data['screen_height'] ) ? max( 0, min( 99999, (int) $data['screen_height'] ) ) : 0;
		$language      = isset( $data['language'] ) ? sanitize_text_field( substr( (string) $data['language'], 0, 32 ) ) : '';
		$timezone      = isset( $data['timezone'] ) ? sanitize_text_field( substr( (string) $data['timezone'], 0, 64 ) ) : '';

		$duration_ms        = isset( $data['duration_ms'] ) ? max( 0, min( 86400000, (int) $data['duration_ms'] ) ) : 0;
		$active_duration_ms = isset( $data['active_duration_ms'] ) ? max( 0, min( 86400000, (int) $data['active_duration_ms'] ) ) : 0;
		$page_load_ms       = isset( $data['page_load_ms'] ) ? max( 0, min( 600000, (int) $data['page_load_ms'] ) ) : 0;
		$scroll_depth_pct   = isset( $data['scroll_depth_pct'] ) ? max( 0, min( 100, (int) $data['scroll_depth_pct'] ) ) : 0;
		$parent_visit_uid  = isset( $data['parent_visit_uid'] ) ? sanitize_text_field( (string) $data['parent_visit_uid'] ) : '';
		if ( $parent_visit_uid !== '' && ! self::is_valid_uuid( $parent_visit_uid ) ) {
			$parent_visit_uid = '';
		}

		$element_tag  = isset( $data['element_tag'] ) ? sanitize_key( substr( (string) $data['element_tag'], 0, 32 ) ) : '';
		$element_text = isset( $data['element_text'] ) ? sanitize_text_field( substr( (string) $data['element_text'], 0, 256 ) ) : '';
		if ( 'conversion' === $event_type ) {
			$element_href = isset( $data['element_href'] ) ? sanitize_text_field( substr( (string) $data['element_href'], 0, 512 ) ) : '';
		} else {
			$element_href = isset( $data['element_href'] ) ? esc_url_raw( substr( (string) $data['element_href'], 0, 512 ) ) : '';
		}

		$client_meta = array();
		if ( isset( $data['client_meta'] ) && is_array( $data['client_meta'] ) ) {
			$client_meta = self::sanitize_client_meta( $data['client_meta'], $event_type );
		} elseif ( isset( $data['utm'] ) && is_array( $data['utm'] ) ) {
			$client_meta['utm'] = $data['utm'];
		}

		$ip = self::get_client_ip();
		if ( ! empty( $settings['anonymize_ip'] ) ) {
			$ip = self::anonymize_ip( $ip );
		}

		$user_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( substr( (string) $_SERVER['HTTP_USER_AGENT'], 0, 512 ) ) : '';
		$device     = self::detect_device( $user_agent );
		$wp_user_id = get_current_user_id();
		$logged_in  = $wp_user_id > 0 ? 1 : 0;

		$visit_uid = self::new_uuid();
		$now       = current_time( 'mysql', true );
		$meta_json = wp_json_encode( $client_meta );
		if ( ! is_string( $meta_json ) ) {
			$meta_json = '{}';
		}

		global $wpdb;
		$table = self::table_name();

		$row = array(
			'visit_uid'          => $visit_uid,
			'session_id'         => $session_id,
			'event_type'         => $event_type,
			'page_url'           => $page_url,
			'page_title'         => $page_title,
			'referrer'           => $referrer,
			'post_id'            => $post_id,
			'screen_width'       => $screen_width,
			'screen_height'      => $screen_height,
			'language'           => $language,
			'timezone'           => $timezone,
			'client_meta'        => $meta_json,
			'duration_ms'        => $duration_ms,
			'active_duration_ms' => $active_duration_ms,
			'page_load_ms'       => $page_load_ms,
			'scroll_depth_pct'   => $scroll_depth_pct,
			'parent_visit_uid'   => $parent_visit_uid,
			'element_tag'        => $element_tag,
			'element_text'       => $element_text,
			'element_href'       => $element_href,
			'ip_address'         => substr( $ip, 0, 45 ),
			'user_agent'         => $user_agent,
			'device'             => $device,
			'wp_user_id'         => $wp_user_id,
			'is_logged_in'       => $logged_in,
			'created_at'         => $now,
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert(
			$table,
			$row,
			array( '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%d', '%s', '%s', '%s', '%d', '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s' )
		);

		if ( false === $inserted ) {
			return array( 'ok' => false, 'error' => __( 'Could not save visit.', 'neo-pulse-wp' ) );
		}

		do_action( 'neo_pulse_wp_overseer_event_recorded', $visit_uid, $event_type, (object) $row );

		self::maybe_prune_retention();

		return array(
			'ok'         => true,
			'visit_uid'  => $visit_uid,
			'session_id' => $session_id,
		);
	}

	/**
	 * @param array<string, mixed> $data Visit payload.
	 * @return array{ok: bool, visit_uid?: string, session_id?: string, error?: string}
	 */
	public static function record_visit( array $data ) {
		if ( ! isset( $data['event_type'] ) ) {
			$data['event_type'] = 'pageview';
		}
		return self::record_event( $data );
	}

	/**
	 * @param string $uuid UUID.
	 */
	public static function is_valid_uuid( string $uuid ): bool {
		return (bool) preg_match(
			'/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
			$uuid
		);
	}

	/**
	 * @param array<string, mixed> $meta Raw client meta.
	 * @param string               $event_type Event type.
	 * @return array<string, mixed>
	 */
	public static function sanitize_client_meta( array $meta, string $event_type = '' ): array {
		if ( 'conversion' !== $event_type ) {
			return $meta;
		}
		$out = array();
		if ( isset( $meta['conversion_goal_id'] ) ) {
			$out['conversion_goal_id'] = sanitize_key( (string) $meta['conversion_goal_id'] );
		}
		if ( isset( $meta['conversion_name'] ) ) {
			$out['conversion_name'] = sanitize_text_field( (string) $meta['conversion_name'] );
		}
		if ( isset( $meta['trigger_type'] ) ) {
			$out['trigger_type'] = sanitize_key( (string) $meta['trigger_type'] );
		}
		if ( isset( $meta['source_event_type'] ) ) {
			$out['source_event_type'] = sanitize_key( (string) $meta['source_event_type'] );
		}
		if ( isset( $meta['form_id'] ) ) {
			$out['form_id'] = absint( $meta['form_id'] );
		}
		if ( isset( $meta['entry_id'] ) ) {
			$out['entry_id'] = absint( $meta['entry_id'] );
		}
		if ( isset( $meta['field_signals'] ) && is_array( $meta['field_signals'] ) ) {
			$signals = array();
			foreach ( $meta['field_signals'] as $type => $present ) {
				$key = sanitize_key( (string) $type );
				if ( $key !== '' ) {
					$signals[ $key ] = (bool) $present;
				}
			}
			$out['field_signals'] = $signals;
		}
		if ( isset( $meta['matched_field_ids'] ) && is_array( $meta['matched_field_ids'] ) ) {
			$ids = array();
			foreach ( $meta['matched_field_ids'] as $field_id ) {
				$field_id = sanitize_key( (string) $field_id );
				if ( $field_id !== '' ) {
					$ids[] = $field_id;
				}
			}
			$out['matched_field_ids'] = array_values( array_unique( $ids ) );
		}
		return $out;
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

		$session = isset( $args['session_id'] ) ? sanitize_text_field( (string) $args['session_id'] ) : '';
		if ( $session !== '' ) {
			$where[]  = 'session_id LIKE %s';
			$params[] = '%' . $wpdb->esc_like( $session ) . '%';
		}

		$date_from = isset( $args['date_from'] ) ? sanitize_text_field( (string) $args['date_from'] ) : '';
		if ( $date_from !== '' && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) ) {
			$where[]  = 'created_at >= %s';
			$params[] = $date_from . ' 00:00:00';
		}

		$date_to = isset( $args['date_to'] ) ? sanitize_text_field( (string) $args['date_to'] ) : '';
		if ( $date_to !== '' && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			$where[]  = 'created_at <= %s';
			$params[] = $date_to . ' 23:59:59';
		}

		$search = isset( $args['search'] ) ? sanitize_text_field( (string) $args['search'] ) : '';
		if ( $search !== '' ) {
			$like     = '%' . $wpdb->esc_like( $search ) . '%';
			$where[]  = '(page_url LIKE %s OR page_title LIKE %s OR ip_address LIKE %s OR session_id LIKE %s)';
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
		}

		$event_type = isset( $args['event_type'] ) ? sanitize_key( (string) $args['event_type'] ) : '';
		if ( $event_type !== '' && in_array( $event_type, self::ALLOWED_EVENT_TYPES, true ) ) {
			$where[]  = 'event_type = %s';
			$params[] = $event_type;
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
			'session_id' => 'session_id',
			'page_url'   => 'page_url',
			'device'     => 'device',
			'created_at' => 'created_at',
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
	 * @param array<string, mixed> $args Query args.
	 * @return array<int, object>
	 */
	public static function query_for_export( array $args = array() ): array {
		$args['per_page'] = isset( $args['per_page'] ) ? (int) $args['per_page'] : 50000;
		$args['page']     = 1;
		$result           = self::query( $args );
		return $result['items'];
	}

	public static function count_visits(): int {
		global $wpdb;
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
	}

	/**
	 * @param string $session_id Session ID.
	 * @return array<int, object>
	 */
	public static function get_session_timeline( string $session_id ): array {
		global $wpdb;
		$session_id = sanitize_text_field( $session_id );
		if ( $session_id === '' || ! self::is_valid_session_id( $session_id ) ) {
			return array();
		}
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$items = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE session_id = %s ORDER BY created_at ASC, id ASC",
				$session_id
			)
		);
		return is_array( $items ) ? $items : array();
	}

	/**
	 * @param string $session_id Session ID.
	 * @return object|null
	 */
	public static function get_session_summary( string $session_id ) {
		$timeline = self::get_session_timeline( $session_id );
		if ( empty( $timeline ) ) {
			return null;
		}
		$first     = $timeline[0];
		$pageviews = array_filter(
			$timeline,
			static function ( $row ) {
				return isset( $row->event_type ) && 'pageview' === (string) $row->event_type;
			}
		);
		$pages_viewed = count( $pageviews );

		$engagement_by_parent = self::build_engagement_map_from_events( $timeline );

		$total_duration_ms = 0;
		$active_duration_ms = 0;
		foreach ( $pageviews as $pv ) {
			$uid = isset( $pv->visit_uid ) ? (string) $pv->visit_uid : '';
			if ( $uid === '' || ! isset( $engagement_by_parent[ $uid ] ) ) {
				continue;
			}
			$eng = $engagement_by_parent[ $uid ];
			$total_duration_ms  += (int) $eng['duration_ms'];
			$active_duration_ms += (int) $eng['active_duration_ms'];
		}

		$started_ts = isset( $first->created_at ) ? strtotime( $first->created_at . ' UTC' ) : false;
		$last       = $timeline[ count( $timeline ) - 1 ];
		$ended_ts   = isset( $last->created_at ) ? strtotime( $last->created_at . ' UTC' ) : false;
		$session_span_sec = 0;
		if ( $started_ts && $ended_ts && $ended_ts >= $started_ts ) {
			$session_span_sec = (int) ( $ended_ts - $started_ts );
		}

		$total_duration_sec  = $total_duration_ms > 0 ? (int) round( $total_duration_ms / 1000 ) : $session_span_sec;
		$active_duration_sec = (int) round( $active_duration_ms / 1000 );
		$avg_time_per_page_sec = $pages_viewed > 0 && $total_duration_ms > 0
			? (int) round( ( $total_duration_ms / 1000 ) / $pages_viewed )
			: 0;

		return (object) array(
			'session_id'            => $session_id,
			'first_event'           => $first,
			'event_count'           => count( $timeline ),
			'pageviews'             => $pages_viewed,
			'pages_viewed'          => $pages_viewed,
			'device'                => isset( $first->device ) ? (string) $first->device : '',
			'ip_address'            => isset( $first->ip_address ) ? (string) $first->ip_address : '',
			'started_at'            => isset( $first->created_at ) ? (string) $first->created_at : '',
			'ended_at'              => isset( $last->created_at ) ? (string) $last->created_at : '',
			'total_duration_sec'    => $total_duration_sec,
			'active_duration_sec'   => $active_duration_sec,
			'avg_time_per_page_sec' => $avg_time_per_page_sec,
			'is_bounce'             => 1 === $pages_viewed,
		);
	}

	/**
	 * @param array<int, object> $events Event rows.
	 * @return array<string, array{duration_ms: int, active_duration_ms: int, scroll_depth_pct: int}>
	 */
	public static function build_engagement_map_from_events( array $events ): array {
		$map = array();
		foreach ( $events as $row ) {
			if ( ! is_object( $row ) ) {
				continue;
			}
			$type = isset( $row->event_type ) ? (string) $row->event_type : '';
			if ( ! in_array( $type, array( 'page_exit', 'page_heartbeat' ), true ) ) {
				continue;
			}
			$parent = isset( $row->parent_visit_uid ) ? (string) $row->parent_visit_uid : '';
			if ( $parent === '' || ! self::is_valid_uuid( $parent ) ) {
				continue;
			}
			$duration = isset( $row->duration_ms ) ? (int) $row->duration_ms : 0;
			$active   = isset( $row->active_duration_ms ) ? (int) $row->active_duration_ms : 0;
			$scroll   = isset( $row->scroll_depth_pct ) ? (int) $row->scroll_depth_pct : 0;
			if ( ! isset( $map[ $parent ] ) ) {
				$map[ $parent ] = array(
					'duration_ms'        => 0,
					'active_duration_ms' => 0,
					'scroll_depth_pct'   => 0,
				);
			}
			if ( $duration > $map[ $parent ]['duration_ms'] ) {
				$map[ $parent ]['duration_ms'] = $duration;
			}
			if ( $active > $map[ $parent ]['active_duration_ms'] ) {
				$map[ $parent ]['active_duration_ms'] = $active;
			}
			if ( $scroll > $map[ $parent ]['scroll_depth_pct'] ) {
				$map[ $parent ]['scroll_depth_pct'] = $scroll;
			}
		}
		return $map;
	}

	/**
	 * @param array<int, string> $visit_uids Pageview visit UIDs.
	 * @return array<string, array{duration_ms: int, active_duration_ms: int, scroll_depth_pct: int}>
	 */
	public static function get_engagement_by_visit_uids( array $visit_uids ): array {
		global $wpdb;
		$visit_uids = array_values(
			array_filter(
				array_map(
					static function ( $uid ) {
						$uid = sanitize_text_field( (string) $uid );
						return Neo_Pulse_Wp_Overseer::is_valid_uuid( $uid ) ? $uid : '';
					},
					$visit_uids
				)
			)
		);
		if ( empty( $visit_uids ) ) {
			return array();
		}

		$table    = self::table_name();
		$placeholders = implode( ',', array_fill( 0, count( $visit_uids ), '%s' ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPlaceholder
		$sql = "SELECT event_type, parent_visit_uid, duration_ms, active_duration_ms, scroll_depth_pct
			FROM {$table}
			WHERE parent_visit_uid IN ({$placeholders})
			AND event_type IN ('page_exit','page_heartbeat')";

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $visit_uids ) );
		if ( ! is_array( $rows ) ) {
			return array();
		}
		return self::build_engagement_map_from_events( $rows );
	}

	/**
	 * @param string $date_from Y-m-d.
	 * @param string $date_to   Y-m-d.
	 * @return array<string, mixed>
	 */
	public static function aggregate_summary( string $date_from, string $date_to ): array {
		$empty = array(
			'sessions'              => 0,
			'pageviews'             => 0,
			'page_exits'            => 0,
			'avg_time_on_page_sec'  => 0,
			'avg_active_time_sec'   => 0,
			'avg_scroll_pct'        => 0,
			'avg_page_load_ms'      => 0,
			'bounce_rate_pct'       => 0,
			'avg_session_duration_sec' => 0,
			'clicks'                => 0,
			'form_submits'          => 0,
			'conversions'           => 0,
			'exit_capture_rate_pct' => 0,
		);

		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			return $empty;
		}

		global $wpdb;
		$table     = self::table_name();
		$from_sql  = $date_from . ' 00:00:00';
		$to_sql    = $date_to . ' 23:59:59';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$counts = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					COUNT(DISTINCT session_id) AS sessions,
					SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
					SUM(CASE WHEN event_type = 'page_exit' THEN 1 ELSE 0 END) AS page_exits,
					SUM(CASE WHEN event_type IN ('click','outbound_click') THEN 1 ELSE 0 END) AS clicks,
					SUM(CASE WHEN event_type = 'form_submit' THEN 1 ELSE 0 END) AS form_submits,
					SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) AS conversions,
					AVG(CASE WHEN event_type = 'pageview' AND page_load_ms > 0 THEN page_load_ms ELSE NULL END) AS avg_page_load_ms,
					AVG(CASE WHEN event_type = 'page_exit' AND scroll_depth_pct > 0 THEN scroll_depth_pct ELSE NULL END) AS avg_scroll_pct
				FROM {$table}
				WHERE created_at >= %s AND created_at <= %s",
				$from_sql,
				$to_sql
			)
		);

		$sessions   = $counts && isset( $counts->sessions ) ? (int) $counts->sessions : 0;
		$pageviews  = $counts && isset( $counts->pageviews ) ? (int) $counts->pageviews : 0;
		$page_exits = $counts && isset( $counts->page_exits ) ? (int) $counts->page_exits : 0;
		$clicks     = $counts && isset( $counts->clicks ) ? (int) $counts->clicks : 0;
		$forms      = $counts && isset( $counts->form_submits ) ? (int) $counts->form_submits : 0;
		$conversions = $counts && isset( $counts->conversions ) ? (int) $counts->conversions : 0;
		$avg_load   = $counts && isset( $counts->avg_page_load_ms ) ? (int) round( (float) $counts->avg_page_load_ms ) : 0;
		$avg_scroll = $counts && isset( $counts->avg_scroll_pct ) ? (int) round( (float) $counts->avg_scroll_pct ) : 0;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$engagement = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					AVG(best_duration) AS avg_duration_ms,
					AVG(best_active) AS avg_active_ms
				FROM (
					SELECT parent_visit_uid,
						MAX(duration_ms) AS best_duration,
						MAX(active_duration_ms) AS best_active
					FROM {$table}
					WHERE created_at >= %s AND created_at <= %s
					AND event_type IN ('page_exit','page_heartbeat')
					AND parent_visit_uid != ''
					GROUP BY parent_visit_uid
				) eng",
				$from_sql,
				$to_sql
			)
		);

		$avg_time_sec   = $engagement && isset( $engagement->avg_duration_ms ) ? (int) round( (float) $engagement->avg_duration_ms / 1000 ) : 0;
		$avg_active_sec = $engagement && isset( $engagement->avg_active_ms ) ? (int) round( (float) $engagement->avg_active_ms / 1000 ) : 0;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$bounce_row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					COUNT(*) AS total_sessions,
					SUM(CASE WHEN pageviews = 1 THEN 1 ELSE 0 END) AS bounce_sessions
				FROM (
					SELECT session_id, SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS pageviews
					FROM {$table}
					WHERE created_at >= %s AND created_at <= %s
					GROUP BY session_id
				) s",
				$from_sql,
				$to_sql
			)
		);

		$total_sessions  = $bounce_row && isset( $bounce_row->total_sessions ) ? (int) $bounce_row->total_sessions : 0;
		$bounce_sessions = $bounce_row && isset( $bounce_row->bounce_sessions ) ? (int) $bounce_row->bounce_sessions : 0;
		$bounce_rate     = $total_sessions > 0 ? (int) round( ( $bounce_sessions / $total_sessions ) * 100 ) : 0;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$session_span = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT AVG(span_sec) AS avg_session_sec FROM (
					SELECT session_id,
						TIMESTAMPDIFF(SECOND, MIN(created_at), MAX(created_at)) AS span_sec
					FROM {$table}
					WHERE created_at >= %s AND created_at <= %s
					GROUP BY session_id
				) spans",
				$from_sql,
				$to_sql
			)
		);
		$avg_session_sec = $session_span && isset( $session_span->avg_session_sec ) ? (int) round( (float) $session_span->avg_session_sec ) : 0;

		$exit_capture = $pageviews > 0 ? (int) round( ( $page_exits / $pageviews ) * 100 ) : 0;

		return array(
			'sessions'                 => $sessions,
			'pageviews'                => $pageviews,
			'page_exits'               => $page_exits,
			'avg_time_on_page_sec'     => $avg_time_sec,
			'avg_active_time_sec'      => $avg_active_sec,
			'avg_scroll_pct'           => $avg_scroll,
			'avg_page_load_ms'         => $avg_load,
			'bounce_rate_pct'          => $bounce_rate,
			'avg_session_duration_sec' => $avg_session_sec,
			'clicks'                   => $clicks,
			'form_submits'             => $forms,
			'conversions'              => $conversions,
			'exit_capture_rate_pct'    => $exit_capture,
		);
	}

	/**
	 * @param string $date_from Y-m-d.
	 * @param string $date_to   Y-m-d.
	 * @return array<int, object>
	 */
	public static function aggregate_by_page( string $date_from, string $date_to ): array {
		global $wpdb;
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			return array();
		}
		$table    = self::table_name();
		$from_sql = $date_from . ' 00:00:00';
		$to_sql   = $date_to . ' 23:59:59';
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT pv.page_url,
					COUNT(*) AS pageviews,
					AVG(CASE WHEN pv.page_load_ms > 0 THEN pv.page_load_ms ELSE NULL END) AS avg_page_load_ms,
					AVG(eng.best_duration_ms) AS avg_duration_ms,
					AVG(eng.best_active_ms) AS avg_active_ms,
					AVG(eng.best_scroll_pct) AS avg_scroll_pct,
					SUM(CASE WHEN eng.best_duration_ms > 0 THEN 1 ELSE 0 END) AS exits_captured
				FROM {$table} pv
				LEFT JOIN (
					SELECT parent_visit_uid,
						MAX(duration_ms) AS best_duration_ms,
						MAX(active_duration_ms) AS best_active_ms,
						MAX(scroll_depth_pct) AS best_scroll_pct
					FROM {$table}
					WHERE event_type IN ('page_exit','page_heartbeat')
					AND parent_visit_uid != ''
					AND created_at >= %s AND created_at <= %s
					GROUP BY parent_visit_uid
				) eng ON eng.parent_visit_uid = pv.visit_uid
				WHERE pv.event_type = 'pageview'
				AND pv.created_at >= %s AND pv.created_at <= %s
				GROUP BY pv.page_url
				ORDER BY pageviews DESC
				LIMIT 50",
				$from_sql,
				$to_sql,
				$from_sql,
				$to_sql
			)
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$interaction_rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT page_url,
					SUM(CASE WHEN event_type IN ('click','outbound_click') THEN 1 ELSE 0 END) AS clicks,
					SUM(CASE WHEN event_type = 'form_submit' THEN 1 ELSE 0 END) AS form_submits
				FROM {$table}
				WHERE created_at >= %s AND created_at <= %s
				AND event_type IN ('click','outbound_click','form_submit')
				GROUP BY page_url",
				$from_sql,
				$to_sql
			)
		);
		$interactions = array();
		if ( is_array( $interaction_rows ) ) {
			foreach ( $interaction_rows as $ir ) {
				$interactions[ (string) $ir->page_url ] = $ir;
			}
		}

		foreach ( $rows as $row ) {
			$url = (string) $row->page_url;
			if ( isset( $interactions[ $url ] ) ) {
				$row->clicks       = (int) $interactions[ $url ]->clicks;
				$row->form_submits = (int) $interactions[ $url ]->form_submits;
			} else {
				$row->clicks       = 0;
				$row->form_submits = 0;
			}
			$pageviews = isset( $row->pageviews ) ? (int) $row->pageviews : 0;
			$captured  = isset( $row->exits_captured ) ? (int) $row->exits_captured : 0;
			$row->exit_rate_pct = $pageviews > 0 ? (int) round( ( $captured / $pageviews ) * 100 ) : 0;
		}
		return $rows;
	}

	/**
	 * @param string $date_from Y-m-d.
	 * @param string $date_to   Y-m-d.
	 * @return array<int, array{path: string, count: int}>
	 */
	public static function aggregate_paths( string $date_from, string $date_to ): array {
		global $wpdb;
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			return array();
		}
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$sessions = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT session_id FROM {$table}
				WHERE created_at >= %s AND created_at <= %s
				AND event_type = 'pageview'
				ORDER BY session_id ASC
				LIMIT 500",
				$date_from . ' 00:00:00',
				$date_to . ' 23:59:59'
			)
		);
		if ( ! is_array( $sessions ) || empty( $sessions ) ) {
			return array();
		}

		$path_counts = array();
		foreach ( $sessions as $session_id ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$urls = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT page_url FROM {$table}
					WHERE session_id = %s AND event_type = 'pageview'
					ORDER BY created_at ASC, id ASC
					LIMIT 5",
					$session_id
				)
			);
			if ( ! is_array( $urls ) || count( $urls ) < 2 ) {
				continue;
			}
			$paths = array();
			for ( $i = 0; $i < count( $urls ) - 1; $i++ ) {
				$paths[] = self::normalize_path_url( (string) $urls[ $i ] ) . ' → ' . self::normalize_path_url( (string) $urls[ $i + 1 ] );
			}
			if ( count( $urls ) >= 3 ) {
				$paths[] = self::normalize_path_url( (string) $urls[0] ) . ' → ' . self::normalize_path_url( (string) $urls[1] ) . ' → ' . self::normalize_path_url( (string) $urls[2] );
			}
			foreach ( $paths as $path ) {
				if ( ! isset( $path_counts[ $path ] ) ) {
					$path_counts[ $path ] = 0;
				}
				++$path_counts[ $path ];
			}
		}

		arsort( $path_counts );
		$out = array();
		foreach ( array_slice( $path_counts, 0, 30, true ) as $path => $count ) {
			$out[] = array(
				'path'  => $path,
				'count' => (int) $count,
			);
		}
		return $out;
	}

	/**
	 * @param string $date_from Y-m-d.
	 * @param string $date_to   Y-m-d.
	 * @return array<int, object>
	 */
	public static function fetch_events_for_analysis( string $date_from, string $date_to ): array {
		$result = self::query(
			array(
				'date_from' => $date_from,
				'date_to'   => $date_to,
				'per_page'  => 5000,
				'page'      => 1,
				'orderby'   => 'created_at',
				'order'     => 'asc',
			)
		);
		return $result['items'];
	}

	/**
	 * @param string $date_from Y-m-d.
	 * @param string $date_to   Y-m-d.
	 * @return int
	 */
	public static function count_sessions_in_range( string $date_from, string $date_to ): int {
		global $wpdb;
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			return 0;
		}
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE created_at >= %s AND created_at <= %s",
				$date_from . ' 00:00:00',
				$date_to . ' 23:59:59'
			)
		);
	}

	/**
	 * @param string $url Full URL.
	 * @return string
	 */
	public static function normalize_path_url( string $url ): string {
		$path = wp_parse_url( $url, PHP_URL_PATH );
		if ( ! is_string( $path ) || $path === '' ) {
			return '/';
		}
		return $path;
	}

	/**
	 * @param string $date_from Y-m-d.
	 * @param string $date_to   Y-m-d.
	 * @return array<int, object>
	 */
	public static function top_clicked_links( string $date_from, string $date_to ): array {
		global $wpdb;
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			return array();
		}
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT element_href, element_text, page_url, COUNT(*) AS click_count
				FROM {$table}
				WHERE created_at >= %s AND created_at <= %s
				AND event_type IN ('click','outbound_click')
				AND element_href != ''
				GROUP BY element_href, element_text, page_url
				ORDER BY click_count DESC
				LIMIT 30",
				$date_from . ' 00:00:00',
				$date_to . ' 23:59:59'
			)
		);
		return is_array( $rows ) ? $rows : array();
	}


	public static function delete_visit( int $id ): bool {
		global $wpdb;
		if ( $id < 1 ) {
			return false;
		}
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );
	}

	public static function delete_all_visits(): int {
		global $wpdb;
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return (int) $wpdb->query( "TRUNCATE TABLE {$table}" );
	}

	public static function maybe_prune_retention(): void {
		self::prune_retention();
	}

	public static function prune_retention(): void {
		$settings = self::get_settings();
		$days     = (int) $settings['retention_days'];
		if ( $days < 1 ) {
			return;
		}
		$cutoff = gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) );
		global $wpdb;
		$table = self::table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", $cutoff ) );
	}

	public static function new_uuid(): string {
		if ( function_exists( 'wp_generate_uuid4' ) ) {
			return wp_generate_uuid4();
		}
		return sprintf(
			'%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
			wp_rand( 0, 0xffff ),
			wp_rand( 0, 0xffff ),
			wp_rand( 0, 0xffff ),
			wp_rand( 0, 0x0fff ) | 0x4000,
			wp_rand( 0, 0x3fff ) | 0x8000,
			wp_rand( 0, 0xffff ),
			wp_rand( 0, 0xffff ),
			wp_rand( 0, 0xffff )
		);
	}
}
