<?php
/**
 * Mobile push notification action catalog (mirrors src/lib/mobile-push/notification-actions.ts).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Push_Notification_Actions {

	/**
	 * @return array<string,array<string,mixed>>
	 */
	public static function catalog(): array {
		return array(
			'chat.mention'       => array(
				'id'              => 'chat.mention',
				'category'        => 'chat',
				'label'           => 'Mentions',
				'description'     => 'When someone @mentions you in chat',
				'prefKey'         => 'mentions',
				'defaultEnabled'  => true,
			),
			'chat.dm'            => array(
				'id'              => 'chat.dm',
				'category'        => 'chat',
				'label'           => 'Direct messages',
				'description'     => 'New messages in a DM conversation',
				'prefKey'         => 'dms',
				'defaultEnabled'  => true,
			),
			'chat.thread'        => array(
				'id'              => 'chat.thread',
				'category'        => 'chat',
				'label'           => 'Thread replies',
				'description'     => 'Replies in threads you follow',
				'prefKey'         => 'threads',
				'defaultEnabled'  => true,
			),
			'chat.call'          => array(
				'id'              => 'chat.call',
				'category'        => 'chat',
				'label'           => 'Incoming calls',
				'description'     => 'When someone starts a call with you',
				'prefKey'         => 'calls',
				'defaultEnabled'  => true,
			),
			'chat.channel'       => array(
				'id'              => 'chat.channel',
				'category'        => 'chat',
				'label'           => 'Channel messages',
				'description'     => 'New messages in channels you watch',
				'prefKey'         => 'channelMessages',
				'defaultEnabled'  => false,
			),
			'task.assigned'      => array(
				'id'              => 'task.assigned',
				'category'        => 'tasks',
				'label'           => 'Task assigned',
				'description'     => 'When a task is assigned to you',
				'prefKey'         => 'taskAssigned',
				'defaultEnabled'  => true,
			),
			'agent.run_complete' => array(
				'id'              => 'agent.run_complete',
				'category'        => 'agents',
				'label'           => 'Agent finished',
				'description'     => 'When an agent run completes or fails',
				'prefKey'         => 'agentRuns',
				'defaultEnabled'  => true,
			),
		);
	}

	public static function is_valid( string $action_id ): bool {
		return isset( self::catalog()[ $action_id ] );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( string $action_id ): ?array {
		$catalog = self::catalog();
		return $catalog[ $action_id ] ?? null;
	}

	/**
	 * @return array<string,bool>
	 */
	public static function default_preferences(): array {
		$defaults = array();
		foreach ( self::catalog() as $action ) {
			$defaults[ (string) $action['prefKey'] ] = ! empty( $action['defaultEnabled'] );
		}
		return $defaults;
	}

	public static function truncate( string $text, int $max = 120 ): string {
		$text = trim( wp_strip_all_tags( $text ) );
		if ( strlen( $text ) <= $max ) {
			return $text;
		}
		if ( function_exists( 'mb_substr' ) ) {
			return rtrim( mb_substr( $text, 0, $max - 1 ) ) . '…';
		}
		return rtrim( substr( $text, 0, $max - 1 ) ) . '…';
	}

	/**
	 * @param array<string,mixed> $context
	 * @return array{title:string,body:string,data:array<string,string>}|null
	 */
	public static function build_notification( string $action_id, array $context ): ?array {
		if ( ! self::is_valid( $action_id ) ) {
			return null;
		}

		$team_id = (int) ( $context['teamId'] ?? 0 );
		if ( $team_id <= 0 ) {
			return null;
		}

		$data = array(
			'actionId' => $action_id,
			'teamId'   => (string) $team_id,
		);

		foreach ( array( 'channelId', 'messageId', 'threadRootId', 'taskId', 'runId' ) as $key ) {
			if ( isset( $context[ $key ] ) && (int) $context[ $key ] > 0 ) {
				$data[ $key ] = (string) (int) $context[ $key ];
			}
		}

		switch ( $action_id ) {
			case 'chat.mention':
				$title = ( trim( (string) ( $context['authorName'] ?? '' ) ) !== '' ? (string) $context['authorName'] : 'Someone' ) . ' mentioned you';
				$body  = self::truncate( (string) ( $context['bodyPreview'] ?? 'New mention' ) );
				break;
			case 'chat.dm':
				$title = trim( (string) ( $context['authorName'] ?? '' ) ) !== '' ? (string) $context['authorName'] : 'Direct message';
				$body  = self::truncate( (string) ( $context['bodyPreview'] ?? 'New message' ) );
				break;
			case 'chat.thread':
				$channel_label = trim( (string) ( $context['channelLabel'] ?? '' ) );
				$title         = 'Reply in ' . ( $channel_label !== '' ? $channel_label : 'thread' );
				$author        = trim( (string) ( $context['authorName'] ?? '' ) );
				$preview       = (string) ( $context['bodyPreview'] ?? 'New thread reply' );
				$body          = self::truncate( $author !== '' ? $author . ': ' . $preview : $preview );
				break;
			case 'chat.call':
				$title = 'Incoming call';
				$body  = ( trim( (string) ( $context['callerName'] ?? '' ) ) !== '' ? (string) $context['callerName'] : 'Someone' ) . ' is calling';
				break;
			case 'chat.channel':
				$title  = trim( (string) ( $context['channelLabel'] ?? '' ) ) !== '' ? (string) $context['channelLabel'] : 'Channel message';
				$author = trim( (string) ( $context['authorName'] ?? '' ) );
				$preview = (string) ( $context['bodyPreview'] ?? 'New message' );
				$body   = self::truncate( $author !== '' ? $author . ': ' . $preview : $preview );
				break;
			case 'task.assigned':
				$title = 'Task assigned';
				$body  = self::truncate( (string) ( $context['taskTitle'] ?? 'You have a new task' ) );
				break;
			case 'agent.run_complete':
				$status = sanitize_key( (string) ( $context['runStatus'] ?? 'done' ) );
				if ( $status === 'failed' ) {
					$title = 'Agent run failed';
				} elseif ( $status === 'cancelled' ) {
					$title = 'Agent run cancelled';
				} else {
					$title = 'Agent run complete';
				}
				$body = self::truncate( (string) ( $context['runTitle'] ?? 'Agent run finished' ) );
				break;
			default:
				return null;
		}

		return array(
			'title' => $title,
			'body'  => $body,
			'data'  => $data,
		);
	}
}
