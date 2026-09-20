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

	public static function tool_get_seo_block( array $params ): array {
		$row = self::resolve_block_row( $params );
		if ( ! is_array( $row ) ) {
			return array(
				'success' => false,
				'error'   => __( 'SEO block not found. Provide block_id or an exact Agent Hub title.', 'neo-pulse-wp' ),
			);
		}

		$id = absint( $row['id'] ?? 0 );
		return array(
			'success'        => true,
			'block_id'       => $id,
			'title'          => (string) ( $row['title'] ?? '' ),
			'focus_keyword'  => (string) ( $row['focus_keyword'] ?? '' ),
			'status'         => (string) ( $row['status'] ?? '' ),
			'slots'          => isset( $row['slots'] ) && is_array( $row['slots'] ) ? $row['slots'] : array(),
			'layout_config'  => isset( $row['layout_config'] ) && is_array( $row['layout_config'] ) ? $row['layout_config'] : array(),
			'block_manifest' => $row,
			'summary'        => sprintf( __( 'Loaded SEO block "%s".', 'neo-pulse-wp' ), (string) ( $row['title'] ?? $id ) ),
			'edit_url'       => admin_url( 'admin.php?page=neo-pulse-wp-agent-hub-edit&block_id=' . $id ),
		);
	}

	public static function tool_duplicate_seo_block( array $params ): array {
		$source = self::resolve_block_row( $params );
		if ( ! is_array( $source ) ) {
			return array(
				'success' => false,
				'error'   => __( 'SEO block template not found. Provide block_id or an exact Agent Hub title.', 'neo-pulse-wp' ),
			);
		}

		$source_id = absint( $source['id'] ?? 0 );
		if ( $source_id < 1 ) {
			return array( 'success' => false, 'error' => __( 'block_id is required to duplicate.', 'neo-pulse-wp' ) );
		}

		$result = Neo_Pulse_Wp_Seo_Blocks_Storage::duplicate_block( $source_id );
		if ( is_wp_error( $result ) ) {
			return array( 'success' => false, 'error' => $result->get_error_message() );
		}

		$user_copy = isset( $params['user_copy'] ) ? trim( (string) $params['user_copy'] ) : '';
		if ( $user_copy !== '' ) {
			if ( ! class_exists( 'Neo_Pulse_Wp_Seo_Blocks_Agent', false ) ) {
				require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-agent.php';
			}
			$filled = Neo_Pulse_Wp_Seo_Blocks_Agent::fill_slots_from_user_copy( $result, $user_copy );
			if ( is_wp_error( $filled ) ) {
				return array( 'success' => false, 'error' => $filled->get_error_message() );
			}
			$saved = Neo_Pulse_Wp_Seo_Blocks_Storage::save( $filled );
			if ( is_wp_error( $saved ) ) {
				return array( 'success' => false, 'error' => $saved->get_error_message() );
			}
			$result = $saved;
		}

		$id = absint( $result['id'] ?? 0 );
		return array(
			'success'        => true,
			'block_id'       => $id,
			'source_block_id'=> $source_id,
			'title'          => (string) ( $result['title'] ?? '' ),
			'block_manifest' => $result,
			'summary'        => sprintf( __( 'Created SEO block "%s" from template.', 'neo-pulse-wp' ), (string) ( $result['title'] ?? $id ) ),
			'edit_url'       => admin_url( 'admin.php?page=neo-pulse-wp-agent-hub-edit&block_id=' . $id ),
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
			return array( 'success' => false, 'error' => __( 'block_id is required. Create or duplicate an Agent Hub SEO block first.', 'neo-pulse-wp' ) );
		}

		$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $block_id );
		if ( ! is_array( $row ) ) {
			return array( 'success' => false, 'error' => __( 'SEO block not found. Create or duplicate an Agent Hub block before apply.', 'neo-pulse-wp' ) );
		}
		$slots = isset( $row['slots'] ) && is_array( $row['slots'] ) ? $row['slots'] : array();
		if ( empty( $slots ) ) {
			return array( 'success' => false, 'error' => __( 'SEO block has no slots. Compose and save a block, or duplicate a template, before apply.', 'neo-pulse-wp' ) );
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
			return array(
				'success' => false,
				'post_id' => $post_id,
				'error'   => sprintf(
					/* translators: 1: page id, 2: error message */
					__( 'Apply failed on page %1$d: %2$s', 'neo-pulse-wp' ),
					$post_id,
					$result->get_error_message()
				),
			);
		}

		return $result;
	}

	public static function tool_design_page_with_novamira( array $params ): array {
		if ( ! class_exists( 'Neo_Pulse_Wp_Backend_Assist_Novamira_Page', false ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-novamira-page.php';
		}
		$post_id = absint( $params['post_id'] ?? 0 );
		if ( $post_id < 1 ) {
			return array( 'success' => false, 'error' => __( 'post_id is required.', 'neo-pulse-wp' ) );
		}
		if ( ! empty( $params['sync'] ) || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
			return Neo_Pulse_Wp_Backend_Assist_Novamira_Page::design( $params );
		}
		$job_key = 'neo_pulse_novamira_design_' . $post_id;
		update_option(
			$job_key,
			array(
				'state'   => 'running',
				'started' => time(),
				'post_id' => $post_id,
			),
			false
		);
		$queued = Neo_Pulse_Wp_Backend_Assist_Novamira_Page::queue_design_cron( $post_id, $job_key );
		if ( is_wp_error( $queued ) ) {
			return array( 'success' => false, 'post_id' => $post_id, 'error' => $queued->get_error_message() );
		}
		$deadline = time() + 50;
		while ( time() < $deadline ) {
			sleep( 2 );
			$job = get_option( $job_key );
			if ( ! is_array( $job ) ) {
				continue;
			}
			$state = (string) ( $job['state'] ?? '' );
			if ( $state === 'done' && ! empty( $job['success'] ) ) {
				delete_option( $job_key );
				return $job;
			}
			if ( $state === 'error' ) {
				delete_option( $job_key );
				return $job;
			}
		}
		return array(
			'success' => false,
			'post_id' => $post_id,
			'queued'  => true,
			'error'   => __( 'Novamira design is still running in the background. Reload the page in about a minute.', 'neo-pulse-wp' ),
		);
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
		return self::resolve_block_row( $params );
	}

	/**
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>|null
	 */
	public static function resolve_block_row( array $params ): ?array {
		$id = absint( $params['block_id'] ?? $params['id'] ?? 0 );
		if ( $id > 0 ) {
			$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $id );
			return is_array( $row ) ? $row : null;
		}

		$title = sanitize_text_field( (string) ( $params['title'] ?? $params['block_title'] ?? '' ) );
		if ( $title !== '' ) {
			$matches = array();
			foreach ( Neo_Pulse_Wp_Seo_Blocks_Storage::list_all() as $row ) {
				if ( ! is_array( $row ) ) {
					continue;
				}
				if ( strcasecmp( (string) ( $row['title'] ?? '' ), $title ) === 0 ) {
					$matches[] = $row;
				}
			}
			if ( count( $matches ) === 1 ) {
				return $matches[0];
			}
			return null;
		}

		if (
			is_array( Neo_Pulse_Wp_Backend_Assist_Context::$builder_context )
			&& ! empty( Neo_Pulse_Wp_Backend_Assist_Context::$builder_context['block'] )
			&& is_array( Neo_Pulse_Wp_Backend_Assist_Context::$builder_context['block'] )
		) {
			return Neo_Pulse_Wp_Backend_Assist_Context::$builder_context['block'];
		}

		return null;
	}

	/**
	 * @param array<string,mixed> $source
	 * @return array<string,mixed>
	 */
}
