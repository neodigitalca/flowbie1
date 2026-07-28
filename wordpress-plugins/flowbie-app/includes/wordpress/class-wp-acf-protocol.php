<?php
/**
 * ACF protocol routes (get/update fields, batch).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Wp_Acf_Protocol {

	const BATCH_MAX = 100;

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function get_acf_fields( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$post_id      = isset( $body['postId'] ) ? $body['postId'] : null;
		$post_type    = isset( $body['postType'] ) ? (string) $body['postType'] : 'post';
		$endpoint     = isset( $body['postTypeEndpoint'] ) ? $body['postTypeEndpoint'] : null;

		if ( $site_url === '' || $username === '' || $app_password === '' || $post_id === null || $post_id === '' ) {
			return array( 400, array( 'success' => false, 'error' => 'Missing required fields: siteUrl, username, appPassword, postId' ) );
		}

		$normalized = Flowbie_App_Wp_Url_Normalize::normalize_url( $site_url );
		$result     = self::fetch_acf_for_post_id( $normalized, $username, $app_password, $post_id, $post_type, $endpoint );
		return array( 200, $result );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function get_acf_fields_batch( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$items        = isset( $body['items'] ) && is_array( $body['items'] ) ? $body['items'] : null;

		if ( $site_url === '' || $username === '' || $app_password === '' ) {
			return array( 400, array( 'error' => 'Missing required fields: siteUrl, username, appPassword' ) );
		}
		if ( ! is_array( $items ) || ! $items ) {
			return array( 400, array( 'error' => 'items must be a non-empty array' ) );
		}
		if ( count( $items ) > self::BATCH_MAX ) {
			return array( 400, array( 'error' => 'items length must be <= ' . self::BATCH_MAX ) );
		}

		$normalized = Flowbie_App_Wp_Url_Normalize::normalize_url( $site_url );
		$results    = array();
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$post_id = isset( $item['postId'] ) ? $item['postId'] : null;
			$r       = self::fetch_acf_for_post_id(
				$normalized,
				$username,
				$app_password,
				$post_id,
				isset( $item['postType'] ) ? $item['postType'] : 'post',
				isset( $item['postTypeEndpoint'] ) ? $item['postTypeEndpoint'] : null
			);
			$id_num    = Flowbie_App_Wp_Url_Normalize::normalize_post_id( $post_id );
			$results[] = array_merge(
				array( 'postId' => $id_num !== null ? $id_num : $post_id ),
				$r
			);
		}
		return array( 200, array( 'results' => $results ) );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function update_acf_fields( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$post_id      = Flowbie_App_Wp_Url_Normalize::normalize_post_id( isset( $body['postId'] ) ? $body['postId'] : null );
		$fields       = isset( $body['fields'] ) && is_array( $body['fields'] ) ? $body['fields'] : null;
		$post_type    = isset( $body['postType'] ) ? (string) $body['postType'] : 'post';
		$endpoint     = isset( $body['postTypeEndpoint'] ) ? $body['postTypeEndpoint'] : null;
		$options      = isset( $body['options'] ) && is_array( $body['options'] ) ? $body['options'] : array();

		if ( $site_url === '' || $username === '' || $app_password === '' || $post_id === null || ! is_array( $fields ) ) {
			return array( 400, array( 'success' => false, 'error' => 'Missing required fields: siteUrl, username, appPassword, postId, fields', 'updated' => array(), 'failed' => array() ) );
		}

		$normalized = Flowbie_App_Wp_Url_Normalize::normalize_url( $site_url );
		$collection = Flowbie_App_Wp_Url_Normalize::resolve_wp_v2_collection_endpoint( $endpoint, $post_type );
		$validation = self::validate_acf_setup( $normalized, $username, $app_password, $collection, $post_id );

		$results = array(
			'success'     => true,
			'updated'     => array(),
			'failed'      => array(),
			'method'      => 'acf-rest-api',
			'diagnostics' => array( 'validation' => $validation ),
		);

		if ( ! empty( $options['validateOnly'] ) ) {
			return array(
				200,
				array(
					'success'     => ! empty( $validation['hasAcfSupport'] ),
					'validation'  => $validation,
					'wouldUpdate' => array_keys( $fields ),
					'currentValues' => isset( $validation['acfFields'] ) ? $validation['acfFields'] : array(),
				),
			);
		}

		$acf_payload = array();
		foreach ( $fields as $name => $value ) {
			$serialized = self::serialize_acf_value( $value );
			if ( $serialized === null || $serialized === '' ) {
				continue;
			}
			if ( in_array( $name, array( 'seo_extra_image', 'extra_image' ), true ) && ( $serialized === '' || $serialized === 0 ) ) {
				continue;
			}
			$acf_payload[ (string) $name ] = $serialized;
		}

		if ( ! $acf_payload ) {
			return array( 200, array_merge( $results, array( 'success' => false, 'error' => 'No valid ACF fields to update' ) ) );
		}

		$url  = $normalized . '/wp-json/wp/v2/' . rawurlencode( $collection ) . '/' . $post_id;
		$resp = Flowbie_App_Wp_Rest_Client::request(
			'POST',
			$url,
			$username,
			$app_password,
			array(
				'timeout' => 30,
				'body'    => array( 'acf' => $acf_payload ),
			)
		);

		if ( $resp['is_wp_error'] || (int) $resp['status'] < 200 || (int) $resp['status'] >= 300 ) {
			$msg = is_array( $resp['body'] ) && ! empty( $resp['body']['message'] ) ? (string) $resp['body']['message'] : ( $resp['error'] ?: 'ACF update failed' );
			return array(
				200,
				array(
					'success'  => false,
					'updated'  => array(),
					'failed'   => array_map(
						static function ( $name ) use ( $msg ) {
							return array( 'field' => $name, 'error' => $msg );
						},
						array_keys( $fields )
					),
					'error'    => $msg,
					'diagnostics' => $results['diagnostics'],
				),
			);
		}

		$results['updated'] = array_keys( $fields );

		if ( ! empty( $options['verifyAfterUpdate'] ) ) {
			usleep( 1000000 );
			$verify = self::fetch_acf_for_post_id( $normalized, $username, $app_password, $post_id, $post_type, $endpoint );
			if ( ! empty( $verify['fields'] ) && is_array( $verify['fields'] ) ) {
				$results['diagnostics']['verifiedValues'] = $verify['fields'];
				foreach ( array_keys( $acf_payload ) as $fname ) {
					$expected = $acf_payload[ $fname ];
					$actual   = isset( $verify['fields'][ $fname ] ) ? $verify['fields'][ $fname ] : null;
					if ( $actual !== $expected && (string) $actual !== (string) $expected ) {
						$results['updated'] = array_values( array_diff( $results['updated'], array( $fname ) ) );
						$results['failed'][] = array(
							'field'         => $fname,
							'error'         => 'Verification failed',
							'expectedValue' => $expected,
							'actualValue'   => $actual,
						);
					}
				}
			}
		}

		$results['success'] = ! $results['failed'] && $results['updated'];
		return array( 200, $results );
	}

	/**
	 * @param mixed $value Field value.
	 * @return mixed
	 */
	public static function serialize_acf_value( $value ) {
		if ( $value === null ) {
			return '';
		}
		if ( is_bool( $value ) || is_numeric( $value ) || is_array( $value ) ) {
			return $value;
		}
		return (string) $value;
	}

	/**
	 * @param string   $normalized Site URL.
	 * @param string   $username User.
	 * @param string   $app_password Password.
	 * @param string   $collection REST collection.
	 * @param int|null $post_id Post ID.
	 * @return array<string,mixed>
	 */
	public static function validate_acf_setup( $normalized, $username, $app_password, $collection, $post_id = null ) {
		$result = array(
			'hasAcfSupport'    => false,
			'acfFields'        => array(),
			'postTypeEndpoint' => $collection,
			'hasPermission'    => false,
			'errors'           => array(),
			'warnings'         => array(),
		);

		if ( $post_id !== null ) {
			$url  = $normalized . '/wp-json/wp/v2/' . rawurlencode( $collection ) . '/' . (int) $post_id . '?context=edit';
			$resp = Flowbie_App_Wp_Rest_Client::request( 'GET', $url, $username, $app_password, array( 'timeout' => 10 ) );
			if ( ! $resp['is_wp_error'] && (int) $resp['status'] === 200 && is_array( $resp['body'] ) ) {
				$result['hasPermission'] = true;
				$acf                     = Flowbie_App_Wp_Url_Normalize::rest_acf_from_post( $resp['body'] );
				if ( $acf !== null ) {
					$result['hasAcfSupport'] = true;
					$result['acfFields']     = is_array( $acf ) ? $acf : array();
				} else {
					$result['errors'][] = 'ACF object not found in REST response.';
				}
			} elseif ( (int) $resp['status'] === 401 || (int) $resp['status'] === 403 ) {
				$result['errors'][] = 'Permission denied.';
			}
			return $result;
		}

		$list_url = $normalized . '/wp-json/wp/v2/' . rawurlencode( $collection ) . '?per_page=1&context=edit';
		$resp     = Flowbie_App_Wp_Rest_Client::request( 'GET', $list_url, $username, $app_password, array( 'timeout' => 10 ) );
		if ( ! $resp['is_wp_error'] && (int) $resp['status'] === 200 ) {
			$result['hasPermission'] = true;
			if ( is_array( $resp['body'] ) && ! empty( $resp['body'][0] ) ) {
				$acf = Flowbie_App_Wp_Url_Normalize::rest_acf_from_post( $resp['body'][0] );
				if ( $acf !== null ) {
					$result['hasAcfSupport'] = true;
					$result['acfFields']     = is_array( $acf ) ? $acf : array();
				}
			} else {
				$result['hasAcfSupport'] = true;
				$result['warnings'][]    = 'No posts found to verify ACF.';
			}
		}
		return $result;
	}

	/**
	 * @param string      $normalized Site URL.
	 * @param string      $username User.
	 * @param string      $app_password Password.
	 * @param mixed       $post_id_raw Post ID.
	 * @param string      $post_type Post type.
	 * @param string|null $endpoint Endpoint override.
	 * @return array<string,mixed>
	 */
	private static function fetch_acf_for_post_id( $normalized, $username, $app_password, $post_id_raw, $post_type, $endpoint ) {
		$post_id = Flowbie_App_Wp_Url_Normalize::normalize_post_id( $post_id_raw );
		$result  = array(
			'success'  => false,
			'fields'   => array(),
			'fullPost' => null,
			'error'    => null,
		);
		if ( $post_id === null ) {
			$result['error'] = 'Invalid postId';
			return $result;
		}

		$collection = Flowbie_App_Wp_Url_Normalize::resolve_wp_v2_collection_endpoint( $endpoint, $post_type );
		$url        = $normalized . '/wp-json/wp/v2/' . rawurlencode( $collection ) . '/' . $post_id . '?context=edit';
		$resp       = Flowbie_App_Wp_Rest_Client::request( 'GET', $url, $username, $app_password, array( 'timeout' => 15 ) );

		if ( $resp['is_wp_error'] ) {
			$result['error'] = $resp['error'];
			return $result;
		}
		if ( (int) $resp['status'] !== 200 || ! is_array( $resp['body'] ) ) {
			$result['error'] = is_array( $resp['body'] ) && ! empty( $resp['body']['message'] ) ? (string) $resp['body']['message'] : 'Fetch failed';
			return $result;
		}

		$acf = Flowbie_App_Wp_Url_Normalize::rest_acf_from_post( $resp['body'] );
		if ( $acf !== null ) {
			$result['success']  = true;
			$result['fields']   = is_array( $acf ) ? $acf : array();
			$result['fullPost'] = $resp['body'];
		} else {
			$result['fullPost'] = $resp['body'];
			$result['error']    = 'ACF object not found in response. Ensure ACF REST API is configured.';
			$result['hint']      = "Add: add_filter('acf/rest_api/field_settings/show_in_rest', '__return_true');";
		}
		return $result;
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function get_acf_fields_by_url( $body ) {
		return Flowbie_App_Wp_Acf_By_Url::get_acf_fields_by_url( $body );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function get_acf_fields_by_url_batch( $body ) {
		return Flowbie_App_Wp_Acf_By_Url::get_acf_fields_by_url_batch( $body );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function discover_acf_field_groups( $body ) {
		return Flowbie_App_Wp_Acf_Discovery::discover_acf_field_groups( $body );
	}
}
