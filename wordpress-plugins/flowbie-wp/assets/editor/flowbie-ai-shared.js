(function () {
	'use strict';

	window.FlowbieAiShared = {
		CONTENT_FIELDS: ['seo_research', 'faq', 'page_url'],
		META_FIELDS: [
			{ key: 'seoTitle', apiField: 'title', labelKey: 'seoTitle', helpKey: 'titleHelp', type: 'text', limit: 60 },
			{ key: 'focusKeyword', apiField: 'focus_keyword', labelKey: 'focusKeyword', helpKey: 'focusKeywordHelp', type: 'text' },
			{ key: 'metaDescription', apiField: 'excerpt', labelKey: 'metaDescription', helpKey: 'descriptionHelp', type: 'textarea', limit: 160, limitMin: 150 },
		],
		META_DRAFT_KEYS: ['seoTitle', 'metaDescription', 'focusKeyword'],
		ALL_DRAFT_KEYS: ['seoTitle', 'metaDescription', 'focusKeyword', 'seoResearch', 'faq', 'pageUrl'],
		CONTENT_DRAFT_KEYS: {
			seo_research: 'seoResearch',
			faq: 'faq',
			page_url: 'pageUrl',
		},
		GENERATE_ALL_FIELDS: [
			{ apiField: 'title', key: 'seoTitle' },
			{ apiField: 'excerpt', key: 'metaDescription' },
			{ apiField: 'focus_keyword', key: 'focusKeyword' },
		],
		cfg: function () {
			return window.flowbieWpAi || {};
		},
		str: function (key, fallback) {
			var s = window.FlowbieAiShared.cfg().strings || {};
			return s[key] || fallback;
		},
		api: function (path, options) {
			var c = window.FlowbieAiShared.cfg();
			var url = (c.root || '').replace(/\/$/, '') + path;
			var headers = {
				'Content-Type': 'application/json',
				'X-WP-Nonce': c.nonce || '',
			};
			return fetch(url, Object.assign({ headers: headers, credentials: 'same-origin' }, options || {})).then(function (res) {
				return res.json().then(function (body) {
					if (!res.ok) {
						var err = new Error((body && body.error) || res.statusText || 'Request failed');
						err.body = body;
						throw err;
					}
					return body;
				});
			});
		},
		isMetaDirty: function (ctrl) {
			return window.FlowbieAiShared.META_DRAFT_KEYS.some(function (key) {
				return ctrl.draft[key] !== ctrl.saved[key];
			});
		},
		isAnyDirty: function (ctrl) {
			return window.FlowbieAiShared.ALL_DRAFT_KEYS.some(function (key) {
				return ctrl.draft[key] !== ctrl.saved[key];
			});
		},
		isFieldDirty: function (ctrl, key) {
			return ctrl.draft[key] !== ctrl.saved[key];
		},
		syncDraftFromValues: function (ctrl, values) {
			if (!values) return;
			var S = window.FlowbieAiShared;
			S.META_DRAFT_KEYS.forEach(function (key) {
				if (values[key] !== undefined) {
					ctrl.draft[key] = values[key] || '';
					ctrl.saved[key] = values[key] || '';
				}
			});
			Object.keys(S.CONTENT_DRAFT_KEYS).forEach(function (apiField) {
				var key = S.CONTENT_DRAFT_KEYS[apiField];
				if (values[key] !== undefined) {
					ctrl.draft[key] = values[key] || '';
					ctrl.saved[key] = values[key] || '';
				}
			});
		},
		syncDomField: function (field, value) {
			var map = {
				title: '#title',
				excerpt: '#excerpt',
				focus_keyword: '[data-name="keyword_focus"] textarea, [data-name="keyword_focus"] input',
				seo_research: '[data-name="seo_research"] textarea',
				faq: '[data-name="faq"] textarea, [data-name="seo_faq"] textarea',
				page_url: '[data-name="page_url"] input, [data-name="page_url"] textarea',
			};
			var sel = map[field];
			if (!sel) return;
			document.querySelectorAll(sel).forEach(function (node) {
				node.value = value;
				node.dispatchEvent(new Event('input', { bubbles: true }));
				node.dispatchEvent(new Event('change', { bubbles: true }));
			});
		},
		syncEditorMeta: function (field, value) {
			if (!window.wp || !wp.data || !wp.data.dispatch) return;
			try {
				if (field === 'title') {
					wp.data.dispatch('core/editor').editPost({ title: value });
				} else if (field === 'excerpt') {
					wp.data.dispatch('core/editor').editPost({ excerpt: value });
				}
			} catch (e) { /* ignore */ }
		},
		clampSeoPreview: function (apiField, value) {
			var limits = { title: 60, excerpt: 160 };
			var max = limits[apiField];
			if (!max) return String(value || '');
			var s = String(value || '').replace(/\s+/g, ' ').trim();
			if (s.length <= max) return s;
			var cut = s.slice(0, max);
			var lastSpace = cut.lastIndexOf(' ');
			if (lastSpace >= max * 0.5) cut = cut.slice(0, lastSpace);
			return cut.replace(/[ .,;:!?]+$/, '');
		},
		fieldLimitSpec: function (field) {
			if (!field || !field.limit) return null;
			return {
				min: field.limitMin || 0,
				max: field.limit,
			};
		},
		formatCounterLabel: function (count, field) {
			if (!field || !field.limit) return String(count);
			if (field.limitMin) return count + '/' + field.limitMin + '-' + field.limit;
			return count + '/' + field.limit;
		},
		fetchGscSuggestions: function (ctrl, force) {
			if (!ctrl || !ctrl.status || !ctrl.status.gscAvailable) {
				return Promise.resolve(null);
			}
			if (ctrl.gscLoading) {
				return ctrl._gscFetchPromise || Promise.resolve(null);
			}
			if (!force && ctrl.gscSuggestions !== undefined) {
				return Promise.resolve(ctrl.gscSuggestions);
			}
			var focus = (ctrl.draft.focusKeyword || ctrl.saved.focusKeyword || '').trim();
			var url = '/flowbie/v1/ai/gsc-suggestions?post_id=' + encodeURIComponent(String(ctrl.postId));
			if (focus) {
				url += '&focus_keyword=' + encodeURIComponent(focus);
			}
			ctrl.gscLoading = true;
			ctrl._gscFetchPromise = window.FlowbieAiShared.api(url, { method: 'GET' })
				.then(function (body) {
					ctrl.gscSuggestions = body || { suggestions: [] };
					ctrl.gscLoading = false;
					ctrl._gscFetchPromise = null;
					return ctrl.gscSuggestions;
				})
				.catch(function (err) {
					ctrl.gscLoading = false;
					ctrl._gscFetchPromise = null;
					ctrl.gscSuggestions = { suggestions: [], message: err.message || 'GSC unavailable.' };
					return ctrl.gscSuggestions;
				});
			return ctrl._gscFetchPromise;
		},
		applyGscSuggestion: function (ctrl, query) {
			if (!ctrl || !query) return;
			ctrl.draft.focusKeyword = String(query).trim();
			ctrl.gscSuggestions = undefined;
			if (window.FlowbieAiSnippet) {
				window.FlowbieAiSnippet.updateAllSnippets(ctrl);
			}
			document.querySelectorAll('[data-meta-key="focusKeyword"]').forEach(function (node) {
				node.value = ctrl.draft.focusKeyword;
				node.dispatchEvent(new Event('input', { bubbles: true }));
			});
			if (ctrl.refreshUI) {
				ctrl.refreshUI();
			}
			window.FlowbieAiShared.fetchGscSuggestions(ctrl, true);
		},
		renderGscChips: function (ctrl, parent, maxChips) {
			if (!parent || !ctrl || !ctrl.status || !ctrl.status.gscAvailable) return;
			var D = window.FlowbieAiDom;
			var str = window.FlowbieAiShared.str;
			var limit = maxChips || 5;
			var wrap = D.el('div', 'flowbie-wp-ai-gsc-chips');
			wrap.setAttribute('aria-live', 'polite');

			if (ctrl.gscSuggestions === undefined || ctrl.gscLoading) {
				wrap.appendChild(D.el('span', 'flowbie-wp-ai-gsc-chips__status', str('gscSuggestionsLoading', 'Loading GSC suggestions…')));
				parent.appendChild(wrap);
				window.FlowbieAiShared.fetchGscSuggestions(ctrl).then(function () {
					if (ctrl.refreshUI) ctrl.refreshUI();
				});
				return;
			}

			var list = (ctrl.gscSuggestions.suggestions || []).slice(0, limit);
			if (!list.length) {
				wrap.appendChild(D.el(
					'span',
					'flowbie-wp-ai-gsc-chips__status flowbie-wp-ai-gsc-chips__status--empty',
					ctrl.gscSuggestions.message || str('gscSuggestionsEmpty', 'No GSC suggestions for this URL.')
				));
				parent.appendChild(wrap);
				return;
			}

			list.forEach(function (item) {
				var chip = D.el('button', 'flowbie-wp-ai-gsc-chip', '');
				chip.type = 'button';
				chip.appendChild(document.createTextNode(item.query || ''));
				if (item.impressions) {
					chip.title = str('gscImpressions', 'Impressions') + ': ' + String(item.impressions);
					chip.appendChild(D.el('span', 'flowbie-wp-ai-gsc-chip__meta', String(item.impressions)));
				}
				chip.addEventListener('click', function () {
					window.FlowbieAiShared.applyGscSuggestion(ctrl, item.query);
				});
				wrap.appendChild(chip);
			});
			parent.appendChild(wrap);
		},
		runSeoResearchBrief: function (ctrl) {
			if (!ctrl || ctrl.seoResearchLoading) {
				return Promise.resolve(null);
			}
			var focus = (ctrl.draft.focusKeyword || ctrl.saved.focusKeyword || '').trim();
			if (!focus) {
				window.alert(window.FlowbieAiShared.str('runSeoResearchNeedKeyword', 'Set focus keyword first.'));
				return Promise.resolve(null);
			}
			ctrl.seoResearchLoading = true;
			if (ctrl.refreshUI) ctrl.refreshUI();
			return window.FlowbieAiShared.api('/flowbie/v1/ai/seo-research-brief', {
				method: 'POST',
				body: JSON.stringify({ post_id: ctrl.postId, focusKeyword: focus }),
			}).then(function (body) {
				ctrl.seoResearchLoading = false;
				ctrl.draft.seoResearch = body.seoResearch || '';
				if (ctrl.refreshUI) ctrl.refreshUI();
				return body;
			}).catch(function (err) {
				ctrl.seoResearchLoading = false;
				if (ctrl.refreshUI) ctrl.refreshUI();
				window.alert(err.message || window.FlowbieAiShared.str('runSeoResearchFailed', 'SEO research failed.'));
				throw err;
			});
		},
	};

	window.flowbieWpAiApi = window.FlowbieAiShared.api;
})();
