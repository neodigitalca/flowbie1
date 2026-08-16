<?php
/**
 * Link preview unfurl for chat messages.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Chat_Link_Unfurl {

	/**
	 * @return array<int,string>
	 */
	public static function extract_urls( string $html ): array {
		$urls = array();
		if ( preg_match_all( '#https?://[^\s<>"\']+#i', $html, $matches ) ) {
			foreach ( $matches[0] as $url ) {
				$url = rtrim( $url, '.,);' );
				if ( self::is_internal_chat_file_url( $url ) ) {
					continue;
				}
				$urls[] = esc_url_raw( $url );
			}
		}
		return array_values( array_unique( array_filter( $urls ) ) );
	}

	public static function is_internal_chat_file_url( string $url ): bool {
		return (bool) preg_match( '#/api/teams/\d+/chat/channels/\d+/files/\d+#', $url );
	}

	/**
	 * Draft preview (no DB write).
	 *
	 * @return array<string,mixed>
	 */
	public static function preview_url( string $url ): array {
		$url = esc_url_raw( trim( $url ) );
		if ( $url === '' || self::is_internal_chat_file_url( $url ) ) {
			return array(
				'ok'    => false,
				'error' => 'Invalid URL',
			);
		}
		$meta = self::fetch_og( $url );
		return array(
			'ok'      => true,
			'preview' => array(
				'id'          => 0,
				'url'         => $url,
				'title'       => $meta['title'],
				'description' => $meta['description'],
				'imageUrl'    => $meta['imageUrl'],
				'siteName'    => $meta['siteName'],
			),
		);
	}

	public static function process_message(
		int $message_id,
		string $body_html,
		int $channel_id,
		int $team_id,
		int $user_id
	): void {
		$urls = self::extract_urls( $body_html );
		foreach ( $urls as $url ) {
			if ( self::preview_exists( $message_id, $url ) ) {
				continue;
			}
			$meta       = self::fetch_og( $url );
			$preview_id = self::save_preview( $message_id, $url, $meta );
			Neo_Pulse_App_Chat_Activity_Log::append(
				$team_id,
				$channel_id,
				array(
					'kind'                 => 'link_shared',
					'channelId'            => $channel_id,
					'messageId'            => $message_id,
					'userId'               => $user_id,
					'ts'                   => gmdate( 'c' ),
					'url'                  => $url,
					'previewId'            => $preview_id,
					'threadRootMessageId'  => Neo_Pulse_App_Chat_Store::activity_thread_root( $message_id ),
				)
			);
		}
	}

	private static function preview_exists( int $message_id, string $url ): bool {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_link_previews';
		$id    = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE message_id = %d AND url = %s",
				$message_id,
				$url
			)
		);
		return (bool) $id;
	}

	/**
	 * @param array<string,string|null> $meta
	 */
	private static function save_preview( int $message_id, string $url, array $meta ): int {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_link_previews';
		$wpdb->insert(
			$table,
			array(
				'message_id'  => $message_id,
				'url'         => $url,
				'title'       => $meta['title'],
				'description' => $meta['description'],
				'image_url'   => $meta['imageUrl'],
				'site_name'   => $meta['siteName'],
				'fetched_at'  => current_time( 'mysql', true ),
			),
			array( '%d', '%s', '%s', '%s', '%s', '%s', '%s' )
		);
		return (int) $wpdb->insert_id;
	}

	/**
	 * @return array<string,string|null>
	 */
	private static function fetch_og( string $url ): array {
		$empty = array(
			'title'       => null,
			'description' => null,
			'imageUrl'    => null,
			'siteName'    => null,
		);
		$response = wp_remote_get(
			$url,
			array(
				'timeout'     => 8,
				'redirection' => 3,
				'user-agent'  => 'NeoPulseChatPreview/1.0',
			)
		);
		if ( is_wp_error( $response ) ) {
			return $empty;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code < 200 || $code >= 400 ) {
			return $empty;
		}
		$html = (string) wp_remote_retrieve_body( $response );
		if ( $html === '' ) {
			return $empty;
		}

		$title = null;
		$desc  = null;
		$image = null;
		$site  = null;

		if ( preg_match( '#<title[^>]*>([^<]+)</title>#i', $html, $m ) ) {
			$title = trim( html_entity_decode( $m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
		}

		libxml_use_internal_errors( true );
		$doc = new DOMDocument();
		if ( @$doc->loadHTML( $html ) ) {
			$xpath = new DOMXPath( $doc );
			$nodes = $xpath->query( '//meta[@property or @name]' );
			if ( $nodes ) {
				foreach ( $nodes as $node ) {
					if ( ! $node instanceof DOMElement ) {
						continue;
					}
					$key   = strtolower( (string) ( $node->getAttribute( 'property' ) ?: $node->getAttribute( 'name' ) ) );
					$value = trim( (string) $node->getAttribute( 'content' ) );
					if ( $value === '' ) {
						continue;
					}
					if ( $key === 'og:title' && ! $title ) {
						$title = $value;
					} elseif ( $key === 'og:description' || $key === 'description' ) {
						if ( ! $desc ) {
							$desc = $value;
						}
					} elseif ( $key === 'og:image' && ! $image ) {
						$image = esc_url_raw( $value );
					} elseif ( $key === 'og:site_name' && ! $site ) {
						$site = $value;
					}
				}
			}
		}
		libxml_clear_errors();

		return array(
			'title'       => $title,
			'description' => $desc,
			'imageUrl'    => $image,
			'siteName'    => $site,
		);
	}

	/**
	 * @param array<int,int> $message_ids
	 * @return array<int,array<int,array<string,mixed>>>
	 */
	public static function get_for_messages( array $message_ids ): array {
		if ( count( $message_ids ) === 0 ) {
			return array();
		}
		global $wpdb;
		$table   = $wpdb->prefix . 'neo_pulse_chat_link_previews';
		$ids_sql = implode( ',', array_map( 'intval', $message_ids ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			"SELECT * FROM {$table} WHERE message_id IN ({$ids_sql}) ORDER BY id ASC",
			ARRAY_A
		);
		$out = array();
		if ( ! is_array( $rows ) ) {
			return $out;
		}
		foreach ( $rows as $row ) {
			$mid = (int) $row['message_id'];
			if ( ! isset( $out[ $mid ] ) ) {
				$out[ $mid ] = array();
			}
			$out[ $mid ][] = array(
				'id'          => (int) $row['id'],
				'url'         => (string) $row['url'],
				'title'       => ! empty( $row['title'] ) ? (string) $row['title'] : null,
				'description' => ! empty( $row['description'] ) ? (string) $row['description'] : null,
				'imageUrl'    => ! empty( $row['image_url'] ) ? (string) $row['image_url'] : null,
				'siteName'    => ! empty( $row['site_name'] ) ? (string) $row['site_name'] : null,
			);
		}
		return $out;
	}

	public static function clear_for_message( int $message_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'neo_pulse_chat_link_previews';
		$wpdb->delete( $table, array( 'message_id' => $message_id ), array( '%d' ) );
	}
}
