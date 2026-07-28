(function () {
	'use strict';

	var S = function () { return window.FlowbieAiShared; };
	var D = function () { return window.FlowbieAiDom; };
	var Snip = function () { return window.FlowbieAiSnippet; };

	function createPolishedFieldRow(ctrl, field) {
		var el = D().el;
		var str = S().str;
		var self = ctrl;
		var status = ctrl.status || {};
		var dirty = S().isFieldDirty(ctrl, field.key);
		var row = el('div', 'flowbie-wp-ai-editor-row' + (dirty ? ' is-dirty' : ''));
		row.setAttribute('data-meta-row', field.key);

		var head = el('div', 'flowbie-wp-ai-editor-row__head');
		head.appendChild(el('label', 'flowbie-wp-ai-editor-row__label', str(field.labelKey, field.key)));

		var actions = el('div', 'flowbie-wp-ai-editor-row__actions');

		var applyLink = el('button', 'flowbie-wp-ai-editor-row__apply button-link', str('applyField', 'Apply'));
		applyLink.type = 'button';
		applyLink.style.display = dirty && status.canApply ? '' : 'none';
		applyLink.addEventListener('click', function () {
			window.FlowbieAiModal.runApplyMetaField(self, field);
		});
		actions.appendChild(applyLink);

		actions.appendChild(D().createSparkButton({
			bare: true,
			size: 28,
			label: str('wandTitle', 'Enhance with Flowbie AI'),
			loading: ctrl.loadingField === field.apiField,
			onClick: function () {
				window.FlowbieAiModal.runMetaWand(self, field);
			},
		}));
		head.appendChild(actions);
		row.appendChild(head);

		var input;
		if (field.type === 'textarea') {
			input = document.createElement('textarea');
			input.rows = 4;
			input.className = 'flowbie-wp-ai-editor-row__input widefat';
		} else {
			input = document.createElement('input');
			input.type = 'text';
			input.className = 'flowbie-wp-ai-editor-row__input widefat';
		}
		input.setAttribute('data-meta-key', field.key);
		input.value = ctrl.draft[field.key] || '';
		input.addEventListener('input', function () {
			ctrl.draft[field.key] = input.value;
			Snip().updateAllSnippets(ctrl);
			updateEditorRowState(ctrl, row, field);
			updateModalFooter(ctrl);
		});
		row.appendChild(input);

		if (field.limit) {
			var count = (ctrl.draft[field.key] || '').length;
			var limitSpec = S().fieldLimitSpec(field);
			row.appendChild(D().createFieldMeter(count, limitSpec, S().formatCounterLabel(count, field)));
		}

		if (field.helpKey) {
			row.appendChild(el('p', 'flowbie-wp-ai-field-help', str(field.helpKey, '')));
		}
		if (field.key === 'focusKeyword' && status.gscAvailable) {
			S().renderGscChips(ctrl, row, 5);
		}
		return row;
	}

	function createPolishedContentRow(ctrl, field, label) {
		var el = D().el;
		var str = S().str;
		var self = ctrl;
		var status = ctrl.status || {};
		var draftKey = S().CONTENT_DRAFT_KEYS[field];
		var dirty = S().isFieldDirty(ctrl, draftKey);
		var row = el('div', 'flowbie-wp-ai-editor-row' + (dirty ? ' is-dirty' : ''));
		row.setAttribute('data-content-row', field);

		var head = el('div', 'flowbie-wp-ai-editor-row__head');
		head.appendChild(el('label', 'flowbie-wp-ai-editor-row__label', label));
		var actions = el('div', 'flowbie-wp-ai-editor-row__actions');

		var applyLink = el('button', 'flowbie-wp-ai-editor-row__apply button-link', str('applyField', 'Apply'));
		applyLink.type = 'button';
		applyLink.style.display = dirty && status.canApply ? '' : 'none';
		applyLink.addEventListener('click', function () {
			window.FlowbieAiModal.runApplyContentField(self, field, draftKey);
		});
		actions.appendChild(applyLink);

		if (field === 'seo_research') {
			var researchBtn = el(
				'button',
				'flowbie-wp-ai-research-btn' + (ctrl.seoResearchLoading ? ' is-loading' : ''),
				ctrl.seoResearchLoading ? str('runSeoResearchLoading', 'Researching…') : str('runSeoResearch', 'Run research')
			);
			researchBtn.type = 'button';
			researchBtn.disabled = !!ctrl.seoResearchLoading;
			researchBtn.addEventListener('click', function () {
				S().runSeoResearchBrief(self);
			});
			actions.appendChild(researchBtn);
		} else {
			actions.appendChild(D().createSparkButton({
				bare: true,
				size: 28,
				label: str('wandTitle', 'Enhance with Flowbie AI'),
				loading: ctrl.loadingField === field,
				onClick: function () {
					window.FlowbieAiModal.runContentWand(self, field, draftKey);
				},
			}));
		}
		head.appendChild(actions);
		row.appendChild(head);

		var textarea = document.createElement('textarea');
		textarea.className = 'flowbie-wp-ai-editor-row__input widefat';
		textarea.rows = field === 'seo_research' ? 6 : 3;
		textarea.setAttribute('data-meta-key', draftKey);
		textarea.value = ctrl.draft[draftKey] || '';
		textarea.addEventListener('input', function () {
			ctrl.draft[draftKey] = textarea.value;
			row.classList.toggle('is-dirty', S().isFieldDirty(ctrl, draftKey));
			applyLink.style.display = S().isFieldDirty(ctrl, draftKey) && status.canApply ? '' : 'none';
			updateModalFooter(ctrl);
		});
		row.appendChild(textarea);
		if (field === 'seo_research') {
			row.appendChild(el('p', 'flowbie-wp-ai-seo-research-hint', str('seoResearchBriefHint', 'Brief includes DataForSEO SERP, Semrush, and GSC (last 28 days).')));
		}
		return row;
	}

	function updateEditorRowState(ctrl, row, field) {
		if (!row) return;
		var dirty = S().isFieldDirty(ctrl, field.key);
		row.classList.toggle('is-dirty', dirty);
		var applyLink = row.querySelector('.flowbie-wp-ai-editor-row__apply');
		if (applyLink) {
			applyLink.style.display = dirty && ctrl.status && ctrl.status.canApply ? '' : 'none';
		}
		if (field.limit) {
			var count = (ctrl.draft[field.key] || '').length;
			var limitSpec = S().fieldLimitSpec(field);
			var counter = row.querySelector('.flowbie-wp-ai-field-meter .flowbie-wp-ai-counter');
			if (counter) {
				counter.textContent = S().formatCounterLabel(count, field);
				counter.className = 'flowbie-wp-ai-counter' + D().counterClass(count, limitSpec);
			}
			var progress = row.querySelector('.flowbie-wp-ai-field-meter .flowbie-wp-ai-field-progress__fill');
			if (progress) {
				progress.style.width = D().progressPercent(count, limitSpec) + '%';
				progress.className = 'flowbie-wp-ai-field-progress__fill' + D().progressClass(count, limitSpec);
			}
		}
	}

	function updateModalFooter(ctrl) {
		if (!ctrl.metaEditorOverlay) return;
		var saveBtn = ctrl.metaEditorOverlay.querySelector('.flowbie-wp-ai-modal__save');
		if (saveBtn) {
			saveBtn.disabled = !S().isAnyDirty(ctrl) || ctrl.savingMeta;
		}
		var unsaved = ctrl.metaEditorOverlay.querySelector('.flowbie-wp-ai-modal__unsaved');
		if (S().isAnyDirty(ctrl) && !unsaved) {
			var footer = ctrl.metaEditorOverlay.querySelector('.flowbie-wp-ai-modal__footer');
			if (footer) {
				footer.appendChild(D().el('span', 'flowbie-wp-ai-modal__unsaved', S().str('unsavedChanges', 'Unsaved changes')));
			}
		} else if (!S().isAnyDirty(ctrl) && unsaved) {
			unsaved.remove();
		}
	}

	function render(ctrl, opts) {
		opts = opts || {};
		var el = D().el;
		var str = S().str;
		var self = ctrl;
		if (!ctrl.metaEditorOverlay) return;

		var savedScroll = 0;
		var prevBody = ctrl.metaEditorOverlay.querySelector('.flowbie-wp-ai-modal__body');
		if (prevBody && opts.preserveScroll !== false) {
			savedScroll = prevBody.scrollTop;
		}

		ctrl.metaEditorOverlay.innerHTML = '';
		var panel = el('div', 'flowbie-wp-ai-modal__panel flowbie-wp-ai-modal__panel--editor');
		panel.addEventListener('click', function (e) { e.stopPropagation(); });

		var header = el('header', 'flowbie-wp-ai-modal__header');
		header.appendChild(el('h2', 'flowbie-wp-ai-modal__title', str('metaEditorTitle', 'Meta editor')));
		var closeBtn = el('button', 'flowbie-wp-ai-modal__close', '');
		closeBtn.type = 'button';
		closeBtn.setAttribute('aria-label', str('close', 'Close'));
		closeBtn.textContent = '×';
		closeBtn.addEventListener('click', function () {
			window.FlowbieAiModal.requestClose(self);
		});
		header.appendChild(closeBtn);
		panel.appendChild(header);

		var body = el('div', 'flowbie-wp-ai-modal__body');
		ctrl.metaEditorEl = body;

		var previewSection = el('section', 'flowbie-wp-ai-modal__group flowbie-wp-ai-modal__preview-section');
		var previewHead = el('div', 'flowbie-wp-ai-modal__preview-head');
		previewHead.appendChild(el('h3', 'flowbie-wp-ai-snippet__heading', str('previewLabel', 'Preview')));
		previewHead.appendChild(D().createSparkButton({
			className: 'flowbie-wp-ai-spark-btn flowbie-wp-ai-modal__generate-all',
			bare: true,
			size: 24,
			label: str('generateAll', 'Generate all with AI'),
			loading: ctrl.generatingAll,
			onClick: function () {
				window.FlowbieAiModal.runGenerateAll(self);
			},
		}));
		previewSection.appendChild(previewHead);
		previewSection.appendChild(Snip().renderSnippetCard(ctrl, { hero: true, showHeading: false }));
		body.appendChild(previewSection);

		var metaSection = el('section', 'flowbie-wp-ai-modal__group flowbie-wp-ai-modal__section');
		metaSection.appendChild(el('h3', 'flowbie-wp-ai-modal__section-title', str('metaSeo', 'Meta & SEO')));
		S().META_FIELDS.forEach(function (field) {
			metaSection.appendChild(createPolishedFieldRow(ctrl, field));
		});
		body.appendChild(metaSection);

		var status = ctrl.status || {};
		var labels = status.fieldLabels || {};
		var allowed = status.fields || [];
		var contentFields = S().CONTENT_FIELDS.filter(function (f) {
			return allowed.indexOf(f) !== -1;
		});
		if (contentFields.length) {
			var contentSection = el('section', 'flowbie-wp-ai-modal__group flowbie-wp-ai-modal__section');
			contentSection.appendChild(el('h3', 'flowbie-wp-ai-modal__section-title', str('contentFields', 'Content fields')));
			contentFields.forEach(function (field) {
				if (field === 'faq') {
					contentSection.appendChild(window.FlowbieAiFaq.renderModalRow(ctrl, labels[field] || field));
				} else {
					contentSection.appendChild(createPolishedContentRow(ctrl, field, labels[field] || field));
				}
			});
			body.appendChild(contentSection);
		}

		panel.appendChild(body);

		var footer = el('footer', 'flowbie-wp-ai-modal__footer');
		if (status.capEnforced === false && (status.capNotice || str('capPaused', ''))) {
			footer.appendChild(el('p', 'flowbie-wp-ai-modal__cap-notice flowbie-wp-ai-modal__cap-notice--paused', status.capNotice || str('capPaused', 'Optimization cap is temporarily disabled.')));
		} else if (!status.canApply) {
			footer.appendChild(el('p', 'flowbie-wp-ai-modal__cap-notice', str('capReached', 'Apply disabled — optimization cap reached for this period.')));
		}
		var saveBtn = el('button', 'button button-primary flowbie-wp-ai-modal__save', str('saveMeta', 'Save meta'));
		saveBtn.type = 'button';
		saveBtn.disabled = !S().isAnyDirty(ctrl) || ctrl.savingMeta;
		saveBtn.addEventListener('click', function () {
			window.FlowbieAiModal.runSaveMeta(self);
		});
		footer.appendChild(saveBtn);
		if (S().isAnyDirty(ctrl)) {
			footer.appendChild(el('span', 'flowbie-wp-ai-modal__unsaved', str('unsavedChanges', 'Unsaved changes')));
		}
		panel.appendChild(footer);

		ctrl.metaEditorOverlay.appendChild(panel);

		var newBody = panel.querySelector('.flowbie-wp-ai-modal__body');
		if (newBody && savedScroll > 0) {
			newBody.scrollTop = savedScroll;
		}

		if (!opts.skipFocus) {
			var firstInput = panel.querySelector('input, textarea');
			if (firstInput) {
				setTimeout(function () { firstInput.focus(); }, 50);
			}
		}
	}

	function open(ctrl) {
		var el = D().el;
		var str = S().str;
		if (ctrl.metaEditorOpen) {
			render(ctrl);
			return;
		}
		if (window.FlowbieAiFaq) {
			window.FlowbieAiFaq.resetStorageBase(ctrl);
		}
		ctrl.metaEditorOpen = true;
		var overlay = el('div', 'flowbie-wp-ai-modal flowbie-wp-ai-modal--editor');
		overlay.id = 'flowbie-wp-ai-meta-editor-modal';
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', str('metaEditorTitle', 'Meta editor'));
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) window.FlowbieAiModal.requestClose(ctrl);
		});
		document.body.appendChild(overlay);
		document.body.classList.add('flowbie-wp-ai-modal-open');
		ctrl.metaEditorOverlay = overlay;
		ctrl._escapeHandler = function (e) {
			if (e.key === 'Escape') window.FlowbieAiModal.requestClose(ctrl);
		};
		document.addEventListener('keydown', ctrl._escapeHandler);
		render(ctrl);
	}

	function requestClose(ctrl) {
		if (S().isAnyDirty(ctrl)) {
			if (!window.confirm(S().str('discardChanges', 'You have unsaved changes. Discard them?'))) return;
		}
		close(ctrl, true);
	}

	function close(ctrl, force) {
		if (!ctrl.metaEditorOpen && !ctrl.metaEditorOverlay) return;
		if (!force && S().isAnyDirty(ctrl)) {
			requestClose(ctrl);
			return;
		}
		if (ctrl._escapeHandler) {
			document.removeEventListener('keydown', ctrl._escapeHandler);
			ctrl._escapeHandler = null;
		}
		if (ctrl.metaEditorOverlay) ctrl.metaEditorOverlay.remove();
		ctrl.metaEditorOverlay = null;
		ctrl.metaEditorEl = null;
		ctrl.metaEditorOpen = false;
		document.body.classList.remove('flowbie-wp-ai-modal-open');
	}

	function applyOptimization(ctrl, body) {
		if (body.optimization && ctrl.status.capEnforced !== false) {
			ctrl.status.used = body.optimization.used;
			ctrl.status.cap = body.optimization.cap;
			ctrl.status.remaining = body.optimization.remaining;
			ctrl.status.canApply = (body.optimization.remaining || 0) > 0;
		}
	}

	window.FlowbieAiModal = {
		open: open,
		close: close,
		requestClose: requestClose,
		render: render,
		updateModalFooter: updateModalFooter,
		runMetaWand: function (ctrl, field) {
			ctrl.loadingField = field.apiField;
			ctrl.refreshUI();
			S().api('/flowbie/v1/ai/preview', {
				method: 'POST',
				body: JSON.stringify({ post_id: ctrl.postId, field: field.apiField }),
			}).then(function (body) {
				ctrl.loadingField = null;
				ctrl.draft[field.key] = S().clampSeoPreview(field.apiField, body.value || '');
				ctrl.refreshUI();
			}).catch(function (err) {
				ctrl.loadingField = null;
				ctrl.refreshUI();
				window.alert(err.message || 'Preview failed.');
			});
		},
		runGenerateAll: function (ctrl) {
			if (ctrl.generatingAll) return;
			ctrl.generatingAll = true;
			ctrl.refreshUI();
			var chain = Promise.resolve();
			S().GENERATE_ALL_FIELDS.forEach(function (item) {
				chain = chain.then(function () {
					ctrl.loadingField = item.apiField;
					ctrl.refreshUI();
					return S().api('/flowbie/v1/ai/preview', {
						method: 'POST',
						body: JSON.stringify({ post_id: ctrl.postId, field: item.apiField }),
					}).then(function (body) {
						ctrl.draft[item.key] = S().clampSeoPreview(item.apiField, body.value || '');
					});
				});
			});
			chain.then(function () {
				ctrl.generatingAll = false;
				ctrl.loadingField = null;
				ctrl.refreshUI();
			}).catch(function (err) {
				ctrl.generatingAll = false;
				ctrl.loadingField = null;
				ctrl.refreshUI();
				window.alert(err.message || 'Generate failed.');
			});
		},
		runApplyMetaField: function (ctrl, field) {
			var value = ctrl.draft[field.key] || '';
			if (!value.trim()) return;
			S().api('/flowbie/v1/ai/apply', {
				method: 'POST',
				body: JSON.stringify({ post_id: ctrl.postId, field: field.apiField, value: value }),
			}).then(function (body) {
				applyOptimization(ctrl, body);
				S().syncDraftFromValues(ctrl, body.values);
				S().syncEditorMeta(field.apiField, value);
				S().syncDomField(field.apiField, value);
				ctrl.toastMessage = S().str('applied', 'Applied to this post.');
				ctrl.refreshUI();
			}).catch(function (err) {
				window.alert(err.message || 'Apply failed.');
			});
		},
		runSaveMeta: function (ctrl) {
			if (!S().isAnyDirty(ctrl)) return;
			if (window.FlowbieAiFaq) {
				window.FlowbieAiFaq.syncDraftFromDom(ctrl);
			}
			var payload = { post_id: ctrl.postId };
			var keyMap = { seoTitle: 'seoTitle', metaDescription: 'metaDescription', focusKeyword: 'focusKeyword', seoResearch: 'seoResearch', faq: 'faq', pageUrl: 'pageUrl' };
			var savedKeys = {};
			S().ALL_DRAFT_KEYS.forEach(function (key) {
				if (ctrl.draft[key] !== ctrl.saved[key]) {
					payload[keyMap[key] || key] = ctrl.draft[key];
					savedKeys[key] = true;
				}
			});
			ctrl.savingMeta = true;
			updateModalFooter(ctrl);
			var saveBtn = ctrl.metaEditorOverlay && ctrl.metaEditorOverlay.querySelector('.flowbie-wp-ai-modal__save');
			if (saveBtn) saveBtn.textContent = S().str('savingMeta', 'Saving…');
			S().api('/flowbie/v1/ai/save-meta', { method: 'POST', body: JSON.stringify(payload) })
				.then(function (body) {
					ctrl.savingMeta = false;
					S().syncDraftFromValues(ctrl, body.values);
					if (savedKeys.faq && window.FlowbieAiFaq) {
						window.FlowbieAiFaq.resetStorageBase(ctrl);
					}
					if (savedKeys.seoTitle) { S().syncEditorMeta('title', ctrl.draft.seoTitle); S().syncDomField('title', ctrl.draft.seoTitle); }
					if (savedKeys.metaDescription) { S().syncEditorMeta('excerpt', ctrl.draft.metaDescription); S().syncDomField('excerpt', ctrl.draft.metaDescription); }
					if (savedKeys.focusKeyword) S().syncDomField('focus_keyword', ctrl.draft.focusKeyword);
					if (savedKeys.seoResearch) S().syncDomField('seo_research', ctrl.draft.seoResearch);
					if (savedKeys.faq) S().syncDomField('faq', ctrl.draft.faq);
					if (savedKeys.pageUrl) S().syncDomField('page_url', ctrl.draft.pageUrl);
					ctrl.toastMessage = S().str('metaSaved', 'Meta saved.');
					ctrl.refreshUI();
				}).catch(function (err) {
					ctrl.savingMeta = false;
					ctrl.refreshUI();
					window.alert(err.message || 'Save failed.');
				});
		},
		runContentWand: function (ctrl, field, draftKey) {
			ctrl.loadingField = field;
			ctrl.refreshUI();
			S().api('/flowbie/v1/ai/preview', {
				method: 'POST',
				body: JSON.stringify({ post_id: ctrl.postId, field: field }),
			}).then(function (body) {
				ctrl.loadingField = null;
				if (field === 'faq' && window.FlowbieAiFaq) {
					var base = ctrl._faqStorageBase != null ? ctrl._faqStorageBase : (ctrl.saved.faq || '');
					ctrl.draft[draftKey] = window.FlowbieAiFaq.mergeAiFaqIntoStorage(body.value || '', base);
				} else {
					ctrl.draft[draftKey] = body.value || '';
				}
				ctrl.refreshUI();
			}).catch(function (err) {
				ctrl.loadingField = null;
				ctrl.refreshUI();
				window.alert(err.message || 'Preview failed.');
			});
		},
		runApplyContentField: function (ctrl, field, draftKey) {
			if (field === 'faq' && window.FlowbieAiFaq) {
				window.FlowbieAiFaq.syncDraftFromDom(ctrl);
			}
			var value = ctrl.draft[draftKey] || '';
			if (!value.trim()) return;
			S().api('/flowbie/v1/ai/apply', {
				method: 'POST',
				body: JSON.stringify({ post_id: ctrl.postId, field: field, value: value }),
			}).then(function (body) {
				applyOptimization(ctrl, body);
				S().syncDraftFromValues(ctrl, body.values);
				S().syncDomField(field, value);
				if (draftKey === 'faq' && window.FlowbieAiFaq) {
					window.FlowbieAiFaq.resetStorageBase(ctrl);
				}
				ctrl.toastMessage = S().str('applied', 'Applied to this post.');
				ctrl.refreshUI();
			}).catch(function (err) {
				window.alert(err.message || 'Apply failed.');
			});
		},
	};
})();
