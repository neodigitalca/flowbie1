<?php
/**
 * Weighted harness token budgets (parity with harness-section-max-tokens.ts).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Harness_Section_Tokens {

	const TOKEN_SANITY_MIN           = 256;
	const BASE_NEED_PER_WEIGHT_UNIT  = 480;
	const DEFAULT_ROW_TOKEN_BUDGET   = 16000;

	/**
	 * @param array<int,array<string,mixed>> $sections
	 * @return array<int,array{sectionKey:string,maxTokens:int,weight:float,estimatedNeed:int}>
	 */
	public static function compute_harness_section_token_budgets( array $sections, int $total_budget ): array {
		if ( empty( $sections ) ) {
			return array();
		}
		$count = count( $sections );
		if ( $total_budget < self::TOKEN_SANITY_MIN * $count ) {
			throw new Exception(
				'Increase max tokens for this row (need at least ' . ( self::TOKEN_SANITY_MIN * $count ) . ", have {$total_budget} for {$count} sections)"
			);
		}

		$weighted = array();
		foreach ( $sections as $section ) {
			$weight          = self::compute_section_weight( $section );
			$imported_chars  = (int) ( $section['importedExcerptChars'] ?? 0 );
			$weighted[]      = array(
				'sectionKey'    => (string) ( $section['sectionKey'] ?? '' ),
				'weight'        => $weight,
				'estimatedNeed' => self::estimated_need_for_weight( $weight, $imported_chars ),
				'maxTokens'     => self::TOKEN_SANITY_MIN,
			);
		}

		$sum_weights = array_sum( array_column( $weighted, 'weight' ) );
		if ( $sum_weights <= 0 ) {
			$sum_weights = (float) $count;
		}

		foreach ( $weighted as &$slot ) {
			$slot['maxTokens'] = max(
				self::TOKEN_SANITY_MIN,
				(int) floor( ( $total_budget * $slot['weight'] ) / $sum_weights )
			);
		}
		unset( $slot );

		$allocated = array_sum( array_column( $weighted, 'maxTokens' ) );
		$remainder = $total_budget - $allocated;
		if ( $remainder > 0 ) {
			usort(
				$weighted,
				static function ( $a, $b ) {
					return $b['weight'] <=> $a['weight'];
				}
			);
			$idx = 0;
			while ( $remainder > 0 ) {
				$key = $weighted[ $idx % count( $weighted ) ]['sectionKey'];
				foreach ( $weighted as &$slot ) {
					if ( $slot['sectionKey'] === $key ) {
						$slot['maxTokens'] += 1;
						break;
					}
				}
				unset( $slot );
				--$remainder;
				++$idx;
			}
		}

		return $weighted;
	}

	/**
	 * @param array<string,mixed> $section
	 */
	private static function compute_section_weight( array $section ): float {
		if ( ! empty( $section['isOverview'] ) ) {
			$n = (int) ( $section['bodySectionCount'] ?? 0 );
			return 0.85 + 0.08 * $n;
		}

		$weight = 1.0;
		$feat   = strtolower( implode( ' ', (array) ( $section['features'] ?? array() ) ) );
		if ( strpos( $feat, '[table]' ) !== false ) {
			$weight += 0.6;
		}
		if ( strpos( $feat, '[list]' ) !== false ) {
			$weight += 0.35;
		}
		if ( ! empty( $section['h3Enabled'] ) ) {
			$weight += 0.25;
		}
		if ( (int) ( $section['importedExcerptChars'] ?? 0 ) > 0 ) {
			$weight += 0.2;
		}
		if ( ! empty( $section['isSeoOpener'] ) ) {
			$weight += 0.15;
		}
		return $weight;
	}

	private static function estimated_need_for_weight( float $weight, int $imported_excerpt_chars ): int {
		$need = self::BASE_NEED_PER_WEIGHT_UNIT * $weight;
		if ( $imported_excerpt_chars > 800 ) {
			$need += 320;
		} elseif ( $imported_excerpt_chars > 400 ) {
			$need += 200;
		} elseif ( $imported_excerpt_chars > 0 ) {
			$need += 120;
		}
		return (int) ceil( $need );
	}

	/**
	 * @param array<int,array<string,mixed>> $body_agents
	 * @return array<string,int> sectionKey => maxTokens
	 */
	public static function token_map_for_body_and_overview( array $body_agents, int $total_budget = self::DEFAULT_ROW_TOKEN_BUDGET ): array {
		$inputs   = array();
		$body_cnt = count( $body_agents );
		foreach ( $body_agents as $i => $agent ) {
			if ( ! is_array( $agent ) ) {
				continue;
			}
			$step = (int) ( $agent['step'] ?? ( $i + 1 ) );
			$inputs[] = array(
				'sectionKey'           => 'body-' . $i,
				'features'             => is_array( $agent['features'] ?? null ) ? $agent['features'] : array(),
				'h3Enabled'            => ! empty( $agent['h3Enabled'] ),
				'isOverview'           => false,
				'isSeoOpener'          => $step === 1,
				'importedExcerptChars' => 0,
				'bodySectionCount'     => $body_cnt,
			);
		}
		$inputs[] = array(
			'sectionKey'       => 'overview',
			'features'         => array(),
			'isOverview'       => true,
			'bodySectionCount' => $body_cnt,
		);

		$slots = self::compute_harness_section_token_budgets( $inputs, $total_budget );
		$map   = array();
		foreach ( $slots as $slot ) {
			$map[ $slot['sectionKey'] ] = (int) $slot['maxTokens'];
		}
		return $map;
	}
}
