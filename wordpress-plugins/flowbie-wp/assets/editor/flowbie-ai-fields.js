(function () {
	'use strict';

	var FIELD_MAP = [
		{ field: 'title', selectors: ['#title'] },
		{ field: 'excerpt', selectors: ['#excerpt'] },
		{ field: 'focus_keyword', selectors: ['[data-name="keyword_focus"] .acf-input', '[data-name="keyword_focus"]'] },
		{ field: 'seo_research', selectors: ['[data-name="seo_research"] .acf-input', '[data-name="seo_research"]'] },
		{ field: 'faq', selectors: ['[data-name="faq"] .acf-input', '[data-name="seo_faq"] .acf-input', '[data-name="faq"]', '[data-name="seo_faq"]'] },
		{ field: 'page_url', selectors: ['[data-name="page_url"] .acf-input', '[data-name="page_url"]'] },
	];

	var controller = null;

	function ensureController() {
		if (controller) {
			return controller;
		}
		if (!window.FlowbieAiController) {
			return null;
		}
		var host = document.createElement('div');
		host.style.display = 'none';
		document.body.appendChild(host);
		controller = new window.FlowbieAiController(host, { postId: window.flowbieWpAi && flowbieWpAi.postId });
		return controller;
	}

	function createWand(field) {
		var label = (window.flowbieWpAi && flowbieWpAi.strings && flowbieWpAi.strings.wandTitle) || 'Enhance with Flowbie AI';
		var btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'flowbie-wp-ai-field-wand flowbie-wp-ai-spark-btn';
		btn.title = label;
		btn.setAttribute('aria-label', label + ' (' + field + ')');
		if (window.flowbieWpAiSparkIcon) {
			btn.appendChild(window.flowbieWpAiSparkIcon(16));
		} else {
			btn.innerHTML = '<span aria-hidden="true">✦</span>';
		}
		btn.addEventListener('click', function (e) {
			e.preventDefault();
			var ctrl = ensureController();
			if (!ctrl) return;
			ctrl.fetchStatus().then(function () {
				ctrl.openFieldPreview(field);
			});
		});
		return btn;
	}

	function injectWand(container, field) {
		if (!container || container.querySelector('.flowbie-wp-ai-field-wand')) {
			return;
		}
		if (container.parentElement && container.parentElement.classList.contains('flowbie-wp-ai-field-row')) {
			return;
		}
		var control = container.querySelector('input, textarea, select');
		if (!control || control.closest('.flowbie-wp-ai-field-row')) {
			return;
		}
		var wrap = document.createElement('div');
		wrap.className = 'flowbie-wp-ai-field-wand-wrap';
		wrap.appendChild(createWand(field));
		var row = document.createElement('div');
		row.className = 'flowbie-wp-ai-field-row';
		control.parentNode.insertBefore(row, control);
		row.appendChild(control);
		row.appendChild(wrap);
	}

	function scan() {
		FIELD_MAP.forEach(function (item) {
			item.selectors.forEach(function (selector) {
				document.querySelectorAll(selector).forEach(function (node) {
					injectWand(node, item.field);
				});
			});
		});
	}

	document.addEventListener('DOMContentLoaded', function () {
		scan();
		if (window.acf && typeof window.acf.addAction === 'function') {
			window.acf.addAction('ready', scan);
			window.acf.addAction('append', scan);
		}
		var observer = new MutationObserver(function () {
			scan();
		});
		var app = document.getElementById('wpbody') || document.body;
		if (app) {
			observer.observe(app, { childList: true, subtree: true });
		}
	});
})();
