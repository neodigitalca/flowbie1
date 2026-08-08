<?php
/**
 * OpenRouter FAQ inventory for proposal site audit.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Proposal_Faq_Inventory {

	const OPENROUTER_URL   = 'https://openrouter.ai/api/v1/chat/completions';
	const DEFAULT_MODEL    = 'google/gemini-2.5-flash-lite';
	const MAX_PAGE_EXCERPT = 8000;

	/**
	 * @param array<int,array{url:string,pageTitle:string,excerpt:string}> $pages
	 * @param array<string,mixed>                                          $opts
	 * @return array<string,mixed>
	 */
	public static function run( array $pages, array $opts = array() ): array {
		$api_key = trim( (string) ( $opts['apiKey'] ?? Flowbie_App_Secrets::openrouter_api_key() ) );
		if ( $api_key === '' ) {
			throw new Exception( 'OPENROUTER_API_KEY is required for FAQ inventory' );
		}

		$trimmed = array();
		foreach ( array_slice( $pages, 0, 10 ) as $p ) {
			$trimmed[] = array(
				'url'       => trim( (string) ( $p['url'] ?? '' ) ),
				'pageTitle' => substr( trim( (string) ( $p['pageTitle'] ?? '' ) ), 0, 300 ),
				'excerpt'   => substr( trim( (string) ( $p['excerpt'] ?? '' ) ), 0, self::MAX_PAGE_EXCERPT ),
			);
		}

		$system = implode(
			' ',
			array(
				'You extract FAQ content from parsed web page text for an SEO proposal.',
				'Return JSON only matching the schema.',
				'Do not invent Q/A pairs not supported by the excerpt.',
				'hasFaqSchemaSignal: true only when excerpt suggests FAQ schema or explicit FAQ markup language.',
				'gaps: short strings describing missing FAQ topics for that page (max 3 per page).',
			)
		);

		$user = wp_json_encode(
			array(
				'pages'        => $trimmed,
				'outputSchema' => array(
					'pages' => array(
						array(
							'url'                => 'string',
							'hasVisibleFaq'      => 'boolean',
							'qaPairs'            => array( array( 'question' => 'string', 'answer' => 'string' ) ),
							'hasFaqSchemaSignal' => 'boolean',
							'gaps'               => array( 'string' ),
						),
					),
				),
			)
		);

		$response = wp_remote_post(
			self::OPENROUTER_URL,
			array(
				'timeout' => 120,
				'headers' => Flowbie_App_Openrouter_Attribution::request_headers( $api_key ),
				'body'    => wp_json_encode(
					array(
						'model'           => self::DEFAULT_MODEL,
						'messages'        => array(
							array( 'role' => 'system', 'content' => $system ),
							array( 'role' => 'user', 'content' => $user ),
						),
						'temperature'     => 0.2,
						'max_tokens'      => 4096,
						'response_format' => array( 'type' => 'json_object' ),
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			throw new Exception( $response->get_error_message() );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$json = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $json ) ? ( $json['error']['message'] ?? $json['message'] ?? wp_remote_retrieve_response_message( $response ) ) : 'OpenRouter error';
			throw new Exception( 'OpenRouter ' . $code . ': ' . $msg );
		}

		$text = trim( (string) ( $json['choices'][0]['message']['content'] ?? '' ) );
		if ( $text === '' ) {
			throw new Exception( 'FAQ inventory returned empty content' );
		}

		$parsed = json_decode( $text, true );
		if ( ! is_array( $parsed ) ) {
			throw new Exception( 'FAQ inventory returned invalid JSON' );
		}

		$page_summaries = is_array( $parsed['pages'] ?? null ) ? $parsed['pages'] : array();
		$pages_with_faq = 0;
		$total_qa       = 0;
		foreach ( $page_summaries as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$pairs = is_array( $row['qaPairs'] ?? null ) ? $row['qaPairs'] : array();
			if ( ( $row['hasVisibleFaq'] ?? false ) === true || $pairs !== array() ) {
				++$pages_with_faq;
			}
			$total_qa += count( $pairs );
		}

		return array(
			'sampleSize'     => count( $trimmed ),
			'pagesWithFaq'   => $pages_with_faq,
			'totalQaPairs'   => $total_qa,
			'pageSummaries'  => array_slice( $page_summaries, 0, 10 ),
		);
	}
}
