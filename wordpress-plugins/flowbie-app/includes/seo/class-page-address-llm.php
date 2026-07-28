<?php
/**
 * OpenRouter address extraction for location pages.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Page_Address_Llm {

	const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
	const TEXT_TRUNCATE  = 18000;

	/**
	 * @param array{html:string,href:string,path:string,apiKey:string,model:string} $opts
	 * @return array{href:string,path:string,address:?string}
	 */
	public static function enrich_one_page( array $opts ): array {
		$html = (string) ( $opts['html'] ?? '' );
		$href = (string) ( $opts['href'] ?? '' );
		$path = (string) ( $opts['path'] ?? '' );

		try {
			$location_detail = self::href_is_location_detail_page( $href );
			if ( ! $location_detail ) {
				$json_ld = Flowbie_App_Local_Business_Schema_Extract::extract_local_business_address_from_html( $html );
				if ( $json_ld && ! empty( $json_ld['label'] ) && is_string( $json_ld['label'] ) && trim( $json_ld['label'] ) !== '' ) {
					return array( 'href' => $href, 'path' => $path, 'address' => trim( $json_ld['label'] ) );
				}
			}

			$text = substr( self::strip_html_to_text( $html ), 0, self::TEXT_TRUNCATE );
			if ( strlen( $text ) < 80 ) {
				return array( 'href' => $href, 'path' => $path, 'address' => null );
			}

			$address = self::openrouter_extract_address(
				array(
					'text'               => $text,
					'pageUrl'            => $href,
					'apiKey'             => (string) ( $opts['apiKey'] ?? '' ),
					'model'              => (string) ( $opts['model'] ?? '' ),
					'locationDetailPage' => $location_detail,
				)
			);
			return array( 'href' => $href, 'path' => $path, 'address' => $address );
		} catch ( Exception $e ) {
			return array( 'href' => $href, 'path' => $path, 'address' => null );
		}
	}

	/**
	 * @template T
	 * @param T[] $items
	 * @param callable(T,int):array{href:string,path:string,address:?string} $fn
	 * @return array<int,array{href:string,path:string,address:?string}>
	 */
	public static function pool_map( array $items, int $concurrency, callable $fn ): array {
		$results = array();
		$total   = count( $items );
		if ( $total === 0 ) {
			return $results;
		}
		$concurrency = max( 1, min( $concurrency, $total ) );
		$chunks      = array_chunk( $items, (int) ceil( $total / $concurrency ), true );
		foreach ( $chunks as $chunk ) {
			foreach ( $chunk as $index => $item ) {
				$results[ $index ] = $fn( $item, $index );
			}
		}
		ksort( $results );
		return array_values( $results );
	}

	private static function href_is_location_detail_page( string $href ): bool {
		$path = wp_parse_url( $href, PHP_URL_PATH );
		return is_string( $path ) && Flowbie_App_Local_Business_Schema_Extract::is_location_style_path( $path );
	}

	private static function strip_html_to_text( string $html ): string {
		if ( $html === '' ) {
			return '';
		}
		$s = preg_replace( '/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i', ' ', $html );
		$s = preg_replace( '/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/i', ' ', (string) $s );
		$s = preg_replace( '/<[^>]+>/', ' ', (string) $s );
		$s = str_ireplace( array( '&nbsp;', '&amp;', '&lt;', '&gt;' ), array( ' ', '&', '<', '>' ), (string) $s );
		return trim( preg_replace( '/\s+/', ' ', (string) $s ) );
	}

	/**
	 * @param array{text:string,pageUrl:string,apiKey:string,model:string,locationDetailPage:bool} $opts
	 */
	private static function openrouter_extract_address( array $opts ): ?string {
		$system = $opts['locationDetailPage']
			? 'You extract ONE physical street/mailing address for THIS specific location or service area only. The page is a dedicated location/area URL - use the address shown in the main content (hero, map pin, "visit us", local NAP block) that clearly belongs to THIS page. IGNORE site-wide JSON-LD and IGNORE repeated footer/header/sidebar contact blocks that show the same corporate or default address on every page of the site. Return ONLY valid JSON: {"address": "<single full address line>"} or {"address": null} if this page has no distinct street-level address for that area. Do not invent addresses. If unsure, use null.'
			: 'You extract ONE physical street/mailing address visible on a business location web page (street, city, region, postal code, country as typically written). Return ONLY valid JSON with this exact shape: {"address": "<single full address line>"} or {"address": null} if no confident street-level address appears in the text. Do not invent addresses. Do not return PO boxes alone unless that is the only address. If unsure, use null.';

		$user  = "Page URL: {$opts['pageUrl']}\n\nPage text (may be truncated):\n{$opts['text']}";
		$model = trim( $opts['model'] ) !== '' ? trim( $opts['model'] ) : 'google/gemini-2.0-flash-001';

		$response = wp_remote_post(
			self::OPENROUTER_URL,
			array(
				'timeout' => 60,
				'headers' => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . trim( $opts['apiKey'] ),
					'HTTP-Referer'  => defined( 'FLOWBIE_APP_FRONTEND_URL' ) ? (string) FLOWBIE_APP_FRONTEND_URL : 'https://flowbie.ca',
					'X-Title'       => 'Flowbie location page address',
				),
				'body'    => wp_json_encode(
					array(
						'model'       => $model,
						'messages'    => array(
							array( 'role' => 'system', 'content' => $system ),
							array( 'role' => 'user', 'content' => $user ),
						),
						'temperature' => 0.1,
						'max_tokens'  => 400,
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			throw new Exception( $response->get_error_message() );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$json = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $json ) ? ( $json['error']['message'] ?? $json['message'] ?? 'OpenRouter error' ) : 'OpenRouter error';
			throw new Exception( 'OpenRouter ' . $code . ': ' . $msg );
		}

		$raw = trim( (string) ( $json['choices'][0]['message']['content'] ?? '' ) );
		if ( $raw === '' ) {
			return null;
		}

		$raw    = preg_replace( '/^```(?:json)?\s*/i', '', $raw );
		$raw    = preg_replace( '/```\s*$/', '', (string) $raw );
		$parsed = json_decode( trim( (string) $raw ), true );
		if ( ! is_array( $parsed ) || ! isset( $parsed['address'] ) || ! is_string( $parsed['address'] ) ) {
			return null;
		}
		$addr = trim( $parsed['address'] );
		return $addr !== '' ? $addr : null;
	}
}
