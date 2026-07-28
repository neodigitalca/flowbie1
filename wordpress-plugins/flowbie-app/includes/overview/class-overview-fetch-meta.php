<?php
/**
 * Fetch public page title and meta description for Overview scrape.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Overview_Fetch_Meta {

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function fetch_page_meta( array $body ): array {
		$url = isset( $body['url'] ) ? trim( (string) $body['url'] ) : '';
		if ( $url === '' ) {
			return array( 'statusCode' => 400, 'body' => array( 'error' => 'Missing required field: url' ) );
		}

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 15,
				'headers' => array(
					'User-Agent' => 'Mozilla/5.0 (compatible; Flowbie/1.0; +https://flowbie.ca)',
					'Accept'     => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return array( 'statusCode' => 502, 'body' => array( 'error' => 'Failed to fetch URL: ' . $response->get_error_message() ) );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( 429 === $code ) {
			return array(
				'statusCode' => 429,
				'body'       => array(
					'error' => 'Site rate-limited this request (HTTP 429) after automatic retries. Wait and retry, or ask the host to relax limits for your IP.',
				),
			);
		}
		if ( $code < 200 || $code >= 300 ) {
			return array( 'statusCode' => 502, 'body' => array( 'error' => 'Failed to fetch URL: HTTP ' . $code ) );
		}

		$html = wp_remote_retrieve_body( $response );
		if ( ! is_string( $html ) || $html === '' ) {
			return array( 'statusCode' => 400, 'body' => array( 'error' => 'Empty HTML response received' ) );
		}

		$title = '';
		if ( preg_match( '/<title[^>]*>([\s\S]*?)<\/title>/i', $html, $m ) ) {
			$title = trim( html_entity_decode( wp_strip_all_tags( $m[1] ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
		}

		$meta_description = '';
		if ( preg_match( '/<meta\s+name=["\']description["\'][^>]*content=["\']([\s\S]*?)["\'][^>]*>/i', $html, $m ) ) {
			$meta_description = trim( html_entity_decode( $m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
		}

		$page_heading = '';
		if ( preg_match( '/<h1[^>]*class=["\'][^"\']*elementor-heading-title[^"\']*["\'][^>]*>([\s\S]*?)<\/h1>/i', $html, $m ) ) {
			$page_heading = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $m[1] ) ) );
		} elseif ( preg_match( '/<h1[^>]*>([\s\S]*?)<\/h1>/i', $html, $m ) ) {
			$page_heading = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $m[1] ) ) );
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'url'             => $url,
				'title'           => $title,
				'metaDescription' => $meta_description,
				'pageHeading'     => $page_heading,
				'finalUrl'        => $url,
			),
		);
	}
}
