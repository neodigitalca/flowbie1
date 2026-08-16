<?php
/**
 * DataForSEO Google AI Mode task-post + poll + domain rank enrichment.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Dataforseo_Ai_Mode {

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|WP_Error
	 */
	public static function run( array $body ) {
		if ( empty( $body['keyword'] ) ) {
			return new WP_Error( 'neo-pulse_dfs_validate', 'keyword is required', array( 'status' => 400 ) );
		}

		$location_code = Neo_Pulse_App_Dataforseo_Client::location_code_from_name( $body['location_name'] ?? null );
		$lang          = Neo_Pulse_App_Dataforseo_Client::ensure_language_code( $body['language_code'] ?? 'en' );
		$min_dr        = isset( $body['min_dr'] ) ? (int) $body['min_dr'] : 60;

		$post = Neo_Pulse_App_Dataforseo_Client::post(
			'serp/google/ai_mode/task_post',
			array(
				array(
					'keyword'       => (string) $body['keyword'],
					'location_code' => $location_code,
					'language_code' => $lang,
					'device'        => 'desktop',
				),
			)
		);
		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$task_id = $post['tasks'][0]['id'] ?? null;
		if ( ! $task_id ) {
			return new WP_Error( 'neo-pulse_dfs_ai_mode', 'No task created from ai_mode/task_post' );
		}

		$deadline  = time() + 120;
		$ai_result = null;
		while ( time() < $deadline ) {
			sleep( 3 );
			$ready = Neo_Pulse_App_Dataforseo_Client::get( 'serp/google/ai_mode/tasks_ready' );
			if ( is_wp_error( $ready ) ) {
				continue;
			}
			$found = false;
			foreach ( $ready['tasks'] ?? array() as $rt ) {
				foreach ( $rt['result'] ?? array() as $r ) {
					if ( isset( $r['id'] ) && $r['id'] === $task_id ) {
						$found = true;
						break 2;
					}
				}
			}
			if ( $found ) {
				$ai_result = Neo_Pulse_App_Dataforseo_Client::get(
					'serp/google/ai_mode/task_get/advanced/' . rawurlencode( (string) $task_id )
				);
				break;
			}
		}

		if ( ! is_array( $ai_result ) ) {
			return new WP_Error( 'neo-pulse_dfs_ai_mode', 'AI Mode task timed out after 120s' );
		}

		$check = Neo_Pulse_App_Dataforseo_Client::assert_task_ok( $ai_result, false );
		if ( is_wp_error( $check ) ) {
			return $check;
		}

		$candidates   = self::extract_domains( $ai_result );
		$domain_ranks = array();
		if ( $candidates !== array() ) {
			$bulk = Neo_Pulse_App_Dataforseo_Client::post(
				'backlinks/bulk_ranks',
				array(
					array(
						'targets'    => array_slice( $candidates, 0, 100 ),
						'rank_scale' => 'one_hundred',
					),
				),
				array( 'timeout' => 30000 )
			);
			if ( ! is_wp_error( $bulk ) ) {
				foreach ( $bulk['tasks'][0]['result'] ?? array() as $item ) {
					if ( ! empty( $item['target'] ) ) {
						$domain_ranks[ strtolower( (string) $item['target'] ) ] = $item['rank'] ?? null;
					}
				}
			}
		}

		$ranked = array();
		foreach ( $domain_ranks as $domain => $dr ) {
			if ( $dr !== null && (int) $dr >= $min_dr ) {
				$ranked[] = array( 'domain' => $domain, 'dr' => (int) $dr );
			}
		}
		usort(
			$ranked,
			static function ( $a, $b ) {
				return $b['dr'] <=> $a['dr'];
			}
		);
		$ranked = array_slice( $ranked, 0, 10 );

		$ranked_map        = array();
		$candidate_domains = array();
		foreach ( $ranked as $r ) {
			$ranked_map[ $r['domain'] ] = $r['dr'];
			$candidate_domains[]        = $r['domain'];
		}

		$ai_result['_domainRanks']      = $ranked_map;
		$ai_result['_candidateDomains'] = $candidate_domains;
		$ai_result['_allDomainRanks']   = $domain_ranks;
		$ai_result['_minDR']            = $min_dr;

		return $ai_result;
	}

	/**
	 * @param array<string,mixed> $task_result
	 * @return string[]
	 */
	private static function extract_domains( array $task_result ): array {
		$domains = array();
		$add     = static function ( $url ) use ( &$domains ) {
			if ( ! is_string( $url ) || $url === '' ) {
				return;
			}
			$host = wp_parse_url( $url, PHP_URL_HOST );
			if ( ! is_string( $host ) || $host === '' ) {
				return;
			}
			$host = strtolower( preg_replace( '/^www\./', '', $host ) );
			if ( strpos( $host, 'google.com' ) !== false || strpos( $host, 'googleapis.com' ) !== false ) {
				return;
			}
			$domains[ $host ] = true;
		};

		foreach ( $task_result['tasks'][0]['result'] ?? array() as $res_item ) {
			if ( ! is_array( $res_item ) ) {
				continue;
			}
			foreach ( $res_item['ai_overview']['sources'] ?? array() as $s ) {
				$add( $s['url'] ?? '' );
			}
			foreach ( $res_item['items'] ?? array() as $item ) {
				$add( $item['url'] ?? '' );
				foreach ( $item['references'] ?? array() as $ref ) {
					$add( $ref['url'] ?? '' );
					$add( $ref['source']['url'] ?? '' );
				}
			}
			foreach ( $res_item['results'] ?? array() as $r ) {
				$add( $r['url'] ?? '' );
			}
		}

		$local_patterns = array( 'local', 'shop', 'directory', 'dealer', 'store', 'classified' );
		$out            = array_keys( $domains );
		$out            = array_values(
			array_filter(
				$out,
				static function ( $d ) use ( $local_patterns ) {
					if ( substr_count( $d, '.' ) < 1 ) {
						return false;
					}
					foreach ( $local_patterns as $p ) {
						if ( strpos( $d, $p ) !== false ) {
							return false;
						}
					}
					return true;
				}
			)
		);
		return array_slice( $out, 0, 100 );
	}
}
