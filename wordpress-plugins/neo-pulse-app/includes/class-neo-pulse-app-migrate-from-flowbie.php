<?php
/**
 * Migrate persisted Flowbie App data to NEO Pulse App.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Migrate_From_Flowbie {

	const DONE_OPTION = 'neo_pulse_app_migrated_from_flowbie_v1';

	public static function maybe_run(): void {
		if ( get_option( self::DONE_OPTION, false ) ) {
			return;
		}

		global $wpdb;

		$table_map = array(
			'flowbie_users'              => 'neo-pulse_users',
			'flowbie_teams'              => 'neo_pulse_teams',
			'flowbie_team_members'       => 'neo_pulse_team_members',
			'flowbie_team_invites'       => 'neo_pulse_team_invites',
			'flowbie_team_tasks'         => 'neo_pulse_team_tasks',
			'flowbie_team_task_comments' => 'neo_pulse_team_task_comments',
			'flowbie_chat_channels'      => 'neo_pulse_chat_channels',
			'flowbie_chat_messages'      => 'neo_pulse_chat_messages',
			'flowbie_chat_calls'         => 'neo_pulse_chat_calls',
		);

		foreach ( $table_map as $legacy_suffix => $next_suffix ) {
			$legacy_table = $wpdb->prefix . $legacy_suffix;
			$next_table   = $wpdb->prefix . $next_suffix;
			$legacy_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $legacy_table ) );
			$next_exists   = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $next_table ) );
			if ( $legacy_exists === $legacy_table && $next_exists !== $next_table ) {
				$wpdb->query( "RENAME TABLE `{$legacy_table}` TO `{$next_table}`" );
			}
		}

		$option_like = $wpdb->esc_like( 'flowbie_app_' ) . '%';
		$rows        = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT option_name, option_value, autoload FROM {$wpdb->options} WHERE option_name LIKE %s",
				$option_like
			),
			ARRAY_A
		);
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row ) {
				$legacy_name = (string) $row['option_name'];
				$next_name   = 'neo_pulse_app_' . substr( $legacy_name, strlen( 'flowbie_app_' ) );
				if ( get_option( $next_name, null ) === null ) {
					add_option( $next_name, maybe_unserialize( $row['option_value'] ), '', $row['autoload'] );
				}
				delete_option( $legacy_name );
			}
		}

		$upload       = wp_upload_dir();
		$uploads_base = isset( $upload['basedir'] ) ? (string) $upload['basedir'] : '';
		if ( $uploads_base !== '' ) {
			$legacy_uploads = trailingslashit( $uploads_base ) . 'flowbie-data';
			$next_uploads   = trailingslashit( $uploads_base ) . 'neo-pulse-data';
			if ( is_dir( $legacy_uploads ) && ! is_dir( $next_uploads ) ) {
				@rename( $legacy_uploads, $next_uploads );
			}
		}

		$legacy_content = WP_CONTENT_DIR . '/flowbie-data';
		$next_content   = WP_CONTENT_DIR . '/neo-pulse-data';
		if ( is_dir( $legacy_content ) && ! is_dir( $next_content ) ) {
			@rename( $legacy_content, $next_content );
		}

		update_option( self::DONE_OPTION, '1', true );
	}
}
