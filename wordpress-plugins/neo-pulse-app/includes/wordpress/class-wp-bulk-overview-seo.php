<?php
/**
 * Bulk overview SEO writes (POST /bulk-update-overview-seo, /update-overview-seo-item).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Wp_Bulk_Overview_Seo {

	const NEO_PULSE_BULK_ITEMS_MAX = 500;
	const WP_REST_BATCH_V1_MAX   = 25;

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function update_overview_seo_item( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$item         = isset( $body['item'] ) && is_array( $body['item'] ) ? $body['item'] : null;

		if ( $site_url === '' || $username === '' || $app_password === '' || ! $item ) {
			return array(
				400,
				array(
					'success' => false,
					'ok'      => false,
					'error'   => 'Missing required fields: siteUrl, username, appPassword, item',
				),
			);
		}

		$post_id = Neo_Pulse_App_Wp_Url_Normalize::normalize_post_id( isset( $item['postId'] ) ? $item['postId'] : null );
		if ( $post_id === null ) {
			return array( 400, array( 'success' => false, 'ok' => false, 'postId' => null, 'error' => 'Invalid postId' ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$run_item   = array(
			'index'            => 0,
			'postId'           => $post_id,
			'postType'         => isset( $item['postType'] ) ? $item['postType'] : 'post',
			'postTypeEndpoint' => isset( $item['postTypeEndpoint'] ) ? $item['postTypeEndpoint'] : null,
			'acf'              => isset( $item['acf'] ) ? $item['acf'] : null,
			'postTitle'        => isset( $item['postTitle'] ) ? $item['postTitle'] : null,
			'postExcerpt'      => isset( $item['postExcerpt'] ) ? $item['postExcerpt'] : null,
			'postContent'      => isset( $item['postContent'] ) ? $item['postContent'] : null,
		);
		$results = self::bulk_write_items( $normalized, $username, $app_password, array( $run_item ) );
		$r       = isset( $results[0] ) ? $results[0] : array( 'ok' => false, 'error' => 'No result returned.' );

		return array(
			200,
			array(
				'success'    => ! empty( $r['ok'] ),
				'ok'         => ! empty( $r['ok'] ),
				'postId'     => $post_id,
				'error'      => isset( $r['error'] ) ? $r['error'] : null,
				'method'     => isset( $r['method'] ) ? $r['method'] : 'direct_put',
				'httpStatus' => isset( $r['httpStatus'] ) ? $r['httpStatus'] : null,
			),
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>,2?:string} status, data, optional content-type hint.
	 */
	public static function bulk_update_overview_seo( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$items        = isset( $body['items'] ) && is_array( $body['items'] ) ? $body['items'] : null;

		if ( $site_url === '' || $username === '' || $app_password === '' || ! is_array( $items ) ) {
			return array( 400, array( 'success' => false, 'error' => 'Missing required fields: siteUrl, username, appPassword, items[]' ) );
		}
		if ( ! $items ) {
			return array( 400, array( 'success' => false, 'error' => 'items array is empty' ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$to_run     = array();
		$skipped    = array();

		foreach ( $items as $index => $raw ) {
			$post_id = Neo_Pulse_App_Wp_Url_Normalize::normalize_post_id( isset( $raw['postId'] ) ? $raw['postId'] : null );
			if ( $post_id === null ) {
				$skipped[] = array( 'index' => $index, 'error' => 'Invalid postId', 'skip' => true );
				continue;
			}
			$to_run[] = array(
				'index'            => $index,
				'postId'           => $post_id,
				'postType'         => isset( $raw['postType'] ) ? $raw['postType'] : 'post',
				'postTypeEndpoint' => isset( $raw['postTypeEndpoint'] ) ? $raw['postTypeEndpoint'] : null,
				'acf'              => isset( $raw['acf'] ) ? $raw['acf'] : null,
				'postTitle'        => isset( $raw['postTitle'] ) ? $raw['postTitle'] : null,
				'postExcerpt'      => isset( $raw['postExcerpt'] ) ? $raw['postExcerpt'] : null,
				'postContent'      => isset( $raw['postContent'] ) ? $raw['postContent'] : null,
			);
		}

		$progress_events = array();
		$run_results     = self::bulk_write_items(
			$normalized,
			$username,
			$app_password,
			$to_run,
			function ( $event ) use ( &$progress_events ) {
				$progress_events[] = array_merge( array( 'type' => 'progress' ), $event );
			}
		);

		$results = array();
		foreach ( $skipped as $s ) {
			$results[] = array(
				'postId' => null,
				'index'  => $s['index'],
				'ok'     => false,
				'error'  => isset( $s['error'] ) ? $s['error'] : 'Skipped',
			);
		}
		foreach ( $run_results as $r ) {
			$results[] = $r;
		}
		usort(
			$results,
			static function ( $a, $b ) {
				return ( $a['index'] ?? 0 ) <=> ( $b['index'] ?? 0 );
			}
		);

		$ok_count = count(
			array_filter(
				$results,
				static function ( $x ) {
					return ! empty( $x['ok'] );
				}
			)
		);

		$ndjson = $progress_events;
		$ndjson[] = array(
			'type'    => 'done',
			'success' => $ok_count > 0 || ! $results,
			'results' => $results,
			'okCount' => $ok_count,
			'total'   => count( $items ),
		);

		return array(
			200,
			array(
				'ndjson'  => $ndjson,
				'success' => $ok_count > 0 || ! $results,
				'results' => $results,
				'okCount' => $ok_count,
				'total'   => count( $items ),
			),
			'application/x-ndjson',
		);
	}

	/**
	 * @param string                             $normalized Site URL.
	 * @param string                             $username User.
	 * @param string                             $app_password Password.
	 * @param array<int,array<string,mixed>>     $to_run Items.
	 * @param callable|null                      $on_batch Progress callback.
	 * @return array<int,array<string,mixed>>
	 */
	public static function bulk_write_items( $normalized, $username, $app_password, $to_run, $on_batch = null ) {
		$run_results   = array();
		$writable      = 0;
		foreach ( $to_run as $item ) {
			if ( Neo_Pulse_App_Wp_Overview_Seo_Item::build_core_put_body( $item ) || Neo_Pulse_App_Wp_Overview_Seo_Item::has_acf_payload( $item ) ) {
				++$writable;
			}
		}
		$cumulative = 0;

		for ( $i = 0; $i < count( $to_run ); $i += self::WP_REST_BATCH_V1_MAX ) {
			$slice = array_slice( $to_run, $i, self::WP_REST_BATCH_V1_MAX );
			$batch_results = array();

			foreach ( $slice as $item ) {
				$core = Neo_Pulse_App_Wp_Overview_Seo_Item::build_core_put_body( $item );
				$acf  = Neo_Pulse_App_Wp_Overview_Seo_Item::has_acf_payload( $item );

				if ( ! $core && ! $acf ) {
					$row = array(
						'postId' => $item['postId'],
						'index'  => $item['index'],
						'ok'     => false,
						'error'  => 'Nothing to update (empty title, excerpt, content, and acf)',
						'method' => 'direct_put',
					);
				} elseif ( ! $core && $acf ) {
					$acf_result = Neo_Pulse_App_Wp_Overview_Seo_Item::write_acf_via_post( $normalized, $username, $app_password, $item );
					$row        = array(
						'postId'     => $item['postId'],
						'index'      => $item['index'],
						'ok'         => ! empty( $acf_result['ok'] ),
						'error'      => empty( $acf_result['ok'] ) ? ( $acf_result['error'] ?? 'ACF write failed' ) : null,
						'method'     => 'acf_post',
						'httpStatus' => $acf_result['httpStatus'] ?? null,
					);
				} else {
					$core_row = Neo_Pulse_App_Wp_Overview_Seo_Item::write_core_via_direct_put( $normalized, $username, $app_password, $item );
					$row      = Neo_Pulse_App_Wp_Overview_Seo_Item::finalize_with_optional_acf( $normalized, $username, $app_password, $item, $core_row );
				}

				$batch_results[] = $row;
				$run_results[]   = $row;
			}

			$cumulative += count( $batch_results );
			if ( is_callable( $on_batch ) ) {
				call_user_func(
					$on_batch,
					array(
						'done'          => $cumulative,
						'total'         => $writable,
						'wpBatch'       => (int) floor( $i / self::WP_REST_BATCH_V1_MAX ) + 1,
						'wpBatchCount'  => (int) ceil( count( $to_run ) / self::WP_REST_BATCH_V1_MAX ),
						'batchResults'  => $batch_results,
					)
				);
			}
		}

		return $run_results;
	}
}
