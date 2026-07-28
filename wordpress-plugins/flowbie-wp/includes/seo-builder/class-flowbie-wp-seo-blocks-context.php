<?php
/**
 * Page and block context for SEO block optimization.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Seo_Blocks_Context {

	const PAGE_BODY_MAX = 12000;

	/**
	 * Resolve linked primary page ID for RAG.
	 *
	 * @param int                    $request_post_id From request or UI select.
	 * @param int                    $block_id        Registry block ID.
	 * @param array<string,mixed>|null $block_row     Optional in-memory block (composer).
	 */
	public static function resolve_primary_post_id( int $request_post_id, int $block_id, ?array $block_row = null ): int {
		if ( $request_post_id > 0 ) {
			return $request_post_id;
		}
		if ( is_array( $block_row ) && ! empty( $block_row['primary_post_id'] ) ) {
			return absint( $block_row['primary_post_id'] );
		}
		if ( $block_id > 0 ) {
			$row = Flowbie_Wp_Seo_Blocks_Storage::get( $block_id );
			if ( is_array( $row ) && ! empty( $row['primary_post_id'] ) ) {
				return absint( $row['primary_post_id'] );
			}
		}
		return 0;
	}

	/**
	 * Build formatted linked-page RAG for prompts.
	 *
	 * @param int                    $post_id
	 * @param int                    $block_id
	 * @param array<string,mixed>|null $block_row
	 */
	public static function prompt_for_block( int $post_id, int $block_id, ?array $block_row = null, string $element_id = '' ): string {
		$resolved_post_id = self::resolve_primary_post_id( $post_id, $block_id, $block_row );
		$ctx              = self::build(
			array(
				'post_id'    => $resolved_post_id,
				'element_id' => $element_id,
				'block_id'   => $block_id,
				'block_row'  => is_array( $block_row ) ? $block_row : null,
			)
		);
		return self::format_for_prompt( $ctx );
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	public static function build( array $args ): array {
		$request_post_id = absint( $args['post_id'] ?? 0 );
		$element_id      = sanitize_text_field( (string) ( $args['element_id'] ?? '' ) );
		$block_id        = absint( $args['block_id'] ?? 0 );
		$block_row       = isset( $args['block_row'] ) && is_array( $args['block_row'] ) ? $args['block_row'] : null;

		$post_id = self::resolve_primary_post_id( $request_post_id, $block_id, $block_row );

		$ctx = array(
			'postId'           => $post_id,
			'elementId'        => $element_id,
			'blockId'          => $block_id,
			'siteName'         => get_bloginfo( 'name' ),
			'siteUrl'          => home_url( '/' ),
			'pageTitle'        => $post_id > 0 ? get_the_title( $post_id ) : '',
			'pageExcerpt'      => $post_id > 0 ? get_the_excerpt( $post_id ) : '',
			'focusKeyword'     => '',
			'seoResearch'      => '',
			'seoTitle'         => '',
			'metaDescription'  => '',
			'faq'              => '',
			'pageUrl'          => '',
			'pageBodyText'     => '',
			'siblingHeadings'  => array(),
			'siblingBlocks'    => array(),
			'currentBlock'     => array(),
		);

		if ( $post_id > 0 ) {
			$page_ctx = Flowbie_Wp_Ai_Context::read_context( $post_id );
			$meta_hub = Flowbie_Wp_Ai_Context::meta_hub_values( $post_id );

			$ctx['focusKeyword']    = (string) ( $meta_hub['focusKeyword'] ?? $page_ctx['focusKeyword'] ?? '' );
			$ctx['seoResearch']     = (string) ( $meta_hub['seoResearch'] ?? $page_ctx['seoResearch'] ?? '' );
			$ctx['seoTitle']        = (string) ( $meta_hub['seoTitle'] ?? '' );
			$ctx['metaDescription'] = (string) ( $meta_hub['metaDescription'] ?? '' );
			$ctx['faq']             = (string) ( $meta_hub['faq'] ?? $page_ctx['faq'] ?? '' );
			$ctx['pageUrl']         = (string) ( $meta_hub['pageUrl'] ?? $page_ctx['url'] ?? '' );
			$ctx['pageExcerpt']     = (string) ( $page_ctx['excerpt'] ?? $ctx['pageExcerpt'] );
			$ctx['pageBodyText']    = self::extract_page_body_text( $post_id );

			$parsed                 = self::parse_elementor_page( $post_id, $element_id );
			$ctx['siblingHeadings'] = $parsed['headings'];
			$ctx['siblingBlocks']   = $parsed['blocks'];
			if ( ! empty( $parsed['current'] ) ) {
				$ctx['currentBlock'] = $parsed['current'];
			}
		}

		if ( $block_id > 0 && empty( $ctx['currentBlock'] ) ) {
			$row = is_array( $block_row ) && ! empty( $block_row['slots'] ) ? $block_row : Flowbie_Wp_Seo_Blocks_Storage::get( $block_id );
			if ( is_array( $row ) ) {
				$ctx['currentBlock'] = array(
					'block_id'      => $block_id,
					'focus_keyword' => (string) ( $row['focus_keyword'] ?? '' ),
					'topic_focus'   => (string) ( $row['topic_focus'] ?? '' ),
					'slots'         => $row['slots'] ?? array(),
				);
			}
		}

		return $ctx;
	}

	/**
	 * Plain-text page body for RAG (Elementor widgets + post_content fallback).
	 */
	public static function extract_page_body_text( int $post_id ): string {
		if ( $post_id < 1 ) {
			return '';
		}

		$chunks = array();
		$raw    = get_post_meta( $post_id, '_elementor_data', true );
		if ( is_string( $raw ) && $raw !== '' ) {
			$data = json_decode( $raw, true );
			if ( is_array( $data ) ) {
				$from_elementor = self::collect_body_text_from_elements( $data );
				if ( $from_elementor !== '' ) {
					$chunks[] = $from_elementor;
				}
			}
		}

		$post = get_post( $post_id );
		if ( $post instanceof WP_Post && is_string( $post->post_content ) && trim( $post->post_content ) !== '' ) {
			$plain = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $post->post_content ) ) );
			if ( $plain !== '' ) {
				$chunks[] = $plain;
			}
		}

		$text = trim( implode( "\n\n", array_unique( array_filter( $chunks ) ) ) );
		if ( strlen( $text ) > self::PAGE_BODY_MAX ) {
			$text = substr( $text, 0, self::PAGE_BODY_MAX ) . '…';
		}
		return $text;
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 */
	public static function collect_body_text_from_elements( array $elements ): string {
		$parts = array();
		self::walk_body_text_elements( $elements, $parts );
		$parts = array_values( array_unique( array_filter( array_map( 'trim', $parts ) ) ) );
		return implode( "\n", $parts );
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @param array<int,string>            $parts
	 */
	private static function walk_body_text_elements( array $elements, array &$parts ): void {
		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}

			$el_type  = (string) ( $element['elType'] ?? '' );
			$settings = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();

			if ( $el_type === 'widget' ) {
				$widget_type = (string) ( $element['widgetType'] ?? '' );
				$snippet     = self::widget_body_text( $widget_type, $settings );
				if ( $snippet !== '' ) {
					$parts[] = $snippet;
				}
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::walk_body_text_elements( $element['elements'], $parts );
			}
		}
	}

	/**
	 * @param array<string,mixed> $settings
	 */
	private static function widget_body_text( string $widget_type, array $settings ): string {
		switch ( $widget_type ) {
			case 'heading':
				if ( ! empty( $settings['title'] ) ) {
					return wp_strip_all_tags( (string) $settings['title'] );
				}
				break;
			case 'text-editor':
			case 'text':
				if ( ! empty( $settings['editor'] ) ) {
					return trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $settings['editor'] ) ) );
				}
				break;
			case 'theme-post-content':
				if ( ! empty( $settings['content'] ) ) {
					return trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $settings['content'] ) ) );
				}
				break;
			case 'flowbie_seo_section':
				$slots = Flowbie_Wp_Seo_Blocks_Slots::from_elementor_settings( $settings );
				$lines = array();
				foreach ( $slots as $slot ) {
					$type = (string) ( $slot['type'] ?? '' );
					if ( $type === 'h2' && ! empty( $slot['text'] ) ) {
						$lines[] = (string) $slot['text'];
					} elseif ( $type === 'paragraph' && ! empty( $slot['html'] ) ) {
						$lines[] = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $slot['html'] ) ) );
					} elseif ( $type === 'list' ) {
						if ( ! empty( $slot['html'] ) ) {
							$lines[] = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $slot['html'] ) ) );
						} elseif ( ! empty( $slot['items'] ) && is_array( $slot['items'] ) ) {
							$lines[] = implode( '; ', array_map( 'strval', $slot['items'] ) );
						}
					} elseif ( $type === 'cta' && ! empty( $slot['label'] ) ) {
						$lines[] = (string) $slot['label'];
					}
				}
				return implode( "\n", array_filter( $lines ) );
		}
		return '';
	}

	/**
	 * @return array{headings:array<int,string>,blocks:array<int,array<string,mixed>>,current:array<string,mixed>}
	 */
	public static function parse_elementor_page( int $post_id, string $skip_element_id = '' ): array {
		$headings = array();
		$blocks   = array();
		$current  = array();

		$raw = get_post_meta( $post_id, '_elementor_data', true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return array(
				'headings' => $headings,
				'blocks'   => $blocks,
				'current'  => $current,
			);
		}

		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return array(
				'headings' => $headings,
				'blocks'   => $blocks,
				'current'  => $current,
			);
		}

		self::walk_page_elements( $data, $headings, $blocks, $current, $skip_element_id );

		return array(
			'headings' => array_values( array_unique( array_filter( $headings ) ) ),
			'blocks'   => $blocks,
			'current'  => $current,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @param array<int,string>              $headings
	 * @param array<int,array<string,mixed>> $blocks
	 * @param array<string,mixed>            $current
	 */
	private static function walk_page_elements( array $elements, array &$headings, array &$blocks, array &$current, string $skip_element_id ): void {
		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}

			$el_id    = (string) ( $element['id'] ?? '' );
			$el_type  = (string) ( $element['elType'] ?? '' );
			$settings = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();

			if ( $el_type === 'widget' ) {
				$widget_type = (string) ( $element['widgetType'] ?? '' );
				if ( $widget_type === 'heading' && ! empty( $settings['title'] ) ) {
					$headings[] = wp_strip_all_tags( (string) $settings['title'] );
				}
				if ( $widget_type === 'flowbie_seo_section' ) {
					$slots = Flowbie_Wp_Seo_Blocks_Slots::from_elementor_settings( $settings );
					foreach ( $slots as $slot ) {
						if ( ( $slot['type'] ?? '' ) === 'h2' && ! empty( $slot['text'] ) ) {
							$headings[] = (string) $slot['text'];
						}
					}
					$summary = array(
						'element_id'    => $el_id,
						'block_id'      => absint( $settings['registry_block_id'] ?? $settings['block_id'] ?? 0 ),
						'focus_keyword' => (string) ( $settings['focus_keyword'] ?? '' ),
						'topic_focus'   => (string) ( $settings['topic_focus'] ?? '' ),
						'h2'            => Flowbie_Wp_Seo_Blocks_Storage::first_h2( $slots ),
					);
					if ( $el_id !== $skip_element_id ) {
						$blocks[] = $summary;
					} else {
						$current = array(
							'element_id'    => $el_id,
							'block_id'      => absint( $settings['registry_block_id'] ?? $settings['block_id'] ?? 0 ),
							'focus_keyword' => (string) ( $settings['focus_keyword'] ?? '' ),
							'topic_focus'   => (string) ( $settings['topic_focus'] ?? '' ),
							'slots'         => $slots,
						);
					}
				}
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::walk_page_elements( $element['elements'], $headings, $blocks, $current, $skip_element_id );
			}
		}
	}

	/**
	 * @param array<string,mixed> $ctx
	 */
	public static function format_for_prompt( array $ctx ): string {
		$parts = array();
		if ( empty( $ctx['postId'] ) ) {
			return '';
		}
		$parts[] = 'Page title: ' . (string) ( $ctx['pageTitle'] ?? '' );
		if ( ! empty( $ctx['pageUrl'] ) ) {
			$parts[] = 'Page URL: ' . (string) $ctx['pageUrl'];
		}
		if ( ! empty( $ctx['focusKeyword'] ) ) {
			$parts[] = 'Page focus keyword: ' . (string) $ctx['focusKeyword'];
		}
		if ( ! empty( $ctx['seoTitle'] ) ) {
			$parts[] = 'Page SEO title: ' . (string) $ctx['seoTitle'];
		}
		if ( ! empty( $ctx['metaDescription'] ) ) {
			$parts[] = 'Page meta description: ' . substr( (string) $ctx['metaDescription'], 0, 500 );
		}
		if ( ! empty( $ctx['pageExcerpt'] ) ) {
			$parts[] = 'Page excerpt: ' . substr( (string) $ctx['pageExcerpt'], 0, 800 );
		}
		if ( ! empty( $ctx['pageBodyText'] ) ) {
			$parts[] = "Page body (for intent alignment):\n" . (string) $ctx['pageBodyText'];
		}
		if ( ! empty( $ctx['seoResearch'] ) ) {
			$parts[] = "SEO research brief:\n" . substr( (string) $ctx['seoResearch'], 0, 12000 );
		}
		if ( ! empty( $ctx['faq'] ) ) {
			$parts[] = "Page FAQ:\n" . substr( (string) $ctx['faq'], 0, 6000 );
		}
		if ( ! empty( $ctx['siblingHeadings'] ) && is_array( $ctx['siblingHeadings'] ) ) {
			$parts[] = 'Other headings on page: ' . implode( '; ', $ctx['siblingHeadings'] );
		}
		if ( ! empty( $ctx['siblingBlocks'] ) && is_array( $ctx['siblingBlocks'] ) ) {
			$lines = array();
			foreach ( $ctx['siblingBlocks'] as $block ) {
				$lines[] = '- ' . (string) ( $block['h2'] ?? $block['focus_keyword'] ?? 'block' );
			}
			if ( $lines ) {
				$parts[] = "Other Flowbie SEO blocks on page:\n" . implode( "\n", $lines );
			}
		}
		$current = isset( $ctx['currentBlock'] ) && is_array( $ctx['currentBlock'] ) ? $ctx['currentBlock'] : array();
		if ( ! empty( $current['topic_focus'] ) ) {
			$parts[] = "Block topic focus:\n" . (string) $current['topic_focus'];
		}
		if ( ! empty( $current['focus_keyword'] ) ) {
			$parts[] = 'Block focus keyword: ' . (string) $current['focus_keyword'];
		}
		return implode( "\n\n", $parts );
	}

	/**
	 * Extra system instruction when a primary page is linked.
	 */
	public static function linked_page_system_note(): string {
		return 'A linked WordPress page is provided in PAGE CONTEXT. Align block copy with that page\'s purpose, tone, and messaging; do not contradict or ignore the page intent.';
	}
}
