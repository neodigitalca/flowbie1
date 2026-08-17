<?php
/**
 * Backend Assist module contract tests (no OpenRouter).
 *
 * Run: php tests/test-backend-assist-module.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$neo_pulse_ba_test_user_id = 42;

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $str ) {
		return trim( (string) $str );
	}
}

if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( $str ) {
		return trim( (string) $str );
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'get_current_user_id' ) ) {
	function get_current_user_id() {
		global $neo_pulse_ba_test_user_id;
		return (int) $neo_pulse_ba_test_user_id;
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data, $options = 0 ) {
		unset( $options );
		return json_encode( $data );
	}
}

if ( ! function_exists( 'absint' ) ) {
	function absint( $maybeint ) {
		return abs( (int) $maybeint );
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {
	function is_wp_error( $thing ) {
		return is_object( $thing ) && $thing instanceof WP_Error;
	}
}

if ( ! class_exists( 'WP_Error', false ) ) {
	class WP_Error {
		private $message;

		public function __construct( $code = '', $message = '', $data = '' ) {
			unset( $code, $data );
			$this->message = (string) $message;
		}

		public function get_error_message() {
			return $this->message;
		}
	}
}

if ( ! function_exists( 'wp_trim_words' ) ) {
	function wp_trim_words( $text, $num_words = 55, $more = null ) {
		unset( $more );
		$words = preg_split( '/\s+/', trim( (string) $text ) );
		if ( count( $words ) <= $num_words ) {
			return trim( (string) $text );
		}
		return implode( ' ', array_slice( $words, 0, $num_words ) ) . '…';
	}
}

if ( ! function_exists( 'get_post' ) ) {
	function get_post( $post_id ) {
		unset( $post_id );
		return null;
	}
}

if ( ! function_exists( 'get_the_modified_date' ) ) {
	function get_the_modified_date( $format, $post ) {
		unset( $format, $post );
		return 'Aug 10, 2026';
	}
}

if ( ! function_exists( 'sanitize_title' ) ) {
	function sanitize_title( $title ) {
		$title = strtolower( trim( (string) $title ) );
		$title = preg_replace( '/[^a-z0-9]+/', '-', $title );
		return trim( $title, '-' );
	}
}

if ( ! class_exists( 'Neo_Pulse_Wp_Ai_Context', false ) ) {
	class Neo_Pulse_Wp_Ai_Context {
		public static function read_focus_keyword( int $post_id ): string {
			unset( $post_id );
			return 'window covering ideas';
		}

		public static function read_seo_title( int $post_id ): string {
			unset( $post_id );
			return 'Old saved SEO title';
		}

		public static function read_meta_description( int $post_id ): string {
			unset( $post_id );
			return 'Old saved meta description';
		}

		public static function meta_hub_values( int $post_id ): array {
			unset( $post_id );
			return array(
				'seoTitle'        => '',
				'metaDescription' => '',
				'focusKeyword'    => 'window covering ideas',
				'seoResearch'     => '',
				'faq'             => '',
				'pageUrl'         => '',
			);
		}
	}
}

$ba_dir = NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-context.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-ai.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-cards.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-registry.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-workflow.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-pipeline-content-prep.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-body-ops.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-seo-limits.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-subagent-aiseo.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-subagent-wysiwyg.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-subagent-registry.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-meta-compound.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-pipeline-phases.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-build-harness.php';
require_once $ba_dir . 'class-neo-pulse-wp-backend-assist-plan-preview.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-backend-assist.php';

$failures = 0;

function ba_assert( bool $cond, string $label ): void {
	global $failures;
	if ( ! $cond ) {
		echo "FAIL: {$label}\n";
		++$failures;
		return;
	}
	echo "OK: {$label}\n";
}

// parse_json_response strips fences.
$parsed = Neo_Pulse_Wp_Backend_Assist_Ai::parse_json_response( "```json\n{\"intent\":\"action\"}\n```" );
ba_assert( is_array( $parsed ) && ( $parsed['intent'] ?? '' ) === 'action', 'parse_json_response strips markdown fences' );

$bad = Neo_Pulse_Wp_Backend_Assist_Ai::parse_json_response( 'not json' );
ba_assert( null === $bad, 'parse_json_response returns null for invalid JSON' );

// normalize_history caps and sanitizes.
$history = Neo_Pulse_Wp_Backend_Assist_Cards::normalize_history(
	array(
		array( 'role' => 'user', 'content' => '  hello  ' ),
		array( 'role' => 'assistant', 'content' => 'world' ),
	)
);
ba_assert( count( $history ) === 2 && $history[0]['content'] === 'hello', 'normalize_history sanitizes content' );

$many = array_fill( 0, 15, array( 'role' => 'user', 'content' => 'x' ) );
$trimmed = Neo_Pulse_Wp_Backend_Assist_Cards::normalize_history( $many );
ba_assert( count( $trimmed ) === 10, 'normalize_history keeps last 10 entries' );

// workflow transient key is user-scoped.
$key = Neo_Pulse_Wp_Backend_Assist_Workflow::workflow_transient_key( 'wf_abc123' );
ba_assert( str_contains( $key, 'neo-pulse_ba_wf_42_' ) && str_contains( $key, 'wf_abc123' ), 'workflow_transient_key includes user id' );

// Tool registry + executable checks.
Neo_Pulse_Wp_Backend_Assist_Registry::register_tool(
	'test_tool',
	static function ( array $params ): array {
		unset( $params );
		return array( 'success' => true );
	},
	'A test tool'
);
ba_assert(
	str_contains( Neo_Pulse_Wp_Backend_Assist_Registry::get_tool_descriptions(), 'test_tool' ),
	'get_tool_descriptions lists registered tools'
);
ba_assert(
	Neo_Pulse_Wp_Backend_Assist_Workflow::is_registered_executable_tool( 'test_tool' ),
	'is_registered_executable_tool true for registry tool'
);
ba_assert(
	! Neo_Pulse_Wp_Backend_Assist_Workflow::is_registered_executable_tool( 'missing_tool' ),
	'is_registered_executable_tool false for unknown tool'
);
ba_assert(
	Neo_Pulse_Wp_Backend_Assist_Workflow::is_step_executable( array( 'tool' => 'test_tool' ) ),
	'is_step_executable true for registered tool step'
);
ba_assert(
	! Neo_Pulse_Wp_Backend_Assist_Workflow::is_step_executable( array( 'tool' => 'micro_section', 'status' => 'pending' ) ),
	'is_step_executable false for micro_section pseudo tool'
);

// Facade delegates registry.
Neo_Pulse_Wp_Backend_Assist::register_tool(
	'facade_tool',
	static function ( array $params ): array {
		unset( $params );
		return array( 'success' => true );
	},
	'Via facade'
);
ba_assert(
	str_contains( Neo_Pulse_Wp_Backend_Assist::get_tool_descriptions(), 'facade_tool' ),
	'facade register_tool and get_tool_descriptions'
);

// error_card shape.
$card = Neo_Pulse_Wp_Backend_Assist_Cards::error_card( 'Test error' );
ba_assert( ( $card['type'] ?? '' ) === 'error' && ( $card['body'] ?? '' ) === 'Test error', 'error_card structure' );

// Plan preview: sanitize strips content-generating params.
$sanitized = Neo_Pulse_Wp_Backend_Assist_Plan_Preview::sanitize_params_for_preview(
	array(
		'post_id'         => 19903,
		'content'         => '<p>final html</p>',
		'faq'             => array( 'q' => 'a' ),
		'metaDescription' => 'meta copy',
		'nested'          => array(
			'seoResearch' => 'brief data',
			'keep'        => 'yes',
		),
	)
);
ba_assert(
	! isset( $sanitized['content'] ) && ! isset( $sanitized['faq'] ) && ! isset( $sanitized['metaDescription'] ),
	'sanitize_params_for_preview strips content-generating keys'
);
ba_assert(
	19903 === (int) ( $sanitized['post_id'] ?? 0 )
	&& 'yes' === ( $sanitized['nested']['keep'] ?? '' )
	&& ! isset( $sanitized['nested']['seoResearch'] ),
	'sanitize_params_for_preview keeps safe keys and recurses'
);

// Plan preview: format_template includes required sections.
$plan_body = Neo_Pulse_Wp_Backend_Assist_Plan_Preview::format_template(
	'add focus keyword and meta description for acf',
	array(
		'goal'             => 'Update ACF SEO fields on the target post.',
		'plan_description' => 'Resolve the post from context, then apply focus keyword and meta description through ACF without generating final copy in Plan mode.',
		'tasks'            => array( 'Resolve post', 'Update focus keyword', 'Update meta description' ),
		'unchanged'        => array( 'Post body HTML' ),
	),
	array()
);
foreach ( array( 'Your request', 'Goal', 'Plan', 'Tasks', 'Unchanged', 'Approval' ) as $section ) {
	ba_assert( str_contains( $plan_body, '**' . $section . '**' ), 'format_template includes ' . $section );
}
ba_assert(
	str_contains( $plan_body, '> add focus keyword and meta description for acf' )
	&& str_contains( $plan_body, '1. Resolve post' )
	&& str_contains( $plan_body, 'Switch to Build to run this plan.' ),
	'format_template renders request quote, tasks, and approval'
);

// Plan preview: empty narrative still yields valid markdown with task_labels fallback.
$fallback_body = Neo_Pulse_Wp_Backend_Assist_Plan_Preview::format_template(
	'change the intro h2',
	array(
		'goal'             => '',
		'plan_description' => '',
		'tasks'            => array(),
	),
	array( 'task_labels' => array( 'Target intro section', 'Apply heading op' ) )
);
ba_assert(
	str_contains( $fallback_body, '**Goal**' )
	&& str_contains( $fallback_body, '**Plan**' )
	&& str_contains( $fallback_body, '1. Target intro section' )
	&& str_contains( $fallback_body, 'Switch to Build to run this plan.' ),
	'format_template fallback defaults and task_labels'
);

// Plan preview: links_for_post returns empty without a real post.
ba_assert(
	[] === Neo_Pulse_Wp_Backend_Assist_Cards::links_for_post( 0 ),
	'links_for_post returns empty for invalid post id'
);

$stamped_plan = Neo_Pulse_Wp_Backend_Assist_Cards::enrich_plan_card(
	array(
		'type'           => 'plan',
		'submode_switch' => 'build',
		'title'          => 'Proposed plan',
	),
	0,
	'add_content',
	'remove the first section on this post'
);
ba_assert(
	'remove the first section on this post' === ( $stamped_plan['build_message'] ?? '' ),
	'enrich_plan_card stamps build_message for Build plans'
);

ba_assert(
	! Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::should_use_body_ops( 'can you rewrite the blog', 19903, array() ),
	'rewrite the blog uses full replace path not body ops'
);
ba_assert(
	Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::message_requests_full_body_rewrite( 'can you rewrite the blog' ),
	'message_requests_full_body_rewrite detects blog rewrite'
);

// Meta copy constraints: extract em dash + 2 exclamation from user message.
$sample_message = 'refresh the meta on this post with an em dash and 2 exclamation marks';
$constraints = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::extract_meta_copy_constraints( $sample_message );
ba_assert(
	! empty( $constraints['requires_em_dash'] ) && 2 === (int) ( $constraints['min_exclamations'] ?? 0 ),
	'extract_meta_copy_constraints detects em dash and 2 exclamations'
);

// Meta copy constraints: meets_constraints pass/fail fixtures.
ba_assert(
	Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::meta_copy_meets_constraints(
		'Window ideas — refresh now!!',
		array( 'requires_em_dash' => true, 'min_exclamations' => 2 )
	),
	'meta_copy_meets_constraints passes valid fixture'
);
ba_assert(
	! Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::meta_copy_meets_constraints(
		'Window ideas refresh now',
		array( 'requires_em_dash' => true, 'min_exclamations' => 2 )
	),
	'meta_copy_meets_constraints fails missing markers'
);

// Action card: save_post_meta shows saved SEO copy from values.
$action = Neo_Pulse_Wp_Backend_Assist_Cards::action_card(
	array(
		'success' => true,
		'post_id' => 19903,
		'saved'   => array( 'title', 'excerpt' ),
		'values'  => array(
			'seoTitle'        => 'Blinds guide — top picks!!',
			'metaDescription' => 'Explore blinds — ideas and tips!!',
		),
	),
	'save_post_meta'
);
ba_assert(
	str_contains( (string) ( $action['body'] ?? '' ), '**SEO title:** Blinds guide — top picks!!' )
	&& str_contains( (string) ( $action['body'] ?? '' ), '**Meta description:**' )
	&& str_contains( (string) ( $action['body'] ?? '' ), '**Saved fields:** title, excerpt' ),
	'action_card save_post_meta includes SEO title and meta description'
);

// Build harness: details_drawer payload on action cards.
$wrapped = Neo_Pulse_Wp_Backend_Assist_Build_Harness::wrap_card(
	array(
		'type'          => 'action',
		'title'         => 'SEO meta updated',
		'body'          => 'legacy body',
		'action_result' => array(
			'build_executed' => true,
			'success' => true,
			'post_id' => 19903,
			'title'   => 'Ten Window Covering Ideas',
			'saved'   => array( 'title', 'excerpt' ),
			'values'  => array(
				'seoTitle'        => 'Blinds — top picks!!',
				'metaDescription' => 'Explore blinds — tips!!',
			),
		),
	),
	'refresh the meta on this post'
);
$gen_files = $wrapped['details_drawer']['generated_files'] ?? array();
ba_assert(
	! empty( $wrapped['details_drawer']['prep']['steps'] )
	&& 3 === count( $wrapped['details_drawer']['prep']['steps'] )
	&& 4 === count( $gen_files )
	&& 3 === (int) ( $wrapped['details_drawer']['progress']['total'] ?? 0 )
	&& '' === (string) ( $wrapped['body'] ?? 'x' ),
	'wrap_card attaches details_drawer with meta prep, four files, and clears markdown body'
);
ba_assert(
	'Blinds — top picks!!' === ( $wrapped['details_drawer']['result_summary']['seo_title'] ?? '' ),
	'wrap_card result_summary includes seo title'
);

$deliverable_file = null;
$upload_file      = null;
foreach ( $gen_files as $file ) {
	if ( ( $file['id'] ?? '' ) === 'deliverable' ) {
		$deliverable_file = $file;
	}
	if ( ( $file['id'] ?? '' ) === 'upload' ) {
		$upload_file = $file;
	}
}
ba_assert(
	is_array( $deliverable_file )
	&& 'refresh-the-meta-on-this-post.json' === ( $deliverable_file['fileName'] ?? '' ),
	'wrap_card deliverable filename is slugged from user message'
);
$deliverable_body = json_decode( (string) ( $deliverable_file['content'] ?? '' ), true );
ba_assert(
	is_array( $deliverable_body )
	&& 'Blinds — top picks!!' === ( $deliverable_body['seoTitle'] ?? '' )
	&& 'Explore blinds — tips!!' === ( $deliverable_body['metaDescription'] ?? '' )
	&& ! isset( $deliverable_body['session_id'] )
	&& ! isset( $deliverable_body['exported_at'] )
	&& ! isset( $deliverable_body['tool'] ),
	'wrap_card deliverable contains saved meta fields only'
);
$upload_body = json_decode( (string) ( $upload_file['content'] ?? '' ), true );
ba_assert(
	is_array( $upload_body )
	&& true === ( $upload_body['success'] ?? false )
	&& 19903 === (int) ( $upload_body['post_id'] ?? 0 )
	&& 'refresh the meta on this post' === ( $upload_body['message'] ?? '' )
	&& ! empty( $upload_body['uploaded_at'] )
	&& ! isset( $upload_body['values'] ),
	'wrap_card upload.json is a receipt without full artifact payload'
);

$faq_schema = array(
	'@context'   => 'https://schema.org',
	'@type'      => 'FAQPage',
	'mainEntity' => array(
		array(
			'@type'          => 'Question',
			'name'           => 'What are window covering ideas?',
			'acceptedAnswer' => array(
				'@type' => 'Answer',
				'text'  => 'Blinds, shades, and drapes.',
			),
		),
	),
);
$faq_wrapped = Neo_Pulse_Wp_Backend_Assist_Build_Harness::wrap_card(
	array(
		'type'          => 'action',
		'title'         => 'FAQ schema updated',
		'body'          => '',
		'action_result' => array(
			'build_executed' => true,
			'success' => true,
			'post_id' => 19903,
			'saved'   => array( 'faq' ),
			'values'  => array(
				'faq' => wp_json_encode( $faq_schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ),
			),
		),
	),
	'rewrite the faq schema'
);
$faq_files = $faq_wrapped['details_drawer']['generated_files'] ?? array();
$faq_deliverable = null;
$faq_upload      = null;
foreach ( $faq_files as $file ) {
	if ( ( $file['id'] ?? '' ) === 'deliverable' ) {
		$faq_deliverable = $file;
	}
	if ( ( $file['id'] ?? '' ) === 'upload' ) {
		$faq_upload = $file;
	}
}
ba_assert(
	is_array( $faq_deliverable )
	&& 'rewrite-the-faq-schema.json' === ( $faq_deliverable['fileName'] ?? '' ),
	'FAQ wrap_card deliverable filename matches request slug'
);
$faq_body = json_decode( (string) ( $faq_deliverable['content'] ?? '' ), true );
ba_assert(
	is_array( $faq_body )
	&& 'FAQPage' === ( $faq_body['@type'] ?? '' )
	&& ! empty( $faq_body['mainEntity'] )
	&& ! isset( $faq_body['session_id'] ),
	'FAQ deliverable is FAQPage JSON only'
);
$faq_upload_body = json_decode( (string) ( $faq_upload['content'] ?? '' ), true );
ba_assert(
	is_array( $faq_upload_body )
	&& in_array( 'faq', $faq_upload_body['saved'] ?? array(), true )
	&& ! isset( $faq_upload_body['mainEntity'] ),
	'FAQ upload.json receipt lists saved faq without schema body'
);

ba_assert(
	'rewrite-the-faq-schema' === Neo_Pulse_Wp_Backend_Assist_Build_Harness::message_slug_for_filename( 'rewrite the faq schema' ),
	'message_slug_for_filename slugifies request text'
);

$unstamped = Neo_Pulse_Wp_Backend_Assist_Build_Harness::wrap_card(
	array(
		'type'          => 'action',
		'title'         => 'SEO meta updated',
		'action_result' => array(
			'success' => true,
			'post_id' => 19903,
			'saved'   => array( 'title' ),
			'values'  => array( 'seoTitle' => 'Test title' ),
		),
	),
	'refresh the meta on this post'
);
ba_assert(
	empty( $unstamped['details_drawer'] ),
	'wrap_card skips drawer without build_executed'
);

$faq_no_values = Neo_Pulse_Wp_Backend_Assist_Build_Harness::wrap_card(
	array(
		'type'          => 'action',
		'action_result' => array(
			'build_executed' => true,
			'success'        => true,
			'post_id'        => 19903,
			'saved'          => array( 'faq' ),
			'values'         => array(),
		),
	),
	'rewrite the faq schema'
);
$faq_no_values_files = $faq_no_values['details_drawer']['generated_files'] ?? array();
$faq_no_values_deliverable = null;
foreach ( $faq_no_values_files as $file ) {
	if ( ( $file['id'] ?? '' ) === 'deliverable' ) {
		$faq_no_values_deliverable = $file;
	}
}
$faq_no_values_body = json_decode( (string) ( $faq_no_values_deliverable['content'] ?? '' ), true );
ba_assert(
	is_array( $faq_no_values_body )
	&& ! empty( $faq_no_values_body['error'] ),
	'FAQ deliverable does not fall back to post meta when values.faq is empty'
);

ba_assert(
	Neo_Pulse_Wp_Backend_Assist_Meta_Compound::message_requests_meta_compound( 'rewrite meta and title' ),
	'message_requests_meta_compound detects meta refresh rewrite'
);
ba_assert(
	! Neo_Pulse_Wp_Backend_Assist_Meta_Compound::message_requests_meta_compound( 'add focus keyword for acf' ),
	'message_requests_meta_compound skips focus keyword only'
);

$meta_plan_params = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::resolve_plan_action_params(
	'rewrite meta and title',
	array(),
	array(
		'tool'   => 'save_post_meta',
		'params' => array( 'post_id' => 19903 ),
	),
	true
);
ba_assert(
	! empty( $meta_plan_params['meta_compound'] )
	&& 19903 === (int) ( $meta_plan_params['post_id'] ?? 0 )
	&& ! empty( $meta_plan_params['agents'] )
	&& ! isset( $meta_plan_params['seoTitle'] )
	&& ! isset( $meta_plan_params['metaDescription'] ),
	'resolve_plan_action_params caches agents list without pre-generated copy'
);

$resolved_meta_agents = Neo_Pulse_Wp_Backend_Assist_Subagent_Registry::resolve_agents_for_message( 'rewrite meta and title', 19903 );
ba_assert(
	$resolved_meta_agents === array( 'seo_title', 'meta_description' ),
	'resolve_agents_for_message maps meta refresh to seo_title and meta_description'
);

$resolved_kw_agents = Neo_Pulse_Wp_Backend_Assist_Subagent_Registry::resolve_agents_for_message( 'add focus keyword for acf', 19903 );
ba_assert(
	$resolved_kw_agents === array( 'focus_keyword' ),
	'resolve_agents_for_message maps focus keyword only request'
);

$ctx = Neo_Pulse_Wp_Backend_Assist_Subagent_Aiseo::build_context( 19903 );
$ctx['post_title'] = '10 Window Covering Ideas to Transform Your Home';
$paraphrase_reject = Neo_Pulse_Wp_Backend_Assist_Subagent_Aiseo::validate_seo_title(
	19903,
	'10 Window Covering Ideas for Your Home',
	$ctx,
	'rewrite meta and title'
);
ba_assert(
	is_wp_error( $paraphrase_reject ),
	'validate_seo_title rejects post-title paraphrase via similarity check'
);

$meta_prep_steps = Neo_Pulse_Wp_Backend_Assist_Build_Harness::harness_prep_steps(
	'rewrite meta and title',
	array( 'meta_compound' => true, 'agent_trace' => array(
		array( 'agent_id' => 'seo_title', 'label' => 'Generate SEO title', 'status' => 'done' ),
		array( 'agent_id' => 'meta_description', 'label' => 'Generate meta description', 'status' => 'done' ),
		array( 'agent_id' => 'upload', 'label' => 'Upload to post', 'status' => 'done' ),
	) )
);
ba_assert(
	3 === count( $meta_prep_steps )
	&& 'Generate SEO title' === ( $meta_prep_steps[0]['label'] ?? '' )
	&& 'Upload to post' === ( $meta_prep_steps[2]['label'] ?? '' ),
	'harness_prep_steps lists meta compound sub-agent steps'
);

Neo_Pulse_Wp_Backend_Assist_Context::$tool_registry['save_post_meta'] = array(
	'handler' => static function ( array $params ): array {
		return array(
			'success' => true,
			'post_id' => absint( $params['post_id'] ?? 0 ),
			'saved'   => array( 'title', 'excerpt' ),
			'values'  => array(
				'seoTitle'        => (string) ( $params['seoTitle'] ?? '' ),
				'metaDescription' => (string) ( $params['metaDescription'] ?? '' ),
			),
		);
	},
);
Neo_Pulse_Wp_Backend_Assist_Meta_Compound::$test_subagent_outputs = array(
	'seoTitle'        => 'Window covering ideas: best blinds guide',
	'metaDescription' => 'Want window covering ideas? Explore blinds, shades, and custom drapes for every room in your home today.',
);
$meta_compound_card = Neo_Pulse_Wp_Backend_Assist_Meta_Compound::run(
	'rewrite meta and title',
	array(),
	array( 'post_id' => 19903 )
);
Neo_Pulse_Wp_Backend_Assist_Meta_Compound::$test_subagent_outputs = null;
$meta_exec = $meta_compound_card['action_result'] ?? array();
ba_assert(
	! empty( $meta_exec['success'] )
	&& ! empty( $meta_exec['meta_compound'] )
	&& ! empty( $meta_exec['build_executed'] )
	&& ! empty( $meta_exec['values']['seoTitle'] )
	&& ! empty( $meta_exec['values']['metaDescription'] )
	&& str_contains( (string) ( $meta_exec['values']['seoTitle'] ?? '' ), 'Window covering ideas' )
	&& str_contains( (string) ( $meta_exec['values']['metaDescription'] ?? '' ), 'window covering ideas' ),
	'meta compound runner merges sub-agents and uploads via save_post_meta'
);

$meta_wrapped = Neo_Pulse_Wp_Backend_Assist_Build_Harness::wrap_card(
	array(
		'type'          => 'action',
		'action_result' => $meta_exec,
	),
	'rewrite meta and title'
);
$meta_prep = $meta_wrapped['details_drawer']['prep']['steps'] ?? array();
ba_assert(
	3 === count( $meta_prep ),
	'wrap_card uses meta compound prep steps in details drawer'
);

Neo_Pulse_Wp_Backend_Assist_Context::$builder_context = array(
	'target_scope'  => 'site',
	'frontend_page' => array(
		'post_id' => 99,
		'url'     => 'https://example.com/page/',
	),
);
ba_assert(
	0 === Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::resolve_effective_post_id( array() ),
	'resolve_effective_post_id returns 0 in site scope without explicit post_id'
);
ba_assert(
	99 === Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::resolve_effective_post_id( array( 'post_id' => 99 ) ),
	'resolve_effective_post_id honors explicit post_id in site scope'
);
Neo_Pulse_Wp_Backend_Assist_Context::$builder_context = null;

echo $failures === 0 ? "\nAll Backend Assist module tests passed.\n" : "\n{$failures} test(s) failed.\n";
exit( $failures === 0 ? 0 : 1 );
