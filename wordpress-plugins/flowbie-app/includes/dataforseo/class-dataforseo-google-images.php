<?php
/**
 * DataForSEO Google Images live/advanced fetch + normalization.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Dataforseo_Google_Images {

	/**
	 * @param string              $keyword
	 * @param array<string,mixed> $options
	 * @return array{success:bool,items:array<int,array<string,mixed>>,count:int,storedFile:?string}|WP_Error
	 */
	public static function fetch( string $keyword, array $options = array() ) {
		$kw = trim( $keyword );
		if ( $kw === '' ) {
			return new WP_Error( 'flowbie_dfs_keyword', 'keyword is required' );
		}

		$location_code = Flowbie_App_Dataforseo_Client::location_code_from_name(
			isset( $options['location_name'] ) ? (string) $options['location_name'] : 'United States'
		);
		$lang = Flowbie_App_Dataforseo_Client::ensure_language_code( $options['language_code'] ?? 'en' );
		$depth_raw = isset( $options['depth'] ) ? (int) $options['depth'] : 10;
		$depth     = $depth_raw > 0 ? min( $depth_raw, 700 ) : 10;

		$task = array(
			'keyword'       => $kw,
			'location_code' => $location_code,
			'language_code' => $lang,
			'depth'         => $depth,
			'device'        => 'desktop',
			'os'            => 'windows',
		);

		$result = Flowbie_App_Dataforseo_Client::post(
			'/serp/google/images/live/advanced',
			array( $task ),
			array( 'timeout' => 90000 )
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$check = Flowbie_App_Dataforseo_Client::assert_task_ok( $result, true );
		if ( is_wp_error( $check ) ) {
			return $check;
		}

		$items      = self::normalize_items( $result );
		$stored     = Flowbie_App_Dataforseo_Serp_Dumps::write( 'images_' . $kw, $result );

		return array(
			'success'    => true,
			'items'      => $items,
			'count'      => count( $items ),
			'storedFile' => $stored,
		);
	}

	/**
	 * @param array<string,mixed> $result
	 * @return array<int,array<string,mixed>>
	 */
	public static function normalize_items( array $result ): array {
		$items   = array();
		$buckets = array();

		if ( ! empty( $result['tasks'] ) && is_array( $result['tasks'] ) ) {
			foreach ( $result['tasks'] as $task ) {
				if ( ! empty( $task['result'] ) && is_array( $task['result'] ) ) {
					foreach ( $task['result'] as $bucket ) {
						$buckets[] = $bucket;
					}
				}
			}
		} elseif ( ! empty( $result['result'] ) && is_array( $result['result'] ) ) {
			$buckets = $result['result'];
		} elseif ( ! empty( $result['items'] ) && is_array( $result['items'] ) ) {
			$buckets = array( $result );
		}

		foreach ( $buckets as $bucket ) {
			if ( ! is_array( $bucket ) || empty( $bucket['items'] ) || ! is_array( $bucket['items'] ) ) {
				continue;
			}
			foreach ( $bucket['items'] as $el ) {
				if ( ! is_array( $el ) ) {
					continue;
				}
				$type = strtolower( (string) ( $el['type'] ?? '' ) );
				if ( in_array( $type, array( 'carousel', 'related_searches', 'refinement_chips' ), true ) ) {
					continue;
				}
				if ( $type !== '' && ! in_array( $type, array( 'images_search', 'images_element', 'image' ), true ) ) {
					continue;
				}
				$img = trim( (string) ( $el['source_url'] ?? $el['encoded_url'] ?? $el['image_url'] ?? '' ) );
				if ( $img === '' || ! preg_match( '#^https?://#i', $img ) ) {
					continue;
				}
				$page  = trim( (string) ( $el['url'] ?? '' ) );
				$title = trim( (string) ( $el['title'] ?? $el['subtitle'] ?? $el['alt'] ?? '' ) );
				$alt   = trim( (string) ( $el['alt'] ?? $el['title'] ?? '' ) );
				$rank  = (int) ( $el['rank_absolute'] ?? $el['rank_group'] ?? ( count( $items ) + 1 ) );
				if ( $rank <= 0 ) {
					$rank = count( $items ) + 1;
				}
				$items[] = array(
					'title'      => $title,
					'source_url' => $page !== '' ? $page : $img,
					'image_url'  => $img,
					'alt'        => $alt,
					'rank'       => $rank,
				);
			}
		}

		$seen    = array();
		$deduped = array();
		foreach ( $items as $it ) {
			$key = strtolower( $it['image_url'] );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$deduped[]    = $it;
		}

		usort(
			$deduped,
			static function ( $a, $b ) {
				return (int) $a['rank'] <=> (int) $b['rank'];
			}
		);

		return $deduped;
	}
}
