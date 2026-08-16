<?php
/**
 * Pending trigger dispatch queue (client poller).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Trigger_Pending_Store {

	private static function path( int $team_id ): string {
		return Neo_Pulse_App_Data_Paths::subdir( 'teams/' . (string) $team_id ) . '/task-trigger-pending.json';
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list( int $team_id ): array {
		$data = Neo_Pulse_App_Json_File_Store::read( self::path( $team_id ) );
		if ( ! is_array( $data ) || ! isset( $data['pending'] ) || ! is_array( $data['pending'] ) ) {
			return array();
		}
		return $data['pending'];
	}

	/**
	 * @param array<int,string> $urls
	 */
	public static function enqueue( int $team_id, int $task_id, array $urls, bool $simulated = false ): bool {
		$urls = array_values(
			array_unique(
				array_filter(
					array_map(
						static function ( $url ) {
							return esc_url_raw( (string) $url );
						},
						$urls
					)
				)
			)
		);
		if ( count( $urls ) === 0 || $task_id <= 0 ) {
			return false;
		}
		$pending = self::list( $team_id );
		$pending = array_values(
			array_filter(
				$pending,
				static function ( $item ) use ( $task_id ) {
					return ! is_array( $item ) || (int) ( $item['taskId'] ?? 0 ) !== $task_id;
				}
			)
		);
		$pending[] = array(
			'taskId'    => $task_id,
			'urls'      => $urls,
			'simulated' => $simulated,
			'createdAt' => gmdate( 'c' ),
		);
		return Neo_Pulse_App_Json_File_Store::write(
			self::path( $team_id ),
			array(
				'pending'   => $pending,
				'updatedAt' => gmdate( 'c' ),
			)
		);
	}

	public static function dequeue( int $team_id, int $task_id ): bool {
		$pending = array_values(
			array_filter(
				self::list( $team_id ),
				static function ( $item ) use ( $task_id ) {
					return ! is_array( $item ) || (int) ( $item['taskId'] ?? 0 ) !== $task_id;
				}
			)
		);
		return Neo_Pulse_App_Json_File_Store::write(
			self::path( $team_id ),
			array(
				'pending'   => $pending,
				'updatedAt' => gmdate( 'c' ),
			)
		);
	}
}
