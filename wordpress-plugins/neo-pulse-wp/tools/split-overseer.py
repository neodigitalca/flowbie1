#!/usr/bin/env python3
"""Split class-flowbie-wp-overseer.php into overseer/ core modules."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "tools/overseer-monolith-source.php"
if not SRC.is_file():
    SRC = ROOT / "includes/class-flowbie-wp-overseer.php"
OUT = ROOT / "includes/overseer"

METHOD_GROUPS = {
    "Flowbie_Wp_Overseer_Context": [
        "table_name",
        "reports_table_name",
        "tasks_table_name",
        "new_uuid",
        "is_valid_uuid",
        "is_valid_session_id",
        "new_session_id",
    ],
    "Flowbie_Wp_Overseer_Install": [
        "maybe_install",
        "install",
    ],
    "Flowbie_Wp_Overseer_Settings": [
        "get_settings",
        "save_settings",
        "is_tracking_active",
        "should_load_beacon_on_frontend",
    ],
    "Flowbie_Wp_Overseer_Beacon": [
        "get_builtin_script_id",
        "is_builtin_script_id",
        "is_builtin_protected",
        "beacon_js_url",
        "builtin_script_template",
        "resolve_script_placeholders",
        "beacon_config",
        "beacon_config_json",
        "is_stub_script_code",
        "needs_builtin_script_resync",
        "has_script_manager_beacon_template",
        "maybe_enqueue_beacon_fallback",
        "maybe_upgrade_script_template",
        "flush_optimization_cache",
        "ensure_builtin_script",
        "maybe_sync_builtin_script",
        "sync_builtin_script",
        "is_overseer_tag_row",
        "filter_script_code",
    ],
    "Flowbie_Wp_Overseer_Ingest": [
        "get_client_ip",
        "anonymize_ip",
        "detect_device",
        "record_event",
        "record_visit",
        "sanitize_client_meta",
    ],
    "Flowbie_Wp_Overseer_Query": [
        "query",
        "query_for_export",
        "count_visits",
        "get_session_timeline",
        "get_session_summary",
        "build_engagement_map_from_events",
        "get_engagement_by_visit_uids",
    ],
    "Flowbie_Wp_Overseer_Aggregates": [
        "aggregate_summary",
        "aggregate_by_page",
        "aggregate_paths",
        "fetch_events_for_analysis",
        "count_sessions_in_range",
        "normalize_path_url",
        "top_clicked_links",
    ],
    "Flowbie_Wp_Overseer_Maintenance": [
        "delete_visit",
        "delete_all_visits",
        "maybe_prune_retention",
        "prune_retention",
    ],
}

METHOD_TO_CLASS = {}
for cls, methods in METHOD_GROUPS.items():
    for m in methods:
        METHOD_TO_CLASS[m] = cls

CONTEXT_CONSTS = [
    "TABLE_VERSION",
    "REPORTS_VERSION",
    "TASKS_VERSION",
    "ALLOWED_EVENT_TYPES",
    "DB_VERSION_OPTION",
    "OPTION_KEY",
    "BUILTIN_SCRIPT_ID_OPTION",
    "BUILTIN_SCRIPT_NAME",
    "BUILTIN_SCRIPT_CATEGORY",
    "CONFIG_PLACEHOLDER",
    "JS_URL_PLACEHOLDER",
    "CONFIG_SCRIPT_ID",
    "SESSION_ID_PATTERN",
    "CRON_HOOK",
    "SCRIPT_TEMPLATE_VERSION",
    "SCRIPT_TEMPLATE_OPTION",
]


def parse_methods(source: str) -> dict[str, str]:
    m = re.search(r"class Flowbie_Wp_Overseer\s*\{", source)
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
        j += 1
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
    out = body
    for const in CONTEXT_CONSTS:
        out = re.sub(
            rf"\bself::{const}\b",
            f"Flowbie_Wp_Overseer_Context::{const}",
            out,
        )

    def repl_self_call(m):
        method = m.group(1)
        if method in CONTEXT_CONSTS:
            return m.group(0)
        target = METHOD_TO_CLASS.get(method, owner_class)
        if target == owner_class:
            return f"self::{method}("
        return f"{target}::{method}("

    out = re.sub(r"\bself::(\w+)\s*\(", repl_self_call, out)
    return out


def slug(class_name: str) -> str:
    return (
        class_name.replace("Flowbie_Wp_Overseer_", "")
        .lower()
        .replace("_", "-")
    )


def file_header(class_name: str, desc: str) -> str:
    return f"""<?php
