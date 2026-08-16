<?php
/**
 * Pulse Assist facade for platform read-only data tools.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Data_Tools {

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $module_research
	 * @return array{block:string,label:string,toolIds:array<int,string>,rows:array<int,array<string,mixed>>,classifierReason:string,inventorySource:string,acfComplete:bool}
	 */
	public static function research_for_message( string $message, array $history, array $body, ?array $module_research = null, ?callable $emit = null ): array {
		return Neo_Pulse_App_Platform_Data_Tools::research_for_message( $message, $history, $body, $module_research, $emit );
	}
}
