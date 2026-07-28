/**
 * Agent Hub — REST blocks CRUD, optimize, bulk.
 */
(function ($) {
	'use strict';

	var R = window.FlowbieAgentHubRuntime;
	var api = R.api;

	api.loadBlock = function (id) {
		id = parseInt(id, 10) || 0;
		if (id < 1) {
			return Promise.resolve();
		}
		if (R.cfg.screen !== 'edit') {
			api.goToEditPage(id);
			return Promise.resolve();
		}
		api.setModalBusy(true);
		return api.rest('seo-blocks/' + id, { method: 'GET' })
			.then(function (data) { api.loadBlockIntoBuilder(data.block || {}); })
			.catch(function (err) { api.notifyError(err); })
			.finally(function () { api.setModalBusy(false); });
	}

	api.saveModal = function(options) {
		options = options || {};
		var closeAfter = !!options.closeAfter;
		var payload = api.collectPayload();
		if (!payload.title) { api.showToast(R.cfg.i18n.titleRequired, 'error'); return Promise.resolve(); }
		api.setModalBusy(true);
		return api.rest('seo-blocks', { method: 'POST', body: payload })
			.then(function (data) {
				if (data && data.block) {
					api.loadBlockIntoBuilder(data.block);
					api.updateListPrimaryPageCell(data.block.id, api.primaryPostSummaryForList(data.block));
				}
				if (closeAfter) {
					api.showToast(R.cfg.i18n.saved, 'success', { duration: 900 });
					setTimeout(function () { api.goToListPage(); }, 700);
				} else {
					api.showToast(R.cfg.i18n.saved, 'success');
				}
			})
			.catch(function (err) { api.notifyError(err); })
			.finally(function () { api.setModalBusy(false); });
	};

	api.resolveOptimizeFields = function(block) {
		block = block || {};
		var topicFocus = String(block.topic_focus || '').trim();
		var focusKeyword = String(block.focus_keyword || '').trim();
		if (!topicFocus) {
			topicFocus = focusKeyword;
		}
		if (!topicFocus) {
			topicFocus = String(block.h2 || '').trim();
		}
		if (!topicFocus) {
			topicFocus = String(block.title || '').trim();
		}
		if (!focusKeyword) {
			focusKeyword = topicFocus;
		}
		return { topic_focus: topicFocus, focus_keyword: focusKeyword };
	}

	api.runOptimizeRequest = function(blockId, fields, apply, postId) {
		postId = postId || 0;
		blockId = parseInt(blockId, 10) || 0;
		return api.ensurePrimaryPageContext(postId, blockId).then(function (ctx) {
			var pageContext = ctx ? api.formatPrimaryPageContextForPrompt(ctx) : '';
			return api.rest('ai/seo-block/preview', { method: 'POST', body: {
				post_id: postId,
				element_id: '',
				block_id: blockId,
				mode: 'full',
				topic_focus: fields.topic_focus,
				focus_keyword: fields.focus_keyword,
				page_context: pageContext
			}}).then(function (preview) {
				if (!apply) return preview;
				return api.rest('ai/seo-block/apply', { method: 'POST', body: {
					post_id: postId,
					element_id: '',
					block_id: blockId,
					preview_slots: preview.preview_slots || [],
					topic_focus: preview.topic_focus || fields.topic_focus,
					focus_keyword: preview.focus_keyword || fields.focus_keyword
				}});
			});
		});
	}

	api.setHubPageBusy = function(on) {
		var hub = document.getElementById('flowbie-agent-hub');
		if (!hub) return;
		hub.classList.toggle('is-busy', !!on);
		hub.setAttribute('aria-busy', on ? 'true' : 'false');
		if (on) {
			hub.setAttribute('data-busy-label', R.cfg.i18n.optimizing || 'Optimizing block…');
		} else {
			hub.removeAttribute('data-busy-label');
		}
	}

	api.optimizeBlockById = function(blockId) {
		if (blockId < 1) return Promise.resolve();
		api.setHubPageBusy(true);
		return api.rest('seo-blocks/' + blockId, { method: 'GET' })
			.then(function (data) {
				var block = data.block || {};
				var fields = api.resolveOptimizeFields(block);
				if (!fields.topic_focus) {
					api.showToast(R.cfg.i18n.topicRequired, 'error');
					return;
				}
				var postId = parseInt(block.primary_post_id || (block.primary_post && block.primary_post.id) || '0', 10) || 0;
				api.showToast(
					postId > 0 ? (R.cfg.i18n.optimizingWithPage || 'Optimizing with linked page context…') :
						(R.cfg.i18n.optimizingIndependent || 'Optimizing as independent block…'),
					'info'
				);
				return api.runOptimizeRequest(blockId, fields, true, postId).then(function () {
					api.toastThenReload(R.cfg.i18n.optimized, 'success');
				});
			})
			.catch(function (err) { api.notifyError(err); })
			.finally(function () { api.setHubPageBusy(false); });
	}

	api.optimizeBlockInModal = function(apply) {
		var payload = api.collectPayload();
		var fields = api.resolveOptimizeFields(payload);
		if (!fields.topic_focus) { api.showToast(R.cfg.i18n.topicRequired, 'error'); return Promise.resolve(); }
		var postId = payload.primary_post_id || 0;
		var blockId = payload.id || 0;
		api.setModalBusy(true);
		return api.ensurePrimaryPageContext(postId, blockId).then(function (ctx) {
			var pageContext = ctx ? api.formatPrimaryPageContextForPrompt(ctx) : '';
			return api.rest('ai/seo-block/preview', { method: 'POST', body: {
				post_id: postId,
				element_id: '',
				block_id: blockId,
				mode: 'full',
				topic_focus: fields.topic_focus,
				focus_keyword: fields.focus_keyword,
				slots: payload.slots,
				page_context: pageContext
			}});
		}).then(function (preview) {
			if (!apply) return preview;
			if (api.applyOptimizedPreviewToBuilder(preview)) {
				api.showToast(R.cfg.i18n.optimized, 'success');
			}
		}).catch(function (err) { api.notifyError(err); })
			.finally(function () { api.setModalBusy(false); });
	}

	api.optimizeBlock = function(blockId, fields, apply) {
		fields = api.resolveOptimizeFields(fields || {});
		if (!fields.topic_focus) { api.showToast(R.cfg.i18n.topicRequired, 'error'); return Promise.resolve(); }
		api.setModalBusy(true);
		var chain = blockId > 0 ? Promise.resolve({ block: { id: blockId } }) :
			api.rest('seo-blocks', { method: 'POST', body: fields }).then(function (d) { return d; });
		return chain.then(function (saved) {
			var id = saved.block && saved.block.id ? saved.block.id : blockId;
			var postId = parseInt(fields.primary_post_id || '0', 10) || 0;
			return api.runOptimizeRequest(id, fields, apply, postId);
		}).then(function () { api.toastThenReload(R.cfg.i18n.optimized, 'success'); })
			.catch(function (err) { api.notifyError(err); })
			.finally(function () { api.setModalBusy(false); });
	}

	api.deleteBlock = function(blockId) {
		if (blockId < 1) return Promise.resolve();
		return api.rest('seo-blocks/' + blockId, { method: 'DELETE' })
			.then(function () { api.toastThenReload(R.cfg.i18n.deleted, 'success'); })
			.catch(function (err) { api.notifyError(err); });
	}

	api.duplicateBlock = function(blockId) {
		if (blockId < 1) return Promise.resolve();
		return api.rest('seo-blocks/' + blockId + '/duplicate', { method: 'POST' })
			.then(function (data) {
				var newId = data.block && data.block.id ? parseInt(data.block.id, 10) : 0;
				api.showToast(R.cfg.i18n.duplicated || 'Block duplicated.', 'success', { duration: 900 });
				if (newId > 0) {
					setTimeout(function () { api.goToEditPage(newId); }, 500);
				}
			})
			.catch(function (err) { api.notifyError(err); });
	}

	api.selectedBlockIds = function() {
		return $('input[name="block_ids[]"]:checked').map(function () {
			return parseInt($(this).val(), 10);
		}).get().filter(function (id) { return id > 0; });
	}

	api.handleBulkAction = function(action) {
		var ids = api.selectedBlockIds();
		if (!ids.length) return;
		if (action === 'bulk_optimize') {
			api.rest('seo-blocks/bulk-optimize', { method: 'POST', body: { ids: ids, mode: 'full', apply: true } })
				.then(function () { api.toastThenReload(R.cfg.i18n.bulkDone, 'success'); })
				.catch(function (err) { api.notifyError(err); });
		} else if (action === 'delete') {
			Promise.all(ids.map(function (id) { return api.rest('seo-blocks/' + id, { method: 'DELETE' }); }))
				.then(function () { api.toastThenReload(R.cfg.i18n.deleted, 'success'); })
				.catch(function (err) { api.notifyError(err); });
		}
	}

	window.FlowbieAgentHubUI = {
		openEdit: api.loadBlock,
		openOptimize: api.optimizeBlockById,
		openDelete: api.deleteBlock,
		openDuplicate: api.duplicateBlock
	};

})(jQuery);
