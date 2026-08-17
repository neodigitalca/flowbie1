#!/usr/bin/env python3
"""Split class-flowbie-wp-backend-assist.php into backend-assist/ modules."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "includes/class-flowbie-wp-backend-assist.php"
OUT = ROOT / "includes/backend-assist"

METHOD_GROUPS = {
    "Flowbie_Wp_Backend_Assist_Registry": [
        "register_tool",
        "get_tool_descriptions",
        "register_default_tools",
    ],
    "Flowbie_Wp_Backend_Assist_Sessions": [
        "sessions_dir",
        "session_path",
        "rest_sessions_list",
        "rest_session_get",
        "rest_sessions_save",
        "rest_session_delete",
        "rest_sessions_clear",
    ],
    "Flowbie_Wp_Backend_Assist_Cards": [
        "normalize_history",
        "action_card",
        "needs_info_card",
        "error_card",
    ],
    "Flowbie_Wp_Backend_Assist_Ai": [
        "call_openrouter",
        "parse_json_response",
        "build_site_context",
    ],
    "Flowbie_Wp_Backend_Assist_Tools_Wp": [
        "tool_create_page",
        "tool_create_post",
        "tool_list_posts",
        "tool_get_post",
        "tool_add_content",
        "tool_get_gsc_context",
        "resolve_post_by_title",
        "get_content_post_types",
    ],
    "Flowbie_Wp_Backend_Assist_Tools_Seo": [
        "tool_modify_seo_block_slots",
        "tool_list_seo_blocks",
        "tool_create_seo_block",
        "tool_delete_seo_block",
        "tool_save_seo_block",
        "tool_apply_seo_block_to_page",
        "resolve_seo_block_manifest",
    ],
    "Flowbie_Wp_Backend_Assist_Content": [
        "phase_plan_content_outline",
        "harness_feature_hint_suffix",
        "harness_section_label",
        "normalize_outline_sections",
        "sections_to_harness_outline",
        "section_to_agent",
        "generate_section_html",
        "execute_resolve_internal_links_step",
        "execute_write_sections_batch_step",
        "find_micro_step_index",
    ],
    "Flowbie_Wp_Backend_Assist_Workflow_Builder": [
        "build_workflow_steps",
        "workflow_needs_internal_links",
        "build_link_grep_query",
        "should_expand_workflow_sections",
    ],
    "Flowbie_Wp_Backend_Assist_Workflow": [
        "workflow_transient_key",
        "save_workflow",
        "is_registered_executable_tool",
        "is_step_executable",
        "load_workflow",
        "persist_workflow",
        "workflow_plan_card",
        "execute_workflow_step",
        "workflow_failure_card",
        "workflow_steps_for_card",
        "finalize_workflow_card",
        "optional_post_workflow_actions",
    ],
    "Flowbie_Wp_Backend_Assist_Pipeline_Classify": [
        "phase_classify",
        "phase_decompose_workflow",
    ],
    "Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep": [
        "prepare_tool_params",
        "generate_post_body_html",
        "strip_ai_html_fences",
        "builder_context_page_prompt",
    ],
    "Flowbie_Wp_Backend_Assist_Pipeline_Phases": [
        "phase_plan",
        "phase_execute",
        "phase_reason_action",
        "phase_reason_question",
        "phase_format",
    ],
    "Flowbie_Wp_Backend_Assist_Pipeline": [
        "run_pipeline",
        "run_plan",
    ],
    "Flowbie_Wp_Backend_Assist_Rest": [
        "register_routes",
        "rest_handle",
        "rest_step_handle",
        "rest_workflow_status",
    ],
}

# Methods kept on facade (init only) - rest delegated
FACADE_PUBLIC = [
    "init",
    "register_routes",
    "register_tool",
    "get_tool_descriptions",
    "rest_handle",
    "rest_step_handle",
    "rest_workflow_status",
    "rest_sessions_list",
    "rest_session_get",
    "rest_sessions_save",
    "rest_session_delete",
    "rest_sessions_clear",
] + [
    "tool_create_page",
    "tool_create_post",
    "tool_list_posts",
    "tool_get_post",
    "tool_add_content",
    "tool_get_gsc_context",
    "tool_modify_seo_block_slots",
    "tool_list_seo_blocks",
    "tool_create_seo_block",
    "tool_delete_seo_block",
    "tool_save_seo_block",
    "tool_apply_seo_block_to_page",
]

METHOD_TO_CLASS = {}
for cls, methods in METHOD_GROUPS.items():
    for m in methods:
        METHOD_TO_CLASS[m] = cls

CONTEXT_REPLACEMENTS = [
    (r"\bself::REST_NAMESPACE\b", "Flowbie_Wp_Backend_Assist_Context::REST_NAMESPACE"),
    (r"\bself::FAST_MODEL\b", "Flowbie_Wp_Backend_Assist_Context::FAST_MODEL"),
    (r"\bself::REASON_MODEL\b", "Flowbie_Wp_Backend_Assist_Context::REASON_MODEL"),
    (r"\bself::WORKFLOW_TTL\b", "Flowbie_Wp_Backend_Assist_Context::WORKFLOW_TTL"),
    (r"\bself::\$tool_registry\b", "Flowbie_Wp_Backend_Assist_Context::$tool_registry"),
    (r"\bself::\$builder_context\b", "Flowbie_Wp_Backend_Assist_Context::$builder_context"),
    (r"\b__CLASS__\b", "Flowbie_Wp_Backend_Assist"),  # only for route callbacks - fix per file
]


def parse_methods(source: str) -> dict[str, str]:
    """Extract method bodies keyed by name (brace-balanced)."""
    m = re.search(r"class Flowbie_Wp_Backend_Assist\s*\{", source)
    if not m:
        raise SystemExit("class not found")
    body = source[m.end() :].rstrip()
    if body.endswith("}"):
        body = body[:-1]

    header_re = re.compile(
        r"^(\t(?:public|private|protected)\s+static\s+function\s+(\w+)\s*\()",
        re.MULTILINE,
    )
    headers = list(header_re.finditer(body))
    methods = {}
    for i, match in enumerate(headers):
        name = match.group(2)
        pos = match.start()
        # Find opening brace of function body.
        depth = 0
        j = match.end()
        while j < len(body) and body[j] != "{":
            if body[j] == "(":
                depth += 1
            elif body[j] == ")":
                depth -= 1
            j += 1
        if j >= len(body):
            raise SystemExit(f"no opening brace for {name}")
        j += 1  # skip {
        depth = 1
        while j < len(body) and depth > 0:
            if body[j] == "{":
                depth += 1
            elif body[j] == "}":
                depth -= 1
            j += 1
        methods[name] = body[pos:j].rstrip()
    return methods


def transform_method_body(body: str, owner_class: str) -> str:
    """Replace self:: calls with correct class references."""
    out = body
    for pat, repl in CONTEXT_REPLACEMENTS[:5]:
        out = re.sub(pat, repl, out)

    def repl_self_call(m):
        method = m.group(1)
        if method in ("REST_NAMESPACE", "FAST_MODEL", "REASON_MODEL", "WORKFLOW_TTL"):
            return m.group(0)
        target = METHOD_TO_CLASS.get(method, owner_class)
        if target == owner_class:
            return f"self::{method}("
        return f"{target}::{method}("

    out = re.sub(r"\bself::(\w+)\s*\(", repl_self_call, out)
    return out


def visibility_for(method: str, owner: str) -> str:
    if method in FACADE_PUBLIC and owner != "Flowbie_Wp_Backend_Assist":
        return "public"
    if method.startswith("rest_") or method.startswith("tool_"):
        return "public"
    if method in ("register_tool", "get_tool_descriptions", "register_default_tools", "normalize_history"):
        return "public"
    if method in ("run_pipeline", "run_plan", "execute_workflow_step", "load_workflow"):
        return "public"
    return "public"  # modules use public static for cross-calls


def slug(class_name: str) -> str:
    return class_name.replace("Flowbie_Wp_Backend_Assist_", "").lower().replace("_", "-")


def file_header(class_name: str, desc: str) -> str:
    return f"""<?php
