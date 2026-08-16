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
		'gsc_reporting'          => 'Neo_Pulse_App_Task_Execution_Runner_Gsc_Reporting',
		'post_creator'           => 'Neo_Pulse_App_Task_Execution_Runner_Post_Creator',
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
