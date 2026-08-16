<?php
/**
 * Intent checklist: plans entity scope, data needs, and dynamic slice team.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Platform_Data_Intent_Checklist {

	const MAX_SLICE_AGENTS = 8;
	const SLICE_MODEL      = 'google/gemini-2.5-flash-lite';

	/** @var array<int,string> */
	const ENTITY_SLICES = array(
		'inventory',
		'url',
		'meta',
		'keyword',
		'faq',
		'seo_research',
		'body',
		'featured_image',
	);

	/** @var array<int,string> */
	const ANALYTICS_SLICES = array(
		'gsc_summary',
		'gsc_reporting',
		'gsc_queries',
		'gsc_pages',
		'gsc_blog_performers',
		'ga_organic',
	);

	/** @var array<string,string> Map mistaken tool ids to slice keys. */
	const SLICE_ALIASES = array(
		'inventory_recent'          => 'meta',
		'inventory_grade'           => 'meta',
		'inventory_audit'           => 'meta',
		'gsc_performance_summary'   => 'gsc_summary',
		'gsc_reporting_compare_summary' => 'gsc_reporting',
		'gsc_reporting_status'      => 'gsc_reporting',
		'gsc_top_queries'           => 'gsc_queries',
		'gsc_top_pages'             => 'gsc_pages',
		'gsc_blog_performers'       => 'gsc_blog_performers',
		'ga_organic_summary'        => 'ga_organic',
	);

	/** @var array<int,string> */
	const CONTEXT_SLICES = array(
		'context',
	);

	/**
	 * Tab / workspace help: module catalog + optional site data, not a hard skip.
	 *
	 * @param array<string,mixed> $body
	 */
	public static function is_ui_help_message( string $message, array $body = array() ): bool {
		$lower = strtolower( trim( $message ) );
		if ( $lower === '' ) {
			return false;
		}

		$needles = array(
			'what can i do on this tab',
			'what can i do here',
			'what can i do on this page',
			'what can you do on this tab',
			'what is this tab',
			'what does this tab',
			'how do i use this tab',
			'what am i looking at',
			'help on this tab',
			'features on this tab',
			'what can i do in this section',
		);
		foreach ( $needles as $needle ) {
			if ( str_contains( $lower, $needle ) ) {
				return true;
			}
		}

		if ( str_contains( $lower, 'what can i do' ) && str_contains( $lower, 'tab' ) ) {
			return true;
		}

		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		if ( str_contains( $lower, 'what can i do' ) && ! empty( $pulse['locationSummary'] ) ) {
			return true;
		}

		return false;
	}

	/**
	 * @param array<string,mixed> $body
	 */
	public static function empty_plan( string $reason ): array {
		return array(
			'intentSummary' => '',
			'entityType'    => 'post',
			'entityScope'   => array(
				'mode'      => 'library',
				'url'       => '',
				'limit'     => 10,
				'post_type' => 'post',
			),
			'dataNeeds'     => array(),
			'sliceTeam'     => array(),
			'leadAgent'     => self::default_lead_agent( 'library' ),
			'reason'        => $reason,
		);
	}

	/**
	 * Infer how many entities to fetch from phrasing like "last post" vs "last 5 posts".
	 *
	 * @return array{mode:string,limit:int,hint:string,sort:string}|null
	 */
	public static function infer_entity_scope_from_message( string $message ): ?array {
		$trimmed = trim( $message );
		if ( $trimmed === '' ) {
			return null;
		}

		if ( preg_match( '/\b(?:last|latest|recent|next)\s+(\d{1,2})\s+\w*\s*(?:blog\s*)?(?:post|posts|page|pages)\b/i', $trimmed, $m ) ) {
			return array(
				'mode'  => 'library',
				'limit' => max( 1, min( 20, (int) $m[1] ) ),
				'hint'  => 'Explicit count with qualifier',
				'sort'  => 'date_desc',
			);
		}

		if ( preg_match( '/\b(\d{1,2})\s+\w*\s*(?:blog\s*)?(?:post|posts|page|pages)\b/i', $trimmed, $m ) ) {
			$count = max( 1, min( 20, (int) $m[1] ) );
			if ( $count === 1 ) {
				return array(
					'mode'  => 'single',
					'limit' => 1,
					'hint'  => 'Single post or page from explicit count',
					'sort'  => 'date_desc',
				);
			}
			return array(
				'mode'  => 'library',
				'limit' => $count,
				'hint'  => 'Explicit multi-post count',
				'sort'  => 'date_desc',
			);
		}

		if ( preg_match( '/\b(?:the\s+)?(?:last|latest|newest|most\s+recent)\s+(?:blog(?:\s+post)?|post|page)\b/i', $trimmed ) ) {
			return array(
				'mode'  => 'single',
				'limit' => 1,
				'hint'  => 'Most recent single post or page',
				'sort'  => 'date_desc',
			);
		}

		if ( preg_match( '/\blast\s+blog\b/i', $trimmed ) && ! preg_match( '/\b(?:posts|pages)\b/i', $trimmed ) ) {
			return array(
				'mode'  => 'single',
				'limit' => 1,
				'hint'  => 'Most recent blog',
				'sort'  => 'date_desc',
			);
		}

		if ( preg_match( '/\b(?:the\s+)?(?:first|oldest)\s+(?:blog(?:\s+post)?|post|page)\b/i', $trimmed ) ) {
			return array(
				'mode'  => 'single',
				'limit' => 1,
				'hint'  => 'Oldest single post or page',
				'sort'  => 'date_asc',
			);
		}

		if ( preg_match( '/\b(?:this|that)\s+(?:blog\s+)?(?:post|page)\b/i', $trimmed ) && ! preg_match( '/\b(?:posts|pages)\b/i', $trimmed ) ) {
			return array(
				'mode'  => 'single',
				'limit' => 1,
				'hint'  => 'Single referenced post or page',
				'sort'  => 'date_desc',
			);
		}

		if ( preg_match( '/\b(?:recent|latest|newest|my|our|some|several|multiple|all|few)\s+(?:blog\s*)?(?:posts|pages)\b/i', $trimmed ) ) {
			$limit = 3;
			if ( preg_match( '/\b(?:all|every)\b/i', $trimmed ) ) {
				$limit = 10;
			} elseif ( preg_match( '/\b(?:several|multiple|few)\b/i', $trimmed ) ) {
				$limit = 5;
			}
			return array(
				'mode'  => 'library',
				'limit' => $limit,
				'hint'  => 'Plural posts or pages without explicit count',
				'sort'  => 'date_desc',
			);
		}

		return null;
	}

	/**
	 * @param array<string,mixed> $plan
	 * @return array<string,mixed>
	 */
	private static function constrain_plan_entity_scope( array $plan, string $message ): array {
		$inferred = self::infer_entity_scope_from_message( $message );
		if ( $inferred === null ) {
			return $plan;
		}

		$entity_type = sanitize_key( (string) ( $plan['entityType'] ?? 'post' ) );
		if ( ! in_array( $entity_type, array( 'post', 'page' ), true ) ) {
			return $plan;
		}

		$scope = isset( $plan['entityScope'] ) && is_array( $plan['entityScope'] ) ? $plan['entityScope'] : array();
		$mode  = sanitize_key( (string) ( $scope['mode'] ?? 'library' ) );
		$limit = max( 1, min( 20, (int) ( $scope['limit'] ?? 5 ) ) );

		if ( $inferred['mode'] === 'single' ) {
			$mode  = 'single';
			$limit = 1;
		} elseif ( $mode === 'library' && $limit > $inferred['limit'] ) {
			$limit = $inferred['limit'];
		}

		$plan['entityScope'] = array(
			'mode'      => $mode,
			'url'       => (string) ( $scope['url'] ?? '' ),
			'limit'     => $limit,
			'post_type' => sanitize_key( (string) ( $scope['post_type'] ?? 'post' ) ),
		);

		if ( $mode === 'single' && is_array( $plan['sliceTeam'] ?? null ) ) {
			foreach ( $plan['sliceTeam'] as &$spec ) {
				if ( ! is_array( $spec ) || empty( $spec['slice'] ) ) {
					continue;
				}
				$slice = sanitize_key( (string) $spec['slice'] );
				if ( in_array( $slice, self::ENTITY_SLICES, true ) ) {
					$spec['systemPrompt'] = $slice === 'inventory'
						? self::inventory_slice_system_prompt( 'single' )
						: self::slice_system_prompt( $slice, 'single' );
				}
			}
			unset( $spec );
			$plan['leadAgent'] = self::default_lead_agent( 'single' );
		}

		$plan['dataNeeds'] = self::sync_data_needs_scope(
			is_array( $plan['dataNeeds'] ?? null ) ? $plan['dataNeeds'] : array(),
			$plan['entityScope'],
			$inferred['sort']
		);

		return $plan;
	}

	/**
	 * @param array<int,array<string,mixed>> $data_needs
	 * @param array<string,mixed>            $entity_scope
	 * @return array<int,array<string,mixed>>
	 */
	private static function sync_data_needs_scope( array $data_needs, array $entity_scope, string $sort ): array {
		$limit          = max( 1, min( 20, (int) ( $entity_scope['limit'] ?? 1 ) ) );
		$out            = array();
		$has_inventory  = false;

		foreach ( $data_needs as $need ) {
			if ( ! is_array( $need ) || empty( $need['tool'] ) ) {
				$out[] = $need;
				continue;
			}
			$tool = sanitize_key( (string) $need['tool'] );
			if ( str_starts_with( $tool, 'inventory_' ) ) {
				$params = isset( $need['params'] ) && is_array( $need['params'] ) ? $need['params'] : array();
				$params['limit'] = $limit;
				$params['sort']  = $sort;
				$out[] = array(
					'tool'   => $tool,
					'params' => $params,
				);
				$has_inventory = true;
				continue;
			}
			$out[] = $need;
		}

		if ( ! $has_inventory ) {
			$out[] = array(
				'tool'   => 'inventory_recent',
				'params' => array(
					'post_type'      => sanitize_key( (string) ( $entity_scope['post_type'] ?? 'post' ) ),
					'limit'          => $limit,
					'sort'           => $sort,
					'includeContent' => true,
					'url'            => (string) ( $entity_scope['url'] ?? '' ),
				),
			);
		}

		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $module_research
	 * @return array<string,mixed>
	 */
	public static function plan( string $message, array $history, array $body, ?array $module_research = null ): array {
		if ( self::is_ui_help_message( $message, $body ) ) {
			return self::plan_workspace_context( $message, $body, $module_research );
		}

		$fast = self::fast_path_plan( $message, $history );
		if ( $fast !== null ) {
			return self::constrain_plan_entity_scope( $fast, $message );
		}

		$tool_lines = Neo_Pulse_App_Platform_Data_Orchestrator::tool_catalog_lines( $body );
		$history_snip = self::history_snippet( $history );
		$workspace_snip = self::workspace_snippet( $body );

		$system = 'Return JSON only matching this shape: {"intentSummary":"string","entityType":"post|page|site|workspace","entityScope":{"mode":"single|library","url":"","limit":10,"post_type":"post"},"dataNeeds":[{"tool":"inventory_recent|gsc_top_queries|gsc_performance_summary|ga_organic_summary","params":{}}],"sliceTeam":[{"id":"string","slice":"context|url|meta|keyword|faq|seo_research|body|featured_image|gsc_summary|gsc_queries|gsc_pages|ga_organic","role":"string","focus":"string optional for context slice","systemPrompt":"string"}],"leadAgent":{"systemPrompt":"string","outputSchema":{}},"reason":"string"}. Compose 1-' . self::MAX_SLICE_AGENTS . ' slice specialists to run in parallel. Use slice context for workspace/tab capability agents grounded in module catalog (set focus per agent). Use entity/analytics slices only for live site data. Each slice field must be a slice key, never a data tool id. Each role must reference workspace location and the user question. When the user asks for both post review and GSC/analytics, include entity slices AND analytics slices in one sliceTeam. Lead agent synthesizes all slice reports into the final answer. Entity scope rules (token budget): use mode single with limit 1 for one post or page (last post, latest post, most recent post, this post, that post, named URL). Use library only when the user clearly asks about multiple posts or gives an explicit count. Do not set library limit above 5 unless the user names a higher number. "Last post" always means single limit 1, not a library.';
		$user   = $workspace_snip
			. "\nAvailable data tools:\n" . implode( "\n", $tool_lines )
			. "\nRecent history:\n" . $history_snip
			. "\nUser message: " . $message;

		try {
			$parsed = Neo_Pulse_App_Chat_Openrouter::json_completion(
				array(
					array( 'role' => 'system', 'content' => $system ),
					array( 'role' => 'user', 'content' => $user ),
				),
				array(
					'model'       => self::SLICE_MODEL,
					'temperature' => 0.15,
					'maxTokens'   => 2048,
				)
			);
		} catch ( Exception $e ) {
			return self::fallback_plan( $message );
		}

		return self::constrain_plan_entity_scope( self::normalize_plan( $parsed, $message, $body, $module_research ), $message );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function workspace_location( array $body ): string {
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		return ! empty( $pulse['locationSummary'] )
			? sanitize_text_field( (string) $pulse['locationSummary'] )
			: 'Current workspace tab';
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function workspace_snippet( array $body ): string {
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		$lines = array();
		if ( ! empty( $pulse['locationSummary'] ) ) {
			$lines[] = 'Workspace: ' . sanitize_text_field( (string) $pulse['locationSummary'] );
		}
		if ( ! empty( $pulse['siteName'] ) ) {
			$lines[] = 'Active site: ' . sanitize_text_field( (string) $pulse['siteName'] );
		}
		if ( ! empty( $pulse['expandedPageTitle'] ) ) {
			$lines[] = 'Expanded page: ' . sanitize_text_field( (string) $pulse['expandedPageTitle'] );
		}
		return count( $lines ) > 0 ? implode( "\n", $lines ) . "\n" : '';
	}

	public static function normalize_slice( string $slice, string $entity_type = 'post' ): string {
		$slice = sanitize_key( $slice );
		if ( $slice === 'context' ) {
			return 'context';
		}
		if ( $entity_type !== 'workspace' && isset( self::SLICE_ALIASES[ $slice ] ) ) {
			$slice = self::SLICE_ALIASES[ $slice ];
		}
		$allowed = array_merge( self::CONTEXT_SLICES, self::ENTITY_SLICES, self::ANALYTICS_SLICES );
		return in_array( $slice, $allowed, true ) ? $slice : '';
	}

	/**
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $module_research
	 * @return array<string,mixed>
	 */
	public static function plan_workspace_context( string $message, array $body, ?array $module_research = null ): array {
		$pulse    = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		$location = ! empty( $pulse['locationSummary'] )
			? sanitize_text_field( (string) $pulse['locationSummary'] )
			: 'Current workspace tab';

		$context_specs = array(
			array(
				'id'           => 'content_opt_agent',
				'slice'        => 'context',
				'focus'        => 'Content optimization (pages, posts, SAP)',
				'role'         => 'Content optimization on ' . $location,
				'systemPrompt' => self::context_system_prompt( 'Content optimization for pages, posts, and service area pages', $location ),
			),
			array(
				'id'           => 'bulk_aiseo_agent',
				'slice'        => 'context',
				'focus'        => 'AISEO bulk meta actions',
				'role'         => 'AISEO bulk meta actions on ' . $location,
				'systemPrompt' => self::context_system_prompt( 'AISEO bulk actions for meta titles and descriptions', $location ),
			),
			array(
				'id'           => 'sitemap_workflows_agent',
				'slice'        => 'context',
				'focus'        => 'Sitemap clusters and URL workflows',
				'role'         => 'Sitemap workflows on ' . $location,
				'systemPrompt' => self::context_system_prompt( 'Sitemap source switching, clusters, and URL structure workflows', $location ),
			),
		);

		$data_needs = array();
		$site_specs = array();
		if ( Neo_Pulse_App_Platform_Data_Orchestrator::gsc_available_for_body( $body ) ) {
			$data_needs[] = array(
				'tool'   => 'gsc_performance_summary',
				'params' => array(),
			);
			$site_specs[] = array(
				'id'           => 'gsc_tab_context_agent',
				'slice'        => 'gsc_summary',
				'role'         => 'GSC performance context for ' . $location,
				'systemPrompt' => 'You connect live GSC performance data to actions the user can take on this tab. Explain what the metrics imply for optimization work here. Return JSON: {"findings":[],"score":null,"notes":"","byUrl":{}}.',
			);
		}

		$slice_team = array_merge( $context_specs, $site_specs );
		$mode       = count( $site_specs ) > 0 ? 'mixed' : 'workspace_context';

		return array(
			'intentSummary' => 'What you can do on this tab',
			'entityType'    => 'workspace',
			'researchMode'  => $mode,
			'entityScope'   => array(
				'mode'      => 'single',
				'url'       => '',
				'limit'     => 1,
				'post_type' => 'post',
			),
			'dataNeeds'     => $data_needs,
			'sliceTeam'     => $slice_team,
			'leadAgent'     => array(
				'systemPrompt' => 'You are the lead agent. Synthesize workspace capability specialists (and any site analytics context) into a clear answer for what the user can do on this tab at ' . $location . '. Return JSON with summary, findings array, and recommendations array tied to in-app actions.',
				'outputSchema' => array(),
			),
			'reason'        => 'fast_path: workspace context agents for tab help',
		);
	}

	private static function context_system_prompt( string $focus, string $location ): string {
		return 'You are a workspace specialist for ' . $focus . ' at ' . $location . '. Review the module catalog and workspace context in the payload. List concrete in-app actions the user can take on this tab. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
	}

	/**
	 * @param array<int,array<string,mixed>> $slice_team
	 * @param array<string,mixed>            $payload
	 * @return array<int,array<string,mixed>>
	 */
	public static function filter_slice_team_for_payload( array $slice_team, array $payload ): array {
		$has_entities  = ! empty( $payload['entities'] ) && is_array( $payload['entities'] );
		$has_analytics = ! empty( $payload['analytics'] ) && is_array( $payload['analytics'] );
		$has_context   = ! empty( $payload['context'] ) && is_array( $payload['context'] );
		$filtered      = array();

		foreach ( $slice_team as $spec ) {
			if ( ! is_array( $spec ) || empty( $spec['slice'] ) ) {
				continue;
			}
			$entity_type = sanitize_key( (string) ( $spec['entityType'] ?? 'post' ) );
			$slice       = self::normalize_slice( (string) $spec['slice'], $entity_type );
			if ( $slice === '' ) {
				continue;
			}
			if ( $slice === 'context' ) {
				if ( ! $has_context ) {
					continue;
				}
			} elseif ( in_array( $slice, self::ENTITY_SLICES, true ) && ! $has_entities ) {
				continue;
			} elseif ( in_array( $slice, self::ANALYTICS_SLICES, true ) && ! $has_analytics ) {
				continue;
			}
			$spec['slice'] = $slice;
			$filtered[]    = $spec;
		}

		return $filtered;
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @return array<string,mixed>|null
	 */
	private static function fast_path_plan( string $message, array $history ): ?array {
		$url = self::url_from_history( $history );

		if ( preg_match( '/\b(?:specific|detail|first|that)\b.*\b(?:blog|post)\b/i', $message ) || preg_match( '/\b(?:blog|post)\b.*\b(?:specific|detail|first)\b/i', $message ) ) {
			$entity_plan = self::single_post_plan( $url, 'Deep review of one post from follow-up' );
			if ( self::wants_gsc_analytics( $message ) ) {
				return self::merge_compound_plan( $entity_plan, $message );
			}
			return $entity_plan;
		}

		if ( self::wants_scheduled_listing( $message ) ) {
			$scope = self::infer_entity_scope_from_message( $message );
			$limit = $scope !== null ? $scope['limit'] : 5;
			return self::inventory_list_plan( $limit, 'Scheduled posts listing', 'date_asc', 'future', 'inventory_scheduled' );
		}

		if ( self::wants_draft_listing( $message ) ) {
			$scope = self::infer_entity_scope_from_message( $message );
			$limit = $scope !== null ? $scope['limit'] : 10;
			return self::inventory_list_plan( $limit, 'Draft posts listing', 'date_desc', 'draft' );
		}

		if ( self::wants_inventory_listing( $message ) ) {
			$scope = self::infer_entity_scope_from_message( $message );
			$limit = $scope !== null ? $scope['limit'] : 5;
			$sort  = $scope !== null ? $scope['sort'] : 'date_desc';
			return self::inventory_list_plan( $limit, 'Site inventory listing', $sort );
		}

		$entity_plan = null;
		if ( self::wants_entity_review( $message ) ) {
			$scope     = self::infer_entity_scope_from_message( $message );
			$with_gsc  = self::wants_gsc_analytics( $message );
			if ( $scope !== null && $scope['mode'] === 'single' ) {
				$slices = $with_gsc
					? array( 'meta', 'keyword', 'body' )
					: array( 'url', 'meta', 'keyword', 'faq', 'seo_research', 'body', 'featured_image' );
				$entity_plan = self::single_post_plan( $url, 'Review of the latest post', $scope['sort'], $slices );
			} else {
				$limit       = $scope !== null ? $scope['limit'] : 3;
				$entity_plan = self::library_plan( $limit, 'Editorial review of recent posts' );
			}
		}

		if ( $entity_plan !== null && self::wants_gsc_analytics( $message ) ) {
			return self::merge_compound_plan( $entity_plan, $message );
		}
		if ( $entity_plan !== null ) {
			return $entity_plan;
		}

		if ( self::wants_blog_gsc_discovery( $message ) ) {
			return self::blog_gsc_discovery_plan( $message );
		}

		if ( self::wants_gsc_analytics( $message ) ) {
			return self::gsc_plan( $message );
		}

		if ( self::wants_full_library_review( $message ) ) {
			$scope = self::infer_entity_scope_from_message( $message );
			$limit = $scope !== null ? $scope['limit'] : 20;
			$sort  = $scope !== null ? $scope['sort'] : 'date_desc';
			return self::library_review_plan( $limit, 'Full library SEO review', $sort );
		}

		return null;
	}

	public static function wants_scheduled_listing( string $message ): bool {
		if ( self::wants_full_library_review( $message ) || self::wants_entity_review( $message ) ) {
			return false;
		}
		$lower = strtolower( trim( $message ) );
		if ( ! preg_match( '/\b(?:post|posts|blog|article|articles)\b/i', $message ) ) {
			return false;
		}
		if ( preg_match( '/\b(?:scheduled|upcoming|future)\b/i', $message ) ) {
			return true;
		}
		if ( preg_match( '/\bnext\b/i', $message ) && preg_match( '/\b(?:post|posts|blog)\b/i', $message ) ) {
			return true;
		}
		return false;
	}

	public static function wants_draft_listing( string $message ): bool {
		if ( self::wants_full_library_review( $message ) || self::wants_entity_review( $message ) ) {
			return false;
		}
		$lower = strtolower( trim( $message ) );
		if ( ! preg_match( '/\b(?:post|posts|blog|page|pages)\b/i', $message ) ) {
			return false;
		}
		return preg_match( '/\b(?:draft|drafts|unpublished|pending(?:\s+review)?)\b/i', $lower ) === 1;
	}

	public static function wants_inventory_listing( string $message ): bool {
		if ( self::wants_scheduled_listing( $message ) || self::wants_draft_listing( $message ) ) {
			return false;
		}
		if ( self::wants_full_library_review( $message ) || self::wants_entity_review( $message ) ) {
			return false;
		}

		$lower = strtolower( trim( $message ) );
		$has_entity = str_contains( $lower, 'post' ) || str_contains( $lower, 'blog' ) || str_contains( $lower, 'page' );
		if ( ! $has_entity ) {
			return false;
		}

		$listing_signals = array( 'title', 'titles', 'list', 'show me', 'tell me', 'what are', 'which', 'how many', 'published' );
		foreach ( $listing_signals as $needle ) {
			if ( str_contains( $lower, $needle ) ) {
				return true;
			}
		}

		if ( preg_match( '/\b(?:last|latest|recent|next)\b/i', $message ) ) {
			return true;
		}

		return false;
	}

	private static function wants_full_library_review( string $message ): bool {
		$lower = strtolower( $message );
		if ( str_contains( $lower, 'audit' ) || str_contains( $lower, 'incomplete' ) || str_contains( $lower, 'broken' ) ) {
			return true;
		}
		if ( str_contains( $lower, 'missing' ) && ( str_contains( $lower, 'meta' ) || str_contains( $lower, 'seo' ) ) ) {
			return true;
		}
		if ( str_contains( $lower, 'review' ) && ! str_contains( $lower, 'title' ) && ( str_contains( $lower, 'meta' ) || str_contains( $lower, 'seo' ) ) ) {
			return true;
		}
		return false;
	}

	private static function wants_entity_review( string $message ): bool {
		$lower         = strtolower( $message );
		$wants_opinion = str_contains( $lower, 'think' ) || str_contains( $lower, 'grade' ) || str_contains( $lower, 'score' ) || str_contains( $lower, 'opinion' ) || str_contains( $lower, 'review' );
		$wants_posts   = str_contains( $lower, 'post' ) || str_contains( $lower, 'blog' ) || str_contains( $lower, 'page' );
		return $wants_opinion && $wants_posts;
	}

	private static function wants_gsc_analytics( string $message ): bool {
		$lower = strtolower( $message );
		if ( str_contains( $lower, 'gsc' ) || str_contains( $lower, 'search console' ) ) {
			return true;
		}
		if ( str_contains( $lower, 'queries' ) && ( str_contains( $lower, 'search' ) || str_contains( $lower, 'google' ) ) ) {
			return true;
		}
		return str_contains( $lower, 'performance' ) && ( str_contains( $lower, 'gsc' ) || str_contains( $lower, 'search console' ) );
	}

	private static function wants_blog_gsc_discovery( string $message ): bool {
		$lower = strtolower( $message );
		$has_blog = str_contains( $lower, 'blog' ) || str_contains( $lower, 'post' );
		$has_perf = str_contains( $lower, 'perform' )
			|| str_contains( $lower, 'well' )
			|| str_contains( $lower, 'click' )
			|| str_contains( $lower, 'top' )
			|| str_contains( $lower, 'best' );
		return $has_blog && $has_perf && self::wants_gsc_analytics( $message );
	}

	/**
	 * @param array<string,mixed> $entity_plan
	 * @return array<string,mixed>
	 */
	private static function merge_compound_plan( array $entity_plan, string $message ): array {
		$addon = self::gsc_addon_for_entity_plan( $entity_plan, $message );

		$data_needs = is_array( $entity_plan['dataNeeds'] ?? null ) ? $entity_plan['dataNeeds'] : array();
		$seen_tools = array();
		foreach ( $data_needs as $need ) {
			if ( is_array( $need ) && ! empty( $need['tool'] ) ) {
				$seen_tools[ sanitize_key( (string) $need['tool'] ) ] = true;
			}
		}
		foreach ( $addon['dataNeeds'] as $need ) {
			if ( ! is_array( $need ) || empty( $need['tool'] ) ) {
				continue;
			}
			$tool = sanitize_key( (string) $need['tool'] );
			if ( $tool !== '' && ! isset( $seen_tools[ $tool ] ) ) {
				$data_needs[]       = $need;
				$seen_tools[ $tool ] = true;
			}
		}

		$slice_team  = is_array( $entity_plan['sliceTeam'] ?? null ) ? $entity_plan['sliceTeam'] : array();
		$seen_slices = array();
		foreach ( $slice_team as $spec ) {
			if ( is_array( $spec ) && ! empty( $spec['slice'] ) ) {
				$seen_slices[ sanitize_key( (string) $spec['slice'] ) ] = true;
			}
		}
		foreach ( $addon['sliceTeam'] as $spec ) {
			if ( ! is_array( $spec ) || empty( $spec['slice'] ) ) {
				continue;
			}
			$slice = sanitize_key( (string) $spec['slice'] );
			if ( $slice === '' || isset( $seen_slices[ $slice ] ) || count( $slice_team ) >= self::MAX_SLICE_AGENTS ) {
				continue;
			}
			$slice_team[]           = $spec;
			$seen_slices[ $slice ] = true;
		}

		$scope = isset( $entity_plan['entityScope'] ) && is_array( $entity_plan['entityScope'] ) ? $entity_plan['entityScope'] : array();
		$mode  = sanitize_key( (string) ( $scope['mode'] ?? 'library' ) );

		$entity_plan['intentSummary'] = trim( (string) ( $entity_plan['intentSummary'] ?? '' ) . ' with GSC performance analysis' );
		$entity_plan['dataNeeds']     = $data_needs;
		$entity_plan['sliceTeam']     = array_slice( $slice_team, 0, self::MAX_SLICE_AGENTS );
		$entity_plan['researchMode']  = 'mixed';
		$entity_plan['leadAgent']     = self::compound_lead_agent( $mode );
		$entity_plan['reason']        = 'fast_path: compound entity review + GSC analytics';

		return $entity_plan;
	}

	/**
	 * @param array<string,mixed> $entity_plan
	 * @return array{dataNeeds:array<int,array<string,mixed>>,sliceTeam:array<int,array<string,mixed>>}
	 */
	private static function gsc_addon_for_entity_plan( array $entity_plan, string $message ): array {
		$scope = isset( $entity_plan['entityScope'] ) && is_array( $entity_plan['entityScope'] ) ? $entity_plan['entityScope'] : array();
		$mode  = sanitize_key( (string) ( $scope['mode'] ?? 'library' ) );

		if ( $mode === 'single' ) {
			return array(
				'dataNeeds' => array(
					array(
						'tool'   => 'gsc_page_queries',
						'params' => array(),
					),
				),
				'sliceTeam' => array(
					array(
						'id'           => 'gsc_page_queries_agent',
						'slice'        => 'gsc_queries',
						'role'         => 'GSC page performance reviewer',
						'systemPrompt' => self::analytics_slice_system_prompt( 'gsc_queries', true ),
					),
				),
			);
		}

		$gsc = self::gsc_plan( $message );
		return array(
			'dataNeeds' => is_array( $gsc['dataNeeds'] ?? null ) ? $gsc['dataNeeds'] : array(),
			'sliceTeam' => is_array( $gsc['sliceTeam'] ?? null ) ? $gsc['sliceTeam'] : array(),
		);
	}

	/** @return array<string,mixed> */
	private static function compound_lead_agent( string $mode ): array {
		return array(
			'systemPrompt' => 'You are the lead research agent. Synthesize editorial slice reports and GSC analytics for the user question. Return JSON with summary, score or scores, findings array, recommendations array, and byUrl when library mode.',
			'outputSchema' => array(
				'summary'         => 'string',
				'score'           => 'number',
				'findings'        => array(),
				'recommendations' => array(),
				'byUrl'           => array(),
			),
		);
	}

	/** @param array<int,string> $slices */
	private static function single_post_plan( string $url, string $summary, string $sort = 'date_desc', array $slices = array() ): array {
		if ( count( $slices ) === 0 ) {
			$slices = array( 'url', 'meta', 'keyword', 'faq', 'seo_research', 'body', 'featured_image' );
		}
		return array(
			'intentSummary' => $summary,
			'entityType'    => 'post',
			'entityScope'   => array(
				'mode'      => 'single',
				'url'       => $url,
				'limit'     => 1,
				'post_type' => 'post',
			),
			'dataNeeds'     => array(
				array(
					'tool'   => 'inventory_recent',
					'params' => array(
						'post_type'      => 'post',
						'limit'          => 1,
						'sort'           => $sort,
						'includeContent' => true,
						'url'            => $url,
					),
				),
			),
			'sliceTeam'     => self::build_slice_team( $slices, 'single' ),
			'leadAgent'     => self::default_lead_agent( 'single' ),
			'reason'        => 'fast_path: single post deep dive',
		);
	}

	/** @param array<int,string> $slices */
	private static function library_review_plan( int $limit, string $summary, string $sort = 'date_desc' ): array {
		$slices = array( 'url', 'meta', 'keyword', 'faq', 'seo_research', 'body', 'featured_image' );
		$plan   = self::library_plan( $limit, $summary, $slices, $sort );
		$plan['researchMode'] = 'site_data';
		$plan['reason']       = 'fast_path: full library review';
		return $plan;
	}

	/** @return array<string,mixed> */
	private static function inventory_list_plan( int $limit, string $summary, string $sort = 'date_desc', string $post_status = 'publish', string $tool = 'inventory_recent' ): array {
		$post_status = Neo_Pulse_App_Platform_Inventory::normalize_post_status( $post_status );
		$team        = self::build_slice_team( array( 'inventory' ), 'library' );
		if ( $post_status === 'future' ) {
			foreach ( $team as &$spec ) {
				if ( is_array( $spec ) && ( $spec['slice'] ?? '' ) === 'inventory' ) {
					$spec['systemPrompt'] = self::inventory_slice_system_prompt( 'library', 'future' );
				}
			}
			unset( $spec );
		} elseif ( $post_status === 'draft' ) {
			foreach ( $team as &$spec ) {
				if ( is_array( $spec ) && ( $spec['slice'] ?? '' ) === 'inventory' ) {
					$spec['systemPrompt'] = self::inventory_slice_system_prompt( 'library', 'draft' );
				}
			}
			unset( $spec );
		}

		return array(
			'intentSummary' => $summary,
			'entityType'    => 'post',
			'researchMode'  => 'site_data',
			'entityScope'   => array(
				'mode'      => 'library',
				'url'       => '',
				'limit'     => $limit,
				'post_type' => 'post',
			),
			'dataNeeds'     => array(
				array(
					'tool'   => sanitize_key( $tool ),
					'params' => array(
						'post_type'      => 'post',
						'limit'          => $limit,
						'sort'           => $sort,
						'post_status'    => $post_status,
						'includeContent' => false,
					),
				),
			),
			'sliceTeam'     => $team,
			'leadAgent'     => self::listing_lead_agent( $post_status ),
			'reason'        => $post_status === 'future' ? 'fast_path: scheduled inventory listing' : ( $post_status === 'draft' ? 'fast_path: draft inventory listing' : 'fast_path: inventory listing' ),
		);
	}

	/** @return array<string,mixed> */
	private static function listing_lead_agent( string $post_status = 'publish' ): array {
		$post_status = Neo_Pulse_App_Platform_Inventory::normalize_post_status( $post_status );
		$prompt      = 'Answer the user listing question directly from inventory specialist findings and the inventory summary. List titles, URLs, and dates when relevant. Do not mention missing meta or body unless the user asked for SEO review.';
		if ( $post_status === 'future' ) {
			$prompt = 'Answer using only future or scheduled posts from inventory specialist findings and the inventory summary. List each title with its scheduled date_gmt. If no scheduled posts were returned, say no scheduled posts were found.';
		} elseif ( $post_status === 'draft' ) {
			$prompt = 'Answer using only draft posts from inventory specialist findings and the inventory summary. List titles and URLs. If no draft posts were returned, say no draft posts were found.';
		}
		return array(
			'systemPrompt' => $prompt,
			'outputSchema' => array(
				'summary'         => 'string',
				'findings'        => array(),
				'recommendations' => array(),
				'byUrl'           => array(),
			),
		);
	}

	/** @param array<int,string> $slices */
	private static function library_plan( int $limit, string $summary, array $slices = array( 'meta', 'keyword', 'body' ), string $sort = 'date_desc' ): array {
		if ( count( $slices ) === 0 ) {
			$slices = array( 'meta', 'keyword', 'body' );
		}
		return array(
			'intentSummary' => $summary,
			'entityType'    => 'post',
			'entityScope'   => array(
				'mode'      => 'library',
				'url'       => '',
				'limit'     => $limit,
				'post_type' => 'post',
			),
			'dataNeeds'     => array(
				array(
					'tool'   => 'inventory_recent',
					'params' => array(
						'post_type'      => 'post',
						'limit'          => $limit,
						'sort'           => $sort,
						'includeContent' => true,
					),
				),
			),
			'sliceTeam'     => self::build_slice_team( $slices, 'library' ),
			'leadAgent'     => self::default_lead_agent( 'library' ),
			'reason'        => 'fast_path: post library review',
		);
	}

	private static function gsc_plan( string $message ): array {
		return array(
			'intentSummary' => 'Site search performance review',
			'entityType'    => 'site',
			'entityScope'   => array( 'mode' => 'single', 'url' => '', 'limit' => 1 ),
			'dataNeeds'     => array(
				array( 'tool' => 'gsc_performance_summary', 'params' => array() ),
				array( 'tool' => 'gsc_top_queries', 'params' => array( 'rowLimit' => 15 ) ),
				array( 'tool' => 'gsc_top_pages', 'params' => array( 'limit' => 15 ) ),
			),
			'sliceTeam'     => self::build_slice_team( array( 'gsc_summary', 'gsc_queries', 'gsc_pages' ), 'site' ),
			'leadAgent'     => self::default_lead_agent( 'site' ),
			'reason'        => 'fast_path: GSC analytics',
		);
	}

	private static function blog_gsc_discovery_plan( string $message ): array {
		return array(
			'intentSummary' => 'Find blog posts performing well in Google Search Console',
			'entityType'    => 'site',
			'entityScope'   => array( 'mode' => 'single', 'url' => '', 'limit' => 1 ),
			'dataNeeds'     => array(
				array(
					'tool'   => 'gsc_blog_performers',
					'params' => array(
						'limit'     => 5,
						'minClicks' => 1,
					),
				),
			),
			'sliceTeam'     => self::build_slice_team( array( 'gsc_blog_performers' ), 'site' ),
			'leadAgent'     => self::default_lead_agent( 'site' ),
			'reason'        => 'fast_path: GSC blog discovery',
		);
	}

	/** @param array<int,string> $slices */
	private static function build_slice_team( array $slices, string $mode ): array {
		$labels = self::slice_role_labels();
		$team = array();
		foreach ( array_slice( $slices, 0, self::MAX_SLICE_AGENTS ) as $slice ) {
			$slice = sanitize_key( $slice );
			$team[] = array(
				'id'           => $slice . '_agent',
				'slice'        => $slice,
				'role'         => $labels[ $slice ] ?? ucwords( str_replace( '_', ' ', $slice ) ),
				'systemPrompt' => $slice === 'inventory'
					? self::inventory_slice_system_prompt( $mode )
					: ( in_array( $slice, self::ANALYTICS_SLICES, true )
						? self::analytics_slice_system_prompt( $slice, false )
						: self::slice_system_prompt( $slice, $mode ) ),
			);
		}
		return $team;
	}

	private static function analytics_slice_system_prompt( string $slice, bool $page_scoped = false ): string {
		if ( $slice === 'gsc_queries' && $page_scoped ) {
			return 'You are a GSC page performance specialist. Analyze search queries, clicks, impressions, and average position for the post URL in the analytics payload. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
		}
		if ( $slice === 'gsc_queries' ) {
			return 'You are a GSC top queries specialist. Analyze search query strings only from the analytics payload. A search query is NOT a blog post or page URL. Never describe a query string as a blog post or page. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
		}
		if ( $slice === 'gsc_summary' ) {
			return 'You are a GSC site performance specialist. Summarize period-over-period search metrics from the analytics payload. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
		}
		if ( $slice === 'gsc_reporting' ) {
			return 'You are a GSC reporting compare specialist. Summarize MoM or YoY period labels and site-total deltas (clicks, impressions, CTR, position) from the analytics payload. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
		}
		if ( $slice === 'gsc_pages' ) {
			return 'You are a GSC top pages specialist. Review top pages by clicks and impressions from the analytics payload. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
		}
		if ( $slice === 'gsc_blog_performers' ) {
			return 'You are a GSC blog performer finder. Use only blog page rows from the analytics payload (url, title, clicks, impressions, position, ctr). Cite each blog by post title and URL. If no blog rows have clicks, say so plainly. Never substitute a search query string for a blog post. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
		}
		if ( $slice === 'ga_organic' ) {
			return 'You are a GA organic traffic specialist. Review organic sessions and conversions from the analytics payload. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
		}
		return 'You are a ' . $slice . ' analytics specialist. Review the analytics payload for this slice. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
	}

	private static function inventory_slice_system_prompt( string $mode, string $post_status = 'publish' ): string {
		$scope = $mode === 'library' ? 'each post in the library payload' : 'the post in the payload';
		if ( $post_status === 'future' ) {
			return 'You are a site inventory listing specialist for scheduled content. Use only inventory rows with status future for ' . $scope . '. List title, scheduled date_gmt, and URL for each upcoming post. If no future rows exist, say so plainly. Do not score SEO quality. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
		}
		if ( $post_status === 'draft' ) {
			return 'You are a site inventory listing specialist for draft content. Use only inventory rows with status draft for ' . $scope . '. List title and URL for each draft post. Do not score SEO quality. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
		}
		return 'You are a site inventory listing specialist. Use only inventory fields (title, url, slug, date_gmt, status, excerpt, focus_keyword) for ' . $scope . '. Answer listing and retrieval questions with explicit title and URL bullets. Do not score SEO quality. Return JSON: {"findings":["string"],"score":null,"notes":"string","byUrl":{}}.';
	}

	private static function slice_system_prompt( string $slice, string $mode ): string {
		$scope = $mode === 'library' ? 'each post in the library payload' : 'the post in the payload';
		return 'You are a ' . $slice . ' specialist. Review only the ' . $slice . ' slice for ' . $scope . '. Return JSON: {"findings":["string"],"score":1-10 optional,"notes":"string","byUrl":{}}. Be critical; avoid uniform 10/10 scores unless genuinely excellent.';
	}

	/** @return array<string,mixed> */
	private static function default_lead_agent( string $mode ): array {
		return array(
			'systemPrompt'  => 'You are the lead research agent. Synthesize all slice specialist reports into a final answer for the user question. Return JSON with summary, score or scores, findings array, recommendations array, and byUrl when library mode.',
			'outputSchema'  => array(
				'summary'         => 'string',
				'score'           => 'number',
				'findings'        => array(),
				'recommendations' => array(),
				'byUrl'           => array(),
			),
		);
	}

	/** @return array<string,mixed> */
	private static function fallback_plan( string $message ): array {
		$scope = self::infer_entity_scope_from_message( $message );

		if ( self::wants_scheduled_listing( $message ) ) {
			$limit = $scope !== null ? $scope['limit'] : 5;
			return self::inventory_list_plan( $limit, 'Scheduled posts listing', 'date_asc', 'future', 'inventory_scheduled' );
		}

		if ( self::wants_draft_listing( $message ) ) {
			$limit = $scope !== null ? $scope['limit'] : 10;
			return self::inventory_list_plan( $limit, 'Draft posts listing', 'date_desc', 'draft' );
		}

		if ( self::wants_inventory_listing( $message ) ) {
			$limit = $scope !== null ? $scope['limit'] : 5;
			$sort  = $scope !== null ? $scope['sort'] : 'date_desc';
			return self::inventory_list_plan( $limit, 'Site inventory listing', $sort );
		}

		if ( self::wants_full_library_review( $message ) || self::wants_entity_review( $message ) ) {
			if ( $scope !== null && $scope['mode'] === 'single' ) {
				return self::single_post_plan( '', 'Review of one post', $scope['sort'] );
			}
			$limit = $scope !== null ? $scope['limit'] : 10;
			$sort  = $scope !== null ? $scope['sort'] : 'date_desc';
			return self::library_review_plan( $limit, 'Full library SEO review', $sort );
		}

		if ( $scope !== null && $scope['mode'] === 'single' ) {
			return self::single_post_plan( '', 'Review of one post', $scope['sort'] );
		}

		$limit = $scope !== null ? $scope['limit'] : 5;
		return self::inventory_list_plan( $limit, 'General post library listing' );
	}

	/** @param array<string,mixed> $parsed */
	private static function normalize_plan( array $parsed, string $message, array $body = array(), ?array $module_research = null ): array {
		$scope       = isset( $parsed['entityScope'] ) && is_array( $parsed['entityScope'] ) ? $parsed['entityScope'] : array();
		$team        = isset( $parsed['sliceTeam'] ) && is_array( $parsed['sliceTeam'] ) ? $parsed['sliceTeam'] : array();
		$mode        = sanitize_key( (string) ( $scope['mode'] ?? 'library' ) );
		$entity_type = sanitize_key( (string) ( $parsed['entityType'] ?? 'post' ) );
		$normalized_team = array();
		$seen_slices     = array();
		$seen_ids        = array();

		foreach ( array_slice( $team, 0, self::MAX_SLICE_AGENTS ) as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['slice'] ) ) {
				continue;
			}
			$slice = self::normalize_slice( (string) $entry['slice'], $entity_type );
			if ( $slice === '' ) {
				continue;
			}
			$entry_id = sanitize_key( (string) ( $entry['id'] ?? $slice . '_agent' ) );
			if ( isset( $seen_ids[ $entry_id ] ) ) {
				continue;
			}
			if ( $slice !== 'context' && isset( $seen_slices[ $slice ] ) ) {
				continue;
			}
			$seen_ids[ $entry_id ]    = true;
			if ( $slice !== 'context' ) {
				$seen_slices[ $slice ] = true;
			}
			$labels = self::slice_role_labels();
			$row = array(
				'id'           => $entry_id,
				'slice'        => $slice,
				'role'         => sanitize_text_field( (string) ( $entry['role'] ?? ( $labels[ $slice ] ?? $slice ) ) ),
				'systemPrompt' => sanitize_textarea_field( (string) ( $entry['systemPrompt'] ?? self::slice_prompt_for( $slice, $mode, $body, $entry ) ) ),
			);
			if ( $slice === 'context' && ! empty( $entry['focus'] ) ) {
				$row['focus'] = sanitize_text_field( (string) $entry['focus'] );
			}
			$normalized_team[] = $row;
		}
		if ( count( $normalized_team ) === 0 ) {
			if ( self::is_ui_help_message( $message, $body ) ) {
				return self::plan_workspace_context( $message, $body, $module_research );
			}
			return self::empty_plan( 'No valid slice team for this message' );
		}

		$research_mode = sanitize_key( (string) ( $parsed['researchMode'] ?? '' ) );
		if ( $research_mode === '' ) {
			$has_context = false;
			$has_site    = false;
			foreach ( $normalized_team as $spec ) {
				if ( ( $spec['slice'] ?? '' ) === 'context' ) {
					$has_context = true;
				} else {
					$has_site = true;
				}
			}
			$research_mode = $has_context && $has_site ? 'mixed' : ( $has_context ? 'workspace_context' : 'site_data' );
		}

		return array(
			'intentSummary' => sanitize_text_field( (string) ( $parsed['intentSummary'] ?? 'Research request' ) ),
			'entityType'    => $entity_type,
			'researchMode'  => $research_mode,
			'entityScope'   => array(
				'mode'      => $mode,
				'url'       => esc_url_raw( trim( (string) ( $scope['url'] ?? '' ) ) ),
				'limit'     => max( 1, min( 20, (int) ( $scope['limit'] ?? 5 ) ) ),
				'post_type' => sanitize_key( (string) ( $scope['post_type'] ?? 'post' ) ),
			),
			'dataNeeds'     => is_array( $parsed['dataNeeds'] ?? null ) ? $parsed['dataNeeds'] : array(),
			'sliceTeam'     => $normalized_team,
			'leadAgent'     => is_array( $parsed['leadAgent'] ?? null ) ? $parsed['leadAgent'] : self::default_lead_agent( $mode ),
			'reason'        => sanitize_text_field( (string) ( $parsed['reason'] ?? 'classifier plan' ) ),
		);
	}

	private static function slice_prompt_for( string $slice, string $mode, array $body, array $entry ): string {
		if ( $slice === 'context' ) {
			return self::context_system_prompt( (string) ( $entry['focus'] ?? 'tab capabilities' ), self::workspace_location( $body ) );
		}
		if ( $slice === 'inventory' ) {
			return self::inventory_slice_system_prompt( $mode );
		}
		if ( in_array( $slice, self::ANALYTICS_SLICES, true ) ) {
			return self::analytics_slice_system_prompt( $slice, false );
		}
		return self::slice_system_prompt( $slice, $mode );
	}

	/** @return array<string,string> */
	private static function slice_role_labels(): array {
		return array(
			'inventory'      => 'Site inventory listing specialist',
			'url'            => 'URL and slug reviewer',
			'meta'           => 'Meta description reviewer',
			'keyword'        => 'Focus keyword reviewer',
			'faq'            => 'FAQ schema reviewer',
			'seo_research'   => 'SEO research brief reviewer',
			'body'           => 'Body content reviewer',
			'featured_image' => 'Featured image reviewer',
			'gsc_summary'    => 'GSC performance reviewer',
			'gsc_reporting'  => 'GSC reporting compare reviewer',
			'gsc_queries'    => 'GSC top queries reviewer',
			'gsc_pages'      => 'GSC top pages reviewer',
			'gsc_blog_performers' => 'GSC blog performer finder',
			'ga_organic'     => 'GA organic traffic reviewer',
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 */
	private static function history_snippet( array $history ): string {
		$lines = array();
		foreach ( array_slice( $history, -4 ) as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$role = (string) ( $entry['role'] ?? '' );
			$text = trim( (string) ( $entry['content'] ?? '' ) );
			if ( $text !== '' ) {
				$lines[] = $role . ': ' . substr( $text, 0, 400 );
			}
		}
		return implode( "\n", $lines );
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 */
	private static function url_from_history( array $history ): string {
		for ( $i = count( $history ) - 1; $i >= 0; $i-- ) {
			$entry = $history[ $i ];
			if ( ! is_array( $entry ) || ( $entry['role'] ?? '' ) !== 'assistant' ) {
				continue;
			}
			$content = (string) ( $entry['content'] ?? '' );
			if ( preg_match( '#\((https?://[^\)]+)\)#', $content, $m ) ) {
				return esc_url_raw( $m[1] );
			}
		}
		return '';
	}
}
