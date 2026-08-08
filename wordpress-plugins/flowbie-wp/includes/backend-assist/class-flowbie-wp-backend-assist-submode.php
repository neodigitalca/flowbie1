<?php
/**
 * Backend Assist — Super Admin Ask / Plan / Build submodes.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Submode {

	/** @var array<int, string> */
	private static $read_only_tools = array(
		'get_chat_insights',
		'get_search_insights',
		'get_overseer_summary',
		'list_overseer_tasks',
		'get_site_inventory',
		'analyze_content_gaps',
		'grade_post_library_seo',
		'get_gsc_context',
		'list_posts',
		'get_post',
		'list_seo_blocks',
	);

	public static function normalize_submode( string $submode ): string {
		$submode = sanitize_key( $submode );
		if ( in_array( $submode, array( 'ask', 'plan', 'build' ), true ) ) {
			return $submode;
		}
		return 'ask';
	}

	public static function is_write_tool( string $tool ): bool {
		$tool = sanitize_key( $tool );
		if ( $tool === '' ) {
			return false;
		}
		return ! in_array( $tool, self::$read_only_tools, true );
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function blocked_card( string $submode, string $tool ): array {
		$tool_label = str_replace( '_', ' ', sanitize_key( $tool ) );
		$body       = $submode === 'plan'
			? __( 'This request would change site content. Review the plan, then switch to **Build** to run it.', 'flowbie-wp' )
			: __( 'This request would change site content. Switch to **Build** mode to make changes.', 'flowbie-wp' );

		return array(
			'type'              => 'answer',
			'title'             => __( 'Read-only mode', 'flowbie-wp' ),
			'body'              => $body . ' ' . sprintf(
				/* translators: %s: tool name */
				__( 'Detected action: %s.', 'flowbie-wp' ),
				$tool_label
			),
			'links'             => array(),
			'submode_switch'    => 'build',
			'suggested_actions' => array(
				__( 'Switch to Build mode', 'flowbie-wp' ),
			),
			'confidence'        => 'high',
		);
	}

	/**
	 * UI mode-switch phrases (composer chip), not tool actions.
	 */
	public static function submode_switch_target( string $message ): string {
		$normalized = strtolower( trim( $message ) );
		if ( $normalized === '' ) {
			return '';
		}
		if ( in_array( $normalized, array( 'switch to build mode', 'switch to build' ), true ) ) {
			return 'build';
		}
		if ( in_array( $normalized, array( 'switch to plan mode', 'switch to plan' ), true ) ) {
			return 'plan';
		}
		if ( in_array( $normalized, array( 'switch to ask mode', 'switch to ask' ), true ) ) {
			return 'ask';
		}
		return '';
	}

	/**
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	public static function run_for_submode( string $submode, string $message, array $history ): array {
		$submode = self::normalize_submode( $submode );
		if ( $submode === 'build' ) {
			return Flowbie_Wp_Backend_Assist_Pipeline::run_pipeline( $message, $history );
		}
		if ( $submode === 'plan' ) {
			return self::run_plan( $message, $history );
		}
		return self::run_ask( $message, $history );
	}

	/**
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	public static function run_ask( string $message, array $history ): array {
		$switch_target = self::submode_switch_target( $message );
		if ( $switch_target !== '' ) {
			return self::submode_switch_card( $switch_target );
		}

		$classification = Flowbie_Wp_Backend_Assist_Pipeline_Classify::phase_classify( $message, $history );
		if ( is_wp_error( $classification ) ) {
			return Flowbie_Wp_Backend_Assist_Cards::error_card( $classification->get_error_message() );
		}

		$intent = isset( $classification['intent'] ) ? $classification['intent'] : 'question';
		$tool   = isset( $classification['tool'] ) ? sanitize_key( (string) $classification['tool'] ) : '';

		if ( $intent === 'action' && $tool !== '' && self::is_write_tool( $tool ) ) {
			return self::blocked_card( 'ask', $tool );
		}

		return Flowbie_Wp_Backend_Assist_Pipeline::run_from_classification( $classification, $message, $history );
	}

	/**
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>
	 */
	public static function run_plan( string $message, array $history ): array {
		$switch_target = self::submode_switch_target( $message );
		if ( $switch_target !== '' ) {
			return self::submode_switch_card( $switch_target );
		}

		$classification = Flowbie_Wp_Backend_Assist_Pipeline_Classify::phase_classify( $message, $history );
		if ( is_wp_error( $classification ) ) {
			return Flowbie_Wp_Backend_Assist_Cards::error_card( $classification->get_error_message() );
		}

		$intent = isset( $classification['intent'] ) ? $classification['intent'] : 'question';
		$tool   = isset( $classification['tool'] ) ? sanitize_key( (string) $classification['tool'] ) : '';

		if ( $intent !== 'action' || $tool === '' || ! self::is_write_tool( $tool ) ) {
			return Flowbie_Wp_Backend_Assist_Pipeline::run_from_classification( $classification, $message, $history );
		}

		return Flowbie_Wp_Backend_Assist_Pipeline::run_plan_preview( $message, $history, $classification );
	}

	/**
	 * @return string
	 */
	/**
	 * @return array<string, mixed>
	 */
	public static function submode_switch_card( string $target ): array {
		$target = self::normalize_submode( $target );
		$labels = array(
			'ask'   => __( 'Ask', 'flowbie-wp' ),
			'plan'  => __( 'Plan', 'flowbie-wp' ),
			'build' => __( 'Build', 'flowbie-wp' ),
		);
		$label  = isset( $labels[ $target ] ) ? $labels[ $target ] : $labels['ask'];

		return array(
			'type'           => 'answer',
			'title'          => __( 'Switch mode in the composer', 'flowbie-wp' ),
			'body'           => sprintf(
				/* translators: %s: Ask, Plan, or Build */
				__( 'Use the **%s** pill next to the send button to change God Mode mode. Your last request can be resent after switching.', 'flowbie-wp' ),
				$label
			),
			'links'          => array(),
			'submode_switch' => $target,
			'confidence'     => 'high',
		);
	}

	public static function stream_search_label( string $submode ): string {
		$submode = self::normalize_submode( $submode );
		if ( $submode === 'plan' ) {
			return __( 'Planning…', 'flowbie-wp' );
		}
		if ( $submode === 'build' ) {
			return __( 'Working…', 'flowbie-wp' );
		}
		return __( 'Analyzing…', 'flowbie-wp' );
	}
}
