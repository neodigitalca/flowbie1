<?php
/**
 * WordPress post meta routes (get/update meta, update single ACF field).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Wp_Meta {

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function get_post_meta( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$post_id      = Neo_Pulse_App_Wp_Url_Normalize::normalize_post_id( isset( $body['postId'] ) ? $body['postId'] : null );
		$post_type    = isset( $body['postType'] ) ? (string) $body['postType'] : 'post';
		$endpoint     = isset( $body['postTypeEndpoint'] ) ? $body['postTypeEndpoint'] : null;

		if ( $site_url === '' || $username === '' || $app_password === '' || $post_id === null ) {
			return array( 400, array( 'success' => false, 'error' => 'Missing required fields: siteUrl, username, appPassword, postId' ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$collection = Neo_Pulse_App_Wp_Url_Normalize::resolve_wp_v2_collection_endpoint( $endpoint, $post_type );
		$url        = $normalized . '/wp-json/wp/v2/' . rawurlencode( $collection ) . '/' . $post_id . '?context=edit';

		$resp = Neo_Pulse_App_Wp_Rest_Client::request( 'GET', $url, $username, $app_password, array( 'timeout' => 30 ) );
		if ( $resp['is_wp_error'] ) {
			return array( 500, array( 'success' => false, 'error' => $resp['error'] ) );
		}

		$status = (int) $resp['status'];
		if ( $status === 401 ) {
			return array( 401, array( 'success' => false, 'error' => 'Authentication failed. Please verify your username and application password.' ) );
		}
		if ( $status === 404 ) {
			return array( 404, array( 'success' => false, 'error' => 'Post ID ' . $post_id . ' not found in ' . $collection . ' endpoint.' ) );
		}
		if ( $status === 403 ) {
			return array( 403, array( 'success' => false, 'error' => 'Permission denied.' ) );
		}
		if ( $status === 429 ) {
			return array( 429, array( 'success' => false, 'error' => 'WordPress still rate-limited (HTTP 429) after automatic retries.' ) );
		}
		if ( $status !== 200 || ! is_array( $resp['body'] ) ) {
			$msg = is_array( $resp['body'] ) && ! empty( $resp['body']['message'] ) ? (string) $resp['body']['message'] : 'WordPress API error';
			return array( $status, array( 'success' => false, 'error' => $msg ) );
		}

		$post = $resp['body'];
		$acf  = Neo_Pulse_App_Wp_Url_Normalize::rest_acf_from_post( $post );
		$acf  = is_array( $acf ) ? $acf : array();

		return array(
			200,
			array(
				'success' => true,
				'postId'  => $post_id,
				'meta'    => isset( $post['meta'] ) && is_array( $post['meta'] ) ? $post['meta'] : array(),
				'acf'     => $acf,
				'title'   => Neo_Pulse_App_Wp_Url_Normalize::rendered_text( $post['title'] ?? '' ),
				'content' => Neo_Pulse_App_Wp_Url_Normalize::rendered_text( $post['content'] ?? '' ),
				'excerpt' => Neo_Pulse_App_Wp_Url_Normalize::rendered_text( $post['excerpt'] ?? '' ),
				'link'    => (string) ( $post['link'] ?? '' ),
			),
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function update_post_meta( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$post_id      = Neo_Pulse_App_Wp_Url_Normalize::normalize_post_id( isset( $body['postId'] ) ? $body['postId'] : null );
		$post_type    = isset( $body['postType'] ) ? (string) $body['postType'] : 'post';
		$endpoint     = isset( $body['postTypeEndpoint'] ) ? $body['postTypeEndpoint'] : null;
		$meta         = isset( $body['meta'] ) && is_array( $body['meta'] ) ? $body['meta'] : null;
		$post_title   = isset( $body['postTitle'] ) ? $body['postTitle'] : null;
		$post_excerpt = isset( $body['postExcerpt'] ) ? $body['postExcerpt'] : null;

		if ( $site_url === '' || $username === '' || $app_password === '' || $post_id === null || ! is_array( $meta ) ) {
			return array( 400, array( 'success' => false, 'error' => 'Missing required fields: siteUrl, username, appPassword, postId, meta' ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$collection = Neo_Pulse_App_Wp_Url_Normalize::resolve_wp_v2_collection_endpoint( $endpoint, $post_type );
		$base_url   = $normalized . '/wp-json/wp/v2/' . rawurlencode( $collection ) . '/' . $post_id;

		$current_post = null;
		$get_resp     = Neo_Pulse_App_Wp_Rest_Client::request(
			'GET',
			$base_url . '?context=edit',
			$username,
			$app_password,
			array( 'timeout' => 30 )
		);
		if ( ! $get_resp['is_wp_error'] && (int) $get_resp['status'] === 200 && is_array( $get_resp['body'] ) ) {
			$current_post = $get_resp['body'];
		}

		$update_data = array( 'meta' => $meta );
		$has_title   = is_string( $post_title );
		$has_excerpt = is_string( $post_excerpt );

		if ( $current_post ) {
			if ( $has_title ) {
				$update_data['title'] = $post_title;
			} elseif ( ! empty( $meta['rank_math_title'] ) && is_string( $meta['rank_math_title'] ) && trim( $meta['rank_math_title'] ) !== '' ) {
				$update_data['title'] = trim( $meta['rank_math_title'] );
			} else {
				$update_data['title'] = Neo_Pulse_App_Wp_Url_Normalize::rendered_text( $current_post['title'] ?? '' );
			}
			if ( $has_excerpt ) {
				$update_data['excerpt'] = $post_excerpt;
			} elseif ( ! empty( $meta['rank_math_description'] ) && is_string( $meta['rank_math_description'] ) && trim( $meta['rank_math_description'] ) !== '' ) {
				$update_data['excerpt'] = trim( $meta['rank_math_description'] );
			}
		} else {
			if ( $has_title ) {
				$update_data['title'] = $post_title;
			}
			if ( $has_excerpt ) {
				$update_data['excerpt'] = $post_excerpt;
			}
		}

		$resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'PUT',
			$base_url,
			$username,
			$app_password,
			array(
				'timeout' => 30,
				'body'    => $update_data,
			)
		);

		if ( $resp['is_wp_error'] ) {
			return array( 500, array( 'success' => false, 'error' => $resp['error'] ) );
		}

		$status = (int) $resp['status'];
		if ( $status === 401 ) {
			return array( 401, array( 'success' => false, 'error' => 'Authentication failed.' ) );
		}
		if ( $status === 404 ) {
			return array( 404, array( 'success' => false, 'error' => 'Post not found.' ) );
		}
		if ( $status === 403 ) {
			return array( 403, array( 'success' => false, 'error' => 'Permission denied.' ) );
		}
		if ( $status === 429 ) {
			return array( 429, array( 'success' => false, 'error' => 'WordPress still rate-limited (HTTP 429).' ) );
		}
		if ( $status !== 200 && $status !== 201 ) {
			$msg = is_array( $resp['body'] ) && ! empty( $resp['body']['message'] ) ? (string) $resp['body']['message'] : 'Update failed';
			return array( $status, array( 'success' => false, 'error' => $msg ) );
		}

		$verified_focus = null;
		$verify         = Neo_Pulse_App_Wp_Rest_Client::request(
			'GET',
			$base_url . '?context=edit',
			$username,
			$app_password,
			array( 'timeout' => 30 )
		);
		if ( ! $verify['is_wp_error'] && (int) $verify['status'] === 200 && is_array( $verify['body']['meta'] ?? null ) ) {
			$verified_focus = $verify['body']['meta']['rank_math_focus_keyword'] ?? null;
		}

		return array(
			200,
			array(
				'success'              => true,
				'postId'               => $post_id,
				'updated'              => true,
				'verifiedFocusKeyword' => $verified_focus,
			),
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function update_acf_field( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$post_id      = Neo_Pulse_App_Wp_Url_Normalize::normalize_post_id( isset( $body['postId'] ) ? $body['postId'] : null );
		$field_name   = isset( $body['fieldName'] ) ? (string) $body['fieldName'] : '';
		$field_value  = array_key_exists( 'fieldValue', $body ) ? $body['fieldValue'] : null;
		$post_type    = isset( $body['postType'] ) ? (string) $body['postType'] : 'post';
		$endpoint     = isset( $body['postTypeEndpoint'] ) ? $body['postTypeEndpoint'] : null;

		if ( $site_url === '' || $username === '' || $app_password === '' || $post_id === null || $field_name === '' || ! array_key_exists( 'fieldValue', $body ) ) {
			return array( 400, array( 'success' => false, 'error' => 'Missing required fields: siteUrl, username, appPassword, postId, fieldName, fieldValue' ) );
		}

		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$collection = Neo_Pulse_App_Wp_Url_Normalize::resolve_wp_v2_collection_endpoint( $endpoint, $post_type );

		$validation = Neo_Pulse_App_Wp_Acf_Protocol::validate_acf_setup( $site_url, $username, $app_password, $post_type, $endpoint, $post_id );
		if ( empty( $validation['hasAcfSupport'] ) ) {
			return array(
				200,
				array(
					'success'        => false,
					'error'          => 'ACF REST API not available. Ensure ACF Pro 5.11+ is installed and REST API filters are configured.',
					'validation'     => $validation,
					'requiredConfig' => array(
						'php' => array(
							"add_filter('acf/rest_api/field_settings/show_in_rest', '__return_true');",
							"add_filter('acf/rest_api/field_settings/editable', '__return_true');",
						),
					),
				),
			);
		}

		$serialized = Neo_Pulse_App_Wp_Acf_Protocol::serialize_acf_value( $field_value );
		$update_url = $normalized . '/wp-json/wp/v2/' . rawurlencode( $collection ) . '/' . $post_id;

		$resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'POST',
			$update_url,
			$username,
			$app_password,
			array(
				'timeout' => 30,
				'body'    => array(
					'acf' => array(
						$field_name => $serialized,
					),
				),
			)
		);

		if ( $resp['is_wp_error'] ) {
			return array( 200, array( 'success' => false, 'error' => $resp['error'] ) );
		}

		$status = (int) $resp['status'];
		if ( $status === 401 || $status === 403 || $status === 404 ) {
			$messages = array(
				401 => 'Authentication failed.',
				403 => 'Permission denied.',
				404 => 'Post not found.',
			);
			return array( 200, array( 'success' => false, 'error' => $messages[ $status ] ) );
		}
		if ( $status !== 200 && $status !== 201 ) {
			$msg = is_array( $resp['body'] ) && ! empty( $resp['body']['message'] ) ? (string) $resp['body']['message'] : 'ACF field update failed';
			return array( 200, array( 'success' => false, 'error' => $msg, 'validation' => $validation ) );
		}

		$verified     = false;
		$actual_value = null;
		$verify       = Neo_Pulse_App_Wp_Rest_Client::request(
			'GET',
			$update_url . '?context=edit',
			$username,
			$app_password,
			array( 'timeout' => 15 )
		);
		if ( ! $verify['is_wp_error'] && (int) $verify['status'] === 200 ) {
			$acf_payload = Neo_Pulse_App_Wp_Url_Normalize::rest_acf_from_post( is_array( $verify['body'] ) ? $verify['body'] : array() );
			if ( is_array( $acf_payload ) && array_key_exists( $field_name, $acf_payload ) ) {
				$actual_value = $acf_payload[ $field_name ];
				$verified     = ( $actual_value === $serialized ) || ( (string) $actual_value === (string) $serialized );
			}
		}

		return array(
			200,
			array(
				'success'     => true,
				'method'      => 'acf-rest-api',
				'fieldName'   => $field_name,
				'fieldValue'  => $serialized,
				'verified'    => $verified,
				'actualValue' => $actual_value,
			),
		);
	}
}
