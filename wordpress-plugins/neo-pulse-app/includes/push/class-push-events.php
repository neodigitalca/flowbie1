<?php
/**
 * High-level push event helpers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Push_Events {

	/**
	 * @param array<string,mixed> $message
	 * @param array<string,mixed> $channel
	 */
	public static function on_message_created(
		array $message,
		array $channel,
		int $author_user_id,
		?int $parent_message_id = null
	): void {
		$team_id    = (int) ( $channel['team_id'] ?? 0 );
		$channel_id = (int) ( $channel['id'] ?? 0 );
		$message_id = (int) ( $message['id'] ?? 0 );
		if ( $team_id <= 0 || $channel_id <= 0 || $message_id <= 0 ) {
			return;
		}

		$author = Neo_Pulse_App_Teams_Store::get_user_by_id( $author_user_id );
		$author_name = $author ? (string) ( $author['display_name'] ?? '' ) : '';
		$body_preview = (string) ( $message['bodyPlain'] ?? $message['body_plain'] ?? '' );
		$channel_type = (string) ( $channel['type'] ?? '' );
		$channel_label = (string) ( $channel['name'] ?? $channel['slug'] ?? 'Channel' );

		if ( $parent_message_id ) {
			self::notify_channel_members(
				$team_id,
				$channel_id,
				$author_user_id,
				'chat.thread',
				array(
					'channelId'    => $channel_id,
					'messageId'    => $message_id,
					'threadRootId' => $parent_message_id,
					'authorName'   => $author_name,
					'channelLabel' => $channel_label,
					'bodyPreview'  => $body_preview,
				)
			);
			return;
		}

		if ( $channel_type === 'dm' ) {
			$other_id = Neo_Pulse_App_Chat_Calls::get_dm_other_user_id( $channel_id, $author_user_id );
			if ( ! $other_id || $other_id === $author_user_id ) {
				return;
			}
			Neo_Pulse_App_Push_Dispatcher::send_action(
				$other_id,
				$team_id,
				'chat.dm',
				array(
					'channelId'   => $channel_id,
					'messageId'   => $message_id,
					'authorName'  => $author_name,
					'bodyPreview' => $body_preview,
				)
			);
			return;
		}

		self::notify_channel_members(
			$team_id,
			$channel_id,
			$author_user_id,
			'chat.channel',
			array(
				'channelId'    => $channel_id,
				'messageId'    => $message_id,
				'authorName'   => $author_name,
				'channelLabel' => $channel_label,
				'bodyPreview'  => $body_preview,
			)
		);
	}

	public static function on_mention_created(
		int $team_id,
		int $channel_id,
		int $message_id,
		int $mentioned_user_id,
		int $author_user_id,
		?int $thread_root_id,
		string $body_preview,
		string $channel_label,
		string $author_name
	): void {
		if ( $mentioned_user_id <= 0 || $mentioned_user_id === $author_user_id ) {
			return;
		}
		Neo_Pulse_App_Push_Dispatcher::send_action(
			$mentioned_user_id,
			$team_id,
			'chat.mention',
			array(
				'channelId'    => $channel_id,
				'messageId'    => $message_id,
				'threadRootId' => $thread_root_id,
				'authorName'   => $author_name,
				'channelLabel' => $channel_label,
				'bodyPreview'  => $body_preview,
			)
		);
	}

	public static function on_incoming_call(
		int $team_id,
		int $channel_id,
		int $callee_user_id,
		int $caller_user_id
	): void {
		if ( $callee_user_id <= 0 || $caller_user_id === $callee_user_id ) {
			return;
		}
		$caller = Neo_Pulse_App_Teams_Store::get_user_by_id( $caller_user_id );
		Neo_Pulse_App_Push_Dispatcher::send_action(
			$callee_user_id,
			$team_id,
			'chat.call',
			array(
				'channelId'  => $channel_id,
				'callerName' => $caller ? (string) ( $caller['display_name'] ?? '' ) : 'Someone',
			)
		);
	}

	/**
	 * @param array<string,mixed> $task
	 */
	public static function on_task_assigned(
		int $team_id,
		int $assignee_user_id,
		array $task,
		int $actor_user_id
	): void {
		if ( $assignee_user_id <= 0 || $assignee_user_id === $actor_user_id ) {
			return;
		}
		Neo_Pulse_App_Push_Dispatcher::send_action(
			$assignee_user_id,
			$team_id,
			'task.assigned',
			array(
				'taskId'    => (int) ( $task['id'] ?? 0 ),
				'taskTitle' => (string) ( $task['title'] ?? 'Task' ),
			)
		);
	}

	/**
	 * @param array<string,mixed> $run
	 */
	public static function on_agent_run_terminal( array $run, string $previous_status ): void {
		$status = sanitize_key( (string) ( $run['status'] ?? '' ) );
		if ( ! in_array( $status, array( 'done', 'failed', 'cancelled' ), true ) ) {
			return;
		}
		if ( in_array( $previous_status, array( 'done', 'failed', 'cancelled' ), true ) ) {
			return;
		}

		$user_id = (int) ( $run['createdBy'] ?? $run['created_by'] ?? 0 );
		$team_id = (int) ( $run['teamId'] ?? $run['team_id'] ?? 0 );
		if ( $user_id <= 0 || $team_id <= 0 ) {
			return;
		}

		Neo_Pulse_App_Push_Dispatcher::send_action(
			$user_id,
			$team_id,
			'agent.run_complete',
			array(
				'runId'     => (int) ( $run['id'] ?? 0 ),
				'runTitle'  => (string) ( $run['title'] ?? 'Agent run' ),
				'runStatus' => $status,
			)
		);
	}

	/**
	 * @param array<string,mixed> $context
	 */
	private static function notify_channel_members(
		int $team_id,
		int $channel_id,
		int $author_user_id,
		string $action_id,
		array $context
	): void {
		global $wpdb;
		$rows = $wpdb->get_col(
			$wpdb->prepare(
				'SELECT user_id FROM ' . $wpdb->prefix . 'neo_pulse_chat_channel_members WHERE channel_id = %d',
				$channel_id
			)
		);
		if ( ! is_array( $rows ) ) {
			return;
		}
		foreach ( $rows as $member_id ) {
			$uid = (int) $member_id;
			if ( $uid <= 0 || $uid === $author_user_id ) {
				continue;
			}
			if ( ! Neo_Pulse_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $uid ) ) {
				continue;
			}
			Neo_Pulse_App_Push_Dispatcher::send_action( $uid, $team_id, $action_id, $context );
		}
	}
}
