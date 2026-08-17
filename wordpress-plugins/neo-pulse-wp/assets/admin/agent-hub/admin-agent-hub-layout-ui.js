/**
 * Agent Hub — layout canvas UI, preview, responsive.
 */
(function ($) {
	'use strict';

	var R = window.NeoPulseAgentHubRuntime;
	var api = R.api;

	api.slotPreviewText = function(slot) {
		var text = '';
		switch (slot.type) {
			case 'h2':
				text = slot.text || '';
				break;
			case 'paragraph':
				text = String(slot.html || '').replace(/<[^>]+>/g, ' ');
				break;
			case 'cta':
				text = slot.label || '';
				break;
			case 'list':
				text = (slot.items || []).join(', ');
				break;
			case 'image':
				if (slot.attachment_id) text = 'Media ' + slot.attachment_id;
				break;
		}
		text = String(text).replace(/\s+/g, ' ').trim();
		if (text.length > 40) text = text.slice(0, 40) + '...';
		return text;
	};

	api.layoutChipHtml = function(slot, inCell) {
		var types = R.cfg.slotTypes || {};
		var typeLabel = types[slot.type] || slot.type;
		if (slot.type === 'h2') {
			typeLabel = 'H' + (parseInt(slot.heading_level, 10) || 2);
		}
		var i18n = R.cfg.i18n || {};
		var dragHandle = inCell
			? '<button type="button" class="neo-pulse-builder-layout-chip__drag" aria-label="' + api.esc(i18n.dragHandle || 'Drag to reorder') + '">&#8942;</button>'
			: '';
		var removeBtn = inCell
			? '<button type="button" class="neo-pulse-builder-layout-chip__remove" aria-label="' + api.esc(i18n.removeBlock || 'Remove') + '">&times;</button>'
			: '';
		var preview = api.slotPreviewText(slot);
		var thumb = (slot.type === 'image' && slot.attachment_url)
			? '<img src="' + api.esc(slot.attachment_url) + '" alt="" class="neo-pulse-builder-layout-chip__thumb" />'
			: '';
		var previewLine = preview
			? '<span class="neo-pulse-builder-layout-chip__preview">' + api.esc(preview) + '</span>'
			: '';
		return '<div class="neo-pulse-builder-layout-chip' + (inCell ? ' neo-pulse-builder-layout-chip--in-cell' : '') + '" data-slot-id="' + api.esc(slot._id) + '">' +
			dragHandle +
			thumb +
			'<div class="neo-pulse-builder-layout-chip__content">' +
			'<div class="neo-pulse-builder-layout-chip__meta">' +
			'<span class="neo-pulse-builder-layout-chip__type">' + api.esc(typeLabel) + '</span>' +
			'<span class="neo-pulse-builder-layout-chip__id">#' + api.esc(slot._id) + '</span>' +
			'</div>' + previewLine + '</div>' +
			removeBtn +
			'</div>';
	};

	api.sectionControlsHtml = function(sec, row, col) {
		var i18n = R.cfg.i18n || {};
		var grid = R.builder.layout_config.grid || { cols: 3 };
		var colSpan = Math.max(1, parseInt(sec.col_span, 10) || 1);
		var maxSpan = grid.cols - col;
		var alignH = sec.align_h || 'left';
		return '<div class="neo-pulse-builder-layout-cell__controls neo-pulse-builder-layout-cell-settings__controls" data-row="' + row + '" data-col="' + col + '">' +
			'<label class="neo-pulse-builder-layout-cell__ctl"><span>' + api.esc(i18n.colSpan || 'Span') + '</span>' +
			'<input type="number" class="neo-pulse-builder-section-col-span" min="1" max="' + maxSpan + '" value="' + colSpan + '" data-row="' + row + '" data-col="' + col + '" /></label>' +
			'<label class="neo-pulse-builder-layout-cell__ctl"><span>' + api.esc(i18n.sectionAlign || 'Align') + '</span>' +
			'<select class="neo-pulse-builder-section-align-h" data-row="' + row + '" data-col="' + col + '">' +
			['left', 'center', 'right'].map(function (v) {
				return '<option value="' + v + '"' + (alignH === v ? ' selected' : '') + '>' + api.esc(i18n['alignH_' + v] || v) + '</option>';
			}).join('') + '</select></label>' +
			'<button type="button" class="button button-small neo-pulse-builder-section-center-row" data-row="' + row + '" data-col="' + col + '">' + api.esc(i18n.centerOnRow || 'Center on row') + '</button>' +
			'</div>';
	}

	api.selectLayoutCell = function(row, col) {
		if (api.isCellCovered(row, col)) return;
		R.builder.selectedLayoutCell = { row: row, col: col };
		$('#neo-pulse-builder-layout-grid .neo-pulse-builder-layout-cell').removeClass('is-selected');
		$('#neo-pulse-builder-layout-grid .neo-pulse-builder-layout-cell[data-row="' + row + '"][data-col="' + col + '"]').addClass('is-selected');
		api.renderLayoutCellSettings();
	}

	api.renderLayoutCellSettings = function() {
		var $panel = $('#neo-pulse-builder-layout-cell-settings');
		if (!$panel.length) return;
		var i18n = R.cfg.i18n || {};
		var sel = R.builder.selectedLayoutCell;
		if (!sel) {
			$panel.prop('hidden', false).html(
				'<p class="neo-pulse-builder-layout-cell-settings__pick">' + api.esc(i18n.cellSettingsPick || 'Click a grid cell to edit its settings.') + '</p>'
			);
			return;
		}
		var row = sel.row;
		var col = sel.col;
		var sec = api.findSectionAt(row, col);
		var head = '<div class="neo-pulse-builder-layout-cell-settings__head">' +
			'<span class="neo-pulse-builder-layout-cell-settings__title">' + api.esc(i18n.cellSettings || 'Cell settings') + '</span>' +
			'<span class="neo-pulse-builder-layout-cell-settings__coords">' + api.esc('Row ' + (row + 1) + ', Col ' + (col + 1)) + '</span>' +
			'</div>';
		if (!sec || !sec.slot_ids || !sec.slot_ids.length) {
			$panel.prop('hidden', false).html(
				head + '<p class="neo-pulse-builder-layout-cell-settings__empty">' + api.esc(i18n.cellSettingsEmpty || 'Drop content into this cell to configure span and alignment.') + '</p>'
			);
			return;
		}
		$panel.prop('hidden', false).html(head + api.sectionControlsHtml(sec, row, col));
	}

	api.initCellStackSortable = function() {
		var $canvas = $('#neo-pulse-builder-layout-grid');
		$canvas.find('.neo-pulse-builder-layout-cell__stack').each(function () {
			var $stack = $(this);
			if ($stack.hasClass('ui-sortable')) $stack.sortable('destroy');
			$stack.sortable({
				items: '.neo-pulse-builder-layout-chip--in-cell',
				handle: '.neo-pulse-builder-layout-chip__drag',
				axis: 'y',
				update: function () {
					var row = parseInt($stack.data('row'), 10);
					var col = parseInt($stack.data('col'), 10);
					var sec = api.findSectionAt(row, col);
					if (!sec) return;
					var order = [];
					$stack.find('.neo-pulse-builder-layout-chip').each(function () {
						order.push($(this).attr('data-slot-id'));
					});
					sec.slot_ids = order;
					api.schedulePreview();
				}
			});
		});
	}

	api.initLayoutDragDrop = function() {
		var $palette = $('#neo-pulse-builder-layout-palette');
		var $canvas = $('#neo-pulse-builder-layout-grid');

		$palette.find('.neo-pulse-builder-layout-chip').draggable({
			helper: 'clone',
			revert: 'invalid',
			zIndex: 100002,
			appendTo: 'body',
			cursor: 'grabbing',
			distance: 6
		});

		$canvas.find('.neo-pulse-builder-layout-cell:not(.is-covered)').droppable({
			accept: '.neo-pulse-builder-layout-chip',
			hoverClass: 'is-drop-hover',
			tolerance: 'pointer',
			drop: function (event, ui) {
				var slotId = ui.draggable.attr('data-slot-id');
				var row = parseInt($(this).data('row'), 10);
				var col = parseInt($(this).data('col'), 10);
				if (!slotId || isNaN(row) || isNaN(col)) return;
				api.placeSlot(row, col, slotId);
				R.builder.selectedLayoutCell = { row: row, col: col };
				api.renderLayout();
				api.schedulePreview();
			}
		});

		$canvas.find('.neo-pulse-builder-layout-chip--in-cell').draggable({
			helper: 'clone',
			revert: 'invalid',
			zIndex: 100002,
			appendTo: 'body',
			cursor: 'grabbing',
			handle: '.neo-pulse-builder-layout-chip__drag',
			distance: 6
		});

		api.initCellStackSortable();
	}

	api.renderLayout = function() {
		var $canvas = $('#neo-pulse-builder-layout-grid');
		var $palette = $('#neo-pulse-builder-layout-palette');
		var $hint = $('#neo-pulse-builder-layout-hint');
		if (!$canvas.length) return;

		if (!R.builder.layout_config.grid) R.builder.layout_config.grid = { rows: 3, cols: 3 };
		var grid = R.builder.layout_config.grid;
		api.syncGridInputs();

		var placed = api.getPlacedSlotIds();
		var unplaced = R.builder.slots.filter(function (s) { return !placed[s._id]; });

		var paletteHtml = '<span class="neo-pulse-builder-layout-palette__label">' + api.esc(R.cfg.i18n.unplacedSlots || 'Unplaced') + '</span>';
		if (!unplaced.length) {
			paletteHtml += '<span class="neo-pulse-builder-layout-palette__empty">' + api.esc('—') + '</span>';
		} else {
			unplaced.forEach(function (slot) {
				paletteHtml += api.layoutChipHtml(slot, false);
			});
		}
		$palette.html(paletteHtml);

		var canvasHtml = '';
		for (var row = 0; row < grid.rows; row++) {
			for (var col = 0; col < grid.cols; col++) {
				if (api.isCellCovered(row, col)) {
					canvasHtml += '<div class="neo-pulse-builder-layout-cell is-covered" data-row="' + row + '" data-col="' + col + '" hidden></div>';
					continue;
				}
				var sec = api.findSectionAt(row, col);
				var occupied = sec && sec.slot_ids && sec.slot_ids.length;
				var colSpan = occupied ? Math.max(1, parseInt(sec.col_span, 10) || 1) : 1;
				var inner = '';
				var cellClass = 'neo-pulse-builder-layout-cell';
				if (R.builder.selectedLayoutCell && R.builder.selectedLayoutCell.row === row && R.builder.selectedLayoutCell.col === col) {
					cellClass += ' is-selected';
				}
				if (occupied) {
					cellClass += ' is-occupied';
					var stackHtml = '';
					sec.slot_ids.forEach(function (sid) {
						var slot = api.getSlotById(sid);
						if (slot) stackHtml += api.layoutChipHtml(slot, true);
					});
					inner = '<div class="neo-pulse-builder-layout-cell__stack" data-row="' + row + '" data-col="' + col + '">' + stackHtml + '</div>';
				} else {
					inner = '<span class="neo-pulse-builder-layout-cell__placeholder">' + api.esc(R.cfg.i18n.emptyCell || 'Drop here') + '</span>';
				}
				var style = colSpan > 1 ? ' style="grid-column: span ' + colSpan + ';"' : '';
				canvasHtml += '<div class="' + cellClass + '" data-row="' + row + '" data-col="' + col + '"' + style + '>' + inner + '</div>';
			}
		}
		$canvas.css({
			gridTemplateColumns: 'repeat(' + grid.cols + ', minmax(0, 1fr))',
			gridTemplateRows: 'repeat(' + grid.rows + ', minmax(88px, 1fr))'
		}).html(canvasHtml);

		if ($hint.length) {
			$hint.text(R.cfg.i18n.dragHint || 'Drop items onto a cell. Drag chips within a cell to reorder.').removeClass('is-warning');
		}

		api.initLayoutDragDrop();
		api.renderLayoutCellSettings();
	}

	api.renderResponsive = function() {
		var $wrap = $('#neo-pulse-builder-responsive');
		if (!$wrap.length) return;
		var html = '';
		['desktop', 'tablet', 'mobile'].forEach(function (bp) {
			var r = (R.builder.layout_config.responsive || {})[bp] || {};
			var readonly = bp === 'desktop' ? ' disabled' : '';
			html += '<div class="neo-pulse-builder-group" data-breakpoint="' + bp + '"><h3 class="neo-pulse-builder-group__title">' + api.esc(R.cfg.i18n[bp] || bp) + '</h3>' +
				'<div class="neo-pulse-builder-field"><label>' + api.esc(R.cfg.i18n.direction) + '</label><select class="neo-pulse-builder-field__control neo-pulse-responsive-input" data-bp="' + bp + '" data-key="direction"' + readonly + '>' +
				'<option value="row"' + (r.direction === 'row' ? ' selected' : '') + '>Row</option><option value="column"' + (r.direction === 'column' ? ' selected' : '') + '>Column</option></select></div>' +
				'<div class="neo-pulse-builder-field"><label>' + api.esc(R.cfg.i18n.align) + '</label><select class="neo-pulse-builder-field__control neo-pulse-responsive-input" data-bp="' + bp + '" data-key="align"' + readonly + '>' +
				['start', 'center', 'end', 'stretch'].map(function (a) {
					return '<option value="' + a + '"' + ((r.align || 'stretch') === a ? ' selected' : '') + '>' + a + '</option>';
				}).join('') + '</select></div>' +
				'<div class="neo-pulse-builder-field"><label>' + api.esc(R.cfg.i18n.gap) + '</label><input type="number" min="0" class="neo-pulse-builder-field__control neo-pulse-responsive-input" data-bp="' + bp + '" data-key="gap" value="' + api.esc(String(r.gap != null ? r.gap : 24)) + '"' + readonly + ' /></div>' +
				'<div class="neo-pulse-builder-field"><label>' + api.esc(R.cfg.i18n.forceFull) + '</label><input type="checkbox" class="neo-pulse-responsive-input" data-bp="' + bp + '" data-key="force_full"' + (r.force_full ? ' checked' : '') + readonly + ' /></div></div>';
		});
		$wrap.html(html);
	}

	api.schedulePreview = function() {
		clearTimeout(R.builder.previewTimer);
		R.builder.previewTimer = setTimeout(api.refreshPreview, 350);
	}

	api.refreshPreview = function() {
		var $preview = $('#neo-pulse-builder-preview');
		if (!$preview.length) return;
		$preview.html('<p class="neo-pulse-builder-preview__loading">' + api.esc(R.cfg.i18n.previewLoading) + '</p>');
		api.rest('seo-blocks/preview', { method: 'POST', body: api.collectPayload() })
			.then(function (data) {
				$preview.html(data.html || '');
			})
			.catch(function () {
				$preview.html('<p class="neo-pulse-builder-preview__error">' + api.esc(R.cfg.i18n.error) + '</p>');
			});
	}


})(jQuery);
