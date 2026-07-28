/**
 * Agent Hub — list/edit bootstrapping.
 */
(function ($) {
	'use strict';

	var R = window.FlowbieAgentHubRuntime;
	var api = R.api;

	api.bootListPage = function () {
		var hub = document.getElementById('flowbie-agent-hub');
		if (!hub) {
			return;
		}

		var hashMatch = window.location.hash.match(/^#flowbie-agent-hub-edit-(\d+)$/);
		if (hashMatch) {
			window.location.replace(api.editPageUrl(parseInt(hashMatch[1], 10)));
			return;
		}

		hub.addEventListener('click', function (event) {
			var t = event.target;
			if (!t || !t.closest) return;
			var edit = t.closest('.flowbie-agent-hub-edit');
			if (edit) { return; }
			var opt = t.closest('.flowbie-agent-hub-optimize');
			if (opt) { event.preventDefault(); event.stopPropagation(); window.FlowbieAgentHubUI.openOptimize(api.blockIdFromEl($(opt))); return; }
			var dup = t.closest('.flowbie-agent-hub-duplicate');
			if (dup) { event.preventDefault(); event.stopPropagation(); window.FlowbieAgentHubUI.openDuplicate(api.blockIdFromEl($(dup))); return; }
			var del = t.closest('.flowbie-agent-hub-delete');
			if (del) { event.preventDefault(); event.stopPropagation(); api.deleteBlock(api.blockIdFromEl($(del))); }
		}, true);

		$('#flowbie-agent-hub-add-row').on('click', function (e) {
			e.preventDefault();
			var $btn = $(this).prop('disabled', true);
			api.rest('seo-blocks/draft', { method: 'POST', body: {} })
				.then(function (data) {
					var newId = data.block && data.block.id ? parseInt(data.block.id, 10) : 0;
					if (newId > 0) {
						api.goToEditPage(newId);
					} else {
						api.notifyError(R.cfg.i18n.error);
					}
				})
				.catch(function (err) { api.notifyError(err); })
				.finally(function () { $btn.prop('disabled', false); });
		});

		$('#doaction, #doaction2').on('click', function (e) {
			var which = this.id === 'doaction2' ? 2 : 1;
			var $select = which === 2 ? $('#bulk-action2') : $('#bulk-action');
			var action = ($select.val() || '').toString();
			if (action && action !== '-1') { e.preventDefault(); api.handleBulkAction(action); }
		});
	}

	api.bootEditPage = function () {
		R.dom.$modal = $('#flowbie-agent-hub-builder');
		R.dom.$form = $('#flowbie-agent-hub-modal-form');
		if (!R.dom.$modal.length) {
			return;
		}

		api.ensureSlotEditorShell();
		api.bindSlotEditorEvents();
		api.showLayoutView();

		$('.flowbie-builder-tabs__tab').on('click', function () { api.switchTab($(this).data('tab')); });

		$('#flowbie-builder-grid-rows, #flowbie-builder-grid-cols').on('input change', function () {
			var rows = api.clampGridDim($('#flowbie-builder-grid-rows').val());
			var cols = api.clampGridDim($('#flowbie-builder-grid-cols').val());
			R.builder.layout_config.grid = { rows: rows, cols: cols };
			var hadOverflow = api.validateGridSections();
			api.renderLayout();
			api.schedulePreview();
			if (hadOverflow) {
				$('#flowbie-builder-layout-hint')
					.text(R.cfg.i18n.gridOverflow || 'Some items no longer fit this grid.')
					.addClass('is-warning');
			}
		});

		R.dom.$modal.on('change input', '.flowbie-builder-section-col-span', function () {
			var row = parseInt($(this).data('row'), 10);
			var col = parseInt($(this).data('col'), 10);
			var sec = api.findSectionAt(row, col);
			if (!sec) return;
			sec.col_span = Math.max(1, parseInt($(this).val(), 10) || 1);
			R.builder.selectedLayoutCell = { row: row, col: col };
			var hadOverflow = api.validateGridSections();
			api.renderLayout();
			api.schedulePreview();
			if (hadOverflow) {
				$('#flowbie-builder-layout-hint').text(R.cfg.i18n.gridOverflow || 'Some items no longer fit this grid.').addClass('is-warning');
			}
		});

		R.dom.$modal.on('click', '.flowbie-builder-layout-cell:not(.is-covered)', function (e) {
			if ($(e.target).closest('.flowbie-builder-layout-chip__remove, .flowbie-builder-layout-chip__drag, a, button').length) {
				return;
			}
			var row = parseInt($(this).data('row'), 10);
			var col = parseInt($(this).data('col'), 10);
			if (isNaN(row) || isNaN(col)) return;
			api.selectLayoutCell(row, col);
		});

		R.dom.$modal.on('change', '.flowbie-builder-section-align-h', function () {
			var row = parseInt($(this).data('row'), 10);
			var col = parseInt($(this).data('col'), 10);
			var sec = api.findSectionAt(row, col);
			if (!sec) return;
			var align = $(this).val() || 'left';
			sec.align_h = align;
			(sec.slot_ids || []).forEach(function (sid) {
				var slot = api.getSlotById(sid);
				if (slot) slot.align_h = align;
			});
			api.renderLayout();
			api.schedulePreview();
		});

		R.dom.$modal.on('click', '.flowbie-builder-section-center-row', function () {
			var row = parseInt($(this).data('row'), 10);
			var col = parseInt($(this).data('col'), 10);
			var sec = api.findSectionAt(row, col);
			if (!sec) return;
			api.centerSectionOnRow(sec);
			R.builder.selectedLayoutCell = { row: sec.row, col: sec.col };
			var hadOverflow = api.validateGridSections();
			api.renderLayout();
			api.schedulePreview();
			if (hadOverflow) {
				$('#flowbie-builder-layout-hint').text(R.cfg.i18n.gridOverflow || 'Some items no longer fit this grid.').addClass('is-warning');
			}
		});

		R.dom.$modal.on('click', '.flowbie-builder-layout-chip', function (e) {
			if ($(e.target).closest('.flowbie-builder-layout-chip__remove, .flowbie-builder-layout-chip__drag').length) return;
			var slotId = $(this).attr('data-slot-id');
			if (!slotId) return;
			e.preventDefault();
			e.stopPropagation();
			api.openSlotEditor(slotId);
		});

		R.dom.$modal.on('click', '.flowbie-builder-layout-chip__remove', function (e) {
			e.preventDefault();
			e.stopPropagation();
			var slotId = $(this).closest('.flowbie-builder-layout-chip').attr('data-slot-id');
			var $cell = $(this).closest('.flowbie-builder-layout-cell');
			api.removeSlotFromCell(parseInt($cell.data('row'), 10), parseInt($cell.data('col'), 10), slotId);
			api.renderLayout();
			api.schedulePreview();
		});

		R.dom.$modal.on('change input', '.flowbie-responsive-input', function () {
			var bp = $(this).data('bp');
			var key = $(this).data('key');
			if (bp === 'desktop') return;
			if (!R.builder.layout_config.responsive[bp]) R.builder.layout_config.responsive[bp] = {};
			R.builder.layout_config.responsive[bp][key] = $(this).attr('type') === 'checkbox' ? $(this).is(':checked') : $(this).val();
			api.schedulePreview();
		});

		R.dom.$modal.on('input change', '#flowbie-builder-settings input, #flowbie-builder-settings select, #flowbie-builder-settings textarea', api.schedulePreview);

		$('#flowbie-agent-hub-primary-post-search').on('input', function () {
			var term = $(this).val() || '';
			clearTimeout(R.timers.pageSearchTimer);
			R.timers.pageSearchTimer = setTimeout(function () {
				api.searchPrimaryPages(term).then(function (items) {
					api.mergePrimaryPostOptions(items, term);
				});
			}, 300);
		});

		$('#flowbie-agent-hub-field-primary-post').on('focus', function () {
			var $sel = $(this);
			if ($sel.find('option').length <= 2) {
				api.searchPrimaryPages('').then(function (items) {
					api.mergePrimaryPostOptions(items, '');
				});
			}
		});

		$('#flowbie-agent-hub-field-primary-post').on('change', function () {
			var postId = parseInt($(this).val() || '0', 10) || 0;
			var summary = postId > 0 ? api.primaryPostSummaryFromSelect() : null;
			api.renderPrimaryPostSummary(summary);
			api.updateContextBadge({
				primary_post_id: postId,
				primary_post: summary
			});
			if (postId > 0) {
				$('#flowbie-agent-hub-primary-post-search').val('');
			}
			api.persistPrimaryPostSelection(postId, summary);
		});

		// Initial page list for picker (modal only — never touch list table cells).
		if ($('#flowbie-agent-hub-field-primary-post').length) {
			api.searchPrimaryPages('').then(function (items) {
				api.mergePrimaryPostOptions(items, '');
			});
		}

		R.dom.$form.on('submit', function (e) { e.preventDefault(); api.saveModal({ closeAfter: false }); });
		$('#flowbie-agent-hub-modal-optimize').on('click', function (e) {
			e.preventDefault();
			if (R.busy) return;
			var payload = api.collectPayload();
			var postId = payload.primary_post_id || 0;
			api.showToast(
				postId > 0 ? (R.cfg.i18n.optimizingWithPage || 'Optimizing with linked page context…') :
					(R.cfg.i18n.optimizingIndependent || 'Optimizing as independent block…'),
				'info'
			);
			api.optimizeBlockInModal(true);
		});
		$('#flowbie-agent-hub-modal-save').on('click', function (e) { e.preventDefault(); api.saveModal({ closeAfter: false }); });
		$('#flowbie-agent-hub-modal-save-exit').on('click', function (e) { e.preventDefault(); api.saveModal({ closeAfter: true }); });
		api.initAgentTab();
		$(document).on('keydown', function (e) {
			if (e.key !== 'Escape') return;
			if (api.isSlotEditorOpen()) {
				e.preventDefault();
				api.commitSlotEditor();
			}
		});

		var initialId = parseInt(R.cfg.initialBlockId, 10) || 0;
		if (initialId > 0) {
			api.loadBlock(initialId);
		}
	}

	api.boot = function () {
		if (!api.initConfig()) {
			return;
		}
		if (R.cfg.screen === 'edit') {
			api.bootEditPage();
			return;
		}
		if (R.cfg.screen === 'list') {
			api.bootListPage();
		}
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', api.boot);
	} else {
		api.boot();
	}

})(jQuery);
