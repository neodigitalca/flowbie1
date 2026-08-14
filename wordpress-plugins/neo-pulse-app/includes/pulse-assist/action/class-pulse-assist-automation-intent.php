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
