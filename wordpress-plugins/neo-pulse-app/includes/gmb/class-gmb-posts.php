<?php
/**
 * Google Business Profile post routes.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Gmb_Posts {

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function posts_inventory( array $body ): array {
		$gate = self::require_connected();
		if ( $gate !== null ) {
			return $gate;
		}

		if ( empty( $body['gbpLocationId'] ) && ( empty( $body['accountId'] ) || empty( $body['locationId'] ) ) ) {
			return array(
				'statusCode' => 400,
				'body'       => array(
					'success' => false,
					'error'   => 'gbpLocationId or (accountId and locationId) required.',
				),
			);
		}

		return Neo_Pulse_App_Gmb_Posts_Api::posts_inventory( $body );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function pick_blog_post( array $body ): array {
		if ( empty( $body['siteUrl'] ) || empty( $body['username'] ) || empty( $body['appPassword'] ) ) {
			return array(
				'statusCode' => 400,
				'body'       => array(
					'success' => false,
					'error'   => 'siteUrl, username, and appPassword are required.',
				),
			);
		}

		$api_key = isset( $body['openRouterApiKey'] ) ? trim( (string) $body['openRouterApiKey'] ) : '';
		if ( $api_key === '' ) {
			$api_key = Neo_Pulse_App_Secrets::openrouter_api_key();
		}
		if ( $api_key === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array(
					'success' => false,
					'error'   => 'openRouterApiKey is required (or set OPENROUTER_API_KEY).',
				),
			);
		}

		return Neo_Pulse_App_Gmb_Posts_Api::pick_blog_post( $body );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function publish_from_harness( array $body ): array {
		$gate = self::require_connected();
		if ( $gate !== null ) {
			return $gate;
		}

		if ( empty( $body['siteUrl'] ) || empty( $body['username'] ) || empty( $body['appPassword'] ) || empty( $body['gbpLocationId'] ) ) {
			return array(
				'statusCode' => 400,
				'body'       => array(
					'success' => false,
					'error'   => 'siteUrl, username, appPassword, and gbpLocationId are required.',
				),
			);
		}

		$blog_url   = isset( $body['blogPostUrl'] ) ? trim( (string) $body['blogPostUrl'] ) : '';
		$blog_title = isset( $body['blogPostTitle'] ) ? trim( (string) $body['blogPostTitle'] ) : '';
		$harness    = isset( $body['harnessMarkdown'] ) ? trim( (string) $body['harnessMarkdown'] ) : '';
		if ( ! ( $blog_url !== '' && $blog_title !== '' ) && $harness === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array(
					'success' => false,
					'error'   => 'blogPostUrl and blogPostTitle, or harnessMarkdown, are required.',
				),
			);
		}

		$api_key = isset( $body['openRouterApiKey'] ) ? trim( (string) $body['openRouterApiKey'] ) : '';
		if ( $api_key === '' ) {
			$api_key = Neo_Pulse_App_Secrets::openrouter_api_key();
		}
		if ( $api_key === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array(
					'success' => false,
					'error'   => 'openRouterApiKey is required (or set OPENROUTER_API_KEY).',
				),
			);
		}

		return Neo_Pulse_App_Gmb_Posts_Api::publish_from_harness( $body );
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function process_schedule_queue(): array {
		if ( ! Neo_Pulse_App_Gmb_Oauth::is_configured() ) {
			return array(
				'statusCode' => 503,
				'body'       => array(
					'success' => false,
					'error'   => 'GMB not configured.',
				),
			);
		}

		$gate = self::require_connected();
		if ( $gate !== null ) {
			return $gate;
		}

		return Neo_Pulse_App_Gmb_Posts_Api::process_schedule_queue();
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}|null
	 */
	private static function require_connected(): ?array {
		if ( ! Neo_Pulse_App_Gmb_Oauth::is_configured() ) {
			return array(
				'statusCode' => 503,
				'body'       => array(
					'success' => false,
					'error'   => 'GMB not configured.',
				),
			);
		}

		$tokens = Neo_Pulse_App_Gmb_Tokens::get_tokens();
		if ( ! is_array( $tokens ) || empty( $tokens['access_token'] ) ) {
			return array(
				'statusCode' => 401,
				'body'       => array(
					'success' => false,
					'error'   => 'Not connected. Use Connect Google Business first.',
				),
			);
		}

		return null;
	}
}
