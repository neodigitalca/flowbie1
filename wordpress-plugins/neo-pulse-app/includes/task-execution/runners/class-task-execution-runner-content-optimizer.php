<?php
/**
 * Content optimizer execution runner (preflight + meta-only server path).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_Content_Optimizer {

	/**
	 * @param array<string,mixed> $task
	 * @param array<string,mixed> $execution
	 * @param array<string,mixed> $context
	 * @return array<string,mixed>
	 */
	public static function run( string $kind, array $task, array $execution, array $context ): array {
		$site_id = (string) ( $context['siteId'] ?? '' );
		$auth    = Neo_Pulse_App_Task_Execution_Site_Resolver::wordpress_auth( $site_id );
		if ( ! $auth ) {
			return array( 'ok' => false, 'error' => 'Could not resolve WordPress site credentials from sites.json.' );
		}

		$target_url = trim( (string) ( $context['targetUrl'] ?? '' ) );
		$payload = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();
		$target_bucket = Neo_Pulse_App_Tasks_Store::sanitize_execution_target_bucket(
			$context['targetBucket'] ?? ( $payload['targetBucket'] ?? '' )
		);
		if ( Neo_Pulse_App_Tasks_Store::is_execution_target_all( $target_url ) ) {
			$target_bucket = 'all';
		}

		$single_url = $target_url !== '' && ! Neo_Pulse_App_Tasks_Store::is_execution_target_all( $target_url );
		if ( ! $single_url && $target_bucket === '' ) {
			return array( 'ok' => false, 'error' => 'targetBucket is required.' );
		}

		$execution_id = (int) ( $execution['id'] ?? 0 );

		if ( ! $single_url ) {
			if ( $kind === 'content_optimizer_meta' ) {
				return self::awaiting_client_all_contract(
					$execution_id,
					$site_id,
					$payload,
					self::meta_optimization_options( $target_bucket ),
					$target_bucket
				);
			}

			return self::awaiting_client_all_contract( $execution_id, $site_id, $payload, null, $target_bucket );
		}

		$post_id = (int) ( $payload['postId'] ?? 0 );

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

		$acf = is_array( $meta_payload['acf'] ?? null ) ? $meta_payload['acf'] : array();
		$keyword_focus = trim( (string) ( $acf['keyword_focus'] ?? '' ) );
		if ( $keyword_focus === '' && empty( $payload['optimizationOptions']['manualKeyword'] ) ) {
			$hint = trim( (string) ( $context['primaryKeyword'] ?? '' ) );
			if ( $hint === '' ) {
				return array( 'ok' => false, 'error' => 'ACF keyword_focus is required before optimizing.' );
			}
		}

		$resolved_post = array(
			'id'       => (int) $resolved['id'],
			'subtype'  => (string) ( $resolved['subtype'] ?? 'post' ),
			'endpoint' => (string) ( $resolved['endpoint'] ?? 'posts' ),
			'link'     => (string) ( $meta_payload['link'] ?? $target_url ),
			'slug'     => (string) ( $resolved['slug'] ?? '' ),
		);

		if ( $kind === 'content_optimizer_meta' ) {
			try {
				$result = Neo_Pulse_App_Overview_Meta_Ai::run_optimize_meta_ai(
					array(
						'url'             => $target_url,
						'primaryKeyword'  => (string) ( $context['primaryKeyword'] ?? '' ),
						'wordpress'       => array(
							'siteUrl'     => (string) $auth['siteUrl'],
							'username'    => (string) $auth['username'],
							'appPassword' => (string) $auth['appPassword'],
						),
					)
				);
			} catch ( Exception $e ) {
				return array( 'ok' => false, 'error' => $e->getMessage() );
			}

			return array(
				'ok'      => true,
				'status'  => 'completed',
				'payload' => array(
					'resolvedPost' => $resolved_post,
					'result'       => $result,
				),
			);
		}

		$update_mode = sanitize_key( (string) ( $payload['updateMode'] ?? 'update' ) );
		$update_mode = $update_mode === 'draft' ? 'draft' : 'update';

		$options = self::default_optimization_options( $payload );

		$contract = array(
			'executionId'         => $execution_id,
			'siteId'              => $site_id,
			'url'                 => $target_url,
			'updateMode'          => $update_mode,
			'optimizationOptions' => $options,
			'resolvedPost'        => $resolved_post,
		);

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
	 * @param array<string,mixed> $payload
	 * @param array<string,mixed>|null $options_override
	 * @return array<string,mixed>
	 */
	private static function awaiting_client_all_contract(
		int $execution_id,
		string $site_id,
		array $payload,
		?array $options_override,
		string $target_bucket = 'all'
	): array {
		$update_mode = sanitize_key( (string) ( $payload['updateMode'] ?? 'update' ) );
		$update_mode = $update_mode === 'draft' ? 'draft' : 'update';
		$options     = null !== $options_override
			? $options_override
			: self::default_optimization_options( $payload );

		$contract = array(
			'executionId'         => $execution_id,
			'siteId'              => $site_id,
			'url'                 => 'ALL',
			'scope'               => 'all',
			'targetBucket'        => $target_bucket,
			'updateMode'          => $update_mode,
			'optimizationOptions' => $options,
		);
		if ( ! empty( $payload['targetUrls'] ) && is_array( $payload['targetUrls'] ) ) {
			$urls = array();
			foreach ( $payload['targetUrls'] as $url ) {
				$url = esc_url_raw( (string) $url );
				if ( $url !== '' ) {
					$urls[] = $url;
				}
			}
			if ( count( $urls ) > 0 ) {
				$contract['targetUrls'] = array_values( array_unique( $urls ) );
			}
		}

		return array(
			'ok'      => true,
			'status'  => 'awaiting_client',
			'payload' => array(
				'clientRunContract' => $contract,
			),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function meta_optimization_options( string $target_bucket ): array {
		if ( $target_bucket === 'pages' ) {
			return array(
				'optimizeTitle'         => true,
				'optimizeMeta'          => true,
				'optimizeExtraText'     => true,
				'seoExtraTextFieldOnly' => true,
				'optimizeContent'       => false,
				'optimizeExcerpt'       => false,
				'useAcfKeyword'         => true,
				'contentOnlyUpload'     => true,
			);
		}

		return array(
			'optimizeTitle'   => true,
			'optimizeMeta'    => true,
			'optimizeContent' => false,
			'optimizeExcerpt' => false,
			'useAcfKeyword'   => true,
		);
	}

	/**
	 * @param array<string,mixed> $payload
	 * @return array<string,mixed>
	 */
	private static function default_optimization_options( array $payload ): array {
		if ( isset( $payload['optimizationOptions'] ) && is_array( $payload['optimizationOptions'] ) ) {
			return Neo_Pulse_App_Tasks_Store::sanitize_execution_payload(
				array( 'optimizationOptions' => $payload['optimizationOptions'] )
			)['optimizationOptions'] ?? array();
		}
		return array(
			'optimizeTitle'   => true,
			'optimizeMeta'    => true,
			'optimizeContent' => true,
			'useAcfKeyword'   => true,
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
