<?php
/**
 * DataForSEO SERP fetch for SEO research briefs (NEO Pulse App facade).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Dataforseo {

	/**
	 * @param string           $endpoint Path after /v3.
	 * @param array<int,mixed> $tasks
	 * @param int              $timeout Seconds.
	 * @return array<string,mixed>|WP_Error
	 */
	public static function post_live( string $endpoint, array $tasks, int $timeout = 120 ) {
		return Neo_Pulse_App_Dataforseo_Client::post(
			$endpoint,
			$tasks,
			array( 'timeout' => $timeout * 1000 )
		);
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function fetch_serp_organic_live_advanced( string $keyword, array $options = array() ) {
		$keyword = trim( $keyword );
		if ( $keyword === '' ) {
			return new WP_Error( 'neo-pulse_dfs_keyword', 'Focus keyword is required for SERP lookup.' );
		}

		$result = Neo_Pulse_App_Dataforseo_Mcp_Router::dispatch(
			'DataForSEO_serp_organic_live_advanced',
			array_merge(
				$options,
				array( 'keyword' => $keyword )
			)
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return $result;
	}

	/**
	 * @param string               $title
	 * @param array<string,string> $location
	 * @param int                  $limit
	 * @return array<int,mixed>|WP_Error
	 */
	public static function fetch_business_listings_search( string $title, array $location, int $limit = 25 ) {
		$title = trim( $title );
		if ( $title === '' ) {
			return new WP_Error( 'neo-pulse_dfs_title', 'Business title is required for listings search.' );
		}

		$body = array( 'title' => $title, 'limit' => max( 1, min( 50, $limit ) ) );
		if ( ! empty( $location['location_coordinate'] ) ) {
			$body['location_coordinate'] = trim( (string) $location['location_coordinate'] );
		} else {
			$body['location_coordinate'] = '39.8283,-98.5795,5000';
		}

		$result = Neo_Pulse_App_Dataforseo_Mcp_Router::dispatch(
			'DataForSEO_business_data_business_listings_search',
			$body
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return self::extract_task_items( $result );
	}

	/**
	 * @param string               $keyword
	 * @param array<string,string> $location
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
				'error' => new WP_Error( 'neo-pulse_dfs_keyword', 'Keyword is required for Google Business lookup.' ),
			);
		}

		$body = array( 'keyword' => $keyword, 'language_code' => 'en' );
		if ( ! empty( $location['location_code'] ) ) {
			$body['location_code'] = (int) $location['location_code'];
		} elseif ( ! empty( $location['location_name'] ) ) {
			$body['location_name'] = trim( (string) $location['location_name'] );
		} elseif ( ! empty( $location['location_coordinate'] ) ) {
			$body['location_coordinate'] = trim( (string) $location['location_coordinate'] );
		} else {
			$body['location_name'] = 'United States';
		}

		$result = Neo_Pulse_App_Dataforseo_Mcp_Router::dispatch(
			'DataForSEO_business_data_google_my_business_info_live',
			$body
		);
		if ( is_wp_error( $result ) ) {
			return array( 'item' => null, 'error' => $result );
		}

		$item = self::extract_google_business_item( $result );
		if ( ! is_array( $item ) ) {
			$task_row = isset( $result['tasks'][0] ) && is_array( $result['tasks'][0] ) ? $result['tasks'][0] : array();
			$msg      = isset( $task_row['status_message'] ) ? (string) $task_row['status_message'] : 'DataForSEO returned no Google Business item.';
			return array(
				'item'  => null,
				'error' => new WP_Error( 'neo-pulse_dfs_gmb_empty', $msg ),
			);
		}

		return array( 'item' => $item, 'error' => null );
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
}