/**
 * Overseer — {desc}
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class {class_name} {{

"""


CONTEXT_BODY = """
	const TABLE_VERSION            = '2.2';
	const REPORTS_VERSION          = '1.1';
	const TASKS_VERSION            = '1.0';

	/** @var array<int, string> */
	const ALLOWED_EVENT_TYPES = array(
		'pageview',
		'page_exit',
		'page_heartbeat',
		'click',
		'form_submit',
		'outbound_click',
		'conversion',
	);
	const DB_VERSION_OPTION        = 'flowbie_wp_overseer_db_version';
	const OPTION_KEY               = 'flowbie_wp_overseer_settings';
	const BUILTIN_SCRIPT_ID_OPTION = 'flowbie_wp_overseer_builtin_script_id';
	const BUILTIN_SCRIPT_NAME      = 'Flowbie Page View';
	const BUILTIN_SCRIPT_CATEGORY  = 'Flowbie Tags';
	const CONFIG_PLACEHOLDER       = '%%FLOWBIE_OVERSEER_CONFIG%%';
	const JS_URL_PLACEHOLDER       = '%%FLOWBIE_OVERSEER_JS_URL%%';
	const CONFIG_SCRIPT_ID         = 'flowbie-overseer-config';
	const SESSION_ID_PATTERN       = '/^ovsess_[0-9]+_[a-z0-9]{6,32}$/';
	const CRON_HOOK                = 'flowbie_wp_overseer_prune';
	const SCRIPT_TEMPLATE_VERSION  = '4';
	const SCRIPT_TEMPLATE_OPTION   = 'flowbie_wp_overseer_script_template_version';
"""


def main():
    source = SRC.read_text(encoding="utf-8")
    methods = parse_methods(source)
    OUT.mkdir(parents=True, exist_ok=True)

    descriptions = {
        "Context": "constants, table names, session and uuid helpers",
        "Install": "database install and schema upgrades",
        "Settings": "tracking settings storage",
        "Beacon": "builtin Script Manager beacon tag",
        "Ingest": "event ingest and client meta sanitization",
        "Query": "visit queries and session timelines",
        "Aggregates": "dashboard aggregates and analysis queries",
        "Maintenance": "visit deletes and retention prune",
    }

    assigned = set()
    for class_name, method_names in METHOD_GROUPS.items():
        short = class_name.replace("Flowbie_Wp_Overseer_", "")
        parts = []
        for name in method_names:
            if name not in methods:
                raise SystemExit(f"Missing method: {name}")
            assigned.add(name)
            body = methods[name]
            body = re.sub(
                r"^\t(private|protected)\s+static",
                "\tpublic static",
                body,
                count=1,
                flags=re.MULTILINE,
            )
            body = transform_method_body(body, class_name)
            parts.append(body)
        desc = descriptions.get(short, short)
        content = file_header(class_name, desc)
        if class_name == "Flowbie_Wp_Overseer_Context":
            content += CONTEXT_BODY + "\n"
        content += "\n".join(parts) + "\n}\n"
        fname = f"class-flowbie-wp-overseer-{slug(class_name)}.php"
        (OUT / fname).write_text(content, encoding="utf-8")
        lines = content.count("\n") + 1
        print(f"{fname}: {lines} lines")

    missing = set(methods) - assigned - {"init", "load_dependencies"}
    if missing:
        raise SystemExit(f"Unassigned methods: {sorted(missing)}")
    print("Parsed", len(methods), "methods")


if __name__ == "__main__":
    main()
