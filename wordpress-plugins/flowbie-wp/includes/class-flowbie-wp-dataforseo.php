<?php
/**
 * DataForSEO SERP fetch for SEO research briefs.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Dataforseo {

	const API_BASE = 'https://api.dataforseo.com/v3';

	/**
	 * @param string              $endpoint Path after /v3 (e.g. serp/google/organic/live/advanced).
	 * @param array<int,mixed>    $tasks
	 * @param int                 $timeout
	 * @return array<string,mixed>|WP_Error
	 */
	public static function post_live( string $endpoint, array $tasks, int $timeout = 120 ) {
		$creds = Flowbie_Wp_Research_Keys::dataforseo();
		if ( $creds['login'] === '' || $creds['password'] === '' ) {
			return new WP_Error(
				'flowbie_dfs_missing',
				__( 'DataForSEO credentials are not configured. Add your login and API password under Flowbie WP → Settings.', 'flowbie-wp' )
			);
		}

		$endpoint = ltrim( $endpoint, '/' );
		$url      = self::API_BASE . '/' . $endpoint;
		$response = wp_remote_post(
			$url,
			array(
				'timeout' => max( 10, min( 300, $timeout ) ),
				'headers' => array(
					'Authorization' => 'Basic ' . base64_encode( $creds['login'] . ':' . $creds['password'] ),
					'Content-Type'  => 'application/json; charset=utf-8',
					'Accept'        => 'application/json',
				),
				'body'    => wp_json_encode( array_values( $tasks ) ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['status_message'] )
				? (string) $data['status_message']
				: ( $raw !== '' ? $raw : sprintf( 'HTTP %d', $code ) );
			return new WP_Error( 'flowbie_dfs_http', $msg, array( 'status' => $code ) );
		}

		if ( ! is_array( $data ) ) {
			return new WP_Error( 'flowbie_dfs_bad_json', __( 'DataForSEO returned an unexpected response.', 'flowbie-wp' ) );
		}

		if ( ! empty( $data['tasks'][0]['status_code'] ) && (int) $data['tasks'][0]['status_code'] !== 20000 ) {
			$task_row = $data['tasks'][0];
			$msg      = isset( $task_row['status_message'] ) ? (string) $task_row['status_message'] : __( 'DataForSEO task failed.', 'flowbie-wp' );
			if ( ! self::is_benign_empty_task( $task_row ) ) {
				return new WP_Error( 'flowbie_dfs_task', $msg );
			}
		}

		return $data;
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function fetch_serp_organic_live_advanced( string $keyword, array $options = array() ) {
		$keyword = trim( $keyword );
		if ( $keyword === '' ) {
			return new WP_Error( 'flowbie_dfs_keyword', __( 'Focus keyword is required for SERP lookup.', 'flowbie-wp' ) );
		}

		$task = array(
			'keyword'                     => $keyword,
			'location_code'               => isset( $options['location_code'] ) ? (int) $options['location_code'] : 2840,
			'language_code'               => isset( $options['language_code'] ) ? (string) $options['language_code'] : 'en',
			'depth'                       => isset( $options['depth'] ) ? (int) $options['depth'] : 10,
			'device'                      => 'desktop',
			'os'                          => 'windows',
			'people_also_ask_click_depth' => isset( $options['people_also_ask_click_depth'] ) ? (int) $options['people_also_ask_click_depth'] : 4,
		);

		return self::post_live( 'serp/google/organic/live/advanced', array( $task ), 120 );
	}

	/**
	 * @param string               $title
	 * @param array<string,string> $location One of location_name or location_coordinate.
	 * @param int                  $limit
	 * @return array<int,mixed>|WP_Error
	 */
	public static function fetch_business_listings_search( string $title, array $location, int $limit = 25 ) {
		$title = trim( $title );
		if ( $title === '' ) {
			return new WP_Error( 'flowbie_dfs_title', __( 'Business title is required for listings search.', 'flowbie-wp' ) );
		}

		$task = array(
			'title' => $title,
			'limit' => max( 1, min( 50, $limit ) ),
		);
		if ( ! empty( $location['location_name'] ) ) {
			$task['location_name'] = trim( (string) $location['location_name'] );
		}
		if ( ! empty( $location['location_coordinate'] ) ) {
			$task['location_coordinate'] = trim( (string) $location['location_coordinate'] );
		}
		if ( empty( $task['location_name'] ) && empty( $task['location_coordinate'] ) ) {
			$task['location_coordinate'] = '39.8283,-98.5795,5000';
		}

		$result = self::post_live(
			'business_data/business_listings/search/live',
			array( $task ),
			120
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return self::extract_task_items( $result );
	}

	/**
	 * @param string               $keyword
	 * @param array<string,string> $location One of location_name or location_coordinate.
	 * @return array<string,mixed>|null|WP_Error
	 */
	public static function fetch_my_business_info( string $keyword, array $location ) {
		$attempt = self::fetch_my_business_info_attempt( $keyword, $location );
		if ( is_wp_error( $attempt['error'] ) ) {
			return $attempt['error'];
		}
		return $attempt['item'];
	}

	/**
	 * @return array{item:?array<string,mixed>,error:?WP_Error}
	 */
	public static function fetch_my_business_info_attempt( string $keyword, array $location ): array {
		$keyword = trim( $keyword );
		if ( $keyword === '' ) {
			return array(
				'item'  => null,
				'error' => new WP_Error( 'flowbie_dfs_keyword', __( 'Keyword is required for Google Business lookup.', 'flowbie-wp' ) ),
			);
		}

		$task = array(
			'keyword'       => $keyword,
			'language_code' => 'en',
		);
		if ( ! empty( $location['location_code'] ) ) {
			$task['location_code'] = (int) $location['location_code'];
		} elseif ( ! empty( $location['location_name'] ) ) {
			$task['location_name'] = trim( (string) $location['location_name'] );
		} elseif ( ! empty( $location['location_coordinate'] ) ) {
			$task['location_coordinate'] = trim( (string) $location['location_coordinate'] );
		} else {
			$task['location_name'] = 'United States';
		}

		$result = self::post_live(
			'business_data/google/my_business_info/live',
			array( $task ),
			120
		);
		if ( is_wp_error( $result ) ) {
			return array(
				'item'  => null,
				'error' => $result,
			);
		}

		$item = self::extract_google_business_item( $result );
		if ( ! is_array( $item ) ) {
			$task_row = isset( $result['tasks'][0] ) && is_array( $result['tasks'][0] ) ? $result['tasks'][0] : array();
			$msg      = isset( $task_row['status_message'] ) ? (string) $task_row['status_message'] : __( 'DataForSEO returned no Google Business item.', 'flowbie-wp' );
			return array(
				'item'  => null,
				'error' => new WP_Error( 'flowbie_dfs_gmb_empty', $msg ),
			);
		}

		return array(
			'item'  => $item,
			'error' => null,
		);
	}

	/**
	 * @param array<string,mixed> $data
	 * @return array<string,mixed>|null
	 */
	private static function extract_google_business_item( array $data ): ?array {
		$items = self::extract_task_items( $data );
		foreach ( $items as $item ) {
			if ( is_array( $item ) && isset( $item['type'] ) && 'google_business_info' === $item['type'] ) {
				return $item;
			}
		}
		if ( is_array( $items[0] ?? null ) && self::looks_like_gmb_item( $items[0] ) ) {
			return $items[0];
		}

		$res_val = $data['tasks'][0]['result'] ?? null;
		if ( is_array( $res_val ) && isset( $res_val[0] ) && is_array( $res_val[0] ) && self::looks_like_gmb_item( $res_val[0] ) ) {
			return $res_val[0];
		}

		return null;
	}

	/**
	 * @param array<string,mixed> $item
	 */
	private static function looks_like_gmb_item( array $item ): bool {
		return ! empty( $item['title'] )
			|| ! empty( $item['phone'] )
			|| ! empty( $item['address'] )
			|| ! empty( $item['address_info'] )
			|| ( isset( $item['type'] ) && 'google_business_info' === $item['type'] );
	}

	/**
	 * @param array<string,mixed> $data
	 * @return array<int,mixed>
	 */
	private static function extract_task_items( array $data ): array {
		$res_val = $data['tasks'][0]['result'] ?? null;
		if ( is_array( $res_val ) && isset( $res_val[0]['items'] ) && is_array( $res_val[0]['items'] ) ) {
			return $res_val[0]['items'];
		}
		if ( is_array( $res_val ) && isset( $res_val['items'] ) && is_array( $res_val['items'] ) ) {
			return $res_val['items'];
		}
		if ( is_array( $res_val ) ) {
			return $res_val;
		}
		return array();
	}

	/**
	 * @param array<string,mixed> $task
	 */
	private static function is_benign_empty_task( array $task ): bool {
		if ( empty( $task['status_code'] ) || (int) $task['status_code'] === 20000 ) {
			return false;
		}
		$sm = strtolower( (string) ( $task['status_message'] ?? '' ) );
		return strpos( $sm, 'no search result' ) !== false
			|| strpos( $sm, 'no results' ) !== false
			|| strpos( $sm, 'no data' ) !== false
			|| strpos( $sm, 'not found' ) !== false;
	}
}
