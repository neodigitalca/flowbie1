<?php
/**
 * DFS LLM article audit execution runner.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_Dfs_Article_Audit {

	/**
	 * @param array<string,mixed> $task
	 * @param array<string,mixed> $execution
	 * @param array<string,mixed> $context
	 * @return array<string,mixed>
	 */
	public static function run( string $kind, array $task, array $execution, array $context ): array {
		unset( $kind, $task );

		$site_id = (string) ( $context['siteId'] ?? '' );
		$auth    = Neo_Pulse_App_Task_Execution_Site_Resolver::wordpress_auth( $site_id );
		if ( ! $auth ) {
			return array( 'ok' => false, 'error' => 'Could not resolve WordPress site credentials from sites.json.' );
		}

		$target_url = trim( (string) ( $context['targetUrl'] ?? '' ) );
		$payload    = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();

		if ( $target_url === '' || Neo_Pulse_App_Tasks_Store::is_execution_target_all( $target_url ) ) {
			return array( 'ok' => false, 'error' => 'A single article URL is required for DFS LLM article audit.' );
		}

		$execution_id = (int) ( $execution['id'] ?? 0 );
		$post_id      = (int) ( $payload['postId'] ?? 0 );

		$resolved = $post_id > 0
			? self::resolve_post_by_id( $auth, $post_id )
			: self::resolve_url( $auth, $target_url );
		if ( ! $resolved ) {
			return array( 'ok' => false, 'error' => 'Could not resolve URL to a WordPress post.' );
		}

		$meta_payload = self::get_post_meta( $auth, $resolved );
		if ( empty( $meta_payload['success'] ) ) {
			return array(
				'ok'    => false,
				'error' => (string) ( $meta_payload['error'] ?? 'Failed to load post from WordPress.' ),
			);
		}

		$acf            = is_array( $meta_payload['acf'] ?? null ) ? $meta_payload['acf'] : array();
		$keyword_focus  = trim( (string) ( $acf['keyword_focus'] ?? '' ) );
		$payload_kw     = trim( (string) ( $payload['focusKeyword'] ?? $payload['keyword'] ?? '' ) );
		$context_kw     = trim( (string) ( $context['primaryKeyword'] ?? '' ) );
		$focus_keyword  = $payload_kw !== '' ? $payload_kw : ( $keyword_focus !== '' ? $keyword_focus : $context_kw );

		if ( $focus_keyword === '' ) {
			return array( 'ok' => false, 'error' => 'Focus keyword is required before running DFS LLM article audit.' );
		}

		$resolved_post = array(
			'id'       => (int) $resolved['id'],
			'subtype'  => (string) ( $resolved['subtype'] ?? 'post' ),
			'endpoint' => (string) ( $resolved['endpoint'] ?? 'posts' ),
			'link'     => (string) ( $meta_payload['link'] ?? $target_url ),
			'slug'     => (string) ( $resolved['slug'] ?? '' ),
		);

		$contract = array_merge(
			array(
				'executionId'      => $execution_id,
				'siteId'           => $site_id,
				'url'              => $target_url,
				'focusKeyword'     => $focus_keyword,
				'primaryKeyword'   => $focus_keyword,
				'resolvedPost'     => $resolved_post,
				'saveLocalArchive' => ! empty( $payload['saveLocalArchive'] ) || ! empty( $payload['sendAutomationEmail'] ) || ! empty( $payload['saveToGoogleDrive'] ),
			),
			Neo_Pulse_App_Tasks_Store::automation_email_contract_fields( $payload ),
			Neo_Pulse_App_Tasks_Store::google_drive_contract_fields( $payload )
		);
		if ( isset( $payload['auditQuestions'] ) && is_array( $payload['auditQuestions'] ) ) {
			$questions = array();
			foreach ( $payload['auditQuestions'] as $question ) {
				$trimmed = trim( (string) $question );
				if ( $trimmed !== '' ) {
					$questions[] = $trimmed;
				}
			}
			if ( ! empty( $questions ) ) {
				$contract['auditQuestions'] = $questions;
			}
		}
		if ( isset( $payload['auditPlatforms'] ) && is_array( $payload['auditPlatforms'] ) ) {
			$allowed = array( 'chat_gpt', 'gemini', 'perplexity' );
			$platforms = array();
			foreach ( $payload['auditPlatforms'] as $platform ) {
				$trimmed = trim( (string) $platform );
				if ( $trimmed !== '' && in_array( $trimmed, $allowed, true ) && ! in_array( $trimmed, $platforms, true ) ) {
					$platforms[] = $trimmed;
				}
			}
			if ( ! empty( $platforms ) ) {
				$contract['auditPlatforms'] = $platforms;
			}
		}
		$seo_research = trim( (string) ( $acf['seo_research'] ?? '' ) );
		if ( $seo_research !== '' ) {
			if ( function_exists( 'mb_substr' ) ) {
				$contract['seoResearchBrief'] = mb_substr( $seo_research, 0, 500 );
			} else {
				$contract['seoResearchBrief'] = substr( $seo_research, 0, 500 );
			}
		}

		return array(
			'ok'      => true,
			'status'  => 'awaiting_client',
			'payload' => array(
				'resolvedPost'      => $resolved_post,
				'clientRunContract' => $contract,
			),
		);
	}

	/**
	 * @param array<string,mixed> $auth
	 * @return array<string,mixed>|null
	 */
	private static function resolve_url( array $auth, string $url ): ?array {
		$slug = basename( untrailingslashit( wp_parse_url( $url, PHP_URL_PATH ) ?: '' ) );
		foreach ( array( 'posts', 'pages' ) as $endpoint ) {
			$api = (string) $auth['siteUrl'] . '/wp-json/wp/v2/' . $endpoint . '?slug=' . rawurlencode( $slug ) . '&context=edit';
			$res = self::wp_get( $api, (string) $auth['username'], (string) $auth['appPassword'] );
			if ( is_array( $res ) && ! empty( $res[0]['id'] ) ) {
				return array(
					'id'       => (int) $res[0]['id'],
					'subtype'  => $endpoint === 'pages' ? 'page' : 'post',
					'endpoint' => $endpoint,
					'slug'     => $slug,
				);
			}
		}
		return null;
	}

	/**
	 * @param array<string,mixed> $auth
	 * @return array<string,mixed>|null
	 */
	private static function resolve_post_by_id( array $auth, int $post_id ): ?array {
		foreach ( array( 'posts', 'pages' ) as $endpoint ) {
			$api = (string) $auth['siteUrl'] . '/wp-json/wp/v2/' . $endpoint . '/' . $post_id . '?context=edit';
			$res = self::wp_get( $api, (string) $auth['username'], (string) $auth['appPassword'] );
			if ( is_array( $res ) && ! empty( $res['id'] ) ) {
				return array(
					'id'       => (int) $res['id'],
					'subtype'  => $endpoint === 'pages' ? 'page' : 'post',
					'endpoint' => $endpoint,
					'slug'     => (string) ( $res['slug'] ?? '' ),
				);
			}
		}
		return null;
	}

	/**
	 * @param array<string,mixed> $auth
	 * @param array<string,mixed> $resolved
	 * @return array<string,mixed>
	 */
	private static function get_post_meta( array $auth, array $resolved ): array {
		$endpoint = (string) ( $resolved['endpoint'] ?? 'posts' );
		$post_id  = (int) ( $resolved['id'] ?? 0 );
		$api      = (string) $auth['siteUrl'] . '/wp-json/wp/v2/' . $endpoint . '/' . $post_id . '?context=edit';
		$res      = self::wp_get( $api, (string) $auth['username'], (string) $auth['appPassword'] );
		if ( ! is_array( $res ) ) {
			return array( 'success' => false, 'error' => is_string( $res ) ? $res : 'WordPress API request failed' );
		}
		return array(
			'success' => true,
			'acf'     => is_array( $res['acf'] ?? null ) ? $res['acf'] : array(),
			'link'    => (string) ( $res['link'] ?? '' ),
		);
	}

	/** @return array<string,mixed>|array<int,mixed>|string|null */
	private static function wp_get( string $url, string $username, string $app_password ) {
		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 30,
				'headers' => array(
					'Authorization' => 'Basic ' . base64_encode( $username . ':' . $app_password ),
					'Accept'        => 'application/json',
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response->get_error_message();
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['message'] ) ? (string) $data['message'] : 'HTTP ' . $code;
			return $msg;
		}
		return is_array( $data ) ? $data : null;
	}
}
