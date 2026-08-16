<?php
/**
 * GSC low-hanging keyword selection (parity with prompt-bulk-kw-research-agent.ts).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Gsc_Keyword_Select {

	/**
	 * @param array<string,mixed> $site
	 * @param array<string,mixed> $contract
	 * @return array<int,string>
	 */
	public static function select_keywords(
		array $site,
		string $site_kw_json,
		int $number_of_blogs,
		array $contract
	): array {
		$limit = max( 1, min( 50, $number_of_blogs ) );
		$json  = trim( $site_kw_json );
		if ( $json === '' ) {
			return array();
		}

		$doc = json_decode( $json, true );
		if ( ! is_array( $doc ) ) {
			return array();
		}

		$topic    = trim( (string) ( $contract['optionalPrompt'] ?? '' ) );
		$site_ctx = self::connected_site_context( $site );
		$user     = wp_json_encode(
			array(
				'numberOfBlogs'     => $limit,
				'topic'             => $topic,
				'modifier'          => $topic,
				'inventoryUrlCount' => null,
				'CONNECTED_SITE'    => $site_ctx,
				'SITE_KW_JSON'      => $doc,
			)
		);

		try {
			$parsed = Neo_Pulse_App_Chat_Openrouter::json_completion(
				array(
					array(
						'role'    => 'system',
						'content' => Neo_Pulse_App_Agent_Run_Generator_Prompts::gsc_keyword_select_system_prompt(),
					),
					array( 'role' => 'user', 'content' => is_string( $user ) ? $user : '{}' ),
				),
				array( 'temperature' => 0.25, 'maxTokens' => min( 2048, max( 512, $limit * 80 ) ) )
			);
			return self::parse_keywords( $parsed, $limit );
		} catch ( Exception $e ) {
			return self::fallback_keywords( $doc, $limit );
		}
	}

	/**
	 * @param array<string,mixed> $site
	 * @return array<string,mixed>|null
	 */
	private static function connected_site_context( array $site ): ?array {
		$name = trim( (string) ( $site['name'] ?? '' ) );
		$url  = trim( (string) ( $site['siteUrl'] ?? '' ) );
		if ( $name === '' && $url === '' ) {
			return null;
		}
		return array(
			'name'    => $name !== '' ? $name : $url,
			'siteUrl' => $url !== '' ? $url : $name,
		);
	}

	/**
	 * @param array<string,mixed> $parsed
	 * @return array<int,string>
	 */
	private static function parse_keywords( array $parsed, int $limit ): array {
		$raw = is_array( $parsed['keywords'] ?? null ) ? $parsed['keywords'] : array();
		$out = array();
		$seen = array();
		foreach ( $raw as $item ) {
			if ( ! is_string( $item ) ) {
				continue;
			}
			$kw = trim( preg_replace( '/\s+/', ' ', $item ) );
			if ( $kw === '' ) {
				continue;
			}
			$key = strtolower( $kw );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$out[]        = $kw;
			if ( count( $out ) >= $limit ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $doc
	 * @return array<int,string>
	 */
	private static function fallback_keywords( array $doc, int $limit ): array {
		$semrush = is_array( $doc['semrush'] ?? null ) ? $doc['semrush'] : array();
		$gsc     = is_array( $doc['gsc'] ?? null ) ? $doc['gsc'] : array();
		$merged  = array_merge( $semrush, $gsc );
		$out     = array();
		$seen    = array();
		foreach ( $merged as $item ) {
			if ( ! is_string( $item ) ) {
				continue;
			}
			$kw = trim( $item );
			if ( $kw === '' ) {
				continue;
			}
			$key = strtolower( $kw );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$out[]        = $kw;
			if ( count( $out ) >= $limit ) {
				break;
			}
		}
		return $out;
	}
}
