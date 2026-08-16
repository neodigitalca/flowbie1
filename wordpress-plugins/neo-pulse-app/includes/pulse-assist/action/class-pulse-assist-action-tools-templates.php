<?php
/**
 * Pulse Assist template tools (save/load/delete).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Action_Tools_Templates {

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function run( string $tool_id, array $args, array $body, int $user_id ): array {
		$team_id = Neo_Pulse_App_Pulse_Assist_Action_Tools_Tasks::resolve_team_id( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required for template actions.' );
		}

		switch ( sanitize_key( $tool_id ) ) {
			case 'tasks_save_template':
				return self::save_template( $team_id, $args );
			case 'tasks_delete_template':
				return self::delete_template( $team_id, $args );
			default:
				return array( 'ok' => false, 'error' => 'Unknown template tool.' );
		}
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	private static function save_template( int $team_id, array $args ): array {
		$template = array(
			'keyword'      => isset( $args['keyword'] ) ? sanitize_title( (string) $args['keyword'] ) : '',
			'name'         => isset( $args['name'] ) ? sanitize_text_field( (string) $args['name'] ) : '',
			'defaultTasks' => isset( $args['defaultTasks'] ) && is_array( $args['defaultTasks'] ) ? $args['defaultTasks'] : array(),
		);
		if ( $template['keyword'] === '' || $template['name'] === '' ) {
			return array( 'ok' => false, 'error' => 'Template keyword and name are required.' );
		}
		if ( ! Neo_Pulse_App_Tasks_Store::upsert_template( $team_id, $template ) ) {
			return array( 'ok' => false, 'error' => 'Could not save template.' );
		}
		$saved = Neo_Pulse_App_Tasks_Store::get_template_by_keyword( $team_id, $template['keyword'] );
		return array(
			'ok'       => true,
			'template' => $saved,
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	private static function delete_template( int $team_id, array $args ): array {
		$keyword = sanitize_title( (string) ( $args['keyword'] ?? '' ) );
		if ( $keyword === '' ) {
			return array( 'ok' => false, 'error' => 'Template keyword is required.' );
		}
		if ( ! Neo_Pulse_App_Tasks_Store::delete_template( $team_id, $keyword ) ) {
			return array( 'ok' => false, 'error' => 'Template not found.' );
		}
		return array(
			'ok'      => true,
			'keyword' => $keyword,
		);
	}
}
