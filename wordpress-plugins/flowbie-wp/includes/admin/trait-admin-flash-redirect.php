<?php
/**
 * Flash transients and app redirects.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Flash_Redirect {

	/**
	 * @param array<string,mixed> $data Flash payload.
	 */
	private static function set_flash( array $data ): void {
		set_transient( 'flowbie_wp_flash_' . get_current_user_id(), $data, 120 );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function get_and_clear_flash(): ?array {
		$key = 'flowbie_wp_flash_' . get_current_user_id();
		$d   = get_transient( $key );
		if ( false !== $d ) {
			delete_transient( $key );
		}
		return is_array( $d ) ? $d : null;
	}

	private static function redirect_to_app( array $query = array() ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp' );
		if ( ! empty( $query ) ) {
			$url = add_query_arg( $query, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	private static function redirect_to_settings( string $tab = 'property' ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp-settings' );
		if ( $tab !== '' && 'property' !== $tab ) {
			$url = add_query_arg( 'tab', $tab, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	private static function redirect_to_analytics( string $tab = 'overview' ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp-analytics' );
		if ( $tab !== '' && 'overview' !== $tab ) {
			$url = add_query_arg( 'tab', $tab, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	private static function redirect_to_chat( string $tab = 'general' ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp-chat' );
		if ( $tab !== '' && 'general' !== $tab ) {
			$url = add_query_arg( 'tab', $tab, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	private static function redirect_to_search( string $tab = 'general' ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp-search' );
		if ( $tab !== '' && 'general' !== $tab ) {
			$url = add_query_arg( 'tab', $tab, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	/**
	 * @param string               $view list|new|edit|import-export|settings
	 * @param int                  $id   Redirect ID for edit redirect.
	 * @param array<string, mixed> $query Extra query args.
	 */
	private static function redirect_to_redirects( string $view = 'list', int $id = 0, array $query = array() ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp-redirects' );
		if ( 'list' !== $view ) {
			$url = add_query_arg( 'action', $view, $url );
		}
		if ( $id > 0 ) {
			$url = add_query_arg( 'id', $id, $url );
		}
		if ( ! empty( $query ) ) {
			$url = add_query_arg( $query, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	/**
	 * @param string               $view list|new|edit|import-export|settings
	 * @param int                  $id   Script ID for edit redirect.
	 * @param array<string, mixed> $query Extra query args.
	 */
	/**
	 * @param string               $view list|import-export|settings|analysis|reports|view-report
	 * @param int                  $id   Report ID for view-report.
	 * @param array<string, mixed> $query Extra query args.
	 */
	/**
	 * @param string               $view list|import-export|settings
	 * @param int                  $id   Unused.
	 * @param array<string, mixed> $query Extra query args.
	 */
	private static function redirect_to_search_logs( string $view = 'list', int $id = 0, array $query = array() ): void {
		unset( $id );
		$url = admin_url( 'admin.php?page=flowbie-wp-search-logs' );
		if ( 'list' !== $view ) {
			$url = add_query_arg( 'action', $view, $url );
		}
		if ( ! empty( $query ) ) {
			$url = add_query_arg( $query, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	private static function redirect_to_chat_logs( string $view = 'list', int $id = 0, array $query = array() ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp-chat-logs' );
		if ( 'list' !== $view ) {
			$url = add_query_arg( 'action', $view, $url );
		}
		if ( $id > 0 ) {
			$url = add_query_arg( 'id', $id, $url );
		}
		if ( ! empty( $query ) ) {
			$url = add_query_arg( $query, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	/**
	 * @param string               $view list|import-export|settings|session|analysis|reports|view-report|tasks
	 * @param int                  $id   Report ID for view-report.
	 * @param array<string, mixed> $query Extra query args.
	 */
	private static function redirect_to_overseer( string $view = 'list', int $id = 0, array $query = array() ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp-overseer' );
		if ( 'list' !== $view ) {
			$url = add_query_arg( 'action', $view, $url );
		}
		if ( $id > 0 ) {
			$url = add_query_arg( 'id', $id, $url );
		}
		if ( ! empty( $query ) ) {
			$url = add_query_arg( $query, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}

	private static function redirect_to_script_manager( string $view = 'list', int $id = 0, array $query = array() ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp-script-manager' );
		if ( 'list' !== $view ) {
			$url = add_query_arg( 'action', $view, $url );
		}
		if ( $id > 0 ) {
			$url = add_query_arg( 'id', $id, $url );
		}
		if ( ! empty( $query ) ) {
			$url = add_query_arg( $query, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}
}
