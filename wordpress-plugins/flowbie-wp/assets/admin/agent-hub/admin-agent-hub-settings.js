/**
 * Agent Hub — settings, primary page, payload.
 */
(function ($) {
	'use strict';

	var R = window.FlowbieAgentHubRuntime;
	var api = R.api;

	api.setModalBusy = function (isBusy) {
		R.busy = !!isBusy;
		if (R.dom.$modal && R.dom.$modal.length) {
			R.dom.$modal.toggleClass('is-busy', R.busy);
		}
		if (R.dom.$form && R.dom.$form.length) {
			R.dom.$form.find('button, input, select, textarea').prop('disabled', R.busy);
		}
	};

	api.closeModal = function () {
		api.closeSlotEditor();
		R.busy = false;
		if (R.dom.$modal && R.dom.$modal.length) {
			R.dom.$modal.removeClass('is-busy');
			if (R.dom.$form && R.dom.$form.length) {
				R.dom.$form.find('button, input, select, textarea').prop('disabled', false);
			}
		}
		api.goToListPage();
	};

	api.isSlotEditorOpen = function () {
		return !!R.builder.activeSlotId && R.dom.$blockEditorView && R.dom.$blockEditorView.length && R.dom.$blockEditorView.hasClass('is-active');
	};

	api.ensureSlotEditorShell = function () {
		R.dom.$blockEditorView = $('#flowbie-builder-block-editor-view');
		R.dom.$layoutView = $('#flowbie-builder-layout-view');
		return R.dom.$blockEditorView.length > 0 && R.dom.$layoutView.length > 0;
	};

	api.showLayoutView = function () {
		if (R.dom.$blockEditorView && R.dom.$blockEditorView.length) {
			R.dom.$blockEditorView.removeClass('is-active');
		}
		if (R.dom.$layoutView && R.dom.$layoutView.length) {
			R.dom.$layoutView.addClass('is-active');
		}
		if (R.dom.$modal && R.dom.$modal.length) {
			R.dom.$modal.removeClass('is-block-editing');
		}
	};

	api.showBlockEditorView = function () {
		if (R.dom.$layoutView && R.dom.$layoutView.length) {
			R.dom.$layoutView.removeClass('is-active');
		}
		if (R.dom.$blockEditorView && R.dom.$blockEditorView.length) {
			R.dom.$blockEditorView.addClass('is-active');
		}
		if (R.dom.$modal && R.dom.$modal.length) {
			R.dom.$modal.addClass('is-block-editing');
		}
	};

	api.addBlockFromToolbar = function () {
		if (R.cfg.screen !== 'edit') {
			return;
		}
		if (!api.ensureSlotEditorShell()) {
			api.notifyError(R.cfg.i18n.slotEditorUnavailable || 'Block editor could not load. Refresh the page and try again.');
			return;
		}
		if (!R.builder.layout_config) {
			R.builder.layout_config = api.defaultLayout(R.builder.slots);
		}
		api.switchTab('layout');
		var newId = api.genId();
		R.builder.slots.push({
			_id: newId,
			type: 'h2',
			text: '',
			heading_level: 2,
			align_h: 'left',
			align_v: 'middle'
		});
		api.syncLayoutWithSlots();
		api.renderLayout();
		api.schedulePreview();
		api.openSlotEditor(newId);
	}

	api.getSlotIndex = function(slotId) {
		for (var i = 0; i < R.builder.slots.length; i++) {
			if (R.builder.slots[i]._id === slotId) return i;
		}
		return -1;
	}

	api.findSectionContainingSlot = function(slotId) {
		var found = null;
		(R.builder.layout_config.sections || []).some(function (sec) {
			if ((sec.slot_ids || []).indexOf(slotId) !== -1) {
				found = sec;
				return true;
			}
			return false;
		});
		return found;
	}

	api.slotPlacementLabel = function(slotId) {
		var sec = api.findSectionContainingSlot(slotId);
		if (!sec) return '';
		var row = parseInt(sec.row, 10);
		var col = parseInt(sec.col, 10);
		if (isNaN(row) || isNaN(col)) return '';
		var tpl = (R.cfg.i18n && R.cfg.i18n.placedInCell) || 'Row %1$s, column %2$s';
		return tpl.replace('%1$s', String(row + 1)).replace('%2$s', String(col + 1));
	}

	api.switchTab = function(tab) {
		if (tab !== 'layout' && api.isSlotEditorOpen()) {
			api.commitSlotEditor();
		}
		$('.flowbie-builder-tabs__tab').removeClass('is-active').attr('aria-selected', 'false');
		$('.flowbie-builder-tabs__tab[data-tab="' + tab + '"]').addClass('is-active').attr('aria-selected', 'true');
		$('.flowbie-builder-tab-panel').prop('hidden', true).removeClass('is-active');
		$('.flowbie-builder-tab-panel[data-panel="' + tab + '"]').prop('hidden', false).addClass('is-active');
		if (R.dom.$modal && R.dom.$modal.length) {
			R.dom.$modal.toggleClass('flowbie-agent-hub-modal--agent-tab', tab === 'agent');
		}
		if (tab === 'layout' && !R.builder.activeSlotId) {
			api.showLayoutView();
		}
	}

	api.populateSettings = function(block) {
		block = block || {};
		$('#flowbie-agent-hub-field-id').val(block.id || 0);
		$('#flowbie-agent-hub-field-id-display').text(block.id ? String(block.id) : '—');
		$('#flowbie-agent-hub-field-title').val(block.title || '');
		$('#flowbie-agent-hub-field-focus-keyword').val(block.focus_keyword || '');
		$('#flowbie-agent-hub-field-topic-focus').val(block.topic_focus || '');
		$('#flowbie-agent-hub-field-h2').val(block.h2 || '');
		$('#flowbie-agent-hub-field-status').val(block.status || 'draft');
		api.populatePrimaryPage(block);
		var $libWrap = $('.flowbie-agent-hub-builder-page__library-wrap');
		var $libLink = $('#flowbie-agent-hub-field-library');
		if (block.elementor_library_id) {
			$libWrap.prop('hidden', false);
			$libLink.attr('href', block.library_edit_url || api.libraryEditUrl(block.elementor_library_id));
		} else {
			$libWrap.prop('hidden', true);
			$libLink.attr('href', '#');
		}
	}

	api.loadBlockIntoBuilder = function (block) {
		block = block || {};
		R.builder.slots = api.ensureSlotIds(block.slots || []);
		R.builder.layout_config = block.layout_config && block.layout_config.sections
			? JSON.parse(JSON.stringify(block.layout_config))
			: api.defaultLayout(R.builder.slots);
		if (!R.builder.layout_config.grid) {
			R.builder.layout_config.grid = { rows: 3, cols: 3 };
		}
		if (!R.builder.layout_config.responsive) {
			R.builder.layout_config.responsive = api.defaultResponsive();
		}
		api.syncLayoutWithSlots();
		api.populateSettings(block);
		api.syncGridInputs();
		api.renderLayout();
		api.renderResponsive();
		api.schedulePreview();
	}

	api.applyOptimizedPreviewToBuilder = function(preview) {
		if (!preview || !preview.preview_slots || !preview.preview_slots.length) {
			api.showToast(R.cfg.i18n.optimizeEmpty || 'Optimize returned no slot updates.', 'error');
			return false;
		}
		R.builder.slots = api.ensureSlotIds(JSON.parse(JSON.stringify(preview.preview_slots)));
		if (preview.focus_keyword) {
			$('#flowbie-agent-hub-field-focus-keyword').val(preview.focus_keyword);
		}
		if (preview.topic_focus) {
			$('#flowbie-agent-hub-field-topic-focus').val(preview.topic_focus);
		}
		api.syncH2FromSlots();
		api.syncLayoutWithSlots();
		api.renderLayout();
		api.schedulePreview();
		return true;
	}

	api.collectPayload = function() {
		api.syncWysiwygEditorsToSlots();
		api.syncH2FromSlots();
		return {
			id: parseInt($('#flowbie-agent-hub-field-id').val() || '0', 10) || 0,
			title: $('#flowbie-agent-hub-field-title').val() || '',
			focus_keyword: $('#flowbie-agent-hub-field-focus-keyword').val() || '',
			topic_focus: $('#flowbie-agent-hub-field-topic-focus').val() || '',
			h2: $('#flowbie-agent-hub-field-h2').val() || '',
			status: $('#flowbie-agent-hub-field-status').val() || 'draft',
			primary_post_id: parseInt($('#flowbie-agent-hub-field-primary-post').val() || '0', 10) || 0,
			slots: R.builder.slots,
			layout_config: R.builder.layout_config
		};
	}

	R.timers.pageSearchTimer = null;
	R.flags.primaryPostSaveInFlight = false;

	api.appendPrimaryPostOption = function ($sel, item) {
		if (!item || !item.id) return;
		var id = String(item.id);
		if ($sel.find('option[value="' + id + '"]').length) return;
		var label = item.title || ('#' + item.id);
		if (item.type) label += ' (' + item.type + ')';
		$('<option>')
			.val(id)
			.text(label)
			.attr('data-focus-keyword', item.focus_keyword || '')
			.attr('data-edit-url', item.edit_url || '')
			.appendTo($sel);
	}

	api.selectedPrimaryPostOptionData = function($sel) {
		var id = String($sel.val() || '0');
		if (id === '0') return null;
		var $opt = $sel.find('option:selected');
		if (!$opt.length) return null;
		return {
			id: parseInt(id, 10),
			title: String($opt.text() || '').replace(/\s*\([^)]+\)$/, ''),
			type: '',
			focus_keyword: String($opt.attr('data-focus-keyword') || ''),
			edit_url: String($opt.attr('data-edit-url') || '')
		};
	}

	api.mergePrimaryPostOptions = function(items, term) {
		if (R.flags.primaryPostSaveInFlight) return;
		var $sel = $('#flowbie-agent-hub-field-primary-post');
		if (!$sel.length) return;
		var selected = api.selectedPrimaryPostOptionData($sel);
		var selectedId = selected ? String(selected.id) : '0';
		var resultIds = (items || []).map(function (item) { return String(item.id); });
		var frozenSelected = selected ? {
			id: selected.id,
			title: selected.title,
			type: selected.type || '',
			focus_keyword: selected.focus_keyword || '',
			edit_url: selected.edit_url || ''
		} : null;

		$sel.find('option:not([value="0"])').each(function () {
			var value = String(this.value);
			if (value === selectedId) return;
			if (term && resultIds.indexOf(value) === -1) {
				$(this).remove();
			}
		});

		(items || []).forEach(function (item) { api.appendPrimaryPostOption($sel, item); });

		if (frozenSelected) {
			api.appendPrimaryPostOption($sel, frozenSelected);
			$sel.val(String(frozenSelected.id));
		}
	}

	api.ensurePrimaryPostOption = function(summary) {
		var $sel = $('#flowbie-agent-hub-field-primary-post');
		if (!summary || !summary.id) {
			$sel.val('0');
			return;
		}
		var id = String(summary.id);
		if (!$sel.find('option[value="' + id + '"]').length) {
			var label = summary.title || ('#' + id);
			if (summary.type) label += ' (' + summary.type + ')';
			$('<option>')
				.val(id)
				.text(label)
				.attr('data-focus-keyword', summary.focus_keyword || '')
				.attr('data-edit-url', summary.edit_url || '')
				.appendTo($sel);
		}
		$sel.val(id);
	}

	api.renderPrimaryPostSummary = function(summary) {
		var $wrap = $('#flowbie-agent-hub-primary-post-summary');
		if (!summary || !summary.id) {
			$wrap.prop('hidden', true).empty();
			return;
		}
		var html = '<strong>' + api.esc(summary.title || '') + '</strong>';
		if (summary.focus_keyword) {
			html += '<br><span class="flowbie-agent-hub-muted">' + api.esc(summary.focus_keyword) + '</span>';
		}
		if (summary.edit_url) {
			html += '<br><a href="' + api.esc(summary.edit_url) + '" target="_blank" rel="noopener">' +
				api.esc(R.cfg.i18n.primaryPageEdit || 'Edit page') + '</a>';
		}
		$wrap.html(html).prop('hidden', false);
	}

	api.formatPrimaryPageContextForPrompt = function(ctx) {
		if (!ctx || !ctx.postId) return '';
		var parts = [];
		if (ctx.pageTitle) parts.push('Page title: ' + ctx.pageTitle);
		if (ctx.pageUrl) parts.push('Page URL: ' + ctx.pageUrl);
		if (ctx.focusKeyword) parts.push('Page focus keyword: ' + ctx.focusKeyword);
		if (ctx.seoTitle) parts.push('Page SEO title: ' + ctx.seoTitle);
		if (ctx.metaDescription) parts.push('Page meta description: ' + String(ctx.metaDescription).slice(0, 500));
		if (ctx.pageExcerpt) parts.push('Page excerpt: ' + String(ctx.pageExcerpt).slice(0, 800));
		if (ctx.pageBodyText) parts.push('Page body (for intent alignment):\n' + ctx.pageBodyText);
		if (ctx.seoResearch) parts.push('SEO research brief:\n' + String(ctx.seoResearch).slice(0, 12000));
		if (ctx.faq) parts.push('Page FAQ:\n' + String(ctx.faq).slice(0, 6000));
		if (ctx.siblingHeadings && ctx.siblingHeadings.length) {
			parts.push('Other headings on page: ' + ctx.siblingHeadings.join('; '));
		}
		return parts.join('\n\n');
	}

	api.fetchPrimaryPageContext = function(postId, blockId) {
		postId = parseInt(postId, 10) || 0;
		blockId = parseInt(blockId, 10) || 0;
		if (postId < 1) {
			R.builder.primaryPageContext = null;
			return Promise.resolve(null);
		}
		var path = 'ai/seo-block/context?post_id=' + encodeURIComponent(String(postId));
		if (blockId > 0) path += '&block_id=' + encodeURIComponent(String(blockId));
		return api.rest(path).then(function (ctx) {
			R.builder.primaryPageContext = ctx;
			return ctx;
		}).catch(function () {
			R.builder.primaryPageContext = null;
			return null;
		});
	}

	api.ensurePrimaryPageContext = function(postId, blockId) {
		return api.fetchPrimaryPageContext(postId, blockId).then(function (ctx) {
			api.updateContextBadge(api.collectPayload(), ctx);
			return ctx;
		});
	}

	api.updateContextBadge = function(block, pageCtx) {
		var $badge = $('#flowbie-agent-hub-context-badge');
		if (!$badge.length) return;
		block = block || {};
		pageCtx = pageCtx || R.builder.primaryPageContext || null;
		var postId = parseInt(block.primary_post_id || '0', 10) || 0;
		var summary = block.primary_post || null;
		$badge.removeAttr('hidden');
		if (postId > 0 && summary && summary.title) {
			var label = (R.cfg.i18n.pageLinked || 'Page-linked') + ': ' + summary.title;
			if (pageCtx && (pageCtx.pageBodyText || pageCtx.pageTitle)) {
				label += ' · ' + (R.cfg.i18n.pageContextLoaded || 'Page context loaded');
			}
			$badge.removeClass('is-independent').addClass('is-page-linked').text(label);
		} else if (postId > 0) {
			var $opt = $('#flowbie-agent-hub-field-primary-post option:selected');
			var label2 = (R.cfg.i18n.pageLinked || 'Page-linked') + ': ' + ($opt.text() || '');
			if (pageCtx && (pageCtx.pageBodyText || pageCtx.pageTitle)) {
				label2 += ' · ' + (R.cfg.i18n.pageContextLoaded || 'Page context loaded');
			}
			$badge.removeClass('is-independent').addClass('is-page-linked').text(label2);
		} else {
			$badge.removeClass('is-page-linked').addClass('is-independent')
				.text(R.cfg.i18n.independentBlock || 'Independent block');
		}
	}

	api.populatePrimaryPage = function(block) {
		block = block || {};
		var $sel = $('#flowbie-agent-hub-field-primary-post');
		if (block.primary_post && block.primary_post.id) {
			api.appendPrimaryPostOption($sel, block.primary_post);
			$sel.val(String(block.primary_post.id));
			api.renderPrimaryPostSummary(block.primary_post);
		} else {
			$sel.val('0');
			api.renderPrimaryPostSummary(null);
		}
		api.updateContextBadge(block);
	}

	api.searchPrimaryPages = function(term) {
		var url = R.cfg.restRoot + 'seo-blocks/page-search?search=' + encodeURIComponent(term || '');
		return api.getJson(url).then(function (res) {
			if (!res.ok || !res.data || !res.data.items) return [];
			return res.data.items;
		});
	}

	api.primaryPostSummaryFromSelect = function() {
		var $sel = $('#flowbie-agent-hub-field-primary-post');
		var id = parseInt($sel.val() || '0', 10) || 0;
		if (id < 1) return null;
		var $opt = $sel.find('option:selected');
		return {
			id: id,
			title: String($opt.text() || '').replace(/\s*\([^)]+\)$/, ''),
			focus_keyword: String($opt.attr('data-focus-keyword') || ''),
			edit_url: String($opt.attr('data-edit-url') || '')
		};
	}

	api.primaryPostSummaryForList = function(block, fallback) {
		block = block || {};
		fallback = fallback || null;
		var summary = block.primary_post || null;
		if (summary && summary.id) return summary;
		var postId = parseInt(block.primary_post_id || '0', 10) || 0;
		if (postId > 0 && fallback && fallback.id === postId) return fallback;
		if (postId > 0) {
			return { id: postId, title: 'Page #' + postId, edit_url: '', focus_keyword: '' };
		}
		return null;
	}

	api.updateListPrimaryPageCell = function(blockId, summary) {
		if (!blockId) return;
		var $row = $('input[name="block_ids[]"][value="' + blockId + '"]').closest('tr');
		if (!$row.length) return;
		var $cell = $row.find('td.column-primary_page');
		if (!$cell.length) return;
		if (!summary || !summary.id) {
			$cell.html('<span class="flowbie-agent-hub__muted">—</span>');
			return;
		}
		var html = api.esc(summary.title || ('Page #' + summary.id));
		if (summary.edit_url) {
			html = '<a href="' + api.esc(summary.edit_url) + '">' + html + '</a>';
		}
		$cell.html(html);
	}

	api.persistPrimaryPostSelection = function(postId, summary) {
		postId = parseInt(postId, 10) || 0;
		summary = summary || null;
		clearTimeout(R.timers.pageSearchTimer);
		R.timers.pageSearchTimer = null;
		var payload = api.collectPayload();
		if (!payload.id || payload.id < 1) {
			api.showToast(R.cfg.i18n.primaryPageSaveFirst || 'Save the block first to link a primary page.', 'info');
			return Promise.resolve();
		}
		if (!payload.title) {
			api.showToast(R.cfg.i18n.titleRequired, 'error');
			return Promise.resolve();
		}
		payload.primary_post_id = postId;
		R.flags.primaryPostSaveInFlight = true;
		return api.rest('seo-blocks', { method: 'POST', body: payload })
			.then(function (data) {
				if (!data || !data.block) return;
				var block = data.block;
				$('#flowbie-agent-hub-field-id').val(block.id || payload.id);
				var display = api.primaryPostSummaryForList(block, summary);
				api.populatePrimaryPage(block);
				api.updateListPrimaryPageCell(block.id, display);
				api.showToast(R.cfg.i18n.primaryPageSaved || 'Primary page saved.', 'success');
			})
			.catch(function (err) { api.notifyError(err); })
			.finally(function () { R.flags.primaryPostSaveInFlight = false; });
	}


})(jQuery);
