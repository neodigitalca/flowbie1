<?php
/**
 * OpenRouter app attribution for Flowbie Web App (flowbie-app REST proxy).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Openrouter_Attribution {

	const APP_TITLE = 'Flowbie Web App';

	const DEFAULT_HTTP_REFERER = 'https://flowbie.ca/flowbie/';

	/**
	 * @return string
	 */
	public static function get_http_referer(): string {
		if ( defined( 'FLOWBIE_APP_FRONTEND_URL' ) && FLOWBIE_APP_FRONTEND_URL !== '' ) {
			return trim( (string) FLOWBIE_APP_FRONTEND_URL );
		}
		return self::DEFAULT_HTTP_REFERER;
	}

	/**
	 * @return string
	 */
	public static function get_app_title(): string {
		return self::APP_TITLE;
	}

	/**
	 * @return array<string, string>
	 */
	public static function attribution_headers(): array {
		return array(
			'HTTP-Referer' => self::get_http_referer(),
			'X-Title'      => self::get_app_title(),
		);
	}

	/**
	 * @param string $api_key
	 * @return array<string, string>
	 */
	public static function request_headers( string $api_key ): array {
		return array_merge(
			array(
				'Content-Type'  => 'application/json',
				'Authorization' => 'Bearer ' . $api_key,
			),
			self::attribution_headers()
		);
	}
}
