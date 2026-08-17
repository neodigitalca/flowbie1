<?php
/**
 * Backend Assist — SEO title + meta description sub-agents with guaranteed upload.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Meta_Compound {

	/** @var array<string, string>|null Test stub: seoTitle, metaDescription */
	public static $test_subagent_outputs = null;

	public static function message_requests_meta_compound( string $message ): bool {
		if ( Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::message_requests_meta_refresh( $message ) ) {
			return true;
		}

		if ( ! Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::message_requests_meta_only_write( $message ) ) {
			return false;
		}

		if (
			Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::message_requests_focus_keyword( $message )
			|| Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::message_requests_faq_schema( $message )
			|| Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::message_requests_seo_research_brief( $message )
			|| Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::message_requests_date_modifier( $message )
			|| Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::message_clear_meta_field_hub_key( $message ) !== ''
		) {
			return false;
		}

		$fields = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::fields_requested_for_meta_write( $message );
		return in_array( 'seoTitle', $fields, true ) && in_array( 'metaDescription', $fields, true );
	}

	/**
	 * @param array<string, mixed>           $params
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	public static function run( string $message, array $history, array $params ): array {
		if ( is_array( self::$test_subagent_outputs ) ) {
			Neo_Pulse_Wp_Backend_Assist_Subagent_Aiseo::$test_outputs = self::$test_subagent_outputs;
		}

		$agent_ids = array( 'seo_title', 'meta_description' );
		if ( ! empty( $params['agents'] ) && is_array( $params['agents'] ) ) {
			$agent_ids = array_values( array_map( 'strval', $params['agents'] ) );
		}

		$result = Neo_Pulse_Wp_Backend_Assist_Subagent_Registry::run_agents( $message, $history, $params, $agent_ids );
		Neo_Pulse_Wp_Backend_Assist_Subagent_Aiseo::$test_outputs = null;

		if ( empty( $result['success'] ) ) {
			$error = isset( $result['error'] ) ? (string) $result['error'] : __( 'Meta upload did not save SEO title and meta description.', 'neo-pulse-wp' );
			return Neo_Pulse_Wp_Backend_Assist_Cards::enrich_card(
				Neo_Pulse_Wp_Backend_Assist_Cards::action_card(
					array(
						'success' => false,
						'error'   => $error,
					),
					'save_post_meta'
				),
				'save_post_meta',
				array( 'success' => false, 'error' => $error )
			);
		}

		$saved = isset( $result['saved'] ) && is_array( $result['saved'] ) ? $result['saved'] : array();
		if (
			in_array( 'seo_title', $agent_ids, true )
			&& in_array( 'meta_description', $agent_ids, true )
			&& ( ! in_array( 'title', $saved, true ) || ! in_array( 'excerpt', $saved, true ) )
		) {
			$error = isset( $result['error'] ) ? (string) $result['error'] : __( 'Meta upload did not save SEO title and meta description.', 'neo-pulse-wp' );
			$result['success'] = false;
			$result['error']   = $error;
			return Neo_Pulse_Wp_Backend_Assist_Cards::enrich_card(
				Neo_Pulse_Wp_Backend_Assist_Cards::action_card( $result, 'save_post_meta' ),
				'save_post_meta',
				$result
			);
		}

		return Neo_Pulse_Wp_Backend_Assist_Cards::enrich_card(
			Neo_Pulse_Wp_Backend_Assist_Cards::action_card( $result, 'save_post_meta' ),
			'save_post_meta',
			$result
		);
	}

	/**
	 * Plan cache shape for Build mode (no pre-generated copy).
	 *
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>
	 */
	public static function plan_cache_params( array $params, string $message = '' ): array {
		if ( $message === '' ) {
			$post_id = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::resolve_effective_post_id( $params );
			$out     = array(
				'meta_compound' => true,
				'agents'        => array( 'seo_title', 'meta_description' ),
			);
			if ( $post_id > 0 ) {
				$out['post_id'] = $post_id;
			}
			return $out;
		}
		return Neo_Pulse_Wp_Backend_Assist_Subagent_Registry::plan_cache_params( $message, $params );
	}
}
