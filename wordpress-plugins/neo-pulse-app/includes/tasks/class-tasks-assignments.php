<?php
/**
 * Task assignment notifications (DM on new human assignees).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Tasks_Assignments {

	/**
	 * @param array<string,mixed> $task
	 * @param array<int,int>      $previous_assignee_ids
	 */
	public static function notify_new_assignees(
		int $team_id,
		int $actor_user_id,
		array $task,
		array $previous_assignee_ids
	): void {
		if ( $team_id <= 0 || ! class_exists( 'Neo_Pulse_App_Chat_Store' ) ) {
			return;
		}

		Neo_Pulse_App_Chat_Store::install_tables();

		$new_assignees = is_array( $task['assigneeIds'] ?? null )
			? array_map( 'intval', $task['assigneeIds'] )
			: array();
		$previous      = array_map( 'intval', $previous_assignee_ids );
		$added         = array_values( array_diff( $new_assignees, $previous ) );
		if ( count( $added ) === 0 ) {
			return;
		}

		$flo_id = Neo_Pulse_App_Tasks_Store::pulse_bot_user_id();
		$title  = trim( (string) ( $task['title'] ?? 'Task' ) );
		$project = trim( (string) ( $task['projectTitle'] ?? '' ) );
		$client  = trim( (string) ( $task['wordpressSiteId'] ?? '' ) );

		$body_parts = array(
			'You were assigned to <strong>' . esc_html( $title ) . '</strong>',
		);
		if ( $project !== '' ) {
			$body_parts[0] .= ' in ' . esc_html( $project );
		}
		$body_parts[0] .= '.';
		if ( $client !== '' ) {
			$body_parts[] = 'Client: ' . esc_html( $client ) . '.';
		}
		$due = trim( (string) ( $task['dueDate'] ?? '' ) );
		if ( $due !== '' ) {
			$body_parts[] = 'Due: ' . esc_html( substr( $due, 0, 10 ) ) . '.';
		}
		$recurrence = Neo_Pulse_App_Tasks_Store::sanitize_recurrence_rule( $task['recurrenceRule'] ?? 'none' );
		if ( $recurrence !== 'none' ) {
			$body_parts[] = 'Recurrence: ' . esc_html( $recurrence ) . '.';
		}
		$body_html = '<p>' . implode( ' ', $body_parts ) . '</p>';

		$sender_id = $actor_user_id > 0 ? $actor_user_id : get_current_user_id();
		if ( $sender_id <= 0 ) {
			return;
		}

		foreach ( $added as $assignee_id ) {
			if ( $assignee_id <= 0 || $assignee_id === $sender_id || $assignee_id === $flo_id ) {
				continue;
			}
			if ( ! self::is_active_team_member( $team_id, $assignee_id ) ) {
				continue;
			}
			$channel = Neo_Pulse_App_Chat_Store::get_or_create_dm( $team_id, $sender_id, $assignee_id );
			if ( ! is_array( $channel ) || empty( $channel['id'] ) ) {
				continue;
			}
			Neo_Pulse_App_Chat_Store::create_message( (int) $channel['id'], $sender_id, $body_html );
			if ( class_exists( 'Neo_Pulse_App_Push_Events' ) ) {
				Neo_Pulse_App_Push_Events::on_task_assigned(
					$team_id,
					$assignee_id,
					$task,
					$sender_id
				);
			}
		}
	}

	private static function is_active_team_member( int $team_id, int $user_id ): bool {
		foreach ( Neo_Pulse_App_Teams_Store::list_members( $team_id ) as $member ) {
			if ( ! is_array( $member ) ) {
				continue;
			}
			if ( (int) ( $member['userId'] ?? 0 ) === $user_id ) {
				return true;
			}
		}
		return false;
	}
}
