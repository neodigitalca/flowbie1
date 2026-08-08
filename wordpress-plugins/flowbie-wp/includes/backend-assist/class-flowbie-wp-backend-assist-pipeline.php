<?php
/**
 * Backend Assist — orchestrates single-shot and plan-mode pipelines
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Pipeline {

	public static function run_pipeline( string $message, array $history ): array {
		$classification = Flowbie_Wp_Backend_Assist_Pipeline_Classify::phase_classify( $message, $history );
		if ( is_wp_error( $classification ) ) {
			return Flowbie_Wp_Backend_Assist_Cards::error_card( $classification->get_error_message() );
		}

		return self::run_from_classification( $classification, $message, $history );
	}

	/**
	 * @param array<string, mixed>           $classification
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	public static function run_from_classification( array $classification, string $message, array $history ): array {
		$intent = isset( $classification['intent'] ) ? $classification['intent'] : 'question';
		$tool   = isset( $classification['tool'] ) ? $classification['tool'] : '';
		$params = isset( $classification['params'] ) && is_array( $classification['params'] ) ? $classification['params'] : array();

		if ( $intent === 'needs_info' && $tool !== '' ) {
			$missing = isset( $classification['missing'] ) && is_array( $classification['missing'] ) ? $classification['missing'] : array();
			return Flowbie_Wp_Backend_Assist_Cards::needs_info_card( $tool, $missing );
		}

		if ( $intent === 'action' && $tool !== '' && isset( Flowbie_Wp_Backend_Assist_Context::$tool_registry[ $tool ] ) ) {
			$prepared    = Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::prepare_tool_params( $message, $history, $tool, $params );
			$tool        = $prepared['tool'];
			$params      = $prepared['params'];
			$exec_result = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_execute( $tool, $params );
			if ( ! empty( $exec_result['success'] ) && in_array( $tool, array( 'compose_seo_block', 'modify_seo_block_slots' ), true ) ) {
				return Flowbie_Wp_Backend_Assist_Cards::action_card( $exec_result, $tool );
			}
			$answer      = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_reason_action( $message, $history, $tool, $params, $exec_result );
			if ( is_wp_error( $answer ) ) {
				return Flowbie_Wp_Backend_Assist_Cards::action_card( $exec_result, $tool );
			}
			$card = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_format( $answer, 'action' );
			if ( is_wp_error( $card ) ) {
				return Flowbie_Wp_Backend_Assist_Cards::action_card( $exec_result, $tool );
			}
			$card['action_result'] = $exec_result;
			return $card;
		}

		$answer = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_reason_question( $message, $history );
		if ( is_wp_error( $answer ) ) {
			return Flowbie_Wp_Backend_Assist_Cards::error_card( $answer->get_error_message() );
		}

		$card = Flowbie_Wp_Backend_Assist_Pipeline_Phases::phase_format( $answer, 'answer' );
		if ( is_wp_error( $card ) ) {
			return array(
				'type'       => 'answer',
				'title'      => __( 'Here\'s what I found', 'flowbie-wp' ),
				'body'       => $answer,
				'links'      => array(),
				'confidence' => 'medium',
			);
		}

		return $card;
	}
	public static function run_plan( string $message, array $history ): array {
		$decomposed = Flowbie_Wp_Backend_Assist_Pipeline_Classify::phase_decompose_workflow( $message, $history );
		if ( is_wp_error( $decomposed ) ) {
			return Flowbie_Wp_Backend_Assist_Cards::error_card( $decomposed->get_error_message() );
		}

		$is_workflow = ! empty( $decomposed['workflow'] )
			&& ! empty( $decomposed['steps'] )
			&& is_array( $decomposed['steps'] )
			&& count( $decomposed['steps'] ) > 0;

		if ( ! $is_workflow ) {
			$card              = self::run_pipeline( $message, $history );
			$card['workflow']  = false;
			return $card;
		}

		$workflow_id = Flowbie_Wp_Backend_Assist_Workflow::save_workflow( $message, $history, $decomposed );
		if ( $workflow_id === '' ) {
			return Flowbie_Wp_Backend_Assist_Cards::error_card( __( 'Could not start workflow.', 'flowbie-wp' ) );
		}

		return Flowbie_Wp_Backend_Assist_Workflow::workflow_plan_card( $workflow_id );
	}

	/**
	 * Plan preview for Super Admin Plan submode (no step execution).
	 *
	 * @param array<string, mixed>           $classification
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	public static function run_plan_preview( string $message, array $history, array $classification ): array {
		$decomposed = Flowbie_Wp_Backend_Assist_Pipeline_Classify::phase_decompose_workflow( $message, $history );
		if ( is_wp_error( $decomposed ) ) {
			return Flowbie_Wp_Backend_Assist_Cards::error_card( $decomposed->get_error_message() );
		}

		$is_workflow = ! empty( $decomposed['workflow'] )
			&& ! empty( $decomposed['steps'] )
			&& is_array( $decomposed['steps'] )
			&& count( $decomposed['steps'] ) > 0;

		if ( $is_workflow ) {
			$workflow_id = Flowbie_Wp_Backend_Assist_Workflow::save_workflow( $message, $history, $decomposed );
			if ( $workflow_id === '' ) {
				return Flowbie_Wp_Backend_Assist_Cards::error_card( __( 'Could not build plan.', 'flowbie-wp' ) );
			}

			$workflow = Flowbie_Wp_Backend_Assist_Workflow::load_workflow( $workflow_id );
			$title    = ( is_array( $workflow ) && ! empty( $workflow['title'] ) )
				? (string) $workflow['title']
				: __( 'Proposed plan', 'flowbie-wp' );
			$steps    = ( is_array( $workflow ) && ! empty( $workflow['steps'] ) )
				? Flowbie_Wp_Backend_Assist_Workflow::workflow_steps_for_card( $workflow['steps'] )
				: array();

			foreach ( $steps as $i => $step ) {
				$steps[ $i ]['status'] = 'pending';
			}

			return array(
				'type'              => 'plan',
				'workflow'          => true,
				'workflow_id'       => $workflow_id,
				'title'             => $title,
				'body'              => __( 'Review this plan. Switch to Build to run it.', 'flowbie-wp' ),
				'steps'             => $steps,
				'workflow_complete' => false,
				'links'             => array(),
				'suggested_actions' => array(
					__( 'Switch to Build mode', 'flowbie-wp' ),
				),
				'confidence'        => 'high',
			);
		}

		$tool   = isset( $classification['tool'] ) ? sanitize_key( (string) $classification['tool'] ) : '';
		$params = isset( $classification['params'] ) && is_array( $classification['params'] ) ? $classification['params'] : array();
		$label  = self::plan_step_label( $tool, $params, $message );

		return array(
			'type'              => 'plan',
			'workflow'          => false,
			'title'             => __( 'Proposed plan', 'flowbie-wp' ),
			'body'              => __( 'Review this plan. Switch to Build to run it.', 'flowbie-wp' ),
			'steps'             => array(
				array(
					'label'      => $label,
					'status'     => 'pending',
					'tool'       => $tool,
					'executable' => true,
					'visible'    => true,
				),
			),
			'workflow_complete' => false,
			'links'             => array(),
			'suggested_actions' => array(
				__( 'Switch to Build mode', 'flowbie-wp' ),
			),
			'confidence'        => 'high',
		);
	}

	/**
	 * @param array<string, mixed> $params
	 */
	private static function plan_step_label( string $tool, array $params, string $message ): string {
		if ( ! empty( $params['title'] ) ) {
			return sprintf(
				/* translators: 1: tool label, 2: title */
				__( '%1$s: %2$s', 'flowbie-wp' ),
				ucwords( str_replace( '_', ' ', $tool ) ),
				sanitize_text_field( (string) $params['title'] )
			);
		}
		if ( ! empty( $params['post_id'] ) ) {
			$post_id = absint( $params['post_id'] );
			$post    = get_post( $post_id );
			$title   = $post instanceof WP_Post ? $post->post_title : (string) $post_id;
			return sprintf(
				/* translators: 1: tool label, 2: post title */
				__( '%1$s on %2$s', 'flowbie-wp' ),
				ucwords( str_replace( '_', ' ', $tool ) ),
				$title
			);
		}
		$trimmed = trim( $message );
		if ( $trimmed !== '' ) {
			return ucwords( str_replace( '_', ' ', $tool ) ) . ': ' . mb_substr( $trimmed, 0, 80 );
		}
		return ucwords( str_replace( '_', ' ', $tool ) );
	}
}
