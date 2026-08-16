<?php
/**
 * Platform read-only data tools (inventory, GSC, GA).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Platform_Data_Tools {

	const MAX_INVENTORY_ROWS = 50;
	const MAX_GSC_ROWS       = 30;
	const MAX_TOOLS          = 3;

	/** @var array<string,callable> */
	private static $registry = array();

	/** @var array<string,string> */
	private static $descriptions = array();

	/** @var array{source:string,acfComplete:bool} */
	private static $last_inventory_meta = array(
		'source'       => 'none',
		'acfComplete'  => false,
	);

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $module_research
	 * @return array{block:string,label:string,toolIds:array<int,string>,rows:array<int,array<string,mixed>>,classifierReason:string,inventorySource:string,acfComplete:bool}
	 */
	public static function research_for_message( string $message, array $history, array $body, ?array $module_research = null, ?callable $emit = null ): array {
		self::ensure_default_tools();
		return Neo_Pulse_App_Platform_Data_Orchestrator::research( $message, $history, $body, $module_research, $emit );
	}

	/**
	 * Run a read-only data tool for orchestrator fetch (not final answer).
	 *
	 * @param array<string,mixed> $body
	 * @param array<string,mixed> $params
	 * @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>}
	 */
	public static function fetch_raw_tool( string $id, array $body, array $params, string $message ): array {
		self::ensure_default_tools();
		return self::run_tool( sanitize_key( $id ), $body, $params, $message );
	}

	public static function register_tool( string $id, callable $handler, string $description ): void {
		self::$registry[ sanitize_key( $id ) ] = $handler;
		self::$descriptions[ sanitize_key( $id ) ] = $description;
	}

	private static function ensure_default_tools(): void {
		if ( count( self::$registry ) > 0 ) {
			return;
		}

		self::register_tool( 'inventory_meta', array( __CLASS__, 'tool_inventory_meta' ), 'Site cache totals: count and by_type breakdown.' );
		self::register_tool( 'inventory_grep', array( __CLASS__, 'tool_inventory_grep' ), 'Search cached content by title/URL/keyword. Params: post_type, query, limit (max 50).' );
		self::register_tool( 'inventory_recent', array( __CLASS__, 'tool_inventory_recent' ), 'Latest cached items. Params: post_type (default post), limit (max 50), sort (date_desc, date_asc, or title_asc), post_status (publish, future, draft).' );
		self::register_tool( 'inventory_scheduled', array( __CLASS__, 'tool_inventory_scheduled' ), 'Upcoming scheduled posts. Params: limit (max 50), sort (date_asc default).' );
		self::register_tool( 'inventory_audit', array( __CLASS__, 'tool_inventory_audit' ), 'Audit platform inventory for incomplete posts/pages. Params: post_type, issue, limit.' );
		self::register_tool( 'inventory_grade', array( __CLASS__, 'tool_inventory_grade' ), 'Grade recent posts/pages 1-10 from SEO signals. Params: post_type, limit, sort.' );
		self::register_tool( 'gsc_status', array( __CLASS__, 'tool_gsc_status' ), 'Check whether GSC is connected for a siteUrl.' );
		self::register_tool( 'gsc_top_queries', array( __CLASS__, 'tool_gsc_top_queries' ), 'Top GSC search queries.' );
		self::register_tool( 'gsc_top_pages', array( __CLASS__, 'tool_gsc_top_pages' ), 'Top GSC pages by clicks.' );
		self::register_tool( 'gsc_blog_performers', array( __CLASS__, 'tool_gsc_blog_performers' ), 'Top blog posts by GSC clicks with inventory titles.' );
		self::register_tool( 'gsc_page_queries', array( __CLASS__, 'tool_gsc_page_queries' ), 'Queries for one page URL.' );
		self::register_tool( 'gsc_performance_summary', array( __CLASS__, 'tool_gsc_performance_summary' ), 'GSC period summary with comparison.' );
		self::register_tool( 'gsc_reporting_status', array( __CLASS__, 'tool_gsc_reporting_status' ), 'GSC reporting connection status for a siteUrl.' );
		self::register_tool( 'gsc_reporting_compare_summary', array( __CLASS__, 'tool_gsc_reporting_compare_summary' ), 'GSC MoM or YoY compare summary from reporting bundle. Params: comparePreset (mom|yoy).' );
		self::register_tool( 'post_creator_status', array( __CLASS__, 'tool_post_creator_status' ), 'Post creator readiness for a WordPress site (credentials, scheduling hints).' );
		self::register_tool( 'ga_organic_summary', array( __CLASS__, 'tool_ga_organic_summary' ), 'GA4 organic traffic and conversions vs comparison period.' );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<int,array{id:string,description:string}>
	 */
	public static function available_tools( array $body ): array {
		self::ensure_default_tools();
		$tools = array();

		if ( Neo_Pulse_App_Platform_Inventory::inventory_configured( $body ) ) {
			foreach ( array( 'inventory_meta', 'inventory_grep', 'inventory_recent', 'inventory_scheduled', 'post_creator_status' ) as $id ) {
				if ( isset( self::$descriptions[ $id ] ) ) {
					$tools[] = array(
						'id'          => $id,
						'description' => self::$descriptions[ $id ],
					);
				}
			}
		}

		if ( self::gsc_configured() ) {
			foreach ( array( 'gsc_status', 'gsc_top_queries', 'gsc_top_pages', 'gsc_blog_performers', 'gsc_page_queries', 'gsc_performance_summary', 'gsc_reporting_status', 'gsc_reporting_compare_summary' ) as $id ) {
				if ( isset( self::$descriptions[ $id ] ) ) {
					$tools[] = array(
						'id'          => $id,
						'description' => self::$descriptions[ $id ],
					);
				}
			}
		}

		if ( self::ga_configured( $body ) ) {
			if ( isset( self::$descriptions['ga_organic_summary'] ) ) {
				$tools[] = array(
					'id'          => 'ga_organic_summary',
					'description' => self::$descriptions['ga_organic_summary'],
				);
			}
		}

		return $tools;
	}

	/**
	 * @param array<int,array<string,mixed>>           $history
	 * @param array<string,mixed>                      $body
	 * @param array<int,array{id:string,description:string}> $available
	 * @return array{tools:array<int,array{id:string,params:array<string,mixed>}>,reason:string}
	 */
	public static function classify_data_tools( string $message, array $history, array $body, array $available ): array {
		$empty = array(
			'tools'  => array(),
			'reason' => '',
		);
		if ( count( $available ) === 0 ) {
			return $empty;
		}

		$tool_lines = array();
		$allowed    = array();
		foreach ( $available as $tool ) {
			if ( empty( $tool['id'] ) ) {
				continue;
			}
			$id             = sanitize_key( (string) $tool['id'] );
			$allowed[ $id ] = true;
			$tool_lines[]   = $id . ': ' . (string) ( $tool['description'] ?? '' );
		}

		$fast = self::fast_path_data_tool_plan( $message );
		if ( $fast !== null ) {
			$first = $fast['tools'][0]['id'] ?? '';
			if ( $first !== '' && isset( $allowed[ $first ] ) ) {
				return $fast;
			}
		}

		$active  = self::active_property_summary( $body );
		$sources = array();
		if ( Neo_Pulse_App_Platform_Inventory::inventory_configured( $body ) ) {
			$sources[] = 'inventory';
		}
		if ( self::gsc_configured() ) {
			$sources[] = 'gsc';
		}
		if ( self::ga_configured( $body ) ) {
			$sources[] = 'ga';
		}

		$system = 'Return JSON only: {"tools":[{"id":"inventory_grade","params":{"post_type":"post","limit":10}}],"reason":"brief"}. Pick 0-' . self::MAX_TOOLS . ' read-only data tools. Use inventory_grade for grade, score, rate, or "out of ten" post/page quality requests and for why/explain-grade follow-ups. Use inventory_audit for broken, incomplete, missing meta/keyword/SEO questions. Use inventory_recent for latest post lists without scoring. Use inventory_grep only for literal title/URL/keyword search. Do not leave tools empty when the user asks to grade or score posts. Leave tools empty only for pure UI/how-to with no site data need.';
		$user   = 'Available tools:' . "\n" . implode( "\n", $tool_lines )
			. "\nActive property: " . $active
			. "\nData sources enabled: " . implode( ', ', $sources )
			. "\nUser message: " . $message;

		$raw    = Neo_Pulse_App_Chat_Openrouter::chat_text(
			array(
				array(
					'role'    => 'system',
					'content' => $system,
				),
				array(
					'role'    => 'user',
					'content' => $user,
				),
			),
			array(
				'temperature' => 0.1,
				'maxTokens'   => 320,
			)
		);
		$parsed = self::parse_json_object( $raw );
		if ( ! is_array( $parsed ) || empty( $parsed['tools'] ) || ! is_array( $parsed['tools'] ) ) {
			return $empty;
		}

		$tools = array();
		foreach ( $parsed['tools'] as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['id'] ) ) {
				continue;
			}
			$id = sanitize_key( (string) $entry['id'] );
			if ( ! isset( $allowed[ $id ] ) ) {
				continue;
			}
			$params  = isset( $entry['params'] ) && is_array( $entry['params'] ) ? $entry['params'] : array();
			$tools[] = array(
				'id'     => $id,
				'params' => $params,
			);
			if ( count( $tools ) >= self::MAX_TOOLS ) {
				break;
			}
		}

		return array(
			'tools'  => $tools,
			'reason' => isset( $parsed['reason'] ) ? sanitize_text_field( (string) $parsed['reason'] ) : '',
		);
	}

	/**
	 * @param array{tools:array<int,array{id:string,params:array<string,mixed>}>,reason:string} $plan
	 * @param array<string,mixed> $body
	 * @return array{block:string,label:string,toolIds:array<int,string>,rows:array<int,array<string,mixed>>}
	 */
	public static function execute_tools( array $plan, array $body, string $message = '' ): array {
		self::ensure_default_tools();
		$results  = array();
		$tool_ids = array();
		$rows     = array();

		foreach ( $plan['tools'] as $entry ) {
			if ( empty( $entry['id'] ) ) {
				continue;
			}
			$id     = sanitize_key( (string) $entry['id'] );
			$params = isset( $entry['params'] ) && is_array( $entry['params'] ) ? $entry['params'] : array();
			$result = self::run_tool( $id, $body, $params, $message );
			$results[] = array(
				'id'    => $id,
				'ok'    => ! empty( $result['ok'] ),
				'note'  => isset( $result['note'] ) ? (string) $result['note'] : '',
				'lines' => isset( $result['lines'] ) && is_array( $result['lines'] ) ? $result['lines'] : array(),
				'rows'  => isset( $result['rows'] ) && is_array( $result['rows'] ) ? $result['rows'] : array(),
			);
			$tool_ids[] = $id;
			if ( ! empty( $result['rows'] ) && is_array( $result['rows'] ) ) {
				$rows = array_merge( $rows, $result['rows'] );
			}
		}

		return array(
			'block'   => self::format_researched_block( $results ),
			'label'   => count( $tool_ids ) > 0 ? 'site data' : '',
			'toolIds' => $tool_ids,
			'rows'    => $rows,
		);
	}

	/**
	 * @param array<int,array{id:string,ok:bool,note:string,lines:array<int,string>,rows:array<int,array<string,mixed>>}> $results
	 */
	public static function format_researched_block( array $results ): string {
		if ( count( $results ) === 0 ) {
			return '';
		}

		$sections = array( '## Researched data' );
		foreach ( $results as $result ) {
			$id = (string) ( $result['id'] ?? 'tool' );
			$sections[] = '### ' . $id;
			if ( ! empty( $result['note'] ) ) {
				$sections[] = (string) $result['note'];
			}
			if ( ! empty( $result['lines'] ) && is_array( $result['lines'] ) ) {
				$sections[] = implode( "\n", $result['lines'] );
			}
		}

		return trim( implode( "\n", $sections ) );
	}

	/**
	 * @param array<string,mixed> $body
	 * @param array<string,mixed> $params
	 * @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>}
	 */
	private static function run_tool( string $id, array $body, array $params, string $message ): array {
		self::ensure_default_tools();
		if ( ! isset( self::$registry[ $id ] ) || ! is_callable( self::$registry[ $id ] ) ) {
			return array(
				'ok'   => false,
				'note' => 'Unknown data tool.',
			);
		}
		return call_user_func( self::$registry[ $id ], $body, $params, $message );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_inventory_meta( array $body, array $params, string $message ): array {
		$resolved = self::resolve_hint_rows( $body, array( 'posts', 'pages' ) );
		$rows     = $resolved['rows'];
		if ( count( $rows ) === 0 ) {
			list( , $data ) = Neo_Pulse_App_Wp_Pulse_Assist::site_inventory( $body );
			if ( empty( $data['ok'] ) ) {
				return array(
					'ok'   => false,
					'note' => isset( $data['error'] ) ? (string) $data['error'] : 'Site inventory unavailable.',
				);
			}
			$count   = (int) ( $data['count'] ?? 0 );
			$by_type = isset( $data['by_type'] ) && is_array( $data['by_type'] ) ? $data['by_type'] : array();
			$lines   = array( 'Total cached items: ' . $count );
			foreach ( $by_type as $type => $n ) {
				$lines[] = sanitize_key( (string) $type ) . ': ' . (int) $n;
			}
			return array(
				'ok'    => true,
				'lines' => $lines,
			);
		}

		$by_type = array();
		foreach ( $rows as $row ) {
			$type = sanitize_key( (string) ( $row['type'] ?? 'post' ) );
			if ( ! isset( $by_type[ $type ] ) ) {
				$by_type[ $type ] = 0;
			}
			$by_type[ $type ]++;
		}
		$lines = array( 'Total platform inventory items: ' . count( $rows ) );
		foreach ( $by_type as $type => $n ) {
			$lines[] = $type . ': ' . (int) $n;
		}
		return array(
			'ok'    => true,
			'lines' => $lines,
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_inventory_grep( array $body, array $params, string $message ): array {
		$query = isset( $params['query'] ) ? sanitize_text_field( (string) $params['query'] ) : '';
		if ( $query === '' ) {
			return array(
				'ok'   => false,
				'note' => 'inventory_grep requires a query param.',
			);
		}
		$collections = Neo_Pulse_App_Platform_Inventory::collections_for_params( $params );
		$resolved    = self::resolve_hint_rows( $body, $collections );
		$filtered    = Neo_Pulse_App_Platform_Inventory::filter_inventory_rows(
			$resolved['rows'],
			array_merge(
				$params,
				array(
					'query' => $query,
					'limit' => isset( $params['limit'] ) ? (int) $params['limit'] : 20,
				)
			),
			self::MAX_INVENTORY_ROWS
		);
		return self::inventory_rows_result( $filtered );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_inventory_recent( array $body, array $params, string $message ): array {
		$post_type   = ! empty( $params['post_type'] ) ? sanitize_key( (string) $params['post_type'] ) : 'post';
		$post_status = ! empty( $params['post_status'] )
			? Neo_Pulse_App_Platform_Inventory::normalize_post_status( (string) $params['post_status'] )
			: 'publish';
		if ( $post_status === 'future' ) {
			return self::tool_inventory_scheduled( $body, $params, $message );
		}
		$collections = array( Neo_Pulse_App_Platform_Inventory::collection_for_post_type( $post_type ) );
		if ( in_array( $post_status, array( 'draft', 'pending', 'private' ), true ) ) {
			$resolved = Neo_Pulse_App_Platform_Inventory::resolve_for_subagent(
				$body,
				array(
					'post_type'   => $post_type,
					'post_status' => $post_status,
					'limit'       => isset( $params['limit'] ) ? (int) $params['limit'] : 10,
					'sort'        => ! empty( $params['sort'] ) ? sanitize_key( (string) $params['sort'] ) : 'date_desc',
				)
			);
			return self::inventory_rows_result( $resolved['rows'] );
		}
		$resolved    = self::resolve_hint_rows( $body, $collections );
		$filtered    = Neo_Pulse_App_Platform_Inventory::filter_inventory_rows(
			$resolved['rows'],
			array(
				'post_type'   => $post_type,
				'post_status' => $post_status,
				'limit'       => isset( $params['limit'] ) ? (int) $params['limit'] : 10,
				'sort'        => ! empty( $params['sort'] ) ? sanitize_key( (string) $params['sort'] ) : 'date_desc',
			),
			self::MAX_INVENTORY_ROWS
		);
		return self::inventory_rows_result( $filtered );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_inventory_scheduled( array $body, array $params, string $message ): array {
		$resolved = Neo_Pulse_App_Platform_Inventory::resolve_scheduled_rows(
			$body,
			array(
				'post_type'   => ! empty( $params['post_type'] ) ? sanitize_key( (string) $params['post_type'] ) : 'post',
				'post_status' => 'future',
				'limit'       => isset( $params['limit'] ) ? (int) $params['limit'] : 10,
				'sort'        => ! empty( $params['sort'] ) ? sanitize_key( (string) $params['sort'] ) : 'date_asc',
			)
		);
		return self::inventory_rows_result( $resolved['rows'] );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_inventory_audit( array $body, array $params, string $message ): array {
		$collections = Neo_Pulse_App_Platform_Inventory::collections_for_params( $params );
		$resolved    = self::resolve_audit_rows( $body, $collections );
		$rows        = $resolved['rows'];
		if ( count( $rows ) === 0 ) {
			return array(
				'ok'    => false,
				'note'  => 'Site inventory unavailable for audit.',
				'lines' => array( 'No platform inventory rows to audit.' ),
			);
		}

		$issue_filter = ! empty( $params['issue'] ) ? sanitize_key( (string) $params['issue'] ) : '';
		$limit        = isset( $params['limit'] ) ? max( 1, min( self::MAX_INVENTORY_ROWS, (int) $params['limit'] ) ) : 20;

		$summary = array(
			'scanned'               => count( $rows ),
			'incomplete'            => 0,
			'missing_title'         => 0,
			'missing_meta'            => 0,
			'missing_focus_keyword' => 0,
			'missing_seo_research'  => 0,
			'missing_faq'           => 0,
			'no_featured_image'     => 0,
			'meta_short'            => 0,
			'meta_long'             => 0,
		);
		$flagged = array();

		foreach ( $rows as $row ) {
			$issues = Neo_Pulse_App_Inventory_Seo_Signals::detect_issues( $row );
			if ( count( $issues ) === 0 ) {
				continue;
			}
			if ( $issue_filter !== '' ) {
				$issues = array_values( array_filter( $issues, static function ( $issue ) use ( $issue_filter ) {
					return $issue === $issue_filter;
				} ) );
				if ( count( $issues ) === 0 ) {
					continue;
				}
			}
			$summary['incomplete']++;
			foreach ( $issues as $issue ) {
				if ( isset( $summary[ $issue ] ) ) {
					$summary[ $issue ]++;
				}
			}
			$flagged[] = array(
				'title'  => (string) ( $row['title'] ?? '' ),
				'url'    => (string) ( $row['url'] ?? '' ),
				'type'   => (string) ( $row['type'] ?? '' ),
				'issues' => $issues,
			);
		}

		usort(
			$flagged,
			static function ( $a, $b ) {
				$ac = count( $a['issues'] ?? array() );
				$bc = count( $b['issues'] ?? array() );
				if ( $ac !== $bc ) {
					return $bc <=> $ac;
				}
				return strcasecmp( (string) ( $a['title'] ?? '' ), (string) ( $b['title'] ?? '' ) );
			}
		);
		$flagged = array_slice( $flagged, 0, $limit );

		$lines   = array();
		$lines[] = 'Scanned ' . (int) $summary['scanned'] . ' items from platform inventory (source: ' . $resolved['source'] . ').';
		$lines[] = 'Incomplete (1+ issue): ' . (int) $summary['incomplete'];
		foreach ( array( 'missing_title', 'missing_meta', 'missing_focus_keyword', 'missing_seo_research', 'missing_faq', 'no_featured_image', 'meta_short', 'meta_long' ) as $key ) {
			if ( (int) $summary[ $key ] > 0 ) {
				$lines[] = ucwords( str_replace( '_', ' ', $key ) ) . ': ' . (int) $summary[ $key ];
			}
		}
		if ( count( $flagged ) === 0 ) {
			$lines[] = 'No incomplete items found for the requested filter.';
		} else {
			$lines[] = 'Flagged items:';
			foreach ( $flagged as $item ) {
				$title      = (string) ( $item['title'] ?? '' );
				$url        = (string) ( $item['url'] ?? '' );
				$issue_text = is_array( $item['issues'] ?? null ) ? implode( ', ', $item['issues'] ) : '';
				$link_title = str_replace( array( '[', ']' ), '', $title );
				if ( $url !== '' && $link_title !== '' ) {
					$lines[] = '- [' . $link_title . '](' . $url . ') — ' . $issue_text;
				} elseif ( $link_title !== '' ) {
					$lines[] = '- ' . $link_title . ' — ' . $issue_text;
				}
			}
		}

		return array(
			'ok'    => true,
			'lines' => $lines,
			'rows'  => $flagged,
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_inventory_grade( array $body, array $params, string $message ): array {
		$post_type   = ! empty( $params['post_type'] ) ? sanitize_key( (string) $params['post_type'] ) : 'post';
		$limit       = isset( $params['limit'] ) ? max( 1, min( self::MAX_INVENTORY_ROWS, (int) $params['limit'] ) ) : 10;
		$collections = array( Neo_Pulse_App_Platform_Inventory::collection_for_post_type( $post_type ) );
		$resolved    = self::resolve_audit_rows( $body, $collections );
		$rows        = $resolved['rows'];
		if ( count( $rows ) === 0 ) {
			return array(
				'ok'    => false,
				'note'  => 'Site inventory unavailable for grading.',
				'lines' => array( 'No platform inventory rows to grade.' ),
			);
		}

		$filtered = Neo_Pulse_App_Platform_Inventory::filter_inventory_rows(
			$rows,
			array(
				'post_type' => $post_type,
				'limit'     => $limit,
				'sort'      => ! empty( $params['sort'] ) ? sanitize_key( (string) $params['sort'] ) : 'date_desc',
			),
			self::MAX_INVENTORY_ROWS
		);
		if ( count( $filtered ) === 0 ) {
			return array(
				'ok'    => false,
				'lines' => array( 'No matching posts to grade.' ),
			);
		}

		$lines = array(
			'Graded ' . count( $filtered ) . ' recent items (1-10 SEO completeness, source: ' . $resolved['source'] . ', acfComplete: ' . ( $resolved['acfComplete'] ? 'yes' : 'no' ) . '):',
		);
		$out = array();
		foreach ( $filtered as $row ) {
			$scored  = Neo_Pulse_App_Inventory_Seo_Signals::score_row( $row );
			$lines[] = Neo_Pulse_App_Inventory_Seo_Signals::format_grade_line( $row, $scored );
			$out[]   = array(
				'title'  => (string) ( $row['title'] ?? '' ),
				'url'    => (string) ( $row['url'] ?? '' ),
				'type'   => (string) ( $row['type'] ?? '' ),
				'score'  => (int) ( $scored['score'] ?? 1 ),
				'issues' => $scored['issues'] ?? array(),
				'signals' => $scored['signals'] ?? array(),
			);
		}

		return array(
			'ok'    => true,
			'lines' => $lines,
			'rows'  => $out,
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @param array<int,string>   $collections
	 * @return array{rows:array<int,array<string,mixed>>,source:string,acfComplete:bool}
	 */
	private static function resolve_hint_rows( array $body, array $collections ): array {
		$resolved = Neo_Pulse_App_Platform_Inventory::resolve_rows(
			$body,
			array(
				'tier'        => Neo_Pulse_App_Platform_Inventory::TIER_HINT,
				'collections' => $collections,
			)
		);
		self::track_inventory_meta( $resolved );
		return $resolved;
	}

	/**
	 * @param array<string,mixed> $body
	 * @param array<int,string>   $collections
	 * @return array{rows:array<int,array<string,mixed>>,source:string,acfComplete:bool}
	 */
	private static function resolve_audit_rows( array $body, array $collections ): array {
		$resolved = Neo_Pulse_App_Platform_Inventory::resolve_rows(
			$body,
			array(
				'tier'        => Neo_Pulse_App_Platform_Inventory::TIER_AUDIT,
				'collections' => $collections,
			)
		);
		self::track_inventory_meta( $resolved );
		return $resolved;
	}

	/**
	 * @param array{rows:array<int,array<string,mixed>>,source:string,acfComplete:bool} $resolved
	 */
	private static function track_inventory_meta( array $resolved ): void {
		if ( (string) $resolved['source'] !== 'none' ) {
			self::$last_inventory_meta = array(
				'source'      => (string) $resolved['source'],
				'acfComplete' => ! empty( $resolved['acfComplete'] ),
			);
		}
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>}
	 */
	private static function inventory_rows_result( array $rows ): array {
		$lines = array();
		$out   = array();
		foreach ( $rows as $item ) {
			$title      = (string) ( $item['title'] ?? '' );
			$url        = (string) ( $item['url'] ?? '' );
			$type       = (string) ( $item['type'] ?? '' );
			$date       = (string) ( $item['date_gmt'] ?? '' );
			$link_title = str_replace( array( '[', ']' ), '', $title );
			if ( $url !== '' && $link_title !== '' ) {
				$line = '- [' . $link_title . '](' . $url . ')';
			} elseif ( $link_title !== '' ) {
				$line = '- ' . $link_title;
			} else {
				$line = '- ' . $url;
			}
			if ( $date !== '' ) {
				$line .= ' · ' . $date;
			}
			$lines[] = $line;
			$out[]   = array(
				'title' => $title,
				'url'   => $url,
				'type'  => $type,
				'date'  => $date,
			);
		}
		if ( count( $lines ) === 0 ) {
			return array(
				'ok'    => false,
				'note'  => 'Site inventory unavailable or no matching items.',
				'lines' => array( 'No matching inventory items.' ),
			);
		}
		return array(
			'ok'    => true,
			'lines' => $lines,
			'rows'  => $out,
		);
	}

	/**
	 * @return array{tools:array<int,array{id:string,params:array<string,mixed>}>,reason:string}|null
	 */
	private static function fast_path_data_tool_plan( string $message ): ?array {
		$lower       = strtolower( $message );
		$wants_grade = str_contains( $lower, 'grade' ) || str_contains( $lower, 'score' ) || str_contains( $lower, 'rate' ) || str_contains( $lower, '/10' ) || preg_match( '/\bout of ten\b/i', $message );
		$wants_why   = str_contains( $lower, 'why' ) || str_contains( $lower, 'explain' );
		$wants_posts = str_contains( $lower, 'post' ) || str_contains( $lower, 'those' ) || str_contains( $lower, 'them' );

		if ( ! $wants_grade || ! $wants_posts ) {
			if ( ! ( $wants_why && $wants_grade ) ) {
				return null;
			}
		}

		$limit = 10;
		if ( preg_match( '/\b(?:last\s+)?(\d{1,2})\s*(?:post|posts)\b/i', $message, $matches ) ) {
			$limit = max( 1, min( self::MAX_INVENTORY_ROWS, (int) $matches[1] ) );
		}

		return array(
			'tools'  => array(
				array(
					'id'     => 'inventory_grade',
					'params' => array(
						'post_type' => 'post',
						'limit'     => $limit,
						'sort'      => 'date_desc',
					),
				),
			),
			'reason' => $wants_why ? 'fast_path: explain grade request' : 'fast_path: grade posts request',
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_status( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Gsc_Tools::tool_gsc_status( $body, $params, $message );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_top_queries( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Gsc_Tools::tool_gsc_top_queries( $body, $params, $message );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_top_pages( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Gsc_Tools::tool_gsc_top_pages( $body, $params, $message );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_blog_performers( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Gsc_Tools::tool_gsc_blog_performers( $body, $params, $message );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_page_queries( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Gsc_Tools::tool_gsc_page_queries( $body, $params, $message );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_performance_summary( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Gsc_Tools::tool_gsc_performance_summary( $body, $params, $message );
	}

	public static function tool_gsc_reporting_status( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Gsc_Reporting_Tools::tool_gsc_reporting_status( $body, $params, $message );
	}

	public static function tool_gsc_reporting_compare_summary( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Gsc_Reporting_Tools::tool_gsc_reporting_compare_summary( $body, $params, $message );
	}

	public static function tool_post_creator_status( array $body, array $params, string $message ): array {
		return Neo_Pulse_App_Platform_Data_Post_Creator_Tools::tool_post_creator_status( $body, $params, $message );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_ga_organic_summary( array $body, array $params, string $message ): array {
		$site_url    = self::resolve_site_url( $body, $params, $message );
		$property_id = self::resolve_ga_property_id( $body, $params, $site_url );
		if ( $property_id === '' ) {
			return array( 'ok' => false, 'note' => 'No GA4 propertyId for this site.' );
		}
		$current = self::resolve_gsc_dates( $params );
		$compare = self::resolve_compare_dates( $params, $current );
		$result  = Neo_Pulse_App_Ga_Api::report_data(
			array(
				'propertyId'       => $property_id,
				'startDate'        => $current['startDate'],
				'endDate'          => $current['endDate'],
				'compareStartDate' => $compare['compareStartDate'],
				'compareEndDate'   => $compare['compareEndDate'],
			)
		);
		$body_data = isset( $result['body'] ) && is_array( $result['body'] ) ? $result['body'] : array();
		if ( empty( $body_data['success'] ) ) {
			return array(
				'ok'   => false,
				'note' => isset( $body_data['error'] ) ? (string) $body_data['error'] : 'GA organic summary failed.',
			);
		}
		$organic = isset( $body_data['organicTraffic'] ) && is_array( $body_data['organicTraffic'] ) ? $body_data['organicTraffic'] : array();
		$conv    = isset( $body_data['conversions'] ) && is_array( $body_data['conversions'] ) ? $body_data['conversions'] : array();
		$lines   = array(
			'Property: ' . $property_id,
			'Period: ' . $current['startDate'] . ' to ' . $current['endDate'],
			'Organic sessions current: ' . (int) ( $organic['current'] ?? 0 ) . ' | compare: ' . (int) ( $organic['compare'] ?? 0 ),
			'Conversions current: ' . (int) ( $conv['current'] ?? 0 ) . ' | compare: ' . (int) ( $conv['compare'] ?? 0 ),
		);
		return array(
			'ok'    => true,
			'lines' => $lines,
		);
	}

	private static function gsc_configured(): bool {
		return Neo_Pulse_App_Platform_Data_Gsc_Tools::configured();
	}

	/** @param array<string,mixed> $body */
	private static function ga_configured( array $body ): bool {
		$status = Neo_Pulse_App_Ga_Credentials::credentials_status();
		if ( empty( $status['configured'] ) ) {
			return false;
		}
		return self::resolve_ga_property_id( $body, array(), self::resolve_site_url( $body, array(), '' ) ) !== '';
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params */
	private static function resolve_site_url( array $body, array $params, string $message ): string {
		if ( ! empty( $params['siteUrl'] ) ) {
			return esc_url_raw( trim( (string) $params['siteUrl'] ) );
		}

		$ctx   = isset( $body['properties_context'] ) && is_array( $body['properties_context'] ) ? $body['properties_context'] : array();
		$props = isset( $ctx['properties'] ) && is_array( $ctx['properties'] ) ? $ctx['properties'] : array();
		$msg   = strtolower( $message );

		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) || empty( $prop['name'] ) || empty( $prop['siteUrl'] ) ) {
				continue;
			}
			$name = strtolower( trim( (string) $prop['name'] ) );
			if ( $name !== '' && $msg !== '' && strpos( $msg, $name ) !== false ) {
				return esc_url_raw( trim( (string) $prop['siteUrl'] ) );
			}
		}

		$active_id = isset( $ctx['activePropertyId'] ) ? sanitize_text_field( (string) $ctx['activePropertyId'] ) : '';
		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) || empty( $prop['siteUrl'] ) ) {
				continue;
			}
			if ( $active_id !== '' && isset( $prop['id'] ) && sanitize_text_field( (string) $prop['id'] ) === $active_id ) {
				return esc_url_raw( trim( (string) $prop['siteUrl'] ) );
			}
		}

		if ( ! empty( $body['siteUrl'] ) ) {
			return esc_url_raw( trim( (string) $body['siteUrl'] ) );
		}

		return '';
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params */
	private static function resolve_ga_property_id( array $body, array $params, string $site_url ): string {
		if ( ! empty( $params['propertyId'] ) ) {
			return trim( (string) $params['propertyId'] );
		}

		$ctx    = isset( $body['properties_context'] ) && is_array( $body['properties_context'] ) ? $body['properties_context'] : array();
		$props  = isset( $ctx['properties'] ) && is_array( $ctx['properties'] ) ? $ctx['properties'] : array();
		$target = self::normalize_url_host( $site_url );

		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) || empty( $prop['ga4PropertyId'] ) ) {
				continue;
			}
			if ( $target !== '' && ! empty( $prop['siteUrl'] ) && self::normalize_url_host( (string) $prop['siteUrl'] ) === $target ) {
				return trim( (string) $prop['ga4PropertyId'] );
			}
		}

		$active_id = isset( $ctx['activePropertyId'] ) ? sanitize_text_field( (string) $ctx['activePropertyId'] ) : '';
		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) || empty( $prop['ga4PropertyId'] ) ) {
				continue;
			}
			if ( $active_id !== '' && isset( $prop['id'] ) && sanitize_text_field( (string) $prop['id'] ) === $active_id ) {
				return trim( (string) $prop['ga4PropertyId'] );
			}
		}

		return '';
	}

	/** @param array<string,mixed> $body */
	private static function active_property_summary( array $body ): string {
		$ctx       = isset( $body['properties_context'] ) && is_array( $body['properties_context'] ) ? $body['properties_context'] : array();
		$props     = isset( $ctx['properties'] ) && is_array( $ctx['properties'] ) ? $ctx['properties'] : array();
		$active_id = isset( $ctx['activePropertyId'] ) ? sanitize_text_field( (string) $ctx['activePropertyId'] ) : '';
		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) ) {
				continue;
			}
			if ( $active_id !== '' && isset( $prop['id'] ) && sanitize_text_field( (string) $prop['id'] ) === $active_id ) {
				$name = isset( $prop['name'] ) ? sanitize_text_field( (string) $prop['name'] ) : '';
				$url  = isset( $prop['siteUrl'] ) ? esc_url_raw( (string) $prop['siteUrl'] ) : '';
				return trim( $name . ( $url !== '' ? ' (' . $url . ')' : '' ) );
			}
		}
		if ( ! empty( $body['siteUrl'] ) ) {
			return esc_url_raw( (string) $body['siteUrl'] );
		}
		return 'none';
	}

	/** @param array<string,mixed> $params */
	private static function resolve_gsc_dates( array $params ): array {
		$def = self::default_gsc_dates();
		return array(
			'startDate' => ! empty( $params['startDate'] ) ? sanitize_text_field( (string) $params['startDate'] ) : $def['startDate'],
			'endDate'   => ! empty( $params['endDate'] ) ? sanitize_text_field( (string) $params['endDate'] ) : $def['endDate'],
		);
	}

	/** @param array<string,mixed> $params @param array{startDate:string,endDate:string} $current */
	private static function resolve_compare_dates( array $params, array $current ): array {
		if ( ! empty( $params['compareStartDate'] ) && ! empty( $params['compareEndDate'] ) ) {
			return array(
				'compareStartDate' => sanitize_text_field( (string) $params['compareStartDate'] ),
				'compareEndDate'   => sanitize_text_field( (string) $params['compareEndDate'] ),
			);
		}
		return self::default_compare_dates( $current );
	}

	/** @return array{startDate:string,endDate:string} */
	private static function default_gsc_dates(): array {
		$end = new DateTimeImmutable( '-3 days', new DateTimeZone( 'UTC' ) );
		return array(
			'startDate' => $end->modify( '-27 days' )->format( 'Y-m-d' ),
			'endDate'   => $end->format( 'Y-m-d' ),
		);
	}

	/** @param array{startDate:string,endDate:string} $current @return array{compareStartDate:string,compareEndDate:string} */
	private static function default_compare_dates( array $current ): array {
		$start     = new DateTimeImmutable( $current['startDate'], new DateTimeZone( 'UTC' ) );
		$end       = new DateTimeImmutable( $current['endDate'], new DateTimeZone( 'UTC' ) );
		$days      = (int) $start->diff( $end )->days + 1;
		$cmp_end   = $start->modify( '-1 day' );
		$cmp_start = $cmp_end->modify( '-' . ( $days - 1 ) . ' days' );
		return array(
			'compareStartDate' => $cmp_start->format( 'Y-m-d' ),
			'compareEndDate'   => $cmp_end->format( 'Y-m-d' ),
		);
	}

	private static function normalize_url_host( string $url ): string {
		$parts = wp_parse_url( trim( $url ) );
		if ( ! is_array( $parts ) || empty( $parts['host'] ) ) {
			return '';
		}
		$host = strtolower( (string) $parts['host'] );
		if ( str_starts_with( $host, 'www.' ) ) {
			$host = substr( $host, 4 );
		}
		return $host;
	}

	/** @return array<string,mixed>|null */
	private static function parse_json_object( string $raw ) {
		$raw = trim( $raw );
		if ( $raw === '' ) {
			return null;
		}
		if ( str_starts_with( $raw, '```' ) ) {
			$raw = preg_replace( '/^```(?:json)?\s*/i', '', $raw );
			$raw = preg_replace( '/\s*```$/', '', (string) $raw );
		}
		$decoded = json_decode( trim( (string) $raw ), true );
		return is_array( $decoded ) ? $decoded : null;
	}
}
