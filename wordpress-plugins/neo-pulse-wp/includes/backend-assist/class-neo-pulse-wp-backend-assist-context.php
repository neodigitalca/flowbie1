<?php
/**
 * Backend Assist — shared constants and mutable request state.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Context {

	const REST_NAMESPACE = 'neo-pulse/v1';
	const FAST_MODEL     = 'google/gemini-2.5-flash-lite';
	const REASON_MODEL   = 'google/gemini-2.5-flash';
	const WORKFLOW_TTL   = 900;

	/** @var array<string, array{handler: callable, description: string}> */
	public static $tool_registry = array();

	/** @var array<string, mixed>|null */
	public static ?array $builder_context = null;
}
