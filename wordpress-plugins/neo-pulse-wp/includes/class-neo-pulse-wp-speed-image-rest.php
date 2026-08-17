<?php
/**
 * REST API for Speed image optimization.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Bulk batch and status endpoints.
 */
class Neo_Pulse_Wp_Speed_Image_Rest {

	const REST_NAMESPACE = 'neo-pulse/v1';

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/speed/images/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'rest_status' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/speed/images/batch',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_batch' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
				'args'                => array(
					'page'     => array(
						'type'    => 'integer',
						'default' => 1,
					),
					'per_page' => array(
						'type'    => 'integer',
						'default' => 5,
					),
					'force'    => array(
						'type'    => 'boolean',
						'default' => false,
					),
				),
			)
		);
	}

	/**
	 * @return bool
	 */
	public static function manage_permission(): bool {
		return current_user_can( 'manage_options' );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_status( WP_REST_Request $request ): WP_REST_Response {
		unset( $request );
		$config = Neo_Pulse_Wp_Speed_Image_Settings::get_config();

		return new WP_REST_Response(
			array(
				'ok'              => true,
				'enabled'         => ! empty( $config['enabled'] ),
				'config'          => $config,
				'stats'           => Neo_Pulse_Wp_Speed_Image_Stats::get(),
				'pending'         => Neo_Pulse_Wp_Speed_Image_Optimizer::count_pending( false ),
				'supports_webp'   => Neo_Pulse_Wp_Speed_Image_Settings::supports_webp_editor(),
				'conflicts'       => Neo_Pulse_Wp_Speed_Image_Settings::conflicting_plugins(),
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_batch( WP_REST_Request $request ) {
		if ( ! Neo_Pulse_Wp_Speed_Image_Settings::is_enabled() ) {
			return new WP_Error(
				'neo-pulse_speed_image_disabled',
				__( 'Enable image optimization under Speed → Images first.', 'neo-pulse-wp' ),
				array( 'status' => 400 )
			);
		}

		$limit = (int) apply_filters( 'neo_pulse_wp_speed_image_batch_time_limit', 30 );
		if ( $limit > 0 && function_exists( 'set_time_limit' ) ) {
			@set_time_limit( $limit );
		}

		$page     = max( 1, (int) $request->get_param( 'page' ) );
		$per_page = max( 1, min( 20, (int) $request->get_param( 'per_page' ) ) );
		$force    = (bool) $request->get_param( 'force' );

		$result = Neo_Pulse_Wp_Speed_Image_Optimizer::batch_optimize( $per_page, $page, $force );

		return new WP_REST_Response(
			array(
				'ok'     => true,
				'batch'  => $result,
				'stats'  => Neo_Pulse_Wp_Speed_Image_Stats::get(),
				'pending' => Neo_Pulse_Wp_Speed_Image_Optimizer::count_pending( $force ),
			),
			200
		);
	}
}
