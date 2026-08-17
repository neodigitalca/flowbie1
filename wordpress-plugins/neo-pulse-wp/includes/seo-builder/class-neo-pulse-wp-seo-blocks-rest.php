<?php
/**
 * REST routes for SEO blocks and AI optimization.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Blocks_Rest {

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'list_blocks' ),
					'permission_callback' => array( __CLASS__, 'manage_permission' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'save_block' ),
					'permission_callback' => array( __CLASS__, 'manage_permission' ),
				),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_block' ),
					'permission_callback' => array( __CLASS__, 'manage_permission' ),
					'args'                => array(
						'id' => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
					),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( __CLASS__, 'delete_block' ),
					'permission_callback' => array( __CLASS__, 'manage_permission' ),
					'args'                => array(
						'id' => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
					),
				),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks/draft',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_draft' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks/choices',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'block_choices' ),
				'permission_callback' => array( __CLASS__, 'edit_post_permission' ),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks/(?P<id>\d+)/sync-library',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'sync_library' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
				'args'                => array(
					'id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks/(?P<id>\d+)/duplicate',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'duplicate_block' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
				'args'                => array(
					'id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks/page-search',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'page_search' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
				'args'                => array(
					'search' => array(
						'type'              => 'string',
						'required'          => false,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'per_page' => array(
						'type'              => 'integer',
						'required'          => false,
						'sanitize_callback' => 'absint',
						'default'           => 20,
					),
				),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks/bulk-optimize',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'bulk_optimize' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks/preview',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'preview_block' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/seo-blocks/usage',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'usage' ),
				'permission_callback' => array( __CLASS__, 'manage_permission' ),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/seo-block/context',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'context' ),
				'permission_callback' => array( __CLASS__, 'edit_post_permission' ),
				'args'                => array(
					'post_id' => array(
						'type'              => 'integer',
						'required'          => false,
						'sanitize_callback' => 'absint',
					),
					'element_id' => array(
						'type'              => 'string',
						'required'          => false,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'block_id' => array(
						'type'              => 'integer',
						'required'          => false,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/seo-block/preview',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'preview' ),
				'permission_callback' => array( __CLASS__, 'edit_post_permission' ),
			)
		);

		register_rest_route(
			'neo-pulse/v1',
			'/ai/seo-block/apply',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'apply' ),
				'permission_callback' => array( __CLASS__, 'edit_post_permission' ),
			)
		);
	}

	public static function manage_permission(): bool {
		return current_user_can( 'manage_options' ) || current_user_can( Neo_Pulse_Wp_Admin::required_capability() );
	}

	/**
	 * @param WP_REST_Request $request
	 */
	public static function edit_post_permission( WP_REST_Request $request ): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}
		$post_id = absint( $request->get_param( 'post_id' ) );
		if ( $post_id > 0 ) {
			return current_user_can( 'edit_post', $post_id );
		}
		return current_user_can( 'edit_posts' ) || self::manage_permission();
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function list_blocks( WP_REST_Request $request ) {
		unset( $request );
		return rest_ensure_response(
			array(
				'blocks' => Neo_Pulse_Wp_Seo_Blocks_Storage::list_all(),
			)
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_block( WP_REST_Request $request ) {
		$id  = absint( $request->get_param( 'id' ) );
		$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $id );
		if ( ! is_array( $row ) ) {
			return new WP_Error( 'neo-pulse_seo_block_missing', __( 'SEO block not found.', 'neo-pulse-wp' ), array( 'status' => 404 ) );
		}
		return rest_ensure_response(
			array(
				'block' => Neo_Pulse_Wp_Seo_Blocks_Storage::format_block_response( $row ),
			)
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_draft( WP_REST_Request $request ) {
		unset( $request );
		$result = Neo_Pulse_Wp_Seo_Blocks_Storage::create_draft();
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( array( 'block' => $result ) );
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function block_choices( WP_REST_Request $request ) {
		unset( $request );
		return rest_ensure_response(
			array(
				'choices' => Neo_Pulse_Wp_Seo_Blocks_Storage::get_registry_choices(),
				'blocks'  => Neo_Pulse_Wp_Seo_Blocks_Storage::list_all(),
			)
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function save_block( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = $request->get_params();
		}
		$result = Neo_Pulse_Wp_Seo_Blocks_Storage::save( is_array( $params ) ? $params : array() );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( array( 'block' => $result ) );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_block( WP_REST_Request $request ) {
		$id = absint( $request->get_param( 'id' ) );
		$result = Neo_Pulse_Wp_Seo_Blocks_Storage::delete( $id, ! empty( $request->get_param( 'trash_library' ) ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( array( 'success' => true ) );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function sync_library( WP_REST_Request $request ) {
		$id  = absint( $request->get_param( 'id' ) );
		$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $id );
		if ( ! is_array( $row ) ) {
			return new WP_Error( 'neo-pulse_seo_block_missing', __( 'SEO block not found.', 'neo-pulse-wp' ), array( 'status' => 404 ) );
		}
		$result = Neo_Pulse_Wp_Seo_Blocks_Library::sync_row( $row );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( array( 'block' => Neo_Pulse_Wp_Seo_Blocks_Storage::get( $id ) ) );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function duplicate_block( WP_REST_Request $request ) {
		$id     = absint( $request->get_param( 'id' ) );
		$result = Neo_Pulse_Wp_Seo_Blocks_Storage::duplicate_block( $id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( array( 'block' => $result ) );
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function page_search( WP_REST_Request $request ) {
		$search   = sanitize_text_field( (string) $request->get_param( 'search' ) );
		$per_page = max( 1, min( 50, absint( $request->get_param( 'per_page' ) ?: 20 ) ) );
		$types    = Neo_Pulse_Wp_Seo_Blocks_Storage::allowed_primary_post_types();

		$query = new WP_Query(
			array(
				'post_type'              => $types,
				'post_status'            => array( 'publish', 'draft', 'pending', 'private', 'future' ),
				's'                      => $search,
				'posts_per_page'         => $per_page,
				'orderby'                => 'modified',
				'order'                  => 'DESC',
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
			)
		);

		$items = array();
		foreach ( $query->posts as $post ) {
			if ( ! $post instanceof WP_Post ) {
				continue;
			}
			if ( ! current_user_can( 'edit_post', $post->ID ) ) {
				continue;
			}
			$items[] = Neo_Pulse_Wp_Seo_Blocks_Storage::primary_post_summary( (int) $post->ID );
		}

		return rest_ensure_response( array( 'items' => $items ) );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function bulk_optimize( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			return new WP_Error( 'neo-pulse_seo_block_bulk', __( 'Invalid bulk payload.', 'neo-pulse-wp' ), array( 'status' => 400 ) );
		}
		$ids  = isset( $params['ids'] ) && is_array( $params['ids'] ) ? array_map( 'absint', $params['ids'] ) : array();
		$mode = sanitize_key( (string) ( $params['mode'] ?? 'full' ) );
		$apply = ! empty( $params['apply'] );

		$results = array();
		foreach ( $ids as $id ) {
			if ( $id < 1 ) {
				continue;
			}
			$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $id );
			if ( ! is_array( $row ) ) {
				$results[] = array( 'id' => $id, 'success' => false, 'error' => 'not_found' );
				continue;
			}
			$preview = Neo_Pulse_Wp_Seo_Blocks_Optimizer::preview(
				array(
					'post_id'     => Neo_Pulse_Wp_Seo_Blocks_Context::resolve_primary_post_id( 0, $id, $row ),
					'block_id'    => $id,
					'mode'        => $mode,
					'slots'       => $row['slots'] ?? array(),
					'topic_focus' => (string) ( $row['topic_focus'] ?? '' ),
					'focus_keyword' => (string) ( $row['focus_keyword'] ?? '' ),
				)
			);
			if ( is_wp_error( $preview ) ) {
				$results[] = array( 'id' => $id, 'success' => false, 'error' => $preview->get_error_message() );
				continue;
			}
			if ( $apply ) {
				$resolved_post = Neo_Pulse_Wp_Seo_Blocks_Context::resolve_primary_post_id( 0, $id, $row );
				$applied = Neo_Pulse_Wp_Seo_Blocks_Optimizer::apply(
					array(
						'post_id'       => $resolved_post,
						'block_id'      => $id,
						'preview_slots' => $preview['preview_slots'] ?? array(),
						'topic_focus'   => (string) ( $preview['topic_focus'] ?? '' ),
						'focus_keyword' => (string) ( $preview['focus_keyword'] ?? '' ),
					)
				);
				if ( is_wp_error( $applied ) ) {
					$results[] = array( 'id' => $id, 'success' => false, 'error' => $applied->get_error_message() );
					continue;
				}
			}
			$results[] = array(
				'id'            => $id,
				'success'       => true,
				'preview_slots' => $preview['preview_slots'] ?? array(),
				'applied'       => $apply,
			);
		}

		return rest_ensure_response( array( 'results' => $results ) );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function preview_block( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			return new WP_Error( 'neo-pulse_seo_block_preview', __( 'Invalid preview payload.', 'neo-pulse-wp' ), array( 'status' => 400 ) );
		}

		$slots = isset( $params['slots'] ) && is_array( $params['slots'] ) ? Neo_Pulse_Wp_Seo_Blocks_Slots::normalize_list( $params['slots'] ) : array();
		$slots = Neo_Pulse_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots );
		$layout = isset( $params['layout_config'] ) && is_array( $params['layout_config'] )
			? Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $params['layout_config'], $slots )
			: Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( array(), $slots );

		$html = Neo_Pulse_Wp_Seo_Blocks_Slots::render_html( $slots, $layout );

		return rest_ensure_response(
			array(
				'html'          => $html,
				'slot_summary'  => Neo_Pulse_Wp_Seo_Blocks_Slots::summary( $slots ),
				'layout_config' => $layout,
			)
		);
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function usage( WP_REST_Request $request ) {
		unset( $request );
		return rest_ensure_response(
			array(
				'usage' => Neo_Pulse_Wp_Seo_Blocks_Usage::scan_all(),
			)
		);
	}

	/**
	 * @return WP_REST_Response
	 */
	public static function context( WP_REST_Request $request ) {
		$ctx = Neo_Pulse_Wp_Seo_Blocks_Context::build(
			array(
				'post_id'    => absint( $request->get_param( 'post_id' ) ),
				'element_id' => sanitize_text_field( (string) $request->get_param( 'element_id' ) ),
				'block_id'   => absint( $request->get_param( 'block_id' ) ),
			)
		);
		return rest_ensure_response( $ctx );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function preview( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			return new WP_Error( 'neo-pulse_seo_block_preview', __( 'Invalid preview payload.', 'neo-pulse-wp' ), array( 'status' => 400 ) );
		}
		$result = Neo_Pulse_Wp_Seo_Blocks_Optimizer::preview( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( $result );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function apply( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			return new WP_Error( 'neo-pulse_seo_block_apply', __( 'Invalid apply payload.', 'neo-pulse-wp' ), array( 'status' => 400 ) );
		}
		$result = Neo_Pulse_Wp_Seo_Blocks_Optimizer::apply( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( $result );
	}
}
