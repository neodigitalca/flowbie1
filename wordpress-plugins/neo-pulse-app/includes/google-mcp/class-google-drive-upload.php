<?php
/**
 * Google Drive deliverable upload (Drive API v3 multipart).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Drive_Upload {

	const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
	const DRIVE_FILES_URL  = 'https://www.googleapis.com/drive/v3/files';
	const TEST_PARENT_FOLDER_ID = '1YrbOxNXBkYBp7GLGlUoSd07WGU8e0VEd';
	const TEST_SUBFOLDER_NAME   = 'Flowbie Connection Tests';
	const NEO_PULSE_WORKSPACE_FOLDER_NAME = 'NEO Pulse';

	/**
	 * Upload a markdown test file into a dedicated subfolder for Settings → Test connection.
	 *
	 * @param string $parent_folder_id Optional Drive folder ID; defaults to Advanced Blinds preset.
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function upload_connection_test( string $parent_folder_id = '' ): array {
		$parent = preg_replace( '/[^a-zA-Z0-9_-]/', '', $parent_folder_id );
		if ( strlen( $parent ) < 10 ) {
			$parent = self::TEST_PARENT_FOLDER_ID;
		}

		$folder_result = self::ensure_child_folder( $parent, self::TEST_SUBFOLDER_NAME );
		if ( (int) ( $folder_result['statusCode'] ?? 500 ) !== 200 ) {
			return $folder_result;
		}
		$folder_body = isset( $folder_result['body'] ) && is_array( $folder_result['body'] ) ? $folder_result['body'] : array();
		$folder_id   = (string) ( $folder_body['folderId'] ?? '' );
		if ( $folder_id === '' ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => 'Could not create test folder on Google Drive.' ),
			);
		}

		$file_name = 'flowbie-drive-test-' . gmdate( 'Y-m-d-His' ) . '.md';
		$content   = "# Flowbie Google Drive test\n\nIf you can open this file, Drive upload works.\n\nUploaded at " . gmdate( 'c' ) . " UTC.\n";
		$upload    = self::upload_deliverable(
			array(
				'fileName'           => $file_name,
				'content'            => $content,
				'folderId'           => $folder_id,
				'mime'               => 'text/markdown',
				'convertToGoogleDoc' => true,
			)
		);
		if ( (int) ( $upload['statusCode'] ?? 500 ) !== 200 ) {
			return $upload;
		}
		$upload_body = isset( $upload['body'] ) && is_array( $upload['body'] ) ? $upload['body'] : array();
		$upload_body['folderId']   = $folder_id;
		$upload_body['folderLink'] = 'https://drive.google.com/drive/folders/' . rawurlencode( $folder_id );
		return array(
			'statusCode' => 200,
			'body'       => $upload_body,
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function find_folder( array $body ): array {
		$parent_folder_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $body['parentFolderId'] ?? '' ) );
		$name             = sanitize_text_field( (string) ( $body['name'] ?? '' ) );
		$fuzzy            = ! empty( $body['fuzzy'] );
		if ( strlen( $parent_folder_id ) < 10 ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'parentFolderId is required.' ),
			);
		}
		if ( $name === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'name is required.' ),
			);
		}

		$access_token = self::access_token_or_error();
		if ( isset( $access_token['statusCode'] ) ) {
			return $access_token;
		}

		$escaped_name = str_replace( "'", "\\'", $name );
		if ( $fuzzy ) {
			$query = sprintf(
				"'%s' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and name contains '%s'",
				$parent_folder_id,
				$escaped_name
			);
		} else {
			$query = sprintf(
				"'%s' in parents and name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
				$parent_folder_id,
				$escaped_name
			);
		}

		$list = self::list_files_query( $access_token, $query, 25 );
		if ( (int) ( $list['statusCode'] ?? 500 ) !== 200 ) {
			return $list;
		}
		$list_body = isset( $list['body'] ) && is_array( $list['body'] ) ? $list['body'] : array();
		$files     = isset( $list_body['files'] ) && is_array( $list_body['files'] ) ? $list_body['files'] : array();
		$matches   = array();
		foreach ( $files as $file ) {
			if ( ! is_array( $file ) || empty( $file['id'] ) ) {
				continue;
			}
			$matches[] = array(
				'folderId'    => (string) $file['id'],
				'name'        => (string) ( $file['name'] ?? '' ),
				'webViewLink' => (string) ( $file['webViewLink'] ?? '' ),
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success' => true,
				'matches' => $matches,
			),
		);
	}

	/**
	 * @param array<string,mixed> $query
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function list_folder_children( array $query ): array {
		$folder_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $query['folderId'] ?? '' ) );
		if ( strlen( $folder_id ) < 10 ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'folderId is required.' ),
			);
		}

		$access_token = self::access_token_or_error();
		if ( isset( $access_token['statusCode'] ) ) {
			return $access_token;
		}

		$drive_query = sprintf(
			"'%s' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
			$folder_id
		);
		$list        = self::list_files_query( $access_token, $drive_query, 100 );
		if ( (int) ( $list['statusCode'] ?? 500 ) !== 200 ) {
			return $list;
		}
		$list_body = isset( $list['body'] ) && is_array( $list['body'] ) ? $list['body'] : array();
		$files     = isset( $list_body['files'] ) && is_array( $list_body['files'] ) ? $list_body['files'] : array();
		$children  = array();
		foreach ( $files as $file ) {
			if ( ! is_array( $file ) || empty( $file['id'] ) ) {
				continue;
			}
			$children[] = array(
				'folderId'    => (string) $file['id'],
				'name'        => (string) ( $file['name'] ?? '' ),
				'webViewLink' => (string) ( $file['webViewLink'] ?? '' ),
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'  => true,
				'children' => $children,
			),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function resolve_folder_path( array $body ): array {
		if ( self::is_delivery_folder_resolve_request( $body ) ) {
			return self::resolve_delivery_folder( $body );
		}

		$root_folder_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $body['rootFolderId'] ?? '' ) );
		$segments       = isset( $body['segments'] ) && is_array( $body['segments'] ) ? $body['segments'] : array();
		$create_missing = ! array_key_exists( 'createMissing', $body ) || ! empty( $body['createMissing'] );
		if ( strlen( $root_folder_id ) < 10 ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'rootFolderId is required.' ),
			);
		}

		$normalized_segments = array();
		foreach ( $segments as $segment ) {
			$name = sanitize_text_field( (string) $segment );
			if ( $name !== '' ) {
				$normalized_segments[] = $name;
			}
		}
		if ( empty( $normalized_segments ) ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'segments must include at least one folder name.' ),
			);
		}

		$current_id = $root_folder_id;
		$created      = array();
		foreach ( $normalized_segments as $segment_name ) {
			if ( $create_missing ) {
				$result = self::ensure_child_folder( $current_id, $segment_name );
			} else {
				$result = self::find_folder(
					array(
						'parentFolderId' => $current_id,
						'name'           => $segment_name,
					)
				);
				if ( (int) ( $result['statusCode'] ?? 500 ) !== 200 ) {
					return $result;
				}
				$result_body = isset( $result['body'] ) && is_array( $result['body'] ) ? $result['body'] : array();
				$matches     = isset( $result_body['matches'] ) && is_array( $result_body['matches'] ) ? $result_body['matches'] : array();
				if ( empty( $matches[0]['folderId'] ) ) {
					return array(
						'statusCode' => 404,
						'body'       => array(
							'success' => false,
							'error'   => sprintf( 'Folder "%s" not found.', $segment_name ),
						),
					);
				}
				$result = array(
					'statusCode' => 200,
					'body'       => array(
						'success'  => true,
						'folderId' => (string) $matches[0]['folderId'],
						'created'  => false,
					),
				);
			}

			if ( (int) ( $result['statusCode'] ?? 500 ) !== 200 ) {
				return $result;
			}
			$result_body = isset( $result['body'] ) && is_array( $result['body'] ) ? $result['body'] : array();
			$next_id       = (string) ( $result_body['folderId'] ?? '' );
			if ( $next_id === '' ) {
				return array(
					'statusCode' => 502,
					'body'       => array( 'success' => false, 'error' => 'Could not resolve folder path.' ),
				);
			}
			if ( ! empty( $result_body['created'] ) ) {
				$created[] = $segment_name;
			}
			$current_id = $next_id;
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'     => true,
				'folderId'    => $current_id,
				'webViewLink' => 'https://drive.google.com/drive/folders/' . rawurlencode( $current_id ),
				'created'     => $created,
			),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function move_file( array $body ): array {
		$file_id            = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $body['fileId'] ?? '' ) );
		$destination_folder = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $body['destinationFolderId'] ?? '' ) );
		if ( strlen( $file_id ) < 10 || strlen( $destination_folder ) < 10 ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'fileId and destinationFolderId are required.' ),
			);
		}

		$access_token = self::access_token_or_error();
		if ( isset( $access_token['statusCode'] ) ) {
			return $access_token;
		}

		$get_url      = self::DRIVE_FILES_URL . '/' . rawurlencode( $file_id ) . '?fields=parents&supportsAllDrives=true';
		$get_response = wp_remote_get(
			$get_url,
			array(
				'timeout' => 20,
				'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
			)
		);
		if ( is_wp_error( $get_response ) ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => $get_response->get_error_message() ),
			);
		}
		$get_data = json_decode( wp_remote_retrieve_body( $get_response ), true );
		$parents  = is_array( $get_data ) && isset( $get_data['parents'] ) && is_array( $get_data['parents'] )
			? array_map( 'strval', $get_data['parents'] )
			: array();

		$patch_url = add_query_arg(
			array(
				'addParents'        => $destination_folder,
				'removeParents'     => implode( ',', $parents ),
				'supportsAllDrives' => 'true',
				'fields'            => 'id,name,webViewLink,parents',
			),
			self::DRIVE_FILES_URL . '/' . rawurlencode( $file_id )
		);
		$response  = wp_remote_request(
			$patch_url,
			array(
				'method'  => 'PATCH',
				'timeout' => 20,
				'headers' => array(
					'Authorization' => 'Bearer ' . $access_token,
					'Content-Type'  => 'application/json; charset=UTF-8',
				),
				'body'    => '{}',
			)
		);
		if ( is_wp_error( $response ) ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => $response->get_error_message() ),
			);
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || ! is_array( $data ) ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: 'Google Drive move failed.';
			return array(
				'statusCode' => $code > 0 ? $code : 502,
				'body'       => array( 'success' => false, 'error' => $msg ),
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'     => true,
				'fileId'      => (string) ( $data['id'] ?? $file_id ),
				'name'        => (string) ( $data['name'] ?? '' ),
				'webViewLink' => (string) ( $data['webViewLink'] ?? '' ),
			),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function rename_file( array $body ): array {
		$file_id  = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $body['fileId'] ?? '' ) );
		$new_name = sanitize_text_field( (string) ( $body['newName'] ?? '' ) );
		if ( strlen( $file_id ) < 10 || $new_name === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'fileId and newName are required.' ),
			);
		}

		$access_token = self::access_token_or_error();
		if ( isset( $access_token['statusCode'] ) ) {
			return $access_token;
		}

		$response = wp_remote_request(
			self::DRIVE_FILES_URL . '/' . rawurlencode( $file_id ) . '?supportsAllDrives=true&fields=id,name,webViewLink',
			array(
				'method'  => 'PATCH',
				'timeout' => 20,
				'headers' => array(
					'Authorization' => 'Bearer ' . $access_token,
					'Content-Type'  => 'application/json; charset=UTF-8',
				),
				'body'    => wp_json_encode( array( 'name' => $new_name ) ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => $response->get_error_message() ),
			);
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || ! is_array( $data ) ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: 'Google Drive rename failed.';
			return array(
				'statusCode' => $code > 0 ? $code : 502,
				'body'       => array( 'success' => false, 'error' => $msg ),
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'     => true,
				'fileId'      => (string) ( $data['id'] ?? $file_id ),
				'name'        => (string) ( $data['name'] ?? $new_name ),
				'webViewLink' => (string) ( $data['webViewLink'] ?? '' ),
			),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function trash_file( array $body ): array {
		$file_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $body['fileId'] ?? '' ) );
		if ( strlen( $file_id ) < 10 ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'fileId is required.' ),
			);
		}

		$access_token = self::access_token_or_error();
		if ( isset( $access_token['statusCode'] ) ) {
			return $access_token;
		}

		$response = wp_remote_request(
			self::DRIVE_FILES_URL . '/' . rawurlencode( $file_id ) . '?supportsAllDrives=true&fields=id,name,trashed',
			array(
				'method'  => 'PATCH',
				'timeout' => 20,
				'headers' => array(
					'Authorization' => 'Bearer ' . $access_token,
					'Content-Type'  => 'application/json; charset=UTF-8',
				),
				'body'    => wp_json_encode( array( 'trashed' => true ) ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => $response->get_error_message() ),
			);
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || ! is_array( $data ) ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: 'Google Drive trash failed.';
			return array(
				'statusCode' => $code > 0 ? $code : 502,
				'body'       => array( 'success' => false, 'error' => $msg ),
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success' => true,
				'fileId'  => (string) ( $data['id'] ?? $file_id ),
				'name'    => (string) ( $data['name'] ?? '' ),
				'trashed' => ! empty( $data['trashed'] ),
			),
		);
	}

	/**
	 * @return string|array{statusCode:int,body:array<string,mixed>}
	 */
	private static function access_token_or_error() {
		$access_token = Neo_Pulse_App_Google_Mcp_Tokens::get_valid_access_token();
		if ( is_wp_error( $access_token ) ) {
			return array(
				'statusCode' => 401,
				'body'       => array( 'success' => false, 'error' => $access_token->get_error_message() ),
			);
		}
		return $access_token;
	}

	/**
	 * @param string $access_token
	 * @param string $query
	 * @param int    $page_size
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function list_files_query( string $access_token, string $query, int $page_size ): array {
		$list_url = add_query_arg(
			array(
				'q'                         => $query,
				'fields'                    => 'files(id,name,webViewLink,createdTime)',
				'supportsAllDrives'         => 'true',
				'includeItemsFromAllDrives' => 'true',
				'pageSize'                  => max( 1, min( 100, $page_size ) ),
			),
			self::DRIVE_FILES_URL
		);
		$list_response = wp_remote_get(
			$list_url,
			array(
				'timeout' => 20,
				'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
			)
		);
		if ( is_wp_error( $list_response ) ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => $list_response->get_error_message() ),
			);
		}
		$list_code = (int) wp_remote_retrieve_response_code( $list_response );
		$list_data = json_decode( wp_remote_retrieve_body( $list_response ), true );
		if ( $list_code < 200 || $list_code >= 300 || ! is_array( $list_data ) ) {
			$msg = is_array( $list_data ) && ! empty( $list_data['error']['message'] )
				? (string) $list_data['error']['message']
				: 'Google Drive list failed.';
			return array(
				'statusCode' => $list_code > 0 ? $list_code : 502,
				'body'       => array( 'success' => false, 'error' => $msg ),
			);
		}
		return array(
			'statusCode' => 200,
			'body'       => $list_data,
		);
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function ensure_child_folder( string $parent_folder_id, string $folder_name ): array {
		$access_token = Neo_Pulse_App_Google_Mcp_Tokens::get_valid_access_token();
		if ( is_wp_error( $access_token ) ) {
			return array(
				'statusCode' => 401,
				'body'       => array( 'success' => false, 'error' => $access_token->get_error_message() ),
			);
		}

		$query = sprintf(
			"'%s' in parents and name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
			$parent_folder_id,
			str_replace( "'", "\\'", $folder_name )
		);
		$list_url = add_query_arg(
			array(
				'q'                 => $query,
				'fields'            => 'files(id,name,webViewLink)',
				'supportsAllDrives' => 'true',
				'includeItemsFromAllDrives' => 'true',
				'pageSize'          => 1,
			),
			self::DRIVE_FILES_URL
		);
		$list_response = wp_remote_get(
			$list_url,
			array(
				'timeout' => 20,
				'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
			)
		);
		if ( is_wp_error( $list_response ) ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => $list_response->get_error_message() ),
			);
		}
		$list_code = (int) wp_remote_retrieve_response_code( $list_response );
		$list_data = json_decode( wp_remote_retrieve_body( $list_response ), true );
		if ( $list_code >= 200 && $list_code < 300 && is_array( $list_data ) && ! empty( $list_data['files'][0]['id'] ) ) {
			$existing_id = (string) $list_data['files'][0]['id'];
			return array(
				'statusCode' => 200,
				'body'       => array(
					'success'  => true,
					'folderId' => $existing_id,
					'created'  => false,
				),
			);
		}

		$create_response = wp_remote_post(
			self::DRIVE_FILES_URL . '?supportsAllDrives=true&fields=id,name,webViewLink',
			array(
				'timeout' => 20,
				'headers' => array(
					'Authorization' => 'Bearer ' . $access_token,
					'Content-Type'  => 'application/json; charset=UTF-8',
				),
				'body'    => wp_json_encode(
					array(
						'name'     => $folder_name,
						'mimeType' => 'application/vnd.google-apps.folder',
						'parents'  => array( $parent_folder_id ),
					)
				),
			)
		);
		if ( is_wp_error( $create_response ) ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => $create_response->get_error_message() ),
			);
		}
		$create_code = (int) wp_remote_retrieve_response_code( $create_response );
		$create_data = json_decode( wp_remote_retrieve_body( $create_response ), true );
		if ( $create_code < 200 || $create_code >= 300 || ! is_array( $create_data ) || empty( $create_data['id'] ) ) {
			$msg = is_array( $create_data ) && ! empty( $create_data['error']['message'] )
				? (string) $create_data['error']['message']
				: 'Could not create test folder on Google Drive.';
			return array(
				'statusCode' => $create_code > 0 ? $create_code : 502,
				'body'       => array( 'success' => false, 'error' => $msg ),
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'  => true,
				'folderId' => (string) $create_data['id'],
				'created'  => true,
			),
		);
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>,files?:array<int,array{id:string,name:string,webViewLink:string,createdTime:string}>}
	 */
	private static function named_files_in_folder( string $access_token, string $folder_id, string $file_name ): array {
		$escaped_name = str_replace( "'", "\\'", $file_name );
		$query        = sprintf(
			"'%s' in parents and name = '%s' and trashed = false",
			$folder_id,
			$escaped_name
		);
		$list = self::list_files_query( $access_token, $query, 100 );
		if ( (int) ( $list['statusCode'] ?? 500 ) !== 200 ) {
			return $list;
		}
		$list_body = isset( $list['body'] ) && is_array( $list['body'] ) ? $list['body'] : array();
		$files     = isset( $list_body['files'] ) && is_array( $list_body['files'] ) ? $list_body['files'] : array();
		$named     = array();
		foreach ( $files as $file ) {
			if ( ! is_array( $file ) || empty( $file['id'] ) ) {
				continue;
			}
			$named[] = array(
				'id'          => (string) $file['id'],
				'name'        => (string) ( $file['name'] ?? $file_name ),
				'webViewLink' => (string) ( $file['webViewLink'] ?? '' ),
				'createdTime' => (string) ( $file['createdTime'] ?? '' ),
			);
		}
		usort(
			$named,
			static function ( array $left, array $right ): int {
				return strcmp( (string) $left['createdTime'], (string) $right['createdTime'] );
			}
		);
		return array(
			'statusCode' => 200,
			'body'       => array( 'success' => true ),
			'files'      => $named,
		);
	}

	/**
	 * @param array<string,mixed> $metadata
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function send_multipart_upload(
		string $access_token,
		string $url,
		string $method,
		array $metadata,
		string $upload_mime,
		string $content
	): array {
		$boundary = 'neo_pulse_' . wp_generate_password( 16, false, false );
		$payload  = '--' . $boundary . "\r\n";
		$payload .= "Content-Type: application/json; charset=UTF-8\r\n\r\n";
		$payload .= wp_json_encode( $metadata ) . "\r\n";
		$payload .= '--' . $boundary . "\r\n";
		$payload .= 'Content-Type: ' . $upload_mime . '; charset=UTF-8' . "\r\n\r\n";
		$payload .= $content . "\r\n";
		$payload .= '--' . $boundary . '--';

		$response = wp_remote_request(
			$url,
			array(
				'method'  => $method,
				'timeout' => 60,
				'headers' => array(
					'Authorization' => 'Bearer ' . $access_token,
					'Content-Type'  => 'multipart/related; boundary=' . $boundary,
				),
				'body'    => $payload,
			)
		);
		if ( is_wp_error( $response ) ) {
			return array(
				'statusCode' => 502,
				'body'       => array(
					'success' => false,
					'error'   => $response->get_error_message(),
				),
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || ! is_array( $data ) ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: 'Google Drive upload failed.';
			return array(
				'statusCode' => $code > 0 ? $code : 502,
				'body'       => array( 'success' => false, 'error' => $msg ),
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'     => true,
				'fileId'      => (string) ( $data['id'] ?? '' ),
				'name'        => (string) ( $data['name'] ?? '' ),
				'webViewLink' => (string) ( $data['webViewLink'] ?? '' ),
			),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function upload_deliverable( array $body ): array {
		if ( ! Neo_Pulse_App_Google_Mcp_Oauth::is_configured() ) {
			return array(
				'statusCode' => 503,
				'body'       => array(
					'success' => false,
					'error'   => 'Google OAuth not configured.',
				),
			);
		}

		$access_token = Neo_Pulse_App_Google_Mcp_Tokens::get_valid_access_token();
		if ( is_wp_error( $access_token ) ) {
			return array(
				'statusCode' => 401,
				'body'       => array(
					'success' => false,
					'error'   => $access_token->get_error_message(),
				),
			);
		}

		$file_name = sanitize_text_field( (string) ( $body['fileName'] ?? '' ) );
		$content   = (string) ( $body['content'] ?? '' );
		$folder_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $body['folderId'] ?? '' ) );
		$mime      = sanitize_text_field( (string) ( $body['mime'] ?? 'text/plain' ) );
		$as_doc    = ! array_key_exists( 'convertToGoogleDoc', $body ) || ! empty( $body['convertToGoogleDoc'] );

		if ( $file_name === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'fileName is required.' ),
			);
		}
		if ( $content === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'content is required.' ),
			);
		}
		if ( strlen( $folder_id ) < 10 ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'folderId is required.' ),
			);
		}

		$upload_mime = $mime !== '' ? $mime : 'text/plain';
		$target_mime = $as_doc && $upload_mime !== 'text/csv'
			? 'application/vnd.google-apps.document'
			: $upload_mime;

		$existing_list = self::named_files_in_folder( $access_token, $folder_id, $file_name );
		if ( (int) ( $existing_list['statusCode'] ?? 500 ) !== 200 ) {
			return $existing_list;
		}
		$existing = isset( $existing_list['files'] ) && is_array( $existing_list['files'] ) ? $existing_list['files'] : array();
		if ( count( $existing ) > 0 ) {
			$keep = $existing[0];
			foreach ( array_slice( $existing, 1 ) as $duplicate ) {
				self::trash_file( array( 'fileId' => $duplicate['id'] ) );
			}
			$update_metadata = array( 'name' => $file_name );
			if ( $target_mime === 'application/vnd.google-apps.document' ) {
				$update_metadata['mimeType'] = 'application/vnd.google-apps.document';
			}
			$updated = self::send_multipart_upload(
				$access_token,
				self::DRIVE_UPLOAD_URL . '/' . rawurlencode( $keep['id'] ) . '?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
				'PATCH',
				$update_metadata,
				$upload_mime,
				$content
			);
			if ( (int) ( $updated['statusCode'] ?? 500 ) !== 200 ) {
				return $updated;
			}
			$updated_body = isset( $updated['body'] ) && is_array( $updated['body'] ) ? $updated['body'] : array();
			if ( (string) ( $updated_body['name'] ?? '' ) === '' ) {
				$updated_body['name'] = $file_name;
			}
			if ( (string) ( $updated_body['fileId'] ?? '' ) === '' ) {
				$updated_body['fileId'] = $keep['id'];
			}
			if ( (string) ( $updated_body['webViewLink'] ?? '' ) === '' ) {
				$updated_body['webViewLink'] = $keep['webViewLink'];
			}
			return array(
				'statusCode' => 200,
				'body'       => $updated_body,
			);
		}

		$metadata = array(
			'name'    => $file_name,
			'parents' => array( $folder_id ),
		);
		if ( $target_mime === 'application/vnd.google-apps.document' ) {
			$metadata['mimeType'] = 'application/vnd.google-apps.document';
		}

		$created = self::send_multipart_upload(
			$access_token,
			self::DRIVE_UPLOAD_URL . '?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
			'POST',
			$metadata,
			$upload_mime,
			$content
		);
		if ( (int) ( $created['statusCode'] ?? 500 ) !== 200 ) {
			return $created;
		}
		$created_body = isset( $created['body'] ) && is_array( $created['body'] ) ? $created['body'] : array();
		if ( (string) ( $created_body['name'] ?? '' ) === '' ) {
			$created_body['name'] = $file_name;
		}
		return array(
			'statusCode' => 200,
			'body'       => $created_body,
		);
	}

	/**
	 * Resolve folder + upload a workflow step test markdown file in one request.
	 *
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function test_step_upload( array $body ): array {
		$title     = sanitize_text_field( (string) ( $body['title'] ?? 'Workflow step' ) );
		$site_name = sanitize_text_field( (string) ( $body['siteName'] ?? '' ) );
		$site_url  = esc_url_raw( (string) ( $body['siteUrl'] ?? '' ) );
		$settings  = Neo_Pulse_App_Google_Drive_Settings::get();
		$aliases   = isset( $settings['folderAliases'] ) && is_array( $settings['folderAliases'] ) ? $settings['folderAliases'] : array();
		$source    = self::normalize_folder_source( (string) ( $body['googleDriveFolderSource'] ?? 'path' ) );

		if ( trim( (string) ( $body['googleDriveFolderPath'] ?? '' ) ) === '' ) {
			$body['googleDriveFolderPath'] = self::resolve_delivery_purpose_key( $body, 'path', $aliases );
		}
		if ( $source === 'client_root' ) {
			$body['googleDriveFolderSource'] = 'path';
			$source                          = 'path';
		}

		$folder_result = self::resolve_test_step_folder( $body, $source, $site_name, $site_url );
		if ( (int) ( $folder_result['statusCode'] ?? 500 ) !== 200 ) {
			return $folder_result;
		}
		$folder_body = isset( $folder_result['body'] ) && is_array( $folder_result['body'] ) ? $folder_result['body'] : array();
		$folder_id   = (string) ( $folder_body['folderId'] ?? '' );
		$folder_label = (string) ( $folder_body['folderLabel'] ?? $folder_body['label'] ?? '' );
		if ( strlen( $folder_id ) < 10 ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => 'Google Drive folder is required.' ),
			);
		}
		if ( ! preg_match( '/\/ (Reporting|Audits|Grids) \/ \d{4} \/ /i', $folder_label ) ) {
			return array(
				'statusCode' => 502,
				'body'       => array(
					'success' => false,
					'error'   => 'Google Drive test must upload to a Reporting/Audits/Grids month folder, not the client root.',
				),
			);
		}

		$timestamp = gmdate( 'c' );
		$stamp_slug = gmdate( 'Y-m-d-His' );
		$safe_title = $title !== '' ? $title : 'Workflow step';
		$file_name  = sanitize_file_name( str_replace( ' ', '-', $safe_title ) . '-test-' . $stamp_slug );
		$content    = '# ' . $safe_title . "\n\nTest file\n\n" . $timestamp . "\n";

		$upload = self::upload_deliverable(
			array(
				'fileName'           => $file_name,
				'content'            => $content,
				'folderId'           => $folder_id,
				'mime'               => 'text/markdown',
				'convertToGoogleDoc' => true,
			)
		);
		if ( (int) ( $upload['statusCode'] ?? 500 ) !== 200 ) {
			return $upload;
		}
		$upload_body = isset( $upload['body'] ) && is_array( $upload['body'] ) ? $upload['body'] : array();

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'     => true,
				'fileLink'    => (string) ( $upload_body['webViewLink'] ?? '' ),
				'fileName'    => (string) ( $upload_body['name'] ?? $file_name ),
				'fileId'      => (string) ( $upload_body['fileId'] ?? '' ),
				'folderLink'  => (string) ( $folder_body['webViewLink'] ?? '' ),
				'folderLabel' => (string) ( $folder_body['folderLabel'] ?? '' ),
				'created'     => isset( $folder_body['created'] ) && is_array( $folder_body['created'] ) ? $folder_body['created'] : array(),
			),
		);
	}

	/**
	 * Resolve delivery target: exact client folder name, or create it, then purpose/year/month.
	 *
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function resolve_delivery_folder( array $body ): array {
		$source     = self::normalize_folder_source( (string) ( $body['googleDriveFolderSource'] ?? 'client_root' ) );
		$site_name  = sanitize_text_field( (string) ( $body['siteName'] ?? '' ) );
		$site_url   = esc_url_raw( (string) ( $body['siteUrl'] ?? '' ) );
		$or_model   = sanitize_text_field( (string) ( $body['openRouterModel'] ?? '' ) );

		if ( $source === 'manual' ) {
			$folder_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $body['googleDriveFolderId'] ?? '' ) );
			$client_hint_name = sanitize_text_field( (string) ( $body['googleDriveFolderLabel'] ?? '' ) );
			$want_name        = self::normalize_client_folder_name( $site_name, $site_url );
			$manual_is_this_client = $want_name === ''
				|| self::drive_folder_names_match( $client_hint_name, $want_name )
				|| self::drive_label_belongs_to_client( $client_hint_name, $want_name );
			if ( strlen( $folder_id ) >= 10 && $manual_is_this_client ) {
				$settings    = Neo_Pulse_App_Google_Drive_Settings::get();
				$aliases     = isset( $settings['folderAliases'] ) && is_array( $settings['folderAliases'] ) ? $settings['folderAliases'] : array();
				$purpose_key = self::resolve_delivery_purpose_key( $body, $source, $aliases );
				return self::finalize_delivery_folder_resolution(
					$folder_id,
					$client_hint_name !== '' ? $client_hint_name : 'Client folder',
					$purpose_key,
					$aliases,
					$site_name,
					$site_url,
					$or_model,
					array()
				);
			}
			if ( $want_name === '' ) {
				return array(
					'statusCode' => 400,
					'body'       => array( 'success' => false, 'error' => 'Google Drive folder ID is required.' ),
				);
			}
		}

		if ( $site_name === '' ) {
			$site_name = self::normalize_client_folder_name( '', $site_url );
		}
		if ( $site_name === '' && $site_url === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'Client name is required to resolve the Google Drive folder.' ),
			);
		}

		$settings  = Neo_Pulse_App_Google_Drive_Settings::get();
		$team_root = self::resolve_team_root_folder_id( $settings );
		$workspace = self::resolve_folder_path(
			array(
				'rootFolderId'  => $team_root,
				'segments'      => array( self::NEO_PULSE_WORKSPACE_FOLDER_NAME ),
				'createMissing' => true,
			)
		);
		if ( (int) ( $workspace['statusCode'] ?? 500 ) !== 200 ) {
			return $workspace;
		}
		$workspace_body = isset( $workspace['body'] ) && is_array( $workspace['body'] ) ? $workspace['body'] : array();
		$workspace_id   = (string) ( $workspace_body['folderId'] ?? '' );
		if ( strlen( $workspace_id ) < 10 ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => 'Could not resolve NEO Pulse workspace folder.' ),
			);
		}

		$created = isset( $workspace_body['created'] ) && is_array( $workspace_body['created'] ) ? $workspace_body['created'] : array();

		$list = self::list_folder_children( array( 'folderId' => $workspace_id ) );
		if ( (int) ( $list['statusCode'] ?? 500 ) !== 200 ) {
			return $list;
		}
		$list_body   = isset( $list['body'] ) && is_array( $list['body'] ) ? $list['body'] : array();
		$candidates  = isset( $list_body['children'] ) && is_array( $list_body['children'] ) ? $list_body['children'] : array();
		$aliases     = isset( $settings['folderAliases'] ) && is_array( $settings['folderAliases'] ) ? $settings['folderAliases'] : array();
		$purpose_key = self::resolve_delivery_purpose_key( $body, $source, $aliases );

		$pick = self::pick_or_create_client_folder( $candidates, $site_name, $site_url );
		if ( (int) ( $pick['statusCode'] ?? 500 ) !== 200 ) {
			return $pick;
		}
		$pick_body = isset( $pick['body'] ) && is_array( $pick['body'] ) ? $pick['body'] : array();
		$want_name = self::normalize_client_folder_name( $site_name, $site_url );

		$client_folder_id   = '';
		$client_folder_name = '';
		if ( ( $pick_body['action'] ?? '' ) === 'use_existing' ) {
			$picked_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $pick_body['folderId'] ?? '' ) );
			foreach ( $candidates as $candidate ) {
				if ( ! is_array( $candidate ) ) {
					continue;
				}
				if ( (string) ( $candidate['folderId'] ?? '' ) === $picked_id ) {
					$picked_name = (string) ( $candidate['name'] ?? '' );
					if ( self::drive_folder_names_match( $picked_name, $want_name ) ) {
						$client_folder_id   = $picked_id;
						$client_folder_name = $picked_name;
					}
					break;
				}
			}
		}
		if ( $client_folder_id === '' ) {
			$create_name = $want_name;
			if ( $create_name === '' ) {
				return array(
					'statusCode' => 400,
					'body'       => array( 'success' => false, 'error' => 'Client folder name is required.' ),
				);
			}
			$created_client = self::resolve_folder_path(
				array(
					'rootFolderId'  => $workspace_id,
					'segments'      => array( $create_name ),
					'createMissing' => true,
				)
			);
			if ( (int) ( $created_client['statusCode'] ?? 500 ) !== 200 ) {
				return $created_client;
			}
			$created_client_body = isset( $created_client['body'] ) && is_array( $created_client['body'] ) ? $created_client['body'] : array();
			$client_folder_id    = (string) ( $created_client_body['folderId'] ?? '' );
			$client_folder_name  = $create_name;
			if ( ! empty( $created_client_body['created'] ) && is_array( $created_client_body['created'] ) ) {
				$created = array_merge( $created, $created_client_body['created'] );
			}
		}

		if ( strlen( $client_folder_id ) < 10 ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => 'Could not resolve client Google Drive folder.' ),
			);
		}

		return self::finalize_delivery_folder_resolution(
			$client_folder_id,
			$client_folder_name,
			$purpose_key,
			$aliases,
			$site_name,
			$site_url,
			$or_model,
			$created
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $aliases
	 * @param array<int,string>              $created
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function finalize_delivery_folder_resolution(
		string $client_folder_id,
		string $client_folder_name,
		string $purpose_key,
		array $aliases,
		string $site_name,
		string $site_url,
		string $openrouter_model,
		array $created
	): array {
		if ( $purpose_key === 'client_root' ) {
			return array(
				'statusCode' => 200,
				'body'       => array(
					'success'          => true,
					'folderId'         => $client_folder_id,
					'label'            => implode( ' / ', array( self::NEO_PULSE_WORKSPACE_FOLDER_NAME, $client_folder_name ) ),
					'webViewLink'      => 'https://drive.google.com/drive/folders/' . rawurlencode( $client_folder_id ),
					'created'          => $created,
					'clientFolderId'   => $client_folder_id,
					'clientFolderName' => $client_folder_name,
				),
			);
		}

		$subfolder = self::gemini_pick_delivery_subfolder(
			$client_folder_id,
			$client_folder_name,
			$purpose_key,
			$aliases,
			$site_name,
			$site_url,
			$openrouter_model
		);
		if ( (int) ( $subfolder['statusCode'] ?? 500 ) !== 200 ) {
			return $subfolder;
		}
		$subfolder_body = isset( $subfolder['body'] ) && is_array( $subfolder['body'] ) ? $subfolder['body'] : array();
		$target_id      = (string) ( $subfolder_body['folderId'] ?? '' );
		$tail_segments  = isset( $subfolder_body['segments'] ) && is_array( $subfolder_body['segments'] ) ? $subfolder_body['segments'] : array();
		if ( strlen( $target_id ) < 10 && ! empty( $tail_segments ) ) {
			$resolved = self::resolve_folder_path(
				array(
					'rootFolderId'  => $client_folder_id,
					'segments'      => $tail_segments,
					'createMissing' => true,
				)
			);
			if ( (int) ( $resolved['statusCode'] ?? 500 ) !== 200 ) {
				return $resolved;
			}
			$resolved_body = isset( $resolved['body'] ) && is_array( $resolved['body'] ) ? $resolved['body'] : array();
			$target_id     = (string) ( $resolved_body['folderId'] ?? '' );
			if ( ! empty( $resolved_body['created'] ) && is_array( $resolved_body['created'] ) ) {
				$created = array_merge( $created, $resolved_body['created'] );
			}
		}
		if ( strlen( $target_id ) < 10 ) {
			return array(
				'statusCode' => 502,
				'body'       => array( 'success' => false, 'error' => 'Could not resolve Google Drive delivery subfolder.' ),
			);
		}

		$label_parts = array( self::NEO_PULSE_WORKSPACE_FOLDER_NAME, $client_folder_name );
		if ( ! empty( $tail_segments ) ) {
			$label_parts = array_merge( $label_parts, $tail_segments );
		} elseif ( ! empty( $subfolder_body['pathLabel'] ) ) {
			$label_parts[] = (string) $subfolder_body['pathLabel'];
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'          => true,
				'folderId'         => $target_id,
				'label'            => implode( ' / ', $label_parts ),
				'webViewLink'      => 'https://drive.google.com/drive/folders/' . rawurlencode( $target_id ),
				'created'          => $created,
				'clientFolderId'   => $client_folder_id,
				'clientFolderName' => $client_folder_name,
			),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $aliases
	 */
	private static function resolve_delivery_purpose_key( array $body, string $source, array $aliases ): string {
		if ( $source === 'client_root' ) {
			return 'client_root';
		}
		$path = trim( (string) ( $body['googleDriveFolderPath'] ?? '' ) );
		if ( $path !== '' ) {
			return $path;
		}
		$execution_kind = sanitize_text_field( (string) ( $body['executionKind'] ?? '' ) );
		if ( $execution_kind === 'gsc_reporting' ) {
			return 'reporting';
		}
		if ( $execution_kind === 'chatgpt_audit' ) {
			return 'audits';
		}
		if ( $execution_kind === 'local_dominator_export' ) {
			return 'grids';
		}
		return 'reporting';
	}

	/**
	 * @param array<int,array<string,mixed>> $aliases
	 * @return array<int,array{folderId:string,path:string,segments:array<int,string>}>
	 */
	private static function build_client_delivery_path_catalog( string $client_folder_id ): array {
		$catalog  = array();
		$purposes = self::list_folder_children( array( 'folderId' => $client_folder_id ) );
		if ( (int) ( $purposes['statusCode'] ?? 500 ) !== 200 ) {
			return $catalog;
		}
		$purpose_body = isset( $purposes['body'] ) && is_array( $purposes['body'] ) ? $purposes['body'] : array();
		$purpose_rows = isset( $purpose_body['children'] ) && is_array( $purpose_body['children'] ) ? $purpose_body['children'] : array();
		foreach ( $purpose_rows as $purpose_row ) {
			if ( ! is_array( $purpose_row ) || empty( $purpose_row['folderId'] ) ) {
				continue;
			}
			$purpose_name = trim( (string) ( $purpose_row['name'] ?? '' ) );
			$purpose_id   = (string) $purpose_row['folderId'];
			if ( $purpose_name === '' ) {
				continue;
			}

			$years = self::list_folder_children( array( 'folderId' => $purpose_id ) );
			if ( (int) ( $years['statusCode'] ?? 500 ) !== 200 ) {
				continue;
			}
			$year_body = isset( $years['body'] ) && is_array( $years['body'] ) ? $years['body'] : array();
			$year_rows = isset( $year_body['children'] ) && is_array( $year_body['children'] ) ? $year_body['children'] : array();
			foreach ( $year_rows as $year_row ) {
				if ( ! is_array( $year_row ) || empty( $year_row['folderId'] ) ) {
					continue;
				}
				$year_name = trim( (string) ( $year_row['name'] ?? '' ) );
				$year_id   = (string) $year_row['folderId'];
				if ( $year_name === '' || ! preg_match( '/^\d{4}$/', $year_name ) ) {
					continue;
				}

				$months = self::list_folder_children( array( 'folderId' => $year_id ) );
				if ( (int) ( $months['statusCode'] ?? 500 ) !== 200 ) {
					continue;
				}
				$month_body = isset( $months['body'] ) && is_array( $months['body'] ) ? $months['body'] : array();
				$month_rows = isset( $month_body['children'] ) && is_array( $month_body['children'] ) ? $month_body['children'] : array();
				foreach ( $month_rows as $month_row ) {
					if ( ! is_array( $month_row ) || empty( $month_row['folderId'] ) ) {
						continue;
					}
					$month_name = trim( (string) ( $month_row['name'] ?? '' ) );
					$month_id   = (string) $month_row['folderId'];
					if ( $month_name === '' || ! self::is_drive_month_segment( $month_name ) ) {
						continue;
					}
					$catalog[] = array(
						'folderId' => $month_id,
						'path'     => $purpose_name . ' / ' . $year_name . ' / ' . $month_name,
						'segments' => array( $purpose_name, $year_name, $month_name ),
					);
				}
			}
		}
		return $catalog;
	}

	/**
	 * @param array<int,array<string,mixed>> $aliases
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function gemini_pick_delivery_subfolder(
		string $client_folder_id,
		string $client_folder_name,
		string $purpose_key,
		array $aliases,
		string $site_name,
		string $site_url,
		string $openrouter_model = ''
	): array {
		$catalog = self::build_client_delivery_path_catalog( $client_folder_id );
		$purpose_segments = self::resolve_path_segments( $purpose_key, $aliases );
		$default_segments = self::build_delivery_subfolder_segments( $purpose_segments );
		$default_path     = implode( ' / ', $default_segments );

		if ( empty( $catalog ) ) {
			return array(
				'statusCode' => 200,
				'body'       => array(
					'folderId'  => '',
					'segments'  => $default_segments,
					'pathLabel' => $default_path,
					'reason'    => 'empty_client_tree',
				),
			);
		}

		if ( ! class_exists( 'Neo_Pulse_App_Chat_Openrouter' ) ) {
			return array(
				'statusCode' => 503,
				'body'       => array( 'success' => false, 'error' => 'OpenRouter is not available for Google Drive folder lookup.' ),
			);
		}

		$lines       = array();
		$allowed_ids = array();
		foreach ( $catalog as $index => $entry ) {
			$folder_id = (string) ( $entry['folderId'] ?? '' );
			$path      = (string) ( $entry['path'] ?? '' );
			if ( $folder_id === '' || $path === '' ) {
				continue;
			}
			$allowed_ids[ $folder_id ] = true;
			$lines[]                   = sprintf( '%d. id=%s path=%s', $index + 1, $folder_id, $path );
		}

		if ( empty( $lines ) ) {
			return array(
				'statusCode' => 200,
				'body'       => array(
					'folderId'  => '',
					'segments'  => $default_segments,
					'pathLabel' => $default_path,
					'reason'    => 'empty_client_tree',
				),
			);
		}

		$edmonton      = self::edmonton_now();
		$current_month = self::drive_month_segment( $edmonton );
		$current_year  = self::drive_year_segment( $edmonton );
		$example_json  = wp_json_encode( $default_segments );
		$model         = $openrouter_model !== '' ? $openrouter_model : 'google/gemini-2.5-flash';
		$system        = 'You pick the Google Drive upload folder inside a client workspace. Reply JSON only. '
			. 'Either {"action":"use_existing","folderId":"...","reason":"..."} when a listed path is the current calendar month folder, '
			. 'or {"action":"create_path","segments":' . $example_json . ',"reason":"..."} when that month folder does not exist yet. '
			. 'Never upload to the client root, a purpose-only folder, a year-only folder, or a previous month. '
			. 'Sort by the current calendar month from Today, not the report data period. A file named for last month still belongs in the current calendar month folder. '
			. 'folderId must match a listed id exactly. segments must be purpose, year, current calendar month.';

		$user_parts = array(
			'Today: ' . $edmonton->format( 'Y-m-d' ) . ' (America/Edmonton).',
			'Current calendar month folder: ' . $current_month . '.',
			'Current year: ' . $current_year . '.',
			'Client folder: ' . $client_folder_name,
			'Client site name: ' . $site_name,
			'Deliverable purpose: ' . $purpose_key,
			'Expected path: ' . $default_path,
			'Existing month folders (use_existing only if the path is the current calendar month):',
			implode( "\n", $lines ),
			'If the current month folder is not listed, return create_path with the expected path segments.',
		);
		if ( $site_url !== '' ) {
			array_splice( $user_parts, 5, 0, array( 'Site URL: ' . $site_url ) );
		}

		try {
			$parsed = Neo_Pulse_App_Chat_Openrouter::json_completion(
				array(
					array(
						'role'    => 'system',
						'content' => $system,
					),
					array(
						'role'    => 'user',
						'content' => implode( "\n", $user_parts ),
					),
				),
				array(
					'model'       => $model,
					'temperature' => 0,
					'maxTokens'   => 400,
				)
			);
		} catch ( Exception $e ) {
			return array(
				'statusCode' => 502,
				'body'       => array(
					'success' => false,
					'error'   => 'Gemini delivery subfolder lookup failed: ' . $e->getMessage(),
				),
			);
		}

		$action = sanitize_text_field( (string) ( $parsed['action'] ?? '' ) );
		if ( $action === 'use_existing' ) {
			$folder_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $parsed['folderId'] ?? '' ) );
			if ( $folder_id === '' || ! isset( $allowed_ids[ $folder_id ] ) ) {
				return array(
					'statusCode' => 502,
					'body'       => array( 'success' => false, 'error' => 'Gemini picked a delivery folder outside the subpath catalog.' ),
				);
			}
			$path_label = $default_path;
			foreach ( $catalog as $entry ) {
				if ( (string) ( $entry['folderId'] ?? '' ) === $folder_id ) {
					$path_label = (string) ( $entry['path'] ?? $default_path );
					break;
				}
			}
			if ( strtolower( trim( $path_label ) ) !== strtolower( trim( $default_path ) ) ) {
				return array(
					'statusCode' => 502,
					'body'       => array(
						'success' => false,
						'error'   => 'Google Drive folder sort picked ' . $path_label . ' instead of the current calendar month (' . $default_path . ').',
					),
				);
			}
			return array(
				'statusCode' => 200,
				'body'       => array(
					'folderId'  => $folder_id,
					'segments'  => array(),
					'pathLabel' => $path_label,
					'reason'    => sanitize_text_field( (string) ( $parsed['reason'] ?? '' ) ),
				),
			);
		}

		if ( $action === 'create_path' ) {
			$segments = isset( $parsed['segments'] ) && is_array( $parsed['segments'] ) ? $parsed['segments'] : array();
			$normalized_segments = array();
			foreach ( $segments as $segment ) {
				$name = sanitize_text_field( (string) $segment );
				if ( $name !== '' ) {
					$normalized_segments[] = $name;
				}
			}
			if ( empty( $normalized_segments ) ) {
				$normalized_segments = $default_segments;
			}
			if ( ! self::drive_segments_match( $normalized_segments, $default_segments ) ) {
				return array(
					'statusCode' => 502,
					'body'       => array(
						'success' => false,
						'error'   => 'Google Drive folder create_path must be the current calendar month (' . $default_path . ').',
					),
				);
			}
			return array(
				'statusCode' => 200,
				'body'       => array(
					'folderId'  => '',
					'segments'  => $default_segments,
					'pathLabel' => $default_path,
					'reason'    => sanitize_text_field( (string) ( $parsed['reason'] ?? '' ) ),
				),
			);
		}

		return array(
			'statusCode' => 502,
			'body'       => array(
				'success' => false,
				'error'   => 'Google Drive folder sort returned an invalid action.',
			),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $candidates
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function is_delivery_folder_resolve_request( array $body ): bool {
		if ( ! empty( $body['deliveryResolve'] ) ) {
			return true;
		}
		$site_name = trim( (string) ( $body['siteName'] ?? '' ) );
		$root_id   = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $body['rootFolderId'] ?? '' ) );
		return $site_name !== '' && strlen( $root_id ) < 10;
	}

	/**
	 * Create this client's folder. Do not pick another client's folder.
	 *
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function drive_folder_names_match( string $a, string $b ): bool {
		$left  = strtolower( trim( (string) preg_replace( '/\s+/', ' ', $a ) ) );
		$right = strtolower( trim( (string) preg_replace( '/\s+/', ' ', $b ) ) );
		return $left !== '' && $left === $right;
	}

	private static function drive_label_client_segment( string $label ): string {
		$parts = array_values(
			array_filter(
				array_map( 'trim', explode( '/', $label ) ),
				static function ( $part ) {
					return $part !== '';
				}
			)
		);
		if ( empty( $parts ) ) {
			return '';
		}
		if ( self::drive_folder_names_match( $parts[0], self::NEO_PULSE_WORKSPACE_FOLDER_NAME ) ) {
			return (string) ( $parts[1] ?? '' );
		}
		return (string) $parts[0];
	}

	private static function drive_label_belongs_to_client( string $label, string $client_name ): bool {
		$want = trim( $client_name );
		if ( $want === '' ) {
			return false;
		}
		return self::drive_folder_names_match( self::drive_label_client_segment( $label ), $want );
	}

	private static function create_new_client_folder_pick( string $site_name, string $site_url, string $reason ): array {
		return array(
			'statusCode' => 200,
			'body'       => array(
				'action'     => 'create_new',
				'folderName' => self::normalize_client_folder_name( $site_name, $site_url ),
				'reason'     => $reason,
			),
		);
	}

	/**
	 * Exact client folder name, or create this client's folder. Never another client.
	 *
	 * @param array<int,mixed> $candidates
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function pick_or_create_client_folder(
		array $candidates,
		string $site_name,
		string $site_url
	): array {
		$want = self::normalize_client_folder_name( $site_name, $site_url );
		if ( $want === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'Client name is required to resolve the Google Drive folder.' ),
			);
		}
		foreach ( $candidates as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$folder_id = (string) ( $row['folderId'] ?? '' );
			$name      = (string) ( $row['name'] ?? '' );
			if ( $folder_id === '' || $name === '' ) {
				continue;
			}
			if ( self::drive_folder_names_match( $name, $want ) ) {
				return array(
					'statusCode' => 200,
					'body'       => array(
						'action'   => 'use_existing',
						'folderId' => $folder_id,
						'reason'   => 'exact_name',
					),
				);
			}
		}
		return self::create_new_client_folder_pick( $site_name, $site_url, 'no_exact_client_folder' );
	}

	/**
	 * @param array<int,string> $purpose_segments
	 * @return array<int,string>
	 */
	private static function build_delivery_subfolder_segments( array $purpose_segments ): array {
		if ( empty( $purpose_segments ) ) {
			return array();
		}
		return self::append_drive_date_segments( $purpose_segments );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function resolve_test_step_folder(
		array $body,
		string $source,
		string $site_name,
		string $site_url
	): array {
		$settings = Neo_Pulse_App_Google_Drive_Settings::get();
		$aliases  = isset( $settings['folderAliases'] ) && is_array( $settings['folderAliases'] ) ? $settings['folderAliases'] : array();
		if ( trim( (string) ( $body['googleDriveFolderPath'] ?? '' ) ) === '' ) {
			$body['googleDriveFolderPath'] = self::resolve_delivery_purpose_key( $body, 'path', $aliases );
		}
		$delivery_body = array_merge(
			$body,
			array(
				'siteName'                => $site_name,
				'siteUrl'                 => $site_url,
				'googleDriveFolderSource' => $source,
			)
		);
		$result        = self::resolve_delivery_folder( $delivery_body );
		if ( (int) ( $result['statusCode'] ?? 500 ) !== 200 ) {
			return $result;
		}
		$result_body = isset( $result['body'] ) && is_array( $result['body'] ) ? $result['body'] : array();
		if ( ! empty( $result_body['label'] ) ) {
			$result_body['folderLabel'] = (string) $result_body['label'];
		}
		return array(
			'statusCode' => 200,
			'body'       => $result_body,
		);
	}

	private static function normalize_folder_source( string $source ): string {
		$normalized = strtolower( trim( $source ) );
		if ( in_array( $normalized, array( 'client_root', 'path', 'variable', 'manual' ), true ) ) {
			return $normalized;
		}
		return 'manual';
	}

	private static function normalize_client_folder_name( string $site_name, string $site_url ): string {
		$from_name = trim( $site_name );
		if ( $from_name !== '' ) {
			return sanitize_text_field( $from_name );
		}
		$url = trim( $site_url );
		if ( $url === '' ) {
			return '';
		}
		$host = wp_parse_url( $url, PHP_URL_HOST );
		if ( ! is_string( $host ) || $host === '' ) {
			$host = wp_parse_url( 'https://' . ltrim( $url, '/' ), PHP_URL_HOST );
		}
		if ( ! is_string( $host ) || $host === '' ) {
			return '';
		}
		$host = preg_replace( '/^www\./i', '', $host );
		$parts = explode( '.', (string) $host );
		return sanitize_text_field( $parts[0] ?? '' );
	}

	/**
	 * @param array{teamRootFolderId?:string,folderAliases?:array<int,array<string,mixed>>} $settings
	 */
	private static function resolve_team_root_folder_id( array $settings ): string {
		$configured = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $settings['teamRootFolderId'] ?? '' ) );
		if ( is_string( $configured ) && strlen( $configured ) >= 10 ) {
			return $configured;
		}
		return Neo_Pulse_App_Google_Drive_Settings::DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID;
	}

	/**
	 * @param array<int,array<string,mixed>> $aliases
	 * @return array<int,string>
	 */
	private static function resolve_path_segments( string $path_input, array $aliases ): array {
		$trimmed = trim( $path_input );
		$defaults = Neo_Pulse_App_Google_Drive_Settings::default_folder_aliases();
		$alias_rows = ! empty( $aliases ) ? $aliases : $defaults;
		if ( $trimmed === '' ) {
			return array( self::resolve_purpose_folder_name( '', $alias_rows ) );
		}
		$parts = array_values(
			array_filter(
				array_map(
					static function ( $part ) use ( $alias_rows ) {
						$segment = trim( (string) $part );
						return $segment !== '' ? self::resolve_purpose_folder_name( $segment, $alias_rows ) : '';
					},
					explode( '/', $trimmed )
				),
				static function ( $part ) {
					return $part !== '';
				}
			)
		);
		return ! empty( $parts ) ? $parts : array( self::resolve_purpose_folder_name( '', $alias_rows ) );
	}

	/**
	 * @param array<int,array<string,mixed>> $aliases
	 */
	private static function resolve_purpose_folder_name( string $path_input, array $aliases ): string {
		$trimmed = trim( $path_input );
		$defaults = Neo_Pulse_App_Google_Drive_Settings::default_folder_aliases();
		$alias_rows = ! empty( $aliases ) ? $aliases : $defaults;
		if ( $trimmed === '' ) {
			foreach ( $alias_rows as $alias ) {
				if ( is_array( $alias ) && ( $alias['key'] ?? '' ) === 'reporting' ) {
					return (string) ( $alias['folderName'] ?? 'Reporting' );
				}
			}
			return 'Reporting';
		}
		$leaf = strtolower( $trimmed );
		foreach ( $alias_rows as $alias ) {
			if ( ! is_array( $alias ) ) {
				continue;
			}
			$key        = strtolower( (string) ( $alias['key'] ?? '' ) );
			$folder_name = (string) ( $alias['folderName'] ?? '' );
			$alias_list  = isset( $alias['aliases'] ) && is_array( $alias['aliases'] ) ? $alias['aliases'] : array();
			if ( $key === $leaf || strtolower( $folder_name ) === $leaf ) {
				return $folder_name !== '' ? $folder_name : $trimmed;
			}
			foreach ( $alias_list as $alias_name ) {
				if ( strtolower( (string) $alias_name ) === $leaf ) {
					return $folder_name !== '' ? $folder_name : $trimmed;
				}
			}
		}
		return $trimmed;
	}

	/**
	 * @param array<int,string> $segments
	 * @return array<int,string>
	 */
	private static function edmonton_now(): DateTimeImmutable {
		return new DateTimeImmutable( 'now', new DateTimeZone( 'America/Edmonton' ) );
	}

	private static function drive_year_segment( ?DateTimeImmutable $now = null ): string {
		$now = $now instanceof DateTimeImmutable ? $now : self::edmonton_now();
		return $now->format( 'Y' );
	}

	private static function drive_month_segment( ?DateTimeImmutable $now = null ): string {
		$now = $now instanceof DateTimeImmutable ? $now : self::edmonton_now();
		return $now->format( 'F' );
	}

	private static function is_drive_month_segment( string $value ): bool {
		$trimmed = trim( $value );
		if ( $trimmed === '' ) {
			return false;
		}
		return strtotime( $trimmed . ' 1, 2000' ) !== false;
	}

	/**
	 * @param array<int,string> $left
	 * @param array<int,string> $right
	 */
	private static function drive_segments_match( array $left, array $right ): bool {
		if ( count( $left ) !== count( $right ) ) {
			return false;
		}
		foreach ( $right as $index => $expected ) {
			if ( strtolower( (string) ( $left[ $index ] ?? '' ) ) !== strtolower( (string) $expected ) ) {
				return false;
			}
		}
		return true;
	}

	private static function append_drive_date_segments( array $segments ): array {
		if ( empty( $segments ) ) {
			return $segments;
		}
		$year_segment  = self::drive_year_segment();
		$month_segment = self::drive_month_segment();
		$last          = $segments[ count( $segments ) - 1 ] ?? '';
		$second_last   = $segments[ count( $segments ) - 2 ] ?? '';
		if ( preg_match( '/^\d{4}$/', (string) $second_last ) && self::is_drive_month_segment( (string) $last ) ) {
			return $segments;
		}
		if ( preg_match( '/^\d{4}$/', (string) $last ) ) {
			return array_merge( $segments, array( $month_segment ) );
		}
		return array_merge( $segments, array( $year_segment, $month_segment ) );
	}
}
