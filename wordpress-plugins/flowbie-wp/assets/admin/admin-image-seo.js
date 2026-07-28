(function ($) {
	'use strict';

	var cfg = window.flowbieWpImageSeo || {};

	function api(path, options) {
		var url = (cfg.root || '').replace(/\/$/, '') + path;
		var headers = {
			'Content-Type': 'application/json',
			'X-WP-Nonce': cfg.nonce || ''
		};
		return fetch(url, $.extend({ headers: headers, credentials: 'same-origin' }, options || {})).then(function (res) {
			return res.json().then(function (body) {
				if (!res.ok) {
					var err = new Error((body && body.error) || res.statusText || 'Request failed');
					err.body = body;
					throw err;
				}
				return body;
			});
		});
	}

	function str(key, fallback) {
		return (cfg.strings && cfg.strings[key]) || fallback;
	}

	function optimizeRow(attachmentId, $link) {
		var label = $link.text();
		$link.text(str('optimizing', 'Optimizing…'));
		api('/preview', {
			method: 'POST',
			body: JSON.stringify({ attachment_id: attachmentId, use_ai: true })
		})
			.then(function (data) {
				return api('/apply', {
					method: 'POST',
					body: JSON.stringify({
						attachment_id: attachmentId,
						values: data.proposed || {},
						use_ai: false
					})
				});
			})
			.then(function () {
				window.location.reload();
			})
			.catch(function () {
				window.alert(str('error', 'Optimization failed.'));
			})
			.finally(function () {
				$link.text(label);
			});
	}

	function saveInlineFields() {
		var fields = $('.flowbie-image-seo-inline-field');
		if (!fields.length) {
			return;
		}
		var byId = {};
		fields.each(function () {
			var $el = $(this);
			var id = $el.data('id');
			var field = $el.data('field');
			if (!byId[id]) {
				byId[id] = { attachment_id: id };
			}
			byId[id][field] = $el.val();
		});
		var promises = Object.keys(byId).map(function (id) {
			return api('/save', { method: 'POST', body: JSON.stringify(byId[id]) });
		});
		Promise.all(promises)
			.then(function () {
				window.alert(str('saved', 'Changes saved.'));
				window.location.reload();
			})
			.catch(function () {
				window.alert(str('error', 'Optimization failed.'));
			});
	}

	$(function () {
		$(document).on('click', '.flowbie-image-seo-row-optimize', function (e) {
			e.preventDefault();
			optimizeRow(parseInt($(this).data('id'), 10), $(this));
		});

		$('.flowbie-image-seo-save-inline').on('click', saveInlineFields);
	});
})(jQuery);
