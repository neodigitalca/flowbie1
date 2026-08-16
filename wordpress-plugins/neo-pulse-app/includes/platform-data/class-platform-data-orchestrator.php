<?php
/**
 * Platform data orchestrator: checklist → fetch → parallel team → lead synthesis.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Platform_Data_Orchestrator {

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $module_research
	 * @param callable|null                  $emit
	 * @return array<string,mixed>
	 */
	public static function research( string $message, array $history, array $body, ?array $module_research = null, ?callable $emit = null ): array {
		Neo_Pulse_App_Platform_Inventory::clear_request_cache();

		$emit_event = static function ( array $payload ) use ( $emit ): void {
			if ( is_callable( $emit ) ) {
				$emit( $payload );
			}
		};

		$empty = array(
			'block'             => '',
			'label'             => '',
			'toolIds'           => array(),
			'rows'              => array(),
			'classifierReason'  => '',
			'inventorySource'   => 'none',
			'acfComplete'       => false,
			'sliceTeam'         => array(),
			'leadAgentUsed'     => false,
			'intentSummary'     => '',
			'researchArtifacts' => null,
		);

		$is_ui_help = Neo_Pulse_App_Platform_Data_Intent_Checklist::is_ui_help_message( $message, $body );
		if ( ! $is_ui_help && ! self::any_data_source( $body ) ) {
			return $empty;
		}
		if ( $is_ui_help && ! self::has_module_research( $module_research ) && ! self::any_data_source( $body ) ) {
			return $empty;
		}

		$plan = Neo_Pulse_App_Platform_Data_Intent_Checklist::plan( $message, $history, $body, $module_research );
		if ( empty( $plan['sliceTeam'] ) || ! is_array( $plan['sliceTeam'] ) ) {
			return array_merge(
				$empty,
				array(
					'classifierReason' => (string) ( $plan['reason'] ?? 'No slice team planned' ),
				)
			);
		}

		$fetch_label = self::fetch_phase_label( $plan, $body );
		if ( $fetch_label !== '' ) {
			$emit_event(
				array(
					'status' => 'phase',
					'phase'  => 'fetch',
					'label'  => $fetch_label,
				)
			);
		}

		$fetched      = self::fetch_plan_data( $plan, $body, $message, $module_research );
		$tool_ids     = $fetched['toolIds'];
		$payload      = $fetched['payload'];
		$inv_source   = $fetched['inventorySource'];
		$acf_complete = $fetched['acfComplete'];

		if ( self::payload_empty( $payload, $plan ) ) {
			return array_merge(
				$empty,
				array(
					'classifierReason' => (string) ( $plan['reason'] ?? '' ),
					'intentSummary'    => (string) ( $plan['intentSummary'] ?? '' ),
					'sliceTeam'        => self::slice_team_summary( $plan['sliceTeam'] ),
				)
			);
		}

		$slice_team = Neo_Pulse_App_Platform_Data_Intent_Checklist::filter_slice_team_for_payload(
			$plan['sliceTeam'],
			$payload
		);
		if ( count( $slice_team ) === 0 ) {
			return array_merge(
				$empty,
				array(
					'classifierReason' => 'No slice specialists matched fetched payload',
					'intentSummary'    => (string) ( $plan['intentSummary'] ?? '' ),
				)
			);
		}

		$research_mode = self::resolve_research_mode( $plan, $payload );

		$emit_event(
			array(
				'status' => 'agent_plan',
				'agents' => self::slice_team_summary( $slice_team ),
			)
		);

		$team_result = Neo_Pulse_App_Platform_Data_Parallel_Team::run(
			$slice_team,
			$payload,
			$body,
			$emit
		);

		$plan['researchMode'] = $research_mode;

		$emit_event(
			array(
				'status' => 'lead',
				'state'  => 'running',
			)
		);

		$lead = Neo_Pulse_App_Platform_Data_Lead_Agent::synthesize(
			$message,
			$plan,
			$team_result['sliceReports'],
			$body,
			$fetched['payload']
		);

		$emit_event(
			array(
				'status' => 'lead',
				'state'  => 'done',
			)
		);

		$slice_summary = self::slice_team_summary( $slice_team );
		$artifacts     = array(
			'plan'            => $plan,
			'researchMode'    => $research_mode,
			'executionMode'   => 'parallel',
			'fetchedData'     => self::truncate_fetched_for_card( $fetched['raw'] ),
			'sliceReports'    => $team_result['sliceReports'],
			'leadSynthesis'   => array(
				'output' => $lead['synthesis'],
				'model'  => $lead['model'],
				'ms'     => $lead['ms'],
			),
			'researchedBlock' => $lead['block'],
		);

		return array(
			'block'             => $lead['block'],
			'label'             => $research_mode === 'site_data' ? 'site data' : 'workspace research',
			'toolIds'           => $tool_ids,
			'rows'              => $fetched['rows'],
			'classifierReason'  => (string) ( $plan['reason'] ?? '' ),
			'inventorySource'   => $inv_source,
			'acfComplete'       => $acf_complete,
			'sliceTeam'         => $slice_summary,
			'leadAgentUsed'     => true,
			'intentSummary'     => (string) ( $plan['intentSummary'] ?? '' ),
			'researchArtifacts' => $artifacts,
		);
	}

	/** @param array<string,mixed> $plan */
	private static function fetch_phase_label( array $plan, array $body ): string {
		$data_needs = isset( $plan['dataNeeds'] ) && is_array( $plan['dataNeeds'] ) ? $plan['dataNeeds'] : array();
		foreach ( $data_needs as $need ) {
			if ( ! is_array( $need ) || empty( $need['tool'] ) ) {
				continue;
			}
			$tool_id = sanitize_key( (string) $need['tool'] );
			if ( $tool_id !== 'module_catalog' && ! str_starts_with( $tool_id, 'inventory_' ) ) {
				return 'Querying site data…';
			}
		}

		$entity_type = sanitize_key( (string) ( $plan['entityType'] ?? 'post' ) );
		if ( ( $entity_type === 'post' || $entity_type === 'page' ) && Neo_Pulse_App_Platform_Inventory::inventory_configured( $body ) ) {
			return 'Loading site inventory…';
		}

		if ( self::has_module_research_context( $plan ) ) {
			return 'Preparing workspace context…';
		}

		return '';
	}

	/** @param array<string,mixed> $plan */
	private static function has_module_research_context( array $plan ): bool {
		$team = isset( $plan['sliceTeam'] ) && is_array( $plan['sliceTeam'] ) ? $plan['sliceTeam'] : array();
		foreach ( $team as $spec ) {
			if ( is_array( $spec ) && sanitize_key( (string) ( $spec['slice'] ?? '' ) ) === 'context' ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<string,mixed>|null $module_research
	 */
	private static function has_module_research( ?array $module_research ): bool {
		if ( $module_research === null || ! is_array( $module_research ) ) {
			return false;
		}
		$block = isset( $module_research['block'] ) ? trim( (string) $module_research['block'] ) : '';
		return $block !== '';
	}

	/**
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $module_research
	 * @return array<string,mixed>
	 */
	private static function build_context_payload( array $body, ?array $module_research ): array {
		if ( ! self::has_module_research( $module_research ) ) {
			return array();
		}
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		return array(
			'workspace'    => array(
				'locationSummary'    => (string) ( $pulse['locationSummary'] ?? '' ),
				'siteName'           => (string) ( $pulse['siteName'] ?? '' ),
				'managerTab'         => (string) ( $pulse['managerTab'] ?? '' ),
				'generatorSection'   => (string) ( $pulse['generatorSection'] ?? '' ),
				'sitemapSource'      => (string) ( $pulse['sitemapSource'] ?? '' ),
				'expandedPageTitle'  => (string) ( $pulse['expandedPageTitle'] ?? '' ),
			),
			'modules'      => is_array( $module_research['modules'] ?? null ) ? $module_research['modules'] : array(),
			'features'     => is_array( $module_research['features'] ?? null ) ? $module_research['features'] : array(),
			'catalogBlock' => (string) ( $module_research['block'] ?? '' ),
			'moduleIds'    => is_array( $module_research['moduleIds'] ?? null ) ? $module_research['moduleIds'] : array(),
		);
	}

	/**
	 * @param array<string,mixed> $plan
	 * @param array<string,mixed> $payload
	 */
	private static function resolve_research_mode( array $plan, array $payload ): string {
		$mode = sanitize_key( (string) ( $plan['researchMode'] ?? '' ) );
		if ( $mode !== '' ) {
			return $mode;
		}
		$has_context = ! empty( $payload['context'] );
		$has_site    = ! empty( $payload['entities'] ) || ! empty( $payload['analytics'] );
		if ( $has_context && $has_site ) {
			return 'mixed';
		}
		if ( $has_context ) {
			return 'workspace_context';
		}
		return 'site_data';
	}

	/**
	 * @param array<string,mixed> $body
	 */
	public static function gsc_available_for_body( array $body ): bool {
		return self::gsc_available();
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<int,string>
	 */
	public static function tool_catalog_lines( array $body ): array {
		$lines = array();
		foreach ( Neo_Pulse_App_Platform_Data_Tools::available_tools( $body ) as $tool ) {
			if ( empty( $tool['id'] ) ) {
				continue;
			}
			$lines[] = (string) $tool['id'] . ': ' . (string) ( $tool['description'] ?? '' );
		}
		return $lines;
	}

	/** @param array<string,mixed> $body */
	private static function any_data_source( array $body ): bool {
		return Neo_Pulse_App_Platform_Inventory::inventory_configured( $body )
			|| self::gsc_available()
			|| self::ga_available( $body );
	}

	/** @param array<string,mixed> $body */
	private static function ga_available( array $body ): bool {
		$tools = Neo_Pulse_App_Platform_Data_Tools::available_tools( $body );
		foreach ( $tools as $tool ) {
			if ( ( $tool['id'] ?? '' ) === 'ga_organic_summary' ) {
				return true;
			}
		}
		return false;
	}

	private static function gsc_available(): bool {
		$creds = Neo_Pulse_App_Gsc_Service_Account::get_credentials();
		return ! is_wp_error( $creds );
	}

	/**
	 * @param array<string,mixed>            $plan
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $module_research
	 * @return array{toolIds:array<int,string>,payload:array<string,mixed>,rows:array<int,array<string,mixed>>,inventorySource:string,acfComplete:bool,raw:array<string,mixed>}
	 */
	private static function fetch_plan_data( array $plan, array $body, string $message, ?array $module_research = null ): array {
		$scope       = isset( $plan['entityScope'] ) && is_array( $plan['entityScope'] ) ? $plan['entityScope'] : array();
		$data_needs  = isset( $plan['dataNeeds'] ) && is_array( $plan['dataNeeds'] ) ? $plan['dataNeeds'] : array();
		$entity_type = sanitize_key( (string) ( $plan['entityType'] ?? 'post' ) );

		$tool_ids  = array();
		$rows      = array();
		$payload   = array();
		$raw       = array();
		$inv_src   = 'none';
		$acf_done  = false;
		$analytics = array();

		$context = array();
		if ( self::plan_needs_module_context( $plan ) ) {
			$context = self::build_context_payload( $body, $module_research );
			if ( count( $context ) > 0 ) {
				$payload['context'] = $context;
				$raw['context']     = array(
					'moduleIds' => $context['moduleIds'] ?? array(),
					'catalogBlock' => substr( (string) ( $context['catalogBlock'] ?? '' ), 0, 4000 ),
				);
				$tool_ids[] = 'module_catalog';
			}
		}

		if ( self::plan_needs_inventory( $plan ) ) {
			$inv_params     = self::inventory_params_from_plan( $scope, $data_needs );
			$inventory_tool = self::inventory_tool_from_plan( $data_needs );
			if ( Neo_Pulse_App_Platform_Inventory::inventory_configured( $body ) ) {
				if ( $inventory_tool === 'inventory_scheduled' ) {
					$resolved = Neo_Pulse_App_Platform_Inventory::resolve_scheduled_rows( $body, $inv_params );
				} else {
					$resolved = self::resolve_plan_inventory( $body, $inv_params );
				}
				$rows     = $resolved['rows'];
				$inv_src  = (string) $resolved['source'];
				$acf_done = ! empty( $resolved['acfComplete'] );
				$payload['entities'] = $rows;
				$raw['inventory']    = array(
					'source' => $inv_src,
					'count'  => count( $rows ),
					'rows'   => array_map(
						static function ( $row ) {
							return Neo_Pulse_App_Platform_Inventory::build_subagent_post_bundle( $row );
						},
						$rows
					),
				);
				$tool_ids[] = $inventory_tool;
			}
		}

		foreach ( $data_needs as $need ) {
			if ( ! is_array( $need ) || empty( $need['tool'] ) ) {
				continue;
			}
			$tool_id = sanitize_key( (string) $need['tool'] );
			$params  = isset( $need['params'] ) && is_array( $need['params'] ) ? $need['params'] : array();

			if ( str_starts_with( $tool_id, 'inventory_' ) ) {
				continue;
			}

			if ( $tool_id === 'gsc_page_queries' && empty( $params['pageUrl'] ) ) {
				$page_url = ! empty( $scope['url'] ) ? esc_url_raw( trim( (string) $scope['url'] ) ) : '';
				if ( $page_url === '' && count( $rows ) > 0 && is_array( $rows[0] ) ) {
					$page_url = esc_url_raw( trim( (string) ( $rows[0]['url'] ?? '' ) ) );
				}
				if ( $page_url === '' ) {
					continue;
				}
				$params['pageUrl'] = $page_url;
			}

			$result = Neo_Pulse_App_Platform_Data_Tools::fetch_raw_tool( $tool_id, $body, $params, $message );
			if ( empty( $result['ok'] ) ) {
				continue;
			}
			$tool_ids[] = $tool_id;
			$raw[ $tool_id ] = $result;

			if ( $tool_id === 'gsc_performance_summary' ) {
				$analytics['gsc_summary'] = array(
					'lines' => $result['lines'] ?? array(),
				);
			}
			if ( $tool_id === 'gsc_reporting_compare_summary' ) {
				$analytics['gsc_reporting'] = array(
					'lines' => $result['lines'] ?? array(),
				);
			}
			if ( $tool_id === 'gsc_top_queries' ) {
				$analytics['gsc_queries'] = array(
					'queries' => $result['rows'] ?? array(),
					'lines'   => $result['lines'] ?? array(),
				);
			}
			if ( $tool_id === 'gsc_page_queries' ) {
				$analytics['gsc_queries'] = array(
					'queries' => $result['rows'] ?? array(),
					'lines'   => $result['lines'] ?? array(),
					'pageUrl' => (string) ( $params['pageUrl'] ?? '' ),
				);
			}
			if ( $tool_id === 'gsc_top_pages' ) {
				$pages = isset( $result['rows'] ) && is_array( $result['rows'] ) ? $result['rows'] : array();
				$analytics['gsc_pages'] = array(
					'pages' => $pages,
					'lines' => $result['lines'] ?? array(),
				);
			}
			if ( $tool_id === 'gsc_blog_performers' ) {
				$analytics['gsc_blog_performers'] = array(
					'blogs' => $result['rows'] ?? array(),
					'lines' => $result['lines'] ?? array(),
				);
			}
			if ( $tool_id === 'ga_organic_summary' ) {
				$analytics['ga_organic'] = array(
					'lines' => $result['lines'] ?? array(),
				);
			}
		}

		if ( count( $analytics ) > 0 ) {
			$payload['analytics'] = $analytics;
		}

		return array(
			'toolIds'         => array_values( array_unique( $tool_ids ) ),
			'payload'         => $payload,
			'rows'            => $rows,
			'inventorySource' => $inv_src,
			'acfComplete'     => $acf_done,
			'raw'             => $raw,
		);
	}

	/** @param array<string,mixed> $plan */
	private static function plan_needs_module_context( array $plan ): bool {
		$mode = sanitize_key( (string) ( $plan['researchMode'] ?? '' ) );
		if ( $mode === 'workspace_context' ) {
			return true;
		}

		$team = isset( $plan['sliceTeam'] ) && is_array( $plan['sliceTeam'] ) ? $plan['sliceTeam'] : array();
		foreach ( $team as $spec ) {
			if ( is_array( $spec ) && sanitize_key( (string) ( $spec['slice'] ?? '' ) ) === 'context' ) {
				return true;
			}
		}

		return false;
	}

	private static function plan_needs_inventory( array $plan ): bool {
		$entity_type = sanitize_key( (string) ( $plan['entityType'] ?? 'post' ) );
		if ( $entity_type === 'post' || $entity_type === 'page' ) {
			return true;
		}

		$data_needs = isset( $plan['dataNeeds'] ) && is_array( $plan['dataNeeds'] ) ? $plan['dataNeeds'] : array();
		foreach ( $data_needs as $need ) {
			if ( ! is_array( $need ) || empty( $need['tool'] ) ) {
				continue;
			}
			$tool_id = sanitize_key( (string) $need['tool'] );
			if ( str_starts_with( $tool_id, 'inventory_' ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @param array<string,mixed> $body
	 * @param array<string,mixed> $inv_params
	 * @return array{rows:array<int,array<string,mixed>>,source:string,acfComplete:bool}
	 */
	private static function resolve_plan_inventory( array $body, array $inv_params ): array {
		$collections = Neo_Pulse_App_Platform_Inventory::collections_for_params( $inv_params );
		$hint        = Neo_Pulse_App_Platform_Inventory::resolve_rows(
			$body,
			array(
				'tier'        => Neo_Pulse_App_Platform_Inventory::TIER_HINT,
				'collections' => $collections,
			)
		);
		$max         = isset( $inv_params['limit'] ) ? max( 1, (int) $inv_params['limit'] ) : 50;
		if ( count( $hint['rows'] ) > 0 ) {
			$rows = Neo_Pulse_App_Platform_Inventory::filter_inventory_rows( $hint['rows'], $inv_params, $max );
			if ( count( $rows ) > 0 ) {
				return array(
					'rows'        => $rows,
					'source'      => (string) $hint['source'],
					'acfComplete' => ! empty( $hint['acfComplete'] ),
				);
			}
		}

		return Neo_Pulse_App_Platform_Inventory::resolve_for_subagent( $body, $inv_params );
	}

	/**
	 * @param array<int,array<string,mixed>> $data_needs
	 */
	private static function inventory_tool_from_plan( array $data_needs ): string {
		foreach ( $data_needs as $need ) {
			if ( ! is_array( $need ) || empty( $need['tool'] ) ) {
				continue;
			}
			$tool = sanitize_key( (string) $need['tool'] );
			if ( str_starts_with( $tool, 'inventory_' ) ) {
				return $tool;
			}
		}
		return 'inventory_recent';
	}

	/**
	 * @param array<string,mixed>            $scope
	 * @param array<int,array<string,mixed>> $data_needs
	 * @return array<string,mixed>
	 */
	private static function inventory_params_from_plan( array $scope, array $data_needs ): array {
		$params = array(
			'post_type' => sanitize_key( (string) ( $scope['post_type'] ?? 'post' ) ),
			'limit'     => max( 1, min( 20, (int) ( $scope['limit'] ?? 10 ) ) ),
			'sort'      => 'date_desc',
		);
		if ( ! empty( $scope['url'] ) ) {
			$params['url'] = esc_url_raw( trim( (string) $scope['url'] ) );
			$params['limit'] = 1;
		}

		foreach ( $data_needs as $need ) {
			if ( ! is_array( $need ) || empty( $need['params'] ) || ! is_array( $need['params'] ) ) {
				continue;
			}
			foreach ( array( 'post_type', 'limit', 'sort', 'url', 'includeIds', 'post_status' ) as $key ) {
				if ( isset( $need['params'][ $key ] ) ) {
					$params[ $key ] = $need['params'][ $key ];
				}
			}
		}

		if ( ! empty( $params['post_status'] ) ) {
			$params['post_status'] = Neo_Pulse_App_Platform_Inventory::normalize_post_status( (string) $params['post_status'] );
		}

		return $params;
	}

	/**
	 * @param array<string,mixed> $payload
	 * @param array<string,mixed> $plan
	 */
	private static function payload_empty( array $payload, array $plan ): bool {
		if ( ! empty( $payload['context'] ) ) {
			return false;
		}
		$entity_type = sanitize_key( (string) ( $plan['entityType'] ?? 'post' ) );
		if ( $entity_type === 'site' || $entity_type === 'workspace' ) {
			return empty( $payload['analytics'] ) && empty( $payload['entities'] );
		}
		return empty( $payload['entities'] );
	}

	/**
	 * @param array<int,array<string,mixed>> $slice_team
	 * @return array<int,array{id:string,slice:string,role:string}>
	 */
	private static function slice_team_summary( array $slice_team ): array {
		$out = array();
		foreach ( $slice_team as $spec ) {
			if ( ! is_array( $spec ) ) {
				continue;
			}
			$out[] = array(
				'id'    => sanitize_key( (string) ( $spec['id'] ?? '' ) ) ?: sanitize_key( (string) ( $spec['slice'] ?? '' ) . '_agent' ),
				'slice' => (string) ( $spec['slice'] ?? '' ),
				'role'  => (string) ( $spec['role'] ?? '' ),
			);
		}
		return $out;
	}

	/** @param array<string,mixed> $raw */
	private static function truncate_fetched_for_card( array $raw ): array {
		$json = wp_json_encode( $raw );
		if ( ! is_string( $json ) || strlen( $json ) <= 12000 ) {
			return $raw;
		}
		return array(
			'truncated' => true,
			'preview'   => substr( $json, 0, 12000 ) . '…',
		);
	}
}
