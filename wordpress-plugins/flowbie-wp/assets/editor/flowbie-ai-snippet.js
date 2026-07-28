(function () {
	'use strict';

	var S = function () { return window.FlowbieAiShared; };
	var D = function () { return window.FlowbieAiDom; };

	function getPostTitleForPreview() {
		if (window.wp && wp.data && wp.data.select) {
			try {
				var t = wp.data.select('core/editor').getEditedPostAttribute('title');
				if (t) return String(t);
			} catch (e) { /* ignore */ }
		}
		var node = document.getElementById('title');
		return node && node.value ? String(node.value) : '';
	}

	function getPostSlugForPreview() {
		if (window.wp && wp.data && wp.data.select) {
			try {
				var slug = wp.data.select('core/editor').getEditedPostAttribute('slug');
				if (slug) return String(slug);
			} catch (e) { /* ignore */ }
		}
		return '';
	}

	function getSiteUrlHint() {
		var base = (S().cfg().siteUrl || '').replace(/\/$/, '');
		if (!base && window.location && window.location.origin) {
			base = window.location.origin.replace(/\/$/, '');
		}
		var slug = getPostSlugForPreview();
		return base + (slug ? '/' + slug.replace(/^\/+/, '') + '/' : '/');
	}

	function getSnippetUrl(ctrl) {
		var status = ctrl.status || {};
		if (status.permalink) {
			return status.permalink;
		}
		return getSiteUrlHint();
	}

	function getTitleText(ctrl) {
		return ctrl.draft.seoTitle || getPostTitleForPreview() || S().str('previewTitlePlaceholder', 'Post title');
	}

	function getDescText(ctrl) {
		return ctrl.draft.metaDescription || S().str('previewDescPlaceholder', 'Meta description will appear here.');
	}

	function getSnippetHosts(ctrl) {
		var hosts = [];
		if (ctrl.launcherEl) hosts.push(ctrl.launcherEl);
		if (ctrl.metaEditorEl) hosts.push(ctrl.metaEditorEl);
		return hosts;
	}

	function renderSnippetCard(ctrl, options) {
		var el = D().el;
		var truncate = D().truncate;
		var opts = options || {};
		var compact = !!opts.compact;
		var hero = !!opts.hero;

		var wrap = el('div', 'flowbie-wp-ai-snippet' + (compact ? ' flowbie-wp-ai-snippet--compact' : '') + (hero ? ' flowbie-wp-ai-snippet--hero' : ''));
		if (opts.showHeading !== false) {
			wrap.appendChild(el('h4', 'flowbie-wp-ai-snippet__heading', S().str('previewLabel', 'Preview')));
		}

		var boxClass = 'flowbie-wp-ai-snippet__box' + (hero ? ' flowbie-wp-ai-snippet__box--hero' : '');
		var box = el('div', boxClass);
		box.appendChild(el('div', 'flowbie-wp-ai-snippet__url', getSnippetUrl(ctrl)));

		var titleText = getTitleText(ctrl);
		var descText = getDescText(ctrl);
		var titleClass = 'flowbie-wp-ai-snippet__title' + (compact ? ' flowbie-wp-ai-snippet__title--compact' : '');
		var descClass = 'flowbie-wp-ai-snippet__desc' + (compact ? ' flowbie-wp-ai-snippet__desc--compact' : '');

		box.appendChild(el('div', titleClass, compact ? truncate(titleText, 72) : titleText));
		box.appendChild(el('div', descClass, compact ? truncate(descText, 120) : descText));
		wrap.appendChild(box);
		return wrap;
	}

	function updateAllSnippets(ctrl) {
		var truncate = D().truncate;
		var titleText = getTitleText(ctrl);
		var descText = getDescText(ctrl);
		getSnippetHosts(ctrl).forEach(function (host) {
			var urlEl = host.querySelector('.flowbie-wp-ai-snippet__url');
			var titleEl = host.querySelector('.flowbie-wp-ai-snippet__title');
			var descEl = host.querySelector('.flowbie-wp-ai-snippet__desc');
			if (urlEl) urlEl.textContent = getSnippetUrl(ctrl);
			if (titleEl) {
				titleEl.textContent = titleEl.classList.contains('flowbie-wp-ai-snippet__title--compact')
					? truncate(titleText, 72) : titleText;
			}
			if (descEl) {
				descEl.textContent = descEl.classList.contains('flowbie-wp-ai-snippet__desc--compact')
					? truncate(descText, 120) : descText;
			}
		});
		updateFocusGlance(ctrl);
	}

	function updateFocusGlance(ctrl) {
		if (!ctrl.launcherEl) return;
		var pill = ctrl.launcherEl.querySelector('.flowbie-wp-ai-keyword-value');
		if (!pill) return;
		var kw = (ctrl.draft.focusKeyword || ctrl.saved.focusKeyword || '').trim();
		if (kw) {
			pill.textContent = D().truncate(kw, 80);
			pill.classList.remove('flowbie-wp-ai-keyword-value--empty');
		} else {
			pill.textContent = S().str('focusKeywordEmpty', 'Not set');
			pill.classList.add('flowbie-wp-ai-keyword-value--empty');
		}
	}

	function updateMetaInput(ctrl, key) {
		if (!ctrl.metaEditorEl) return;
		var input = ctrl.metaEditorEl.querySelector('[data-meta-key="' + key + '"]');
		if (input && input.value !== ctrl.draft[key]) {
			input.value = ctrl.draft[key];
		}
	}

	window.FlowbieAiSnippet = {
		getPostTitleForPreview: getPostTitleForPreview,
		getPostSlugForPreview: getPostSlugForPreview,
		getSnippetUrl: getSnippetUrl,
		getTitleText: getTitleText,
		getDescText: getDescText,
		renderSnippetCard: renderSnippetCard,
		updateAllSnippets: updateAllSnippets,
		updateFocusGlance: updateFocusGlance,
		updateMetaInput: updateMetaInput,
	};
})();
