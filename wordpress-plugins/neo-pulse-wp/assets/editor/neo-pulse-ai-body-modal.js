(function () {
	'use strict';

	var S = function () { return window.NeoPulseAiShared; };
	var D = function () { return window.NeoPulseAiDom; };
	var Snip = function () { return window.NeoPulseAiSnippet; };

	var modalOverlay = null;
	var isOpen = false;
	var escHandler = null;
	var unsubHarness = null;

	function statusIcon(status) {
		switch (status) {
			case 'generating': return '\u27F3';
			case 'done':       return '\u2713';
			case 'error':      return '\u2715';
			default:           return '\u25CB';
		}
	}

	function statusText(status) {
		var str = S().str;
		switch (status) {
			case 'generating': return str('bodyStatusGenerating', 'GENERATING');
			case 'done':       return str('bodyStatusReady', 'READY');
			case 'error':      return str('bodyStatusError', 'ERROR');
			default:           return str('bodyStatusWaiting', 'STANDBY');
		}
	}

	function ensureSessionThenPreview(ctrl, sectionIndex) {
		var store = window.NeoPulseBodyHarnessStore;
		var state = store.state;
		if (state.sessionId) {
			return window.NeoPulseBodyHarness.previewSection(ctrl.postId, sectionIndex, state.sessionId);
		}
		store.patchSection(sectionIndex, { status: 'generating' });
		store.setState({ loading: true, error: '' });
		return window.NeoPulseBodyHarness.plan(ctrl.postId, ctrl).then(function () {
			var newState = store.state;
			return window.NeoPulseBodyHarness.previewSection(ctrl.postId, sectionIndex, newState.sessionId);
		});
	}

	function ensureSessionThenRunAll(ctrl) {
		var store = window.NeoPulseBodyHarnessStore;
		var state = store.state;
		if (state.sessionId) {
			return window.NeoPulseBodyHarness.runAllPreviews(ctrl.postId, ctrl);
		}
		store.setState({ loading: true, error: '' });
		return window.NeoPulseBodyHarness.plan(ctrl.postId, ctrl).then(function () {
			return window.NeoPulseBodyHarness.runAllPreviews(ctrl.postId, ctrl);
		});
	}

	function runMetaWandLocal(ctrl, field) {
		ctrl.loadingField = field.apiField;
		renderBody(ctrl);
		S().api('/neo-pulse/v1/ai/preview', {
			method: 'POST',
			body: JSON.stringify({ post_id: ctrl.postId, field: field.apiField }),
		}).then(function (body) {
			ctrl.loadingField = null;
			ctrl.draft[field.key] = S().clampSeoPreview(field.apiField, body.value || '');
			renderBody(ctrl);
		}).catch(function (err) {
			ctrl.loadingField = null;
			renderBody(ctrl);
			window.alert(err.message || 'Preview failed.');
		});
	}

	function saveMetaLocal(ctrl) {
		if (window.NeoPulseAiFaq) window.NeoPulseAiFaq.syncDraftFromDom(ctrl);
		var payload = { post_id: ctrl.postId };
		var keyMap = { seoTitle: 'seoTitle', metaDescription: 'metaDescription', focusKeyword: 'focusKeyword', seoResearch: 'seoResearch', faq: 'faq', pageUrl: 'pageUrl' };
		var savedKeys = {};
		S().ALL_DRAFT_KEYS.forEach(function (key) {
			if (ctrl.draft[key] !== ctrl.saved[key]) {
				payload[keyMap[key] || key] = ctrl.draft[key];
				savedKeys[key] = true;
			}
		});
		if (!Object.keys(savedKeys).length) return;
		var btn = modalOverlay && modalOverlay.querySelector('.fbm-save-meta');
		if (btn) { btn.disabled = true; btn.textContent = S().str('savingMeta', 'Saving\u2026'); }
		S().api('/neo-pulse/v1/ai/save-meta', { method: 'POST', body: JSON.stringify(payload) })
			.then(function (body) {
				S().syncDraftFromValues(ctrl, body.values);
				if (savedKeys.faq && window.NeoPulseAiFaq) window.NeoPulseAiFaq.resetStorageBase(ctrl);
				if (savedKeys.seoTitle) { S().syncEditorMeta('title', ctrl.draft.seoTitle); S().syncDomField('title', ctrl.draft.seoTitle); }
				if (savedKeys.metaDescription) { S().syncEditorMeta('excerpt', ctrl.draft.metaDescription); S().syncDomField('excerpt', ctrl.draft.metaDescription); }
				if (savedKeys.focusKeyword) S().syncDomField('focus_keyword', ctrl.draft.focusKeyword);
				if (savedKeys.faq) S().syncDomField('faq', ctrl.draft.faq);
				ctrl.toastMessage = S().str('metaSaved', 'Meta saved.');
				renderBody(ctrl);
				if (ctrl.refreshUI) ctrl.refreshUI();
			}).catch(function (err) {
				if (btn) { btn.disabled = false; btn.textContent = S().str('saveMeta', 'Save meta'); }
				window.alert(err.message || 'Save failed.');
			});
	}

	function createMetaFieldRow(ctrl, field) {
		var el = D().el;
		var str = S().str;
		var row = el('div', 'fbm-meta-row');

		var head = el('div', 'fbm-meta-row__head');
		head.appendChild(el('label', 'fbm-meta-row__label', str(field.labelKey, field.key)));

		var wand = D().createSparkButton({
			bare: true, size: 24,
			label: str('wandTitle', 'Enhance with NEO Pulse AI'),
			loading: ctrl.loadingField === field.apiField,
			onClick: function () {
				runMetaWandLocal(ctrl, field);
			},
		});
		head.appendChild(wand);
		row.appendChild(head);

		var input;
		if (field.type === 'textarea') {
			input = document.createElement('textarea');
			input.rows = 3;
			input.className = 'fbm-meta-row__input widefat';
		} else {
			input = document.createElement('input');
			input.type = 'text';
			input.className = 'fbm-meta-row__input widefat';
		}
		input.setAttribute('data-meta-key', field.key);
		input.value = ctrl.draft[field.key] || '';
		input.addEventListener('input', function () {
			ctrl.draft[field.key] = input.value;
			if (Snip()) Snip().updateAllSnippets(ctrl);
		});
		row.appendChild(input);

		if (field.limit) {
			var count = (ctrl.draft[field.key] || '').length;
			var limitSpec = S().fieldLimitSpec(field);
			row.appendChild(D().createFieldMeter(count, limitSpec, S().formatCounterLabel(count, field)));
		}
		return row;
	}

	function callInsertElement(ctrl, sec, propPanel, store, elementType, customPrompt) {
		var toolbar = propPanel.parentNode && propPanel.parentNode.querySelector('.fbm-insert-toolbar');
		if (toolbar) {
			var btns = toolbar.querySelectorAll('button');
			for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
			var sp = toolbar.querySelector('.fbm-insert-spinner');
			if (sp) sp.style.display = 'inline-block';
		}

		S().api('/neo-pulse/v1/ai/body/insert-element', {
			method: 'POST',
			body: JSON.stringify({
				post_id: ctrl.postId,
				section_title: sec.title || '',
				section_html: propPanel.innerHTML || sec.currentHtml || '',
				element_type: elementType,
				custom_prompt: customPrompt || '',
			}),
		}).then(function (resp) {
			if (resp.html) {
				propPanel.innerHTML = propPanel.innerHTML + '\n' + resp.html;
				var sections = store.state.sections;
				for (var j = 0; j < sections.length; j++) {
					if (sections[j].index === sec.index) { sections[j].previewHtml = propPanel.innerHTML; break; }
				}
			}
			if (toolbar) {
				var btns2 = toolbar.querySelectorAll('button');
				for (var k = 0; k < btns2.length; k++) btns2[k].disabled = false;
				var sp2 = toolbar.querySelector('.fbm-insert-spinner');
				if (sp2) sp2.style.display = 'none';
			}
		}).catch(function (err) {
			if (toolbar) {
				var btns3 = toolbar.querySelectorAll('button');
				for (var m = 0; m < btns3.length; m++) btns3[m].disabled = false;
				var sp3 = toolbar.querySelector('.fbm-insert-spinner');
				if (sp3) sp3.style.display = 'none';
			}
			window.alert(err.message || 'Insert failed.');
		});
	}

	function buildInsertToolbar(ctrl, sec, propPanel, store) {
		var el = D().el;
		var tb = el('div', 'fbm-insert-toolbar');

		var items = [
			{ type: 'table', label: 'Table', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>' },
			{ type: 'bullet', label: 'Bullet list', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>' },
			{ type: 'numbered', label: 'Numbered list', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="3" y="8" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="3" y="14" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="3" y="20" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg>' },
		];

		items.forEach(function (item) {
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'fbm-insert-btn';
			btn.title = item.label;
			btn.innerHTML = item.icon + '<span class="fbm-insert-btn__label">' + item.label + '</span>';
			btn.addEventListener('click', function (e) {
				e.preventDefault();
				callInsertElement(ctrl, sec, propPanel, store, item.type, '');
			});
			tb.appendChild(btn);
		});

		var customBtn = document.createElement('button');
		customBtn.type = 'button';
		customBtn.className = 'fbm-insert-btn fbm-insert-btn--custom';
		customBtn.title = 'Custom prompt';
		customBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span class="fbm-insert-btn__label">Custom</span>';
		customBtn.addEventListener('click', function (e) {
			e.preventDefault();
			var existing = tb.querySelector('.fbm-insert-custom-row');
			if (existing) { existing.remove(); return; }
			var customRow = el('div', 'fbm-insert-custom-row');
			var input = document.createElement('input');
			input.type = 'text';
			input.className = 'fbm-insert-custom-input';
			input.placeholder = 'Describe what to generate\u2026';
			input.addEventListener('click', function (ev) { ev.stopPropagation(); });
			var goBtn = el('button', 'button button-small button-primary', 'Go');
			goBtn.type = 'button';
			function submitCustom() {
				var prompt = input.value.trim();
				if (!prompt) return;
				callInsertElement(ctrl, sec, propPanel, store, 'custom', prompt);
				customRow.remove();
			}
			goBtn.addEventListener('click', submitCustom);
			input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submitCustom(); } });
			customRow.appendChild(input);
			customRow.appendChild(goBtn);
			tb.appendChild(customRow);
			input.focus();
		});
		tb.appendChild(customBtn);

		var spinner = document.createElement('span');
		spinner.className = 'fbm-insert-spinner';
		spinner.style.display = 'none';
		spinner.textContent = '\u27F3';
		tb.appendChild(spinner);

		return tb;
	}

	function renderBody(ctrl) {
		if (!modalOverlay) return;
		var el = D().el;
		var str = S().str;
		var store = window.NeoPulseBodyHarnessStore;
		var state = store.state;
		var status = ctrl.status || {};

		var body = modalOverlay.querySelector('.fbm-body');
		if (!body) return;
		var savedScroll = body.scrollTop;
		body.innerHTML = '';

		/* ═══ META ZONE ═══ */
		var metaZone = el('section', 'fbm-zone fbm-zone--meta');
		if (Snip()) {
			metaZone.appendChild(Snip().renderSnippetCard(ctrl, { compact: true, showHeading: false }));
		}
		if (window.NeoPulseAiUrlTool && status.isPublished) {
			var urlPanel = window.NeoPulseAiUrlTool.renderPanel(ctrl);
			if (urlPanel) metaZone.appendChild(urlPanel);
		}
		var metaFields = [
			{ key: 'seoTitle', apiField: 'title', labelKey: 'seoTitle', type: 'text', limit: 60 },
			{ key: 'metaDescription', apiField: 'excerpt', labelKey: 'metaDescription', type: 'textarea', limit: 160, limitMin: 150 },
			{ key: 'focusKeyword', apiField: 'focus_keyword', labelKey: 'focusKeyword', type: 'text' },
		];
		metaFields.forEach(function (f) { metaZone.appendChild(createMetaFieldRow(ctrl, f)); });

		var saveMeta = el('button', 'button button-small button-primary fbm-save-meta', str('saveMeta', 'Save meta'));
		saveMeta.type = 'button';
		saveMeta.addEventListener('click', function () {
			saveMetaLocal(ctrl);
		});
		metaZone.appendChild(saveMeta);
		body.appendChild(metaZone);

		/* ═══ BODY ZONE ═══ */
		var bodyZone = el('section', 'fbm-zone fbm-zone--body');

		var bodyHead = el('div', 'fbm-zone__head');
		bodyHead.appendChild(el('h3', 'fbm-zone__title', str('bodyColSection', 'Sections')));
		if (state.structureDirty) {
			var saveStructBtn = el('button', 'button button-small button-primary fbm-save-structure', str('saveStructure', 'Save changes'));
			saveStructBtn.type = 'button';
			saveStructBtn.disabled = !!state.loading;
			saveStructBtn.addEventListener('click', function () {
				window.NeoPulseBodyHarness.saveStructure(ctrl.postId).catch(function () {});
			});
			bodyHead.appendChild(saveStructBtn);
		}
		bodyZone.appendChild(bodyHead);

		if (state.error) {
			bodyZone.appendChild(el('p', 'fbm-error', state.error));
		}

		if (status.bodyHarnessAvailable && state.sections.length) {
			var toolbar = el('div', 'fbm-toolbar');
			var runAll = el('button', 'button button-small button-primary', str('bodyRunAll', 'Run all'));
			runAll.type = 'button';
			runAll.disabled = !!state.loading;
			runAll.addEventListener('click', function () { ensureSessionThenRunAll(ctrl).catch(function () {}); });
			toolbar.appendChild(runAll);
			var stopBtn = el('button', 'button button-small', str('bodyStop', 'Stop'));
			stopBtn.type = 'button';
			stopBtn.addEventListener('click', function () { store.setState({ stopRequested: true }); });
			toolbar.appendChild(stopBtn);
			if (state.sessionId) {
				var clearBtn = el('button', 'button button-small button-link', str('bodyClear', 'Clear'));
				clearBtn.type = 'button';
				clearBtn.addEventListener('click', function () {
					window.NeoPulseBodyHarness.clearSession(ctrl.postId).then(function () {
						loadSectionsFromPost(ctrl, store).then(function () { renderBody(ctrl); });
					}).catch(function () {});
				});
				toolbar.appendChild(clearBtn);
			}
			bodyZone.appendChild(toolbar);

			var grid = el('div', 'fbm-grid');
			grid.setAttribute('data-fbm-grid', '1');

			var headerRow = el('div', 'fbm-grid-header');
			headerRow.appendChild(el('div', 'fbm-col-drag', ''));
			headerRow.appendChild(el('div', 'fbm-col-status', str('bodyColStatus', '')));
			headerRow.appendChild(el('div', 'fbm-col-section', str('bodyColSection', 'Section')));
			headerRow.appendChild(el('div', 'fbm-col-action', ''));
			grid.appendChild(headerRow);

			state.sections.forEach(function (sec) {
				var displayStatus = sec.status === 'applied' ? 'waiting' : (sec.status || 'waiting');
				var rowWrap = el('div', 'fbm-row-wrap fbm-row-wrap--' + displayStatus);
				rowWrap.setAttribute('data-section-idx', String(sec.index));
				rowWrap.draggable = true;
				if (sec.expanded) rowWrap.classList.add('is-expanded');

				rowWrap.addEventListener('dragstart', (function (idx) {
					return function (e) {
						e.dataTransfer.effectAllowed = 'move';
						e.dataTransfer.setData('text/plain', String(idx));
						rowWrap.classList.add('fbm-row-wrap--dragging');
					};
				})(sec.index));
				rowWrap.addEventListener('dragend', function () {
					rowWrap.classList.remove('fbm-row-wrap--dragging');
					var all = grid.querySelectorAll('.fbm-row-wrap--dragover');
					for (var k = 0; k < all.length; k++) all[k].classList.remove('fbm-row-wrap--dragover');
				});
				rowWrap.addEventListener('dragover', function (e) {
					e.preventDefault();
					e.dataTransfer.dropEffect = 'move';
					rowWrap.classList.add('fbm-row-wrap--dragover');
				});
				rowWrap.addEventListener('dragleave', function () {
					rowWrap.classList.remove('fbm-row-wrap--dragover');
				});
				rowWrap.addEventListener('drop', (function (toIdx) {
					return function (e) {
						e.preventDefault();
						rowWrap.classList.remove('fbm-row-wrap--dragover');
						var fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
						if (fromIdx !== toIdx) {
							store.moveSection(fromIdx, toIdx);
						}
					};
				})(sec.index));

				var row = el('div', 'fbm-row');

				/* DRAG HANDLE */
				var dragCell = el('div', 'fbm-col-drag');
				var dragHandle = el('span', 'fbm-drag-handle', '\u2261');
				dragHandle.title = 'Drag to reorder';
				dragCell.appendChild(dragHandle);
				row.appendChild(dragCell);

				/* STATUS */
				var iconEl = el('span', 'fbm-status-icon fbm-status-icon--' + displayStatus, statusIcon(displayStatus));
				var statusCell = el('div', 'fbm-col-status');
				statusCell.appendChild(iconEl);
				row.appendChild(statusCell);

				/* SECTION TITLE (inline editable) */
				var sectionCell = el('div', 'fbm-col-section');
				var titleInput = document.createElement('input');
				titleInput.type = 'text';
				titleInput.className = 'fbm-section-title-input';
				titleInput.value = sec.title || '';
				titleInput.addEventListener('change', (function (idx) {
					return function () {
						store.renameSection(idx, titleInput.value);
					};
				})(sec.index));
				titleInput.addEventListener('click', function (e) { e.stopPropagation(); });
				sectionCell.appendChild(titleInput);

				var expandBtn = el('button', 'fbm-expand-btn', sec.expanded ? '\u25B2' : '\u25BC');
				expandBtn.type = 'button';
				expandBtn.title = 'Expand / collapse';
				expandBtn.addEventListener('click', function () { store.patchSection(sec.index, { expanded: !sec.expanded }); });
				sectionCell.appendChild(expandBtn);
				row.appendChild(sectionCell);

				/* ACTIONS */
				var actCell = el('div', 'fbm-col-action');
				if (sec.status === 'done' && sec.previewHtml) {
					var applyBtn = el('button', 'button button-small button-primary', str('apply', 'Apply'));
					applyBtn.type = 'button';
					applyBtn.disabled = !!state.loading;
					applyBtn.addEventListener('click', (function (idx, fallbackHtml) {
						return function (e) {
							e.stopPropagation();
							var livePanel = modalOverlay && modalOverlay.querySelector('[data-section-index="' + idx + '"]');
							var html = livePanel ? livePanel.innerHTML : fallbackHtml;
							var s = store.state.sections;
							for (var j = 0; j < s.length; j++) {
								if (s[j].index === idx) { s[j].previewHtml = html; break; }
							}
							window.NeoPulseBodyHarness.applySection(ctrl.postId, idx, state.sessionId, html, ctrl).catch(function () {});
						};
					})(sec.index, sec.previewHtml));
					actCell.appendChild(applyBtn);
				} else if (sec.status === 'generating') {
					actCell.appendChild(el('span', 'fbm-generating-label', str('bodyStatusGenerating', 'Generating\u2026')));
				} else {
					var optBtn = el('button', 'button button-small', str('bodyOptimize', 'Optimize'));
					optBtn.type = 'button';
					optBtn.disabled = !!state.loading;
					optBtn.addEventListener('click', function (e) {
						e.stopPropagation();
						ensureSessionThenPreview(ctrl, sec.index).catch(function () {});
					});
					actCell.appendChild(optBtn);
				}

				var delBtn = el('button', 'fbm-delete-btn', '\u2715');
				delBtn.type = 'button';
				delBtn.title = 'Delete section';
				delBtn.addEventListener('click', (function (idx, title) {
					return function (e) {
						e.stopPropagation();
						if (window.confirm('Delete "' + title + '" and its content?')) {
							store.deleteSection(idx);
						}
					};
				})(sec.index, sec.title));
				actCell.appendChild(delBtn);

				row.appendChild(actCell);
				rowWrap.appendChild(row);

				/* EXPANDED DIFF */
				if (sec.expanded && (sec.previewHtml || sec.currentHtml)) {
					var diff = el('div', 'fbm-diff');
					var curCol = el('div', 'fbm-diff-col');
					curCol.appendChild(el('h4', 'fbm-diff-heading', str('bodyDiffCurrent', 'Current')));
					var curPanel = document.createElement('div');
					curPanel.className = 'fbm-diff-rendered';
					curPanel.innerHTML = sec.currentHtml || '<p>' + str('bodyDiffEmpty', '(no matching section in post)') + '</p>';
					curCol.appendChild(curPanel);
					diff.appendChild(curCol);

					var propCol = el('div', 'fbm-diff-col');
					propCol.appendChild(el('h4', 'fbm-diff-heading', str('bodyDiffProposed', 'Proposed')));

					var propPanel = document.createElement('div');
					propPanel.className = 'fbm-diff-rendered fbm-diff-rendered--proposed';
					if (sec.previewHtml) {
						propPanel.innerHTML = sec.previewHtml;
						propPanel.contentEditable = 'true';
						propPanel.setAttribute('data-section-index', String(sec.index));
						propPanel.addEventListener('blur', (function (idx) {
							return function () {
								var s = store.state.sections;
								for (var j = 0; j < s.length; j++) {
									if (s[j].index === idx) { s[j].previewHtml = propPanel.innerHTML; break; }
								}
							};
						})(sec.index));
					} else {
						propPanel.innerHTML = '<p style="color:#646970;font-style:italic;">' + str('bodyOptimizeHint', 'Click Optimize to generate improved content.') + '</p>';
					}

					/* ── Insert toolbar ── */
					propCol.appendChild(buildInsertToolbar(ctrl, sec, propPanel, store));
					propCol.appendChild(propPanel);
					diff.appendChild(propCol);
					rowWrap.appendChild(diff);
				}
				grid.appendChild(rowWrap);
			});
			bodyZone.appendChild(grid);

			/* Add section button */
			var addRow = el('div', 'fbm-add-section');
			var addBtn = el('button', 'button button-small fbm-add-section-btn', '+ ' + str('addSection', 'Add section'));
			addBtn.type = 'button';
			addBtn.addEventListener('click', function () {
				store.addSection('');
			});
			addRow.appendChild(addBtn);
			bodyZone.appendChild(addRow);
		} else if (!status.bodyHarnessAvailable) {
			bodyZone.appendChild(el('p', 'fbm-error', str('bodyHarnessKeyRequired', 'Add OpenRouter key in Settings or wp-config for body harness.')));
		} else if (!state.loading) {
			bodyZone.appendChild(el('p', 'fbm-empty', str('bodyNoSections', 'No H2 sections found. Add headings to optimize.')));
			var addRowEmpty = el('div', 'fbm-add-section');
			var addBtnEmpty = el('button', 'button button-small fbm-add-section-btn', '+ ' + str('addSection', 'Add section'));
			addBtnEmpty.type = 'button';
			addBtnEmpty.addEventListener('click', function () {
				store.addSection('');
			});
			addRowEmpty.appendChild(addBtnEmpty);
			bodyZone.appendChild(addRowEmpty);
		}

		if (state.loading) {
			bodyZone.appendChild(el('p', 'fbm-loading', str('loading', 'Generating\u2026')));
		}
		body.appendChild(bodyZone);

		/* ═══ FAQ ZONE ═══ */
		if (window.NeoPulseAiFaq) {
			var faqZone = el('section', 'fbm-zone fbm-zone--faq');
			var faqLabels = status.fieldLabels || {};
			faqZone.appendChild(window.NeoPulseAiFaq.renderModalRow(ctrl, faqLabels['faq'] || 'FAQ'));
			body.appendChild(faqZone);
		}

		body.scrollTop = savedScroll;
	}

	function normalizeForMatch(text) {
		return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
	}

	function loadSectionsFromPost(ctrl, store) {
		return S()
			.api('/neo-pulse/v1/ai/body/sections?post_id=' + encodeURIComponent(String(ctrl.postId)), { method: 'GET' })
			.then(function (resp) {
				var sections = resp.sections || [];
				if (sections.length) {
					store.setState({ sections: sections, plannedCount: sections.length, doneCount: 0, phase: 'idle' });
				}
				return sections;
			});
	}

	function mergeSessionStatus(store, session) {
		var current = store.state.sections;
		var sessionSections = session.sections || [];
		if (!current.length || !sessionSections.length) {
			if (session.sessionId) store.setState({ sessionId: session.sessionId });
			return;
		}

		var sessionMap = {};
		sessionSections.forEach(function (s) {
			sessionMap[normalizeForMatch(s.title)] = s;
		});

		var doneCount = 0;
		var merged = current.map(function (sec) {
			var key = normalizeForMatch(sec.title);
			var match = sessionMap[key];
			if (!match) return sec;
			var out = Object.assign({}, sec);
			if (match.status === 'done' || match.status === 'applied') {
				out.status = match.status;
				doneCount++;
			}
			if (match.keyword) out.keyword = match.keyword;
			if (match.hasPreview) out.hasPreview = true;
			return out;
		});

		store.setState({
			sections: merged,
			sessionId: session.sessionId || '',
			doneCount: doneCount,
			plannedCount: merged.length,
			phase: session.phase || 'idle',
		});
	}

	function open(ctrl) {
		var el = D().el;
		var str = S().str;

		if (isOpen) {
			renderBody(ctrl);
			return;
		}
		isOpen = true;

		var overlay = el('div', 'neo-pulse-wp-ai-modal fbm-overlay');
		overlay.id = 'neo-pulse-body-modal';
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', str('contentOptimizer', 'Content Optimizer'));
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) closeModal(ctrl);
		});

		var panel = el('div', 'fbm-panel');
		panel.addEventListener('click', function (e) { e.stopPropagation(); });

		var header = el('header', 'fbm-header');
		header.appendChild(el('h2', 'fbm-title', str('contentOptimizer', 'Content Optimizer')));
		var closeBtn = el('button', 'fbm-close', '\u00D7');
		closeBtn.type = 'button';
		closeBtn.setAttribute('aria-label', str('close', 'Close'));
		closeBtn.addEventListener('click', function () { closeModal(ctrl); });
		header.appendChild(closeBtn);
		panel.appendChild(header);

		var bodyEl = el('div', 'fbm-body');
		panel.appendChild(bodyEl);

		overlay.appendChild(panel);
		document.body.appendChild(overlay);
		document.body.classList.add('neo-pulse-wp-ai-modal-open');
		modalOverlay = overlay;

		escHandler = function (e) { if (e.key === 'Escape') closeModal(ctrl); };
		document.addEventListener('keydown', escHandler);

		if (window.NeoPulseAiFaq) {
			window.NeoPulseAiFaq.resetStorageBase(ctrl);
		}

		var store = window.NeoPulseBodyHarnessStore;

		if (store) {
			unsubHarness = store.subscribe(function () {
				renderBody(ctrl);
			});
		}

		loadSectionsFromPost(ctrl, store).then(function () {
			if (window.NeoPulseBodyHarness) {
				return window.NeoPulseBodyHarness.loadSession(ctrl.postId, true).then(function (resp) {
					if (resp.hasSession) {
						mergeSessionStatus(store, resp);
					}
				}).catch(function () {});
			}
		}).then(function () {
			renderBody(ctrl);
		}).catch(function () {
			renderBody(ctrl);
		});
	}

	function closeModal(ctrl) {
		if (escHandler) {
			document.removeEventListener('keydown', escHandler);
			escHandler = null;
		}
		if (unsubHarness) {
			unsubHarness();
			unsubHarness = null;
		}
		if (modalOverlay) {
			modalOverlay.remove();
			modalOverlay = null;
		}
		isOpen = false;
		document.body.classList.remove('neo-pulse-wp-ai-modal-open');
		if (ctrl && ctrl.refreshUI) ctrl.refreshUI();
	}

	/* ═══════════════════════════════════════════════
	   Internal link toolbar — floating on text selection
	   ═══════════════════════════════════════════════ */

	var linkToolbar = null;
	var linkDropdown = null;
	var cachedInventory = null;
	var activeRange = null;
	var activePanel = null;

	function removeLinkToolbar() {
		if (linkToolbar) { linkToolbar.remove(); linkToolbar = null; }
		if (linkDropdown) { linkDropdown.remove(); linkDropdown = null; }
		activeRange = null;
		activePanel = null;
	}

	function positionToolbar(toolbar, range, container) {
		var rRect = range.getBoundingClientRect();
		var cRect = container.getBoundingClientRect();
		toolbar.style.position = 'fixed';
		toolbar.style.left = Math.max(cRect.left, Math.min(rRect.left + (rRect.width / 2) - 52, cRect.right - 104)) + 'px';
		toolbar.style.top = (rRect.top - 44) + 'px';
	}

	function wrapSelectionWithLink(url, title) {
		if (!activeRange || !activePanel) return;
		var sel = window.getSelection();
		if (!sel) return;
		sel.removeAllRanges();
		sel.addRange(activeRange);
		var anchor = document.createElement('a');
		anchor.href = url;
		anchor.title = title || '';
		anchor.target = '_blank';
		anchor.rel = 'noopener';
		try {
			activeRange.surroundContents(anchor);
		} catch (e) {
			anchor.textContent = activeRange.toString();
			activeRange.deleteContents();
			activeRange.insertNode(anchor);
		}
		var idx = activePanel.getAttribute('data-section-index');
		if (idx !== null) {
			var store = window.NeoPulseBodyHarnessStore;
			var sections = store.state.sections;
			for (var j = 0; j < sections.length; j++) {
				if (sections[j].index === parseInt(idx, 10)) {
					sections[j].previewHtml = activePanel.innerHTML;
					break;
				}
			}
		}
		removeLinkToolbar();
	}

	function showAutoLinkLoading() {
		if (!linkToolbar) return;
		var btns = linkToolbar.querySelectorAll('button');
		for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
		var spinner = linkToolbar.querySelector('.fbm-lt-spinner');
		if (spinner) spinner.style.display = 'inline-block';
	}

	function hideAutoLinkLoading() {
		if (!linkToolbar) return;
		var btns = linkToolbar.querySelectorAll('button');
		for (var i = 0; i < btns.length; i++) btns[i].disabled = false;
		var spinner = linkToolbar.querySelector('.fbm-lt-spinner');
		if (spinner) spinner.style.display = 'none';
	}

	function handleAutoLink(ctrl) {
		if (!activeRange || !activePanel) return;
		var selectedText = activeRange.toString().trim();
		if (!selectedText) return;

		var parentEl = activeRange.commonAncestorContainer;
		if (parentEl.nodeType === 3) parentEl = parentEl.parentNode;
		var context = parentEl ? (parentEl.textContent || '').substring(0, 500) : '';

		if (linkDropdown) { linkDropdown.remove(); linkDropdown = null; }
		showAutoLinkLoading();
		S().api('/neo-pulse/v1/ai/body/suggest-link', {
			method: 'POST',
			body: JSON.stringify({
				post_id: ctrl.postId,
				selected_text: selectedText,
				context: context,
			}),
		}).then(function (resp) {
			hideAutoLinkLoading();
			var suggestions = resp.suggestions || [];
			if (!suggestions.length) {
				var msg = linkToolbar && linkToolbar.querySelector('.fbm-lt-msg');
				if (msg) {
					msg.textContent = resp.reason || 'No matches found';
					msg.style.display = 'block';
					setTimeout(function () { if (msg) msg.style.display = 'none'; }, 2500);
				}
				return;
			}
			showSuggestionsDropdown(suggestions);
		}).catch(function () {
			hideAutoLinkLoading();
		});
	}

	function showSuggestionsDropdown(suggestions) {
		if (!linkToolbar) return;
		if (linkDropdown) { linkDropdown.remove(); linkDropdown = null; }

		var dd = document.createElement('div');
		dd.className = 'fbm-lt-dropdown';

		var heading = document.createElement('div');
		heading.className = 'fbm-lt-dropdown-head';
		heading.textContent = 'AI suggestions (pick one)';
		dd.appendChild(heading);

		var list = document.createElement('div');
		list.className = 'fbm-lt-list';

		suggestions.forEach(function (s, i) {
			var item = document.createElement('button');
			item.type = 'button';
			item.className = 'fbm-lt-item';
			item.innerHTML = '<span class="fbm-lt-item-rank">' + (i + 1) + '.</span> ' + (s.title || '(no title)');
			item.title = s.url || '';
			item.addEventListener('click', function () {
				wrapSelectionWithLink(s.url, s.title);
			});
			list.appendChild(item);
		});
		dd.appendChild(list);

		var tbRect = linkToolbar.getBoundingClientRect();
		dd.style.position = 'fixed';
		dd.style.left = tbRect.left + 'px';
		dd.style.top = (tbRect.bottom + 4) + 'px';

		document.body.appendChild(dd);
		linkDropdown = dd;
	}

	function handleManualLink(ctrl) {
		if (!activeRange || !activePanel || !linkToolbar) return;
		if (linkDropdown) { linkDropdown.remove(); linkDropdown = null; return; }

		var dd = document.createElement('div');
		dd.className = 'fbm-lt-dropdown';

		var search = document.createElement('input');
		search.type = 'text';
		search.className = 'fbm-lt-search';
		search.placeholder = 'Search posts\u2026';
		search.addEventListener('mousedown', function (e) { e.stopPropagation(); });
		dd.appendChild(search);

		var list = document.createElement('div');
		list.className = 'fbm-lt-list';
		list.innerHTML = '<p class="fbm-lt-loading-text">Loading\u2026</p>';
		dd.appendChild(list);

		var urlInput = document.createElement('input');
		urlInput.type = 'url';
		urlInput.className = 'fbm-lt-url-input';
		urlInput.placeholder = 'Or paste a URL\u2026';
		urlInput.addEventListener('mousedown', function (e) { e.stopPropagation(); });
		urlInput.addEventListener('keydown', function (e) {
			if (e.key === 'Enter') {
				e.preventDefault();
				var url = urlInput.value.trim();
				if (url) wrapSelectionWithLink(url, '');
			}
		});
		dd.appendChild(urlInput);

		var tbRect = linkToolbar.getBoundingClientRect();
		dd.style.position = 'fixed';
		dd.style.left = tbRect.left + 'px';
		dd.style.top = (tbRect.bottom + 4) + 'px';

		document.body.appendChild(dd);
		linkDropdown = dd;
		search.focus();

		function renderList(posts, filter) {
			list.innerHTML = '';
			var lf = (filter || '').toLowerCase();
			var shown = 0;
			for (var i = 0; i < posts.length; i++) {
				var p = posts[i];
				var title = p.title || '(no title)';
				if (lf && title.toLowerCase().indexOf(lf) < 0) continue;
				if (++shown > 30) break;
				var item = document.createElement('button');
				item.type = 'button';
				item.className = 'fbm-lt-item';
				item.textContent = title;
				item.setAttribute('data-url', p.url || '');
				item.setAttribute('data-title', title);
				item.addEventListener('click', function () {
					wrapSelectionWithLink(this.getAttribute('data-url'), this.getAttribute('data-title'));
				});
				list.appendChild(item);
			}
			if (shown === 0) {
				list.innerHTML = '<p class="fbm-lt-no-results">No matches</p>';
			}
		}

		function loadInventory() {
			if (cachedInventory) {
				renderList(cachedInventory, '');
				return;
			}
			S().api('/neo-pulse/v1/ai/body/posts-inventory?post_id=' + encodeURIComponent(String(ctrl.postId)), { method: 'GET' })
				.then(function (resp) {
					cachedInventory = resp.posts || [];
					renderList(cachedInventory, search.value);
				})
				.catch(function () {
					list.innerHTML = '<p class="fbm-lt-no-results">Failed to load</p>';
				});
		}

		search.addEventListener('input', function () {
			if (cachedInventory) renderList(cachedInventory, search.value);
		});

		loadInventory();
	}

	function showLinkToolbar(ctrl) {
		removeLinkToolbar();
		var sel = window.getSelection();
		if (!sel || sel.isCollapsed || !sel.rangeCount) return;

		var range = sel.getRangeAt(0);
		var text = range.toString().trim();
		if (!text) return;

		var node = range.commonAncestorContainer;
		var panel = node.nodeType === 3 ? node.parentNode : node;
		while (panel && !panel.classList) panel = panel.parentNode;
		while (panel && !panel.classList.contains('fbm-diff-rendered--proposed')) {
			panel = panel.parentNode;
			if (!panel || panel === document.body) return;
		}
		if (!panel || !panel.classList.contains('fbm-diff-rendered--proposed')) return;

		activeRange = range.cloneRange();
		activePanel = panel;

		var tb = document.createElement('div');
		tb.className = 'fbm-lt';

		var autoBtn = document.createElement('button');
		autoBtn.type = 'button';
		autoBtn.className = 'fbm-lt-btn fbm-lt-btn--auto';
		autoBtn.title = 'Auto-suggest link';
		autoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/></svg>';
		autoBtn.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
		autoBtn.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			handleAutoLink(ctrl);
		});
		tb.appendChild(autoBtn);

		var manualBtn = document.createElement('button');
		manualBtn.type = 'button';
		manualBtn.className = 'fbm-lt-btn fbm-lt-btn--manual';
		manualBtn.title = 'Choose link manually';
		manualBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
		manualBtn.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
		manualBtn.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			handleManualLink(ctrl);
		});
		tb.appendChild(manualBtn);

		var spinner = document.createElement('span');
		spinner.className = 'fbm-lt-spinner';
		spinner.style.display = 'none';
		spinner.textContent = '\u27F3';
		tb.appendChild(spinner);

		var msg = document.createElement('span');
		msg.className = 'fbm-lt-msg';
		msg.style.display = 'none';
		tb.appendChild(msg);

		document.body.appendChild(tb);
		linkToolbar = tb;
		positionToolbar(tb, range, panel);
	}

	function setupSelectionListener(ctrl) {
		document.addEventListener('mouseup', function (e) {
			if (linkToolbar && linkToolbar.contains(e.target)) return;
			if (linkDropdown && linkDropdown.contains(e.target)) return;
			setTimeout(function () { showLinkToolbar(ctrl); }, 10);
		});
		document.addEventListener('mousedown', function (e) {
			if (linkToolbar && linkToolbar.contains(e.target)) return;
			if (linkDropdown && linkDropdown.contains(e.target)) return;
			removeLinkToolbar();
		});
	}

	var selectionListenerBound = false;

	/* ═══════════════════════════════════════════════ */

	window.NeoPulseBodyModal = {
		open: function (ctrl) {
			open(ctrl);
			if (!selectionListenerBound) {
				setupSelectionListener(ctrl);
				selectionListenerBound = true;
			}
		},
		close: closeModal,
		isOpen: function () { return isOpen; },
		refresh: function (ctrl) {
			if (isOpen) renderBody(ctrl);
		},
	};
})();