/**
 * Backend Assist — {desc}
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class {class_name} {{

"""


CONTEXT_FILE = """<?php
/**
 * Backend Assist — shared constants and mutable request state.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Context {

	const REST_NAMESPACE = 'flowbie/v1';
	const FAST_MODEL     = 'google/gemini-2.5-flash-lite';
	const REASON_MODEL   = 'google/gemini-2.5-flash';
	const WORKFLOW_TTL   = 900;

	/** @var array<string, array{handler: callable, description: string}> */
	public static $tool_registry = array();

	/** @var array<string, mixed>|null */
	public static ?array $builder_context = null;
}
"""


def main():
    source = SRC.read_text(encoding="utf-8")
    methods = parse_methods(source)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "class-flowbie-wp-backend-assist-context.php").write_text(CONTEXT_FILE, encoding="utf-8")

    descriptions = {
        "Registry": "tool registry and default tool registration",
        "Sessions": "filesystem session storage REST handlers",
        "Cards": "semantic card builders for REST responses",
        "Ai": "OpenRouter calls and JSON parsing",
        "Tools_Wp": "WordPress content tool handlers",
        "Tools_Seo": "SEO block Agent Hub tool handlers",
        "Content": "content outline, harness generation, batch section writes",
        "Workflow_Builder": "workflow step list construction from decomposed plans",
        "Workflow": "multi-step workflow engine and transients",
        "Pipeline_Classify": "intent classification and workflow decomposition",
        "Pipeline_Content_Prep": "tool param preparation and post body generation",
        "Pipeline_Phases": "plan, execute, reason, and format AI phases",
        "Pipeline": "orchestrates single-shot and plan-mode pipelines",
        "Rest": "REST route registration and entrypoints",
    }

    for class_name, method_names in METHOD_GROUPS.items():
        short = class_name.replace("Flowbie_Wp_Backend_Assist_", "")
        parts = []
        for name in method_names:
            if name not in methods:
                raise SystemExit(f"Missing method: {name}")
            body = methods[name]
            # Make public for cross-module access
            body = re.sub(
                r"^\t(private|protected)\s+static",
                "\tpublic static",
                body,
                count=1,
                flags=re.MULTILINE,
            )
            body = transform_method_body(body, class_name)
            # Fix register_routes callbacks to facade
            if name == "register_routes":
                body = body.replace(
                    "array( __CLASS__, 'rest_handle' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'rest_handle' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'rest_step_handle' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'rest_step_handle' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'rest_workflow_status' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'rest_workflow_status' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'rest_sessions_list' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'rest_sessions_list' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'rest_sessions_save' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'rest_sessions_save' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'rest_sessions_clear' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'rest_sessions_clear' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'rest_session_get' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'rest_session_get' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'rest_session_delete' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'rest_session_delete' )",
                )
            # Registry register_default_tools uses __CLASS__ for handlers
            if class_name == "Flowbie_Wp_Backend_Assist_Registry":
                body = body.replace(
                    "array( __CLASS__, 'tool_get_gsc_context' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'tool_get_gsc_context' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'tool_modify_seo_block_slots' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'tool_modify_seo_block_slots' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'tool_list_seo_blocks' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'tool_list_seo_blocks' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'tool_create_seo_block' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'tool_create_seo_block' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'tool_delete_seo_block' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'tool_delete_seo_block' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'tool_save_seo_block' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'tool_save_seo_block' )",
                )
                body = body.replace(
                    "array( __CLASS__, 'tool_apply_seo_block_to_page' )",
                    "array( 'Flowbie_Wp_Backend_Assist', 'tool_apply_seo_block_to_page' )",
                )
            parts.append(body)
        desc = descriptions.get(short, short)
        content = file_header(class_name, desc) + "\n".join(parts) + "\n}\n"
        fname = f"class-flowbie-wp-backend-assist-{slug(class_name)}.php"
        (OUT / fname).write_text(content, encoding="utf-8")
        lines = content.count("\n") + 1
        print(f"{fname}: {lines} lines")

    print("Parsed", len(methods), "methods")


if __name__ == "__main__":
    main()
