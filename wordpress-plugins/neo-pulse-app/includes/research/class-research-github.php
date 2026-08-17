<?php
/**
 * Dispatch research browser jobs to GitHub Actions.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Research_Github {

	public static function is_configured(): bool {
		return self::token() !== '' && self::repo() !== '';
	}

	public static function token(): string {
		if ( defined( 'NEO_PULSE_APP_GITHUB_TOKEN' ) && NEO_PULSE_APP_GITHUB_TOKEN !== '' ) {
			return (string) NEO_PULSE_APP_GITHUB_TOKEN;
		}
		return '';
	}

	public static function repo(): string {
		if ( defined( 'NEO_PULSE_APP_GITHUB_REPO' ) && NEO_PULSE_APP_GITHUB_REPO !== '' ) {
			return trim( (string) NEO_PULSE_APP_GITHUB_REPO, " \t\n\r\0\x0B/" );
		}
		return '';
	}

	public static function ref(): string {
		if ( defined( 'NEO_PULSE_APP_GITHUB_REF' ) && NEO_PULSE_APP_GITHUB_REF !== '' ) {
			return (string) NEO_PULSE_APP_GITHUB_REF;
		}
		return 'main';
	}

	public static function callback_secret(): string {
		if ( defined( 'NEO_PULSE_APP_RESEARCH_CALLBACK_SECRET' ) && NEO_PULSE_APP_RESEARCH_CALLBACK_SECRET !== '' ) {
			return (string) NEO_PULSE_APP_RESEARCH_CALLBACK_SECRET;
		}
		return '';
	}

	/**
	 * @param array<string,mixed> $payload
	 * @return array<string,mixed>
	 */
	public static function dispatch_workflow( string $job_key, array $payload ): array {
		if ( ! self::is_configured() ) {
			return array(
				'ok'    => false,
				'error' => 'GitHub research runner is not configured.',
				'code'  => 'RESEARCH_GITHUB_NOT_CONFIGURED',
			);
		}

		if ( ! Neo_Pulse_App_Research_Job_Registry::is_valid( $job_key ) ) {
			return array(
				'ok'    => false,
				'error' => 'Unknown research job key.',
			);
		}

		$workflow = Neo_Pulse_App_Research_Job_Registry::workflow_file_for( $job_key );
		if ( $workflow === '' ) {
			return array(
				'ok'    => false,
				'error' => 'Research workflow is not registered.',
			);
		}

		$repo = self::repo();
		if ( ! preg_match( '#^[^/]+/[^/]+$#', $repo ) ) {
			return array(
				'ok'    => false,
				'error' => 'NEO_PULSE_APP_GITHUB_REPO must be owner/repo.',
			);
		}

		$url = 'https://api.github.com/repos/' . $repo . '/actions/workflows/' . rawurlencode( $workflow ) . '/dispatches';

		$body = wp_json_encode(
			array(
				'ref'    => self::ref(),
				'inputs' => array(
					'jobKey'  => sanitize_key( $job_key ),
					'payload' => wp_json_encode( $payload ),
				),
			)
		);

		$response = wp_remote_post(
			$url,
			array(
				'timeout' => 30,
				'headers' => array(
					'Authorization'        => 'Bearer ' . self::token(),
					'Accept'               => 'application/vnd.github+json',
					'X-GitHub-Api-Version' => '2022-11-28',
					'Content-Type'         => 'application/json',
				),
				'body'    => $body,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array(
				'ok'    => false,
				'error' => $response->get_error_message(),
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code !== 204 && $code !== 200 ) {
			$raw = (string) wp_remote_retrieve_body( $response );
			$data = json_decode( $raw, true );
			$message = is_array( $data ) && ! empty( $data['message'] )
				? (string) $data['message']
				: ( $raw !== '' ? $raw : 'GitHub workflow dispatch failed.' );
			return array(
				'ok'    => false,
				'error' => $message,
				'code'  => 'RESEARCH_GITHUB_DISPATCH_FAILED',
			);
		}

		return array(
			'ok'     => true,
			'status' => 'running',
		);
	}
}
