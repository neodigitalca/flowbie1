<?php
/**
 * Neighborhood entity map from Google SERP (DataForSEO organic + screenshot crop + Nano Banana replicate).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Entity_Maps_Image {

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

		$keyword = self::serp_keyword_for_entity( $entity );
		$serp    = self::fetch_serp( $keyword );
		if ( is_wp_error( $serp ) ) {
			return self::fail( $serp->get_error_message() );
		}

		Flowbie_App_Dataforseo_Serp_Dumps::write( 'entity_map_' . $keyword, $serp );

		$rectangle = self::extract_map_rectangle( $serp );
		if ( $rectangle === null ) {
			return self::fail( 'No map rectangle in SERP for entity' );
		}

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
		$replicated         = Flowbie_App_Openrouter_Image::generate_with_reference(
			array(
				'prompt'            => self::replication_prompt( $entity ),
				'referenceDataUrl'  => $reference_data_url,
				'size'              => '1024x1024',
			)
		);
		if ( is_wp_error( $replicated ) ) {
			return self::fail( $replicated->get_error_message() );
		}

		$prepared = Flowbie_App_Image_Prepare_Local::prepare(
			array( 'dataUrl' => (string) $replicated['dataUrl'] )
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
			'success'      => true,
			'imageBase64'  => substr( $data_url_out, $comma + 1 ),
			'mimeType'     => 'image/jpeg',
			'width'        => isset( $prepared['body']['width'] ) ? (int) $prepared['body']['width'] : null,
			'height'       => isset( $prepared['body']['height'] ) ? (int) $prepared['body']['height'] : null,
		);
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
		if ( strpos( $subtitle, 'neighbourhood' ) === false && strpos( $subtitle, 'neighborhood' ) === false ) {
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

		$result = Flowbie_App_Dataforseo_Client::post(
			'serp/google/organic/live/advanced',
			array( $task ),
			array( 'timeout' => 120000 )
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$check = Flowbie_App_Dataforseo_Client::assert_task_ok( $result, true );
		if ( is_wp_error( $check ) ) {
			return $check;
		}

		return $result;
	}

	/**
	 * @return string|WP_Error Raw PNG bytes.
	 */
	private static function fetch_screenshot_png( string $task_id ) {
		$result = Flowbie_App_Dataforseo_Client::post(
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

		$check = Flowbie_App_Dataforseo_Client::assert_task_ok( $result, true );
		if ( is_wp_error( $check ) ) {
			return $check;
		}

		$url = self::screenshot_url( $result );
		if ( $url === '' ) {
			return new WP_Error( 'flowbie_entity_map_screenshot', 'DataForSEO screenshot URL missing' );
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
				'flowbie_entity_map_download',
				sprintf( 'Failed to download SERP screenshot (HTTP %d)', $code )
			);
		}
		if ( strlen( $raw ) > self::MAX_BYTES ) {
			return new WP_Error( 'flowbie_entity_map_download', 'SERP screenshot too large' );
		}

		return $raw;
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
			return new WP_Error( 'flowbie_entity_map_gd', 'GD extension not available' );
		}

		$src = @imagecreatefromstring( $png );
		if ( ! $src ) {
			return new WP_Error( 'flowbie_entity_map_gd', 'Could not read SERP screenshot' );
		}

		$img_w = imagesx( $src );
		$img_h = imagesy( $src );
		if ( $img_w < 1 || $img_h < 1 ) {
			imagedestroy( $src );
			return new WP_Error( 'flowbie_entity_map_gd', 'SERP screenshot has invalid dimensions' );
		}

		$x      = min( $rectangle['x'], $img_w - 1 );
		$y      = min( $rectangle['y'], $img_h - 1 );
		$width  = min( $rectangle['width'], $img_w - $x );
		$height = min( $rectangle['height'], $img_h - $y );
		if ( $width <= 0 || $height <= 0 ) {
			imagedestroy( $src );
			return new WP_Error( 'flowbie_entity_map_crop', 'Map rectangle outside screenshot bounds' );
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
			return new WP_Error( 'flowbie_entity_map_crop', 'Failed to crop map from SERP screenshot' );
		}

		ob_start();
		imagepng( $cropped );
		$out = ob_get_clean();
		imagedestroy( $cropped );

		if ( ! is_string( $out ) || $out === '' ) {
			return new WP_Error( 'flowbie_entity_map_crop', 'Failed to encode cropped map image' );
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
