<?php
/**
 * Backend Assist — sub-agent registry (resolve + orchestrate AISEO / WYSIWYG agents).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Subagent_Registry {

	/** @var array<string, array{label: string, harness: string}> */
	private static array $catalog = array(
		'seo_title'          => array( 'label' => 'Generate SEO title', 'harness' => 'aiseo' ),
		'meta_description'   => array( 'label' => 'Generate meta description', 'harness' => 'aiseo' ),
		'focus_keyword'      => array( 'label' => 'Generate focus keyword', 'harness' => 'aiseo' ),
		'faq_schema'           => array( 'label' => 'Generate FAQ schema', 'harness' => 'aiseo' ),
		'page_url'             => array( 'label' => 'Suggest page URL', 'harness' => 'aiseo' ),
		'seo_research_brief'   => array( 'label' => 'Build SEO research brief', 'harness' => 'aiseo' ),
		'date_modifier'        => array( 'label' => 'Set date modifier', 'harness' => 'aiseo' ),
		'body_heading'         => array( 'label' => 'Rewrite heading', 'harness' => 'wysiwyg' ),
		'body_section'         => array( 'label' => 'Rewrite section', 'harness' => 'wysiwyg' ),
		'body_intro'           => array( 'label' => 'Rewrite intro', 'harness' => 'wysiwyg' ),
		'body_paragraph'       => array( 'label' => 'Rewrite paragraph', 'harness' => 'wysiwyg' ),
		'body_list'            => array( 'label' => 'Format list', 'harness' => 'wysiwyg' ),
		'body_table'           => array( 'label' => 'Build table', 'harness' => 'wysiwyg' ),
		'body_table_rows'      => array( 'label' => 'Generate table rows', 'harness' => 'wysiwyg' ),
		'body_internal_links'  => array( 'label' => 'Add internal links', 'harness' => 'wysiwyg' ),
		'body_faq_table'       => array( 'label' => 'Build FAQ table', 'harness' => 'wysiwyg' ),
		'body_full_post'       => array( 'label' => 'Rewrite post body', 'harness' => 'wysiwyg' ),
	);

	/**
	 * @return array<string, array{label: string, harness: string}>
	 */
	public static function agent_catalog(): array {
		return self::$catalog;
	}

	public static function agent_step_label( string $agent_id ): string {
		$id = sanitize_key( $agent_id );
		if ( isset( self::$catalog[ $id ]['label'] ) ) {
			return (string) self::$catalog[ $id ]['label'];
		}
		return ucwords( str_replace( '_', ' ', $id ) );
	}

	/**
	 * @return array<int, string>
	 */
	public static function resolve_agents_for_message( string $message, int $post_id = 0 ): array {
		$prep = Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::class;

		if ( Flowbie_Wp_Backend_Assist_Meta_Compound::message_requests_meta_compound( $message ) ) {
			return array( 'seo_title', 'meta_description' );
		}

		if ( $prep::message_requests_faq_compound( $message ) ) {
			return array( 'faq_schema', 'body_faq_table' );
		}

		if ( $prep::message_requests_focus_keyword( $message ) ) {
			if (
				$prep::message_requests_meta_refresh( $message )
				|| preg_match( '/\b(seo title|meta title|meta description|seo description)\b/i', $message )
			) {
				return array( 'focus_keyword', 'seo_title', 'meta_description' );
			}
			return array( 'focus_keyword' );
		}

		if ( $prep::message_requests_faq_schema( $message ) && ! $prep::message_requests_faq_table( $message ) ) {
			return array( 'faq_schema' );
		}

		if ( $prep::message_requests_seo_research_brief( $message ) ) {
			return array( 'seo_research_brief' );
		}

		if ( $prep::message_requests_date_modifier( $message ) ) {
			return array( 'date_modifier' );
		}

		if ( $post_id > 0 && $prep::message_requests_full_body_rewrite( $message ) ) {
			return array( 'body_full_post' );
		}

		if ( $post_id > 0 && $prep::should_use_body_ops( $message, $post_id, array() ) ) {
			return self::resolve_body_agents_for_message( $message, $post_id );
		}

		$fields = $prep::fields_requested_for_meta_write( $message );
		if ( in_array( 'seoTitle', $fields, true ) && in_array( 'metaDescription', $fields, true ) ) {
			return array( 'seo_title', 'meta_description' );
		}
		if ( in_array( 'seoTitle', $fields, true ) ) {
			return array( 'seo_title' );
		}
		if ( in_array( 'metaDescription', $fields, true ) ) {
			return array( 'meta_description' );
		}

		return array();
	}

	/**
	 * @return array<int, string>
	 */
	public static function resolve_body_agents_for_message( string $message, int $post_id ): array {
		$agents = array();
		$prep   = Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::class;

		if ( $prep::message_requests_heading_change( $message ) ) {
			$agents[] = 'body_heading';
		}

		if ( preg_match( '/\bintro\b/i', $message ) && preg_match( '/\b(rewrite|refresh|update|change|shorten)\b/i', $message ) ) {
			if ( ! in_array( 'body_intro', $agents, true ) ) {
				$agents[] = 'body_intro';
			}
			return $agents;
		}

		$intent = $prep::classify_body_edit_intent( $message, $post_id, array() );
		if ( ! is_wp_error( $intent ) ) {
			$key = sanitize_key( (string) ( $intent['intent'] ?? '' ) );
			switch ( $key ) {
				case 'replace_section':
					if ( ! in_array( 'body_section', $agents, true ) ) {
						$agents[] = 'body_section';
					}
					break;
				case 'insert_new_table':
				case 'convert_section_to_table':
					$agents[] = 'body_table';
					break;
				case 'edit_text':
					if ( preg_match( '/\b(bullet|bulleted|numbered|ordered|list|ul|ol)\b/i', $message ) ) {
						$agents[] = 'body_list';
					} elseif ( preg_match( '/\btable\b/i', $message ) ) {
						$agents[] = 'body_table';
					} else {
						$agents[] = 'body_section';
					}
					break;
				case 'links':
					$agents[] = 'body_internal_links';
					break;
			}
		} elseif ( preg_match( '/\b(convert|table)\b/i', $message ) ) {
			$agents[] = 'body_table';
		} elseif ( preg_match( '/\b(rewrite|replace|update)\b.*\bsection\b/i', $message ) ) {
			$agents[] = 'body_section';
		}

		return array_values( array_unique( $agents ) );
	}

	/**
	 * @param array<string, mixed>           $params
	 * @param array<int, array<string, mixed>> $history
	 * @param array<int, string>|null        $agent_ids
	 * @return array<string, mixed>
	 */
	public static function run_agents( string $message, array $history, array $params, ?array $agent_ids = null ): array {
		$post_id = isset( $params['post_id'] ) ? absint( $params['post_id'] ) : 0;
		if ( $post_id < 1 ) {
			$post_id = Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::resolve_effective_post_id( $params );
		}

		if ( $agent_ids === null ) {
			$agent_ids = self::resolve_agents_for_message( $message, $post_id );
		}

		if ( $agent_ids === array() ) {
			return array(
				'success' => false,
				'error'   => __( 'No sub-agents resolved for this request.', 'flowbie-wp' ),
			);
		}

		$meta_agents = array();
		$body_agents = array();
		foreach ( $agent_ids as $agent_id ) {
			$id = sanitize_key( (string) $agent_id );
			if ( ! isset( self::$catalog[ $id ] ) ) {
				continue;
			}
			if ( self::$catalog[ $id ]['harness'] === 'aiseo' ) {
				$meta_agents[] = $id;
			} else {
				$body_agents[] = $id;
			}
		}

		if ( $meta_agents !== array() && $body_agents === array() ) {
			return self::run_meta_agent_chain( $message, $history, $post_id, $meta_agents, $params );
		}

		if ( in_array( 'faq_schema', $agent_ids, true ) && in_array( 'body_faq_table', $agent_ids, true ) ) {
			return self::run_faq_compound_chain( $message, $history, $post_id, $params );
		}

		if ( $body_agents !== array() ) {
			return self::run_body_agent_chain( $message, $history, $post_id, $body_agents, $params );
		}

		return self::run_meta_agent_chain( $message, $history, $post_id, $meta_agents, $params );
	}

	/**
	 * @param array<int, string>             $agent_ids
	 * @param array<string, mixed>           $params
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	private static function run_meta_agent_chain( string $message, array $history, int $post_id, array $agent_ids, array $params ): array {
		if ( $post_id < 1 ) {
			return array(
				'success' => false,
				'error'   => __( 'Could not resolve post for meta agents.', 'flowbie-wp' ),
			);
		}

		$ctx          = Flowbie_Wp_Backend_Assist_Subagent_Aiseo::build_context( $post_id );
		$values       = array();
		$prior        = array();
		$agent_trace  = array();

		foreach ( $agent_ids as $agent_id ) {
			$result = self::call_agent( $agent_id, $message, $history, $post_id, $ctx, $prior );
			if ( is_wp_error( $result ) ) {
				return array(
					'success'     => false,
					'error'       => $result->get_error_message(),
					'agent_trace' => $agent_trace,
				);
			}

			$field = (string) ( $result['field'] ?? '' );
			if ( $field !== '' ) {
				$values[ $field ] = (string) ( $result['artifact'] ?? '' );
				$prior[ $field ]  = $values[ $field ];
			}

			$agent_trace[] = array(
				'agent_id' => $agent_id,
				'label'    => self::agent_step_label( $agent_id ),
				'field'    => $field,
				'status'   => 'done',
			);
		}

		$save_params = array_merge(
			$params,
			array(
				'post_id'       => $post_id,
				'seo_title_only'=> true,
			),
			$values
		);

		$meta_result = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_execute( 'save_post_meta', $save_params );
		if ( empty( $meta_result['success'] ) ) {
			$meta_result['agent_trace'] = $agent_trace;
			$meta_result['build_executed']    = true;
			$meta_result['build_executed_at'] = gmdate( 'c' );
			return $meta_result;
		}

		$saved = isset( $meta_result['saved'] ) && is_array( $meta_result['saved'] ) ? $meta_result['saved'] : array();
		if (
			in_array( 'seo_title', $agent_ids, true )
			&& in_array( 'meta_description', $agent_ids, true )
			&& ( ! in_array( 'title', $saved, true ) || ! in_array( 'excerpt', $saved, true ) )
		) {
			$meta_result['success'] = false;
			$meta_result['error']   = isset( $meta_result['error'] ) && (string) $meta_result['error'] !== ''
				? (string) $meta_result['error']
				: __( 'Meta upload did not save SEO title and meta description.', 'flowbie-wp' );
			$meta_result['agent_trace'] = array_merge( $agent_trace, array(
				array(
					'agent_id' => 'upload',
					'label'    => __( 'Upload to post', 'flowbie-wp' ),
					'status'   => 'error',
				),
			) );
			$meta_result['build_executed']    = true;
			$meta_result['build_executed_at'] = gmdate( 'c' );
			return $meta_result;
		}

		$meta_result['agent_trace'] = array_merge( $agent_trace, array(
			array(
				'agent_id' => 'upload',
				'label'    => __( 'Upload to post', 'flowbie-wp' ),
				'status'   => ! empty( $meta_result['success'] ) ? 'done' : 'error',
			),
		) );
		$meta_result['values'] = array_merge(
			isset( $meta_result['values'] ) && is_array( $meta_result['values'] ) ? $meta_result['values'] : array(),
			$values
		);

		if ( in_array( 'seo_title', $agent_ids, true ) && in_array( 'meta_description', $agent_ids, true ) ) {
			$meta_result['meta_compound'] = true;
		}

		$meta_result['build_executed']    = true;
		$meta_result['build_executed_at'] = gmdate( 'c' );

		return $meta_result;
	}

	/**
	 * @param array<string, mixed>           $params
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	private static function run_faq_compound_chain( string $message, array $history, int $post_id, array $params ): array {
		if ( $post_id < 1 ) {
			return array(
				'success' => false,
				'error'   => __( 'Could not resolve post for FAQ update.', 'flowbie-wp' ),
			);
		}

		$ctx         = Flowbie_Wp_Backend_Assist_Subagent_Aiseo::build_context( $post_id );
		$agent_trace = array();
		$prior       = array();

		$schema_result = self::call_agent( 'faq_schema', $message, $history, $post_id, $ctx, $prior );
		if ( is_wp_error( $schema_result ) ) {
			return array( 'success' => false, 'error' => $schema_result->get_error_message() );
		}
		$agent_trace[] = array(
			'agent_id' => 'faq_schema',
			'label'    => self::agent_step_label( 'faq_schema' ),
			'status'   => 'done',
		);

		$entries = Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::generate_faq_qa_pairs( $post_id, $message, $history );
		if ( is_wp_error( $entries ) ) {
			return array( 'success' => false, 'error' => $entries->get_error_message() );
		}
		$prior['faq_entries'] = $entries;

		$table_result = Flowbie_Wp_Backend_Assist_Subagent_Wysiwyg::run_agent( 'body_faq_table', $message, $history, $post_id, $prior );
		if ( is_wp_error( $table_result ) ) {
			return array( 'success' => false, 'error' => $table_result->get_error_message() );
		}
		$agent_trace[] = array(
			'agent_id' => 'body_faq_table',
			'label'    => self::agent_step_label( 'body_faq_table' ),
			'status'   => 'done',
		);

		$meta_params = array_merge(
			$params,
			array(
				'post_id' => $post_id,
				'faq'     => (string) ( $schema_result['artifact'] ?? '' ),
			)
		);
		$meta_result = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_execute( 'save_post_meta', $meta_params );

		$content_params = array(
			'post_id' => $post_id,
			'mode'    => 'append',
			'content' => (string) ( $table_result['artifact'] ?? '' ),
		);
		$content_result = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_execute( 'add_content', $content_params );

		$agent_trace[] = array(
			'agent_id' => 'upload',
			'label'    => __( 'Upload to post', 'flowbie-wp' ),
			'status'   => ( ! empty( $meta_result['success'] ) && ! empty( $content_result['success'] ) ) ? 'done' : 'error',
		);

		$combined = array(
			'success'        => ! empty( $meta_result['success'] ) && ! empty( $content_result['success'] ),
			'faq_compound'   => true,
			'post_id'        => $post_id,
			'title'          => $content_result['title'] ?? $meta_result['title'] ?? '',
			'edit_url'       => $content_result['edit_url'] ?? $meta_result['edit_url'] ?? '',
			'view_url'       => $content_result['view_url'] ?? $meta_result['view_url'] ?? '',
			'word_count'     => $content_result['word_count'] ?? null,
			'meta_result'    => $meta_result,
			'content_result' => $content_result,
			'saved'          => $meta_result['saved'] ?? array(),
			'agent_trace'    => $agent_trace,
			'build_executed' => true,
			'build_executed_at' => gmdate( 'c' ),
		);

		if ( ! $combined['success'] ) {
			$combined['error'] = $content_result['error'] ?? $meta_result['error'] ?? __( 'FAQ update failed.', 'flowbie-wp' );
		}

		return $combined;
	}

	/**
	 * @param array<int, string>             $agent_ids
	 * @param array<string, mixed>           $params
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	private static function run_body_agent_chain( string $message, array $history, int $post_id, array $agent_ids, array $params ): array {
		if ( $post_id < 1 ) {
			return array(
				'success' => false,
				'error'   => __( 'Could not resolve post for body agents.', 'flowbie-wp' ),
			);
		}

		$agent_trace = array();
		$prior       = array();
		$ops         = array();

		foreach ( $agent_ids as $agent_id ) {
			$result = Flowbie_Wp_Backend_Assist_Subagent_Wysiwyg::run_agent( $agent_id, $message, $history, $post_id, $prior );
			if ( is_wp_error( $result ) ) {
				return array(
					'success'     => false,
					'error'       => $result->get_error_message(),
					'agent_trace' => $agent_trace,
				);
			}

			$agent_trace[] = array(
				'agent_id' => $agent_id,
				'label'    => self::agent_step_label( $agent_id ),
				'status'   => 'done',
			);

			if ( ! empty( $result['body_ops'] ) && is_array( $result['body_ops'] ) ) {
				foreach ( $result['body_ops'] as $op ) {
					$ops[] = $op;
				}
			}
			if ( ! empty( $result['faq_entries'] ) ) {
				$prior['faq_entries'] = $result['faq_entries'];
			}
			if ( ! empty( $result['field'] ) && ! empty( $result['artifact'] ) ) {
				$prior[ (string) $result['field'] ] = $result['artifact'];
			}
		}

		if ( $agent_ids === array( 'body_full_post' ) && ! empty( $prior['content'] ) ) {
			$content_params = array_merge(
				$params,
				array(
					'post_id' => $post_id,
					'mode'    => 'replace',
					'content' => (string) $prior['content'],
				)
			);
			$content_result = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_execute( 'add_content', $content_params );
			$content_result['agent_trace'] = array_merge( $agent_trace, array(
				array(
					'agent_id' => 'upload',
					'label'    => __( 'Upload to post', 'flowbie-wp' ),
					'status'   => ! empty( $content_result['success'] ) ? 'done' : 'error',
				),
			) );
			$content_result['build_executed']    = true;
			$content_result['build_executed_at'] = gmdate( 'c' );
			return $content_result;
		}

		if ( $ops === array() ) {
			$prepared = Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::prepare_body_ops_params_public( $message, $history, array_merge( $params, array( 'post_id' => $post_id ) ) );
			if ( is_wp_error( $prepared ) ) {
				return array( 'success' => false, 'error' => $prepared->get_error_message(), 'agent_trace' => $agent_trace );
			}
			$exec = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_execute( 'add_content', $prepared );
			$exec['agent_trace'] = array_merge( $agent_trace, array(
				array(
					'agent_id' => 'upload',
					'label'    => __( 'Upload to post', 'flowbie-wp' ),
					'status'   => ! empty( $exec['success'] ) ? 'done' : 'error',
				),
			) );
			$exec['build_executed']    = true;
			$exec['build_executed_at'] = gmdate( 'c' );
			return $exec;
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return array( 'success' => false, 'error' => __( 'Post not found.', 'flowbie-wp' ) );
		}

		$original = (string) $post->post_content;
		$updated  = Flowbie_Wp_Backend_Assist_Body_Ops::apply_ops( $original, $ops );
		if ( is_wp_error( $updated ) ) {
			return array( 'success' => false, 'error' => $updated->get_error_message(), 'agent_trace' => $agent_trace );
		}

		$content_params = array(
			'post_id'       => $post_id,
			'mode'          => 'replace',
			'content'       => (string) $updated,
			'body_ops'      => true,
			'body_ops_list' => $ops,
			'ops_summary'   => Flowbie_Wp_Backend_Assist_Body_Ops::describe_ops( $ops ),
		);
		$content_result = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_execute( 'add_content', $content_params );
		$content_result['agent_trace'] = array_merge( $agent_trace, array(
			array(
				'agent_id' => 'upload',
				'label'    => __( 'Upload to post', 'flowbie-wp' ),
				'status'   => ! empty( $content_result['success'] ) ? 'done' : 'error',
			),
		) );
		$content_result['build_executed']    = true;
		$content_result['build_executed_at'] = gmdate( 'c' );
		$content_result['body_ops']          = true;

		return $content_result;
	}

	/**
	 * @param array<string, mixed>           $ctx
	 * @param array<string, mixed>           $prior
	 * @param array<int, array<string, mixed>> $history
	 * @return array{artifact: mixed, field: string}|WP_Error
	 */
	public static function call_agent( string $agent_id, string $message, array $history, int $post_id, array $ctx, array $prior = array() ) {
		$id = sanitize_key( $agent_id );

		if ( $id === 'seo_research_brief' ) {
			$brief_params = array( 'post_id' => $post_id );
			$result       = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_execute( 'run_seo_research_brief', $brief_params );
			if ( empty( $result['success'] ) ) {
				return new WP_Error( 'flowbie_seo_brief', (string) ( $result['error'] ?? __( 'SEO research brief failed.', 'flowbie-wp' ) ) );
			}
			$brief = trim( (string) ( $result['values']['seoResearch'] ?? $result['seoResearch'] ?? '' ) );
			return array( 'artifact' => $brief, 'field' => 'seoResearch' );
		}

		if ( $id === 'date_modifier' ) {
			return array(
				'artifact' => gmdate( 'Y-m-d' ),
				'field'    => 'dateModifier',
			);
		}

		if ( $id === 'page_url' ) {
			return new WP_Error( 'flowbie_page_url_agent', __( 'Page URL agent is not enabled in this release.', 'flowbie-wp' ) );
		}

		if ( isset( self::$catalog[ $id ] ) && self::$catalog[ $id ]['harness'] === 'wysiwyg' ) {
			return Flowbie_Wp_Backend_Assist_Subagent_Wysiwyg::run_agent( $id, $message, $history, $post_id, $prior );
		}

		return Flowbie_Wp_Backend_Assist_Subagent_Aiseo::run_agent( $id, $message, $history, $ctx, $prior );
	}

	/**
	 * @param array<int, array{agent_id?: string, label?: string, status?: string}> $agent_trace
	 * @return array<int, array{label: string, status: string}>
	 */
	public static function prep_steps_from_trace( array $agent_trace ): array {
		$steps = array();
		foreach ( $agent_trace as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$label = trim( (string) ( $row['label'] ?? '' ) );
			if ( $label === '' && ! empty( $row['agent_id'] ) ) {
				$label = self::agent_step_label( (string) $row['agent_id'] );
			}
			if ( $label === '' ) {
				continue;
			}
			$status = sanitize_key( (string) ( $row['status'] ?? 'done' ) );
			if ( ! in_array( $status, array( 'done', 'running', 'pending', 'error' ), true ) ) {
				$status = 'done';
			}
			$steps[] = array(
				'label'  => $label,
				'status' => $status,
			);
		}
		return $steps;
	}

	/**
	 * @param array<int, string> $agent_ids
	 * @return array<int, array{label: string, status: string}>
	 */
	public static function prep_steps_from_agent_ids( array $agent_ids, bool $include_upload = true ): array {
		$steps = array();
		foreach ( $agent_ids as $agent_id ) {
			$steps[] = array(
				'label'  => self::agent_step_label( (string) $agent_id ),
				'status' => 'pending',
			);
		}
		if ( $include_upload && $steps !== array() ) {
			$steps[] = array(
				'label'  => __( 'Upload to post', 'flowbie-wp' ),
				'status' => 'pending',
			);
		}
		return $steps;
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>
	 */
	public static function plan_cache_params( string $message, array $params ): array {
		$post_id = Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::resolve_effective_post_id( $params );
		$agents  = self::resolve_agents_for_message( $message, $post_id );
		$out     = array( 'agents' => $agents );
		if ( $post_id > 0 ) {
			$out['post_id'] = $post_id;
		}
		if ( in_array( 'seo_title', $agents, true ) && in_array( 'meta_description', $agents, true ) && count( $agents ) === 2 ) {
			$out['meta_compound'] = true;
		}
		if ( in_array( 'faq_schema', $agents, true ) && in_array( 'body_faq_table', $agents, true ) ) {
			$out['faq_compound'] = true;
		}
		return $out;
	}
}
