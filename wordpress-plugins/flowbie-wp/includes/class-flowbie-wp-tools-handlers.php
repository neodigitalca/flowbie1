<?php
/**
 * Tool handler implementations for Flowbie_Wp_Tools.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Tools_Handlers {

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_ping( array $params ): array {
		return array(
			'ok'      => true,
			'name'    => 'Flowbie WP',
			'version' => FLOWBIE_WP_VERSION,
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_whoami( array $params ) {
		$user = wp_get_current_user();
		return array(
			'ok'       => true,
			'id'       => (int) $user->ID,
			'username' => $user->user_login,
			'roles'    => $user->roles,
			'caps'     => array(
				'edit_posts'      => current_user_can( 'edit_posts' ),
				'manage_options'  => current_user_can( 'manage_options' ),
				'publish_posts'   => current_user_can( 'publish_posts' ),
			),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_site_dashboard( array $params ): array {
		$rs = Flowbie_Wp_Api::fetch_plugin_dashboard_state();
		return array( 'ok' => ! empty( $rs['ok'] ), 'dashboard' => $rs );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_site_index( array $params ): array {
		$include_drafts = ! empty( $params['include_drafts'] );
		$limit          = isset( $params['limit'] ) ? max( 1, min( 500, (int) $params['limit'] ) ) : 500;
		$index          = Flowbie_Wp_Chat_Rag::get_agent_site_index( $include_drafts );
		return array( 'ok' => true, 'count' => count( $index ), 'items' => array_slice( $index, 0, $limit ) );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_site_index_search( array $params ): array {
		$query = isset( $params['query'] ) ? (string) $params['query'] : '';
		$limit = isset( $params['limit'] ) ? max( 1, min( 50, (int) $params['limit'] ) ) : 8;
		$items = Flowbie_Wp_Chat_Rag::retrieve_agent( $query, $limit );
		return array( 'ok' => true, 'query' => $query, 'items' => $items );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_openrouter_status( array $params ): array {
		return array(
			'ok'        => true,
			'configured' => Flowbie_Wp_OpenRouter::get_api_key() !== '',
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_chat_settings_get( array $params ): array {
		$settings = Flowbie_Wp_Chat::get_settings();
		return array(
			'ok'             => true,
			'enabled'        => ! empty( $settings['enabled'] ),
			'logged_in_only' => ! empty( $settings['logged_in_only'] ),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_chat_settings_update( array $params ) {
		$patch = array();
		if ( array_key_exists( 'enabled', $params ) ) {
			$patch['enabled'] = ! empty( $params['enabled'] );
		}
		if ( array_key_exists( 'logged_in_only', $params ) ) {
			$patch['logged_in_only'] = ! empty( $params['logged_in_only'] );
		}
		if ( empty( $patch ) ) {
			return new WP_Error( 'flowbie_chat_settings', __( 'No settings to update.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		Flowbie_Wp_Chat::save_settings( $patch );
		$settings = Flowbie_Wp_Chat::get_settings();
		return array(
			'ok'             => true,
			'enabled'        => ! empty( $settings['enabled'] ),
			'logged_in_only' => ! empty( $settings['logged_in_only'] ),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_list_posts( array $params ): array {
		$result = Flowbie_Wp_Backend_Assist::tool_list_posts( $params );
		return array_merge( array( 'ok' => ! empty( $result['success'] ) ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_get_post( array $params ): array {
		$result = Flowbie_Wp_Backend_Assist::tool_get_post( $params );
		return array_merge( array( 'ok' => ! empty( $result['success'] ) ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_get_post_content( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$req = new WP_REST_Request( 'GET', '/flowbie/v1/post-content/' . $post_id );
		$req->set_url_params( array( 'id' => $post_id ) );
		$res = Flowbie_Wp_Rest::get_post_content( $req );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		return array( 'ok' => true, 'post' => $res->get_data() );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_create_post( array $params ): array {
		$result = Flowbie_Wp_Backend_Assist::tool_create_post( $params );
		return array_merge( array( 'ok' => ! empty( $result['success'] ) ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_create_page( array $params ): array {
		$result = Flowbie_Wp_Backend_Assist::tool_create_page( $params );
		return array_merge( array( 'ok' => ! empty( $result['success'] ) ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_update_post( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$update = array( 'ID' => $post_id );
		if ( isset( $params['title'] ) ) {
			$update['post_title'] = sanitize_text_field( (string) $params['title'] );
		}
		if ( isset( $params['status'] ) ) {
			$update['post_status'] = sanitize_key( (string) $params['status'] );
		}
		if ( isset( $params['excerpt'] ) ) {
			$update['post_excerpt'] = sanitize_textarea_field( (string) $params['excerpt'] );
		}
		if ( isset( $params['slug'] ) ) {
			$update['post_name'] = sanitize_title( (string) $params['slug'] );
		}
		$rs = wp_update_post( $update, true );
		if ( is_wp_error( $rs ) ) {
			return $rs;
		}
		return array( 'ok' => true, 'post_id' => $post_id );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_add_content( array $params ): array {
		$result = Flowbie_Wp_Backend_Assist::tool_add_content( $params );
		return array_merge( array( 'ok' => ! empty( $result['success'] ) ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_replace_content( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$content = isset( $params['content'] ) ? (string) $params['content'] : '';
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		self::maybe_snapshot_revision( $post_id );
		$rs = wp_update_post(
			array(
				'ID'           => $post_id,
				'post_content' => $content,
			),
			true
		);
		if ( is_wp_error( $rs ) ) {
			return $rs;
		}
		return array( 'ok' => true, 'post_id' => $post_id );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_delete_post( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$force   = ! empty( $params['force'] );
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$rs = $force ? wp_delete_post( $post_id, true ) : wp_trash_post( $post_id );
		if ( ! $rs ) {
			return new WP_Error( 'flowbie_tools', __( 'Delete failed.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		return array( 'ok' => true, 'post_id' => $post_id, 'force' => $force );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_resolve_url( array $params ) {
		$url = isset( $params['url'] ) ? (string) $params['url'] : '';
		if ( $url === '' ) {
			return new WP_Error( 'flowbie_tools', __( 'url is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$post_id = url_to_postid( $url );
		if ( $post_id < 1 ) {
			$path = wp_parse_url( $url, PHP_URL_PATH );
			if ( is_string( $path ) && $path !== '' ) {
				$posts = get_posts(
					array(
						'name'           => basename( untrailingslashit( $path ) ),
						'post_type'      => 'any',
						'post_status'    => 'any',
						'posts_per_page' => 1,
					)
				);
				if ( ! empty( $posts[0] ) ) {
					$post_id = (int) $posts[0]->ID;
				}
			}
		}
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'No post found for URL.', 'flowbie-wp' ), array( 'status' => 404 ) );
		}
		return array( 'ok' => true, 'post_id' => $post_id, 'url' => get_permalink( $post_id ) );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_fields_list_groups( array $params ): array {
		$groups = Flowbie_Wp_Fields_Storage::get_all_groups( false );
		$out    = array();
		foreach ( $groups as $g ) {
			$out[] = array(
				'key'   => $g['key'] ?? '',
				'title' => $g['title'] ?? '',
			);
		}
		return array( 'ok' => true, 'groups' => $out );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_fields_get( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		if ( ! empty( $params['field'] ) ) {
			$val = Flowbie_Wp_Fields_Api::get_field( sanitize_key( (string) $params['field'] ), $post_id );
			return array( 'ok' => true, 'field' => $params['field'], 'value' => $val );
		}
		return array( 'ok' => true, 'fields' => Flowbie_Wp_Fields_Api::get_fields( $post_id ) );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_fields_update( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$field   = isset( $params['field'] ) ? sanitize_key( (string) $params['field'] ) : '';
		if ( $post_id < 1 || $field === '' ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id and field are required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$value = isset( $params['value'] ) ? $params['value'] : '';
		$ok    = Flowbie_Wp_Fields_Api::update_field( $field, $value, $post_id );
		return array( 'ok' => (bool) $ok, 'post_id' => $post_id, 'field' => $field );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_fields_get_object( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$field   = isset( $params['field'] ) ? sanitize_key( (string) $params['field'] ) : '';
		if ( $field === '' ) {
			return new WP_Error( 'flowbie_tools', __( 'field is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$obj = Flowbie_Wp_Fields_Api::get_field_object( $field, $post_id );
		return array( 'ok' => true, 'object' => $obj );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_fields_export_json( array $params ): array {
		$keys = isset( $params['keys'] ) && is_array( $params['keys'] ) ? array_map( 'sanitize_key', $params['keys'] ) : array();
		$json = Flowbie_Wp_Fields_Import_Export::export_json_string( $keys );
		return array( 'ok' => true, 'json' => $json );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_fields_import_json( array $params ): array {
		$json = '';
		if ( ! empty( $params['json'] ) && is_string( $params['json'] ) ) {
			$json = $params['json'];
		} elseif ( ! empty( $params['file_path'] ) && is_string( $params['file_path'] ) && is_readable( $params['file_path'] ) ) {
			$contents = file_get_contents( $params['file_path'] );
			$json     = is_string( $contents ) ? $contents : '';
		}
		$delete_missing = ! empty( $params['delete_missing'] );
		$result         = Flowbie_Wp_Fields_Import_Export::import_json_string( $json, $delete_missing );
		return array_merge( array( 'ok' => ! empty( $result['success'] ) ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_ai_status( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		return array( 'ok' => true, 'status' => Flowbie_Wp_Ai_Gate::get_status( $post_id ) );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_ai_preview_field( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$field   = isset( $params['field'] ) ? sanitize_key( (string) $params['field'] ) : '';
		if ( $post_id < 1 || $field === '' ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id and field are required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$overrides = isset( $params['context'] ) && is_array( $params['context'] ) ? $params['context'] : array();
		$result    = Flowbie_Wp_Ai_Enhance::preview( $post_id, $field, $overrides );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array_merge( array( 'ok' => true ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_ai_apply_field( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$field   = isset( $params['field'] ) ? sanitize_key( (string) $params['field'] ) : '';
		$value   = isset( $params['value'] ) ? (string) $params['value'] : '';
		if ( $post_id < 1 || $field === '' ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id and field are required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$result = Flowbie_Wp_Ai_Apply::apply( $post_id, $field, $value );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array_merge( array( 'ok' => true ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_ai_save_meta( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$fields = array();
		foreach ( array( 'seoTitle', 'metaDescription', 'focusKeyword', 'seoResearch', 'faq', 'pageUrl' ) as $key ) {
			if ( array_key_exists( $key, $params ) ) {
				$fields[ $key ] = (string) $params[ $key ];
			}
		}
		$result = Flowbie_Wp_Ai_Apply::save_meta( $post_id, $fields );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array_merge( array( 'ok' => true ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_ai_gsc_suggestions( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$focus   = isset( $params['focus_keyword'] ) ? sanitize_text_field( (string) $params['focus_keyword'] ) : '';
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$result = Flowbie_Wp_Ai_Gsc::get_suggestions( $post_id, $focus );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array_merge( array( 'ok' => true ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_ai_seo_research_brief( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$focus   = isset( $params['focusKeyword'] ) ? sanitize_text_field( (string) $params['focusKeyword'] ) : '';
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$result = Flowbie_Wp_Ai_Seo_Research::build_brief( $post_id, $focus );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array_merge( array( 'ok' => true ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_ai_optimize_meta_bundle( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		$apply   = ! isset( $params['apply'] ) || ! empty( $params['apply'] );
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$result = Flowbie_Wp_Ai_Meta::run_optimize_meta( $post_id, isset( $params['primary_keyword'] ) ? (string) $params['primary_keyword'] : null );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		if ( $apply && ! empty( $result['optimizedMeta'] ) && is_array( $result['optimizedMeta'] ) ) {
			$om = $result['optimizedMeta'];
			$fields = array();
			if ( ! empty( $om['rank_math_title'] ) ) {
				$fields['seoTitle'] = (string) $om['rank_math_title'];
			}
			if ( ! empty( $om['rank_math_description'] ) ) {
				$fields['metaDescription'] = (string) $om['rank_math_description'];
			}
			if ( ! empty( $om['rank_math_focus_keyword'] ) ) {
				$fields['focusKeyword'] = (string) $om['rank_math_focus_keyword'];
			}
			if ( ! empty( $fields ) ) {
				Flowbie_Wp_Ai_Apply::save_meta( $post_id, $fields );
			}
		}
		return array_merge( array( 'ok' => true, 'applied' => $apply ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_ai_lint_post( array $params ) {
		$post_id = isset( $params['post_id'] ) ? (int) $params['post_id'] : 0;
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$issues   = array();
		$focus    = Flowbie_Wp_Ai_Context::read_focus_keyword( $post_id );
		$research = Flowbie_Wp_Ai_Context::read_field_value( $post_id, 'seo_research' );
		if ( $focus === '' ) {
			$issues[] = 'missing_focus_keyword';
		}
		if ( $research === '' ) {
			$issues[] = 'missing_seo_research';
		}
		$gate = Flowbie_Wp_Ai_Gate::collect_reasons( $post_id );
		return array(
			'ok'     => true,
			'issues' => $issues,
			'gate'   => $gate,
			'ai'     => Flowbie_Wp_Ai_Gate::get_status( $post_id ),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_body_sections( array $params ) {
		$req = new WP_REST_Request( 'GET', '/flowbie/v1/ai/body/sections' );
		$req->set_param( 'post_id', (int) ( $params['post_id'] ?? 0 ) );
		$res = Flowbie_Wp_Ai_Body_Rest::sections_from_post( $req );
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_body_posts_inventory( array $params ) {
		$req = new WP_REST_Request( 'GET', '/flowbie/v1/ai/body/posts-inventory' );
		$req->set_param( 'post_id', (int) ( $params['post_id'] ?? 0 ) );
		$res = Flowbie_Wp_Ai_Body_Rest::posts_inventory( $req );
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_body_plan( array $params ) {
		$post_id = (int) ( $params['post_id'] ?? 0 );
		$result  = Flowbie_Wp_Ai_Body::plan( $post_id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return is_array( $result ) ? $result : array( 'ok' => true );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_body_session_get( array $params ) {
		$post_id = (int) ( $params['post_id'] ?? 0 );
		$result  = Flowbie_Wp_Ai_Body::get_session( $post_id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return is_array( $result ) ? $result : array( 'ok' => true );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_body_session_delete( array $params ) {
		$post_id = (int) ( $params['post_id'] ?? 0 );
		$result  = Flowbie_Wp_Ai_Body::clear_session( $post_id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return is_array( $result ) ? $result : array( 'ok' => true );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_body_section_preview( array $params ) {
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/ai/body/section/preview' );
		$req->set_body_params( $params );
		$res = Flowbie_Wp_Ai_Body_Rest::section_preview( $req );
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_body_section_apply( array $params ) {
		$post_id = (int) ( $params['post_id'] ?? 0 );
		self::maybe_snapshot_revision( $post_id );
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/ai/body/section/apply' );
		$req->set_body_params( $params );
		$res = Flowbie_Wp_Ai_Body_Rest::section_apply( $req );
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_body_suggest_link( array $params ) {
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/ai/body/suggest-link' );
		$req->set_body_params( $params );
		$res = Flowbie_Wp_Ai_Body_Rest::suggest_link( $req );
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_body_insert_element( array $params ) {
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/ai/body/insert-element' );
		$req->set_body_params( $params );
		$res = Flowbie_Wp_Ai_Body_Rest::insert_element( $req );
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_image_seo_status( array $params ): array {
		return array( 'ok' => true, 'status' => Flowbie_Wp_Image_Seo_Gate::get_status() );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_image_seo_list( array $params ): array {
		$result = Flowbie_Wp_Image_Seo::query_attachments(
			array(
				'page'        => (int) ( $params['page'] ?? 1 ),
				'per_page'    => (int) ( $params['per_page'] ?? 20 ),
				'search'      => (string) ( $params['search'] ?? '' ),
				'missing_alt' => ! empty( $params['missing_alt'] ),
			)
		);
		return array_merge( array( 'ok' => true ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_image_seo_get_attachment( array $params ) {
		$id = (int) ( $params['attachment_id'] ?? $params['id'] ?? 0 );
		if ( $id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'attachment_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		return array( 'ok' => true, 'row' => Flowbie_Wp_Image_Seo::attachment_row( $id ) );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_image_seo_preview( array $params ) {
		$id = (int) ( $params['attachment_id'] ?? 0 );
		$result = Flowbie_Wp_Image_Seo_Ai::preview(
			$id,
			(int) ( $params['post_id'] ?? 0 ),
			! isset( $params['use_ai'] ) || ! empty( $params['use_ai'] )
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array_merge( array( 'ok' => true ), $result );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_image_seo_apply( array $params ) {
		$id     = (int) ( $params['attachment_id'] ?? 0 );
		$values = isset( $params['fields'] ) && is_array( $params['fields'] ) ? $params['fields'] : array();
		if ( empty( $values ) && isset( $params['values'] ) && is_array( $params['values'] ) ) {
			$values = $params['values'];
		}
		$result = Flowbie_Wp_Image_Seo_Ai::apply(
			$id,
			$values,
			isset( $params['overwrite_mode'] ) ? sanitize_key( (string) $params['overwrite_mode'] ) : null,
			isset( $params['field_keys'] ) && is_array( $params['field_keys'] ) ? $params['field_keys'] : null
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array_merge( array( 'ok' => true ), is_array( $result ) ? $result : array() );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_image_seo_bulk( array $params ) {
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/image-seo/bulk' );
		$req->set_body_params( $params );
		$res = Flowbie_Wp_Image_Seo_Rest::bulk( $req );
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_sitemap_get( array $params ): array {
		return Flowbie_Wp_Sitemap::rest_get()->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_sitemap_put( array $params ) {
		$req = new WP_REST_Request( 'PUT', '/flowbie/v1/sitemap' );
		$req->set_body_params( array( 'config' => $params['config'] ?? $params ) );
		$res = Flowbie_Wp_Sitemap::rest_put( $req );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_sitemap_flush( array $params ): array {
		return Flowbie_Wp_Sitemap::rest_flush( new WP_REST_Request( 'POST', '/flowbie/v1/sitemap/flush' ) )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_speed_status( array $params ): array {
		unset( $params );
		return Flowbie_Wp_Speed::tool_status_payload();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_speed_flush( array $params ): array {
		unset( $params );
		return Flowbie_Wp_Speed::tool_flush_payload();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_speed_image_status( array $params ): array {
		unset( $params );
		return Flowbie_Wp_Speed_Image_Rest::rest_status( new WP_REST_Request( 'GET', '/flowbie/v1/speed/images/status' ) )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_speed_image_batch( array $params ) {
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/speed/images/batch' );
		foreach ( array( 'page', 'per_page', 'force' ) as $key ) {
			if ( isset( $params[ $key ] ) ) {
				$req->set_param( $key, $params[ $key ] );
			}
		}
		$response = Flowbie_Wp_Speed_Image_Rest::rest_batch( $req );
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		return $response->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_speed_image_flush_meta( array $params ): array {
		unset( $params );
		Flowbie_Wp_Speed_Image_Optimizer::flush_all_meta();
		return array(
			'ok'      => true,
			'message' => __( 'Image optimization metadata cleared.', 'flowbie-wp' ),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_redirects_list( array $params ): array {
		$req = new WP_REST_Request( 'GET', '/flowbie/v1/redirects' );
		foreach ( array( 'page', 'per_page', 'search', 'status' ) as $k ) {
			if ( isset( $params[ $k ] ) ) {
				$req->set_param( $k, $params[ $k ] );
			}
		}
		return Flowbie_Wp_Redirects_Rest::list_redirects( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_redirects_get( array $params ) {
		$id = (int) ( $params['id'] ?? 0 );
		$req = new WP_REST_Request( 'GET', '/flowbie/v1/redirects/' . $id );
		$req->set_param( 'id', $id );
		$res = Flowbie_Wp_Redirects_Rest::get_redirect( $req );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_redirects_create( array $params ): array {
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/redirects' );
		$req->set_body_params( $params );
		return Flowbie_Wp_Redirects_Rest::create_redirect( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_redirects_update( array $params ): array {
		$id  = (int) ( $params['id'] ?? 0 );
		$req = new WP_REST_Request( 'PUT', '/flowbie/v1/redirects/' . $id );
		$req->set_param( 'id', $id );
		$req->set_body_params( $params );
		return Flowbie_Wp_Redirects_Rest::update_redirect( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_redirects_delete( array $params ): array {
		$id  = (int) ( $params['id'] ?? 0 );
		$req = new WP_REST_Request( 'DELETE', '/flowbie/v1/redirects/' . $id );
		$req->set_param( 'id', $id );
		$req->set_param( 'force', ! empty( $params['force'] ) );
		return Flowbie_Wp_Redirects_Rest::delete_redirect( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_scripts_list( array $params ): array {
		$req = new WP_REST_Request( 'GET', '/flowbie/v1/scripts' );
		foreach ( array( 'page', 'per_page', 'search', 'status', 'category', 'placement' ) as $k ) {
			if ( isset( $params[ $k ] ) ) {
				$req->set_param( $k, $params[ $k ] );
			}
		}
		return Flowbie_Wp_Script_Manager_Rest::list_scripts( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_scripts_get( array $params ) {
		$id  = (int) ( $params['id'] ?? 0 );
		$req = new WP_REST_Request( 'GET', '/flowbie/v1/scripts/' . $id );
		$req->set_param( 'id', $id );
		$res = Flowbie_Wp_Script_Manager_Rest::get_script( $req );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_scripts_create( array $params ): array {
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/scripts' );
		$req->set_body_params( $params );
		return Flowbie_Wp_Script_Manager_Rest::create_script( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_scripts_update( array $params ): array {
		$id  = (int) ( $params['id'] ?? 0 );
		$req = new WP_REST_Request( 'PUT', '/flowbie/v1/scripts/' . $id );
		$req->set_param( 'id', $id );
		$req->set_body_params( $params );
		return Flowbie_Wp_Script_Manager_Rest::update_script( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_scripts_delete( array $params ): array {
		$id  = (int) ( $params['id'] ?? 0 );
		$req = new WP_REST_Request( 'DELETE', '/flowbie/v1/scripts/' . $id );
		$req->set_param( 'id', $id );
		$req->set_param( 'force', ! empty( $params['force'] ) );
		return Flowbie_Wp_Script_Manager_Rest::delete_script( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_gmb_status( array $params ): array {
		return Flowbie_Wp_Gmb_Rest::connection_status()->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_gmb_locations( array $params ): array {
		return array(
			'ok'          => true,
			'configured'  => Flowbie_Wp_Gmb::is_configured(),
			'connected'   => Flowbie_Wp_Gmb::is_connected(),
			'location_id' => Flowbie_Wp_Gmb::get_location_id(),
			'account_id'  => Flowbie_Wp_Gmb::get_account_id(),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_gmb_posts_list( array $params ): array {
		return array(
			'ok'      => true,
			'items'   => array(),
			'message' => __( 'Listing GBP posts requires Google API integration; use wp_gmb_create_post to publish.', 'flowbie-wp' ),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_gmb_create_post( array $params ) {
		$post_id = (int) ( $params['post_id'] ?? 0 );
		$req     = new WP_REST_Request( 'POST', '/flowbie/v1/ai/gmb-post' );
		$req->set_param( 'post_id', $post_id );
		if ( isset( $params['summary'] ) ) {
			$req->set_body_params( array( 'summary' => (string) $params['summary'] ) );
		}
		$res = Flowbie_Wp_Gmb_Rest::create_social_post( $req );
		return $res->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_assist_chat( array $params ): array {
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/backend-assist' );
		$req->set_body_params( $params );
		$res = Flowbie_Wp_Backend_Assist::rest_handle( $req );
		$data = $res->get_data();
		return is_array( $data ) ? array_merge( array( 'ok' => true ), array( 'card' => $data ) ) : array( 'ok' => true );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_assist_workflow_status( array $params ) {
		$workflow_id = isset( $params['workflow_id'] ) ? sanitize_text_field( (string) $params['workflow_id'] ) : '';
		if ( $workflow_id === '' ) {
			return new WP_Error( 'flowbie_tools', __( 'workflow_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$req = new WP_REST_Request( 'GET', '/flowbie/v1/backend-assist/workflow/' . $workflow_id . '/status' );
		$req->set_param( 'workflow_id', $workflow_id );
		return Flowbie_Wp_Backend_Assist::rest_workflow_status( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_assist_workflow_step( array $params ) {
		$req = new WP_REST_Request( 'POST', '/flowbie/v1/backend-assist/step' );
		$req->set_body_params( $params );
		return Flowbie_Wp_Backend_Assist::rest_step_handle( $req )->get_data();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_audit_list( array $params ): array {
		$limit = isset( $params['limit'] ) ? (int) $params['limit'] : 50;
		return array( 'ok' => true, 'entries' => Flowbie_Wp_Tools_Audit::list_recent( $limit ) );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_revision_restore( array $params ) {
		$post_id = (int) ( $params['post_id'] ?? 0 );
		if ( $post_id < 1 ) {
			return new WP_Error( 'flowbie_tools', __( 'post_id is required.', 'flowbie-wp' ), array( 'status' => 400 ) );
		}
		$key = 'flowbie_agent_rev_' . $post_id;
		$rev = get_post_meta( $post_id, $key, true );
		if ( ! is_array( $rev ) || empty( $rev['content'] ) ) {
			return new WP_Error( 'flowbie_tools', __( 'No agent snapshot found for this post.', 'flowbie-wp' ), array( 'status' => 404 ) );
		}
		wp_update_post(
			array(
				'ID'           => $post_id,
				'post_content' => (string) $rev['content'],
			)
		);
		delete_post_meta( $post_id, $key );
		return array( 'ok' => true, 'post_id' => $post_id );
	}

	/**
	 * @param int $post_id Post ID.
	 */
	private static function maybe_snapshot_revision( int $post_id ): void {
		if ( $post_id < 1 ) {
			return;
		}
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return;
		}
		$key = 'flowbie_agent_rev_' . $post_id;
		if ( get_post_meta( $post_id, $key, true ) ) {
			return;
		}
		update_post_meta(
			$post_id,
			$key,
			array(
				'content'   => $post->post_content,
				'saved_at'  => gmdate( 'c' ),
			)
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_super_migrate_plan( array $params ): array {
		unset( $params );
		return Flowbie_Wp_Super_Migrate::get_plan_preview();
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_super_migrate_start( array $params ): array {
		return Flowbie_Wp_Super_Migrate::start_job( $params );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_super_migrate_step( array $params ): array {
		$job_id = isset( $params['job_id'] ) ? sanitize_key( (string) $params['job_id'] ) : '';
		if ( $job_id === '' ) {
			return array(
				'ok'    => false,
				'error' => __( 'job_id is required.', 'flowbie-wp' ),
			);
		}
		return Flowbie_Wp_Super_Migrate::run_step( $job_id, $params );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_super_migrate_status( array $params ): array {
		$job_id = isset( $params['job_id'] ) ? sanitize_key( (string) $params['job_id'] ) : '';
		if ( $job_id === '' ) {
			return array(
				'ok'    => false,
				'error' => __( 'job_id is required.', 'flowbie-wp' ),
			);
		}
		$job = Flowbie_Wp_Super_Migrate::get_status( $job_id );
		if ( null === $job ) {
			return array(
				'ok'    => false,
				'error' => __( 'Job not found.', 'flowbie-wp' ),
			);
		}
		return array(
			'ok'  => true,
			'job' => $job,
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_super_migrate_flo_sheet( array $params ): array {
		unset( $params );
		$sheet = Flowbie_Wp_Flo_Sheet::get();
		$sheet = apply_filters( 'flowbie_wp_flo_sheet_export', $sheet );
		return array(
			'ok'      => true,
			'sheet'   => $sheet,
			'json'    => Flowbie_Wp_Flo_Sheet::to_json( $sheet ),
			'summary' => Flowbie_Wp_Super_Migrate::sheet_summary( $sheet ),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_super_migrate_flo_sheet_import( array $params ): array {
		$json = isset( $params['json'] ) ? (string) $params['json'] : '';
		if ( $json === '' && isset( $params['sheet'] ) && is_array( $params['sheet'] ) ) {
			$json = Flowbie_Wp_Flo_Sheet::to_json( $params['sheet'] );
		}
		if ( $json === '' ) {
			return array(
				'ok'    => false,
				'error' => __( 'Flo Sheet JSON is required.', 'flowbie-wp' ),
			);
		}
		return Flowbie_Wp_Super_Migrate::import_flo_sheet( $json, ! empty( $params['dry_run'] ) );
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_seo_blocks_list( array $params ): array {
		unset( $params );
		return array(
			'ok'     => true,
			'blocks' => Flowbie_Wp_Seo_Blocks_Storage::list_all(),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_seo_block_save( array $params ) {
		$result = Flowbie_Wp_Seo_Blocks_Storage::save( $params );
		if ( is_wp_error( $result ) ) {
			return array(
				'ok'    => false,
				'error' => $result->get_error_message(),
			);
		}
		return array(
			'ok'    => true,
			'block' => $result,
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_seo_block_optimize( array $params ) {
		$preview = Flowbie_Wp_Seo_Blocks_Optimizer::preview( $params );
		if ( is_wp_error( $preview ) ) {
			return array(
				'ok'    => false,
				'error' => $preview->get_error_message(),
			);
		}
		if ( empty( $params['apply'] ) ) {
			return array(
				'ok'      => true,
				'preview' => $preview,
			);
		}
		$applied = Flowbie_Wp_Seo_Blocks_Optimizer::apply(
			array(
				'post_id'       => absint( $params['post_id'] ?? 0 ),
				'element_id'    => sanitize_text_field( (string) ( $params['element_id'] ?? '' ) ),
				'block_id'      => absint( $params['block_id'] ?? 0 ),
				'preview_slots' => $preview['preview_slots'] ?? array(),
				'topic_focus'   => (string) ( $preview['topic_focus'] ?? '' ),
				'focus_keyword' => (string) ( $preview['focus_keyword'] ?? '' ),
			)
		);
		if ( is_wp_error( $applied ) ) {
			return array(
				'ok'    => false,
				'error' => $applied->get_error_message(),
			);
		}
		return array(
			'ok'      => true,
			'preview' => $preview,
			'applied' => $applied,
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_seo_block_sync_library( array $params ) {
		$id  = absint( $params['id'] ?? $params['block_id'] ?? 0 );
		$row = Flowbie_Wp_Seo_Blocks_Storage::get( $id );
		if ( ! is_array( $row ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'SEO block not found.', 'flowbie-wp' ),
			);
		}
		$result = Flowbie_Wp_Seo_Blocks_Library::sync_row( $row );
		if ( is_wp_error( $result ) ) {
			return array(
				'ok'    => false,
				'error' => $result->get_error_message(),
			);
		}
		return array(
			'ok'    => true,
			'block' => Flowbie_Wp_Seo_Blocks_Storage::get( $id ),
		);
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>
	 */
	public static function wp_seo_blocks_usage( array $params ): array {
		unset( $params );
		return array(
			'ok'    => true,
			'usage' => Flowbie_Wp_Seo_Blocks_Usage::scan_all(),
		);
	}

	/**
	 * Active child/parent theme functions.php path.
	 *
	 * @return string
	 */
	private static function theme_functions_path(): string {
		return trailingslashit( get_stylesheet_directory() ) . 'functions.php';
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_theme_functions_get( array $params ) {
		unset( $params );

		if ( defined( 'DISALLOW_FILE_EDIT' ) && DISALLOW_FILE_EDIT ) {
			return new WP_Error(
				'flowbie_file_edit_disabled',
				__( 'Theme file editing is disabled on this host (DISALLOW_FILE_EDIT).', 'flowbie-wp' ),
				array( 'status' => 403 )
			);
		}

		$path = self::theme_functions_path();
		if ( ! is_readable( $path ) || ! is_file( $path ) ) {
			return new WP_Error(
				'flowbie_functions_missing',
				__( 'functions.php was not found for the active theme.', 'flowbie-wp' ),
				array( 'status' => 404 )
			);
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$content = file_get_contents( $path );
		if ( ! is_string( $content ) ) {
			return new WP_Error(
				'flowbie_functions_read_failed',
				__( 'Could not read functions.php.', 'flowbie-wp' ),
				array( 'status' => 500 )
			);
		}

		return array(
			'ok'             => true,
			'theme'          => get_stylesheet(),
			'path'           => 'functions.php',
			'content'        => $content,
			'bytes'          => strlen( $content ),
			'modified_unix'  => (int) filemtime( $path ),
		);
	}

	/**
	 * Extract HELLO_ELEMENTOR_CHILD_VERSION from PHP source when present.
	 *
	 * @param string $content PHP file contents.
	 * @return string
	 */
	private static function detect_child_theme_version( string $content ): string {
		$marker = 'HELLO_ELEMENTOR_CHILD_VERSION';
		$pos    = strpos( $content, $marker );
		if ( $pos === false ) {
			return '';
		}
		$slice = substr( $content, $pos, 120 );
		if ( preg_match( "/define\s*\(\s*['\"]HELLO_ELEMENTOR_CHILD_VERSION['\"]\s*,\s*['\"]([^'\"]+)['\"]/", $slice, $m ) ) {
			return trim( (string) $m[1] );
		}
		return '';
	}

	/**
	 * @param array<string, mixed> $params Params.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function wp_theme_functions_put( array $params ) {
		if ( defined( 'DISALLOW_FILE_EDIT' ) && DISALLOW_FILE_EDIT ) {
			return new WP_Error(
				'flowbie_file_edit_disabled',
				__( 'Theme file editing is disabled on this host (DISALLOW_FILE_EDIT).', 'flowbie-wp' ),
				array( 'status' => 403 )
			);
		}

		$content = isset( $params['content'] ) ? (string) $params['content'] : '';
		$content = str_replace( array( "\r\n", "\r" ), "\n", $content );
		if ( $content === '' || strpos( $content, '<?php' ) === false ) {
			return new WP_Error(
				'flowbie_functions_invalid',
				__( 'content must be a non-empty PHP file starting with <?php.', 'flowbie-wp' ),
				array( 'status' => 400 )
			);
		}

		$path = self::theme_functions_path();
		if ( ! is_file( $path ) ) {
			return new WP_Error(
				'flowbie_functions_missing',
				__( 'functions.php was not found for the active theme.', 'flowbie-wp' ),
				array( 'status' => 404 )
			);
		}

		$theme_dir = get_stylesheet_directory();
		$backup    = trailingslashit( $theme_dir ) . 'functions.php.flowbie-backup-' . gmdate( 'Ymd-His' ) . '.php';

		if ( ! copy( $path, $backup ) ) {
			return new WP_Error(
				'flowbie_functions_backup_failed',
				__( 'Could not create backup before writing functions.php.', 'flowbie-wp' ),
				array( 'status' => 500 )
			);
		}

		$written = file_put_contents( $path, $content );
		if ( $written === false ) {
			return new WP_Error(
				'flowbie_functions_write_failed',
				__( 'Could not write functions.php.', 'flowbie-wp' ),
				array( 'status' => 500 )
			);
		}

		return array(
			'ok'           => true,
			'theme'        => get_stylesheet(),
			'backup_path'  => $backup,
			'bytes_written' => (int) $written,
			'version'      => self::detect_child_theme_version( $content ),
		);
	}
}
