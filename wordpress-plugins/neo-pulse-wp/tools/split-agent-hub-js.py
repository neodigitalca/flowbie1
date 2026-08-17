#!/usr/bin/env python3
"""Split admin-agent-hub.js into feature modules with FlowbieAgentHubRuntime."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/admin/admin-agent-hub.js"
OUT = ROOT / "assets/admin/agent-hub"

SPLITS = [
    ("admin-agent-hub-layout-model.js", "Agent Hub — layout grid model (sections, slots, placement).", 113, 420),
    ("admin-agent-hub-settings.js", "Agent Hub — settings, primary page, payload.", 422, 884),
    ("admin-agent-hub-slot-editor.js", "Agent Hub — slot editor, WYSIWYG, layout chips.", 885, 1291),
    ("admin-agent-hub-layout-ui.js", "Agent Hub — layout canvas UI, preview, responsive.", 1292, 1572),
    ("admin-agent-hub-blocks-api.js", "Agent Hub — REST blocks CRUD, optimize, bulk.", 1573, 1781),
    ("admin-agent-hub-agent-tab.js", "Agent Hub — Agent tab, backend assist workflow.", 1783, 2291),
    ("admin-agent-hub-events.js", "Agent Hub — delegated slot editor events.", 2189, 2272),
    ("admin-agent-hub-boot.js", "Agent Hub — list/edit bootstrapping.", 2293, 2518),
]

SKIP_LINES = {4, 5, 6, 7, 8, 30, 31, 32, 33, 34, 35, 36, 37}  # cfg init, builder var, agent vars


def extract_functions(body: str) -> list[str]:
    names = re.findall(r"^\tfunction (\w+)\(", body, re.MULTILINE)
    names += re.findall(r"^\tapi\.(\w+) = function\(", body, re.MULTILINE)
    return sorted(set(names), key=len, reverse=True)


def transform_body(lines: list[str], all_fn_names: list[str]) -> str:
    filtered = []
    for i, line in enumerate(lines, start=1):
        if i in SKIP_LINES:
            continue
        if i == 1784 or i == 1785:  # agentHistory, agentLoading
            continue
        if i >= 1787 and i <= 1859:  # postJson, getJson - replaced in core
            if re.match(r"^\tfunction (postJson|getJson)\(", line):
                continue
        filtered.append(line)

    body = "".join(filtered)

    # function declarations -> api assignments
    body = re.sub(r"^\tfunction (\w+)\(", r"\tapi.\1 = function(", body, flags=re.MULTILINE)

    replacements = [
        (r"\bagentHistory\b", "R.agent.history"),
        (r"\bagentLoading\b", "R.agent.loading"),
        (r"\bpageSearchTimer\b", "R.timers.pageSearchTimer"),
        (r"\bprimaryPostSaveInFlight\b", "R.flags.primaryPostSaveInFlight"),
        (r"\bslotEditorFinalizeTimer\b", "R.timers.slotEditorFinalizeTimer"),
        (r"\bslotEditorResizeTimer\b", "R.timers.slotEditorResizeTimer"),
        (r"\bslotEditorEventsBound\b", "R.flags.slotEditorEventsBound"),
        (r"\b\$modal\b", "R.dom.$modal"),
        (r"\b\$slotModal\b", "R.dom.$slotModal"),
        (r"\b\$layoutView\b", "R.dom.$layoutView"),
        (r"\b\$blockEditorView\b", "R.dom.$blockEditorView"),
        (r"\b\$form\b", "R.dom.$form"),
        (r"(?<![\w-])busy(?![\w-])", "R.busy"),
        (r"(?<![\w.-])builder(?![\w-])", "R.builder"),
        (r"\bisEditPage\b", "R.cfg.screen === 'edit'"),
        (r"\bisListPage\b", "R.cfg.screen === 'list'"),
        (r"\blistUrl\b", "R.cfg.listUrl"),
        (r"\beditUrl\b", "R.cfg.editUrl"),
        (r"\bGRID_MAX\b", "R.gridMax"),
        (r"(?<![\w.])cfg\.", "R.cfg."),
        (r"(?<![\w.])cfg\b", "R.cfg"),
        (r"\brest\(", "api.rest("),
        (r"\bpostJson\(", "api.postJson("),
        (r"\bgetJson\(", "api.getJson("),
    ]
    for pat, repl in replacements:
        body = re.sub(pat, repl, body)

    body = body.replace("R.R.cfg", "R.cfg")
    body = body.replace("R.R.builder", "R.builder")
    body = body.replace("flowbie-R.builder", "flowbie-builder")

    # Prefix bare function calls with api. (global name list, longest first)
    skip_names = {"function"}
    for name in all_fn_names:
        if name in skip_names:
            continue
        body = re.sub(rf"(?<!api\.)(?<!\.){re.escape(name)}\(", f"api.{name}(", body)

    # Fix double api.api.
    body = body.replace("api.api.", "api.")

    return body


def wrap_module(header: str, body: str) -> str:
    return (
        "/**\n * " + header + "\n */\n"
        "(function ($) {\n"
        "\t'use strict';\n\n"
        "\tvar R = window.FlowbieAgentHubRuntime;\n"
        "\tvar api = R.api;\n\n"
        + body
        + "\n})(jQuery);\n"
    )


CORE = r'''/**
 * Agent Hub — runtime, config, HTTP, toasts, navigation.
 */
(function ($) {
	'use strict';

	window.FlowbieAgentHubRuntime = {
		cfg: null,
		gridMax: 24,
		busy: false,
		builder: {
			slots: [],
			layout_config: null,
			previewTimer: null,
			selectedLayoutCell: null,
			primaryPageContext: null,
			activeSlotId: null
		},
		dom: {},
		agent: { history: [], loading: false },
		timers: {},
		flags: {},
		api: {}
	};

	var R = window.FlowbieAgentHubRuntime;
	var api = R.api;

	api.initConfig = function () {
		var cfg = window.FlowbieAgentHub;
		if (!cfg || !cfg.restRoot || !cfg.nonce || !cfg.i18n) {
			console.error('Flowbie Agent Hub: missing FlowbieAgentHub config');
			return null;
		}
		if (cfg.screen !== 'list' && cfg.screen !== 'edit') {
			console.error('Flowbie Agent Hub: invalid screen', cfg.screen);
			return null;
		}
		if (!cfg.listUrl || !cfg.editUrl) {
			console.error('Flowbie Agent Hub: missing listUrl or editUrl');
			return null;
		}
		R.cfg = cfg;
		R.gridMax = parseInt(cfg.gridMax, 10);
		if (isNaN(R.gridMax) || R.gridMax < 1) {
			R.gridMax = 24;
		}
		return R.cfg;
	};

	api.http = function (pathOrUrl, options) {
		options = options || {};
		var url = pathOrUrl;
		if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
			url = R.cfg.restRoot + pathOrUrl;
		}
		return fetch(url, {
			method: options.method || 'GET',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': R.cfg.nonce },
			credentials: 'same-origin',
			body: options.body ? JSON.stringify(options.body) : undefined
		}).then(function (res) {
			return res.json().then(function (data) {
				return { ok: res.ok, status: res.status, data: data };
			});
		}).catch(function () {
			return { ok: false, status: 0, data: { message: R.cfg.i18n.error } };
		});
	};

	api.rest = function (path, options) {
		return api.http(path, options).then(function (r) {
			if (r.ok) {
				return r.data;
			}
			var msg = (r.data && r.data.message) ? r.data.message : R.cfg.i18n.error;
			return Promise.reject({ message: msg });
		});
	};

	api.postJson = function (url, payload) {
		return api.http(url, { method: 'POST', body: payload });
	};

	api.getJson = function (url) {
		return api.http(url, { method: 'GET' });
	};

	api.editPageUrl = function (blockId) {
		var join = R.cfg.editUrl.indexOf('?') >= 0 ? '&' : '?';
		return R.cfg.editUrl + join + 'block_id=' + encodeURIComponent(String(blockId));
	};

	api.goToListPage = function () {
		window.location.href = R.cfg.listUrl;
	};

	api.goToEditPage = function (blockId) {
		window.location.href = api.editPageUrl(blockId);
	};

	api.esc = function (str) {
		return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
	};

	api.getToastRoot = function () {
		var root = document.getElementById('flowbie-agent-hub-toasts');
		if (!root) {
			root = document.createElement('div');
			root.id = 'flowbie-agent-hub-toasts';
			root.className = 'flowbie-agent-hub-toasts';
			root.setAttribute('aria-live', 'polite');
			root.setAttribute('aria-atomic', 'true');
			document.body.appendChild(root);
		}
		return root;
	};

	api.showToast = function (message, type, options) {
		options = options || {};
		type = type || 'info';
		message = String(message || '').trim();
		if (!message) {
			return null;
		}
		var root = api.getToastRoot();
		var el = document.createElement('div');
		el.className = 'flowbie-agent-hub-toast flowbie-agent-hub-toast--' + type;
		el.textContent = message;
		root.appendChild(el);
		requestAnimationFrame(function () { el.classList.add('is-visible'); });
		var duration = options.duration != null ? options.duration : (type === 'error' ? 6000 : 3500);
		setTimeout(function () {
			el.classList.remove('is-visible');
			setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
		}, duration);
		return el;
	};

	api.notifyError = function (errOrMsg) {
		var msg = errOrMsg && errOrMsg.message ? errOrMsg.message : String(errOrMsg || R.cfg.i18n.error);
		api.showToast(msg, 'error');
	};

	api.toastThenReload = function (message, type) {
		api.showToast(message, type || 'success', { duration: 1400 });
		setTimeout(function () { window.location.reload(); }, 1100);
	};

	api.genId = function () {
		return Math.random().toString(36).slice(2, 9);
	};

	api.clampGridDim = function (n) {
		n = parseInt(n, 10);
		if (isNaN(n) || n < 1) return 1;
		if (n > R.gridMax) return R.gridMax;
		return n;
	};

	api.setHubPageBusy = function (on) {
		var hub = document.getElementById('flowbie-agent-hub');
		if (!hub) return;
		hub.classList.toggle('is-busy', !!on);
		hub.setAttribute('aria-busy', on ? 'true' : 'false');
		if (on) {
			hub.setAttribute('data-busy-label', R.cfg.i18n.optimizing || 'Optimizing block…');
		} else {
			hub.removeAttribute('data-busy-label');
		}
	};

	api.blockIdFromEl = function ($el) {
		return parseInt($el.attr('data-block-id') || $el.data('blockId') || '0', 10) || 0;
	};
})(jQuery);
'''


def main():
    lines = SRC.read_text(encoding="utf-8").splitlines(keepends=True)
    monolith_body = "".join(lines[10:2531])
    all_fn_names = sorted(
        set(re.findall(r"^\tfunction (\w+)\(", monolith_body, re.MULTILINE)),
        key=len,
        reverse=True,
    )

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "admin-agent-hub-core.js").write_text(CORE, encoding="utf-8")

    for filename, header, start, end in SPLITS:
        chunk_lines = lines[start - 1 : end]
        body = transform_body(chunk_lines, all_fn_names)
        if filename == "admin-agent-hub-blocks-api.js":
            body += "\n\twindow.FlowbieAgentHubUI = {\n"
            body += "\t\topenEdit: api.loadBlock,\n"
            body += "\t\topenOptimize: api.optimizeBlockById,\n"
            body += "\t\topenDelete: api.deleteBlock,\n"
            body += "\t\topenDuplicate: api.duplicateBlock\n"
            body += "\t};\n"
        if filename == "admin-agent-hub-boot.js":
            body += (
                "\n\tapi.boot = function () {\n"
                "\t\tif (!api.initConfig()) {\n"
                "\t\t\treturn;\n"
                "\t\t}\n"
                "\t\tif (R.cfg.screen === 'edit') {\n"
                "\t\t\tapi.bootEditPage();\n"
                "\t\t\treturn;\n"
                "\t\t}\n"
                "\t\tif (R.cfg.screen === 'list') {\n"
                "\t\t\tapi.bootListPage();\n"
                "\t\t}\n"
                "\t};\n\n"
                "\tif (document.readyState === 'loading') {\n"
                "\t\tdocument.addEventListener('DOMContentLoaded', api.boot);\n"
                "\t} else {\n"
                "\t\tapi.boot();\n"
                "\t}\n"
            )
        out_path = OUT / filename
        out_path.write_text(wrap_module(header, body), encoding="utf-8")
        print(f"Wrote {filename}: {len(out_path.read_text(encoding='utf-8').splitlines())} lines")

    print("Done.")


if __name__ == "__main__":
    main()
