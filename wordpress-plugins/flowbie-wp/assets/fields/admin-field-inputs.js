(function ($) {
	'use strict';

	$(function () {
		$(document).on('click', '.flowbie-media-select', function (e) {
			e.preventDefault();
			var wrap = $(this).closest('.flowbie-media-field');
			var input = wrap.find('.flowbie-media-id');
			var preview = wrap.find('.flowbie-media-preview, .flowbie-media-filename');
			var frame = wp.media({
				title: 'Select media',
				button: { text: 'Use this media' },
				multiple: false
			});
			frame.on('select', function () {
				var attachment = frame.state().get('selection').first().toJSON();
				input.val(attachment.id);
				if (wrap.data('type') === 'image') {
					preview.html('<img src="' + (attachment.sizes && attachment.sizes.thumbnail ? attachment.sizes.thumbnail.url : attachment.url) + '" alt="" />');
					if (window.flowbieImageSeoField && window.flowbieImageSeoField.renderImageSeoPanel) {
						window.flowbieImageSeoField.renderImageSeoPanel(wrap, attachment.id);
					}
				} else {
					preview.text(attachment.filename || attachment.url);
				}
				if (window.flowbieAcfShim) {
					window.flowbieAcfShim.triggerReady();
				}
			});
			frame.open();
		});

		$(document).on('click', '.flowbie-media-remove', function (e) {
			e.preventDefault();
			var wrap = $(this).closest('.flowbie-media-field');
			wrap.find('.flowbie-media-id').val('');
			wrap.find('.flowbie-media-preview').empty();
			wrap.find('.flowbie-media-filename').empty();
			wrap.find('.flowbie-media-seo-wrap').empty();
		});

		$(document).on('click', '.flowbie-gallery-select', function (e) {
			e.preventDefault();
			var field = $(this).closest('.flowbie-gallery-field');
			var input = field.find('.flowbie-gallery-ids');
			var list = field.find('.flowbie-gallery-preview');
			var postId = parseInt(field.data('post-id'), 10) || parseInt($('#post_ID').val(), 10) || 0;
			var frame = wp.media({ title: 'Gallery', button: { text: 'Add to gallery' }, multiple: true });
			frame.on('select', function () {
				var ids = (input.val() ? input.val().split(',') : []).filter(Boolean);
				frame.state().get('selection').each(function (att) {
					att = att.toJSON();
					var attId = String(att.id);
					if (ids.indexOf(attId) !== -1) {
						return;
					}
					ids.push(attId);
					var $item;
					if (window.flowbieImageSeoField && window.flowbieImageSeoField.renderGalleryItemHtml) {
						$item = $(window.flowbieImageSeoField.renderGalleryItemHtml(att.id));
						list.append($item);
						window.flowbieImageSeoField.hydrateGalleryItem($item, att.id, postId);
					} else {
						list.append('<li class="flowbie-gallery-item" data-id="' + att.id + '"><img src="' + (att.sizes && att.sizes.thumbnail ? att.sizes.thumbnail.url : att.url) + '" alt="" /></li>');
					}
				});
				input.val(ids.join(','));
			});
			frame.open();
		});

		$(document).on('click', '.flowbie-repeater-add', function () {
			var repeater = $(this).closest('.flowbie-repeater');
			var index = repeater.find('.flowbie-repeater-row').length;
			var proto = repeater.data('prototype');
			if (proto) {
				repeater.find('.flowbie-repeater-rows').append(proto.replace(/__INDEX__/g, index));
			}
		});

		$(document).on('click', '.flowbie-repeater-remove', function () {
			$(this).closest('.flowbie-repeater-row').remove();
		});

		function fieldValue($root, selector) {
			var $field = $root.find('.acf-field[data-key="' + selector + '"], .acf-field[data-name="' + selector + '"]').first();
			if (!$field.length) {
				return '';
			}
			var $input = $field.find('input, select, textarea').filter(':not([type="hidden"])').first();
			if (!$input.length) {
				return '';
			}
			if ($input.is(':checkbox')) {
				return $input.is(':checked') ? ($input.val() || '1') : '';
			}
			return $input.val() || '';
		}

		function matchRule(rule, values, keyIndex) {
			var selector = rule.field || '';
			var name = keyIndex[selector] || selector;
			var actual = values[name] !== undefined ? values[name] : values[selector];
			if (actual === undefined || actual === null) {
				actual = '';
			}
			if (Array.isArray(actual)) {
				actual = actual.join(',');
			}
			actual = String(actual);
			var expected = rule.value !== undefined && rule.value !== null ? String(rule.value) : '';
			var op = rule.operator || '==';
			switch (op) {
				case '!=':
					return actual !== expected;
				case '==empty':
					return actual === '';
				case '!=empty':
					return actual !== '';
				case '==contains':
					return actual.indexOf(expected) !== -1;
				default:
					return actual === expected;
			}
		}

		function isFieldVisible(fieldRule, values, keyIndex) {
			var logic = fieldRule.conditional_logic;
			if (!logic || !logic.length) {
				return true;
			}
			var i, g, group, match;
			for (i = 0; i < logic.length; i++) {
				group = logic[i];
				if (!group || !group.length) {
					continue;
				}
				match = true;
				for (g = 0; g < group.length; g++) {
					if (!matchRule(group[g], values, keyIndex)) {
						match = false;
						break;
					}
				}
				if (match) {
					return true;
				}
			}
			return false;
		}

		function collectValues($root) {
			var values = {};
			var keyIndex = {};
			$root.find('.acf-field').each(function () {
				var $f = $(this);
				var name = $f.data('name');
				var key = $f.data('key');
				if (key && name) {
					keyIndex[key] = name;
				}
				if (name) {
					values[name] = fieldValue($root, key || name);
				}
			});
			return { values: values, keyIndex: keyIndex };
		}

		function applyConditionalLogic($root) {
			var raw = $root.attr('data-flowbie-conditional-rules');
			if (!raw) {
				return;
			}
			var rules;
			try {
				rules = JSON.parse(raw);
			} catch (e) {
				return;
			}
			if (!rules || !rules.length) {
				return;
			}
			var ctx = collectValues($root);
			var i, rule, $field, $wrap, visible;
			for (i = 0; i < rules.length; i++) {
				rule = rules[i];
				visible = isFieldVisible(rule, ctx.values, ctx.keyIndex);
				$field = $root.find('.acf-field[data-name="' + rule.name + '"]');
				$wrap = $field.closest('.flowbie-conditional-hidden-wrap');
				if ($wrap.length) {
					if (visible) {
						$wrap.show();
					} else {
						$wrap.hide();
					}
				} else if ($field.length) {
					if (visible) {
						$field.show();
					} else {
						$field.hide();
					}
				}
			}
		}

		function initConditionalLogic() {
			$('.flowbie-fields-root[data-flowbie-conditional-rules]').each(function () {
				applyConditionalLogic($(this));
			});
		}

		$(document).on('change input', '.flowbie-fields-root .acf-field input, .flowbie-fields-root .acf-field select, .flowbie-fields-root .acf-field textarea', function () {
			var $root = $(this).closest('.flowbie-fields-root[data-flowbie-conditional-rules]');
			if ($root.length) {
				applyConditionalLogic($root);
			}
		});

		initConditionalLogic();
		if (window.flowbieAcfShim) {
			window.flowbieAcfShim.triggerReady();
		}
		$(document).on('flowbie-fields-ready', initConditionalLogic);
	});
})(jQuery);
