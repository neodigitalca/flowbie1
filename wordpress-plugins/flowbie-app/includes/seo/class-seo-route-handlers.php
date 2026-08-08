<?php
/**
 * /api/seo/* route handlers.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Seo_Route_Handlers {

	const ENRICH_MAX_PAGES    = 30;
	const ENRICH_CONCURRENCY  = 4;
	const MAX_SITEMAP_LOCS    = 500;

	/**
	 * @param string              $subpath Route after seo/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === 'local-business-address' && $method === 'POST' ) {
			self::local_business_address( $body );
			return;
		}
		if ( $subpath === 'postal-centroid' && $method === 'POST' ) {
			self::postal_centroid( $body );
			return;
		}
		if ( $subpath === 'discover-locations' && $method === 'POST' ) {
			self::discover_locations( $body );
			return;
		}
		if ( $subpath === 'enrich-location-page-addresses' && $method === 'POST' ) {
			self::enrich_location_page_addresses( $body );
			return;
		}
		if ( $subpath === 'fetch-external-sitemap' && $method === 'POST' ) {
			self::fetch_external_sitemap( $body );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}

	/** @param array<string,mixed> $body */
	private static function local_business_address( array $body ): void {
		try {
			$url = isset( $body['url'] ) ? trim( (string) $body['url'] ) : '';
			if ( $url === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Missing url', 'label' => null ), 400 );
				return;
			}
			$parsed = Flowbie_App_Seo_Http::safe_parse_url( $url );
			if ( ! $parsed ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Invalid url', 'label' => null ), 400 );
				return;
			}

			$fetch = Flowbie_App_Seo_Http::fetch_html( $parsed );
			if ( empty( $fetch['ok'] ) ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'error' => $fetch['error'] ?? 'Failed to fetch page',
						'label' => null,
					),
					502
				);
				return;
			}

			$extracted = Flowbie_App_Local_Business_Schema_Extract::extract_local_business_address_from_html( (string) $fetch['html'] );
			if ( ! $extracted || empty( $extracted['label'] ) ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'label'   => null,
						'source'  => 'json-ld',
						'message' => 'No LocalBusiness (or compatible) address found in JSON-LD on this page.',
					)
				);
				return;
			}

			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'label'  => $extracted['label'],
					'lat'    => $extracted['lat'] ?? null,
					'lng'    => $extracted['lng'] ?? null,
					'source' => 'json-ld',
				)
			);
		} catch ( Exception $e ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'error' => $e->getMessage() ?: 'Failed to fetch page',
					'label' => null,
				),
				502
			);
		}
	}

	/** @param array<string,mixed> $body */
	private static function postal_centroid( array $body ): void {
		try {
			if ( ! Flowbie_App_Postal_Geocode::is_ready() ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'error' => 'Postal geocode data not loaded. Run node scripts/fetch-geonames-postal.mjs',
						'lat'   => null,
						'lng'   => null,
					),
					503
				);
				return;
			}

			$postal  = isset( $body['postalCode'] ) ? trim( (string) $body['postalCode'] ) : '';
			$city    = isset( $body['city'] ) ? trim( (string) $body['city'] ) : '';
			$region  = isset( $body['region'] ) ? trim( (string) $body['region'] ) : '';
			$country = isset( $body['countryCode'] ) ? trim( (string) $body['countryCode'] ) : '';

			if ( $postal === '' && $city === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Provide postalCode or city', 'lat' => null, 'lng' => null ), 400 );
				return;
			}

			$hit = Flowbie_App_Postal_Geocode::lookup(
				array(
					'postalCode'  => $postal,
					'city'        => $city,
					'region'      => $region,
					'countryCode' => $country,
				)
			);

			if ( ! $hit ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'lat'       => null,
						'lng'       => null,
						'placeName' => null,
						'source'    => null,
						'message'   => 'No GeoNames match for postal/city.',
					)
				);
				return;
			}

			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'lat'       => $hit['lat'],
					'lng'       => $hit['lng'],
					'placeName' => $hit['placeName'],
					'source'    => $hit['source'],
				)
			);
		} catch ( Exception $e ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'error' => $e->getMessage() ?: 'Postal geocode failed',
					'lat'   => null,
					'lng'   => null,
				),
				502
			);
		}
	}

	/** @param array<string,mixed> $body */
	private static function discover_locations( array $body ): void {
		try {
			$site_url = isset( $body['siteUrl'] ) ? trim( (string) $body['siteUrl'] ) : '';
			if ( $site_url === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Missing siteUrl' ), 400 );
				return;
			}
			$origin = Flowbie_App_Seo_Http::safe_parse_url( $site_url );
			if ( ! $origin ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Invalid siteUrl' ), 400 );
				return;
			}

			$origin_parts = wp_parse_url( $origin );
			$origin_base  = $origin_parts['scheme'] . '://' . $origin_parts['host'];
			$paths        = array( '/locations/', '/locations', '/location/', '/location', '/our-locations/', '/our-locations', '/store-locator/', '/store-locator', '/find-us/', '/showrooms/', '/' );
			$seen_url     = array();
			$urls         = array();
			foreach ( $paths as $p ) {
				$href = rtrim( $origin_base, '/' ) . ( $p === '/' ? '/' : $p );
				if ( isset( $seen_url[ $href ] ) ) {
					continue;
				}
				$seen_url[ $href ] = true;
				$urls[]            = $href;
			}

			$addresses     = array();
			$page_paths    = array();
			$pages_fetched = array();
			$area_labels   = array();
			$addr_seen     = array();
			$link_seen     = array();
			$area_seen     = array();

			foreach ( $urls as $page_url ) {
				$fetch = Flowbie_App_Seo_Http::fetch_html( $page_url, 18 );
				if ( empty( $fetch['ok'] ) || strlen( (string) $fetch['html'] ) < 80 ) {
					continue;
				}
				$html            = (string) $fetch['html'];
				$pages_fetched[] = $page_url;

				foreach ( Flowbie_App_Local_Business_Schema_Extract::extract_all_addresses_from_html( $html ) as $row ) {
					$k = strtolower( preg_replace( '/\s+/', ' ', $row['label'] ) );
					if ( isset( $addr_seen[ $k ] ) ) {
						continue;
					}
					$addr_seen[ $k ] = true;
					$addresses[]     = $row;
				}
				foreach ( Flowbie_App_Local_Business_Schema_Extract::extract_location_child_page_links( $html, $page_url ) as $link ) {
					if ( isset( $link_seen[ $link['path'] ] ) ) {
						continue;
					}
					$link_seen[ $link['path'] ] = true;
					$page_paths[]               = $link;
				}
				foreach ( Flowbie_App_Local_Business_Schema_Extract::extract_area_served_labels_from_html( $html ) as $label ) {
					$k = strtolower( preg_replace( '/\s+/', ' ', $label ) );
					if ( isset( $area_seen[ $k ] ) ) {
						continue;
					}
					$area_seen[ $k ] = true;
					$area_labels[]   = $label;
				}
				foreach ( Flowbie_App_Local_Business_Schema_Extract::extract_loose_service_area_headings_from_html( $html ) as $label ) {
					$k = strtolower( preg_replace( '/\s+/', ' ', $label ) );
					if ( isset( $area_seen[ $k ] ) ) {
						continue;
					}
					$area_seen[ $k ] = true;
					$area_labels[]   = $label;
				}
			}

			$entity_sitemap = isset( $body['entitySitemapUrl'] ) ? trim( (string) $body['entitySitemapUrl'] ) : '';
			if ( $entity_sitemap !== '' ) {
				$sm = Flowbie_App_Seo_Http::safe_parse_url( $entity_sitemap );
				$sm_parts = $sm ? wp_parse_url( $sm ) : null;
				if ( $sm_parts && ( $sm_parts['scheme'] . '://' . $sm_parts['host'] ) === $origin_base ) {
					$sm_fetch = Flowbie_App_Seo_Http::fetch_html( $sm, 18 );
					if ( ! empty( $sm_fetch['ok'] ) ) {
						$locs = array_slice( Flowbie_App_Seo_Http::extract_locs_from_sitemap_xml( (string) $sm_fetch['html'] ), 0, self::MAX_SITEMAP_LOCS );
						foreach ( $locs as $loc ) {
							$loc_parts = wp_parse_url( trim( $loc ) );
							if ( empty( $loc_parts['scheme'] ) || empty( $loc_parts['host'] ) ) {
								continue;
							}
							if ( ( $loc_parts['scheme'] . '://' . $loc_parts['host'] ) !== $origin_base ) {
								continue;
							}
							$path_only = rtrim( (string) ( $loc_parts['path'] ?? '/' ), '/' );
							if ( $path_only === '' ) {
								$path_only = '/';
							}
							if ( ! Flowbie_App_Local_Business_Schema_Extract::is_location_style_path( $path_only ) ) {
								continue;
							}
							$key = $path_only . ( isset( $loc_parts['query'] ) ? '?' . $loc_parts['query'] : '' );
							if ( isset( $link_seen[ $key ] ) ) {
								continue;
							}
							$link_seen[ $key ] = true;
							$page_paths[]      = array(
								'path' => $key,
								'href' => $loc_parts['scheme'] . '://' . $loc_parts['host'] . $path_only . ( isset( $loc_parts['query'] ) ? '?' . $loc_parts['query'] : '' ),
							);
						}
					}
				}
			}

			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'addresses'         => $addresses,
					'pagePaths'         => $page_paths,
					'pagesFetched'      => $pages_fetched,
					'primarySuggestion' => $addresses ? $addresses[0]['label'] : null,
					'areaLabels'        => $area_labels,
					'primaryAreaLabel'  => Flowbie_App_Seo_Http::pick_primary_area_label( $area_labels ),
				)
			);
		} catch ( Exception $e ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'error'             => $e->getMessage() ?: 'Failed to discover locations',
					'addresses'         => array(),
					'pagePaths'         => array(),
					'pagesFetched'      => array(),
					'primarySuggestion' => null,
					'areaLabels'        => array(),
					'primaryAreaLabel'  => null,
				),
				502
			);
		}
	}

	/** @param array<string,mixed> $body */
	private static function enrich_location_page_addresses( array $body ): void {
		try {
			$api_key = self::openrouter_key_from_request( $body );
			if ( $api_key === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Missing x-openrouter-api-key', 'results' => array() ), 401 );
				return;
			}

			$site_url = isset( $body['siteUrl'] ) ? trim( (string) $body['siteUrl'] ) : '';
			$origin   = Flowbie_App_Seo_Http::safe_parse_url( $site_url );
			if ( ! $origin ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Invalid or missing siteUrl', 'results' => array() ), 400 );
				return;
			}
			$origin_parts   = wp_parse_url( $origin );
			$allowed_origin = $origin_parts['scheme'] . '://' . $origin_parts['host'];
			$pages_in       = isset( $body['pages'] ) && is_array( $body['pages'] ) ? $body['pages'] : array();
			$model          = isset( $body['model'] ) ? trim( (string) $body['model'] ) : '';

			$pages     = array();
			$seen_href = array();
			foreach ( $pages_in as $row ) {
				if ( ! is_array( $row ) ) {
					continue;
				}
				$path     = isset( $row['path'] ) ? (string) $row['path'] : '';
				$href_raw = isset( $row['href'] ) ? trim( (string) $row['href'] ) : '';
				if ( $href_raw === '' || isset( $seen_href[ $href_raw ] ) ) {
					continue;
				}
				$u = Flowbie_App_Seo_Http::safe_parse_url( $href_raw );
				if ( ! $u ) {
					continue;
				}
				$row_parts = wp_parse_url( $u );
				if ( ( $row_parts['scheme'] . '://' . $row_parts['host'] ) !== $allowed_origin ) {
					continue;
				}
				$seen_href[ $href_raw ] = true;
				$pages[]                = array(
					'path' => $path !== '' ? $path : ( $row_parts['path'] ?? $href_raw ),
					'href' => $u,
				);
				if ( count( $pages ) >= self::ENRICH_MAX_PAGES ) {
					break;
				}
			}

			if ( empty( $pages ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'results' => array() ) );
				return;
			}

			$results = Flowbie_App_Page_Address_Llm::pool_map(
				$pages,
				self::ENRICH_CONCURRENCY,
				static function ( $page ) use ( $api_key, $model ) {
					$fetch = Flowbie_App_Seo_Http::fetch_html( $page['href'] );
					if ( empty( $fetch['ok'] ) ) {
						return array( 'href' => $page['href'], 'path' => $page['path'], 'address' => null );
					}
					return Flowbie_App_Page_Address_Llm::enrich_one_page(
						array(
							'html'    => (string) $fetch['html'],
							'href'    => $page['href'],
							'path'    => $page['path'],
							'apiKey'  => $api_key,
							'model'   => $model,
						)
					);
				}
			);

			Flowbie_App_Api_Dispatcher::send_json( array( 'results' => $results ) );
		} catch ( Exception $e ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'error'   => $e->getMessage() ?: 'Failed to enrich addresses',
					'results' => array(),
				),
				502
			);
		}
	}

	/** @param array<string,mixed> $body */
	private static function fetch_external_sitemap( array $body ): void {
		try {
			$url    = isset( $body['url'] ) ? trim( (string) $body['url'] ) : '';
			$domain = isset( $body['domain'] ) ? trim( (string) $body['domain'] ) : '';
			if ( $url === '' && $domain !== '' ) {
				$domain = preg_replace( '#^https?://#i', '', $domain );
				$domain = preg_replace( '#/.*$#', '', $domain );
				$url    = 'https://' . $domain;
			}
			if ( $url === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Missing url or domain', 'urls' => array() ), 400 );
				return;
			}

			$parsed = Flowbie_App_Seo_Http::safe_parse_url( $url );
			if ( ! $parsed ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Invalid url', 'urls' => array() ), 400 );
				return;
			}

			$parts = wp_parse_url( $parsed );
			if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'error' => 'Invalid url', 'urls' => array() ), 400 );
				return;
			}

			$origin      = $parts['scheme'] . '://' . $parts['host'];
			$candidates  = array(
				$origin . '/sitemap_index.xml',
				$origin . '/sitemap.xml',
				$origin . '/sitemap-index.xml',
			);
			$robots      = Flowbie_App_Seo_Http::fetch_html( $origin . '/robots.txt', 12 );
			if ( ! empty( $robots['ok'] ) && ! empty( $robots['html'] ) ) {
				if ( preg_match_all( '/^Sitemap:\s*(\S+)/mi', (string) $robots['html'], $sm ) ) {
					foreach ( $sm[1] as $loc ) {
						$loc = trim( $loc );
						if ( $loc !== '' ) {
							$candidates[] = $loc;
						}
					}
				}
			}

			$all_urls    = array();
			$seen        = array();
			$sitemap_src = null;

			foreach ( array_unique( $candidates ) as $candidate ) {
				$fetch = Flowbie_App_Seo_Http::fetch_html( $candidate, 18 );
				if ( empty( $fetch['ok'] ) || empty( $fetch['html'] ) ) {
					continue;
				}
				$xml  = (string) $fetch['html'];
				$locs = Flowbie_App_Seo_Http::extract_locs_from_sitemap_xml( $xml );
				if ( empty( $locs ) ) {
					continue;
				}

				$is_index = stripos( $xml, '<sitemapindex' ) !== false;
				if ( $is_index ) {
					$sitemap_src = $candidate;
					$child_count = 0;
					foreach ( $locs as $child ) {
						if ( $child_count >= 8 ) {
							break;
						}
						$child_fetch = Flowbie_App_Seo_Http::fetch_html( $child, 18 );
						if ( empty( $child_fetch['ok'] ) || empty( $child_fetch['html'] ) ) {
							continue;
						}
						foreach ( Flowbie_App_Seo_Http::extract_locs_from_sitemap_xml( (string) $child_fetch['html'] ) as $u ) {
							if ( count( $all_urls ) >= 200 ) {
								break 3;
							}
							$u = trim( $u );
							if ( $u === '' || isset( $seen[ $u ] ) ) {
								continue;
							}
							$seen[ $u ] = true;
							$all_urls[] = $u;
						}
						++$child_count;
					}
				} else {
					$sitemap_src = $candidate;
					foreach ( $locs as $u ) {
						if ( count( $all_urls ) >= 200 ) {
							break 2;
						}
						$u = trim( $u );
						if ( $u === '' || isset( $seen[ $u ] ) ) {
							continue;
						}
						$seen[ $u ] = true;
						$all_urls[] = $u;
					}
				}

				if ( ! empty( $all_urls ) ) {
					break;
				}
			}

			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'urls'       => $all_urls,
					'sitemapUrl' => $sitemap_src,
					'origin'     => $origin,
				)
			);
		} catch ( Exception $e ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'error' => $e->getMessage() ?: 'Failed to fetch sitemap',
					'urls'  => array(),
				),
				502
			);
		}
	}

	/** @param array<string,mixed> $body */
	private static function openrouter_key_from_request( array $body ): string {
		$header = isset( $_SERVER['HTTP_X_OPENROUTER_API_KEY'] ) ? trim( (string) wp_unslash( $_SERVER['HTTP_X_OPENROUTER_API_KEY'] ) ) : '';
		if ( $header !== '' ) {
			return $header;
		}
		if ( ! empty( $body['apiKey'] ) && is_string( $body['apiKey'] ) && trim( $body['apiKey'] ) !== '' ) {
			return trim( $body['apiKey'] );
		}
		return trim( Flowbie_App_Secrets::openrouter_api_key() );
	}
}
