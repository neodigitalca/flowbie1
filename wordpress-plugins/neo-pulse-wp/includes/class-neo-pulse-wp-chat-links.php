<?php
/**
 * Deterministic link grep and card attachment for NEO Pulse Chat.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Chat_Links {

	/**
	 * Prompt block listing title → URL for retrieved items.
	 *
	 * @param array<int,array<string,mixed>> $items RAG items with title + url.
	 */
	public static function build_links_context_block( array $items ): string {
		$lines = array();
		foreach ( $items as $item ) {
			if ( empty( $item['url'] ) || empty( $item['title'] ) ) {
				continue;
			}
			$lines[] = '- ' . $item['title'] . ' → ' . $item['url'];
		}
		return implode( "\n", $lines );
	}

	/**
	 * Keep only links whose URL exists in the filtered site index (+ optional retrieved items).
	 *
	 * @param array<int,array<string,mixed>>           $links
	 * @param array<int,array<string,mixed>>           $site_index
	 * @param array<int,array<string,mixed>>           $extra_items Additional allowlisted index rows (e.g. sitemap blog posts).
	 * @return array<int,array<string,mixed>>
	 */
	public static function filter_links_to_index( array $links, array $site_index, array $extra_items = array() ): array {
		if ( empty( $links ) || ( empty( $site_index ) && empty( $extra_items ) ) ) {
			return $links;
		}

		$allowed = array();
		foreach ( array_merge( $extra_items, $site_index ) as $item ) {
			if ( empty( $item['url'] ) ) {
				continue;
			}
			$allowed[ strtolower( rtrim( (string) $item['url'], '/' ) ) ] = true;
		}

		if ( empty( $allowed ) ) {
			return array();
		}

		$out = array();
		foreach ( $links as $link ) {
			$url = isset( $link['url'] ) ? (string) $link['url'] : '';
			if ( $url === '' ) {
				continue;
			}
			$norm = strtolower( rtrim( $url, '/' ) );
			if ( isset( $allowed[ $norm ] ) ) {
				$out[] = $link;
			}
		}

		return $out;
	}

	/**
	 * Whether an index row is a service-area / location page.
	 *
	 * @param array<string,mixed> $item
	 */
	public static function is_service_area_item( array $item ): bool {
		if ( isset( $item['type'] ) && (string) $item['type'] === 'service-area' ) {
			return true;
		}
		$url = isset( $item['url'] ) ? strtolower( (string) $item['url'] ) : '';
		if ( $url === '' ) {
			return false;
		}
		return str_contains( $url, '/service-area/' ) || str_contains( $url, '/service-areas/' );
	}

	/**
	 * Service-area pages from the chat site index.
	 *
	 * @param array<int,array<string,mixed>> $site_index
	 * @return array<int,array<string,mixed>>
	 */
	public static function service_area_items( array $site_index ): array {
		return array_values(
			array_filter(
				$site_index,
				static function ( $item ) {
					return is_array( $item ) && self::is_service_area_item( $item );
				}
			)
		);
	}

	/**
	 * Whether the visitor is asking if the business services a city/area.
	 */
	public static function is_service_coverage_query( string $message ): bool {
		$lower = strtolower( trim( $message ) );
		if ( $lower === '' ) {
			return false;
		}

		$patterns = array(
			'/\b(do you|can you|will you|are you)\s+(service|serve|cover|deliver to|deliver in|install in|come to|travel to|work in|operate in|go to)\b/',
			'/\b(service|delivery|install(?:ation)?)\s+(area|in|to|for|near)\b/',
			'/\b(coverage|servicing)\s+(in|for|near|around)\b/',
			'/\bavailable\s+in\b/',
			'/\boutside\s+(of\s+)?(your\s+)?(area|city|service)\b/',
			'/\bdo\s+you\s+(go|travel)\b/',
		);
		foreach ( $patterns as $pattern ) {
			if ( preg_match( $pattern, $lower ) ) {
				return true;
			}
		}

		$term_set = array_flip( Neo_Pulse_Wp_Chat_Rag::extract_terms( $message ) );
		foreach ( array( 'service', 'serve', 'servicing', 'coverage', 'deliver', 'delivery', 'travel' ) as $term ) {
			if ( isset( $term_set[ $term ] ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Best matching indexed service-area page for the location in the message.
	 *
	 * @param array<int,array<string,mixed>> $site_index
	 * @return array<string,mixed>|null
	 */
	public static function find_listed_service_area( string $message, array $site_index ): ?array {
		$areas = self::service_area_items( $site_index );
		if ( empty( $areas ) ) {
			return null;
		}

		$matches = Neo_Pulse_Wp_Chat_Rag::find_fuzzy_topic_pages( $message, $areas, 1 );
		if ( empty( $matches[0] ) || ! is_array( $matches[0] ) ) {
			return null;
		}

		$score = (float) ( $matches[0]['fuzzy_score'] ?? 0 );
		if ( $score < Neo_Pulse_Wp_Chat_Rag::FUZZY_MIN_SCORE ) {
			return null;
		}

		return $matches[0];
	}

	/**
	 * Service-coverage question for a location with no matching service-area page.
	 *
	 * @param array<int,array<string,mixed>> $site_index
	 */
	public static function is_unlisted_service_area_query( string $message, array $site_index ): bool {
		if ( ! self::is_service_coverage_query( $message ) ) {
			return false;
		}
		return null === self::find_listed_service_area( $message, $site_index );
	}

	/**
	 * Resolve lead action including unlisted service-area coverage queries.
	 *
	 * @param array<int,array<string,mixed>> $site_index
	 * @return string|null booking|contact|pricing
	 */
	public static function resolve_lead_action( string $message, array $site_index = array() ): ?string {
		$action = self::detect_lead_action( $message );
		if ( null !== $action ) {
			return $action;
		}
		if ( ! empty( $site_index ) && self::is_unlisted_service_area_query( $message, $site_index ) ) {
			return 'contact';
		}
		return null;
	}

	/**
	 * Whether the visitor is asking the chat assistant to call them.
	 */
	public static function is_callback_request( string $message ): bool {
		$lower = strtolower( trim( $message ) );
		if ( $lower === '' ) {
			return false;
		}

		$patterns = array(
			'/\b(call me|call us back|callback|call back|phone me|ring me|give me a call)\b/',
			'/\bplease call\b/',
			'/\bcall (?:me|my|us)\b/',
		);
		foreach ( $patterns as $pattern ) {
			if ( preg_match( $pattern, $lower ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Detect high-intent lead actions from the user message.
	 *
	 * @return string|null booking|contact|pricing
	 */
	public static function detect_lead_action( string $message ): ?string {
		$terms    = Neo_Pulse_Wp_Chat_Rag::extract_terms( $message );
		$term_set = array_flip( $terms );

		$booking = array( 'book', 'booking', 'appointment', 'schedule', 'scheduling', 'consultation', 'consult', 'reserve' );
		foreach ( $booking as $t ) {
			if ( isset( $term_set[ $t ] ) ) {
				return 'booking';
			}
		}

		$contact = array( 'contact', 'call', 'phone', 'email', 'reach', 'directions', 'location', 'hours', 'human', 'person', 'someone', 'representative', 'staff', 'speak', 'owner', 'team', 'policy', 'privacy', 'refund', 'warranty' );
		foreach ( $contact as $t ) {
			if ( isset( $term_set[ $t ] ) ) {
				return 'contact';
			}
		}

		$pricing = array( 'price', 'pricing', 'cost', 'quote', 'estimate', 'rate', 'rates' );
		foreach ( $pricing as $t ) {
			if ( isset( $term_set[ $t ] ) ) {
				return 'pricing';
			}
		}

		return null;
	}

	/**
	 * Money-page slug list (shared with Site Search + chat lead routing).
	 *
	 * @return array<int,string>
	 */
	public static function money_page_slug_hints(): array {
		$base = array(
			'contact',
			'contact-us',
			'about',
			'about-us',
			'services',
			'our-services',
			'service',
			'pricing',
			'quote',
			'get-started',
			'locations',
			'consultation',
			'book',
			'appointment',
			'schedule',
		);

		$filtered = apply_filters( 'neo_pulse_wp_search_money_page_slugs', $base );
		return is_array( $filtered ) ? array_values( array_unique( array_map( 'strval', $filtered ) ) ) : $base;
	}

	/**
	 * Slug hints prioritized for a lead action type.
	 *
	 * @return array<int,string>
	 */
	private static function lead_action_slug_hints( string $action ): array {
		$map = array(
			'booking' => array( 'contact', 'contact-us', 'consultation', 'book', 'appointment', 'schedule', 'get-started' ),
			'contact' => array( 'contact', 'contact-us', 'about', 'about-us', 'locations' ),
			'pricing' => array( 'pricing', 'quote', 'get-started', 'services', 'our-services' ),
		);

		$hints = isset( $map[ $action ] ) ? $map[ $action ] : array();
		return array_values( array_unique( array_merge( $hints, self::money_page_slug_hints() ) ) );
	}

	/**
	 * Find indexed pages for a lead-intent message (contact, book, quote, etc.).
	 *
	 * @param array<int,array<string,mixed>> $site_index
	 * @return array<int,array<string,mixed>>
	 */
	public static function find_lead_pages( string $message, array $site_index, int $limit = 3 ): array {
		$action = self::resolve_lead_action( $message, $site_index );
		if ( null === $action || empty( $site_index ) || $limit < 1 ) {
			return array();
		}

		$hints  = self::lead_action_slug_hints( $action );
		$scored = array();

		foreach ( $site_index as $item ) {
			$score = self::score_lead_page_item( $item, $hints, $action );
			if ( $score <= 0 ) {
				continue;
			}
			$item['lead_score'] = $score;
			$scored[]           = $item;
		}

		if ( empty( $scored ) ) {
			return array();
		}

		usort(
			$scored,
			function ( $a, $b ) {
				return ( $b['lead_score'] ?? 0 ) <=> ( $a['lead_score'] ?? 0 );
			}
		);

		return array_slice( $scored, 0, $limit );
	}

	/**
	 * LINKS AVAILABLE block with lead pages prepended for Phase B.
	 *
	 * @param array<int,array<string,mixed>> $items
	 * @param array<int,array<string,mixed>> $site_index
	 */
	public static function build_links_context_block_for_reason( string $message, array $items, array $site_index ): string {
		$lead   = self::find_lead_pages( $message, $site_index, 3 );
		$fuzzy  = Neo_Pulse_Wp_Chat_Rag::find_fuzzy_topic_pages( $message, $site_index, 12 );
		$merged = self::dedupe_items_by_id( array_merge( $lead, $items, $fuzzy ) );
		return self::build_links_context_block( $merged );
	}

	/**
	 * @param array<string,mixed> $item
	 */
	private static function score_lead_page_item( array $item, array $hints, string $action ): float {
		if ( empty( $item['url'] ) ) {
			return 0.0;
		}

		$slug  = strtolower( (string) ( $item['slug'] ?? '' ) );
		$title = strtolower( wp_strip_all_tags( (string) ( $item['title'] ?? '' ) ) );
		$path  = strtolower( (string) wp_parse_url( (string) $item['url'], PHP_URL_PATH ) );
		$score = 0.0;

		foreach ( $hints as $hint ) {
			$hint = strtolower( (string) $hint );
			if ( $hint === '' ) {
				continue;
			}
			if ( self::slug_matches_hint( $slug, $hint ) ) {
				$score += 20.0;
			}
			if ( self::path_contains_hint( $path, $hint ) ) {
				$score += 15.0;
			}
			$hint_words = str_replace( '-', ' ', $hint );
			if ( $title !== '' && strpos( $title, $hint_words ) !== false ) {
				$score += 12.0;
			}
		}

		if ( $score <= 0 ) {
			return 0.0;
		}

		if ( isset( $item['type'] ) && (string) $item['type'] === 'page' ) {
			$score += 8.0;
		}

		if ( $action === 'booking' && ( self::slug_matches_hint( $slug, 'contact' ) || self::slug_matches_hint( $slug, 'consult' ) || strpos( $slug, 'consult' ) !== false ) ) {
			$score += 10.0;
		}

		return $score;
	}

	private static function slug_matches_hint( string $slug, string $hint ): bool {
		$slug = strtolower( trim( $slug, '/' ) );
		$hint = strtolower( trim( $hint, '/' ) );
		if ( $slug === '' || $hint === '' ) {
			return false;
		}
		if ( $slug === $hint ) {
			return true;
		}
		if ( str_starts_with( $slug, $hint . '-' ) || str_ends_with( $slug, '-' . $hint ) || strpos( $slug, '-' . $hint . '-' ) !== false ) {
			return true;
		}
		return in_array( $hint, explode( '-', $slug ), true );
	}

	private static function path_contains_hint( string $path, string $hint ): bool {
		$path = strtolower( trim( (string) $path, '/' ) );
		$hint = strtolower( trim( $hint, '/' ) );
		if ( $path === '' || $hint === '' ) {
			return false;
		}
		foreach ( explode( '/', $path ) as $segment ) {
			if ( self::slug_matches_hint( $segment, $hint ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<int,array<string,mixed>> $items
	 * @return array<int,array{label:string,url:string,icon:string}>
	 */
	public static function items_to_links( array $items ): array {
		$links = array();
		foreach ( $items as $item ) {
			if ( empty( $item['url'] ) || empty( $item['title'] ) ) {
				continue;
			}
			$links[] = array(
				'label' => (string) $item['title'],
				'url'   => (string) $item['url'],
				'icon'  => ( isset( $item['type'] ) && $item['type'] === 'post' ) ? 'post' : 'page',
			);
		}
		return $links;
	}

	/**
	 * @param array<int,array<string,mixed>> $items
	 * @return array<int,array<string,mixed>>
	 */
	public static function dedupe_items_by_id( array $items ): array {
		$out = array();
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) || empty( $item['id'] ) ) {
				continue;
			}
			$out[ (int) $item['id'] ] = $item;
		}
		return array_values( $out );
	}

	/**
	 * @param array<int,array{label:string,url:string,icon:string}> ...$groups
	 * @return array<int,array{label:string,url:string,icon:string}>
	 */
	private static function merge_link_groups( array ...$groups ): array {
		$merged = array();
		$seen   = array();
		foreach ( $groups as $group ) {
			foreach ( $group as $link ) {
				if ( empty( $link['url'] ) ) {
					continue;
				}
				$norm = strtolower( rtrim( (string) $link['url'], '/' ) );
				if ( isset( $seen[ $norm ] ) ) {
					continue;
				}
				$seen[ $norm ] = true;
				$merged[]      = $link;
			}
		}
		return $merged;
	}

	/**
	 * Grep site items for URLs relevant to the user message and drafted answer.
	 *
	 * @param array<int,array<string,mixed>> $items
	 * @param array<string,mixed>            $classification Phase A output.
	 * @return array<int,array{label:string,url:string,icon:string}>
	 */
	public static function grep_links_for_suggestion( string $user_message, string $answer, array $items, array $classification, array $site_index = array() ): array {
		$intent       = isset( $classification['intent'] ) ? (string) $classification['intent'] : 'question';
		$site_url     = home_url( '/' );
		$found        = array();
		$order        = array();
		$topic_intent = in_array( $intent, array( 'question', 'support' ), true );
		$phrases      = self::phrase_context( $classification );

		if ( $topic_intent ) {
			foreach ( self::pick_topic_links( $user_message, $items, 3, $site_index, true, $phrases ) as $link ) {
				$item = array(
					'title' => $link['label'],
					'url'   => $link['url'],
					'type'  => ( isset( $link['icon'] ) && $link['icon'] === 'post' ) ? 'post' : 'page',
				);
				self::add_link( $found, $order, $item, $site_url );
			}
		} else {
			foreach ( $items as $item ) {
				if ( empty( $item['url'] ) || empty( $item['title'] ) ) {
					continue;
				}
				if ( self::title_mentioned_in_text( (string) $item['title'], $answer ) ) {
					self::add_link( $found, $order, $item, $site_url );
				}
			}

			$harness_items = self::to_harness_items( $items );
			$query         = trim( $user_message . ' ' . $answer );
			$greped        = Neo_Pulse_Wp_Harness_Links::grep_linkable_posts( $harness_items, $query, 8 );
			foreach ( $greped as $post ) {
				$item = self::from_harness_post( $post, $items );
				if ( null !== $item ) {
					self::add_link( $found, $order, $item, $site_url );
				}
			}

			if ( in_array( $intent, array( 'navigation', 'recommendation' ), true ) ) {
				foreach ( array_slice( $items, 0, 3 ) as $item ) {
					if ( ! empty( $item['url'] ) && ! empty( $item['title'] ) ) {
						self::add_link( $found, $order, $item, $site_url );
					}
				}
			}
		}

		$links = array();
		foreach ( $order as $norm ) {
			if ( isset( $found[ $norm ] ) ) {
				$links[] = $found[ $norm ];
			}
		}

		return self::filter_links_to_index( $links, $site_index );
	}

	/**
	 * Rank items by slug/title/URL match to the user message.
	 *
	 * @param array<int,array<string,mixed>> $items
	 * @return array<int,array{label:string,url:string,icon:string}>
	 */
	public static function pick_topic_links( string $user_message, array $items, int $limit = 3, array $site_index = array(), bool $strict = false, array $extra_phrases = array(), array $exclude_urls = array() ): array {
		$user_message = trim( $user_message );
		$pool         = ! empty( $site_index ) ? $site_index : $items;
		if ( $user_message === '' || empty( $pool ) ) {
			return array();
		}

		$exclude = array();
		foreach ( $exclude_urls as $url ) {
			$norm = Neo_Pulse_Wp_Chat_History::normalize_url( (string) $url );
			if ( $norm !== '' ) {
				$exclude[ $norm ] = true;
			}
		}

		$fetch_limit = max( $limit * 8, 12 );
		$links       = array();
		foreach ( Neo_Pulse_Wp_Chat_Rag::find_fuzzy_topic_pages( $user_message, $pool, $fetch_limit, $extra_phrases ) as $item ) {
			$norm = Neo_Pulse_Wp_Chat_History::normalize_url( (string) ( $item['url'] ?? '' ) );
			if ( $norm === '' || isset( $exclude[ $norm ] ) ) {
				continue;
			}
			$phrases = self::anchor_phrases_for_item( $item );
			$label   = ! empty( $phrases[0] ) ? $phrases[0] : (string) ( $item['title'] ?? '' );
			if ( $label === '' ) {
				continue;
			}
			$links[] = array(
				'label' => ucwords( $label ),
				'url'   => (string) $item['url'],
				'icon'  => ( isset( $item['type'] ) && $item['type'] === 'post' ) ? 'post' : 'page',
				'score' => (float) ( $item['fuzzy_score'] ?? 0 ),
			);
			if ( count( $links ) >= $limit ) {
				break;
			}
		}

		return $links;
	}

	/**
	 * Best fuzzy-matched service/topic page for CTA.
	 *
	 * @param array<int,array<string,mixed>> $items
	 * @return array{label:string,url:string,icon:string,score:float}|null
	 */
	public static function pick_primary_topic_link( string $user_message, array $items, array $site_index = array(), array $extra_phrases = array(), array $exclude_urls = array() ): ?array {
		$links = self::pick_topic_links( $user_message, $items, 1, $site_index, true, $extra_phrases, $exclude_urls );
		return ! empty( $links ) ? $links[0] : null;
	}

	/**
	 * @param array<string,mixed> $classification
	 * @return array<int,string>
	 */
	private static function phrase_context( array $classification ): array {
		return isset( $classification['search_terms'] ) ? array_values( (array) $classification['search_terms'] ) : array();
	}

	/**
	 * @param array<int,array<string,mixed>> $pool
	 * @return array<int,array{item:array<string,mixed>,score:float}>
	 */
	private static function score_topic_pool( string $user_message, array $pool, bool $strict, array $extra_phrases = array() ): array {
		$scored = array();
		foreach ( $pool as $item ) {
			if ( empty( $item['url'] ) ) {
				continue;
			}
			$has_slug  = Neo_Pulse_Wp_Chat_Rag::item_has_topic_slug_match( $user_message, $item, $extra_phrases );
			$term_hits = Neo_Pulse_Wp_Chat_Rag::count_slug_path_term_hits( $user_message, $item, $extra_phrases );
			$score     = Neo_Pulse_Wp_Chat_Rag::score_topic_match( $user_message, $item, $extra_phrases );

			if ( $strict ) {
				if ( ! $has_slug || $score <= 0 ) {
					continue;
				}
				if ( $term_hits < 2 && ! self::has_strong_single_slug_match( $user_message, $item, $extra_phrases ) ) {
					continue;
				}
			} elseif ( ! $has_slug && $score < 6.0 ) {
				continue;
			} elseif ( $score <= 0 ) {
				continue;
			}

			$scored[] = array(
				'item'  => $item,
				'score' => $score,
			);
		}

		if ( empty( $scored ) ) {
			return array();
		}

		usort(
			$scored,
			function ( $a, $b ) use ( $user_message, $extra_phrases ) {
				$score_cmp = ( $b['score'] ?? 0 ) <=> ( $a['score'] ?? 0 );
				if ( $score_cmp !== 0 ) {
					return $score_cmp;
				}
				return Neo_Pulse_Wp_Chat_Rag::slug_focus_score( $user_message, $b['item'], $extra_phrases ) <=> Neo_Pulse_Wp_Chat_Rag::slug_focus_score( $user_message, $a['item'], $extra_phrases );
			}
		);

		return $scored;
	}

	/**
	 * Single-segment procedure slugs (e.g. invisalign) qualify with one strong term hit.
	 *
	 * @param array<string,mixed> $item
	 */
	private static function has_strong_single_slug_match( string $user_message, array $item, array $extra_phrases = array() ): bool {
		$match_terms = Neo_Pulse_Wp_Chat_Rag::extract_match_terms( $user_message, $extra_phrases );
		if ( empty( $match_terms ) ) {
			return false;
		}
		$slug = isset( $item['slug'] ) ? strtolower( (string) $item['slug'] ) : '';
		if ( $slug === '' && ! empty( $item['url'] ) ) {
			$path = wp_parse_url( (string) $item['url'], PHP_URL_PATH );
			if ( is_string( $path ) && $path !== '' ) {
				$slug = strtolower( trim( basename( untrailingslashit( $path ) ), '/' ) );
			}
		}
		if ( $slug === '' ) {
			return false;
		}
		foreach ( $match_terms as $term ) {
			if ( strlen( $term ) < 4 ) {
				continue;
			}
			if ( $slug === $term || strpos( $slug, $term ) !== false ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Natural anchor phrases from slug/title (longest first).
	 *
	 * @param array<string,mixed> $item
	 * @return array<int,string>
	 */
	public static function anchor_phrases_for_item( array $item ): array {
		$phrases = array();
		$slug    = isset( $item['slug'] ) ? trim( (string) $item['slug'] ) : '';

		if ( $slug === '' && ! empty( $item['url'] ) ) {
			$path = wp_parse_url( (string) $item['url'], PHP_URL_PATH );
			if ( is_string( $path ) && $path !== '' ) {
				$slug = trim( basename( untrailingslashit( $path ) ), '/' );
			}
		}

		if ( $slug !== '' ) {
			$phrases[] = str_replace( '-', ' ', $slug );
			$parts     = array_filter( explode( '-', $slug ) );
			if ( count( $parts ) >= 2 ) {
				$phrases[] = str_replace( '-', ' ', implode( '-', array_slice( $parts, -2 ) ) );
			}
			if ( count( $parts ) >= 1 ) {
				$phrases[] = str_replace( '-', ' ', end( $parts ) );
			}
		}

		if ( ! empty( $item['title'] ) ) {
			$title = trim( (string) $item['title'] );
			if ( $title !== '' ) {
				$phrases[] = $title;
				$stripped  = trim( preg_replace( '/[®™©]/u', '', $title ) );
				if ( $stripped !== '' && strcasecmp( $stripped, $title ) !== 0 ) {
					$phrases[] = $stripped;
				}
			}
		}

		if ( ! empty( $item['focus_keyword'] ) ) {
			$kw = trim( (string) $item['focus_keyword'] );
			if ( $kw !== '' ) {
				$phrases[] = $kw;
			}
		}

		$unique = array();
		foreach ( $phrases as $phrase ) {
			$phrase = trim( preg_replace( '/\s+/', ' ', $phrase ) );
			if ( strlen( $phrase ) < 3 ) {
				continue;
			}
			$key = strtolower( $phrase );
			if ( ! isset( $unique[ $key ] ) ) {
				$unique[ $key ] = $phrase;
			}
		}

		$out = array_values( $unique );
		usort(
			$out,
			function ( $a, $b ) {
				return strlen( $b ) <=> strlen( $a );
			}
		);

		return $out;
	}

	/**
	 * Merge grep results into a card; set CTA and inline markdown links when missing.
	 *
	 * @param array<string,mixed>              $card
	 * @param array<int,array<string,mixed>>   $items
	 * @param array<string,mixed>              $classification
	 * @return array<string,mixed>
	 */
	public static function attach_to_card( array $card, string $user_message, string $answer, array $items, array $classification, array $site_index = array(), array $exclude_urls = array(), array $exclude_topics = array(), bool $skip_body_links = false ): array {
		$intent       = isset( $classification['intent'] ) ? (string) $classification['intent'] : 'question';
		$topic_intent = in_array( $intent, array( 'question', 'support' ), true );
		$phrases      = self::phrase_context( $classification );
		$site_url     = home_url( '/' );

		$lead_action = self::resolve_lead_action( $user_message, $site_index );
		$lead_pages  = $lead_action ? self::find_lead_pages( $user_message, $site_index, 3 ) : array();
		$lead_links  = self::items_to_links( $lead_pages );
		$card_type   = isset( $card['type'] ) ? (string) $card['type'] : '';

		if ( $topic_intent && $card_type !== 'lead' ) {
			$link_pool    = self::dedupe_items_by_id( array_merge( $items, $lead_pages ) );
			if ( empty( $link_pool ) ) {
				$link_pool = $site_index;
			}
			$primary_link = self::pick_primary_topic_link( $user_message, $items, $link_pool, $phrases, $exclude_urls );
			$topic_links  = self::pick_topic_links( $user_message, $items, 2, $link_pool, true, $phrases, $exclude_urls );

			$primary_arr = array();
			if ( null !== $primary_link ) {
				$primary_arr[] = array(
					'label' => $primary_link['label'],
					'url'   => $primary_link['url'],
					'icon'  => isset( $primary_link['icon'] ) ? $primary_link['icon'] : 'page',
				);
			}

			$merged = self::merge_link_groups( $lead_links, $primary_arr, $topic_links );
			$merged = self::filter_links_to_index( $merged, $site_index, $items );
			$merged = self::filter_excluded_urls( $merged, $exclude_urls );

			if ( ! empty( $merged ) ) {
				$card['links'] = array_slice( $merged, 0, 4 );
				$card['cta']   = array(
					'label' => $merged[0]['label'],
					'url'   => $merged[0]['url'],
				);
			} else {
				unset( $card['cta'] );
				$card['links'] = array();
			}

			if ( ! empty( $card['body'] ) && ! $skip_body_links ) {
				$card['body'] = self::apply_body_product_links(
					(string) $card['body'],
					$user_message,
					$items,
					$site_index,
					$lead_pages,
					$phrases
				);
			}

			return self::finalize_card_topics( $card, $user_message, $items, $site_index, $exclude_topics );
		}

		$greped   = self::grep_links_for_suggestion( $user_message, $answer, $items, $classification, $site_index );
		$existing = isset( $card['links'] ) && is_array( $card['links'] ) ? $card['links'] : array();
		$prefixed = self::merge_link_groups( $lead_links, $existing, $greped );
		$merged   = self::filter_links_to_index( self::merge_links( $prefixed, array(), $site_url ), $site_index, $items );
		$merged   = self::filter_excluded_urls( $merged, $exclude_urls );

		$card['links'] = $merged;

		if ( ! ( is_array( $card['cta'] ?? null ) && ! empty( $card['cta']['url'] ) ) && ! empty( $merged ) && ( in_array( $intent, array( 'navigation', 'recommendation' ), true ) || $card_type === 'lead' ) ) {
			$card['cta'] = array(
				'label' => $merged[0]['label'],
				'url'   => $merged[0]['url'],
			);
		} elseif ( is_array( $card['cta'] ?? null ) && ! empty( $card['cta']['url'] ) ) {
			$cta_allowed = self::filter_links_to_index( array( $card['cta'] ), $site_index, $items );
			$cta_allowed = self::filter_excluded_urls( $cta_allowed, $exclude_urls );
			if ( empty( $cta_allowed ) ) {
				unset( $card['cta'] );
			}
		}

		if ( ! empty( $card['body'] ) && ! $skip_body_links ) {
			$card['body'] = self::apply_body_product_links(
				(string) $card['body'],
				$user_message,
				$items,
				$site_index,
				$lead_pages,
				$phrases
			);
		}

		return self::finalize_card_topics( $card, $user_message, $items, $site_index, $exclude_topics );
	}

	/**
	 * One deterministic link pass for template cards (summarize / tell-me-about).
	 * AI body is plain text; URLs come from the page outline and site index pool.
	 *
	 * @param array<int,array<string,mixed>> $pool
	 * @param array<int,array<string,mixed>> $site_index
	 */
	public static function finalize_template_body_links( string $body, string $source, array $pool, array $site_index ): string {
		if ( $body === '' ) {
			return $body;
		}

		$body = self::normalize_list_line_markdown( $body );
		$body = self::strip_inline_markdown_links( $body );

		$links = self::extract_markdown_link_map( $source );
		$seen  = array();
		foreach ( $links as $link ) {
			$key = strtolower( (string) $link['phrase'] );
			$seen[ $key ] = true;
		}

		foreach ( self::unlinked_list_labels( $body ) as $label ) {
			$key = strtolower( $label );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$match = self::best_pool_item_for_label( $label, $pool );
			if ( null === $match || empty( $match['url'] ) ) {
				continue;
			}
			$links[] = array(
				'phrase' => $label,
				'url'    => (string) $match['url'],
			);
			$seen[ $key ] = true;
		}

		if ( ! empty( $links ) ) {
			$body = self::apply_resolved_link_map( $body, $links );
		}

		$body = self::repair_malformed_markdown_links( $body );
		$body = self::strip_links_from_list_descriptions( $body );
		$body = self::strip_heading_markdown_links( $body );
		$body = self::strip_bracket_citations( $body );

		return self::dedupe_body_markdown_urls( $body );
	}

	/**
	 * Remove inline markdown links, keeping visible label text.
	 */
	private static function strip_inline_markdown_links( string $body ): string {
		if ( $body === '' ) {
			return $body;
		}

		$stripped = preg_replace( '/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i', '$1', $body );
		return is_string( $stripped ) ? $stripped : $body;
	}

	/**
	 * Apply OpenRouter-resolved inline links (longest phrase first).
	 *
	 * @param array<int,array{phrase:string,url:string}> $links
	 */
	public static function apply_resolved_link_map( string $body, array $links ): string {
		if ( $body === '' || empty( $links ) ) {
			return $body;
		}

		usort(
			$links,
			function ( $a, $b ) use ( $body ) {
				$phrase_a = (string) ( $a['phrase'] ?? '' );
				$phrase_b = (string) ( $b['phrase'] ?? '' );
				$a_label  = self::phrase_matches_any_unlinked_list_label( $body, $phrase_a );
				$b_label  = self::phrase_matches_any_unlinked_list_label( $body, $phrase_b );
				if ( $a_label !== $b_label ) {
					return $b_label <=> $a_label;
				}
				$pos_a    = $phrase_a === '' ? PHP_INT_MAX : stripos( $body, $phrase_a );
				$pos_b    = $phrase_b === '' ? PHP_INT_MAX : stripos( $body, $phrase_b );
				if ( $pos_a === false ) {
					$pos_a = PHP_INT_MAX;
				}
				if ( $pos_b === false ) {
					$pos_b = PHP_INT_MAX;
				}
				if ( $pos_a !== $pos_b ) {
					return $pos_a <=> $pos_b;
				}
				return strlen( $phrase_b ) <=> strlen( $phrase_a );
			}
		);

		foreach ( $links as $link ) {
			if ( empty( $link['phrase'] ) || empty( $link['url'] ) ) {
				continue;
			}
			$phrase = (string) $link['phrase'];
			$url    = (string) $link['url'];
			if ( self::phrase_is_list_description_only( $body, $phrase ) ) {
				continue;
			}
			$next   = self::link_phrase_on_unlinked_list_lines( $body, $phrase, $url );
			if ( $next !== $body ) {
				$body = $next;
			}
		}

		return self::repair_malformed_markdown_links( self::strip_links_from_list_descriptions( $body ) );
	}

	/**
	 * True when phrase appears only after the label colon on a list line (never link these).
	 */
	private static function phrase_is_list_description_only( string $body, string $phrase ): bool {
		$phrase = trim( $phrase );
		if ( $phrase === '' ) {
			return false;
		}

		$phrase_norm = self::normalize_for_link_match( $phrase );
		if ( $phrase_norm === '' ) {
			return false;
		}

		$in_label = false;
		$in_desc  = false;

		foreach ( preg_split( '/\r\n|\r|\n/', $body ) as $line ) {
			if ( ! preg_match( '/^\s*(?:[-*]|\d+\.)\s+(.+)$/', $line, $match ) ) {
				continue;
			}

			$content = (string) $match[1];
			$parts   = self::parse_list_line_parts( $content );
			if ( $parts['desc'] === '' ) {
				continue;
			}

			$label_part = (string) $parts['label'];
			$desc_part  = ltrim( (string) $parts['desc'], ': ' );
			$label_text = self::plain_list_label_text( $label_part );

			if ( self::segment_contains_phrase( $label_part, $phrase, $phrase_norm ) ) {
				$in_label = true;
			}
			if ( self::segment_contains_phrase( $desc_part, $phrase, $phrase_norm ) ) {
				$in_desc = true;
			}
		}

		return $in_desc && ! $in_label;
	}

	private static function segment_contains_phrase( string $segment, string $phrase, string $phrase_norm ): bool {
		if ( $segment === '' || $phrase === '' ) {
			return false;
		}

		if ( stripos( $segment, $phrase ) !== false ) {
			return true;
		}

		$pattern = self::phrase_to_flexible_pattern( $phrase );
		return $pattern !== '' && preg_match( $pattern, $segment ) === 1;
	}

	private static function phrase_matches_any_unlinked_list_label( string $body, string $phrase ): bool {
		$phrase = trim( $phrase );
		if ( $phrase === '' ) {
			return false;
		}

		foreach ( preg_split( '/\r\n|\r|\n/', $body ) as $line ) {
			if ( ! preg_match( '/^\s*(?:[-*]|\d+\.)\s+(.+)$/', $line, $match ) ) {
				continue;
			}

			$content = (string) $match[1];
			if ( self::list_line_label_is_linked( $content ) || ! str_contains( $content, ':' ) ) {
				continue;
			}

			$label = self::plain_list_label_text( self::list_line_label_segment( $content ) );
			if ( $label !== '' && self::phrase_matches_list_label( $label, $phrase ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Dedupe repeated URLs within each prose paragraph. Bullets and section blocks keep links.
	 */
	public static function dedupe_body_markdown_urls( string $body ): string {
		if ( $body === '' ) {
			return $body;
		}

		$lines = preg_split( '/\r\n|\r|\n/', $body );
		$seen  = array();
		$out   = array();

		foreach ( $lines as $line ) {
			$trimmed = trim( $line );
			if ( $trimmed === '' || preg_match( '/^###\s+/', $line ) ) {
				$seen  = array();
				$out[] = $line;
				continue;
			}

			if ( preg_match( '/^\s*(?:[-*]|\d+\.)\s+/', $line ) ) {
				$out[] = $line;
				continue;
			}

			$deduped = preg_replace_callback(
				'/\[([^\]]+)\]\(([^)]+)\)/',
				function ( array $matches ) use ( &$seen ) {
					$norm = strtolower( rtrim( trim( (string) $matches[2] ), '/' ) );
					if ( $norm === '' ) {
						return $matches[0];
					}
					if ( isset( $seen[ $norm ] ) ) {
						return (string) $matches[1];
					}
					$seen[ $norm ] = true;
					return $matches[0];
				},
				$line
			);

			$out[] = is_string( $deduped ) ? $deduped : $line;
		}

		return implode( "\n", $out );
	}

	/**
	 * @return array<int,string>
	 */
	public static function unlinked_list_labels( string $body ): array {
		if ( $body === '' ) {
			return array();
		}

		$labels = array();
		foreach ( preg_split( '/\r\n|\r|\n/', $body ) as $line ) {
			if ( ! preg_match( '/^\s*(?:[-*]|\d+\.)\s+(.+)$/', $line, $match ) ) {
				continue;
			}

			$content = trim( (string) $match[1] );
			if ( $content === '' || self::list_line_label_is_linked( $content ) ) {
				continue;
			}

			$label = self::plain_list_label_text( self::list_line_label_segment( $content ) );
			if ( $label !== '' && strlen( $label ) >= 3 ) {
				$labels[] = $label;
			}
		}

		return array_values( array_unique( $labels ) );
	}

	/**
	 * Link a phrase when it is the label on an unlinked list line (label only, never description).
	 */
	private static function link_phrase_on_unlinked_list_lines( string $body, string $phrase, string $url ): string {
		if ( $body === '' || trim( $phrase ) === '' ) {
			return $body;
		}

		$lines   = preg_split( '/\r\n|\r|\n/', $body );
		$changed = false;

		foreach ( $lines as $i => $line ) {
			if ( ! preg_match( '/^(\s*(?:[-*]|\d+\.)\s+)(.+)$/', $line, $match ) ) {
				continue;
			}

			$prefix  = (string) $match[1];
			$content = (string) $match[2];
			if ( self::list_line_label_is_linked( $content ) ) {
				continue;
			}

			$linked = self::link_list_line_label( $content, $phrase, $url );
			if ( $linked !== $content ) {
				$lines[ $i ] = $prefix . $linked;
				$changed     = true;
			}
		}

		return $changed ? implode( "\n", $lines ) : $body;
	}

	private static function list_line_label_is_linked( string $content ): bool {
		$label_part = self::list_line_label_segment( $content );
		if ( $label_part === '' ) {
			return false;
		}

		$label_text = self::plain_list_label_text( $label_part );
		return $label_text !== '' && preg_match( '/^\[[^\]]+\]\(/', $label_part ) === 1;
	}

	/**
	 * Split list item text into label and description at the label colon.
	 *
	 * @return array{label:string,desc:string}
	 */
	private static function parse_list_line_parts( string $content ): array {
		$content = trim( $content );
		if ( $content === '' ) {
			return array(
				'label' => '',
				'desc'  => '',
			);
		}

		if ( preg_match( '/^(\*\*(.+?):\*\*)\s*(.*)$/s', $content, $match ) ) {
			return array(
				'label' => (string) $match[1],
				'desc'  => ': ' . (string) $match[3],
			);
		}

		if ( preg_match( '/^(\*\*.+?\*\*):\s*(.*)$/s', $content, $match ) ) {
			return array(
				'label' => (string) $match[1],
				'desc'  => ': ' . (string) $match[2],
			);
		}

		if ( preg_match( '/^(\[[^\]]+\]\([^)]+\)):\s*(.*)$/s', $content, $match ) ) {
			return array(
				'label' => (string) $match[1],
				'desc'  => ': ' . (string) $match[2],
			);
		}

		$colon = strpos( $content, ':' );
		if ( $colon === false ) {
			return array(
				'label' => $content,
				'desc'  => '',
			);
		}

		return array(
			'label' => substr( $content, 0, $colon ),
			'desc'  => substr( $content, $colon ),
		);
	}

	private static function plain_list_label_text( string $label_part ): string {
		$label_part = trim( $label_part );
		if ( $label_part === '' ) {
			return '';
		}

		if ( preg_match( '/^\*\*(.+?):\*\*$/', $label_part, $match ) ) {
			return trim( (string) $match[1] );
		}

		if ( preg_match( '/^\[([^\]]+)\]\(/', $label_part, $match ) ) {
			return trim( (string) $match[1] );
		}

		return trim( (string) preg_replace( '/^\*\*|\*\*$/', '', $label_part ) );
	}

	private static function list_line_label_segment( string $content ): string {
		$parts = self::parse_list_line_parts( $content );
		return (string) $parts['label'];
	}

	private static function list_line_description_segment( string $content ): string {
		$parts = self::parse_list_line_parts( $content );
		return (string) $parts['desc'];
	}

	private static function phrase_matches_list_label( string $label, string $phrase ): bool {
		if ( $label === '' || $phrase === '' ) {
			return false;
		}

		$label_norm  = self::normalize_for_link_match( $label );
		$phrase_norm = self::normalize_for_link_match( $phrase );
		if ( $label_norm === $phrase_norm ) {
			return true;
		}

		return stripos( $label, $phrase ) === 0 || stripos( $phrase, $label ) === 0;
	}

	/**
	 * Replace list label (before `:`) with a markdown link; leave description plain.
	 */
	private static function link_list_line_label( string $content, string $phrase, string $url ): string {
		$label_part = self::list_line_label_segment( $content );
		$desc_part  = self::list_line_description_segment( $content );
		if ( $label_part === '' ) {
			return $content;
		}

		$label_text = self::plain_list_label_text( $label_part );
		if ( $label_text === '' || ! self::phrase_matches_list_label( $label_text, $phrase ) ) {
			return $content;
		}

		if ( preg_match( '/^\[[^\]]+\]\(/', $label_part ) ) {
			return $content;
		}

		$linked_label = '[' . $label_text . '](' . $url . ')';
		if ( $desc_part === '' ) {
			return $linked_label;
		}

		return $linked_label . $desc_part;
	}

	/**
	 * OpenRouter inline links for product names and page topics in the body.
	 *
	 * @param array<int,array<string,mixed>> $items
	 * @param array<int,array<string,mixed>> $site_index
	 * @param array<int,array<string,mixed>> $lead_pages
	 * @param array<int,string>              $phrases
	 */
	private static function apply_body_product_links( string $body, string $user_message, array $items, array $site_index, array $lead_pages, array $phrases ): string {
		if ( $body === '' ) {
			return $body;
		}

		$pool = self::body_link_pool( $body, $user_message, $items, $site_index, $lead_pages, $phrases );
		$body = self::normalize_list_line_markdown( $body );
		$body = self::merge_split_list_bullets( $body );
		$body = self::strip_links_from_labelless_bullets( $body );
		$body = self::apply_deterministic_list_links( $body, $pool );
		$body = self::strip_links_from_list_descriptions( $body );
		$body = self::repair_malformed_markdown_links( $body );
		$body = self::strip_heading_markdown_links( $body );
		$body = self::strip_bracket_citations( $body );

		return self::dedupe_body_markdown_urls( $body );
	}

	/**
	 * Site index pages whose anchor phrases appear in the given text.
	 *
	 * @param array<int,array<string,mixed>> $site_index
	 * @return array<int,array<string,mixed>>
	 */
	public static function index_items_for_text( string $text, array $site_index ): array {
		return self::index_items_matching_body( $text, $site_index );
	}

	/**
	 * Widen the attach pool for template cards (summarize / tell-me-about).
	 *
	 * @param array<int,array<string,mixed>> $site_index
	 * @param array<int,array<string,mixed>> $base_items
	 * @return array<int,array<string,mixed>>
	 */
	public static function items_for_template_attach( string $source, string $body, string $page_title, array $site_index, array $base_items ): array {
		$combined = trim( $page_title . "\n" . $source . "\n" . $body );
		$fuzzy    = Neo_Pulse_Wp_Chat_Rag::find_fuzzy_topic_pages( $combined, $site_index, 16 );
		return self::dedupe_items_by_id(
			array_merge(
				$base_items,
				self::index_items_for_text( $source, $site_index ),
				self::index_items_for_text( $body, $site_index ),
				self::index_items_for_text( $combined, $site_index ),
				$fuzzy
			)
		);
	}

	/**
	 * Extract inline markdown links from a page outline.
	 *
	 * @return array<int,array{phrase:string,url:string}>
	 */
	public static function extract_markdown_link_map( string $text ): array {
		if ( $text === '' || ! preg_match_all( '/\[([^\]]+)\]\(([^)]+)\)/', $text, $matches, PREG_SET_ORDER ) ) {
			return array();
		}

		$links = array();
		$seen  = array();
		foreach ( $matches as $match ) {
			$phrase = trim( (string) $match[1] );
			$url    = trim( (string) $match[2] );
			if ( $phrase === '' || $url === '' ) {
				continue;
			}
			$key = strtolower( $phrase );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$links[]      = array(
				'phrase' => $phrase,
				'url'    => $url,
			);
		}

		usort(
			$links,
			function ( $a, $b ) {
				return strlen( (string) $b['phrase'] ) <=> strlen( (string) $a['phrase'] );
			}
		);

		return $links;
	}

	/**
	 * Re-apply link targets from the page outline onto formatted template bodies.
	 *
	 * @param array<int,array{phrase:string,url:string}> $hints
	 * @param array<int,array<string,mixed>>           $site_index
	 */
	public static function apply_outline_link_hints( string $body, array $hints, array $site_index = array() ): string {
		if ( $body === '' || empty( $hints ) ) {
			return $body;
		}

		$allowed_hosts = array();
		$site_host     = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
		if ( is_string( $site_host ) && $site_host !== '' ) {
			$allowed_hosts[ strtolower( $site_host ) ] = true;
		}
		foreach ( $site_index as $item ) {
			if ( empty( $item['url'] ) ) {
				continue;
			}
			$host = wp_parse_url( (string) $item['url'], PHP_URL_HOST );
			if ( is_string( $host ) && $host !== '' ) {
				$allowed_hosts[ strtolower( $host ) ] = true;
			}
		}

		$links = array();
		foreach ( $hints as $hint ) {
			if ( empty( $hint['phrase'] ) || empty( $hint['url'] ) ) {
				continue;
			}
			$url = esc_url_raw( (string) $hint['url'] );
			if ( $url === '' ) {
				continue;
			}
			$host = wp_parse_url( $url, PHP_URL_HOST );
			if ( is_string( $host ) && $host !== '' && ! isset( $allowed_hosts[ strtolower( $host ) ] ) ) {
				continue;
			}
			$links[] = array(
				'phrase' => (string) $hint['phrase'],
				'url'    => $url,
			);
		}

		if ( empty( $links ) ) {
			return $body;
		}

		return self::apply_resolved_link_map( $body, $links );
	}

	/**
	 * Link unlinked list labels using the site page pool (no OpenRouter).
	 *
	 * @param array<int,array<string,mixed>> $pool
	 */
	private static function apply_deterministic_list_links( string $body, array $pool ): string {
		$labels = self::unlinked_list_labels( $body );
		if ( empty( $labels ) || empty( $pool ) ) {
			return $body;
		}

		$links = array();
		foreach ( $labels as $label ) {
			$match = self::best_pool_item_for_label( $label, $pool );
			if ( null === $match || empty( $match['url'] ) ) {
				continue;
			}
			$links[] = array(
				'phrase' => $label,
				'url'    => (string) $match['url'],
			);
		}

		if ( empty( $links ) ) {
			return $body;
		}

		return self::apply_resolved_link_map( $body, $links );
	}

	/**
	 * @param array<int,array<string,mixed>> $pool
	 * @return array<string,mixed>|null
	 */
	private static function best_pool_item_for_label( string $label, array $pool ): ?array {
		$label_norm = self::normalize_for_link_match( $label );
		if ( $label_norm === '' ) {
			return null;
		}

		$best       = null;
		$best_score = 0;

		foreach ( $pool as $item ) {
			if ( empty( $item['url'] ) ) {
				continue;
			}
			foreach ( self::anchor_phrases_for_item( $item ) as $phrase ) {
				$phrase_norm = self::normalize_for_link_match( $phrase );
				if ( $phrase_norm === '' ) {
					continue;
				}

				$score = 0;
				if ( $phrase_norm === $label_norm ) {
					$score = 100 + strlen( $phrase_norm );
				} elseif ( str_contains( $label_norm, $phrase_norm ) || str_contains( $phrase_norm, $label_norm ) ) {
					$score = 50 + strlen( $phrase_norm );
				}

				if ( $score > $best_score ) {
					$best_score = $score;
					$best       = $item;
				}
			}
		}

		return $best_score >= 50 ? $best : null;
	}

	private static function body_link_pool( string $body, string $user_message, array $items, array $site_index, array $lead_pages, array $phrases ): array {
		$fuzzy     = Neo_Pulse_Wp_Chat_Rag::find_fuzzy_topic_pages( $user_message, $site_index, 12, $phrases );
		$body_hits = self::index_items_matching_body( $body, $site_index );
		return self::dedupe_items_by_id( array_merge( $items, $fuzzy, $body_hits, $lead_pages ) );
	}

	/**
	 * Index pages whose title/slug phrases appear in the answer body.
	 *
	 * @param array<int,array<string,mixed>> $site_index
	 * @return array<int,array<string,mixed>>
	 */
	private static function index_items_matching_body( string $body, array $site_index ): array {
		if ( $body === '' || empty( $site_index ) ) {
			return array();
		}

		$hits = array();
		foreach ( $site_index as $item ) {
			if ( empty( $item['url'] ) ) {
				continue;
			}
			foreach ( self::anchor_phrases_for_item( $item ) as $phrase ) {
				if ( strlen( $phrase ) < 4 ) {
					continue;
				}
				if ( self::body_contains_phrase( $body, $phrase ) ) {
					$hits[] = $item;
					break;
				}
			}
		}

		return $hits;
	}

	private static function body_contains_phrase( string $body, string $phrase ): bool {
		if ( self::body_has_markdown_link_for_phrase( $body, $phrase ) ) {
			return false;
		}
		if ( stripos( $body, $phrase ) !== false ) {
			return true;
		}
		$pattern = self::phrase_to_flexible_pattern( $phrase );
		if ( $pattern !== '' && preg_match( $pattern, $body ) === 1 ) {
			return true;
		}
		$bold_pattern = self::phrase_to_bold_wrapped_pattern( $phrase );
		return $bold_pattern !== '' && preg_match( $bold_pattern, $body ) === 1;
	}

	private static function normalize_for_link_match( string $text ): string {
		$text = strtolower( $text );
		$text = preg_replace( '/[®™©]/u', '', $text );
		$text = preg_replace( '/[^\p{L}\p{N}\s]/u', ' ', $text );
		return trim( preg_replace( '/\s+/', ' ', (string) $text ) );
	}

	private static function phrase_to_flexible_pattern( string $phrase ): string {
		$words = preg_split( '/\s+/', self::normalize_for_link_match( $phrase ), -1, PREG_SPLIT_NO_EMPTY );
		if ( empty( $words ) ) {
			return '';
		}

		$parts = array();
		foreach ( $words as $i => $word ) {
			$quoted = preg_quote( $word, '/' );
			$parts[] = ( 0 === $i ) ? $quoted . '[®™©]?' : $quoted;
		}

		return '/\b(' . implode( '\s+', $parts ) . ')\b/iu';
	}

	private static function phrase_to_bold_wrapped_pattern( string $phrase ): string {
		$words = preg_split( '/\s+/', self::normalize_for_link_match( $phrase ), -1, PREG_SPLIT_NO_EMPTY );
		if ( empty( $words ) ) {
			return '';
		}

		$parts = array();
		foreach ( $words as $i => $word ) {
			$quoted = preg_quote( $word, '/' );
			$parts[] = ( 0 === $i ) ? $quoted . '[®™©]?' : $quoted;
		}

		return '/\*\*((' . implode( '\s+', $parts ) . '))(?::\*\*|\*\*:?)/iu';
	}

	/**
	 * Dedupe history chips then set related topics from the card.
	 *
	 * @param array<string,mixed>          $card
	 * @param array<int,array<string,mixed>> $items
	 * @param array<int,array<string,mixed>> $site_index
	 * @param array<int,string>            $exclude_topics
	 * @return array<string,mixed>
	 */
	private static function finalize_card_topics( array $card, string $user_message, array $items, array $site_index, array $exclude_topics ): array {
		unset( $user_message, $items, $site_index, $exclude_topics );
		unset( $card['relatedTopics'] );

		return $card;
	}

	/**
	 * @param array<string,mixed> $card
	 * @param array<int,string>   $exclude_topics
	 * @return array<string,mixed>
	 */
	private static function apply_topic_dedupe( array $card, array $exclude_topics ): array {
		if ( empty( $card['relatedTopics'] ) || ! is_array( $card['relatedTopics'] ) || empty( $exclude_topics ) ) {
			return $card;
		}

		$filtered = Neo_Pulse_Wp_Chat_History::filter_topics( $card['relatedTopics'], $exclude_topics );
		if ( empty( $filtered ) ) {
			unset( $card['relatedTopics'] );
		} else {
			$card['relatedTopics'] = $filtered;
		}

		return $card;
	}

	/**
	 * @param array<int,array{label:string,url:string,icon?:string}> $links
	 * @param array<int,string>                                      $exclude_urls
	 * @return array<int,array{label:string,url:string,icon?:string}>
	 */
	private static function filter_excluded_urls( array $links, array $exclude_urls ): array {
		if ( empty( $links ) || empty( $exclude_urls ) ) {
			return $links;
		}

		$exclude = array();
		foreach ( $exclude_urls as $url ) {
			$norm = Neo_Pulse_Wp_Chat_History::normalize_url( (string) $url );
			if ( $norm !== '' ) {
				$exclude[ $norm ] = true;
			}
		}

		$out = array();
		foreach ( $links as $link ) {
			if ( ! is_array( $link ) || empty( $link['url'] ) ) {
				continue;
			}
			$norm = Neo_Pulse_Wp_Chat_History::normalize_url( (string) $link['url'] );
			if ( $norm === '' || isset( $exclude[ $norm ] ) ) {
				continue;
			}
			$out[] = $link;
		}

		return $out;
	}

	private static function strip_bracket_citations( string $body ): string {
		$stripped = preg_replace( '/\s*\[\d+\]/', '', $body );
		return is_string( $stripped ) ? $stripped : $body;
	}

	/**
	 * @param array{label:string,url:string,icon?:string} $link
	 * @param array<int,array<string,mixed>>              $items
	 * @return array<string,mixed>
	 */
	private static function link_to_item( array $link, array $items, array $site_index = array() ): array {
		$url_norm = strtolower( rtrim( (string) $link['url'], '/' ) );
		$pools    = array_merge( $items, $site_index );
		foreach ( $pools as $item ) {
			if ( empty( $item['url'] ) ) {
				continue;
			}
			if ( strtolower( rtrim( (string) $item['url'], '/' ) ) === $url_norm ) {
				return $item;
			}
		}
		return array(
			'title' => isset( $link['label'] ) ? (string) $link['label'] : '',
			'url'   => (string) $link['url'],
			'type'  => ( isset( $link['icon'] ) && $link['icon'] === 'post' ) ? 'post' : 'page',
		);
	}

	private static function title_mentioned_in_text( string $title, string $text ): bool {
		$title = trim( $title );
		if ( $title === '' || $text === '' ) {
			return false;
		}
		return stripos( $text, $title ) !== false;
	}

	/**
	 * @param array<int,array<string,mixed>> $items
	 * @return array<int,array<string,mixed>>
	 */
	private static function to_harness_items( array $items ): array {
		$out = array();
		foreach ( $items as $item ) {
			if ( empty( $item['url'] ) ) {
				continue;
			}
			$slug = '';
			$path = wp_parse_url( (string) $item['url'], PHP_URL_PATH );
			if ( is_string( $path ) && $path !== '' ) {
				$slug = trim( basename( untrailingslashit( $path ) ), '/' );
			}
			$out[] = array(
				'id'      => isset( $item['id'] ) ? (int) $item['id'] : 0,
				'title'   => isset( $item['title'] ) ? (string) $item['title'] : '',
				'excerpt' => isset( $item['excerpt'] ) ? (string) $item['excerpt'] : '',
				'slug'    => $slug,
				'link'    => (string) $item['url'],
			);
		}
		return $out;
	}

	/**
	 * @param array<string,mixed>              $post
	 * @param array<int,array<string,mixed>>   $original_items
	 * @return array<string,mixed>|null
	 */
	private static function from_harness_post( array $post, array $original_items ): ?array {
		$link = isset( $post['link'] ) ? (string) $post['link'] : '';
		foreach ( $original_items as $item ) {
			if ( isset( $item['url'] ) && (string) $item['url'] === $link ) {
				return $item;
			}
		}
		if ( $link !== '' && ! empty( $post['title'] ) ) {
			return array(
				'id'    => isset( $post['id'] ) ? (int) $post['id'] : 0,
				'title' => (string) $post['title'],
				'url'   => $link,
				'type'  => 'page',
			);
		}
		return null;
	}

	/**
	 * @param array<string,array{label:string,url:string,icon:string}> $found
	 * @param array<int,string>                                        $order
	 * @param array<string,mixed>                                      $item
	 */
	private static function add_link( array &$found, array &$order, array $item, string $site_url ): void {
		$url = trim( (string) $item['url'] );
		if ( $url === '' ) {
			return;
		}
		$norm = Neo_Pulse_Wp_Harness_Links::normalize_internal_url( $site_url, $url );
		if ( $norm === '' ) {
			$norm = strtolower( rtrim( $url, '/' ) );
		}
		if ( isset( $found[ $norm ] ) ) {
			return;
		}
		$found[ $norm ] = array(
			'label' => (string) $item['title'],
			'url'   => $url,
			'icon'  => ( isset( $item['type'] ) && $item['type'] === 'post' ) ? 'post' : 'page',
		);
		$order[]        = $norm;
	}

	/**
	 * @param array<int,array{label:string,url:string,icon?:string}> $existing
	 * @param array<int,array{label:string,url:string,icon:string}>  $greped
	 * @return array<int,array{label:string,url:string,icon:string}>
	 */
	private static function merge_links( array $existing, array $greped, string $site_url ): array {
		$found = array();
		$order = array();

		foreach ( $existing as $link ) {
			if ( ! is_array( $link ) || empty( $link['url'] ) ) {
				continue;
			}
			$item = array(
				'title' => isset( $link['label'] ) ? (string) $link['label'] : '',
				'url'   => (string) $link['url'],
				'type'  => ( isset( $link['icon'] ) && $link['icon'] === 'post' ) ? 'post' : 'page',
			);
			self::add_link( $found, $order, $item, $site_url );
			$norm = end( $order );
			if ( is_string( $norm ) && isset( $found[ $norm ] ) ) {
				if ( ! empty( $link['label'] ) ) {
					$found[ $norm ]['label'] = (string) $link['label'];
				}
				if ( ! empty( $link['icon'] ) ) {
					$found[ $norm ]['icon'] = (string) $link['icon'];
				}
			}
		}

		foreach ( $greped as $link ) {
			$item = array(
				'title' => $link['label'],
				'url'   => $link['url'],
				'type'  => ( isset( $link['icon'] ) && $link['icon'] === 'post' ) ? 'post' : 'page',
			);
			self::add_link( $found, $order, $item, $site_url );
		}

		$merged = array();
		foreach ( $order as $norm ) {
			if ( isset( $found[ $norm ] ) ) {
				$merged[] = $found[ $norm ];
			}
		}
		return $merged;
	}

	/**
	 * Rewrite inline markdown links that point at off-topic pages to the primary topic URL.
	 */
	private static function replace_non_topic_markdown_urls( string $body, string $primary_url, string $user_message, array $items, array $site_index, array $extra_phrases = array() ): string {
		$primary_norm = strtolower( rtrim( $primary_url, '/' ) );
		$replaced     = preg_replace_callback(
			'/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i',
			function ( array $matches ) use ( $primary_norm, $primary_url, $user_message, $items, $site_index, $extra_phrases ) {
				$url_norm = strtolower( rtrim( $matches[2], '/' ) );
				if ( $url_norm === $primary_norm ) {
					return $matches[0];
				}
				$item = self::link_to_item(
					array(
						'label' => $matches[1],
						'url'   => $matches[2],
					),
					$items,
					$site_index
				);
				if (
					Neo_Pulse_Wp_Chat_Rag::item_has_topic_slug_match( $user_message, $item, $extra_phrases )
					&& (
						Neo_Pulse_Wp_Chat_Rag::count_slug_path_term_hits( $user_message, $item, $extra_phrases ) >= 2
						|| self::has_strong_single_slug_match( $user_message, $item, $extra_phrases )
					)
				) {
					return $matches[0];
				}
				return '[' . $matches[1] . '](' . $primary_url . ')';
			},
			$body
		);
		return is_string( $replaced ) ? $replaced : $body;
	}

	/**
	 * Link plain-text page mentions in the body (e.g. "contact us page") when no markdown link exists yet.
	 *
	 * @param array<int,array<string,mixed>>                         $lead_pages
	 * @param array<int,array{label:string,url:string,icon:string}> $links
	 */
	private static function link_body_page_mentions( string $body, array $lead_pages, array $links ): string {
		if ( $body === '' || empty( $links ) ) {
			return $body;
		}

		$phrases = array(
			'contact us page',
			'contact page',
			'contact us',
			'book an appointment',
			'book a consultation',
			'schedule a consultation',
			'get a quote',
			'request a quote',
		);

		foreach ( $lead_pages as $item ) {
			$title = trim( wp_strip_all_tags( (string) ( $item['title'] ?? '' ) ) );
			if ( $title !== '' ) {
				$phrases[] = strtolower( $title );
			}
		}

		foreach ( $links as $link ) {
			if ( empty( $link['url'] ) ) {
				continue;
			}
			$url = (string) $link['url'];
			if ( ! empty( $link['label'] ) ) {
				$phrases[] = strtolower( (string) $link['label'] );
			}
			foreach ( $phrases as $phrase ) {
				if ( self::body_has_markdown_link_for_phrase( $body, $phrase ) ) {
					break;
				}
				$linked = self::link_first_phrase( $body, $phrase, $url );
				if ( $linked !== $body ) {
					$body = $linked;
					break;
				}
			}
		}

		return $body;
	}

	/**
	 * Remove inline markdown links that are not slug/path matched (no substitute URL).
	 *
	 * @param array<int,array<string,mixed>> $lead_pages Lead page items whose URLs are preserved.
	 */
	private static function strip_non_topic_markdown_urls( string $body, string $user_message, array $items, array $site_index, array $extra_phrases = array(), array $lead_pages = array() ): string {
		$lead_url_norms = array();
		foreach ( $lead_pages as $page ) {
			if ( empty( $page['url'] ) ) {
				continue;
			}
			$lead_url_norms[ strtolower( rtrim( (string) $page['url'], '/' ) ) ] = true;
		}

		$replaced = preg_replace_callback(
			'/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i',
			function ( array $matches ) use ( $user_message, $items, $site_index, $extra_phrases, $lead_url_norms ) {
				$url_norm = strtolower( rtrim( $matches[2], '/' ) );
				if ( isset( $lead_url_norms[ $url_norm ] ) ) {
					return $matches[0];
				}
				$item = self::link_to_item(
					array(
						'label' => $matches[1],
						'url'   => $matches[2],
					),
					$items,
					$site_index
				);
				if (
					Neo_Pulse_Wp_Chat_Rag::item_has_topic_slug_match( $user_message, $item, $extra_phrases )
					&& (
						Neo_Pulse_Wp_Chat_Rag::count_slug_path_term_hits( $user_message, $item, $extra_phrases ) >= 2
						|| self::has_strong_single_slug_match( $user_message, $item, $extra_phrases )
					)
				) {
					return $matches[0];
				}
				return $matches[1];
			},
			$body
		);
		return is_string( $replaced ) ? $replaced : $body;
	}

	private static function body_contains_url( string $body, string $url ): bool {
		return stripos( $body, $url ) !== false;
	}

	/**
	 * Normalize corrupted inline markdown produced by double-wrapping.
	 */
	public static function repair_malformed_markdown_links( string $body ): string {
		if ( $body === '' ) {
			return $body;
		}

		$repaired = preg_replace(
			'/\[([^\]]+)\]\((https?:\/\/[^)]+)\)([a-z]{1,3})(?=\s|:|,|\.|$|\))/i',
			'[$1$3]($2)',
			$body
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		$repaired = preg_replace(
			'/\[\[([^\]]+)\]\((https?:\/\/[^)]+)\)\]\((https?:\/\/[^)]+)\)/i',
			'[$1]($2)',
			$body
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		$repaired = preg_replace(
			'/\[([^\]]+)\]\((https?:\/\/[^)]+)\)\]\((https?:\/\/[^)]+)\)/i',
			'[$1]($2)',
			$repaired
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		$repaired = preg_replace(
			'/\[([^\]]+)\]\((https?:\/\/[^)]+)\)\((https?:\/\/[^)]+)\)/i',
			'[$1]($2)',
			$repaired
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		$repaired = preg_replace(
			'/\*\*\[([^\]]+)\*\*\]\((https?:\/\/[^)]+)\)/i',
			'[$1]($2)',
			$repaired
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		$repaired = preg_replace(
			'/\*\*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\*\*/i',
			'[$1]($2)',
			$repaired
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		$repaired = preg_replace(
			'/\*\*(\[[^\]]+\]\((https?:\/\/[^)]+)\)):\*\*/i',
			'$1:',
			$repaired
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		$repaired = preg_replace(
			'/(\[[^\]]+\]\((https?:\/\/[^)]+)\)):\*\*\s*/i',
			'$1: ',
			$repaired
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		$repaired = preg_replace(
			'/\[([^\[\]]*)\[([^\]]+)\]\((https?)(?:\/\/[^\)]*)?\]\((https?:\/\/[^)]+)\)([^\]]*)\]/i',
			'[$2]($4)',
			$repaired
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		$repaired = preg_replace(
			'/(\[[^\]]+\]\((https?:\/\/[^)]+)\))!\*\*/i',
			'$1',
			$repaired
		);
		if ( ! is_string( $repaired ) ) {
			return $body;
		}

		return self::normalize_list_line_markdown( is_string( $repaired ) ? $repaired : $body );
	}

	/**
	 * Merge label-only bullets with the description bullet that follows.
	 */
	public static function merge_split_list_bullets( string $body ): string {
		if ( $body === '' ) {
			return $body;
		}

		$lines = preg_split( '/\r\n|\r|\n/', $body );
		$out   = array();
		$count = count( $lines );

		for ( $i = 0; $i < $count; $i++ ) {
			$line = $lines[ $i ];
			if ( ! preg_match( '/^(\s*(?:[-*]|\d+\.)\s+)(.+)$/', $line, $match ) ) {
				$out[] = $line;
				continue;
			}

			$prefix  = (string) $match[1];
			$content = trim( (string) $match[2] );
			if ( ! self::list_line_is_label_only( $content ) || $i + 1 >= $count ) {
				$out[] = $line;
				continue;
			}

			$next = $lines[ $i + 1 ];
			if ( ! preg_match( '/^\s*(?:[-*]|\d+\.)\s+(.+)$/', $next, $next_match ) ) {
				$out[] = $line;
				continue;
			}

			$next_content = trim( (string) $next_match[1] );
			if ( $next_content === '' || self::list_line_is_label_only( $next_content ) ) {
				$out[] = $line;
				continue;
			}

			$label_part = self::list_line_label_segment( $content );
			$label_part = self::fix_colon_inside_markdown_label( $label_part );
			$desc_text  = self::plain_text_from_markdown_segment( $next_content );
			if ( $desc_text === '' ) {
				$out[] = $line;
				continue;
			}

			$merged = $label_part . ': ' . $desc_text;
			$out[]  = $prefix . $merged;
			$i++;
		}

		return implode( "\n", $out );
	}

	/**
	 * Unwrap markdown links on bullets that are not label:description lines.
	 */
	public static function strip_links_from_labelless_bullets( string $body ): string {
		if ( $body === '' ) {
			return $body;
		}

		$lines = preg_split( '/\r\n|\r|\n/', $body );
		foreach ( $lines as $i => $line ) {
			if ( ! preg_match( '/^(\s*(?:[-*]|\d+\.)\s+)(.+)$/', $line, $match ) ) {
				continue;
			}

			$content = (string) $match[2];
			if ( self::list_line_has_label_colon( $content ) ) {
				continue;
			}

			$plain = self::plain_text_from_markdown_segment( $content );
			if ( $plain !== $content ) {
				$lines[ $i ] = (string) $match[1] . $plain;
			}
		}

		return implode( "\n", $lines );
	}

	private static function list_line_is_label_only( string $content ): bool {
		$content = trim( $content );
		if ( $content === '' ) {
			return false;
		}

		if ( preg_match( '/^\[[^\]]+\]\((https?:\/\/[^)]+)\)\s*$/', $content ) ) {
			return true;
		}

		$parts = self::parse_list_line_parts( $content );
		if ( $parts['desc'] !== '' && trim( $parts['desc'], ': ' ) !== '' ) {
			return false;
		}

		return str_ends_with( rtrim( $content ), ':' );
	}

	private static function list_line_has_label_colon( string $content ): bool {
		$content = trim( $content );
		if ( $content === '' ) {
			return false;
		}

		$parts = self::parse_list_line_parts( $content );
		return $parts['desc'] !== '' && trim( $parts['desc'], ': ' ) !== '';
	}

	private static function fix_colon_inside_markdown_label( string $label_part ): string {
		$fixed = preg_replace( '/\[([^\]]+):\]\((https?:\/\/[^)]+)\)/i', '[$1]($2)', $label_part );
		return is_string( $fixed ) ? $fixed : $label_part;
	}

	private static function plain_text_from_markdown_segment( string $segment ): string {
		$plain = preg_replace( '/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i', '$1', $segment );
		$plain = is_string( $plain ) ? $plain : $segment;
		$plain = preg_replace( '/^\*\*|\*\*$/', '', trim( $plain ) );
		return is_string( $plain ) ? trim( $plain ) : trim( $segment );
	}

	/**
	 * Fix list-line markdown where bold markers survived link injection.
	 */
	public static function normalize_list_line_markdown( string $body ): string {
		if ( $body === '' ) {
			return $body;
		}

		$lines = preg_split( '/\r\n|\r|\n/', $body );
		foreach ( $lines as $i => $line ) {
			if ( ! preg_match( '/^(\s*(?:[-*]|\d+\.)\s+)(.+)$/', $line, $match ) ) {
				continue;
			}

			$content = (string) $match[2];
			$content = self::fix_colon_inside_markdown_label( $content );
			$fixed   = preg_replace( '/^\*\*(\[[^\]]+\]\([^)]+\)):\*\*\s*/', '$1: ', $content );
			if ( is_string( $fixed ) ) {
				$content = $fixed;
			}

			$fixed = preg_replace( '/^(\[[^\]]+\]\([^)]+\)):\*\*\s*/', '$1: ', $content );
			if ( is_string( $fixed ) ) {
				$content = $fixed;
			}

			$fixed = preg_replace( '/^\*\*(.+?):\*\*\s*/', '$1: ', $content );
			if ( is_string( $fixed ) ) {
				$content = $fixed;
			}

			$fixed = preg_replace( '/^(.+?)!\*\*\s*$/', '$1', $content );
			if ( is_string( $fixed ) ) {
				$content = $fixed;
			}

			$lines[ $i ] = (string) $match[1] . $content;
		}

		return implode( "\n", $lines );
	}

	/**
	 * Remove markdown links from ### headings (keep visible text only).
	 */
	public static function strip_heading_markdown_links( string $body ): string {
		if ( $body === '' ) {
			return $body;
		}

		$lines = preg_split( '/\r\n|\r|\n/', $body );
		foreach ( $lines as $i => $line ) {
			if ( ! preg_match( '/^###\s+/', $line ) ) {
				continue;
			}

			$stripped = preg_replace( '/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i', '$1', $line );
			if ( is_string( $stripped ) ) {
				$lines[ $i ] = $stripped;
			}
		}

		return implode( "\n", $lines );
	}

	/**
	 * List lines are label-linked only; unwrap every markdown link after the first `:`.
	 */
	public static function strip_links_from_list_descriptions( string $body ): string {
		if ( $body === '' ) {
			return $body;
		}

		$lines = preg_split( '/\r\n|\r|\n/', $body );
		foreach ( $lines as $i => $line ) {
			if ( ! preg_match( '/^(\s*(?:[-*]|\d+\.)\s+)(.+)$/', $line, $match ) ) {
				continue;
			}

			$content = (string) $match[2];
			$desc    = self::list_line_description_segment( $content );
			if ( $desc === '' ) {
				continue;
			}

			$desc_clean = preg_replace( '/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i', '$1', $desc );
			if ( is_string( $desc_clean ) && $desc_clean !== $desc ) {
				$lines[ $i ] = (string) $match[1] . self::list_line_label_segment( $content ) . $desc_clean;
			}
		}

		return implode( "\n", $lines );
	}

	/**
	 * When a list label is linked, unwrap duplicate links for the same URL in that line's description.
	 */
	public static function strip_duplicate_links_in_list_descriptions( string $body ): string {
		return self::strip_links_from_list_descriptions( $body );
	}

	private static function body_has_markdown_link_for_phrase( string $body, string $phrase ): bool {
		$phrase = trim( $phrase );
		if ( $phrase === '' ) {
			return false;
		}

		$phrase_norm = self::normalize_for_link_match( $phrase );
		if ( preg_match_all( '/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/i', $body, $matches, PREG_SET_ORDER ) ) {
			foreach ( $matches as $match ) {
				$label_norm = self::normalize_for_link_match( (string) $match[1] );
				if ( $label_norm === '' || $phrase_norm === '' ) {
					continue;
				}
				if ( $label_norm === $phrase_norm ) {
					return true;
				}
			}
		}

		return false;
	}

	private static function link_first_phrase( string $body, string $phrase, string $url ): string {
		$phrase = trim( $phrase );
		if ( $phrase === '' || strlen( $phrase ) < 3 ) {
			return $body;
		}

		$lines = preg_split( '/\r\n|\r|\n/', $body );
		foreach ( $lines as $i => $line ) {
			if ( preg_match( '/^###\s+/', $line ) ) {
				continue;
			}

			if ( preg_match( '/^(\s*(?:[-*]|\d+\.)\s+)(.+)$/', $line, $match ) ) {
				$content = (string) $match[2];
				if ( str_contains( $content, ':' ) ) {
					if ( self::list_line_label_is_linked( $content ) ) {
						continue;
					}

					$linked = self::link_list_line_label( $content, $phrase, $url );
					if ( $linked !== $content ) {
						$lines[ $i ] = (string) $match[1] . $linked;
						return implode( "\n", $lines );
					}

					$label_only = self::list_line_label_segment( $content );
					if ( $label_only !== '' ) {
						$linked_label = self::link_first_phrase_in_segment( $label_only, $phrase, $url );
						if ( $linked_label !== $label_only ) {
							$lines[ $i ] = (string) $match[1] . $linked_label . self::list_line_description_segment( $content );
							return implode( "\n", $lines );
						}
					}
					continue;
				}
			}

			$linked_line = self::link_first_phrase_in_segment( $line, $phrase, $url );
			if ( $linked_line !== $line ) {
				$lines[ $i ] = $linked_line;
				return implode( "\n", $lines );
			}
		}

		return $body;
	}

	private static function link_first_phrase_in_segment( string $segment, string $phrase, string $url ): string {
		$phrase = trim( $phrase );
		if ( $phrase === '' || $segment === '' ) {
			return $segment;
		}

		$bold_pattern = self::phrase_to_bold_wrapped_pattern( $phrase );
		if ( $bold_pattern !== '' && preg_match( $bold_pattern, $segment, $match, PREG_OFFSET_CAPTURE ) ) {
			$full_start = (int) $match[0][1];
			$full_len   = strlen( (string) $match[0][0] );
			$label      = trim( (string) $match[1][0] );
			if ( $full_len > 0 && $label !== '' && ! self::phrase_overlaps_markdown_link( $segment, $full_start, $full_start + $full_len ) ) {
				return substr( $segment, 0, $full_start ) . '[' . $label . '](' . $url . ')' . substr( $segment, $full_start + $full_len );
			}
		}

		$offset     = 0;
		$lower      = strtolower( $segment );
		$needle     = strtolower( $phrase );
		$needle_len = strlen( $needle );

		while ( $offset < strlen( $segment ) ) {
			$pos = strpos( $lower, $needle, $offset );
			if ( $pos === false ) {
				break;
			}
			if ( self::phrase_inside_bold_list_label( $segment, $pos, $pos + $needle_len ) ) {
				$offset = $pos + $needle_len;
				continue;
			}
			if ( ! self::phrase_overlaps_markdown_link( $segment, $pos, $pos + $needle_len ) ) {
				$match_end = self::extend_phrase_match_end( $segment, $pos, $needle_len );
				$matched   = substr( $segment, $pos, $match_end - $pos );
				return substr( $segment, 0, $pos ) . '[' . $matched . '](' . $url . ')' . substr( $segment, $match_end );
			}
			$offset = $pos + $needle_len;
		}

		$pattern = self::phrase_to_flexible_pattern( $phrase );
		if ( $pattern !== '' && preg_match( $pattern, $segment, $match, PREG_OFFSET_CAPTURE ) ) {
			$start = (int) $match[1][1];
			$len   = strlen( (string) $match[1][0] );
			if ( $len > 0 && ! self::phrase_inside_bold_list_label( $segment, $start, $start + $len ) && ! self::phrase_overlaps_markdown_link( $segment, $start, $start + $len ) ) {
				$matched = substr( $segment, $start, $len );
				return substr( $segment, 0, $start ) . '[' . $matched . '](' . $url . ')' . substr( $segment, $start + $len );
			}
		}

		return $segment;
	}

	/**
	 * When a shorter anchor phrase matches inside a longer word, include common suffix letters (e.g. plural s).
	 */
	private static function extend_phrase_match_end( string $segment, int $pos, int $needle_len ): int {
		$end = $pos + $needle_len;
		if ( $end >= strlen( $segment ) ) {
			return $end;
		}

		$rest = substr( $segment, $end );
		if ( preg_match( '/^(s|es|ed|ing)(?=\s|:|,|\.|$|\))/i', $rest, $match ) ) {
			return $end + strlen( (string) $match[1] );
		}

		return $end;
	}

	private static function phrase_inside_bold_list_label( string $segment, int $start, int $end ): bool {
		if ( preg_match( '/^\*\*(.+?):\*\*$/', trim( $segment ), $match ) ) {
			$label_start = 2;
			$label_end   = $label_start + strlen( (string) $match[1] );
			return $start >= $label_start && $end <= $label_end;
		}

		return false;
	}

	private static function phrase_overlaps_markdown_link( string $body, int $start, int $end ): bool {
		$before = substr( $body, 0, $start );
		$open   = strrpos( $before, '[' );
		if ( $open !== false ) {
			$close_bracket = strpos( $body, ']', $open );
			if (
				$close_bracket !== false
				&& $start >= $open + 1
				&& $end <= $close_bracket
				&& $close_bracket + 2 <= strlen( $body )
				&& substr( $body, $close_bracket, 2 ) === ']('
			) {
				return true;
			}
		}

		$offset = 0;
		while ( preg_match( '/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/', $body, $match, PREG_OFFSET_CAPTURE, $offset ) ) {
			$full_start = (int) $match[0][1];
			$full_end   = $full_start + strlen( $match[0][0] );
			if ( $start < $full_end && $end > $full_start ) {
				return true;
			}
			$offset = $full_end;
		}

		return false;
	}

	private static function phrase_inside_markdown_link( string $body, int $start, int $end ): bool {
		return self::phrase_overlaps_markdown_link( $body, $start, $end );
	}
}
