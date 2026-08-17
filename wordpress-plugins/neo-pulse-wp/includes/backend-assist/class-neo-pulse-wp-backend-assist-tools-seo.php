<?php
/**
 * Backend Assist — SEO block Agent Hub tool handlers
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Tools_Seo {

	public static function tool_modify_seo_block_slots( array $params ): array {
		$block = self::resolve_seo_block_manifest( $params );
		if ( ! is_array( $block ) ) {
			return array(
				'success' => false,
				'error'   => __( 'No SEO block found. Open a block in Agent Hub or provide block_id.', 'neo-pulse-wp' ),
			);
		}

		$action = sanitize_key( (string) ( $params['action'] ?? 'add' ) );
		$target = $params['target'] ?? ( $params['slot_id'] ?? ( $params['heading'] ?? '' ) );

		if ( $action === 'remove' ) {
			$result = Neo_Pulse_Wp_Seo_Blocks_Mutation::remove_slot( $block, $target );
		} elseif ( $action === 'update' ) {
			$patch = isset( $params['slot'] ) && is_array( $params['slot'] ) ? $params['slot'] : array();
			if ( empty( $patch ) && isset( $params['patch'] ) && is_array( $params['patch'] ) ) {
				$patch = $params['patch'];
			}
			$result = Neo_Pulse_Wp_Seo_Blocks_Mutation::update_slot( $block, $target, $patch );
		} else {
			$slot = isset( $params['slot'] ) && is_array( $params['slot'] ) ? $params['slot'] : array();
			if ( empty( $slot['type'] ) ) {
				$slot['type'] = 'h2';
			}
			$placement = isset( $params['placement'] ) && is_array( $params['placement'] ) ? $params['placement'] : null;
			$result    = Neo_Pulse_Wp_Seo_Blocks_Mutation::add_slot( $block, $slot, $placement );
		}

		if ( is_wp_error( $result ) ) {
			return array(
				'success' => false,
				'error'   => $result->get_error_message(),
			);
		}

		if ( ! class_exists( 'Neo_Pulse_Wp_Seo_Blocks_Agent', false ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-agent.php';
		}

		$manifest = Neo_Pulse_Wp_Seo_Blocks_Agent::normalize_manifest_public( $result );

		return array(
			'success'        => true,
			'block_manifest' => $manifest,
			'summary'        => sprintf(
				/* translators: %s: action name */
				__( 'SEO block updated (%s slot). Apply to builder or save when ready.', 'neo-pulse-wp' ),
				$action
			),
		);
	}
	public static function tool_list_seo_blocks( array $params ): array {
		unset( $params );
		$blocks = Neo_Pulse_Wp_Seo_Blocks_Storage::list_all();
		$items  = array();
		foreach ( $blocks as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$items[] = array(
				'id'            => absint( $row['id'] ?? 0 ),
				'title'         => (string) ( $row['title'] ?? '' ),
				'focus_keyword' => (string) ( $row['focus_keyword'] ?? '' ),
				'status'        => (string) ( $row['status'] ?? '' ),
			);
		}
		return array(
			'success' => true,
			'blocks'  => $items,
			'count'   => count( $items ),
			'summary' => sprintf(
				/* translators: %d: block count */
				_n( '%d SEO block found.', '%d SEO blocks found.', count( $items ), 'neo-pulse-wp' ),
				count( $items )
			),
		);
	}
	public static function tool_create_seo_block( array $params ): array {
		$title = isset( $params['title'] ) ? sanitize_text_field( (string) $params['title'] ) : '';
		$fk    = isset( $params['focus_keyword'] ) ? sanitize_text_field( (string) $params['focus_keyword'] ) : '';
		if ( $title === '' && $fk !== '' ) {
			$title = $fk;
		}
		if ( $title === '' ) {
			return array( 'success' => false, 'error' => __( 'Title or focus keyword is required.', 'neo-pulse-wp' ) );
		}

		$result = Neo_Pulse_Wp_Seo_Blocks_Storage::save(
			array(
				'title'         => $title,
				'focus_keyword' => $fk,
				'status'        => 'draft',
				'slots'         => array(),
			)
		);
		if ( is_wp_error( $result ) ) {
			return array( 'success' => false, 'error' => $result->get_error_message() );
		}

		$id = absint( $result['id'] ?? 0 );
		return array(
			'success'  => true,
			'block_id' => $id,
			'title'    => $title,
			'summary'  => sprintf( __( 'Created draft SEO block "%s".', 'neo-pulse-wp' ), $title ),
			'edit_url' => admin_url( 'admin.php?page=neo-pulse-wp-agent-hub-edit&block_id=' . $id ),
		);
	}
	public static function tool_delete_seo_block( array $params ): array {
		$id = absint( $params['block_id'] ?? $params['id'] ?? 0 );
		if ( $id < 1 ) {
			return array( 'success' => false, 'error' => __( 'block_id is required.', 'neo-pulse-wp' ) );
		}

		$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $id );
		if ( ! is_array( $row ) ) {
			return array( 'success' => false, 'error' => __( 'SEO block not found.', 'neo-pulse-wp' ) );
		}

		$deleted = Neo_Pulse_Wp_Seo_Blocks_Storage::delete( $id, ! empty( $params['trash_library'] ) );
		if ( is_wp_error( $deleted ) ) {
			return array( 'success' => false, 'error' => $deleted->get_error_message() );
		}

		return array(
			'success'  => true,
			'block_id' => $id,
			'title'    => (string) ( $row['title'] ?? '' ),
			'summary'  => sprintf( __( 'Deleted SEO block "%s".', 'neo-pulse-wp' ), (string) ( $row['title'] ?? $id ) ),
		);
	}
	public static function tool_save_seo_block( array $params ): array {
		$payload = array();
		if ( ! empty( $params['block_manifest'] ) && is_array( $params['block_manifest'] ) ) {
			$payload = $params['block_manifest'];
		} elseif ( ! empty( $params['current_block'] ) && is_array( $params['current_block'] ) ) {
			$payload = $params['current_block'];
		} else {
			$resolved = self::resolve_seo_block_manifest( $params );
			if ( is_array( $resolved ) ) {
				$payload = $resolved;
			}
		}

		if ( empty( $payload ) ) {
			return array( 'success' => false, 'error' => __( 'No block manifest to save.', 'neo-pulse-wp' ) );
		}

		$result = Neo_Pulse_Wp_Seo_Blocks_Storage::save( $payload );
		if ( is_wp_error( $result ) ) {
			return array( 'success' => false, 'error' => $result->get_error_message() );
		}

		return array(
			'success'        => true,
			'block_id'       => absint( $result['id'] ?? 0 ),
			'block_manifest' => $result,
			'summary'        => sprintf( __( 'Saved SEO block "%s".', 'neo-pulse-wp' ), (string) ( $result['title'] ?? '' ) ),
			'edit_url'       => admin_url( 'admin.php?page=neo-pulse-wp-agent-hub-edit&block_id=' . absint( $result['id'] ?? 0 ) ),
		);
	}
	public static function tool_apply_seo_block_to_page( array $params ): array {
		$post_id  = absint( $params['post_id'] ?? 0 );
		$block_id = absint( $params['block_id'] ?? $params['id'] ?? 0 );

		if ( $post_id < 1 ) {
			return array( 'success' => false, 'error' => __( 'post_id is required.', 'neo-pulse-wp' ) );
		}
		if ( $block_id < 1 ) {
			return array( 'success' => false, 'error' => __( 'block_id is required.', 'neo-pulse-wp' ) );
		}

		if ( ! class_exists( 'Neo_Pulse_Wp_Seo_Blocks_Page_Insert', false ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-page-insert.php';
		}

		$mode = isset( $params['mode'] ) ? sanitize_key( (string) $params['mode'] ) : 'append';
		if ( ! in_array( $mode, array( 'append', 'replace' ), true ) ) {
			$mode = 'append';
		}

		$result = Neo_Pulse_Wp_Seo_Blocks_Page_Insert::insert_registry_widget(
			$post_id,
			$block_id,
			array(
				'mode'                    => $mode,
				'sync_library'            => ! isset( $params['sync_library'] ) || ! empty( $params['sync_library'] ),
				'include_dynamic_heading' => ! isset( $params['include_dynamic_heading'] ) || ! empty( $params['include_dynamic_heading'] ),
			)
		);

		if ( is_wp_error( $result ) ) {
			return array( 'success' => false, 'error' => $result->get_error_message() );
		}

		return $result;
	}
	public static function resolve_seo_block_manifest( array $params ): ?array {
		if (
			is_array( Neo_Pulse_Wp_Backend_Assist_Context::$builder_context )
			&& ! empty( Neo_Pulse_Wp_Backend_Assist_Context::$builder_context['block'] )
			&& is_array( Neo_Pulse_Wp_Backend_Assist_Context::$builder_context['block'] )
		) {
			return Neo_Pulse_Wp_Backend_Assist_Context::$builder_context['block'];
		}
		if ( ! empty( $params['block_manifest'] ) && is_array( $params['block_manifest'] ) ) {
			return $params['block_manifest'];
		}
		if ( ! empty( $params['current_block'] ) && is_array( $params['current_block'] ) ) {
			return $params['current_block'];
		}
		$id = absint( $params['block_id'] ?? $params['id'] ?? 0 );
		if ( $id > 0 ) {
			$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $id );
			return is_array( $row ) ? $row : null;
		}
		return null;
	}
}
