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
			'suggested_actions' => array(
				__( 'Switch to Build mode', 'flowbie-wp' ),
			),
			'confidence'        => 'high',
		);
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
		$classification = Flowbie_Wp_Backend_Assist_Pipeline_Classify::phase_classify( $message, $history );
		if ( is_wp_error( $classification ) ) {
			return Flowbie_Wp_Backend_Assist_Cards::error_card( $classification->get_error_message() );
		}

		$intent = isset( $classification['intent'] ) ? $classification['intent'] : 'question';
		$tool   = isset( $classification['tool'] ) ? sanitize_key( (string) $classification['tool'] ) : '';

		if ( $intent !== 'action' || $tool === '' || ! self::is_write_tool( $tool ) ) {
			return self::run_ask( $message, $history );
		}

		return Flowbie_Wp_Backend_Assist_Pipeline::run_plan_preview( $message, $history, $classification );
	}

	/**
	 * @return string
	 */
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
