<?php
/**
 * Automation recipe intent for Pulse Assist Build dispatch.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Automation_Intent {

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|null
	 */
	public static function match( string $message, array $body, string $submode ): ?array {
		if ( $submode !== 'build' ) {
			return null;
		}

		$lower = strtolower( trim( $message ) );
		if ( $lower === '' ) {
			return null;
		}

		$manager_tab = sanitize_key( (string) ( $body['managerTab'] ?? $body['manager_tab'] ?? '' ) );
		$sitemap     = sanitize_key( (string) ( $body['sitemapSource'] ?? $body['sitemap_source'] ?? '' ) );

		if ( self::is_overview_pages_meta( $lower, $manager_tab, $sitemap, $body ) ) {
			return self::plan(
				'overview_pages_meta_batch',
				'Pages bucket meta batch',
				array(
					'sitemapSource' => $sitemap !== '' ? $sitemap : 'pages',
				),
				$body
			);
		}

		if ( self::is_content_optimizer_bulk( $lower, $manager_tab, $body ) ) {
			return self::plan(
				'content_optimizer_bulk',
				'Content optimization batch',
				array(),
				$body
			);
		}

		if ( self::is_gsc_reporting( $lower, $manager_tab, $body ) ) {
			$preset = str_contains( $lower, 'yoy' ) || str_contains( $lower, 'year over year' ) ? 'yoy' : 'mom';
			return self::plan(
				'gsc_reporting',
				$preset === 'yoy' ? 'GSC YoY report' : 'GSC MoM report',
				array(
					'comparePreset' => $preset,
					'saveToDisk'      => true,
				),
				$body
			);
		}

		if ( self::is_post_creator( $lower, $manager_tab, $body ) ) {
			$post_count = self::extract_post_count( $lower );
			return self::plan(
				'post_creator',
				$post_count > 1 ? "Create {$post_count} posts" : 'Create post',
				array(
					'postCount'              => $post_count,
					'keywordSource'          => 'prompt',
					'featuredImage'          => true,
					'postDestination'        => 'wordpress',
					'scheduleTimesPerMonth'  => $post_count,
					'scheduleStartDay'       => self::extract_schedule_start_day( $lower ),
					'scheduleStartTime'      => '09:00',
					'scheduleStaggerOptimized' => true,
				),
				$body
			);
		}

		return null;
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function is_overview_pages_meta( string $lower, string $manager_tab, string $sitemap, array $body ): bool {
		if ( $manager_tab !== 'overview' && $manager_tab !== 'content-optimizer' ) {
			if ( ! str_contains( $lower, 'overview' ) && ! str_contains( $lower, 'pages bucket' ) ) {
				return false;
			}
		}

		$meta_needles = array(
			'meta batch',
			'optimize meta',
			'ai meta',
			'all meta',
			'pages bucket',
			'page bucket',
			'pages meta',
		);
		foreach ( $meta_needles as $needle ) {
			if ( str_contains( $lower, $needle ) ) {
				if ( $sitemap === 'pages' || str_contains( $lower, 'page' ) ) {
					return true;
				}
			}
		}

		if ( str_contains( $lower, 'run automation' ) && str_contains( $lower, 'meta' ) ) {
			return true;
		}

		unset( $body );
		return false;
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function is_content_optimizer_bulk( string $lower, string $manager_tab, array $body ): bool {
		if ( $manager_tab === 'content-optimizer' ) {
			$needles = array( 'optimize', 'bulk', 'content', 'run automation', 'batch' );
			foreach ( $needles as $needle ) {
				if ( str_contains( $lower, $needle ) ) {
					return true;
				}
			}
		}

		$content_needles = array(
			'content optim',
			'optimize content',
			'bulk content',
			'content batch',
		);
		foreach ( $content_needles as $needle ) {
			if ( str_contains( $lower, $needle ) ) {
				return true;
			}
		}

		unset( $body );
		return false;
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function is_gsc_reporting( string $lower, string $manager_tab, array $body ): bool {
		if ( $manager_tab !== 'generator' && $manager_tab !== 'report' && $manager_tab !== 'gsc-reporting' ) {
			$report_tab = str_contains( $lower, 'gsc report' )
				|| str_contains( $lower, 'monthly report' )
				|| str_contains( $lower, 'generate report' )
				|| str_contains( $lower, 'mom report' )
				|| str_contains( $lower, 'yoy report' );
			if ( ! $report_tab ) {
				return false;
			}
		}

		$needles = array(
			'gsc report',
			'generate report',
			'monthly report',
			'mom report',
			'yoy report',
			'year over year report',
			'run reporting',
		);
		foreach ( $needles as $needle ) {
			if ( str_contains( $lower, $needle ) ) {
				return true;
			}
		}

		if ( str_contains( $lower, 'run automation' ) && ( str_contains( $lower, 'report' ) || str_contains( $lower, 'gsc' ) ) ) {
			return true;
		}

		unset( $body );
		return $manager_tab === 'generator' || $manager_tab === 'report';
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function is_post_creator( string $lower, string $manager_tab, array $body ): bool {
		if ( $manager_tab !== 'generator' && $manager_tab !== 'bulk-prompt' && $manager_tab !== 'bulk-csv' ) {
			$post_tab = str_contains( $lower, 'create post' )
				|| str_contains( $lower, 'generate post' )
				|| str_contains( $lower, 'monthly post' )
				|| str_contains( $lower, 'blog creator' );
			if ( ! $post_tab ) {
				return false;
			}
		}

		$needles = array(
			'create post',
			'create posts',
			'generate post',
			'generate posts',
			'monthly post',
			'monthly posts',
			'blog creator',
			'post creator',
			'scheduled post',
		);
		foreach ( $needles as $needle ) {
			if ( str_contains( $lower, $needle ) ) {
				return true;
			}
		}

		if ( str_contains( $lower, 'run automation' ) && str_contains( $lower, 'post' ) ) {
			return true;
		}

		unset( $body );
		return $manager_tab === 'generator';
	}

	private static function extract_post_count( string $lower ): int {
		if ( preg_match( '/\b(\d{1,2})\s+posts?\b/', $lower, $m ) ) {
			return max( 1, min( 31, (int) $m[1] ) );
		}
		if ( str_contains( $lower, 'three posts' ) || str_contains( $lower, 'three post' ) ) {
			return 3;
		}
		return 1;
	}

	private static function extract_schedule_start_day( string $lower ): int {
		if ( str_contains( $lower, 'first of' ) || str_contains( $lower, '1st of' ) ) {
			return 1;
		}
		if ( preg_match( '/\bon the (\d{1,2})(?:st|nd|rd|th)?\b/', $lower, $m ) ) {
			return max( 1, min( 28, (int) $m[1] ) );
		}
		return 1;
	}

	/**
	 * @param array<string,mixed> $plan_json
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function plan( string $recipe_key, string $title, array $plan_json, array $body ): array {
		$site_id = sanitize_text_field( (string) ( $body['siteId'] ?? $body['site_id'] ?? '' ) );
		$context = array(
			'siteId'        => $site_id,
			'managerTab'    => sanitize_key( (string) ( $body['managerTab'] ?? '' ) ),
			'sitemapSource' => sanitize_key( (string) ( $body['sitemapSource'] ?? '' ) ),
			'message'       => substr( trim( (string) ( $body['message'] ?? '' ) ), 0, 500 ),
		);

		return array(
			'recipeKey' => $recipe_key,
			'title'     => $title,
			'plan'      => $plan_json,
			'context'   => $context,
		);
	}

	/**
	 * @param array<string,mixed> $match
	 * @return array<string,mixed>
	 */
	public static function dispatch_card( array $match ): array {
		return array(
			'type'        => 'automation_dispatch',
			'title'       => (string) ( $match['title'] ?? 'Automation ready' ),
			'body'        => 'Review the automation, then run it in Running Agents.',
			'confidence'  => 'high',
			'recipe_key'  => (string) ( $match['recipeKey'] ?? '' ),
			'plan_json'   => isset( $match['plan'] ) && is_array( $match['plan'] ) ? $match['plan'] : array(),
			'context_json'=> isset( $match['context'] ) && is_array( $match['context'] ) ? $match['context'] : array(),
			'cta'         => array(
				'label'  => 'Run automation',
				'action' => 'agent_run_dispatch',
			),
			'links'       => array(
				array(
					'label'    => 'Open Running Agents',
					'navigate' => array(
						'kind' => 'agentRuns',
					),
				),
			),
		);
	}
}
