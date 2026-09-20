<?php
/**
 * POST /api/elementor/* handlers (Novamira MCP proxy).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Elementor_Route_Handlers {

	/**
	 * @param string              $subpath Route after elementor/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );
		if ( $method !== 'POST' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Method not allowed' ), 405 );
			return;
		}

		try {
			if ( $subpath === 'status' ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( self::status( $body ) );
				return;
			}
			if ( $subpath === 'tools' ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'tools' => self::tools( $body ) ) );
				return;
			}
			if ( $subpath === 'get-page-id-by-slug' ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( self::get_page_id_by_slug( $body ) );
				return;
			}
			if ( $subpath === 'get-page' ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( self::get_page( $body ) );
				return;
			}
			if ( $subpath === 'update-page' ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( self::update_page( $body ) );
				return;
			}
		} catch ( Throwable $e ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => $e->getMessage() ), 400 );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{siteUrl:string,username:string,appPassword:string}
	 */
	private static function auth( array $body ) {
		$site_url = isset( $body['siteUrl'] ) ? trim( (string) $body['siteUrl'] ) : '';
		$username = isset( $body['username'] ) ? trim( (string) $body['username'] ) : '';
		$password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		if ( $site_url === '' || $username === '' || $password === '' ) {
			throw new RuntimeException( 'Missing WordPress siteUrl, username, or appPassword.' );
		}
		return array(
			'siteUrl'     => $site_url,
			'username'    => $username,
			'appPassword' => $password,
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{novamira:bool,elementor:bool,frontPageId:int}
	 */
	private static function status( array $body ) {
		$auth   = self::auth( $body );
		$parsed = self::run_php(
			$auth,
			'return array("novamira"=>true,"elementor"=>(defined("ELEMENTOR_VERSION")||class_exists("\\\\Elementor\\\\Plugin")),"frontPageId"=>(int)get_option("page_on_front"));'
		);
		return array(
			'novamira'    => ! empty( $parsed['novamira'] ),
			'elementor'   => ! empty( $parsed['elementor'] ),
			'frontPageId' => isset( $parsed['frontPageId'] ) ? (int) $parsed['frontPageId'] : 0,
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<int,array<string,mixed>>
	 */
	private static function tools( array $body ) {
		$auth = self::auth( $body );
		return Neo_Pulse_App_Elementor_Novamira_Client::list_tools( $auth['siteUrl'], $auth['username'], $auth['appPassword'] );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{pageId:int}
	 */
	private static function get_page_id_by_slug( array $body ) {
		$auth = self::auth( $body );
		$slug = isset( $body['slug'] ) ? sanitize_title( (string) $body['slug'] ) : '';
		if ( $slug === '' || $slug === '__front' || $slug === 'front' ) {
			$parsed = self::run_php( $auth, 'return array("pageId"=>(int)get_option("page_on_front"));' );
			$id     = isset( $parsed['pageId'] ) ? (int) $parsed['pageId'] : 0;
			if ( $id <= 0 ) {
				throw new RuntimeException( 'No front page is set on this WordPress site.' );
			}
			return array( 'pageId' => $id );
		}
		$code   = '$page=get_page_by_path(' . wp_json_encode( $slug ) . ',OBJECT,"page");return array("pageId"=>$page?(int)$page->ID:0);';
		$parsed = self::run_php( $auth, $code );
		$id     = isset( $parsed['pageId'] ) ? (int) $parsed['pageId'] : 0;
		if ( $id <= 0 ) {
			throw new RuntimeException( 'No page matches that slug.' );
		}
		return array( 'pageId' => $id );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{id:int,meta:array<string,mixed>}
	 */
	private static function get_page( array $body ) {
		$auth    = self::auth( $body );
		$page_id = isset( $body['pageId'] ) ? (int) $body['pageId'] : 0;
		if ( $page_id <= 0 ) {
			throw new RuntimeException( 'Missing pageId.' );
		}
		$code   = 'return array("id"=>' . $page_id . ',"meta"=>array("_elementor_data"=>get_post_meta(' . $page_id . ',"_elementor_data",true),"_elementor_edit_mode"=>get_post_meta(' . $page_id . ',"_elementor_edit_mode",true)));';
		$parsed = self::run_php( $auth, $code );
		if ( ! isset( $parsed['id'] ) ) {
			throw new RuntimeException( 'Novamira did not return page data.' );
		}
		return array(
			'id'   => (int) $parsed['id'],
			'meta' => isset( $parsed['meta'] ) && is_array( $parsed['meta'] ) ? $parsed['meta'] : array(),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{ok:bool,pageId:int}
	 */
	private static function update_page( array $body ) {
		$auth    = self::auth( $body );
		$page_id = isset( $body['pageId'] ) ? (int) $body['pageId'] : 0;
		$json    = isset( $body['elementor_data'] ) ? (string) $body['elementor_data'] : '';
		if ( $page_id <= 0 || $json === '' ) {
			throw new RuntimeException( 'Missing pageId or elementor_data.' );
		}
		json_decode( $json );
		if ( json_last_error() !== JSON_ERROR_NONE ) {
			throw new RuntimeException( 'elementor_data is not valid JSON.' );
		}

		$b64  = base64_encode( $json );
		$code = implode(
			'',
			array(
				'$page_id=' . $page_id . ';',
				'$elements=json_decode(base64_decode(\'' . $b64 . '\'),true);',
				'if(!is_array($elements)){return array(\'error\'=>\'Invalid Elementor JSON\');}',
				'$encoded=wp_json_encode($elements);',
				'if(!is_string($encoded)||$encoded===\'\'){return array(\'error\'=>\'Could not encode Elementor JSON\');}',
				'update_post_meta($page_id,\'_elementor_edit_mode\',\'builder\');',
				'update_post_meta($page_id,\'_elementor_template_type\',\'wp-page\');',
				'update_post_meta($page_id,\'_elementor_data\',wp_slash($encoded));',
				'delete_post_meta($page_id,\'_elementor_element_cache\');',
				'delete_post_meta($page_id,\'_elementor_css\');',
				'$stored=get_post_meta($page_id,\'_elementor_data\',true);',
				'$decoded=is_string($stored)?json_decode($stored,true):(is_array($stored)?$stored:array());',
				'$first=(is_array($decoded)&&isset($decoded[0][\'id\']))?(string)$decoded[0][\'id\']:\'\';',
				'$want=isset($elements[0][\'id\'])?(string)$elements[0][\'id\']:\'\';',
				'if($want!==\'\'&&$first!==$want){return array(\'error\'=>\'Live _elementor_data was not updated\');}',
				'return array(\'ok\'=>true,\'pageId\'=>$page_id,\'firstId\'=>$first);',
			)
		);
		$parsed = self::run_php( $auth, $code );
		if ( ! empty( $parsed['error'] ) || empty( $parsed['ok'] ) ) {
			throw new RuntimeException(
				! empty( $parsed['error'] ) ? (string) $parsed['error'] : 'Live _elementor_data was not updated.'
			);
		}
		return array(
			'ok'      => true,
			'pageId'  => isset( $parsed['pageId'] ) ? (int) $parsed['pageId'] : $page_id,
			'firstId' => isset( $parsed['firstId'] ) ? (string) $parsed['firstId'] : '',
		);
	}

	/**
	 * @param array{siteUrl:string,username:string,appPassword:string} $auth
	 * @param string                                                     $code
	 * @return mixed
	 */
	private static function run_php( array $auth, $code ) {
		$tools = Neo_Pulse_App_Elementor_Novamira_Client::list_tools( $auth['siteUrl'], $auth['username'], $auth['appPassword'] );
		$direct = Neo_Pulse_App_Elementor_Novamira_Client::find_tool(
			$tools,
			array( 'execute-php', 'execute_php', 'novamira/execute-php', 'novamira-execute-php' )
		);
		if ( $direct ) {
			$result = Neo_Pulse_App_Elementor_Novamira_Client::call_tool(
				$auth['siteUrl'],
				$auth['username'],
				$auth['appPassword'],
				$direct['name'],
				Neo_Pulse_App_Elementor_Novamira_Client::execute_php_arguments( $direct, $code )
			);
			return Neo_Pulse_App_Elementor_Novamira_Client::unwrap_execute_php( $result );
		}

		$exec = Neo_Pulse_App_Elementor_Novamira_Client::find_tool(
			$tools,
			array( 'mcp-adapter-execute-ability', 'execute-ability', 'execute_ability' )
		);
		if ( ! $exec ) {
			throw new RuntimeException( 'Novamira Elementor tools are not available.' );
		}
		$result = Neo_Pulse_App_Elementor_Novamira_Client::call_tool(
			$auth['siteUrl'],
			$auth['username'],
			$auth['appPassword'],
			$exec['name'],
			array(
				'ability_name' => 'novamira/execute-php',
				'parameters'   => array( 'code' => $code ),
			)
		);
		return Neo_Pulse_App_Elementor_Novamira_Client::unwrap_execute_php( $result );
	}
}
