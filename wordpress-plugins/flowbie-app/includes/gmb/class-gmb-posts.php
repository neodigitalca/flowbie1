<?php
/**
 * Google Business Profile post routes (stubs matching Node response shapes).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Gmb_Posts {

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

		return array(
			'statusCode' => 501,
			'body'       => array(
				'success'              => false,
				'error'                => 'GMB posts inventory is not implemented in flowbie-app yet.',
				'posts'                => array(),
				'csv'                  => '',
				'excludeCtaUrls'       => array(),
				'excludeRecentMediaUrls' => array(),
				'count'                => 0,
			),
		);
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
			$api_key = Flowbie_App_Secrets::openrouter_api_key();
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

		return array(
			'statusCode' => 501,
			'body'       => array(
				'success'  => false,
				'error'    => 'GMB pick-blog-post is not implemented in flowbie-app yet.',
				'blogPost' => null,
			),
		);
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
			$api_key = Flowbie_App_Secrets::openrouter_api_key();
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

		$publish = ! array_key_exists( 'publish', $body ) || ! empty( $body['publish'] );

		return array(
			'statusCode' => 501,
			'body'       => array(
				'success'   => false,
				'error'     => 'GMB publish-from-harness is not implemented in flowbie-app yet.',
				'preview'   => array(
					'summary'          => '',
					'moneyPageUrl'     => $blog_url,
					'moneyPageReason'  => '',
					'imageSearchTerms' => 'library',
					'media'            => array(),
					'linkedBlog'       => null,
				),
				'published' => false,
				'scheduled' => ! empty( $body['scheduledPublishAt'] ),
			) + ( $publish ? array() : array( 'published' => false ) ),
		);
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function process_schedule_queue(): array {
		if ( ! Flowbie_App_Gmb_Oauth::is_configured() ) {
			return array(
				'statusCode' => 503,
				'body'       => array(
					'success' => false,
					'error'   => 'GMB not configured.',
				),
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'  => true,
				'processed' => 0,
				'failed'    => 0,
				'skipped'   => 0,
				'message'   => 'GBP schedule queue is not implemented in flowbie-app yet.',
			),
		);
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}|null
	 */
	private static function require_connected(): ?array {
		if ( ! Flowbie_App_Gmb_Oauth::is_configured() ) {
			return array(
				'statusCode' => 503,
				'body'       => array(
					'success' => false,
					'error'   => 'GMB not configured.',
				),
			);
		}

		$tokens = Flowbie_App_Gmb_Tokens::get_tokens();
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
