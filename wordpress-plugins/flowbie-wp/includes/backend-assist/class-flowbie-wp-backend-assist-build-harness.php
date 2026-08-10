<?php
/**
 * Backend Assist — Build mode harness (checklist → blueprint → deliverable).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Build_Harness {

	private const PHASE_TOTAL = 3;

	private const CONTENT_ARTIFACT_MAX_BYTES = 65536;

	/**
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	public static function run_build( string $message, array $history ): array {
		$card = Flowbie_Wp_Backend_Assist_Pipeline::run_pipeline( $message, $history );
		if ( ( $card['type'] ?? '' ) === 'action' ) {
			$wrapped = self::wrap_card( $card, $message );
			if ( empty( $wrapped['details_drawer'] ) ) {
				return Flowbie_Wp_Backend_Assist_Cards::error_card(
					__( 'Build did not execute. Re-plan in Plan mode, then switch to Build again.', 'flowbie-wp' )
				);
			}
			return $wrapped;
		}
		return $card;
	}

	/**
	 * @param array<string, mixed> $card
	 * @return array<string, mixed>
	 */
	public static function wrap_card( array $card, string $message ): array {
		if ( ( $card['type'] ?? '' ) !== 'action' ) {
			return $card;
		}

		$exec = isset( $card['action_result'] ) && is_array( $card['action_result'] ) ? $card['action_result'] : array();
		if ( empty( $exec['build_executed'] ) || empty( $exec['success'] ) ) {
			return $card;
		}
		$tool    = self::infer_tool( $exec );
		$post_id = isset( $exec['post_id'] ) ? absint( $exec['post_id'] ) : Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::resolve_effective_post_id( array() );

		$checklist   = self::build_checklist_json( $message, $tool, $exec );
		$blueprint   = self::build_blueprint_json( $message, $tool, $post_id, $exec );
		$deliverable = self::extract_deliverable_artifact( $message, $tool, $exec );
		$receipt     = self::build_upload_receipt_json( $message, $tool, $post_id, $exec );
		$slug        = self::message_slug_for_filename( $message );

		$files = array(
			self::file_entry( 'checklist', 'build-checklist.json', $checklist, 'application/json' ),
			self::file_entry( 'blueprint', 'build-blueprint.json', $blueprint, 'application/json' ),
			self::file_entry( 'deliverable', $slug . '.json', $deliverable, 'application/json' ),
			self::file_entry( 'upload', 'upload.json', $receipt, 'application/json' ),
		);

		$deliverable_label = self::deliverable_label( $tool, $message, $exec );
		$success           = ! empty( $exec['success'] );
		$prep_steps        = self::harness_prep_steps( $message, $exec );

		$card['harness_sections'] = array(
			array(
				'sectionIndex' => 0,
				'title'        => __( 'Build checklist', 'flowbie-wp' ),
				'status'       => 'done',
				'artifactType' => 'checklist',
			),
			array(
				'sectionIndex' => 1,
				'title'        => __( 'Build blueprint', 'flowbie-wp' ),
				'status'       => 'done',
				'artifactType' => 'blueprint',
			),
			array(
				'sectionIndex' => 2,
				'title'        => $deliverable_label,
				'status'       => 'done',
				'artifactType' => 'deliverable',
			),
		);

		$card['details_drawer'] = array(
			'prep'            => array(
				'title' => __( 'Build prep', 'flowbie-wp' ),
				'steps' => $prep_steps,
			),
			'target_row'      => self::target_row( $post_id, $exec ),
			'generated_files' => $files,
			'progress'        => array(
				'completed' => self::PHASE_TOTAL,
				'total'     => self::PHASE_TOTAL,
			),
			'status_message'  => $success
				? __( 'Build complete', 'flowbie-wp' )
				: ( isset( $exec['error'] ) ? (string) $exec['error'] : __( 'Build finished with errors', 'flowbie-wp' ) ),
			'result_summary'  => self::result_summary( $exec ),
		);

		$card['harness_progress'] = array(
			'completed' => self::PHASE_TOTAL,
			'total'     => self::PHASE_TOTAL,
			'label'     => $deliverable_label,
		);

		if ( ( $card['type'] ?? '' ) === 'action' && ! empty( $card['details_drawer'] ) ) {
			$card['body'] = '';
		}

		return $card;
	}

	/**
	 * @param array<string, mixed> $exec
	 * @return array<int, array{label: string, status: string}>
	 */
	public static function harness_prep_steps( string $message, array $exec ): array {
		if ( ! empty( $exec['agent_trace'] ) && is_array( $exec['agent_trace'] ) ) {
			$steps = Flowbie_Wp_Backend_Assist_Subagent_Registry::prep_steps_from_trace( $exec['agent_trace'] );
			if ( $steps !== array() ) {
				return $steps;
			}
		}

		$post_id = isset( $exec['post_id'] ) ? absint( $exec['post_id'] ) : Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::resolve_effective_post_id( array() );
		$agents  = Flowbie_Wp_Backend_Assist_Subagent_Registry::resolve_agents_for_message( $message, $post_id );
		if ( $agents !== array() ) {
			$steps = Flowbie_Wp_Backend_Assist_Subagent_Registry::prep_steps_from_agent_ids( $agents, true );
			if ( $steps !== array() ) {
				return $steps;
			}
		}

		if ( ! empty( $exec['meta_compound'] ) || Flowbie_Wp_Backend_Assist_Meta_Compound::message_requests_meta_compound( $message ) ) {
			return array(
				array(
					'label'  => __( 'Generate SEO title', 'flowbie-wp' ),
					'status' => 'done',
				),
				array(
					'label'  => __( 'Generate meta description', 'flowbie-wp' ),
					'status' => 'done',
				),
				array(
					'label'  => __( 'Upload to post', 'flowbie-wp' ),
					'status' => 'done',
				),
			);
		}

		return array(
			array(
				'label'  => __( 'Build checklist', 'flowbie-wp' ),
				'status' => 'done',
			),
			array(
				'label'  => __( 'Build blueprint', 'flowbie-wp' ),
				'status' => 'done',
			),
		);
	}

	public static function message_slug_for_filename( string $message ): string {
		$slug = sanitize_title( trim( $message ) );
		if ( $slug === '' ) {
			return 'build-deliverable';
		}
		if ( strlen( $slug ) > 60 ) {
			$slug = substr( $slug, 0, 60 );
			$slug = rtrim( $slug, '-' );
		}
		return $slug !== '' ? $slug : 'build-deliverable';
	}

	/**
	 * @param array<string, mixed> $exec
	 */
	private static function infer_tool( array $exec ): string {
		if ( ! empty( $exec['saved'] ) && is_array( $exec['saved'] ) ) {
			$saved = array_map( 'strval', $exec['saved'] );
			if (
				in_array( 'title', $saved, true )
				|| in_array( 'excerpt', $saved, true )
				|| in_array( 'focus_keyword', $saved, true )
				|| in_array( 'faq', $saved, true )
			) {
				return 'save_post_meta';
			}
		}
		if ( isset( $exec['word_count'] ) || ! empty( $exec['body_ops'] ) || ! empty( $exec['body_edit'] ) ) {
			return 'add_content';
		}
		if ( ! empty( $exec['previous_title'] ) || ( ! empty( $exec['title'] ) && empty( $exec['saved'] ) ) ) {
			return 'update_post';
		}
		if ( ! empty( $exec['restored'] ) ) {
			return 'restore_post_revision';
		}
		return 'build';
	}

	/**
	 * @param array<string, mixed> $exec
	 */
	private static function deliverable_label( string $tool, string $message, array $exec ): string {
		$saved = isset( $exec['saved'] ) && is_array( $exec['saved'] ) ? array_map( 'strval', $exec['saved'] ) : array();
		if ( in_array( 'faq', $saved, true ) || Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::message_requests_faq_schema( $message ) ) {
			return __( 'FAQ schema', 'flowbie-wp' );
		}

		switch ( $tool ) {
			case 'save_post_meta':
				return __( 'SEO meta', 'flowbie-wp' );
			case 'add_content':
				return __( 'Post content', 'flowbie-wp' );
			case 'update_post':
				return __( 'Post title', 'flowbie-wp' );
			case 'run_seo_research_brief':
				return __( 'SEO research brief', 'flowbie-wp' );
			default:
				return __( 'Deliverable', 'flowbie-wp' );
		}
	}

	/**
	 * @param array<string, mixed> $exec
	 */
	private static function build_checklist_json( string $message, string $tool, array $exec ): string {
		$payload = array(
			'request' => $message,
			'tool'    => $tool,
			'tasks'   => array(
				__( 'Resolve target post and permissions', 'flowbie-wp' ),
				__( 'Build checklist', 'flowbie-wp' ),
				__( 'Build blueprint', 'flowbie-wp' ),
				sprintf(
					/* translators: %s: tool label */
					__( 'Execute %s', 'flowbie-wp' ),
					self::deliverable_label( $tool, $message, $exec )
				),
			),
			'success' => ! empty( $exec['success'] ),
		);
		return self::encode_json( $payload );
	}

	/**
	 * @param array<string, mixed> $exec
	 */
	private static function build_blueprint_json( string $message, string $tool, int $post_id, array $exec ): string {
		$constraints = Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::extract_meta_copy_constraints( $message );
		$payload     = array(
			'tool'        => $tool,
			'message'     => $message,
			'post_id'     => $post_id,
			'constraints' => $constraints,
			'saved'       => isset( $exec['saved'] ) && is_array( $exec['saved'] ) ? array_values( $exec['saved'] ) : array(),
		);
		return self::encode_json( $payload );
	}

	/**
	 * @param array<string, mixed> $exec
	 */
	private static function extract_deliverable_artifact( string $message, string $tool, array $exec ): string {
		if ( empty( $exec['success'] ) ) {
			return self::encode_json(
				array(
					'error' => __( 'No deliverable artifact', 'flowbie-wp' ),
				)
			);
		}

		$values  = isset( $exec['values'] ) && is_array( $exec['values'] ) ? $exec['values'] : array();
		$saved   = isset( $exec['saved'] ) && is_array( $exec['saved'] ) ? array_map( 'strval', $exec['saved'] ) : array();

		if ( in_array( 'faq', $saved, true ) || Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::message_requests_faq_schema( $message ) ) {
			$faq_schema = self::read_faq_schema_value( $values );
			if ( $faq_schema !== null ) {
				return self::encode_json( $faq_schema );
			}
		}

		if ( $tool === 'save_post_meta' ) {
			$meta_artifact = self::extract_saved_meta_artifact( $saved, $values );
			if ( $meta_artifact !== null ) {
				return self::encode_json( $meta_artifact );
			}
		}

		if ( $tool === 'add_content' || ! empty( $exec['body_ops'] ) || ! empty( $exec['body_edit'] ) ) {
			$content = trim( (string) ( $values['content'] ?? '' ) );
			if ( $content !== '' ) {
				if ( strlen( $content ) > self::CONTENT_ARTIFACT_MAX_BYTES ) {
					$content = substr( $content, 0, self::CONTENT_ARTIFACT_MAX_BYTES );
				}
				return self::encode_json( array( 'content' => $content ) );
			}
		}

		if ( $tool === 'run_seo_research_brief' ) {
			$brief = trim( (string) ( $values['seoResearch'] ?? '' ) );
			if ( $brief !== '' ) {
				$parsed = self::parse_json_ld_string( $brief );
				return self::encode_json( $parsed !== null ? $parsed : array( 'seoResearch' => $brief ) );
			}
		}

		return self::encode_json(
			array(
				'error' => __( 'No deliverable artifact', 'flowbie-wp' ),
			)
		);
	}

	/**
	 * @param array<string, mixed> $values
	 * @return array<string, mixed>|null
	 */
	private static function read_faq_schema_value( array $values ): ?array {
		$faq = trim( (string) ( $values['faq'] ?? '' ) );
		if ( $faq === '' ) {
			return null;
		}

		return self::parse_json_ld_string( $faq );
	}

	/**
	 * @param array<int, string>   $saved
	 * @param array<string, mixed> $values
	 * @return array<string, mixed>|null
	 */
	private static function extract_saved_meta_artifact( array $saved, array $values ): ?array {
		$field_map = array(
			'title'         => 'seoTitle',
			'excerpt'       => 'metaDescription',
			'focus_keyword' => 'focusKeyword',
			'seo_research'  => 'seoResearch',
		);

		$artifact = array();
		foreach ( $saved as $field ) {
			if ( $field === 'faq' ) {
				continue;
			}
			$value_key = $field_map[ $field ] ?? $field;
			$raw       = isset( $values[ $value_key ] ) ? trim( (string) $values[ $value_key ] ) : '';
			if ( $raw !== '' ) {
				$artifact[ $value_key ] = $raw;
			}
		}

		return $artifact !== array() ? $artifact : null;
	}

	/**
	 * @param array<string, mixed> $exec
	 */
	private static function build_upload_receipt_json( string $message, string $tool, int $post_id, array $exec ): string {
		$page_url = '';
		if ( $post_id > 0 ) {
			if ( function_exists( 'get_permalink' ) ) {
				$link = get_permalink( $post_id );
				$page_url = is_string( $link ) ? $link : '';
			}
			if ( $page_url === '' ) {
				$hub      = Flowbie_Wp_Ai_Context::meta_hub_values( $post_id );
				$page_url = trim( (string) ( $hub['pageUrl'] ?? '' ) );
			}
		}

		$payload = array(
			'success'     => ! empty( $exec['success'] ),
			'message'     => $message,
			'tool'        => $tool,
			'post_id'     => $post_id,
			'uploaded_at' => gmdate( 'c' ),
			'saved'       => isset( $exec['saved'] ) && is_array( $exec['saved'] ) ? array_values( $exec['saved'] ) : array(),
		);

		if ( $page_url !== '' ) {
			$payload['page_url'] = $page_url;
		}
		if ( ! empty( $exec['error'] ) ) {
			$payload['error'] = (string) $exec['error'];
		}

		return self::encode_json( $payload );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	private static function parse_json_ld_string( string $raw ): ?array {
		$text = trim( $raw );
		if ( $text === '' ) {
			return null;
		}

		if ( preg_match( '/<script[^>]*type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is', $text, $matches ) ) {
			$text = trim( $matches[1] );
		}

		$decoded = json_decode( $text, true );
		return is_array( $decoded ) ? $decoded : null;
	}

	/**
	 * @param array<string, mixed> $payload
	 */
	private static function encode_json( array $payload ): string {
		return wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ?: '{}';
	}

	/**
	 * @return array<string, string>
	 */
	private static function file_entry( string $id, string $file_name, string $content, string $mime_type ): array {
		return array(
			'id'       => $id,
			'fileName' => $file_name,
			'content'  => $content,
			'mimeType' => $mime_type,
			'status'   => 'completed',
		);
	}

	/**
	 * @param array<string, mixed> $exec
	 * @return array<string, mixed>
	 */
	private static function target_row( int $post_id, array $exec ): array {
		$post  = ( $post_id > 0 && function_exists( 'get_post' ) ) ? get_post( $post_id ) : null;
		$title = $post instanceof WP_Post ? $post->post_title : ( isset( $exec['title'] ) ? (string) $exec['title'] : '' );
		$focus = $post_id > 0 ? trim( Flowbie_Wp_Ai_Context::read_focus_keyword( $post_id ) ) : '';
		$date  = $post instanceof WP_Post ? get_the_modified_date( 'M j, Y', $post ) : gmdate( 'M j, Y' );

		return array(
			'title'         => $title,
			'focus_keyword' => $focus,
			'date_label'    => is_string( $date ) ? $date : gmdate( 'M j, Y' ),
			'post_id'       => $post_id,
		);
	}

	/**
	 * @param array<string, mixed> $exec
	 * @return array<string, string>
	 */
	private static function result_summary( array $exec ): array {
		$out    = array();
		$values = isset( $exec['values'] ) && is_array( $exec['values'] ) ? $exec['values'] : array();
		if ( ! empty( $values['seoTitle'] ) ) {
			$out['seo_title'] = (string) $values['seoTitle'];
		}
		if ( ! empty( $values['metaDescription'] ) ) {
			$out['meta_description'] = (string) $values['metaDescription'];
		}
		if ( ! empty( $exec['saved'] ) && is_array( $exec['saved'] ) ) {
			$out['saved_fields'] = implode( ', ', array_map( 'strval', $exec['saved'] ) );
		}
		return $out;
	}
}
