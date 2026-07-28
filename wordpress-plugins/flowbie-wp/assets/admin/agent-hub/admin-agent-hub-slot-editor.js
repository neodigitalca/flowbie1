/**
 * Agent Hub — slot editor, WYSIWYG, layout chips.
 */
(function ($) {
	'use strict';

	var R = window.FlowbieAgentHubRuntime;
	var api = R.api;

	api.syncH2FromSlots = function() {
		R.builder.slots.forEach(function (slot) {
			if (slot.type === 'h2' && slot.text) {
				$('#flowbie-agent-hub-field-h2').val(slot.text);
			}
		});
	};

	api.syncWysiwygEditorsToSlots = function() {
		if (!api.isSlotEditorOpen()) return;
		$('.flowbie-block-editor-view .flowbie-slot-wysiwyg').each(function () {
			var id = this.id;
			var slot = api.getSlotById($(this).data('slot-id'));
			if (!slot) return;
			var content = '';
			if (window.tinyMCE && tinyMCE.get(id) && !tinyMCE.get(id).isHidden()) {
				content = tinyMCE.get(id).getContent();
			} else {
				content = $(this).val() || '';
			}
			slot.html = content;
		});
	};

	api.wysiwygEditorId = function(slot) {
		return 'flowbie-slot-wysiwyg-' + slot._id;
	}

	api.listHtmlFromSlot = function(slot) {
		if (slot.html) return slot.html;
		var items = slot.items || [];
		if (!items.length) return '';
		var tag = slot.style === 'number' ? 'ol' : 'ul';
		return '<' + tag + '>' + items.map(function (item) {
			return '<li>' + api.esc(item) + '</li>';
		}).join('') + '</' + tag + '>';
	}

	api.wysiwygFieldHtml = function(slot) {
		var editorId = api.wysiwygEditorId(slot);
		var content = slot.type === 'list' ? api.listHtmlFromSlot(slot) : (slot.html || '');
		return '<div class="flowbie-builder-slot__editor">' +
			'<textarea id="' + api.esc(editorId) + '" class="flowbie-slot-wysiwyg" data-slot-id="' + api.esc(slot._id) + '" rows="8">' + api.esc(content) + '</textarea>' +
			'</div>';
	}

	api.destroyWysiwygEditors = function() {
		if (!window.wp || !wp.editor) return;
		$(window).off('resize.flowbieSlotEditor');
		$('.flowbie-slot-wysiwyg').each(function () {
			var id = this.id;
			if (id && wp.editor.remove) {
				try { wp.editor.remove(id); } catch (e) { /* editor may already be gone */ }
			}
		});
	}

	api.layoutSlotEditorToolbar = function() {
		var $wrap = $('#flowbie-slot-editor-form .wp-editor-wrap').first();
		if (!$wrap.length) return;

		// Restore any legacy DOM moves from older builds (moving TinyMCE nodes breaks the toolbar).
		$wrap.find('.flowbie-slot-editor-toolbar-row').each(function () {
			var $row = $(this);
			var $tabs = $row.find('.wp-editor-tabs').first();
			var $toolbar = $row.find('.mce-toolbar-grp').first();
			if ($tabs.length) {
				var $tools = $wrap.children('.wp-editor-tools').first();
				if (!$tools.length) {
					$tools = $('<div class="wp-editor-tools hide-if-no-js"></div>').prependTo($wrap);
				}
				$tools.append($tabs);
			}
			if ($toolbar.length) {
				var $body = $wrap.find('.mce-container-body').first();
				if ($body.length) {
					$body.prepend($toolbar);
				} else {
					$wrap.find('.wp-editor-container').first().prepend($toolbar);
				}
			}
			$row.remove();
		});

		var $tools = $wrap.children('.wp-editor-tools').first();
		if (!$tools.length) return;
		$tools.removeClass('flowbie-slot-editor-tools--empty');
		var hasTabs = $tools.find('.wp-editor-tabs').length > 0;
		var hasMedia = $tools.find('.wp-media-buttons').children().length > 0;
		if (!hasTabs && !hasMedia) {
			$tools.addClass('flowbie-slot-editor-tools--empty');
		}
	}

	api.measureWysiwygChromeHeight = function($wrap) {
		var toolbarH = 0;
		if (!$wrap || !$wrap.length) return 44;
		toolbarH += $wrap.find('.mce-toolbar-grp').outerHeight(true) || 0;
		toolbarH += $wrap.children('.wp-editor-tools').outerHeight(true) || 0;
		toolbarH += $wrap.find('.quicktags-toolbar').outerHeight(true) || 0;
		return toolbarH < 40 ? 44 : toolbarH;
	}

	api.computeSlotEditorWysiwygHeight = function() {
		var $editor = $('#flowbie-slot-editor-form .flowbie-slot-editor-field--editor .flowbie-builder-slot__editor').first();
		var $wrap = $('#flowbie-slot-editor-form .wp-editor-wrap').first();
		var editorH = $editor.innerHeight() || 0;
		if (editorH < 120) {
			var $formWrap = $('.flowbie-block-editor-view__form-wrap');
			var $appear = $('#flowbie-slot-editor-form .flowbie-slot-editor-section--appearance');
			var $header = $('.flowbie-block-editor-view__header');
			editorH = Math.max(
				280,
				($formWrap.innerHeight() || 400) - ($appear.outerHeight(true) || 120) - ($header.outerHeight(true) || 48) - 24
			);
		}
		return Math.max(200, editorH - api.measureWysiwygChromeHeight($wrap));
	}

	api.resizeSlotEditorWysiwyg = function() {
		if (!api.isSlotEditorOpen() || !R.builder.activeSlotId) return;
		var slot = api.getSlotById(R.builder.activeSlotId);
		if (!slot || (slot.type !== 'paragraph' && slot.type !== 'list')) return;
		var id = api.wysiwygEditorId(slot);
		var $wrap = $('#' + id).closest('.wp-editor-wrap');
		if (!$wrap.length) return;
		var height = api.computeSlotEditorWysiwygHeight();
		$wrap.find('.mce-edit-area').css({ flex: '1 1 auto', minHeight: 0, height: height, width: '100%' });
		$wrap.find('.mce-edit-area iframe').css({ width: '100%', height: height, minHeight: height });
		$('#' + id).css({ minHeight: height, height: height });
		if (window.tinyMCE) {
			var editor = tinyMCE.get(id);
			if (editor && editor.theme && typeof editor.theme.resizeTo === 'function') {
				editor.theme.resizeTo(null, height);
			}
		}
	}

	api.finalizeSlotEditorWysiwyg = function () {
		clearTimeout(R.timers.slotEditorFinalizeTimer);
		R.timers.slotEditorFinalizeTimer = setTimeout(function () {
			api.layoutSlotEditorToolbar();
			api.resizeSlotEditorWysiwyg();
		}, 60);
	}

	api.bindSlotEditorResize = function () {
		$(window).off('resize.flowbieSlotEditor').on('resize.flowbieSlotEditor', function () {
			clearTimeout(R.timers.slotEditorResizeTimer);
			R.timers.slotEditorResizeTimer = setTimeout(api.finalizeSlotEditorWysiwyg, 80);
		});
	}

	api.initWysiwygEditors = function() {
		if (!window.wp || !wp.editor || !wp.editor.initialize || !api.isSlotEditorOpen() || !R.builder.activeSlotId) return;
		var toolbars = R.cfg.wysiwygToolbar || {};
		var slot = api.getSlotById(R.builder.activeSlotId);
		if (!slot || (slot.type !== 'paragraph' && slot.type !== 'list')) return;
		var id = api.wysiwygEditorId(slot);
		var $textarea = $('#' + id);
		if (!$textarea.length) return;
		var isList = slot.type === 'list';
		var slotId = slot._id;
		var editorHeight = api.computeSlotEditorWysiwygHeight();
		var settings = {
			tinymce: {
				wpautop: !isList,
				height: editorHeight,
				resize: false,
				statusbar: false,
				body_class: 'flowbie-slot-editor-tinymce-body',
				content_style: 'body.flowbie-slot-editor-tinymce-body, body { background: #2a2a2a !important; color: #ffffff !important; font-family: Lato, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif !important; font-size: 16px !important; line-height: 1.45 !important; margin: 12px !important; } p, li, h1, h2, h3, h4 { color: #ffffff !important; }',
				toolbar1: toolbars[slot.type] || (isList ? 'bullist,numlist,link,undo,redo' : 'formatselect,bold,italic,link,bullist,numlist,blockquote,undo,redo'),
				toolbar2: '',
				setup: function (editor) {
					editor.on('change input undo redo', function () {
						var s = api.getSlotById(slotId);
						if (s) {
							s.html = editor.getContent();
							api.schedulePreview();
						}
					});
					editor.on('init', function () {
						setTimeout(api.finalizeSlotEditorWysiwyg, 0);
					});
				}
			},
			quicktags: true,
			mediaButtons: false
		};
		wp.editor.initialize(id, settings);
		api.bindSlotEditorResize();
		api.finalizeSlotEditorWysiwyg();
	}

	api.slotInputClass = function(extra) {
		return 'flowbie-builder-slot__input flowbie-slot-input flowbie-semantic-control' + (extra ? ' ' + extra : '');
	}

	api.slotFieldSelectHtml = function(slot, field, options, label) {
		var val = String(slot[field] != null ? slot[field] : (options[0] && options[0].value) || '');
		return '<div class="flowbie-slot-editor-field">' +
			'<label class="flowbie-slot-editor-field__label">' + api.esc(label) + '</label>' +
			'<select class="flowbie-builder-slot__ctl flowbie-slot-input" data-field="' + api.esc(field) + '" data-slot-id="' + api.esc(slot._id) + '" aria-label="' + api.esc(label) + '">' +
			options.map(function (opt) {
				return '<option value="' + api.esc(opt.value) + '"' + (val === String(opt.value) ? ' selected' : '') + '>' + api.esc(opt.label) + '</option>';
			}).join('') + '</select></div>';
	}

	api.renderSlotEditorTypes = function(slot) {
		var types = R.cfg.slotTypes || {};
		var i18n = R.cfg.i18n || {};
		var html = '<p class="flowbie-block-editor-view__types-label">' + api.esc(i18n.blockType || 'Block type') + '</p><div class="flowbie-slot-editor-types__grid">';
		Object.keys(types).forEach(function (k) {
			var active = slot.type === k ? ' is-active' : '';
			html += '<button type="button" class="flowbie-slot-editor-type' + active + '" data-slot-type="' + api.esc(k) + '" data-slot-id="' + api.esc(slot._id) + '" aria-pressed="' + (slot.type === k ? 'true' : 'false') + '">' +
				api.esc(types[k]) + '</button>';
		});
		html += '</div>';
		$('#flowbie-slot-editor-types').html(html);
	}

	api.renderSlotEditorForm = function(slot) {
		var i18n = R.cfg.i18n || {};
		var sid = api.esc(slot._id);
		var appearance = api.slotFieldSelectHtml(slot, 'align_h', [
			{ value: 'left', label: i18n.alignH_left || 'Left' },
			{ value: 'center', label: i18n.alignH_center || 'Center' },
			{ value: 'right', label: i18n.alignH_right || 'Right' }
		], i18n.horizontalAlign || 'Horizontal align') +
		api.slotFieldSelectHtml(slot, 'align_v', [
			{ value: 'top', label: i18n.alignV_top || 'Top' },
			{ value: 'middle', label: i18n.alignV_middle || 'Middle' },
			{ value: 'bottom', label: i18n.alignV_bottom || 'Bottom' }
		], i18n.verticalAlign || 'Vertical align');

		var content = '';
		switch (slot.type) {
			case 'h2':
				content = api.slotFieldSelectHtml(slot, 'heading_level', [1, 2, 3, 4, 5, 6].map(function (n) {
					return { value: String(n), label: 'H' + n };
				}), i18n.headingLevel || 'Heading level') +
				'<div class="flowbie-slot-editor-field">' +
				'<label class="flowbie-slot-editor-field__label" for="flowbie-slot-field-text-' + sid + '">' + api.esc(i18n.headingPlaceholder || 'Heading text') + '</label>' +
				'<input type="text" id="flowbie-slot-field-text-' + sid + '" class="' + api.slotInputClass() + '" data-field="text" data-slot-id="' + sid + '" value="' + api.esc(slot.text || '') + '" placeholder="' + api.esc(i18n.headingPlaceholder || 'Heading text') + '" /></div>';
				break;
			case 'paragraph':
				content = '<div class="flowbie-slot-editor-field flowbie-slot-editor-field--editor">' + api.wysiwygFieldHtml(slot) + '</div>';
				break;
			case 'cta':
				content = api.slotFieldSelectHtml(slot, 'style', [
					{ value: 'primary', label: 'Primary' },
					{ value: 'secondary', label: 'Secondary' },
					{ value: 'outline', label: 'Outline' }
				], i18n.ctaStyle || 'Button style') +
				'<div class="flowbie-slot-editor-field">' +
				'<label class="flowbie-slot-editor-field__label" for="flowbie-slot-field-label-' + sid + '">' + api.esc(i18n.ctaLabelPlaceholder || 'Button label') + '</label>' +
				'<input type="text" id="flowbie-slot-field-label-' + sid + '" class="' + api.slotInputClass() + '" data-field="label" data-slot-id="' + sid + '" value="' + api.esc(slot.label || '') + '" /></div>' +
				'<div class="flowbie-slot-editor-field">' +
				'<label class="flowbie-slot-editor-field__label" for="flowbie-slot-field-url-' + sid + '">' + api.esc(i18n.ctaUrlPlaceholder || 'Link URL') + '</label>' +
				'<input type="url" id="flowbie-slot-field-url-' + sid + '" class="' + api.slotInputClass() + '" data-field="url" data-slot-id="' + sid + '" value="' + api.esc(slot.url || '') + '" /></div>';
				break;
			case 'image':
				var thumb = slot.attachment_url ? '<img src="' + api.esc(slot.attachment_url) + '" alt="" class="flowbie-builder-slot__thumb" />' : '';
				content = '<div class="flowbie-slot-editor-field flowbie-slot-editor-field--media">' +
				'<div class="flowbie-builder-slot__media">' + thumb +
				'<div class="flowbie-builder-slot__media-actions">' +
				'<button type="button" class="flowbie-slot-editor-btn flowbie-slot-pick-image" data-slot-id="' + sid + '">' + api.esc(i18n.pickImage || 'Select image') + '</button>' +
				(slot.attachment_id ? '<button type="button" class="flowbie-slot-editor-btn flowbie-slot-clear-image" data-slot-id="' + sid + '">' + api.esc(i18n.removeImage || 'Remove') + '</button>' : '') +
				'</div></div></div>' +
				'<div class="flowbie-slot-editor-field">' +
				'<label class="flowbie-slot-editor-field__label" for="flowbie-slot-field-alt-' + sid + '">' + api.esc(i18n.altPlaceholder || 'Alt text') + '</label>' +
				'<input type="text" id="flowbie-slot-field-alt-' + sid + '" class="' + api.slotInputClass() + '" data-field="alt" data-slot-id="' + sid + '" value="' + api.esc(slot.alt || '') + '" /></div>';
				break;
			case 'list':
				content = api.slotFieldSelectHtml(slot, 'style', [
					{ value: 'bullet', label: i18n.listBulleted || 'Bulleted' },
					{ value: 'number', label: i18n.listNumbered || 'Numbered' }
				], i18n.listStyle || 'List style') +
				'<div class="flowbie-slot-editor-field flowbie-slot-editor-field--editor">' + api.wysiwygFieldHtml(slot) +
				'<p class="flowbie-builder-slot__hint">' + api.esc(i18n.listHint || 'Use the toolbar for bulleted or numbered lists.') + '</p></div>';
				break;
		}

		var html = '<section class="flowbie-slot-editor-section flowbie-slot-editor-section--content" aria-labelledby="flowbie-slot-editor-content-title">' +
			'<h3 id="flowbie-slot-editor-content-title" class="flowbie-slot-editor-section__title">' + api.esc(i18n.contentSection || 'Content') + '</h3>' +
			'<div class="flowbie-slot-editor-content-pane">' + content + '</div></section>' +
			'<section class="flowbie-slot-editor-section flowbie-slot-editor-section--appearance" aria-labelledby="flowbie-slot-editor-appearance-title">' +
			'<h3 id="flowbie-slot-editor-appearance-title" class="flowbie-slot-editor-section__title">' + api.esc(i18n.appearanceSection || 'Appearance') + '</h3>' +
			appearance + '</section>';
		$('#flowbie-slot-editor-form').html(html);
	}

	api.refreshSlotEditorIfOpen = function(slotId) {
		if (!api.isSlotEditorOpen() || R.builder.activeSlotId !== slotId) return;
		var slot = api.getSlotById(slotId);
		if (!slot) { api.closeSlotEditor(); return; }
		api.syncWysiwygEditorsToSlots();
		api.destroyWysiwygEditors();
		api.renderSlotEditorTypes(slot);
		api.renderSlotEditorForm(slot);
		api.initWysiwygEditors();
	}

	api.openSlotEditor = function(slotId) {
		var slot = api.getSlotById(slotId);
		if (!slot) return;
		if (!api.ensureSlotEditorShell()) {
			api.notifyError(R.cfg.i18n.slotEditorUnavailable || 'Block editor could not load. Refresh the page and try again.');
			return;
		}
		if (api.isSlotEditorOpen() && R.builder.activeSlotId !== slotId) {
			api.syncWysiwygEditorsToSlots();
			api.destroyWysiwygEditors();
		}
		R.builder.activeSlotId = slotId;
		var types = R.cfg.slotTypes || {};
		var typeLabel = types[slot.type] || slot.type;
		$('#flowbie-slot-editor-title').text((R.cfg.i18n.blockEditor || 'Block editor') + ': ' + typeLabel);
		var placement = api.slotPlacementLabel(slotId);
		var $place = $('#flowbie-slot-editor-placement');
		if (placement) {
			$place.text(placement).prop('hidden', false);
		} else {
			$place.prop('hidden', true).text('');
		}
		api.renderSlotEditorTypes(slot);
		api.renderSlotEditorForm(slot);
		api.switchTab('layout');
		api.showBlockEditorView();
		api.initWysiwygEditors();
		api.finalizeSlotEditorWysiwyg();
	}

	api.closeSlotEditor = function() {
		if (!R.builder.activeSlotId && (!R.dom.$blockEditorView || !R.dom.$blockEditorView.hasClass('is-active'))) {
			R.builder.activeSlotId = null;
			api.showLayoutView();
			return;
		}
		api.syncWysiwygEditorsToSlots();
		api.destroyWysiwygEditors();
		R.builder.activeSlotId = null;
		api.showLayoutView();
	}

	api.commitSlotEditor = function() {
		if (!R.builder.activeSlotId && (!R.dom.$blockEditorView || !R.dom.$blockEditorView.hasClass('is-active'))) {
			return;
		}
		api.syncWysiwygEditorsToSlots();
		api.destroyWysiwygEditors();
		R.builder.activeSlotId = null;
		api.showLayoutView();
		api.renderLayout();
		api.schedulePreview();
	}

	api.applySlotTypeChange = function(slotId, newType) {
		var i = api.getSlotIndex(slotId);
		if (i < 0) return;
		var prev = R.builder.slots[i] || {};
		R.builder.slots[i] = {
			_id: prev._id,
			type: newType,
			align_h: prev.align_h || 'left',
			align_v: prev.align_v || 'middle'
		};
		if (newType === 'h2') {
			R.builder.slots[i].text = prev.type === 'h2' ? (prev.text || '') : '';
			R.builder.slots[i].heading_level = prev.heading_level || 2;
		}
		if (newType === 'list') {
			R.builder.slots[i].style = prev.style || 'bullet';
			R.builder.slots[i].html = prev.html || api.listHtmlFromSlot(prev);
		}
		if (newType === 'paragraph') {
			R.builder.slots[i].html = prev.html || '';
		}
		if (newType === 'cta') {
			R.builder.slots[i].label = prev.label || '';
			R.builder.slots[i].url = prev.url || '';
			R.builder.slots[i].style = prev.style || 'primary';
		}
		if (newType === 'image') {
			R.builder.slots[i].attachment_id = prev.attachment_id;
			R.builder.slots[i].attachment_url = prev.attachment_url;
			R.builder.slots[i].alt = prev.alt || '';
		}
		api.refreshSlotEditorIfOpen(slotId);
		api.schedulePreview();
	}

	api.removeActiveSlot = function() {
		if (!R.builder.activeSlotId) return;
		var i = api.getSlotIndex(R.builder.activeSlotId);
		if (i < 0) return;
		if (!window.confirm(R.cfg.i18n.confirmDeleteSlot || 'Remove this block?')) return;
		R.builder.slots.splice(i, 1);
		api.syncLayoutWithSlots();
		api.closeSlotEditor();
		api.renderLayout();
		api.schedulePreview();
	}


})(jQuery);
