<?php
/**
 * Neighborhood entity map from Google SERP (DataForSEO organic + screenshot crop + Nano Banana replicate).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Entity_Maps_Image {

	const LOCATION_CODE_CANADA = 2124;
	const SCREEN_WIDTH         = 1920;
	const SCREEN_HEIGHT        = 1080;
	const MAX_BYTES            = 12582912;

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array<string,mixed>
	 */
	public static function generate( array $body ): array {
		$entity = isset( $body['entity'] ) ? trim( (string) $body['entity'] ) : '';
		if ( $entity === '' ) {
			return array(
				'success' => false,
				'error'   => 'Missing required field: entity',
			);
		}

		$serp       = null;
		$rectangle  = null;
		$keyword    = '';
		$last_error = '';

		foreach ( self::serp_keywords_for_entity( $entity ) as $candidate_keyword ) {
			$keyword = $candidate_keyword;
			$fetched = self::fetch_serp( $keyword );
			if ( is_wp_error( $fetched ) ) {
				$last_error = $fetched->get_error_message();
				continue;
			}

			Neo_Pulse_App_Dataforseo_Serp_Dumps::write( 'entity_map_' . $keyword, $fetched );

			$rect = self::extract_map_rectangle( $fetched );
			if ( $rect === null ) {
				$last_error = 'No map rectangle in SERP for keyword: ' . $keyword;
				continue;
			}

			$serp      = $fetched;
			$rectangle = $rect;
			break;
		}

		if ( $serp !== null && $rectangle !== null ) {
			return self::finish_from_serp_and_rectangle( $entity, $serp, $rectangle );
		}

		return self::generate_city_screenshot_fallback( $entity, $last_error );
	}

	public static function serp_keyword_for_entity( string $entity ): string {
		$entity = trim( $entity );
		if ( $entity === '' ) {
			return '';
		}
		if ( stripos( $entity, 'maps' ) !== false ) {
			return $entity;
		}
		return $entity . ' maps';
	}

	/**
	 * SERP query variants when the full entity label has no map rectangle.
	 *
	 * @return list<string>
	 */
	public static function serp_keywords_for_entity( string $entity ): array {
		$entity = trim( $entity );
		if ( $entity === '' ) {
			return array();
		}

		$keywords = array();
		$add      = static function ( string $label ) use ( &$keywords ): void {
			$kw = self::serp_keyword_for_entity( $label );
			if ( $kw !== '' && ! in_array( $kw, $keywords, true ) ) {
				$keywords[] = $kw;
			}
		};

		$add( $entity );

		$parts = array_values( array_filter( array_map( 'trim', explode( ',', $entity ) ) ) );
		if ( count( $parts ) >= 1 && $parts[0] !== $entity ) {
			$add( $parts[0] );
		}
		if ( count( $parts ) >= 2 ) {
			$add( $parts[0] . ', ' . $parts[1] );
			if ( ! self::is_region_code_label( $parts[1] ) ) {
				$add( $parts[1] );
			}
		}

		foreach ( self::city_labels_for_entity( $entity ) as $city_label ) {
			$add( $city_label );
			$city_parts = array_values( array_filter( array_map( 'trim', explode( ',', $city_label ) ) ) );
			if ( count( $city_parts ) >= 1 ) {
				$add( $city_parts[0] );
			}
		}

		return $keywords;
	}

	/**
	 * City-level labels for SERP fallback when POI queries have no map rectangle.
	 *
	 * @return list<string>
	 */
	public static function city_labels_for_entity( string $entity ): array {
		$entity = trim( $entity );
		if ( $entity === '' ) {
			return array();
		}

		$labels = array();
		$add    = static function ( string $label ) use ( &$labels ): void {
			$label = trim( $label );
			if ( $label !== '' && ! in_array( $label, $labels, true ) ) {
				$labels[] = $label;
			}
		};

		$parts = array_values( array_filter( array_map( 'trim', explode( ',', $entity ) ) ) );
		$count = count( $parts );

		if ( $count >= 3 ) {
			$add( $parts[1] . ', ' . $parts[2] );
			return $labels;
		}

		if ( $count === 2 ) {
			$stripped = self::strip_poi_suffix_from_label( $parts[0] );
			if ( $stripped !== '' ) {
				$add( $stripped . ', ' . $parts[1] );
			}
			if ( ! self::is_region_code_label( $parts[1] ) ) {
				$add( $parts[1] );
			} elseif ( $stripped !== '' && strcasecmp( $stripped, $parts[0] ) !== 0 ) {
				$add( $stripped );
			}
		}

		return $labels;
	}

	/**
	 * Crop region below the search bar when SERP rectangle metadata is absent.
	 *
	 * @return array{x:int,y:int,width:int,height:int}
	 */
	public static function fallback_city_screenshot_rectangle( int $img_w, int $img_h ): array {
		$y = min( 100, max( 0, $img_h - 1 ) );

		return array(
			'x'      => 0,
			'y'      => $y,
			'width'  => max( 1, $img_w ),
			'height' => max( 1, $img_h - $y ),
		);
	}

	private static function is_region_code_label( string $label ): bool {
		return (bool) preg_match( '/^[A-Z]{2}$/i', trim( $label ) );
	}

	private static function strip_poi_suffix_from_label( string $label ): string {
		$suffixes = array(
			'Community Centre',
			'Recreation Centre',
			'Community Center',
			'Recreation Center',
			'Shopping Centre',
			'Shopping Center',
			'Medical Centre',
			'Medical Center',
			'Hospital',
			'Library',
			'School',
			'Arena',
			'Mall',
			'Park',
			'Centre',
			'Center',
		);

		$trimmed = trim( $label );
		foreach ( $suffixes as $suffix ) {
			$pattern = '/\s+' . preg_quote( $suffix, '/' ) . '$/iu';
			$stripped = preg_replace( $pattern, '', $trimmed );
			if ( is_string( $stripped ) && $stripped !== $trimmed && trim( $stripped ) !== '' ) {
				return trim( $stripped );
			}
		}

		return $trimmed;
	}

	/**
	 * @param array<string,mixed>                          $serp
	 * @param array{x:int,y:int,width:int,height:int}      $rectangle
	 * @return array<string,mixed>
	 */
	private static function finish_from_serp_and_rectangle( string $entity, array $serp, array $rectangle ): array {
		$task_id = isset( $serp['tasks'][0]['id'] ) ? trim( (string) $serp['tasks'][0]['id'] ) : '';
		if ( $task_id === '' ) {
			return self::fail( 'DataForSEO SERP task id missing' );
		}

		$png = self::fetch_screenshot_png( $task_id );
		if ( is_wp_error( $png ) ) {
			return self::fail( $png->get_error_message() );
		}

		$cropped = self::crop_png( $png, $rectangle );
		if ( is_wp_error( $cropped ) ) {
			return self::fail( $cropped->get_error_message() );
		}

		$reference_data_url = 'data:image/png;base64,' . base64_encode( $cropped );
		$replicated         = Neo_Pulse_App_Openrouter_Image::generate_with_reference(
			array(
				'prompt'           => self::replication_prompt( $entity ),
				'referenceDataUrl' => $reference_data_url,
				'size'             => '1024x1024',
			)
		);
		if ( is_wp_error( $replicated ) ) {
			return self::fail( $replicated->get_error_message() );
		}

		return self::finish_from_prepared_data_url( (string) $replicated['dataUrl'] );
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function finish_from_cropped_png_without_replicate( string $cropped_png ): array {
		return self::finish_from_prepared_data_url( 'data:image/png;base64,' . base64_encode( $cropped_png ) );
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function finish_from_prepared_data_url( string $data_url ): array {
		$prepared = Neo_Pulse_App_Image_Prepare_Local::prepare(
			array( 'dataUrl' => $data_url )
		);
		if ( (int) $prepared['status'] !== 200 || empty( $prepared['body']['dataUrl'] ) ) {
			$err = isset( $prepared['body']['error'] ) ? (string) $prepared['body']['error'] : 'Image prepare failed';
			return self::fail( $err );
		}

		$data_url_out = (string) $prepared['body']['dataUrl'];
		$comma        = strpos( $data_url_out, ',' );
		if ( $comma === false ) {
			return self::fail( 'Prepared image dataUrl invalid' );
		}

		return array(
			'success'     => true,
			'imageBase64' => substr( $data_url_out, $comma + 1 ),
			'mimeType'    => 'image/jpeg',
			'width'       => isset( $prepared['body']['width'] ) ? (int) $prepared['body']['width'] : null,
			'height'      => isset( $prepared['body']['height'] ) ? (int) $prepared['body']['height'] : null,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function generate_city_screenshot_fallback( string $entity, string $last_poi_error ): array {
		$city_labels = self::city_labels_for_entity( $entity );
		if ( $city_labels === array() ) {
			return self::fail( $last_poi_error !== '' ? $last_poi_error : 'No map rectangle in SERP for entity' );
		}

		$last_error = $last_poi_error;

		foreach ( $city_labels as $city_label ) {
			$keyword = self::serp_keyword_for_entity( $city_label );
			$fetched = self::fetch_serp( $keyword );
			if ( is_wp_error( $fetched ) ) {
				$last_error = $fetched->get_error_message();
				continue;
			}

			Neo_Pulse_App_Dataforseo_Serp_Dumps::write( 'entity_map_city_' . $keyword, $fetched );

			$rect = self::extract_map_rectangle( $fetched );
			if ( $rect !== null ) {
				return self::finish_from_serp_and_rectangle( $entity, $fetched, $rect );
			}

			$task_id = isset( $fetched['tasks'][0]['id'] ) ? trim( (string) $fetched['tasks'][0]['id'] ) : '';
			if ( $task_id === '' ) {
				$last_error = 'DataForSEO SERP task id missing';
				continue;
			}

			$png = self::fetch_screenshot_png( $task_id );
			if ( is_wp_error( $png ) ) {
				$last_error = $png->get_error_message();
				continue;
			}

			$dimensions = self::png_dimensions( $png );
			if ( is_wp_error( $dimensions ) ) {
				$last_error = $dimensions->get_error_message();
				continue;
			}

			$fallback_rect = self::fallback_city_screenshot_rectangle( $dimensions['width'], $dimensions['height'] );
			$cropped       = self::crop_png( $png, $fallback_rect );
			if ( is_wp_error( $cropped ) ) {
				$last_error = $cropped->get_error_message();
				continue;
			}

			return self::finish_from_cropped_png_without_replicate( $cropped );
		}

		return self::fail( $last_error !== '' ? $last_error : 'City SERP screenshot fallback failed' );
	}

	/**
	 * @return array{width:int,height:int}|WP_Error
	 */
	private static function png_dimensions( string $png ) {
		if ( ! function_exists( 'imagecreatefromstring' ) ) {
			return new WP_Error( 'neo-pulse_entity_map_gd', 'GD extension not available' );
		}

		$src = @imagecreatefromstring( $png );
		if ( ! $src ) {
			return new WP_Error( 'neo-pulse_entity_map_gd', 'Could not read SERP screenshot' );
		}

		$width  = imagesx( $src );
		$height = imagesy( $src );
		imagedestroy( $src );

		if ( $width < 1 || $height < 1 ) {
			return new WP_Error( 'neo-pulse_entity_map_gd', 'SERP screenshot has invalid dimensions' );
		}

		return array(
			'width'  => $width,
			'height' => $height,
		);
	}

	private static function replication_prompt( string $entity ): string {
		return 'Recreate the attached Google Maps screenshot as a clean square map image for the neighborhood entity '
			. $entity
			. '. Preserve the red dotted neighborhood boundary line, street names, neighborhood label, and map colors exactly as shown in the reference. '
			. 'Remove browser chrome, search UI, side panels, knowledge-panel photos, and weather widgets. '
			. 'Do not invent streets, boundaries, or labels that are not visible in the reference. '
			. 'Output a single centered map on a plain background.';
	}

	/**
	 * @param array<string,mixed> $serp DataForSEO organic live advanced response.
	 * @return array{x:int,y:int,width:int,height:int}|null
	 */
	public static function extract_map_rectangle( array $serp ): ?array {
		$items = self::serp_items( $serp );
		$found = self::find_largest_map_rectangle_deep( $items );
		if ( $found !== null ) {
			return $found;
		}

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) || strtolower( (string) ( $item['type'] ?? '' ) ) !== 'knowledge_graph' ) {
				continue;
			}
			$derived = self::derive_neighborhood_map_rectangle_from_knowledge_graph( $item );
			if ( $derived !== null ) {
				return $derived;
			}
		}

		return null;
	}

	/**
	 * Knowledge panel neighborhood map tile (desktop 1920 layout).
	 *
	 * @param array<string,mixed> $kg knowledge_graph SERP item.
	 * @return array{x:int,y:int,width:int,height:int}|null
	 */
	public static function derive_neighborhood_map_rectangle_from_knowledge_graph( array $kg ): ?array {
		$kg_rect = self::normalize_rectangle( $kg['rectangle'] ?? null );
		if ( $kg_rect === null ) {
			return null;
		}

		$subtitle = strtolower( (string) ( $kg['subtitle'] ?? '' ) );
		$is_place = strpos( $subtitle, 'neighbourhood' ) !== false
			|| strpos( $subtitle, 'neighborhood' ) !== false
			|| strpos( $subtitle, 'city' ) !== false
			|| strpos( $subtitle, 'town' ) !== false
			|| strpos( $subtitle, 'village' ) !== false
			|| strpos( $subtitle, 'community' ) !== false
			|| strpos( $subtitle, 'hamlet' ) !== false
			|| strpos( $subtitle, 'municipality' ) !== false
			|| strpos( $subtitle, 'locality' ) !== false
			|| strpos( $subtitle, ' in ' ) !== false;
		if ( ! $is_place && $subtitle === '' && trim( (string) ( $kg['title'] ?? '' ) ) !== '' ) {
			$is_place = true;
		}
		if ( ! $is_place ) {
			return null;
		}

		$size = (int) round( self::SCREEN_WIDTH * 0.156 );
		$x    = (int) round( self::SCREEN_WIDTH * 0.469 );
		$y    = $kg_rect['y'] + 44;

		return self::normalize_rectangle(
			array(
				'x'      => $x,
				'y'      => $y,
				'width'  => $size,
				'height' => $size,
			)
		);
	}

	/**
	 * @param array<int,mixed> $items
	 * @return array{x:int,y:int,width:int,height:int}|null
	 */
	private static function find_largest_map_rectangle_deep( array $items ): ?array {
		$best     = null;
		$best_area = 0;

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			if ( strtolower( (string) ( $item['type'] ?? '' ) ) === 'map' ) {
				$rect = self::normalize_rectangle( $item['rectangle'] ?? null );
				if ( $rect !== null ) {
					$area = $rect['width'] * $rect['height'];
					if ( $area > $best_area ) {
						$best_area = $area;
						$best      = $rect;
					}
				}
			}
			if ( ! empty( $item['items'] ) && is_array( $item['items'] ) ) {
				$nested = self::find_largest_map_rectangle_deep( $item['items'] );
				if ( $nested !== null ) {
					$area = $nested['width'] * $nested['height'];
					if ( $area > $best_area ) {
						$best_area = $area;
						$best      = $nested;
					}
				}
			}
		}

		return $best;
	}

	/**
	 * @param array<string,mixed> $serp
	 * @return array<int,mixed>
	 */
	private static function serp_items( array $serp ): array {
		$result = $serp['tasks'][0]['result'] ?? null;
		if ( ! is_array( $result ) || empty( $result[0] ) || ! is_array( $result[0] ) ) {
			return array();
		}
		$items = $result[0]['items'] ?? null;
		return is_array( $items ) ? $items : array();
	}

	/**
	 * @param mixed $rectangle
	 * @return array{x:int,y:int,width:int,height:int}|null
	 */
	private static function normalize_rectangle( $rectangle ): ?array {
		if ( ! is_array( $rectangle ) ) {
			return null;
		}
		$x      = isset( $rectangle['x'] ) ? (int) round( (float) $rectangle['x'] ) : 0;
		$y      = isset( $rectangle['y'] ) ? (int) round( (float) $rectangle['y'] ) : 0;
		$width  = isset( $rectangle['width'] ) ? (int) round( (float) $rectangle['width'] ) : 0;
		$height = isset( $rectangle['height'] ) ? (int) round( (float) $rectangle['height'] ) : 0;
		if ( $width <= 0 || $height <= 0 ) {
			return null;
		}
		return array(
			'x'      => max( 0, $x ),
			'y'      => max( 0, $y ),
			'width'  => $width,
			'height' => $height,
		);
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	private static function fetch_serp( string $keyword ) {
		$task = array(
			'keyword'               => $keyword,
			'location_code'         => self::LOCATION_CODE_CANADA,
			'language_code'         => 'en',
			'device'                => 'desktop',
			'os'                    => 'windows',
			'depth'                 => 10,
			'calculate_rectangles'  => true,
			'browser_screen_width'  => self::SCREEN_WIDTH,
			'browser_screen_height' => self::SCREEN_HEIGHT,
		);

		return self::retry_transient_dataforseo(
			function () use ( $task ) {
				$result = Neo_Pulse_App_Dataforseo_Client::post(
					'serp/google/organic/live/advanced',
					array( $task ),
					array( 'timeout' => 120000 )
				);
				if ( is_wp_error( $result ) ) {
					return $result;
				}

				$check = Neo_Pulse_App_Dataforseo_Client::assert_task_ok( $result, true );
				if ( is_wp_error( $check ) ) {
					return $check;
				}

				return $result;
			},
			4
		);
	}

	/**
	 * @return string|WP_Error Raw PNG bytes.
	 */
	private static function fetch_screenshot_png( string $task_id ) {
		return self::retry_transient_dataforseo(
			function () use ( $task_id ) {
				$result = Neo_Pulse_App_Dataforseo_Client::post(
					'serp/screenshot',
					array(
						array(
							'task_id'               => $task_id,
							'browser_screen_width'  => self::SCREEN_WIDTH,
							'browser_screen_height' => self::SCREEN_HEIGHT,
						),
					),
					array( 'timeout' => 120000 )
				);
				if ( is_wp_error( $result ) ) {
					return $result;
				}

				$check = Neo_Pulse_App_Dataforseo_Client::assert_task_ok( $result, true );
				if ( is_wp_error( $check ) ) {
					return $check;
				}

				$url = self::screenshot_url( $result );
				if ( $url === '' ) {
					return new WP_Error( 'neo-pulse_entity_map_screenshot', 'DataForSEO screenshot URL missing' );
				}

				$response = wp_remote_get(
					$url,
					array(
						'timeout' => 60,
						'headers' => array(
							'Accept' => 'image/*,*/*;q=0.8',
						),
					)
				);
				if ( is_wp_error( $response ) ) {
					return $response;
				}

				$code = (int) wp_remote_retrieve_response_code( $response );
				$raw  = wp_remote_retrieve_body( $response );
				if ( $code !== 200 || $raw === '' ) {
					return new WP_Error(
						'neo-pulse_entity_map_download',
						sprintf( 'Failed to download SERP screenshot (HTTP %d)', $code )
					);
				}
				if ( strlen( $raw ) > self::MAX_BYTES ) {
					return new WP_Error( 'neo-pulse_entity_map_download', 'SERP screenshot too large' );
				}

				return $raw;
			},
			4
		);
	}

	private static function is_transient_dataforseo_error( string $message ): bool {
		$m = strtolower( $message );
		return str_contains( $m, 'internal se server error' )
			|| str_contains( $m, 'timeout' )
			|| str_contains( $m, 'temporarily unavailable' )
			|| str_contains( $m, 'rate limit' )
			|| str_contains( $m, '503' )
			|| str_contains( $m, '502' )
			|| str_contains( $m, '504' );
	}

	/**
	 * @param callable(): array<string,mixed>|string|WP_Error $callback
	 * @return array<string,mixed>|string|WP_Error
	 */
	private static function retry_transient_dataforseo( callable $callback, int $max_attempts = 4 ) {
		$last_error = null;
		for ( $attempt = 1; $attempt <= $max_attempts; $attempt++ ) {
			if ( $attempt > 1 ) {
				sleep( min( 8, 2 * ( $attempt - 1 ) ) );
			}

			$result = $callback();
			if ( ! is_wp_error( $result ) ) {
				return $result;
			}

			$last_error = $result;
			if ( ! self::is_transient_dataforseo_error( $result->get_error_message() ) || $attempt >= $max_attempts ) {
				return $result;
			}
		}

		return $last_error ?? new WP_Error( 'neo-pulse_dataforseo_retry', 'DataForSEO request failed' );
	}

	/**
	 * @param array<string,mixed> $result
	 */
	private static function screenshot_url( array $result ): string {
		$items = $result['tasks'][0]['result'][0]['items'] ?? null;
		if ( ! is_array( $items ) ) {
			return '';
		}
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$url = trim( (string) ( $item['image'] ?? '' ) );
			if ( $url !== '' && preg_match( '#^https?://#i', $url ) ) {
				return $url;
			}
		}
		return '';
	}

	/**
	 * @param string                         $png Raw PNG bytes.
	 * @param array{x:int,y:int,width:int,height:int} $rectangle
	 * @return string|WP_Error
	 */
	private static function crop_png( string $png, array $rectangle ) {
		if ( ! function_exists( 'imagecreatefromstring' ) ) {
			return new WP_Error( 'neo-pulse_entity_map_gd', 'GD extension not available' );
		}

		$src = @imagecreatefromstring( $png );
		if ( ! $src ) {
			return new WP_Error( 'neo-pulse_entity_map_gd', 'Could not read SERP screenshot' );
		}

		$img_w = imagesx( $src );
		$img_h = imagesy( $src );
		if ( $img_w < 1 || $img_h < 1 ) {
			imagedestroy( $src );
			return new WP_Error( 'neo-pulse_entity_map_gd', 'SERP screenshot has invalid dimensions' );
		}

		$x      = min( $rectangle['x'], $img_w - 1 );
		$y      = min( $rectangle['y'], $img_h - 1 );
		$width  = min( $rectangle['width'], $img_w - $x );
		$height = min( $rectangle['height'], $img_h - $y );
		if ( $width <= 0 || $height <= 0 ) {
			imagedestroy( $src );
			return new WP_Error( 'neo-pulse_entity_map_crop', 'Map rectangle outside screenshot bounds' );
		}

		$cropped = imagecrop(
			$src,
			array(
				'x'      => $x,
				'y'      => $y,
				'width'  => $width,
				'height' => $height,
			)
		);
		imagedestroy( $src );

		if ( ! $cropped ) {
			return new WP_Error( 'neo-pulse_entity_map_crop', 'Failed to crop map from SERP screenshot' );
		}

		ob_start();
		imagepng( $cropped );
		$out = ob_get_clean();
		imagedestroy( $cropped );

		if ( ! is_string( $out ) || $out === '' ) {
			return new WP_Error( 'neo-pulse_entity_map_crop', 'Failed to encode cropped map image' );
		}

		return $out;
	}

	/**
	 * @return array{success:false,error:string}
	 */
	private static function fail( string $message ): array {
		return array(
			'success' => false,
			'error'   => $message,
		);
	}
}
