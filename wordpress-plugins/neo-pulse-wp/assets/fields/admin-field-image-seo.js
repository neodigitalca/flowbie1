(function ($) {
	'use strict';

	var cfg = window.neoPulseWpImageSeoField || {};
	var statusCache = null;

	function api(path, options) {
		var url = (cfg.root || '').replace(/\/$/, '') + path;
		var headers = {
			'Content-Type': 'application/json',
			'X-WP-Nonce': cfg.nonce || ''
		};
		return fetch(url, $.extend({ headers: headers, credentials: 'same-origin' }, options || {})).then(function (res) {
			return res.json().then(function (body) {
				if (!res.ok) {
					throw new Error((body && body.error) || res.statusText || 'Request failed');
				}
				return body;
			});
		});
	}

	function getPostId($scope) {
		var postId = parseInt($scope.closest('[data-post-id]').data('post-id'), 10);
		if (!postId) {
			postId = parseInt($('#post_ID').val(), 10) || 0;
		}
		return postId;
	}

	function panelValues($panel) {
		var values = {};
		$panel.find('.neo-pulse-image-seo-input').each(function () {
			var $input = $(this);
			values[$input.data('field')] = $input.val();
		});
		return values;
	}

	function fillPanel($panel, values, overwriteMode) {
		$panel.find('.neo-pulse-image-seo-input').each(function () {
			var $input = $(this);
			var field = $input.data('field');
			if (!values || values[field] === undefined || values[field] === '') {
				return;
			}
			if (overwriteMode === 'overwrite_all' || !$input.val()) {
				$input.val(values[field]);
			}
		});
	}

	function loadStatus() {
		if (statusCache) {
			return Promise.resolve(statusCache);
		}
		return api('/status').then(function (data) {
			statusCache = data;
			return data;
		});
	}

	function fetchAttachmentRow(id) {
		return api('/attachment/' + id).then(function (data) {
			return data.row || {};
		});
	}

	function populatePanelFromRow($panel, row) {
		fillPanel($panel, row, 'overwrite_all');
	}

	function savePanel($panel) {
		var attachmentId = parseInt($panel.data('attachment-id'), 10);
		var values = panelValues($panel);
		values.attachment_id = attachmentId;
		return api('/save', { method: 'POST', body: JSON.stringify(values) });
	}

	function previewPanel($panel, useAi, fieldFilter) {
		var attachmentId = parseInt($panel.data('attachment-id'), 10);
		var postId = getPostId($panel);
		var payload = {
			attachment_id: attachmentId,
			post_id: postId,
			use_ai: useAi !== false
		};
		if (fieldFilter) {
			payload.fields = {
				title: fieldFilter === 'title',
				alt: fieldFilter === 'alt',
				caption: fieldFilter === 'caption',
				description: fieldFilter === 'description'
			};
		}
		return api('/preview', { method: 'POST', body: JSON.stringify(payload) }).then(function (data) {
			var overwrite = (statusCache && statusCache.config && statusCache.config.overwrite_mode) || 'missing_only';
			var values = data.merged || data.proposed || {};
			if (fieldFilter) {
				var single = {};
				if (values[fieldFilter] !== undefined) {
					single[fieldFilter] = values[fieldFilter];
				}
				fillPanel($panel, single, overwrite);
			} else {
				fillPanel($panel, values, overwrite);
			}
			return data;
		});
	}

	function autoOptimizeAttachment(attachmentId, postId) {
		return loadStatus().then(function (status) {
			if (!status.config || !status.config.auto_in_gallery) {
				return null;
			}
			var useAi = status.config.auto_mode === 'ai' && status.openRouterConfigured;
			return api('/preview', {
				method: 'POST',
				body: JSON.stringify({
					attachment_id: attachmentId,
					post_id: postId,
					use_ai: useAi
				})
			}).then(function (data) {
				return api('/apply', {
					method: 'POST',
					body: JSON.stringify({
						attachment_id: attachmentId,
						values: data.proposed || {},
						post_id: postId
					})
				});
			});
		});
	}

	function buildPanelHtml(attachmentId) {
		var fields = [
			{ key: 'title', label: 'Title', type: 'text' },
			{ key: 'alt', label: 'Alt text', type: 'text' },
			{ key: 'caption', label: 'Caption', type: 'textarea' },
			{ key: 'description', label: 'Description', type: 'textarea' }
		];
		var html = '<div class="neo-pulse-image-seo-panel" data-attachment-id="' + attachmentId + '" data-context="gallery">';
		fields.forEach(function (f) {
			html += '<div class="neo-pulse-image-seo-field neo-pulse-image-seo-field--' + f.key + '">';
			html += '<label>' + f.label + '</label><div class="neo-pulse-image-seo-field__row">';
			if (f.type === 'textarea') {
				html += '<textarea class="neo-pulse-image-seo-input" data-field="' + f.key + '" rows="2"></textarea>';
			} else {
				html += '<input type="text" class="neo-pulse-image-seo-input" data-field="' + f.key + '" value="" />';
			}
			html += '<button type="button" class="button neo-pulse-image-seo-wand" data-field="' + f.key + '" title="Optimize" aria-label="Optimize">✦</button>';
			html += '</div></div>';
		});
		html += '<button type="button" class="button neo-pulse-image-seo-optimize-all">Optimize all</button>';
		html += '<button type="button" class="button neo-pulse-image-seo-save">Save metadata</button></div>';
		return html;
	}

	window.neoPulseImageSeoField = {
		renderGalleryItemHtml: function (attachmentId) {
			return '<li class="neo-pulse-gallery-item" data-id="' + attachmentId + '"><div class="neo-pulse-gallery-item__loading">Loading…</div></li>';
		},
		hydrateGalleryItem: function ($item, attachmentId, postId) {
			fetchAttachmentRow(attachmentId).then(function (row) {
				var thumb = row.thumbUrl ? '<img src="' + row.thumbUrl + '" alt="" />' : '';
				var html = '<div class="neo-pulse-gallery-item__thumb">' + thumb +
					'<button type="button" class="neo-pulse-gallery-item__remove" aria-label="Remove">&times;</button></div>';
				html += buildPanelHtml(attachmentId);
				$item.html(html);
				var $panel = $item.find('.neo-pulse-image-seo-panel');
				populatePanelFromRow($panel, row);
				loadStatus().then(function () {
					return autoOptimizeAttachment(attachmentId, postId);
				}).then(function () {
					return fetchAttachmentRow(attachmentId);
				}).then(function (updated) {
					populatePanelFromRow($panel, updated);
				});
			});
		},
		renderImageSeoPanel: function ($wrap, attachmentId) {
			var $seo = $wrap.find('.neo-pulse-media-seo-wrap');
			$seo.empty();
			if (!attachmentId) {
				return;
			}
			$seo.html(buildPanelHtml(attachmentId));
			fetchAttachmentRow(attachmentId).then(function (row) {
				var $panel = $seo.find('.neo-pulse-image-seo-panel');
				populatePanelFromRow($panel, row);
			});
		}
	};

	$(function () {
		loadStatus();

		$(document).on('click', '.neo-pulse-image-seo-wand', function () {
			var $btn = $(this);
			var field = $btn.data('field');
			var $panel = $btn.closest('.neo-pulse-image-seo-panel');
			$btn.prop('disabled', true);
			previewPanel($panel, true, field).finally(function () {
				$btn.prop('disabled', false);
			});
		});

		$(document).on('click', '.neo-pulse-image-seo-optimize-all', function () {
			var $btn = $(this);
			var $panel = $btn.closest('.neo-pulse-image-seo-panel');
			$btn.prop('disabled', true);
			previewPanel($panel, true).finally(function () {
				$btn.prop('disabled', false);
			});
		});

		$(document).on('click', '.neo-pulse-image-seo-save', function () {
			var $btn = $(this);
			var $panel = $btn.closest('.neo-pulse-image-seo-panel');
			$btn.prop('disabled', true);
			savePanel($panel)
				.then(function () {
					$btn.text(cfg.savedLabel || 'Saved');
					setTimeout(function () {
						$btn.text(cfg.saveLabel || 'Save metadata');
					}, 1500);
				})
				.finally(function () {
					$btn.prop('disabled', false);
				});
		});

		$(document).on('click', '.neo-pulse-gallery-item__remove', function (e) {
			e.preventDefault();
			var $item = $(this).closest('.neo-pulse-gallery-item');
			var $field = $item.closest('.neo-pulse-gallery-field');
			var id = String($item.data('id'));
			var ids = ($field.find('.neo-pulse-gallery-ids').val() || '').split(',').filter(Boolean);
			ids = ids.filter(function (x) {
				return x !== id;
			});
			$field.find('.neo-pulse-gallery-ids').val(ids.join(','));
			$item.remove();
		});
	});
})(jQuery);
