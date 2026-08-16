<?php
/**
 * OpenRouter app attribution for NEO Pulse Web App (neo-pulse-app REST proxy).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Openrouter_Attribution {

	const APP_TITLE = 'NEO Pulse Web App';

	const DEFAULT_HTTP_REFERER = 'https://neodigital.ca/neo-pulse/';

	/**
	 * @return string
	 */
	public static function get_http_referer(): string {
		if ( defined( 'NEO_PULSE_APP_FRONTEND_URL' ) && NEO_PULSE_APP_FRONTEND_URL !== '' ) {
			return trim( (string) NEO_PULSE_APP_FRONTEND_URL );
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
