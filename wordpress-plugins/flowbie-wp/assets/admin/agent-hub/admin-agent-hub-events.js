/**
 * Agent Hub — delegated slot editor events.
 */
(function ($) {
	'use strict';

	var R = window.FlowbieAgentHubRuntime;
	var api = R.api;

	R.flags.slotEditorEventsBound = false;

	api.bindSlotEditorEvents = function () {
		if (R.flags.slotEditorEventsBound) {
			return;
		}
		R.flags.slotEditorEventsBound = true;

		$(document).on('click.flowbieSlotEditor', '#flowbie-builder-add-slot', function (e) {
			e.preventDefault();
			e.stopPropagation();
			api.addBlockFromToolbar();
		});

		$(document).on('click.flowbieSlotEditor', '#flowbie-slot-editor-done', function (e) {
			e.preventDefault();
			api.commitSlotEditor();
		});

		$(document).on('click.flowbieSlotEditor', '#flowbie-slot-editor-remove', function (e) {
			e.preventDefault();
			api.removeActiveSlot();
		});

		$(document).on('click.flowbieSlotEditor', '#flowbie-block-editor-back, .flowbie-slot-editor-cancel', function (e) {
			e.preventDefault();
			api.commitSlotEditor();
		});

		$(document).on('click.flowbieSlotEditor', '.flowbie-block-editor-view .flowbie-slot-editor-type', function () {
			var slotId = $(this).data('slot-id');
			var newType = $(this).data('slot-type');
			if (!slotId || !newType) {
				return;
			}
			api.applySlotTypeChange(slotId, newType);
		});

		$(document).on('input change.flowbieSlotEditor', '.flowbie-block-editor-view .flowbie-slot-input', function () {
			var slotId = $(this).data('slot-id');
			var slot = api.getSlotById(slotId);
			if (!slot) {
				return;
			}
			var field = $(this).data('field');
			var val = $(this).val();
			if (field === 'heading_level') {
				slot[field] = Math.min(6, Math.max(1, parseInt(val, 10) || 2));
			} else if (field === 'style' && slot.type === 'list') {
				slot.style = val;
			} else {
				slot[field] = val;
			}
			if (field === 'text' && slot.type === 'h2') {
				$('#flowbie-agent-hub-field-h2').val(val);
			}
			api.schedulePreview();
		});

		$(document).on('input change.flowbieSlotEditor', '.flowbie-block-editor-view .flowbie-slot-wysiwyg', function () {
			if (window.tinyMCE && tinyMCE.get(this.id) && !tinyMCE.get(this.id).isHidden()) {
				return;
			}
			var slot = api.getSlotById($(this).data('slot-id'));
			if (slot) {
				slot.html = $(this).val() || '';
				api.schedulePreview();
			}
		});

		$(document).on('click.flowbieSlotEditor', '.flowbie-block-editor-view .flowbie-slot-pick-image', function () {
			var slotId = $(this).data('slot-id');
			var slot = api.getSlotById(slotId);
			if (!slot) {
				return;
			}
			var frame = wp.media({ title: R.cfg.i18n.pickImage, button: { text: R.cfg.i18n.pickImage }, multiple: false });
			frame.on('select', function () {
				var att = frame.state().get('selection').first().toJSON();
				slot.attachment_id = att.id;
				slot.attachment_url = att.url || '';
				if (!slot.alt && att.alt) {
					slot.alt = att.alt;
				}
				api.refreshSlotEditorIfOpen(slotId);
				api.schedulePreview();
			});
			frame.open();
		});

		$(document).on('click.flowbieSlotEditor', '.flowbie-block-editor-view .flowbie-slot-clear-image', function () {
			var slotId = $(this).data('slot-id');
			var slot = api.getSlotById(slotId);
			if (!slot) {
				return;
			}
			delete slot.attachment_id;
			delete slot.attachment_url;
			api.refreshSlotEditorIfOpen(slotId);
			api.schedulePreview();
		});
	};

})(jQuery);
