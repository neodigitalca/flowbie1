<?php
/**
 * Persist inbound AgentMail messages for workflow triggers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agentmail_Inbound_Store {

	private static function processed_path(): string {
		return Neo_Pulse_App_Data_Paths::root() . '/agentmail-processed.json';
	}

	public static function is_processed( string $message_id ): bool {
		$message_id = trim( $message_id );
		if ( $message_id === '' ) {
			return true;
		}
		$data = Neo_Pulse_App_Json_File_Store::read( self::processed_path() );
		$ids  = is_array( $data ) && isset( $data['messageIds'] ) && is_array( $data['messageIds'] ) ? $data['messageIds'] : array();
		return in_array( $message_id, $ids, true );
	}

	public static function mark_processed( string $message_id ): void {
		$message_id = trim( $message_id );
		if ( $message_id === '' ) {
			return;
		}
		$data = Neo_Pulse_App_Json_File_Store::read( self::processed_path() );
		$ids  = is_array( $data ) && isset( $data['messageIds'] ) && is_array( $data['messageIds'] ) ? $data['messageIds'] : array();
		if ( in_array( $message_id, $ids, true ) ) {
			return;
		}
		$ids[] = $message_id;
		if ( count( $ids ) > 500 ) {
			$ids = array_slice( $ids, -500 );
		}
		Neo_Pulse_App_Json_File_Store::write(
			self::processed_path(),
			array(
				'messageIds' => array_values( $ids ),
				'updatedAt'  => gmdate( 'c' ),
			)
		);
	}

	private static function inbound_dir( int $team_id, string $storage_key ): string {
		return Neo_Pulse_App_Data_Paths::subdir( 'teams/' . (string) $team_id . '/agentmail-inbound/' . $storage_key );
	}

	/**
	 * @param array<string,mixed> $message
	 * @param array<int,array<string,mixed>> $attachments
	 * @return array<string,mixed>|null
	 */
	public static function save_inbound( int $team_id, array $message, array $attachments = array() ): ?array {
		$message_id = trim( (string) ( $message['message_id'] ?? $message['id'] ?? '' ) );
		if ( $message_id === '' ) {
			return null;
		}
		$storage_key = Neo_Pulse_App_Agentmail_Api::message_storage_key( $message_id );
		$dir         = self::inbound_dir( $team_id, $storage_key );
		$attach_dir  = $dir . '/attachments';
		if ( ! is_dir( $attach_dir ) ) {
			wp_mkdir_p( $attach_dir );
		}

		$saved_attachments = array();
		foreach ( $attachments as $attachment ) {
			if ( ! is_array( $attachment ) ) {
				continue;
			}
			$filename = sanitize_file_name( (string) ( $attachment['filename'] ?? 'attachment.bin' ) );
			if ( $filename === '' ) {
				$filename = 'attachment.bin';
			}
			$binary = isset( $attachment['binary'] ) && is_string( $attachment['binary'] ) ? $attachment['binary'] : '';
			if ( $binary === '' ) {
				continue;
			}
			$path = $attach_dir . '/' . $filename;
			file_put_contents( $path, $binary );
			$saved_attachments[] = array(
				'attachmentId' => (string) ( $attachment['attachment_id'] ?? $attachment['attachmentId'] ?? '' ),
				'filename'     => $filename,
				'contentType'  => (string) ( $attachment['content_type'] ?? $attachment['contentType'] ?? 'application/octet-stream' ),
				'size'         => strlen( $binary ),
			);
		}

		$record = array(
			'messageId'   => $message_id,
			'storageKey'  => $storage_key,
			'inboxId'     => (string) ( $message['inbox_id'] ?? '' ),
			'from'        => Neo_Pulse_App_Agentmail_Api::extract_sender( $message ),
			'subject'     => (string) ( $message['subject'] ?? '' ),
			'text'        => (string) ( $message['text'] ?? $message['body_text'] ?? '' ),
			'html'        => (string) ( $message['html'] ?? $message['body_html'] ?? '' ),
			'preview'     => (string) ( $message['preview'] ?? '' ),
			'attachments' => $saved_attachments,
			'receivedAt'  => gmdate( 'c' ),
		);

		file_put_contents( $dir . '/message.json', wp_json_encode( $record ) );
		return $record;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_inbound( int $team_id, string $message_id ): ?array {
		$storage_key = Neo_Pulse_App_Agentmail_Api::message_storage_key( $message_id );
		$path        = self::inbound_dir( $team_id, $storage_key ) . '/message.json';
		if ( ! is_readable( $path ) ) {
			return null;
		}
		$raw = file_get_contents( $path );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return null;
		}
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return null;
		}

		$attach_dir = self::inbound_dir( $team_id, $storage_key ) . '/attachments';
		$out_attach = array();
		$attachments = isset( $data['attachments'] ) && is_array( $data['attachments'] ) ? $data['attachments'] : array();
		foreach ( $attachments as $attachment ) {
			if ( ! is_array( $attachment ) ) {
				continue;
			}
			$filename = sanitize_file_name( (string) ( $attachment['filename'] ?? '' ) );
			$file_path = $attach_dir . '/' . $filename;
			$binary    = is_readable( $file_path ) ? file_get_contents( $file_path ) : '';
			$out_attach[] = array(
				'attachmentId' => (string) ( $attachment['attachmentId'] ?? '' ),
				'filename'     => $filename,
				'contentType'  => (string) ( $attachment['contentType'] ?? 'application/octet-stream' ),
				'size'         => is_string( $binary ) ? strlen( $binary ) : 0,
				'dataBase64'   => is_string( $binary ) && $binary !== '' ? base64_encode( $binary ) : '',
			);
		}
		$data['attachments'] = $out_attach;
		return $data;
	}
}
