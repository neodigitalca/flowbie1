<?php
/**
 * Lead agent synthesis after sequential slice team.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Platform_Data_Lead_Agent {

	const LEAD_MODEL = 'google/gemini-2.5-flash';

	/**
	 * @param array<string,mixed>            $plan
	 * @param array<int,array<string,mixed>> $slice_reports
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>            $payload
	 * @return array{synthesis:array<string,mixed>,block:string,model:string,ms:int}
	 */
	public static function synthesize( string $message, array $plan, array $slice_reports, array $body, array $payload = array() ): array {
		$lead = isset( $plan['leadAgent'] ) && is_array( $plan['leadAgent'] ) ? $plan['leadAgent'] : array();
		$system = (string) ( $lead['systemPrompt'] ?? 'Synthesize slice reports into a final structured answer.' );

		$by_url_hint = self::has_blog_performer_reports( $plan, $slice_reports )
			? "\nWhen blog performer data exists, populate byUrl with each blog URL, title, clicks, and impressions."
			: '';

		$inventory_block = self::inventory_summary_for_lead( $plan, $payload );

		$user = "User question: {$message}\nIntent: " . (string) ( $plan['intentSummary'] ?? '' )
			. "\nResearch mode: " . (string) ( $plan['researchMode'] ?? 'site_data' )
			. "\n" . self::workspace_snippet( $body )
			. $inventory_block
			. "\nSlice reports:\n" . wp_json_encode( $slice_reports, JSON_UNESCAPED_SLASHES )
			. $by_url_hint
			. "\nReturn JSON: {\"summary\":\"string\",\"score\":number optional,\"findings\":[],\"recommendations\":[],\"byUrl\":{}}";

		$started   = microtime( true );
		$synthesis = array();
		$last_err  = '';
		foreach ( array( 0.25, 0.0 ) as $temperature ) {
			try {
				$synthesis = Neo_Pulse_App_Chat_Openrouter::json_completion(
					array(
						array( 'role' => 'system', 'content' => $system ),
						array( 'role' => 'user', 'content' => $user ),
					),
					array(
						'model'       => self::LEAD_MODEL,
						'temperature' => $temperature,
						'maxTokens'   => 4096,
					)
				);
				$last_err = '';
				break;
			} catch ( Exception $e ) {
				$last_err = $e->getMessage();
			}
		}
		if ( $last_err !== '' && count( $synthesis ) === 0 ) {
			$synthesis = array(
				'summary'  => 'Lead synthesis failed: ' . $last_err,
				'findings' => array(),
			);
		}

		$synthesis = self::normalize_inventory_synthesis( $plan, $synthesis, $payload );

		$ms = (int) round( ( microtime( true ) - $started ) * 1000 );
		return array(
			'synthesis' => $synthesis,
			'block'     => self::format_block( $plan, $slice_reports, $synthesis, $payload ),
			'model'     => self::LEAD_MODEL,
			'ms'        => $ms,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 */
	public static function inventory_listing_markdown( array $rows, string $listing_kind = 'default' ): string {
		if ( count( $rows ) === 0 ) {
			if ( $listing_kind === 'scheduled' ) {
				return 'No scheduled posts were found.';
			}
			if ( $listing_kind === 'draft' ) {
				return 'No draft posts were found.';
			}
			return 'No matching posts were found.';
		}

		$lines = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$title = trim( (string) ( $row['title'] ?? '' ) );
			if ( $title === '' ) {
				continue;
			}
			$url  = trim( (string) ( $row['url'] ?? '' ) );
			$date = trim( (string) ( $row['scheduled_date_gmt'] ?? $row['date_gmt'] ?? '' ) );
			$line = $url !== ''
				? '- [' . str_replace( array( '[', ']' ), '', $title ) . '](' . esc_url_raw( $url ) . ')'
				: '- ' . $title;
			if ( $listing_kind === 'scheduled' && $date !== '' ) {
				$line .= ' — scheduled ' . $date;
			} elseif ( $listing_kind === 'draft' ) {
				$line .= ' — draft';
			} elseif ( $date !== '' ) {
				$line .= ' (' . $date . ')';
			}
			$lines[] = $line;
		}

		return count( $lines ) > 0 ? implode( "\n", $lines ) : 'No matching posts were found.';
	}

	/**
	 * @param array<string,mixed>            $plan
	 * @param array<int,array<string,mixed>> $slice_reports
	 * @param array<string,mixed>            $synthesis
	 * @param array<string,mixed>            $payload
	 */
	public static function format_block( array $plan, array $slice_reports, array $synthesis, array $payload = array() ): string {
		$sections = array( '## Researched data', '### Lead synthesis' );
		$summary  = trim( (string) ( $synthesis['summary'] ?? '' ) );
		if ( $summary !== '' ) {
			$sections[] = $summary;
		}

		if ( self::plan_has_inventory_slice( $plan ) ) {
			$entities = isset( $payload['entities'] ) && is_array( $payload['entities'] ) ? $payload['entities'] : array();
			$inventory_md = self::inventory_listing_markdown( $entities, self::inventory_listing_kind( $plan ) );
			if ( $inventory_md !== '' ) {
				$sections[] = '### Inventory rows';
				$sections[] = $inventory_md;
			}
		}

		$blog_rows = self::blog_performer_rows_from_reports( $slice_reports );
		if ( count( $blog_rows ) > 0 ) {
			$table = Neo_Pulse_App_Platform_Data_Gsc_Tools::format_blog_performers_table( $blog_rows );
			if ( $table !== '' ) {
				$sections[] = '### Blog performers (GSC)';
				$sections[] = $table;
			}
		}

		if ( ! empty( $synthesis['byUrl'] ) && is_array( $synthesis['byUrl'] ) ) {
			$sections[] = 'Per URL:';
			foreach ( $synthesis['byUrl'] as $url => $info ) {
				if ( ! is_array( $info ) ) {
					continue;
				}
				$title = (string) ( $info['title'] ?? $url );
				$score = isset( $info['score'] ) ? (string) $info['score'] : '';
				$line  = '- [' . str_replace( array( '[', ']' ), '', $title ) . '](' . esc_url_raw( (string) $url ) . ')';
				if ( $score !== '' ) {
					$line .= ' — ' . $score . '/10';
				}
				if ( ! empty( $info['notes'] ) ) {
					$line .= ' — ' . (string) $info['notes'];
				}
				$sections[] = $line;
			}
		} elseif ( isset( $synthesis['score'] ) ) {
			$sections[] = 'Overall score: ' . (string) $synthesis['score'] . '/10';
		}

		if ( ! empty( $synthesis['findings'] ) && is_array( $synthesis['findings'] ) ) {
			foreach ( $synthesis['findings'] as $finding ) {
				$line = self::format_finding_line( $finding );
				if ( $line !== '' ) {
					$sections[] = $line;
				}
			}
		}

		foreach ( $slice_reports as $report ) {
			$id    = (string) ( $report['id'] ?? 'agent' );
			$role  = (string) ( $report['role'] ?? '' );
			$output = is_array( $report['output'] ?? null ) ? $report['output'] : array();
			$sections[] = '### Agent: ' . $id . ( $role !== '' ? ' (' . $role . ')' : '' );
			if ( ! empty( $output['notes'] ) ) {
				$sections[] = (string) $output['notes'];
			}
			if ( ! empty( $output['findings'] ) && is_array( $output['findings'] ) ) {
				foreach ( $output['findings'] as $f ) {
					$line = self::format_finding_line( $f );
					if ( $line !== '' ) {
						$sections[] = $line;
					}
				}
			}
		}

		return trim( implode( "\n", array_filter( $sections ) ) );
	}

	/**
	 * @param mixed $finding
	 */
	private static function format_finding_line( $finding ): string {
		if ( is_string( $finding ) ) {
			$text = trim( $finding );
			if ( $text === '' ) {
				return '';
			}
			return str_starts_with( $text, '- ' ) ? $text : '- ' . $text;
		}
		if ( ! is_array( $finding ) ) {
			return '';
		}

		$title = trim( (string) ( $finding['title'] ?? '' ) );
		$url   = trim( (string) ( $finding['url'] ?? '' ) );
		$date  = trim( (string) ( $finding['scheduled_date_gmt'] ?? $finding['date_gmt'] ?? '' ) );
		if ( $title === '' ) {
			$encoded = wp_json_encode( $finding, JSON_UNESCAPED_SLASHES );
			return is_string( $encoded ) && $encoded !== '' ? '- ' . $encoded : '';
		}

		$line = $url !== ''
			? '- [' . str_replace( array( '[', ']' ), '', $title ) . '](' . esc_url_raw( $url ) . ')'
			: '- ' . $title;
		if ( $date !== '' ) {
			$line .= ' — ' . $date;
		}
		return $line;
	}

	/**
	 * @param array<string,mixed> $plan
	 * @param array<string,mixed> $synthesis
	 * @param array<string,mixed> $payload
	 * @return array<string,mixed>
	 */
	private static function normalize_inventory_synthesis( array $plan, array $synthesis, array $payload ): array {
		if ( ! self::plan_has_inventory_slice( $plan ) ) {
			return $synthesis;
		}

		$summary = trim( (string) ( $synthesis['summary'] ?? '' ) );
		if ( $summary !== '' ) {
			return $synthesis;
		}

		$entities = isset( $payload['entities'] ) && is_array( $payload['entities'] ) ? $payload['entities'] : array();
		$kind     = self::inventory_listing_kind( $plan );
		$list_md  = self::inventory_listing_markdown( $entities, $kind );
		if ( $list_md === '' ) {
			return $synthesis;
		}

		if ( $kind === 'scheduled' ) {
			$synthesis['summary'] = "Upcoming scheduled posts:\n" . $list_md;
		} elseif ( $kind === 'draft' ) {
			$synthesis['summary'] = "Draft posts:\n" . $list_md;
		} else {
			$synthesis['summary'] = $list_md;
		}

		return $synthesis;
	}

	/**
	 * @param array<string,mixed> $plan
	 */
	private static function inventory_listing_kind( array $plan ): string {
		$data_needs = isset( $plan['dataNeeds'] ) && is_array( $plan['dataNeeds'] ) ? $plan['dataNeeds'] : array();
		foreach ( $data_needs as $need ) {
			if ( ! is_array( $need ) || empty( $need['tool'] ) ) {
				continue;
			}
			$tool = sanitize_key( (string) $need['tool'] );
			if ( $tool === 'inventory_scheduled' ) {
				return 'scheduled';
			}
			$params = isset( $need['params'] ) && is_array( $need['params'] ) ? $need['params'] : array();
			$status = sanitize_key( (string) ( $params['post_status'] ?? '' ) );
			if ( $status === 'future' ) {
				return 'scheduled';
			}
			if ( $status === 'draft' ) {
				return 'draft';
			}
		}
		return 'default';
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function workspace_snippet( array $body ): string {
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		if ( empty( $pulse['locationSummary'] ) ) {
			return '';
		}
		return 'Workspace: ' . sanitize_text_field( (string) $pulse['locationSummary'] );
	}

	/**
	 * @param array<string,mixed>            $plan
	 * @param array<int,array<string,mixed>> $slice_reports
	 */
	private static function has_blog_performer_reports( array $plan, array $slice_reports ): bool {
		$slice_team = isset( $plan['sliceTeam'] ) && is_array( $plan['sliceTeam'] ) ? $plan['sliceTeam'] : array();
		foreach ( $slice_team as $spec ) {
			if ( is_array( $spec ) && sanitize_key( (string) ( $spec['slice'] ?? '' ) ) === 'gsc_blog_performers' ) {
				return true;
			}
		}
		foreach ( $slice_reports as $report ) {
			if ( is_array( $report ) && sanitize_key( (string) ( $report['slice'] ?? '' ) ) === 'gsc_blog_performers' ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<int,array<string,mixed>> $slice_reports
	 * @return array<int,array<string,mixed>>
	 */
	private static function blog_performer_rows_from_reports( array $slice_reports ): array {
		foreach ( $slice_reports as $report ) {
			if ( ! is_array( $report ) || sanitize_key( (string) ( $report['slice'] ?? '' ) ) !== 'gsc_blog_performers' ) {
				continue;
			}
			$input = isset( $report['input'] ) && is_array( $report['input'] ) ? $report['input'] : array();
			if ( ! empty( $input['blogs'] ) && is_array( $input['blogs'] ) ) {
				return $input['blogs'];
			}
		}
		return array();
	}

	/**
	 * @param array<string,mixed> $plan
	 * @param array<string,mixed> $payload
	 */
	private static function inventory_summary_for_lead( array $plan, array $payload ): string {
		if ( ! self::plan_has_inventory_slice( $plan ) ) {
			return '';
		}

		$entities = isset( $payload['entities'] ) && is_array( $payload['entities'] ) ? $payload['entities'] : array();
		if ( count( $entities ) === 0 ) {
			return '';
		}

		$lines = array( "\nInventory rows (authoritative for listing questions):" );
		foreach ( array_slice( $entities, 0, 20 ) as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$title = trim( (string) ( $row['title'] ?? '' ) );
			$url   = trim( (string) ( $row['url'] ?? '' ) );
			$date  = trim( (string) ( $row['date_gmt'] ?? '' ) );
			if ( $title === '' ) {
				continue;
			}
			$line = '- ' . $title;
			if ( $date !== '' ) {
				$line .= ' (' . $date . ')';
			}
			$status = trim( (string) ( $row['status'] ?? '' ) );
			if ( $status !== '' && $status !== 'publish' ) {
				$line .= ' [' . $status . ']';
			}
			if ( $url !== '' ) {
				$line .= ' — ' . $url;
			}
			$lines[] = $line;
		}

		if ( count( $lines ) <= 1 ) {
			return '';
		}

		return implode( "\n", $lines ) . "\n";
	}

	/**
	 * @param array<string,mixed> $plan
	 */
	private static function plan_has_inventory_slice( array $plan ): bool {
		$slice_team = isset( $plan['sliceTeam'] ) && is_array( $plan['sliceTeam'] ) ? $plan['sliceTeam'] : array();
		foreach ( $slice_team as $spec ) {
			if ( is_array( $spec ) && sanitize_key( (string) ( $spec['slice'] ?? '' ) ) === 'inventory' ) {
				return true;
			}
		}
		return false;
	}
}
