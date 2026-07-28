<?php
/**
 * Overseer: first-party pageview tracking storage and built-in Script Manager tag.
 *
 * Public facade — implementation lives in includes/overseer/.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Overseer {

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
	const DB_VERSION_OPTION        = 'flowbie_wp_overseer_db_version';
	const OPTION_KEY               = 'flowbie_wp_overseer_settings';
	const BUILTIN_SCRIPT_ID_OPTION = 'flowbie_wp_overseer_builtin_script_id';
	const BUILTIN_SCRIPT_NAME      = 'Flowbie Page View';
	const BUILTIN_SCRIPT_CATEGORY  = 'Flowbie Tags';
	const CONFIG_PLACEHOLDER       = '%%FLOWBIE_OVERSEER_CONFIG%%';
	const JS_URL_PLACEHOLDER       = '%%FLOWBIE_OVERSEER_JS_URL%%';
	const CONFIG_SCRIPT_ID         = 'flowbie-overseer-config';
	const SESSION_ID_PATTERN       = '/^ovsess_[0-9]+_[a-z0-9]{6,32}$/';
	const CRON_HOOK                = 'flowbie_wp_overseer_prune';
	const SCRIPT_TEMPLATE_VERSION  = '4';
	const SCRIPT_TEMPLATE_OPTION   = 'flowbie_wp_overseer_script_template_version';

	public static function init(): void {
		self::load_dependencies();
		add_action( 'plugins_loaded', array( Flowbie_Wp_Overseer_Install::class, 'maybe_install' ), 20 );
		add_action( 'plugins_loaded', array( Flowbie_Wp_Overseer_Beacon::class, 'ensure_builtin_script' ), 25 );
		add_action( 'wp_enqueue_scripts', array( Flowbie_Wp_Overseer_Beacon::class, 'maybe_enqueue_beacon_fallback' ), 20 );
		add_filter( 'flowbie_wp_script_manager_render_code', array( Flowbie_Wp_Overseer_Beacon::class, 'filter_script_code' ), 10, 2 );
		add_action( Flowbie_Wp_Overseer_Context::CRON_HOOK, array( Flowbie_Wp_Overseer_Maintenance::class, 'prune_retention' ) );
		if ( ! wp_next_scheduled( Flowbie_Wp_Overseer_Context::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', Flowbie_Wp_Overseer_Context::CRON_HOOK );
		}
		Flowbie_Wp_Overseer_Conversions::init();
	}

	private static function load_dependencies(): void {
		static $loaded = false;
		if ( $loaded ) {
			return;
		}
		$loaded = true;

		$dir = FLOWBIE_WP_PLUGIN_DIR . 'includes/overseer/';
		require_once $dir . 'class-flowbie-wp-overseer-context.php';
		require_once $dir . 'class-flowbie-wp-overseer-settings.php';
		require_once $dir . 'class-flowbie-wp-overseer-install.php';
		require_once $dir . 'class-flowbie-wp-overseer-beacon.php';
		require_once $dir . 'class-flowbie-wp-overseer-ingest.php';
		require_once $dir . 'class-flowbie-wp-overseer-query.php';
		require_once $dir . 'class-flowbie-wp-overseer-aggregates.php';
		require_once $dir . 'class-flowbie-wp-overseer-maintenance.php';
	}

	/** @return string */
	public static function table_name(): string {
		return Flowbie_Wp_Overseer_Context::table_name();
	}

	public static function reports_table_name(): string {
		return Flowbie_Wp_Overseer_Context::reports_table_name();
	}

	public static function tasks_table_name(): string {
		return Flowbie_Wp_Overseer_Context::tasks_table_name();
	}

	public static function maybe_install(): void {
		self::load_dependencies();
		Flowbie_Wp_Overseer_Install::maybe_install();
	}

	public static function install(): void {
		self::load_dependencies();
		Flowbie_Wp_Overseer_Install::install();
	}

	public static function get_settings(): array {
		return Flowbie_Wp_Overseer_Settings::get_settings();
	}

	public static function save_settings( array $settings ): void {
		Flowbie_Wp_Overseer_Settings::save_settings( $settings );
	}

	public static function is_tracking_active(): bool {
		return Flowbie_Wp_Overseer_Settings::is_tracking_active();
	}

	public static function should_load_beacon_on_frontend(): bool {
		return Flowbie_Wp_Overseer_Settings::should_load_beacon_on_frontend();
	}

	public static function get_builtin_script_id(): int {
		return Flowbie_Wp_Overseer_Beacon::get_builtin_script_id();
	}

	public static function is_builtin_script_id( int $id ): bool {
		return Flowbie_Wp_Overseer_Beacon::is_builtin_script_id( $id );
	}

	public static function is_builtin_protected(): bool {
		return Flowbie_Wp_Overseer_Beacon::is_builtin_protected();
	}

	public static function is_valid_session_id( string $session_id ): bool {
		return Flowbie_Wp_Overseer_Context::is_valid_session_id( $session_id );
	}

	public static function new_session_id(): string {
		return Flowbie_Wp_Overseer_Context::new_session_id();
	}

	public static function beacon_js_url(): string {
		return Flowbie_Wp_Overseer_Beacon::beacon_js_url();
	}

	public static function builtin_script_template(): string {
		return Flowbie_Wp_Overseer_Beacon::builtin_script_template();
	}

	public static function resolve_script_placeholders( string $code ): string {
		return Flowbie_Wp_Overseer_Beacon::resolve_script_placeholders( $code );
	}

	public static function beacon_config(): array {
		return Flowbie_Wp_Overseer_Beacon::beacon_config();
	}

	public static function beacon_config_json(): string {
		return Flowbie_Wp_Overseer_Beacon::beacon_config_json();
	}

	public static function is_stub_script_code( string $code ): bool {
		return Flowbie_Wp_Overseer_Beacon::is_stub_script_code( $code );
	}

	public static function needs_builtin_script_resync( string $code ): bool {
		return Flowbie_Wp_Overseer_Beacon::needs_builtin_script_resync( $code );
	}

	public static function has_script_manager_beacon_template(): bool {
		return Flowbie_Wp_Overseer_Beacon::has_script_manager_beacon_template();
	}

	public static function maybe_enqueue_beacon_fallback(): void {
		Flowbie_Wp_Overseer_Beacon::maybe_enqueue_beacon_fallback();
	}

	public static function maybe_upgrade_script_template(): void {
		Flowbie_Wp_Overseer_Beacon::maybe_upgrade_script_template();
	}

	public static function flush_optimization_cache(): void {
		Flowbie_Wp_Overseer_Beacon::flush_optimization_cache();
	}

	public static function ensure_builtin_script(): void {
		Flowbie_Wp_Overseer_Beacon::ensure_builtin_script();
	}

	public static function maybe_sync_builtin_script(): void {
		Flowbie_Wp_Overseer_Beacon::maybe_sync_builtin_script();
	}

	public static function sync_builtin_script(): void {
		Flowbie_Wp_Overseer_Beacon::sync_builtin_script();
	}

	/** @param object $row Script row. */
	public static function is_overseer_tag_row( $row ): bool {
		return Flowbie_Wp_Overseer_Beacon::is_overseer_tag_row( $row );
	}

	/** @param object $row Script row. */
	public static function filter_script_code( string $code, $row ): string {
		return Flowbie_Wp_Overseer_Beacon::filter_script_code( $code, $row );
	}

	public static function get_client_ip(): string {
		return Flowbie_Wp_Overseer_Ingest::get_client_ip();
	}

	public static function anonymize_ip( string $ip ): string {
		return Flowbie_Wp_Overseer_Ingest::anonymize_ip( $ip );
	}

	public static function detect_device( string $user_agent ): string {
		return Flowbie_Wp_Overseer_Ingest::detect_device( $user_agent );
	}

	/**
	 * @param array<string, mixed> $data Event payload.
	 * @return array{ok: bool, visit_uid?: string, session_id?: string, error?: string}
	 */
	public static function record_event( array $data ) {
		return Flowbie_Wp_Overseer_Ingest::record_event( $data );
	}

	/**
	 * @param array<string, mixed> $data Visit payload.
	 * @return array{ok: bool, visit_uid?: string, session_id?: string, error?: string}
	 */
	public static function record_visit( array $data ) {
		return Flowbie_Wp_Overseer_Ingest::record_visit( $data );
	}

	public static function is_valid_uuid( string $uuid ): bool {
		return Flowbie_Wp_Overseer_Context::is_valid_uuid( $uuid );
	}

	public static function sanitize_client_meta( array $meta, string $event_type = '' ): array {
		return Flowbie_Wp_Overseer_Ingest::sanitize_client_meta( $meta, $event_type );
	}

	/**
	 * @param array<string, mixed> $args Query args.
	 * @return array{items: array<int, object>, total: int}
	 */
	public static function query( array $args = array() ): array {
		return Flowbie_Wp_Overseer_Query::query( $args );
	}

	/**
	 * @param array<string, mixed> $args Query args.
	 * @return array<int, object>
	 */
	public static function query_for_export( array $args = array() ): array {
		return Flowbie_Wp_Overseer_Query::query_for_export( $args );
	}

	public static function count_visits(): int {
		return Flowbie_Wp_Overseer_Query::count_visits();
	}

	public static function get_session_timeline( string $session_id ): array {
		return Flowbie_Wp_Overseer_Query::get_session_timeline( $session_id );
	}

	/** @return object|null */
	public static function get_session_summary( string $session_id ) {
		return Flowbie_Wp_Overseer_Query::get_session_summary( $session_id );
	}

	public static function build_engagement_map_from_events( array $events ): array {
		return Flowbie_Wp_Overseer_Query::build_engagement_map_from_events( $events );
	}

	public static function get_engagement_by_visit_uids( array $visit_uids ): array {
		return Flowbie_Wp_Overseer_Query::get_engagement_by_visit_uids( $visit_uids );
	}

	public static function aggregate_summary( string $date_from, string $date_to ): array {
		return Flowbie_Wp_Overseer_Aggregates::aggregate_summary( $date_from, $date_to );
	}

	public static function aggregate_by_page( string $date_from, string $date_to ): array {
		return Flowbie_Wp_Overseer_Aggregates::aggregate_by_page( $date_from, $date_to );
	}

	public static function aggregate_paths( string $date_from, string $date_to ): array {
		return Flowbie_Wp_Overseer_Aggregates::aggregate_paths( $date_from, $date_to );
	}

	public static function fetch_events_for_analysis( string $date_from, string $date_to ): array {
		return Flowbie_Wp_Overseer_Aggregates::fetch_events_for_analysis( $date_from, $date_to );
	}

	public static function count_sessions_in_range( string $date_from, string $date_to ): int {
		return Flowbie_Wp_Overseer_Aggregates::count_sessions_in_range( $date_from, $date_to );
	}

	public static function normalize_path_url( string $url ): string {
		return Flowbie_Wp_Overseer_Aggregates::normalize_path_url( $url );
	}

	public static function top_clicked_links( string $date_from, string $date_to ): array {
		return Flowbie_Wp_Overseer_Aggregates::top_clicked_links( $date_from, $date_to );
	}

	public static function delete_visit( int $id ): bool {
		return Flowbie_Wp_Overseer_Maintenance::delete_visit( $id );
	}

	public static function delete_all_visits(): int {
		return Flowbie_Wp_Overseer_Maintenance::delete_all_visits();
	}

	public static function maybe_prune_retention(): void {
		Flowbie_Wp_Overseer_Maintenance::maybe_prune_retention();
	}

	public static function prune_retention(): void {
		Flowbie_Wp_Overseer_Maintenance::prune_retention();
	}

	public static function new_uuid(): string {
		return Flowbie_Wp_Overseer_Context::new_uuid();
	}
}
