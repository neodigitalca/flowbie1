/**
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
