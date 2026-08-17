<?php
/**
 * Template intents for hybrid chat suggestions (OpenRouter-formatted cards).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Chat_Suggestion_Templates {

	const SOURCE_MAX = 7000;

	/**
	 * @param array<string,mixed>|null       $page_context
	 * @param array<int,array<string,mixed>> $site_index
	 * @return array{intent:string,post_id:int,url:string,title:string}|null
	 */
	public static function match_intent( string $message, ?array $page_context, array $site_index ): ?array {
		$trimmed = trim( $message );
		if ( $trimmed === '' ) {
			return null;
		}

		$lower = strtolower( $trimmed );

		if ( self::is_page_summary_message( $lower, $page_context ) ) {
			$resolved = self::resolved_page_from_context( $page_context, $site_index );
			if ( null !== $resolved ) {
				return array(
					'intent'  => 'page_summary',
					'post_id' => (int) ( $resolved['post_id'] ?? 0 ),
					'url'     => (string) ( $resolved['url'] ?? '' ),
					'title'   => (string) ( $resolved['title'] ?? '' ),
				);
			}
		}

		$prefix = 'tell me about ';
		if ( str_starts_with( $lower, $prefix ) ) {
			$label = trim( substr( $trimmed, strlen( $prefix ) ) );
			if ( $label !== '' ) {
				$item = self::resolve_item_by_title( $label, $site_index );
				if ( is_array( $item ) && ! empty( $item['id'] ) ) {
					return array(
						'intent'  => 'tell_me_about',
						'post_id' => (int) $item['id'],
						'url'     => (string) ( $item['url'] ?? '' ),
						'title'   => (string) ( $item['title'] ?? $label ),
					);
				}
			}
		}

		return null;
	}

	/**
	 * @param array{intent:string,post_id:int,url:string,title:string} $intent
	 * @param array<string,mixed>|null                                  $page_context
	 * @param array<int,array<string,mixed>>                            $site_index
	 * @param array<string,mixed>                                       $settings
	 * @return array<string,mixed>|null
	 */
	public static function build_card(
		array $intent,
		?array $page_context,
		array $site_index,
		array $settings,
		string $user_message = ''
	): ?array {
		unset( $settings );

		$post_id = (int) ( $intent['post_id'] ?? 0 );
		if ( $post_id < 1 ) {
			return null;
		}

		$title = trim( (string) ( $intent['title'] ?? '' ) );
		$url   = (string) ( $intent['url'] ?? '' );
		if ( $title === '' ) {
			return null;
		}

		$source = trim( Neo_Pulse_Wp_Chat_Page_Summary::read_markdown( $post_id ) );
		if ( $source === '' ) {
			return null;
		}

		$card = Neo_Pulse_Wp_Chat_Agents::format_template_card(
			(string) ( $intent['intent'] ?? '' ),
			$title,
			$url,
			$source,
			$user_message !== '' ? $user_message : 'Tell me about ' . $title,
			get_bloginfo( 'name' )
		);
		if ( is_wp_error( $card ) || ! is_array( $card ) || empty( $card['body'] ) ) {
			return null;
		}

		$item = Neo_Pulse_Wp_Chat_Page_Context::index_item_for_post( $post_id, $site_index );
		if ( ! is_array( $item ) ) {
			$item = array(
				'id'    => $post_id,
				'title' => $title,
				'url'   => $url,
			);
		}

		$link_items = Neo_Pulse_Wp_Chat_Links::items_for_template_attach(
			$source,
			(string) $card['body'],
			$title,
			$site_index,
			array( $item )
		);

		$card['body'] = Neo_Pulse_Wp_Chat_Links::finalize_template_body_links(
			(string) $card['body'],
			$source,
			$link_items,
			$site_index
		);

		$classification = array(
			'intent'        => 'question',
			'relevant_ids'  => array( $post_id ),
			'search_terms'  => array(),
		);

		$card = Neo_Pulse_Wp_Chat_Links::attach_to_card(
			$card,
			$user_message !== '' ? $user_message : 'Tell me about ' . $title,
			(string) $card['body'],
			$link_items,
			$classification,
			$site_index,
			array(),
			array(),
			true
		);

		unset( $card['relatedTopics'] );

		return $card;
	}

	/**
	 * @param array<string,mixed>|null $page_context
	 */
	private static function is_page_summary_message( string $lower, ?array $page_context ): bool {
		if ( $lower === 'summarize this page' ) {
			return true;
		}
		if ( ! is_array( $page_context ) || empty( $page_context['post_id'] ) ) {
			return false;
		}
		if ( ! str_contains( $lower, 'summarize' ) && ! str_contains( $lower, 'summary' ) ) {
			return false;
		}
		return Neo_Pulse_Wp_Chat_Page_Context::message_targets_current_page( $lower );
	}

	/**
	 * @param array<string,mixed>|null $page_context
	 * @param array<int,array<string,mixed>> $site_index
	 * @return array{post_id:int,url:string,title:string}|null
	 */
	private static function resolved_page_from_context( ?array $page_context, array $site_index ): ?array {
		if ( ! is_array( $page_context ) ) {
			return null;
		}
		$post_id = (int) ( $page_context['post_id'] ?? 0 );
		if ( $post_id < 1 ) {
			return null;
		}
		$title = (string) ( $page_context['title'] ?? '' );
		$url   = (string) ( $page_context['url'] ?? '' );
		if ( $title === '' || $url === '' ) {
			$item = Neo_Pulse_Wp_Chat_Page_Context::index_item_for_post( $post_id, $site_index );
			if ( is_array( $item ) ) {
				$title = (string) ( $item['title'] ?? $title );
				$url   = (string) ( $item['url'] ?? $url );
			}
		}
		if ( $title === '' || $url === '' ) {
			return null;
		}
		return array(
			'post_id' => $post_id,
			'url'     => $url,
			'title'   => $title,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $site_index
	 * @return array<string,mixed>|null
	 */
	private static function resolve_item_by_title( string $label, array $site_index ): ?array {
		$label_norm = strtolower( trim( wp_strip_all_tags( $label ) ) );
		if ( $label_norm === '' ) {
			return null;
		}
		foreach ( $site_index as $item ) {
			$title = isset( $item['title'] ) ? strtolower( trim( (string) $item['title'] ) ) : '';
			if ( $title !== '' && $title === $label_norm ) {
				return $item;
			}
		}

		$fuzzy = Neo_Pulse_Wp_Chat_Rag::find_fuzzy_topic_pages( $label, $site_index, 1 );
		if ( ! empty( $fuzzy[0]['id'] ) ) {
			return $fuzzy[0];
		}

		return null;
	}
}
