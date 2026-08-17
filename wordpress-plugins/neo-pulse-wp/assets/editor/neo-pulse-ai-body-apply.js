(function (wp) {
	'use strict';

	if (!wp || !wp.data || !wp.blocks) {
		return;
	}

	function normalizeTitle(text) {
		return String(text || '')
			.toLowerCase()
			.replace(/<[^>]+>/g, '')
			.replace(/&amp;/g, '&')
			.replace(/&nbsp;/g, ' ')
			.replace(/&#\d+;/g, '')
			.replace(/[^a-z0-9 ]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function getTopLevelBlocks() {
		return wp.data.select('core/block-editor').getBlocks();
	}

	function findSectionRange(blocks, sectionTitle) {
		var target = normalizeTitle(sectionTitle);
		if (!target) return null;
		var start = -1;
		var end = blocks.length;
		for (var i = 0; i < blocks.length; i++) {
			var b = blocks[i];
			if (b.name === 'core/heading' && b.attributes && Number(b.attributes.level) === 2) {
				var t = normalizeTitle(b.attributes.content || '');
				if (start < 0 && t && (t === target || t.indexOf(target) >= 0 || target.indexOf(t) >= 0)) {
					start = i;
					continue;
				}
				if (start >= 0) {
					end = i;
					break;
				}
			}
		}
		if (start < 0) return null;
		return { start: start, end: end };
	}

	window.NeoPulseBodyHarnessApply = {
		extractH2Sections: function () {
			var blocks = getTopLevelBlocks();
			var sections = [];
			blocks.forEach(function (b) {
				if (b.name === 'core/heading' && b.attributes && Number(b.attributes.level) === 2) {
					var raw = (b.attributes.content || '').replace(/<[^>]+>/g, '').trim();
					if (raw) {
						sections.push({ index: sections.length, title: raw, status: 'waiting' });
					}
				}
			});
			return sections;
		},
		applySectionInEditor: function (postId, sectionIndex, html) {
			var store = window.NeoPulseBodyHarnessStore;
			var sec = (store.state.sections || []).find(function (s) {
				return s.index === sectionIndex;
			});
			var title = sec ? sec.title : '';
			console.log('[NeoPulseBody] Apply section ' + sectionIndex + ', title: "' + title + '"');
			var blocks = getTopLevelBlocks();
			var range = findSectionRange(blocks, title);
			console.log('[NeoPulseBody] Range:', range, 'blocks:', blocks.length);
			var newBlocks = wp.blocks.rawHandler({ HTML: html });
			if (!newBlocks || !newBlocks.length) {
				return Promise.reject(new Error('Could not parse section HTML into blocks.'));
			}
			var dispatch = wp.data.dispatch('core/block-editor');
			if (!range) {
				console.warn('[NeoPulseBody] No matching H2 for "' + title + '", skipping insert.');
				return Promise.resolve();
			}
			var ids = [];
			for (var i = range.start; i < range.end; i++) {
				ids.push(blocks[i].clientId);
			}
			dispatch.replaceBlocks(ids, newBlocks);
			if (wp.data.dispatch('core/editor') && wp.data.dispatch('core/editor').savePost) {
				return wp.data.dispatch('core/editor').savePost();
			}
			return Promise.resolve();
		},
		scrollToSectionByTitle: function (title) {
			var blocks = getTopLevelBlocks();
			var range = findSectionRange(blocks, title);
			if (!range || range.start < 0) return;
			var id = blocks[range.start].clientId;
			wp.data.dispatch('core/block-editor').selectBlock(id);
			var el = document.querySelector('[data-block="' + id + '"]');
			if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		},
	};
})(window.wp);
