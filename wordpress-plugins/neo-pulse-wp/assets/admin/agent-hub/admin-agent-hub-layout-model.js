/**
 * Agent Hub — layout grid model (sections, slots, placement).
 */
(function ($) {
	'use strict';

	var R = window.NeoPulseAgentHubRuntime;
	var api = R.api;

	api.defaultResponsive = function() {
		return {
			desktop: { direction: 'row', align: 'stretch', gap: 24, force_full: false },
			tablet: { direction: 'row', align: 'stretch', gap: 16, force_full: false },
			mobile: { direction: 'column', align: 'stretch', gap: 12, force_full: true }
		};
	};

	api.widthForCols = function(cols) {
		if (cols <= 1) return 'full';
		if (cols === 2) return 'half';
		if (cols === 3 || cols === 4) return 'third';
		return 'full';
	}

	api.presetKeyFromGrid = function(grid) {
		return null;
	}

	api.syncGridInputs = function() {
		var grid = (R.builder.layout_config && R.builder.layout_config.grid) || { rows: 3, cols: 3 };
		$('#neo-pulse-builder-grid-rows').val(grid.rows || 3);
		$('#neo-pulse-builder-grid-cols').val(grid.cols || 3);
	}

	api.markSpanCells = function(row, col, colSpan, used) {
		for (var c = col; c < col + colSpan; c++) used[row + ':' + c] = true;
	};

	api.spanFitsGrid = function(row, col, colSpan, grid) {
		return row >= 0 && col >= 0 && colSpan >= 1 && row < grid.rows && (col + colSpan) <= grid.cols;
	};

	api.spanOverlapsUsed = function(row, col, colSpan, used) {
		for (var c = col; c < col + colSpan; c++) {
			if (used[row + ':' + c]) return true;
		}
		return false;
	};

	api.mergeSectionsByCell = function(sections) {
		var byCell = {};
		var noCoords = [];
		(sections || []).forEach(function (sec) {
			var row = parseInt(sec.row, 10);
			var col = parseInt(sec.col, 10);
			if (isNaN(row) || isNaN(col) || row < 0 || col < 0) {
				noCoords.push(sec);
				return;
			}
			var key = row + ':' + col;
			if (!byCell[key]) {
				byCell[key] = Object.assign({}, sec, { slot_ids: (sec.slot_ids || []).slice() });
				return;
			}
			var merged = (byCell[key].slot_ids || []).slice();
			(sec.slot_ids || []).forEach(function (id) {
				if (id && merged.indexOf(id) === -1) merged.push(id);
			});
			byCell[key].slot_ids = merged;
			if (!byCell[key].col_span && sec.col_span) byCell[key].col_span = sec.col_span;
			if ((!byCell[key].align_h || byCell[key].align_h === 'left') && sec.align_h) byCell[key].align_h = sec.align_h;
		});
		return Object.keys(byCell).map(function (k) { return byCell[k]; }).concat(noCoords);
	}

	api.nextFreeCellForSpan = function(grid, used, colSpan) {
		colSpan = Math.max(1, colSpan || 1);
		for (var row = 0; row < grid.rows; row++) {
			for (var col = 0; col <= grid.cols - colSpan; col++) {
				if (!api.spanOverlapsUsed(row, col, colSpan, used)) return { row: row, col: col };
			}
		}
		return null;
	}

	api.nextFreeCell = function(grid, used) {
		return api.nextFreeCellForSpan(grid, used, 1);
	}

	api.defaultLayout = function(slots) {
		var grid = { rows: 3, cols: 3 };
		var sections = [];
		var used = {};
		slots.forEach(function (slot, i) {
			if (!slot._id) return;
			var cell = api.nextFreeCell(grid, used);
			if (!cell) return;
			used[cell.row + ':' + cell.col] = true;
			sections.push({
				id: String(i + 1),
				row: cell.row,
				col: cell.col,
				col_span: 1,
				align_h: 'left',
				width: api.widthForCols(grid.cols),
				slot_ids: [slot._id]
			});
		});
		return { grid: grid, sections: sections, responsive: api.defaultResponsive() };
	}

	api.ensureSlotIds = function(slots) {
		return (slots || []).map(function (slot) {
			slot = Object.assign({}, slot);
			if (!slot._id) slot._id = api.genId();
			if (!slot.align_h) slot.align_h = 'left';
			slot.align_v = 'middle';
			if (slot.type === 'h2' && !slot.heading_level) slot.heading_level = 2;
			return slot;
		});
	}

	api.validateGridSections = function() {
		if (!R.builder.layout_config) return false;
		var grid = R.builder.layout_config.grid || { rows: 3, cols: 3 };
		grid.rows = api.clampGridDim(grid.rows);
		grid.cols = api.clampGridDim(grid.cols);
		R.builder.layout_config.grid = grid;

		R.builder.layout_config.sections = api.mergeSectionsByCell(R.builder.layout_config.sections || []);

		var usedCells = {};
		var usedSlots = {};
		var overflow = false;
		var before = (R.builder.layout_config.sections || []).length;
		var out = [];

		(R.builder.layout_config.sections || []).forEach(function (sec) {
			sec = Object.assign({}, sec);
			if (!sec.slot_ids || !sec.slot_ids.length) return;

			var validIds = [];
			sec.slot_ids.forEach(function (sid) {
				if (sid && !usedSlots[sid] && validIds.indexOf(sid) === -1) validIds.push(sid);
			});
			if (!validIds.length) return;
			sec.slot_ids = validIds;

			var row = parseInt(sec.row, 10);
			var col = parseInt(sec.col, 10);
			var colSpan = Math.max(1, parseInt(sec.col_span, 10) || 1);
			if (isNaN(row) || isNaN(col) || !api.spanFitsGrid(row, col, colSpan, grid)) {
				overflow = true;
				return;
			}
			if (api.spanOverlapsUsed(row, col, colSpan, usedCells)) {
				overflow = true;
				return;
			}
			if (col + colSpan > grid.cols) {
				colSpan = grid.cols - col;
			}
			sec.col_span = colSpan;
			sec.align_h = sec.align_h || 'left';
			if (['left', 'center', 'right'].indexOf(sec.align_h) === -1) sec.align_h = 'left';
			sec.width = api.widthForCols(grid.cols);
			api.markSpanCells(row, col, colSpan, usedCells);
			validIds.forEach(function (sid) { usedSlots[sid] = true; });
			out.push(sec);
		});

		R.builder.layout_config.sections = out;
		return overflow || before !== out.length;
	}

	api.syncLayoutWithSlots = function() {
		if (!R.builder.layout_config) R.builder.layout_config = api.defaultLayout(R.builder.slots);
		if (!R.builder.layout_config.grid) R.builder.layout_config.grid = { rows: 3, cols: 3 };
		if (!R.builder.layout_config.responsive) R.builder.layout_config.responsive = api.defaultResponsive();

		var valid = {};
		R.builder.slots.forEach(function (s) { valid[s._id] = true; });

		R.builder.layout_config.sections = (R.builder.layout_config.sections || []).map(function (sec) {
			sec = Object.assign({}, sec);
			sec.slot_ids = (sec.slot_ids || []).filter(function (id) { return valid[id]; });
			return sec;
		}).filter(function (sec) { return sec.slot_ids.length > 0; });

		var grid = R.builder.layout_config.grid;
		var used = {};
		R.builder.layout_config.sections.forEach(function (sec) {
			var row = parseInt(sec.row, 10);
			var col = parseInt(sec.col, 10);
			var colSpan = Math.max(1, parseInt(sec.col_span, 10) || 1);
			if (!isNaN(row) && !isNaN(col) && row >= 0 && col >= 0) {
				api.markSpanCells(row, col, colSpan, used);
			}
		});
		R.builder.layout_config.sections.forEach(function (sec) {
			var row = parseInt(sec.row, 10);
			var col = parseInt(sec.col, 10);
			if (!isNaN(row) && !isNaN(col) && row >= 0 && col >= 0) return;
			var colSpan = Math.max(1, parseInt(sec.col_span, 10) || 1);
			var cell = api.nextFreeCellForSpan(grid, used, colSpan);
			if (cell) {
				sec.row = cell.row;
				sec.col = cell.col;
				sec.col_span = colSpan;
				sec.width = api.widthForCols(grid.cols);
				api.markSpanCells(cell.row, cell.col, colSpan, used);
			}
		});

		api.validateGridSections();
	}

	api.getPlacedSlotIds = function() {
		var ids = {};
		(R.builder.layout_config.sections || []).forEach(function (sec) {
			(sec.slot_ids || []).forEach(function (sid) { if (sid) ids[sid] = true; });
		});
		return ids;
	}

	api.getSlotById = function(slotId) {
		for (var i = 0; i < R.builder.slots.length; i++) {
			if (R.builder.slots[i]._id === slotId) return R.builder.slots[i];
		}
		return null;
	}

	api.findSectionAt = function(row, col) {
		return (R.builder.layout_config.sections || []).find(function (sec) {
			return parseInt(sec.row, 10) === row && parseInt(sec.col, 10) === col;
		}) || null;
	}

	api.findSectionCoveringCell = function(row, col) {
		return (R.builder.layout_config.sections || []).find(function (sec) {
			var r = parseInt(sec.row, 10);
			var c = parseInt(sec.col, 10);
			var span = Math.max(1, parseInt(sec.col_span, 10) || 1);
			return r === row && col >= c && col < c + span;
		}) || null;
	}

	api.isCellCovered = function(row, col) {
		var sec = api.findSectionCoveringCell(row, col);
		if (!sec) return false;
		return parseInt(sec.col, 10) !== col;
	}

	api.removeSlotFromSections = function(slotId) {
		R.builder.layout_config.sections = (R.builder.layout_config.sections || []).map(function (sec) {
			sec = Object.assign({}, sec);
			sec.slot_ids = (sec.slot_ids || []).filter(function (id) { return id !== slotId; });
			return sec;
		}).filter(function (sec) { return sec.slot_ids.length > 0; });
	}

	api.placeSlot = function(row, col, slotId) {
		api.removeSlotFromSections(slotId);
		var sec = api.findSectionAt(row, col);
		if (sec) {
			if (sec.slot_ids.indexOf(slotId) === -1) sec.slot_ids.push(slotId);
			return;
		}
		var covering = api.findSectionCoveringCell(row, col);
		if (covering && parseInt(covering.col, 10) === col) {
			if (covering.slot_ids.indexOf(slotId) === -1) covering.slot_ids.push(slotId);
			return;
		}
		R.builder.layout_config.sections.push({
			id: String(row * 100 + col + 1),
			row: row,
			col: col,
			col_span: 1,
			align_h: 'left',
			width: api.widthForCols((R.builder.layout_config.grid || {}).cols || 3),
			slot_ids: [slotId]
		});
	}

	api.removeSlotFromCell = function(row, col, slotId) {
		var sec = api.findSectionAt(row, col) || api.findSectionCoveringCell(row, col);
		if (!sec) return;
		sec.slot_ids = (sec.slot_ids || []).filter(function (id) { return id !== slotId; });
		if (!sec.slot_ids.length) {
			R.builder.layout_config.sections = (R.builder.layout_config.sections || []).filter(function (s) {
				return s !== sec;
			});
		}
	}

	api.centerSectionOnRow = function(sec) {
		if (!sec) return;
		var grid = R.builder.layout_config.grid || { cols: 3 };
		var colSpan = Math.max(1, parseInt(sec.col_span, 10) || 1);
		sec.col = Math.max(0, Math.floor((grid.cols - colSpan) / 2));
	}

	api.slotLabel = function(slot) {
		var types = R.cfg.slotTypes || {};
		var type = types[slot.type] || slot.type;
		var detail = slot.text || slot.label || slot.type;
		if (slot.type === 'image' && slot.attachment_id) detail = '#' + slot.attachment_id;
		return type + ' — ' + detail;
	}

	api.libraryEditUrl = function(postId) {
		return window.ajaxurl ? window.ajaxurl.replace('admin-ajax.php', 'post.php?post=' + postId + '&action=elementor') : '#';
	}

	api.blockIdFromEl = function($el) {
		return parseInt($el.attr('data-block-id') || $el.data('blockId') || '0', 10) || 0;
	}

})(jQuery);
