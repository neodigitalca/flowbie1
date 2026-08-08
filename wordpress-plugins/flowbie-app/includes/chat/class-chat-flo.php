<?php
/**
 * Default AI teammate "FLO" for team chat.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Chat_Flo {

	const EMAIL        = 'flo@flowbie.system';
	const DISPLAY_NAME = 'FLO';

	/** @var int|null */
	private static $user_id_cache = null;

	public static function avatar_url(): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
			. '<circle cx="32" cy="32" r="32" fill="#18181b"/>'
			. '<path fill="#a3e635" d="M32 10l5 16h16l-13 10 5 16-13-10-13 10 5-16-13-10h16z"/>'
			. '</svg>';
		return 'data:image/svg+xml,' . rawurlencode( $svg );
	}

	public static function ensure_global_user(): int {
		if ( self::$user_id_cache !== null && self::$user_id_cache > 0 ) {
			return self::$user_id_cache;
		}

		$existing = Flowbie_App_Teams_Store::get_user_by_email( self::EMAIL );
		if ( is_array( $existing ) ) {
			global $wpdb;
			$wpdb->update(
				$wpdb->prefix . 'flowbie_users',
				array(
					'display_name' => self::DISPLAY_NAME,
					'avatar_url'   => self::avatar_url(),
				),
				array( 'id' => (int) $existing['id'] ),
				array( '%s', '%s' ),
				array( '%d' )
			);
			self::$user_id_cache = (int) $existing['id'];
			return self::$user_id_cache;
		}

		self::$user_id_cache = Flowbie_App_Teams_Store::create_user(
			self::EMAIL,
			wp_generate_password( 48, true, true ),
			self::DISPLAY_NAME
		);
		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'flowbie_users',
			array( 'avatar_url' => self::avatar_url() ),
			array( 'id' => self::$user_id_cache ),
			array( '%s' ),
			array( '%d' )
		);
		return self::$user_id_cache;
	}

	public static function user_id(): int {
		return self::ensure_global_user();
	}

	public static function is_flo( int $user_id ): bool {
		return $user_id > 0 && $user_id === self::user_id();
	}

	public static function ensure_team_member( int $team_id ): void {
		self::ensure_global_user();
		$flo_id = self::user_id();
		if ( Flowbie_App_Teams_Store::get_membership( $team_id, $flo_id ) ) {
			return;
		}

		$perms = Flowbie_App_Teams_Store::permissions_for_role( 'viewer' );
		$perms['communication'] = array( 'read' => true, 'write' => true );

		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'flowbie_team_members',
			array(
				'team_id'          => $team_id,
				'user_id'          => $flo_id,
				'access_role'      => 'viewer',
				'job_title'        => 'AI Assistant',
				'permissions_json' => wp_json_encode( $perms ),
				'profile_json'     => wp_json_encode( array( 'isBot' => true ) ),
				'status'           => 'active',
			),
			array( '%d', '%d', '%s', '%s', '%s', '%s', '%s' )
		);
	}

	public static function ensure_all_teams(): void {
		global $wpdb;
		$ids = $wpdb->get_col( 'SELECT id FROM ' . $wpdb->prefix . 'flowbie_teams' );
		if ( ! is_array( $ids ) ) {
			return;
		}
		foreach ( $ids as $team_id ) {
			self::ensure_team_member( (int) $team_id );
		}
	}

	/**
	 * @param array<string,mixed> $message
	 * @param array<int,int>      $mentioned_user_ids
	 * @return array<string,mixed>|null
	 */
	public static function maybe_reply_to_message(
		int $team_id,
		int $channel_id,
		array $message,
		int $author_user_id,
		array $mentioned_user_ids
	): ?array {
		$flo_id = self::user_id();
		if ( $author_user_id === $flo_id ) {
			return null;
		}
		if ( ! self::should_reply( $channel_id, $mentioned_user_ids, $message ) ) {
			return null;
		}

		$reply = self::generate_reply( $team_id, $channel_id, $message, $author_user_id );
		if ( $reply === '' ) {
			return null;
		}

		$thread_parent = self::thread_parent_for_reply( $channel_id, $message, $mentioned_user_ids );

		return Flowbie_App_Chat_Store::create_message(
			$channel_id,
			$flo_id,
			self::text_to_html( $reply ),
			$thread_parent,
			array(),
			array()
		);
	}

	/**
	 * @param array<int,int>      $mentioned_user_ids
	 * @param array<string,mixed> $message
	 */
	public static function maybe_start_huddle_from_message(
		int $team_id,
		int $channel_id,
		array $message,
		int $author_user_id,
		array $mentioned_user_ids
	): ?array {
		if ( ! self::message_requests_huddle( $message, $mentioned_user_ids ) ) {
			return null;
		}
		$call = Flowbie_App_Chat_Calls::start_flo_huddle( $team_id, $channel_id, $author_user_id );
		return is_array( $call ) ? $call : null;
	}

	/**
	 * @param array<int,int>      $mentioned_user_ids
	 * @param array<string,mixed> $message
	 */
	public static function message_requests_huddle( array $message, array $mentioned_user_ids ): bool {
		$flo_id = self::user_id();
		if ( ! in_array( $flo_id, $mentioned_user_ids, true ) && ! self::was_explicitly_mentioned( $mentioned_user_ids, $message ) ) {
			return false;
		}

		$plain = isset( $message['bodyPlain'] ) ? (string) $message['bodyPlain'] : '';
		if ( $plain === '' && isset( $message['bodyHtml'] ) ) {
			$plain = Flowbie_App_Chat_Store::html_to_plain( (string) $message['bodyHtml'] );
		}
		if ( $plain === '' ) {
			return false;
		}

		return (bool) preg_match( '/\bhuddle\b/i', $plain );
	}

	/**
	 * @return array<string,mixed>|null FLO transcript line payload.
	 */
	public static function handle_flo_call_audio(
		int $team_id,
		int $call_id,
		int $speaker_user_id,
		string $display_name,
		string $audio_b64,
		string $format,
		int $spoken_at_ms
	): ?array {
		$call = Flowbie_App_Chat_Calls::get_call( $call_id );
		if ( ! is_array( $call ) || (int) $call['team_id'] !== $team_id ) {
			return array( 'ok' => false, 'error' => 'Call not found', 'code' => 'not_found' );
		}
		if ( ! Flowbie_App_Chat_Calls::user_is_participant( $call, $speaker_user_id ) ) {
			return array( 'ok' => false, 'error' => 'Forbidden', 'code' => 'forbidden' );
		}
		if ( (string) $call['status'] !== 'active' ) {
			return array( 'ok' => false, 'error' => 'Call not active', 'code' => 'inactive' );
		}

		$flo_id = self::user_id();
		if ( self::is_flo( $speaker_user_id ) ) {
			return array( 'ok' => false, 'error' => 'FLO cannot transcribe itself', 'code' => 'invalid_speaker' );
		}
		if ( ! self::is_flo( (int) $call['caller_user_id'] ) && ! self::is_flo( (int) $call['callee_user_id'] ) ) {
			return array( 'ok' => false, 'error' => 'Not a FLO huddle', 'code' => 'not_flo_huddle' );
		}

		if ( Flowbie_App_Chat_Openrouter::api_key_from_request( array() ) === '' ) {
			return array( 'ok' => false, 'error' => 'OpenRouter API key missing', 'code' => 'missing_api_key' );
		}

		$text = Flowbie_App_Chat_Openrouter::transcribe_audio( $audio_b64, $format );
		if ( $text === '' ) {
			return array( 'ok' => false, 'error' => 'No speech detected', 'code' => 'no_speech' );
		}

		Flowbie_App_Chat_Calls::append_transcript( $call_id, $speaker_user_id, $display_name, $text, $spoken_at_ms );

		if ( ! self::utterance_addresses_flo( $text ) ) {
			return array(
				'ok'        => true,
				'userText'  => $text,
				'floLine'   => null,
				'addressed' => false,
			);
		}

		$channel_id = (int) $call['channel_id'];
		$flo_reply  = self::generate_call_reply( $team_id, $channel_id, $text, $speaker_user_id );
		if ( $flo_reply === '' ) {
			return array(
				'ok'        => true,
				'userText'  => $text,
				'floLine'   => null,
				'addressed' => true,
			);
		}

		Flowbie_App_Chat_Calls::append_transcript(
			$call_id,
			$flo_id,
			self::DISPLAY_NAME,
			$flo_reply,
			$spoken_at_ms + 1
		);

		return array(
			'ok'        => true,
			'userText'  => $text,
			'addressed' => true,
			'floLine'   => array(
				'userId'      => $flo_id,
				'displayName' => self::DISPLAY_NAME,
				'text'        => $flo_reply,
				'spokenAtMs'  => $spoken_at_ms + 1,
			),
		);
	}

	public static function utterance_addresses_flo( string $text ): bool {
		$text = trim( $text );
		if ( $text === '' ) {
			return false;
		}
		if ( preg_match( '/@FLO\b/i', $text ) ) {
			return true;
		}
		if ( preg_match( '/\b(hey|hi|ok|okay)\s+flo\b/i', $text ) ) {
			return true;
		}
		if ( preg_match( '/^flo[,:\s]/i', $text ) ) {
			return true;
		}
		return false;
	}

	/**
	 * @param array<int,int>        $mentioned_user_ids
	 * @param array<string,mixed>   $message
	 */
	private static function should_reply( int $channel_id, array $mentioned_user_ids, array $message = array() ): bool {
		$flo_id = self::user_id();
		if ( in_array( $flo_id, $mentioned_user_ids, true ) ) {
			return true;
		}

		$plain = isset( $message['bodyPlain'] ) ? (string) $message['bodyPlain'] : '';
		if ( $plain === '' && isset( $message['bodyHtml'] ) ) {
			$plain = Flowbie_App_Chat_Store::html_to_plain( (string) $message['bodyHtml'] );
		}
		if ( $plain !== '' && preg_match( '/@FLO\b/i', $plain ) ) {
			return true;
		}

		$channel = Flowbie_App_Chat_Store::get_channel( $channel_id );
		if ( ! $channel || (string) $channel['type'] !== 'dm' ) {
			return false;
		}

		return self::channel_has_flo( $channel_id );
	}

	/**
	 * @param array<int,int>      $mentioned_user_ids
	 * @param array<string,mixed> $message
	 */
	private static function was_explicitly_mentioned( array $mentioned_user_ids, array $message ): bool {
		$flo_id = self::user_id();
		if ( in_array( $flo_id, $mentioned_user_ids, true ) ) {
			return true;
		}

		$plain = isset( $message['bodyPlain'] ) ? (string) $message['bodyPlain'] : '';
		if ( $plain === '' && isset( $message['bodyHtml'] ) ) {
			$plain = Flowbie_App_Chat_Store::html_to_plain( (string) $message['bodyHtml'] );
		}

		return $plain !== '' && preg_match( '/@FLO\b/i', $plain );
	}

	/**
	 * @param array<int,int>      $mentioned_user_ids
	 * @param array<string,mixed> $message
	 */
	private static function thread_parent_for_reply( int $channel_id, array $message, array $mentioned_user_ids ): ?int {
		if ( ! self::was_explicitly_mentioned( $mentioned_user_ids, $message ) ) {
			return null;
		}

		$channel = Flowbie_App_Chat_Store::get_channel( $channel_id );
		if ( ! $channel || (string) $channel['type'] === 'dm' ) {
			return null;
		}

		$message_id = isset( $message['id'] ) ? (int) $message['id'] : 0;
		if ( $message_id <= 0 ) {
			return null;
		}

		if ( ! empty( $message['parentMessageId'] ) ) {
			return (int) $message['parentMessageId'];
		}

		return $message_id;
	}

	private static function channel_has_flo( int $channel_id ): bool {
		global $wpdb;
		$flo_id = self::user_id();
		$found  = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT user_id FROM ' . $wpdb->prefix . 'flowbie_chat_channel_members WHERE channel_id = %d AND user_id = %d LIMIT 1',
				$channel_id,
				$flo_id
			)
		);
		return (int) $found === $flo_id;
	}

	/**
	 * @param array<string,mixed> $message
	 */
	private static function generate_reply( int $team_id, int $channel_id, array $message, int $author_user_id ): string {
		$author = Flowbie_App_Teams_Store::get_user_by_id( $author_user_id );
		$name   = $author ? (string) $author['display_name'] : 'Teammate';
		$body   = isset( $message['bodyPlain'] ) ? (string) $message['bodyPlain'] : '';
		if ( $body === '' && isset( $message['bodyHtml'] ) ) {
			$body = Flowbie_App_Chat_Store::html_to_plain( (string) $message['bodyHtml'] );
		}

		$lines = array();
		foreach ( self::recent_context_lines( $channel_id ) as $line ) {
			$lines[] = $line;
		}
		$lines[] = $name . ': ' . $body;

		$messages = array(
			array(
				'role'    => 'system',
				'content' => 'You are FLO, the Flowbie team AI assistant. Reply helpfully and concisely in plain text (no markdown). '
					. 'You help with SEO, content, workflows, and general team questions. Keep replies under 120 words unless asked for detail.',
			),
			array(
				'role'    => 'user',
				'content' => "Recent chat:\n" . implode( "\n", $lines ) . "\n\nReply to the latest message.",
			),
		);

		return Flowbie_App_Chat_Openrouter::chat_text( $messages );
	}

	private static function generate_call_reply( int $team_id, int $channel_id, string $utterance, int $author_user_id ): string {
		$author = Flowbie_App_Teams_Store::get_user_by_id( $author_user_id );
		$name   = $author ? (string) $author['display_name'] : 'Teammate';

		$messages = array(
			array(
				'role'    => 'system',
				'content' => 'You are FLO on a live voice call in Flowbie chat. Reply in plain text, conversational, under 80 words. No markdown.',
			),
			array(
				'role'    => 'user',
				'content' => $name . ' said: "' . $utterance . '"',
			),
		);

		return Flowbie_App_Chat_Openrouter::chat_text( $messages );
	}

	/**
	 * @return array<int,string>
	 */
	private static function recent_context_lines( int $channel_id ): array {
		$messages = Flowbie_App_Chat_Store::list_messages( $channel_id, 0, 0, 16, 'channel', 0 );
		$lines    = array();
		foreach ( $messages as $msg ) {
			$name = isset( $msg['displayName'] ) ? (string) $msg['displayName'] : 'User';
			$plain = isset( $msg['bodyPlain'] ) ? (string) $msg['bodyPlain'] : '';
			if ( $plain === '' ) {
				continue;
			}
			$lines[] = $name . ': ' . $plain;
		}
		return $lines;
	}

	private static function text_to_html( string $text ): string {
		$parts = preg_split( '/\R+/', trim( $text ) );
		if ( ! is_array( $parts ) ) {
			$parts = array( $text );
		}
		$out = '';
		foreach ( $parts as $part ) {
			$part = trim( (string) $part );
			if ( $part === '' ) {
				continue;
			}
			$out .= '<p>' . esc_html( $part ) . '</p>';
		}
		return $out !== '' ? $out : '<p></p>';
	}
}
