<?php
/**
 * Maps executionKind to runner classes.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Registry {

	/** @var array<string,string> */
	private static $runners = array(
		'content_optimizer'      => 'Neo_Pulse_App_Task_Execution_Runner_Content_Optimizer',
		'content_optimizer_meta' => 'Neo_Pulse_App_Task_Execution_Runner_Content_Optimizer',
		'content_gap_check'      => 'Neo_Pulse_App_Task_Execution_Runner_Content_Gap_Check',
		'gsc_reporting'          => 'Neo_Pulse_App_Task_Execution_Runner_Gsc_Reporting',
		'post_creator'           => 'Neo_Pulse_App_Task_Execution_Runner_Post_Creator',
		'entity_page_creator'    => 'Neo_Pulse_App_Task_Execution_Runner_Entity_Page_Creator',
		'entity_generator'       => 'Neo_Pulse_App_Task_Execution_Runner_Entity_Generator',
		'sap_generator'          => 'Neo_Pulse_App_Task_Execution_Runner_Sap_Generator',
		'local_dominator_export' => 'Neo_Pulse_App_Task_Execution_Runner_Local_Dominator_Export',
		'chatgpt_website_audit'  => 'Neo_Pulse_App_Task_Execution_Runner_ChatGpt_Audit',
		'dfs_llm_article_audit'  => 'Neo_Pulse_App_Task_Execution_Runner_Dfs_Article_Audit',
		'browser_automation'     => 'Neo_Pulse_App_Task_Execution_Runner_Browser_Automation',
	);

	/**
	 * @param array<string,mixed> $task
	 * @param array<string,mixed> $execution
	 * @param array<string,mixed> $context
	 * @return array<string,mixed>
	 */
	public static function run( string $kind, array $task, array $execution, array $context ): array {
		$kind = Neo_Pulse_App_Tasks_Store::sanitize_execution_kind( $kind );
		if ( $kind === '' || ! isset( self::$runners[ $kind ] ) ) {
			return array(
				'ok'    => false,
				'error' => 'Unknown execution kind.',
			);
		}
		$class = self::$runners[ $kind ];
		if ( ! class_exists( $class ) || ! method_exists( $class, 'run' ) ) {
			return array(
				'ok'    => false,
				'error' => 'Execution runner not available.',
			);
		}
		return $class::run( $kind, $task, $execution, $context );
	}
}
