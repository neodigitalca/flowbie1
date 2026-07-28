(function () {
	'use strict';

	var S = function () { return window.FlowbieAiShared; };
	var D = function () { return window.FlowbieAiDom; };
	var Snip = function () { return window.FlowbieAiSnippet; };

	function permalinkParentPrefixFromPageUrl(fullUrl) {
		try {
			var u = new URL(String(fullUrl).trim());
			var path = u.pathname.replace(/\/+/g, '/');
			if (!path.endsWith('/')) path += '/';
			var segments = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
			if (segments.length <= 1) return '';
			return segments.slice(0, -1).join('/') + '/';
		} catch (e) {
			return '';
		}
	}

	function buildPreviewUrl(ctrl, slug) {
		var status = ctrl.status || {};
		var base = (S().cfg().siteUrl || '').replace(/\/$/, '');
		if (!base && window.location && window.location.origin) {
			base = window.location.origin.replace(/\/$/, '');
		}
		var prefix = permalinkParentPrefixFromPageUrl(status.permalink || Snip().getSnippetUrl(ctrl));
		var clean = String(slug || '').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
		if (!clean) return base + (prefix ? '/' + prefix : '/');
		return base + '/' + prefix + clean + '/';
	}

	function slugFromPermalinkUrl(url) {
		try {
			var parts = new URL(String(url).trim()).pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
			return parts.length ? parts[parts.length - 1] : '';
		} catch (e) {
			return '';
		}
	}

	function sanitizeSlugInput(raw) {
		var s = String(raw || '')
			.trim()
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9\-_/]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '');
		if (s.indexOf('/') !== -1) {
			var parts = s.split('/').filter(Boolean);
			s = parts.length ? parts[parts.length - 1] : s;
		}
		return s;
	}

	function syncEditorSlug(slug) {
		if (!window.wp || !wp.data || !wp.data.dispatch) return;
		try {
			wp.data.dispatch('core/editor').editPost({ slug: slug });
		} catch (e) { /* ignore */ }
	}

	function renderPanel(ctrl) {
		var el = D().el;
		var str = S().str;
		var status = ctrl.status || {};
		if (!status.isPublished) return null;

		var liveUrl = Snip().getSnippetUrl(ctrl);
		var baselineSlug = status.slug || slugFromPermalinkUrl(liveUrl) || '';
		var editorSlug = Snip().getPostSlugForPreview();
		var initialSlug = ctrl._urlToolSlugDraft !== undefined && ctrl._urlToolSlugDraft !== null
			? ctrl._urlToolSlugDraft
			: (editorSlug || baselineSlug);
		var panel = el('div', 'fbm-url-tool');
		panel.appendChild(el('h4', 'fbm-url-tool__title', str('changeUrlTitle', 'Change URL')));

		var currentRow = el('div', 'fbm-url-tool__row');
		currentRow.appendChild(el('span', 'fbm-url-tool__label', str('currentUrl', 'Current URL')));
		var currentVal = el('div', 'fbm-url-tool__readonly', liveUrl);
		currentRow.appendChild(currentVal);
		panel.appendChild(currentRow);

		var slugRow = el('div', 'fbm-url-tool__row');
		slugRow.appendChild(el('label', 'fbm-url-tool__label', str('newSlug', 'New slug')));
		var slugInput = el('input', 'fbm-url-tool__input');
		slugInput.type = 'text';
		slugInput.value = initialSlug;
		slugInput.setAttribute('autocomplete', 'off');
		slugRow.appendChild(slugInput);
		panel.appendChild(slugRow);

		var previewRow = el('div', 'fbm-url-tool__row fbm-url-tool__row--preview');
		previewRow.appendChild(el('span', 'fbm-url-tool__label', str('urlPreview', 'Preview')));
		var previewEl = el('div', 'fbm-url-tool__preview', buildPreviewUrl(ctrl, sanitizeSlugInput(initialSlug) || baselineSlug));
		previewRow.appendChild(previewEl);
		panel.appendChild(previewRow);

		var unchangedHint = el('p', 'fbm-url-tool__hint fbm-url-tool__hint--unchanged', str(
			'changeUrlUnchangedHint',
			'Change the slug below — it must be different from the live URL to enable Update URL.'
		));
		unchangedHint.style.display = 'none';
		panel.appendChild(unchangedHint);

		if (!status.canManageRedirects) {
			panel.appendChild(el('p', 'fbm-url-tool__hint', str('redirectNoPermission', 'Only administrators can add 301 redirects in Flowbie. Your slug will still update.')));
		}

		var errEl = el('p', 'fbm-url-tool__error', '');
		errEl.style.display = 'none';
		panel.appendChild(errEl);

		var actions = el('div', 'fbm-url-tool__actions');
		var updateBtn = el('button', 'button button-small button-secondary fbm-url-tool__btn', str('updateUrl', 'Update URL'));
		updateBtn.type = 'button';
		actions.appendChild(updateBtn);
		panel.appendChild(actions);

		function setError(msg) {
			if (!msg) {
				errEl.textContent = '';
				errEl.style.display = 'none';
				return;
			}
			errEl.textContent = msg;
			errEl.style.display = '';
		}

		function updatePreview() {
			var next = sanitizeSlugInput(slugInput.value);
			previewEl.textContent = buildPreviewUrl(ctrl, next || baselineSlug);
			var unchanged = !next || next === baselineSlug;
			updateBtn.disabled = unchanged;
			unchangedHint.style.display = unchanged ? '' : 'none';
		}

		slugInput.addEventListener('input', function () {
			ctrl._urlToolSlugDraft = slugInput.value;
			updatePreview();
		});
		updatePreview();

		updateBtn.addEventListener('click', function () {
			var nextSlug = sanitizeSlugInput(slugInput.value);
			if (!nextSlug || nextSlug === baselineSlug) return;

			var oldUrl = Snip().getSnippetUrl(ctrl);
			var newUrl = buildPreviewUrl(ctrl, nextSlug);
			var createRedirect = false;

			if (status.canManageRedirects) {
				var confirmMsg = str(
					'redirectConfirm',
					'Add a 301 redirect in Flowbie from the old URL to the new URL?\n\nFrom: %1$s\nTo: %2$s\n\nClick OK to add the redirect, or Cancel to update the URL only.'
				)
					.replace('%1$s', oldUrl)
					.replace('%2$s', newUrl);
				createRedirect = window.confirm(confirmMsg);
			}

			setError('');
			updateBtn.disabled = true;
			updateBtn.textContent = str('updatingUrl', 'Updating…');

			S().api('/flowbie/v1/ai/change-url', {
				method: 'POST',
				body: JSON.stringify({
					post_id: ctrl.postId,
					slug: nextSlug,
					create_redirect: createRedirect,
				}),
			}).then(function (body) {
				if (body.permalink) {
					ctrl.status.permalink = body.permalink;
				}
				if (body.slug) {
					ctrl.status.slug = body.slug;
					baselineSlug = body.slug;
					slugInput.value = body.slug;
					ctrl._urlToolSlugDraft = body.slug;
				}
				syncEditorSlug(body.slug || nextSlug);
				return ctrl.fetchStatus().then(function () {
					Snip().updateAllSnippets(ctrl);
					var msg = str('urlUpdated', 'URL updated.');
					if (body.redirectCreated) {
						msg = str('redirectAdded', 'URL updated and 301 redirect added in Flowbie.');
					} else if (createRedirect === false && status.canManageRedirects) {
						msg = str('redirectSkipped', 'URL updated. No redirect was added.');
					}
					ctrl.toastMessage = msg;
					if (window.FlowbieBodyModal && window.FlowbieBodyModal.refresh) {
						window.FlowbieBodyModal.refresh(ctrl);
					}
					if (ctrl.refreshUI) ctrl.refreshUI();
				});
			}).catch(function (err) {
				setError(err.message || str('changeUrlFailed', 'URL update failed.'));
			}).finally(function () {
				updateBtn.textContent = str('updateUrl', 'Update URL');
				updatePreview();
			});
		});

		return panel;
	}

	window.FlowbieAiUrlTool = {
		renderPanel: renderPanel,
		buildPreviewUrl: buildPreviewUrl,
		permalinkParentPrefixFromPageUrl: permalinkParentPrefixFromPageUrl,
	};
})();
