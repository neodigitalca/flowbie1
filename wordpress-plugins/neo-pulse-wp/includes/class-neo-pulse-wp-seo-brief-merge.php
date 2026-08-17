<?php
/**
 * Merge DataForSEO + GSC + Semrush into SeoContentBriefV1 JSON.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Brief_Merge {

	const DESC_MAX       = 800;
	const PAA_ANSWER_MAX = 600;

	/**
	 * @param array<string,mixed> $input
	 * @return array<string,mixed>
	 */
	public static function build_merged_brief( array $input ): array {
		$dataforseo = self::extract_dataforseo_serp_brief( $input['serpDumpJson'] ?? null );
		$semrush    = self::extract_semrush_brief( $input['semrushOverviewJson'] ?? null );

		return array(
			'version'       => 1,
			'generatedAt'   => gmdate( 'c' ),
			'focusKeyword'  => trim( (string) ( $input['focusKeyword'] ?? '' ) ),
			'pageUrl'       => trim( (string) ( $input['pageUrl'] ?? '' ) ),
			'dataforseo'    => $dataforseo,
			'gsc'           => array(
				'pageUrl' => trim( (string) ( $input['gscPageUrl'] ?? $input['pageUrl'] ?? '' ) ),
				'queries' => self::dedupe_strings( is_array( $input['gscQueries'] ?? null ) ? $input['gscQueries'] : array() ),
			),
			'semrush'       => $semrush,
		);
	}

	/**
	 * @param mixed $serp_root
	 * @return array<string,mixed>
	 */
	public static function extract_dataforseo_serp_brief( $serp_root ): array {
		$empty = array(
			'seedKeyword'             => null,
			'organic'                   => array(),
			'peopleAlsoAsk'             => array(),
			'peopleAlsoSearchPhrases'   => array(),
			'relatedSearches'           => array(),
			'refinementChips'           => array(),
			'popularProducts'           => array(),
		);

		if ( ! is_array( $serp_root ) ) {
			return $empty;
		}

		$task0 = isset( $serp_root['tasks'][0] ) && is_array( $serp_root['tasks'][0] ) ? $serp_root['tasks'][0] : null;
		if ( ! $task0 ) {
			return $empty;
		}

		$seed = self::str( $task0['data']['keyword'] ?? null );
		$first = isset( $task0['result'][0] ) && is_array( $task0['result'][0] ) ? $task0['result'][0] : null;
		if ( ! $first ) {
			return array_merge( $empty, array( 'seedKeyword' => $seed ) );
		}

		$organic                   = array();
		$people_also_ask           = array();
		$people_also_search        = array();
		$related_searches          = array();
		$refinement_chips          = array();
		$popular_products          = array();
		$featured_snippet          = null;
		$items                     = isset( $first['items'] ) && is_array( $first['items'] ) ? $first['items'] : array();

		foreach ( $items as $raw ) {
			if ( ! is_array( $raw ) ) {
				continue;
			}
			$t = self::str( $raw['type'] ?? null );

			if ( 'organic' === $t || 'organic_result' === $t ) {
				$sitelinks = self::organic_sitelinks( $raw['links'] ?? null );
				$row       = array(
					'rank_absolute' => isset( $raw['rank_absolute'] ) && is_numeric( $raw['rank_absolute'] ) ? (int) $raw['rank_absolute'] : null,
					'rank_group'    => isset( $raw['rank_group'] ) && is_numeric( $raw['rank_group'] ) ? (int) $raw['rank_group'] : null,
					'domain'        => self::str( $raw['domain'] ?? null ),
					'url'           => self::str( $raw['url'] ?? null ),
					'title'         => self::str( $raw['title'] ?? null ),
					'description'   => self::clip( $raw['description'] ?? null, self::DESC_MAX ),
				);
				if ( ! empty( $sitelinks ) ) {
					$row['sitelinks'] = $sitelinks;
				}
				$organic[] = array_filter( $row, static function ( $v ) {
					return null !== $v && '' !== $v;
				} );
				if ( ! empty( $raw['is_featured_snippet'] ) && ! $featured_snippet ) {
					$featured_snippet = array(
						'type'        => 'organic_featured',
						'title'       => self::str( $raw['title'] ?? null ),
						'url'         => self::str( $raw['url'] ?? null ),
						'domain'      => self::str( $raw['domain'] ?? null ),
						'description' => self::clip( $raw['description'] ?? null, self::DESC_MAX ),
					);
				}
				continue;
			}

			if ( 'featured_snippet' === $t || 'answer_box' === $t ) {
				$featured_snippet = array(
					'type'        => $t,
					'title'       => self::str( $raw['title'] ?? null ) ?: self::str( $raw['featured_title'] ?? null ),
					'url'         => self::str( $raw['url'] ?? null ),
					'domain'      => self::str( $raw['domain'] ?? null ),
					'description' => self::clip( $raw['description'] ?? ( $raw['snippet'] ?? null ), self::DESC_MAX ),
				);
				continue;
			}

			if ( 'people_also_ask' === $t && is_array( $raw['items'] ?? null ) ) {
				foreach ( $raw['items'] as $el ) {
					$p = self::parse_paa_item( $el );
					if ( $p ) {
						$people_also_ask[] = $p;
					}
				}
				continue;
			}

			if ( 'people_also_search' === $t && is_array( $raw['items'] ?? null ) ) {
				foreach ( $raw['items'] as $x ) {
					if ( is_string( $x ) && trim( $x ) !== '' ) {
						$people_also_search[] = trim( $x );
					}
				}
				continue;
			}

			if ( 'related_searches' === $t && is_array( $raw['items'] ?? null ) ) {
				foreach ( $raw['items'] as $x ) {
					if ( is_string( $x ) && trim( $x ) !== '' ) {
						$related_searches[] = trim( $x );
					}
				}
				continue;
			}

			if ( 'refinement_chips' === $t && is_array( $raw['items'] ?? null ) ) {
				foreach ( $raw['items'] as $el ) {
					if ( ! is_array( $el ) ) {
						continue;
					}
					$etype = self::str( $el['type'] ?? null );
					if ( $etype && false !== strpos( $etype, 'refinement_chips' ) ) {
						$refinement_chips[] = array(
							'title' => self::str( $el['title'] ?? null ),
							'url'   => self::str( $el['url'] ?? null ),
						);
					}
				}
				continue;
			}

			if ( 'popular_products' === $t && is_array( $raw['items'] ?? null ) ) {
				foreach ( $raw['items'] as $el ) {
					if ( ! is_array( $el ) || ( $el['type'] ?? '' ) !== 'popular_products_element' ) {
						continue;
					}
					$price = is_array( $el['price'] ?? null ) ? self::str( $el['price']['displayed_price'] ?? null ) : null;
					$popular_products[] = array_filter(
						array(
							'title'           => self::str( $el['title'] ?? null ),
							'seller'          => self::str( $el['seller'] ?? null ),
							'description'     => self::clip( $el['description'] ?? null, 400 ),
							'displayed_price' => $price,
						),
						static function ( $v ) {
							return null !== $v && '' !== $v;
						}
					);
				}
			}
		}

		$out = array(
			'seedKeyword'           => $seed ?: self::str( $first['keyword'] ?? null ),
			'organic'               => $organic,
			'peopleAlsoAsk'         => $people_also_ask,
			'peopleAlsoSearchPhrases' => $people_also_search,
			'relatedSearches'       => $related_searches,
			'refinementChips'       => $refinement_chips,
			'popularProducts'       => $popular_products,
		);
		if ( $featured_snippet ) {
			$out['featuredSnippet'] = $featured_snippet;
		}
		return $out;
	}

	/**
	 * @param mixed $overview_doc
	 * @return array<string,mixed>
	 */
	public static function extract_semrush_brief( $overview_doc ): array {
		$empty = array(
			'urlOrganicKeywords'    => array(),
			'phraseRelatedKeywords' => array(),
			'urlOrganicUrls'        => array(),
			'phraseRelatedUrls'     => array(),
			'phraseOrganicUrls'     => array(),
			'externalSemrushUrls'   => array(),
		);
		if ( ! is_array( $overview_doc ) ) {
			return $empty;
		}

		$sem = isset( $overview_doc['semrush'] ) && is_array( $overview_doc['semrush'] )
			? $overview_doc['semrush']
			: $overview_doc;

		$as_str_arr = static function ( $key ) use ( $sem ) {
			if ( ! isset( $sem[ $key ] ) || ! is_array( $sem[ $key ] ) ) {
				return array();
			}
			return self::dedupe_strings(
				array_values(
					array_filter(
						array_map(
							static function ( $x ) {
								return is_string( $x ) ? trim( $x ) : '';
							},
							$sem[ $key ]
						)
					)
				)
			);
		};

		$external = $as_str_arr( 'externalSemrushUrls' );
		if ( empty( $external ) && isset( $overview_doc['externalSemrushUrls'] ) && is_array( $overview_doc['externalSemrushUrls'] ) ) {
			$external = self::dedupe_strings(
				array_values(
					array_filter(
						array_map(
							static function ( $x ) {
								return is_string( $x ) ? trim( $x ) : '';
							},
							$overview_doc['externalSemrushUrls']
						)
					)
				)
			);
		}

		return array(
			'urlOrganicKeywords'    => $as_str_arr( 'urlOrganicKeywords' ),
			'phraseRelatedKeywords' => $as_str_arr( 'phraseRelatedKeywords' ),
			'urlOrganicUrls'        => $as_str_arr( 'urlOrganicUrls' ),
			'phraseRelatedUrls'     => $as_str_arr( 'phraseRelatedUrls' ),
			'phraseOrganicUrls'     => $as_str_arr( 'phraseOrganicUrls' ),
			'externalSemrushUrls'   => $external,
		);
	}

	/**
	 * @param mixed $links
	 * @return array<int,array<string,string>>
	 */
	private static function organic_sitelinks( $links ): array {
		if ( ! is_array( $links ) ) {
			return array();
		}
		$out = array();
		foreach ( $links as $l ) {
			if ( ! is_array( $l ) ) {
				continue;
			}
			$title = self::str( $l['title'] ?? null ) ?: self::str( $l['text'] ?? null );
			$url   = self::str( $l['url'] ?? null ) ?: self::str( $l['link'] ?? null );
			if ( $title || $url ) {
				$out[] = array_filter(
					array(
						'title' => $title,
						'url'   => $url,
					)
				);
			}
		}
		return $out;
	}

	/**
	 * @param mixed $el
	 * @return array<string,mixed>|null
	 */
	private static function parse_paa_item( $el ) {
		if ( ! is_array( $el ) ) {
			return null;
		}
		$question = self::str( $el['title'] ?? null );
		if ( ! $question ) {
			return null;
		}
		$answers = array();
		if ( is_array( $el['expanded_element'] ?? null ) ) {
			foreach ( $el['expanded_element'] as $ex ) {
				if ( ! is_array( $ex ) || ( $ex['type'] ?? '' ) !== 'people_also_ask_expanded_element' ) {
					continue;
				}
				$answers[] = array_filter(
					array(
						'url'         => self::str( $ex['url'] ?? null ),
						'domain'      => self::str( $ex['domain'] ?? null ),
						'title'       => self::str( $ex['title'] ?? null ),
						'description' => self::clip( $ex['description'] ?? null, self::PAA_ANSWER_MAX ),
					),
					static function ( $v ) {
						return null !== $v && '' !== $v;
					}
				);
			}
		}
		return array(
			'question'       => $question,
			'seed_question'  => self::str( $el['seed_question'] ?? null ),
			'answers'        => $answers,
		);
	}

	/**
	 * @param array<int,mixed> $list
	 * @return array<int,string>
	 */
	public static function dedupe_strings( array $list ): array {
		$seen = array();
		$out  = array();
		foreach ( $list as $s ) {
			$k = trim( (string) $s );
			if ( $k === '' || isset( $seen[ $k ] ) ) {
				continue;
			}
			$seen[ $k ] = true;
			$out[]      = $k;
		}
		return $out;
	}

	/**
	 * @param mixed $v
	 */
	private static function str( $v ): ?string {
		if ( null === $v ) {
			return null;
		}
		if ( is_string( $v ) ) {
			$t = trim( $v );
			return $t !== '' ? $t : null;
		}
		if ( is_numeric( $v ) ) {
			return (string) $v;
		}
		return null;
	}

	/**
	 * @param mixed $s
	 */
	private static function clip( $s, int $max ): ?string {
		if ( null === $s || ! is_string( $s ) ) {
			return null;
		}
		$t = trim( $s );
		if ( $t === '' ) {
			return null;
		}
		if ( strlen( $t ) <= $max ) {
			return $t;
		}
		return substr( $t, 0, $max ) . '…';
	}
}
