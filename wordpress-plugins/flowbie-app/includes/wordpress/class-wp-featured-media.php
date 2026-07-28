<?php
/**
 * Featured media batch resolver (POST /resolve-featured-media).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Wp_Featured_Media {

	const BATCH_SIZE = 100;
	const MAX_IDS    = 500;

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function resolve( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';

		if ( $site_url === '' || $username === '' || $app_password === '' ) {
			return array(
				400,
				array(
					'success' => false,
					'error'   => 'Missing required fields: siteUrl, username, appPassword',
				),
			);
		}

		$media_ids = self::sanitize_media_ids( isset( $body['mediaIds'] ) ? $body['mediaIds'] : array() );
		if ( ! $media_ids ) {
			return array( 200, array( 'success' => true, 'urls' => (object) array() ) );
		}

		$normalized = Flowbie_App_Wp_Url_Normalize::normalize_url( $site_url );
		$urls       = array();

		for ( $start = 0; $start < count( $media_ids ); $start += self::BATCH_SIZE ) {
			$batch = array_slice( $media_ids, $start, self::BATCH_SIZE );
			$resp  = Flowbie_App_Wp_Rest_Client::request(
				'GET',
				$normalized . '/wp-json/wp/v2/media',
				$username,
				$app_password,
				array(
					'timeout' => 20,
					'params'  => array(
						'include'    => implode( ',', $batch ),
						'per_page'   => count( $batch ),
						'_fields'    => 'id,source_url,media_type',
					),
				)
			);
			if ( $resp['is_wp_error'] || (int) $resp['status'] !== 200 || ! is_array( $resp['body'] ) ) {
				continue;
			}
			foreach ( $resp['body'] as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				$id         = isset( $item['id'] ) ? (int) $item['id'] : 0;
				$source_url = isset( $item['source_url'] ) ? (string) $item['source_url'] : '';
				$media_type = isset( $item['media_type'] ) ? (string) $item['media_type'] : '';
				if ( $id < 1 || strpos( $source_url, 'http' ) !== 0 ) {
					continue;
				}
				if ( $media_type !== '' && $media_type !== 'image' ) {
					continue;
				}
				$urls[ (string) $id ] = $source_url;
			}
		}

		return array( 200, array( 'success' => true, 'urls' => $urls ) );
	}

	/**
	 * @param mixed $raw Raw mediaIds.
	 * @return int[]
	 */
	private static function sanitize_media_ids( $raw ) {
		$list = is_array( $raw ) ? $raw : array();
		$out  = array();
		$seen = array();
		foreach ( $list as $item ) {
			$id = (int) $item;
			if ( $id < 1 || isset( $seen[ $id ] ) ) {
				continue;
			}
			$seen[ $id ] = true;
			$out[]       = $id;
			if ( count( $out ) >= self::MAX_IDS ) {
				break;
			}
		}
		return $out;
	}
}
