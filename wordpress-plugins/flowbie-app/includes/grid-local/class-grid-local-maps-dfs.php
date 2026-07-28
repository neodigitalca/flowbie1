<?php
/**
 * Grid Local DataForSEO local_finder live/advanced (one task per pin).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Grid_Local_Maps_Dfs {

	const ENDPOINT = 'serp/google/local_finder/live/advanced';

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	public static function run( array $args ): array {
		$kw = isset( $args['keyword'] ) ? trim( (string) $args['keyword'] ) : '';
		if ( $kw === '' ) {
			throw new Exception( 'keyword is required' );
		}
		$pins = isset( $args['pins'] ) && is_array( $args['pins'] ) ? $args['pins'] : array();
		if ( empty( $pins ) ) {
			throw new Exception( 'pins array is required' );
		}
		if ( count( $pins ) > 100 ) {
			throw new Exception( 'Maximum 100 pins per scan' );
		}

		$lang  = isset( $args['language_code'] ) && is_string( $args['language_code'] ) ? $args['language_code'] : 'en';
		$depth = isset( $args['depth'] ) && is_numeric( $args['depth'] ) && (int) $args['depth'] > 0 ? (int) $args['depth'] : 100;

		$pin_results = array();
		foreach ( $pins as $index => $pin ) {
			if ( ! is_array( $pin ) ) {
				throw new Exception( 'Each pin requires numeric lat and lng' );
			}
			$lat = isset( $pin['lat'] ) ? (float) $pin['lat'] : NAN;
			$lng = isset( $pin['lng'] ) ? (float) $pin['lng'] : NAN;
			if ( ! is_finite( $lat ) || ! is_finite( $lng ) ) {
				throw new Exception( 'Each pin requires numeric lat and lng' );
			}
			$coord = sprintf( '%.7F,%.7F,17z', $lat, $lng );
			$task  = array(
				'keyword'             => $kw,
				'location_coordinate' => $coord,
				'language_code'       => $lang,
				'device'              => 'desktop',
				'depth'               => $depth,
				'tag'                 => (string) $index,
			);
			$pin_results[] = self::fetch_one_pin( $task, (int) $index, $coord );
		}

		return array(
			'keyword'  => $kw,
			'pinCount' => count( $pin_results ),
			'pins'     => $pin_results,
		);
	}

	/**
	 * @param array<string,mixed> $task
	 * @return array<string,mixed>
	 */
	private static function fetch_one_pin( array $task, int $index, string $coord ): array {
		$result = Flowbie_App_Dataforseo_Client::post( self::ENDPOINT, array( $task ), array( 'timeout' => 180000 ) );
		if ( is_wp_error( $result ) ) {
			return array(
				'index'              => $index,
				'locationCoordinate' => $coord,
				'apiStatus'          => null,
				'apiError'           => $result->get_error_message(),
				'taskJson'           => null,
			);
		}

		$task_row = isset( $result['tasks'][0] ) && is_array( $result['tasks'][0] ) ? $result['tasks'][0] : null;
		return self::normalize_pin_result( $index, $coord, $task_row );
	}

	/** @param array<string,mixed>|null $task */
	private static function normalize_pin_result( int $index, string $coord, ?array $task ): array {
		if ( ! $task ) {
			return array(
				'index'              => $index,
				'locationCoordinate' => $coord,
				'apiStatus'          => null,
				'apiError'           => 'No task result from DataForSEO',
				'taskJson'           => null,
			);
		}

		$ok = self::task_result_ok( $task );
		$status_code = isset( $task['status_code'] ) ? (int) $task['status_code'] : null;
		$status_msg  = isset( $task['status_message'] ) ? (string) $task['status_message'] : '';
		$api_status  = $status_code !== null ? $status_code . ( $status_msg !== '' ? ': ' . $status_msg : '' ) : null;

		return array(
			'index'              => $index,
			'locationCoordinate' => $coord,
			'apiStatus'          => $api_status,
			'apiError'           => $ok ? null : ( $status_msg !== '' ? $status_msg : 'DataForSEO error ' . $status_code ),
			'taskJson'           => array( 'tasks' => array( $task ) ),
		);
	}

	/** @param array<string,mixed> $task */
	private static function task_result_ok( array $task ): bool {
		$code = isset( $task['status_code'] ) ? (int) $task['status_code'] : 0;
		if ( $code === 20000 ) {
			return true;
		}
		return Flowbie_App_Dataforseo_Client::is_benign_empty_task( $task );
	}
}
