<?php
/**
 * Single overview SEO item write helpers (bulk-overview-seo.js).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Wp_Overview_Seo_Item {

	const WRITE_TIMEOUT = 300;

	/**
	 * @param array<string,mixed> $item Normalized item.
	 * @return array<string,mixed>|null Core PUT body or null.
	 */
	public static function build_core_put_body( $item ) {
		$put = array();
		if ( ! empty( $item['postTitle'] ) && is_string( $item['postTitle'] ) && trim( $item['postTitle'] ) !== '' ) {
			$put['title'] = Neo_Pulse_App_Wp_Url_Normalize::clean_placeholders_and_markdown( trim( $item['postTitle'] ) );
		}
		if ( ! empty( $item['postExcerpt'] ) && is_string( $item['postExcerpt'] ) && trim( $item['postExcerpt'] ) !== '' ) {
			$put['excerpt'] = Neo_Pulse_App_Wp_Url_Normalize::clean_placeholders_and_markdown( trim( $item['postExcerpt'] ) );
		}
		if ( ! empty( $item['postContent'] ) && is_string( $item['postContent'] ) && trim( $item['postContent'] ) !== '' ) {
			$put['content'] = trim( $item['postContent'] );
		}
		if ( ! $put ) {
			return null;
		}
		return $put;
	}

	/**
	 * @param array<string,mixed> $item Item.
	 * @return bool
	 */
	public static function has_acf_payload( $item ) {
		return count( self::direct_acf_from_client( isset( $item['acf'] ) ? $item['acf'] : array() ) ) > 0;
	}

	/**
	 * @param mixed $acf Client ACF map.
	 * @return array<string,string>
	 */
	public static function direct_acf_from_client( $acf ) {
		$out = array();
		if ( ! is_array( $acf ) ) {
			return $out;
		}
		foreach ( $acf as $key => $value ) {
			if ( $value === null || $value === '' ) {
				continue;
			}
			$text = is_string( $value ) ? trim( $value ) : trim( (string) $value );
			if ( $text !== '' ) {
				$out[ (string) $key ] = $text;
			}
		}
		return $out;
	}

	/**
	 * @param string              $normalized Site URL.
	 * @param string              $username User.
	 * @param string              $app_password Password.
	 * @param array<string,mixed> $item Item.
	 * @return array<string,mixed> Result row.
	 */
	public static function write_core_via_direct_put( $normalized, $username, $app_password, $item ) {
		$body = self::build_core_put_body( $item );
		if ( ! $body ) {
			return array(
				'postId'     => $item['postId'],
				'index'      => $item['index'],
				'ok'         => false,
				'error'      => 'Nothing to update (empty title, excerpt, content)',
				'method'     => 'direct_put',
				'httpStatus' => null,
			);
		}
		$endpoint = Neo_Pulse_App_Wp_Url_Normalize::resolve_wp_v2_collection_endpoint(
			isset( $item['postTypeEndpoint'] ) ? $item['postTypeEndpoint'] : null,
			isset( $item['postType'] ) ? $item['postType'] : 'post'
		);
		$post_id = (int) $item['postId'];
		$url     = $normalized . '/wp-json/wp/v2/' . rawurlencode( $endpoint ) . '/' . $post_id;
		$resp    = Neo_Pulse_App_Wp_Rest_Client::request(
			'PUT',
			$url,
			$username,
			$app_password,
			array(
				'timeout' => self::WRITE_TIMEOUT,
				'body'    => $body,
			)
		);
		if ( $resp['is_wp_error'] || (int) $resp['status'] < 200 || (int) $resp['status'] >= 300 ) {
			return array(
				'postId'     => $post_id,
				'index'      => $item['index'],
				'ok'         => false,
				'error'      => self::wp_put_error_message( $resp ),
				'method'     => 'direct_put',
				'httpStatus' => (int) $resp['status'],
			);
		}
		return array(
			'postId'     => $post_id,
			'index'      => $item['index'],
			'ok'         => true,
			'method'     => 'direct_put',
			'httpStatus' => (int) $resp['status'],
		);
	}

	/**
	 * @param string              $normalized Site URL.
	 * @param string              $username User.
	 * @param string              $app_password Password.
	 * @param array<string,mixed> $item Item.
	 * @return array{ok:bool,error?:string,httpStatus?:int|null,skipped?:bool}
	 */
	public static function write_acf_via_post( $normalized, $username, $app_password, $item ) {
		$acf_payload = self::direct_acf_from_client( isset( $item['acf'] ) ? $item['acf'] : array() );
		if ( ! $acf_payload ) {
			return array( 'ok' => true, 'skipped' => true );
		}
		$endpoint = Neo_Pulse_App_Wp_Url_Normalize::resolve_wp_v2_collection_endpoint(
			isset( $item['postTypeEndpoint'] ) ? $item['postTypeEndpoint'] : null,
			isset( $item['postType'] ) ? $item['postType'] : 'post'
		);
		$url  = $normalized . '/wp-json/wp/v2/' . rawurlencode( $endpoint ) . '/' . (int) $item['postId'];
		$resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'POST',
			$url,
			$username,
			$app_password,
			array(
				'timeout' => self::WRITE_TIMEOUT,
				'body'    => array( 'acf' => $acf_payload ),
			)
		);
		if ( $resp['is_wp_error'] ) {
			return array( 'ok' => false, 'error' => $resp['error'], 'httpStatus' => null );
		}
		$st = (int) $resp['status'];
		if ( $st < 200 || $st >= 300 ) {
			return array( 'ok' => false, 'error' => 'ACF write HTTP ' . $st, 'httpStatus' => $st );
		}
		return array( 'ok' => true, 'httpStatus' => $st );
	}

	/**
	 * @param string              $normalized Site URL.
	 * @param string              $username User.
	 * @param string              $app_password Password.
	 * @param array<string,mixed> $item Item.
	 * @param array<string,mixed> $core_row Core write result.
	 * @return array<string,mixed>
	 */
	public static function finalize_with_optional_acf( $normalized, $username, $app_password, $item, $core_row ) {
		if ( empty( $core_row['ok'] ) ) {
			return $core_row;
		}
		if ( ! self::has_acf_payload( $item ) ) {
			return $core_row;
		}
		$acf_result = self::write_acf_via_post( $normalized, $username, $app_password, $item );
		if ( empty( $acf_result['ok'] ) ) {
			return array_merge(
				$core_row,
				array(
					'ok'         => false,
					'error'      => isset( $acf_result['error'] ) ? $acf_result['error'] : 'ACF fields failed to save',
					'method'     => 'direct_put+acf_post',
					'httpStatus' => $acf_result['httpStatus'] ?? $core_row['httpStatus'],
				)
			);
		}
		$core_row['method'] = 'direct_put+acf_post';
		return $core_row;
	}

	/**
	 * @param array{status?:int,body?:mixed,is_wp_error?:bool,error?:string} $resp Response.
	 * @return string
	 */
	public static function wp_put_error_message( $resp ) {
		if ( ! empty( $resp['is_wp_error'] ) ) {
			return (string) $resp['error'];
		}
		$data = isset( $resp['body'] ) ? $resp['body'] : null;
		if ( Neo_Pulse_App_Wp_Url_Normalize::rest_looks_like_cloudflare_challenge( $data ) ) {
			return Neo_Pulse_App_Wp_Url_Normalize::CLOUDFLARE_REST_BLOCKED_MESSAGE;
		}
		if ( is_string( $data ) ) {
			$trim = trim( $data );
			if ( stripos( $trim, '<!doctype' ) === 0 || stripos( $trim, '<html' ) === 0 ) {
				return 'WordPress host returned HTML (HTTP ' . (int) ( $resp['status'] ?? 0 ) . ') instead of JSON.';
			}
			return substr( $trim, 0, 500 );
		}
		if ( is_array( $data ) ) {
			if ( ! empty( $data['message'] ) ) {
				return (string) $data['message'];
			}
			if ( ! empty( $data['code'] ) ) {
				return (string) $data['code'];
			}
		}
		return 'HTTP ' . (int) ( $resp['status'] ?? 0 );
	}
}
