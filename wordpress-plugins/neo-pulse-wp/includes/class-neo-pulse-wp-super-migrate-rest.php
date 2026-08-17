<?php
/**
 * Super Migrate REST routes.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Super_Migrate_Rest {

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		$perm = function () {
			return current_user_can( 'manage_options' );
		};

		register_rest_route(
			'neo-pulse/v1',
			'/super-migrate/plan',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'rest_plan' ),
				'permission_callback' => $perm,
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/super-migrate/start',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_start' ),
				'permission_callback' => $perm,
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/super-migrate/step',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_step' ),
				'permission_callback' => $perm,
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/super-migrate/status/(?P<job_id>[a-zA-Z0-9_]+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'rest_status' ),
				'permission_callback' => $perm,
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/super-migrate/flo-sheet',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'rest_flo_sheet' ),
				'permission_callback' => $perm,
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/super-migrate/flo-sheet/import',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_flo_sheet_import' ),
				'permission_callback' => $perm,
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/super-migrate/deactivate-conflicts',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_deactivate_conflicts' ),
				'permission_callback' => $perm,
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/super-migrate/restore-plugins',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_restore_plugins' ),
				'permission_callback' => $perm,
			)
		);
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function rest_plan(): WP_REST_Response {
		return new WP_REST_Response( Neo_Pulse_Wp_Super_Migrate::get_plan_preview(), 200 );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_start( WP_REST_Request $request ): WP_REST_Response {
		$body   = $request->get_json_params();
		$params = is_array( $body ) ? $body : array();
		$result = Neo_Pulse_Wp_Super_Migrate::start_job( $params );
		$code   = ! empty( $result['ok'] ) ? 200 : 400;
		return new WP_REST_Response( $result, $code );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_step( WP_REST_Request $request ): WP_REST_Response {
		$body   = $request->get_json_params();
		$params = is_array( $body ) ? $body : array();
		$job_id = isset( $params['job_id'] ) ? sanitize_key( (string) $params['job_id'] ) : '';
		if ( $job_id === '' ) {
			return new WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'job_id is required.', 'neo-pulse-wp' ),
				),
				400
			);
		}
		$result = Neo_Pulse_Wp_Super_Migrate::run_step( $job_id, $params );
		$code   = ! empty( $result['ok'] ) ? 200 : 400;
		return new WP_REST_Response( $result, $code );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_status( WP_REST_Request $request ): WP_REST_Response {
		$job_id = sanitize_key( (string) $request['job_id'] );
		$job    = Neo_Pulse_Wp_Super_Migrate::get_status( $job_id );
		if ( null === $job ) {
			return new WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Job not found.', 'neo-pulse-wp' ),
				),
				404
			);
		}
		return new WP_REST_Response(
			array(
				'ok'  => true,
				'job' => $job,
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function rest_flo_sheet(): WP_REST_Response {
		$sheet = Neo_Pulse_Wp_Neo_Pulse_Sheet::get();
		return new WP_REST_Response(
			array(
				'ok'      => true,
				'sheet'   => $sheet,
				'json'    => Neo_Pulse_Wp_Neo_Pulse_Sheet::to_json( $sheet ),
				'summary' => Neo_Pulse_Wp_Super_Migrate::sheet_summary( $sheet ),
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_flo_sheet_import( WP_REST_Request $request ): WP_REST_Response {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = array();
		}
		$json = isset( $body['json'] ) ? (string) $body['json'] : '';
		if ( $json === '' && isset( $body['sheet'] ) && is_array( $body['sheet'] ) ) {
			$json = Neo_Pulse_Wp_Neo_Pulse_Sheet::to_json( $body['sheet'] );
		}
		if ( $json === '' ) {
			return new WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Flo Sheet JSON is required.', 'neo-pulse-wp' ),
				),
				400
			);
		}
		$result = Neo_Pulse_Wp_Super_Migrate::import_neo_pulse_sheet( $json, ! empty( $body['dry_run'] ) );
		$code   = ! empty( $result['ok'] ) ? 200 : 400;
		return new WP_REST_Response( $result, $code );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_deactivate_conflicts( WP_REST_Request $request ): WP_REST_Response {
		$body   = $request->get_json_params();
		$params = is_array( $body ) ? $body : array();
		$job_id = isset( $params['job_id'] ) ? sanitize_key( (string) $params['job_id'] ) : '';
		if ( $job_id === '' ) {
			return new WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'job_id is required.', 'neo-pulse-wp' ),
				),
				400
			);
		}

		$plugin_files = array();
		if ( isset( $params['plugin_files'] ) && is_array( $params['plugin_files'] ) ) {
			$plugin_files = array_map( 'strval', $params['plugin_files'] );
		}

		$result = Neo_Pulse_Wp_Super_Migrate::deactivate_imported_conflicts( $job_id, $plugin_files );
		$code   = ! empty( $result['ok'] ) ? 200 : 400;
		return new WP_REST_Response( $result, $code );
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function rest_restore_plugins(): WP_REST_Response {
		ob_start();
		$result = Neo_Pulse_Wp_Super_Migrate::restore_imported_plugins();
		ob_end_clean();
		$code   = ! empty( $result['ok'] ) ? 200 : 400;
		return new WP_REST_Response( $result, $code );
	}
}
