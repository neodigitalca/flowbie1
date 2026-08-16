<?php
/**
 * Proposal site audit: Lighthouse (desktop + mobile) and FAQ discovery.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Proposal_Site_Audit {

	const MAX_URLS           = 10;
	const CONTENT_PARSE_MAX = 8000;

	const LIGHTHOUSE_CATEGORIES = array( 'performance', 'accessibility', 'best_practices', 'seo' );
	const LIGHTHOUSE_AUDITS     = array(
		'first-contentful-paint',
		'largest-contentful-paint',
		'total-blocking-time',
		'cumulative-layout-shift',
		'speed-index',
	);

	/**
	 * @param string[] $urls
	 * @return array<string,mixed>
	 */
	public static function run( array $urls ): array {
		$pages  = array();
		$errors = array();
		foreach ( array_slice( $urls, 0, self::MAX_URLS ) as $u ) {
			$url = trim( (string) $u );
			if ( $url !== '' ) {
				$pages[] = array( 'url' => $url );
			}
		}

		$content_by_url  = array();
		$desktop_metrics = array();
		$mobile_metrics  = array();

		foreach ( $pages as $page ) {
			$url = $page['url'];

			foreach ( array( 'desktop', 'mobile' ) as $device ) {
				$res = self::call_lighthouse( $url, $device === 'mobile' );
				if ( is_wp_error( $res ) ) {
					$errors[] = array(
						'url'     => $url,
						'step'    => 'lighthouse_' . $device,
						'message' => $res->get_error_message(),
					);
					continue;
				}
				$metrics = Neo_Pulse_App_Proposal_Lighthouse_Parse::parse_page_metrics( $res, $url, $device );
				if ( $metrics === null ) {
					$errors[] = array(
						'url'     => $url,
						'step'    => 'lighthouse_' . $device,
						'message' => 'No metrics parsed',
					);
					continue;
				}
				if ( $device === 'desktop' ) {
					$desktop_metrics[] = $metrics;
				} else {
					$mobile_metrics[] = $metrics;
				}
			}

			try {
				$content = self::fetch_page_content_for_faq( $url );
				$content_by_url[ $url ] = $content;
			} catch ( Exception $e ) {
				$errors[] = array(
					'url'     => $url,
					'step'    => 'content_parsing',
					'message' => $e->getMessage(),
				);
			}
		}

		$performance = Neo_Pulse_App_Proposal_Lighthouse_Parse::build_performance_summary( $desktop_metrics, $mobile_metrics );

		$faq_inputs = array();
		foreach ( $pages as $page ) {
			$url = $page['url'];
			$c   = $content_by_url[ $url ] ?? null;
			$faq_inputs[] = array(
				'url'       => $url,
				'pageTitle' => is_array( $c ) ? (string) ( $c['title'] ?? '' ) : '',
				'excerpt'   => is_array( $c ) ? (string) ( $c['text'] ?? '' ) : '',
			);
		}

		$faq = array(
			'sampleSize'    => count( $faq_inputs ),
			'pagesWithFaq'  => 0,
			'totalQaPairs'  => 0,
			'pageSummaries' => array(),
		);

		$has_excerpt = false;
		foreach ( $faq_inputs as $p ) {
			if ( strlen( (string) ( $p['excerpt'] ?? '' ) ) > 80 ) {
				$has_excerpt = true;
				break;
			}
		}

		if ( $has_excerpt ) {
			try {
				$faq = Neo_Pulse_App_Proposal_Faq_Inventory::run( $faq_inputs );
			} catch ( Exception $e ) {
				$errors[] = array(
					'url'     => '(all)',
					'step'    => 'faq_inventory',
					'message' => $e->getMessage(),
				);
			}
		}

		return array(
			'pages'       => $pages,
			'performance' => $performance,
			'faq'         => $faq,
			'errors'      => $errors,
		);
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	private static function call_lighthouse( string $url, bool $for_mobile ) {
		return Neo_Pulse_App_Dataforseo_Client::post(
			'/on_page/lighthouse/live/json',
			array(
				array(
					'url'        => $url,
					'for_mobile' => $for_mobile,
					'categories' => self::LIGHTHOUSE_CATEGORIES,
					'audits'     => self::LIGHTHOUSE_AUDITS,
				),
			),
			array( 'timeout' => 120000 )
		);
	}

	/**
	 * @return array{text:string,title:string}
	 */
	private static function fetch_page_content_for_faq( string $url ): array {
		$raw = self::call_content_parsing( $url, false );
		if ( is_wp_error( $raw ) ) {
			$raw = self::call_content_parsing( $url, true );
		}
		if ( is_wp_error( $raw ) ) {
			throw new Exception( $raw->get_error_message() );
		}

		$task = $raw['tasks'][0] ?? null;
		if ( ! is_array( $task ) || (int) ( $task['status_code'] ?? 0 ) !== 20000 ) {
			throw new Exception( is_array( $task ) && ! empty( $task['status_message'] ) ? (string) $task['status_message'] : 'content_parsing failed' );
		}

		$text  = preg_replace( '/\s+/', ' ', self::page_text_from_on_page_result( $raw ) );
		$text  = trim( (string) $text );
		$title = self::page_title_from_on_page_result( $raw );
		if ( strlen( $text ) > self::CONTENT_PARSE_MAX ) {
			$text = substr( $text, 0, self::CONTENT_PARSE_MAX ) . '…';
		}

		return array(
			'text'  => $text,
			'title' => $title,
		);
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	private static function call_content_parsing( string $url, bool $enable_javascript ) {
		return Neo_Pulse_App_Dataforseo_Client::post(
			'/on_page/content_parsing/live',
			array(
				array(
					'url'               => $url,
					'enable_javascript' => $enable_javascript,
					'accept_language'   => 'en',
				),
			),
			array( 'timeout' => 90000 )
		);
	}

	/**
	 * @param array<string,mixed> $raw
	 */
	private static function page_text_from_on_page_result( array $raw ): string {
		$blocks = $raw['tasks'][0]['result'] ?? null;
		if ( ! is_array( $blocks ) ) {
			return '';
		}
		$parts = array();
		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}
			$items = $block['items'] ?? null;
			if ( ! is_array( $items ) ) {
				continue;
			}
			foreach ( $items as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				if ( ( $item['type'] ?? '' ) === 'content_parsing_element' && is_array( $item['page_content'] ?? null ) ) {
					$pc = $item['page_content'];
					if ( ! empty( $pc['header'] ) ) {
						$t = self::extract_text_from_content( $pc['header'] );
						if ( $t !== '' ) {
							$parts[] = $t;
						}
					}
					if ( ! empty( $pc['primary_content'] ) ) {
						$t = self::extract_text_from_content( $pc['primary_content'] );
						if ( $t !== '' ) {
							$parts[] = $t;
						}
					}
				}
				if ( ! empty( $item['page_as_markdown'] ) && is_string( $item['page_as_markdown'] ) ) {
					$parts[] = $item['page_as_markdown'];
				}
			}
		}
		return implode( "\n\n", $parts );
	}

	/**
	 * @param array<string,mixed> $raw
	 */
	private static function page_title_from_on_page_result( array $raw ): string {
		$blocks = $raw['tasks'][0]['result'] ?? null;
		if ( ! is_array( $blocks ) ) {
			return '';
		}
		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}
			$items = $block['items'] ?? null;
			if ( ! is_array( $items ) ) {
				continue;
			}
			foreach ( $items as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				$meta = $item['page_content']['meta'] ?? null;
				if ( is_array( $meta ) && ! empty( $meta['title'] ) && is_string( $meta['title'] ) ) {
					return substr( trim( $meta['title'] ), 0, 500 );
				}
			}
		}
		return '';
	}

	/**
	 * @param mixed $node
	 */
	private static function extract_text_from_content( $node ): string {
		if ( is_string( $node ) ) {
			return trim( $node );
		}
		if ( ! is_array( $node ) ) {
			return '';
		}
		if ( ! empty( $node['text'] ) && is_string( $node['text'] ) ) {
			return trim( $node['text'] );
		}
		$parts = array();
		foreach ( $node as $key => $val ) {
			if ( $key === 'text' && is_string( $val ) ) {
				$parts[] = trim( $val );
				continue;
			}
			if ( is_array( $val ) ) {
				$t = self::extract_text_from_content( $val );
				if ( $t !== '' ) {
					$parts[] = $t;
				}
			}
		}
		return trim( implode( ' ', $parts ) );
	}
}
