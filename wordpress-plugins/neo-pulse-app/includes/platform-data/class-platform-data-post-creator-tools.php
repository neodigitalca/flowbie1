<?php
/**
 * Post creator read-only tools for Pulse Assist platform data.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Platform_Data_Post_Creator_Tools {

	/**
	 * @param array<string,mixed> $body
	 * @param array<string,mixed> $params
	 * @return array{ok:bool,note?:string,lines?:array<int,string>}
	 */
	public static function tool_post_creator_status( array $body, array $params, string $message ): array {
		unset( $message );

		$site_id = sanitize_text_field( (string) ( $params['wordpressSiteId'] ?? $params['siteId'] ?? '' ) );
		if ( $site_id === '' ) {
			$ctx = isset( $body['team_context'] ) && is_array( $body['team_context'] ) ? $body['team_context'] : array();
			$site_id = sanitize_text_field( (string) ( $ctx['activeWordPressSiteId'] ?? $body['siteId'] ?? '' ) );
		}

		$lines = array( 'Post creator readiness:' );

		if ( $site_id !== '' ) {
			$site = Neo_Pulse_App_Task_Execution_Site_Resolver::resolve_by_id( $site_id );
			if ( $site ) {
				$lines[] = 'WordPress site: ' . (string) ( $site['name'] ?? $site_id );
				$lines[] = 'Site URL: ' . (string) ( $site['siteUrl'] ?? '' );
				$creds = ! empty( $site['username'] ) && ! empty( $site['appPassword'] );
				$lines[] = 'WP credentials: ' . ( $creds ? 'configured' : 'missing' );
			} else {
				$lines[] = 'WordPress site not found for id ' . $site_id;
			}
		} else {
			$lines[] = 'No wordpressSiteId in context.';
		}

		$lines[] = 'OpenRouter and DataForSEO keys are validated client-side at run time.';
		$lines[] = 'Use post_creator_execute or install monthly-post-creator / monthly-3-posts-editorial recipes for scheduled runs.';

		return array(
			'ok'    => true,
			'lines' => $lines,
		);
	}
}
