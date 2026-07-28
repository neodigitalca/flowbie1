/**
 * Dashboard layout: section groups + swap-on-drop (customize mode only).
 */
(function () {
	'use strict';

	var cfg = window.flowbieWpDashboardReorder || {};
	var i18n = cfg.i18n || {};
	var layoutRoot = document.querySelector('.flowbie-wp-dashboard-layout[data-reorderable="1"]');
	var customizeBtn = document.getElementById('flowbie-wp-dashboard-customize');
	var addSectionBtn = document.getElementById('flowbie-wp-dashboard-add-section');
	if (!layoutRoot || !customizeBtn || !cfg.restLayoutUrl) {
		return;
	}

	var layoutGroups = [];
	var isCustomizing = false;
	var dragSlug = '';
	var saveTimer = null;

	function labelCustomize() {
		return i18n.customize || 'Customize layout';
	}

	function labelDone() {
		return i18n.done || 'Done';
	}

	function parseInitialLayout() {
		if (Array.isArray(cfg.groups) && cfg.groups.length) {
			return cfg.groups.map(function (g) {
				return {
					id: g.id || newGroupId(),
					title: g.title || '',
					modules: Array.isArray(g.modules) ? g.modules.slice() : [],
				};
			});
		}
		try {
			var raw = layoutRoot.getAttribute('data-layout');
			if (raw) {
				var parsed = JSON.parse(raw);
				if (parsed && Array.isArray(parsed.groups)) {
					return parsed.groups.map(function (g) {
						return {
							id: g.id || newGroupId(),
							title: g.title || '',
							modules: Array.isArray(g.modules) ? g.modules.slice() : [],
						};
					});
				}
			}
		} catch (e) {
			/* ignore */
		}
		return [];
	}

	function newGroupId() {
		return 'grp_' + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 8);
	}

	function findSlugLocation(slug) {
		for (var g = 0; g < layoutGroups.length; g++) {
			var idx = layoutGroups[g].modules.indexOf(slug);
			if (idx >= 0) {
				return { groupIndex: g, moduleIndex: idx };
			}
		}
		return null;
	}

	function swapModules(slugA, slugB) {
		if (slugA === slugB) {
			return;
		}
		var locA = findSlugLocation(slugA);
		var locB = findSlugLocation(slugB);
		if (!locA || !locB) {
			return;
		}
		var tmp = layoutGroups[locA.groupIndex].modules[locA.moduleIndex];
		layoutGroups[locA.groupIndex].modules[locA.moduleIndex] =
			layoutGroups[locB.groupIndex].modules[locB.moduleIndex];
		layoutGroups[locB.groupIndex].modules[locB.moduleIndex] = tmp;
	}

	function applyDomFromLayout() {
		layoutGroups.forEach(function (group) {
			var section = layoutRoot.querySelector(
				'.flowbie-wp-dashboard-section[data-group-id="' + group.id + '"]'
			);
			if (!section) {
				return;
			}
			var gridEl = section.querySelector('.flowbie-wp-dashboard-grid');
			if (!gridEl) {
				return;
			}
			group.modules.forEach(function (slug) {
				var tile = layoutRoot.querySelector('.flowbie-wp-dashboard-tile[data-slug="' + slug + '"]');
				if (tile) {
					gridEl.appendChild(tile);
				}
			});
		});
	}

	function scheduleSave() {
		if (saveTimer) {
			window.clearTimeout(saveTimer);
		}
		saveTimer = window.setTimeout(function () {
			saveTimer = null;
			saveLayout();
		}, 350);
	}

	function saveLayout() {
		if (!cfg.restLayoutUrl || !cfg.nonce) {
			return;
		}
		window
			.fetch(cfg.restLayoutUrl, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': cfg.nonce,
				},
				credentials: 'same-origin',
				body: JSON.stringify({ groups: layoutGroups }),
			})
			.then(function (res) {
				if (!res.ok) {
					throw new Error('save failed');
				}
				return res.json();
			})
			.then(function (data) {
				if (data && Array.isArray(data.groups)) {
					layoutGroups = data.groups.map(function (g) {
						return {
							id: g.id,
							title: g.title || '',
							modules: Array.isArray(g.modules) ? g.modules.slice() : [],
						};
					});
				}
			})
			.catch(function () {
				if (window.console && window.console.warn) {
					window.console.warn('[flowbie-wp] Could not save dashboard layout.');
				}
			});
	}

	function dragHandles() {
		return layoutRoot.querySelectorAll('.flowbie-wp-dashboard-tile__drag');
	}

	function setHandlesDraggable(enabled) {
		var handles = dragHandles();
		for (var i = 0; i < handles.length; i++) {
			handles[i].draggable = enabled;
			handles[i].setAttribute('aria-hidden', enabled ? 'false' : 'true');
			handles[i].tabIndex = enabled ? 0 : -1;
		}
		layoutRoot.querySelectorAll('.flowbie-wp-dashboard-tile[data-slug]').forEach(function (tile) {
			tile.draggable = false;
		});
	}

	function clearDragState() {
		dragSlug = '';
		var dragging = layoutRoot.querySelectorAll('.flowbie-wp-dashboard-tile--dragging');
		for (var i = 0; i < dragging.length; i++) {
			dragging[i].classList.remove('flowbie-wp-dashboard-tile--dragging');
		}
		var targets = layoutRoot.querySelectorAll('.flowbie-wp-dashboard-tile--drop-target');
		for (var j = 0; j < targets.length; j++) {
			targets[j].classList.remove('flowbie-wp-dashboard-tile--drop-target');
		}
	}

	function updateDropTarget(clientX, clientY) {
		var targets = layoutRoot.querySelectorAll('.flowbie-wp-dashboard-tile--drop-target');
		for (var i = 0; i < targets.length; i++) {
			targets[i].classList.remove('flowbie-wp-dashboard-tile--drop-target');
		}
		if (!dragSlug) {
			return;
		}
		var el = document.elementFromPoint(clientX, clientY);
		var tile = el ? el.closest('.flowbie-wp-dashboard-tile') : null;
		if (!tile || !layoutRoot.contains(tile)) {
			return;
		}
		if (tile.getAttribute('data-slug') !== dragSlug) {
			tile.classList.add('flowbie-wp-dashboard-tile--drop-target');
		}
	}

	function syncTitlesFromInputs() {
		layoutGroups.forEach(function (group) {
			var section = layoutRoot.querySelector(
				'.flowbie-wp-dashboard-section[data-group-id="' + group.id + '"]'
			);
			if (!section) {
				return;
			}
			var input = section.querySelector('.flowbie-wp-dashboard-section__title-input');
			if (input) {
				group.title = input.value.trim();
			}
			var titleEl = section.querySelector('.flowbie-wp-dashboard-section__title');
			if (titleEl) {
				if (group.title) {
					titleEl.textContent = group.title;
					titleEl.hidden = false;
					titleEl.classList.remove('flowbie-wp-dashboard-section__title--empty');
				} else {
					titleEl.textContent = '';
					titleEl.hidden = true;
					titleEl.classList.add('flowbie-wp-dashboard-section__title--empty');
				}
			}
		});
	}

	function updateRemoveButtons() {
		var canRemove = layoutGroups.length > 1;
		layoutRoot.querySelectorAll('.flowbie-wp-dashboard-section__remove').forEach(function (btn) {
			var gid = btn.getAttribute('data-group-id');
			var group = layoutGroups.find(function (g) {
				return g.id === gid;
			});
			var empty = group && group.modules.length === 0;
			btn.disabled = !canRemove || !empty;
			btn.title =
				!empty && group
					? i18n.sectionNotEmpty || 'Remove all modules from this section before deleting it.'
					: '';
		});
	}

	function buildSectionElement(group) {
		var section = document.createElement('section');
		section.className = 'flowbie-wp-dashboard-section';
		section.setAttribute('data-group-id', group.id);

		var header = document.createElement('div');
		header.className = 'flowbie-wp-dashboard-section__header';

		var titleEl = document.createElement('h2');
		titleEl.className = 'flowbie-wp-dashboard-section__title';
		if (!group.title) {
			titleEl.classList.add('flowbie-wp-dashboard-section__title--empty');
			titleEl.hidden = true;
		}
		titleEl.textContent = group.title;

		var customize = document.createElement('div');
		customize.className = 'flowbie-wp-dashboard-section__customize';
		customize.hidden = !isCustomizing;

		var label = document.createElement('label');
		label.className = 'screen-reader-text';
		label.setAttribute('for', 'flowbie-wp-section-title-' + group.id);
		label.textContent = i18n.sectionTitlePlaceholder || 'Section title';

		var input = document.createElement('input');
		input.type = 'text';
		input.className = 'flowbie-wp-dashboard-section__title-input';
		input.id = 'flowbie-wp-section-title-' + group.id;
		input.value = group.title;
		input.placeholder = i18n.sectionTitlePlaceholder || 'Section title';
		input.maxLength = 80;

		var removeBtn = document.createElement('button');
		removeBtn.type = 'button';
		removeBtn.className = 'button-link flowbie-wp-dashboard-section__remove';
		removeBtn.setAttribute('data-group-id', group.id);
		removeBtn.textContent = i18n.removeSection || 'Remove section';

		customize.appendChild(label);
		customize.appendChild(input);
		customize.appendChild(removeBtn);
		header.appendChild(titleEl);
		header.appendChild(customize);

		var grid = document.createElement('nav');
		grid.className = 'flowbie-wp-dashboard-grid';
		grid.setAttribute('data-group-id', group.id);
		grid.setAttribute(
			'aria-label',
			group.title || i18n.modulesLabel || 'Site modules'
		);

		section.appendChild(header);
		section.appendChild(grid);
		return section;
	}

	function addSection() {
		var group = {
			id: newGroupId(),
			title: '',
			modules: [],
		};
		layoutGroups.push(group);
		layoutRoot.appendChild(buildSectionElement(group));
		if (isCustomizing) {
			var section = layoutRoot.querySelector(
				'.flowbie-wp-dashboard-section[data-group-id="' + group.id + '"]'
			);
			if (section) {
				var customize = section.querySelector('.flowbie-wp-dashboard-section__customize');
				if (customize) {
					customize.hidden = false;
				}
			}
		}
		updateRemoveButtons();
		scheduleSave();
	}

	function removeSection(groupId) {
		if (layoutGroups.length <= 1) {
			return;
		}
		var idx = -1;
		for (var i = 0; i < layoutGroups.length; i++) {
			if (layoutGroups[i].id === groupId) {
				idx = i;
				break;
			}
		}
		if (idx < 0) {
			return;
		}
		if (layoutGroups[idx].modules.length > 0) {
			return;
		}
		layoutGroups.splice(idx, 1);
		var section = layoutRoot.querySelector(
			'.flowbie-wp-dashboard-section[data-group-id="' + groupId + '"]'
		);
		if (section) {
			section.remove();
		}
		updateRemoveButtons();
		scheduleSave();
	}

	function setCustomizing(active) {
		isCustomizing = active;
		layoutRoot.classList.toggle('flowbie-wp-dashboard-layout--customizing', active);
		customizeBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
		customizeBtn.textContent = active ? labelDone() : labelCustomize();
		if (addSectionBtn) {
			addSectionBtn.hidden = !active;
		}
		setHandlesDraggable(active);

		layoutRoot.querySelectorAll('.flowbie-wp-dashboard-section__customize').forEach(function (el) {
			el.hidden = !active;
		});

		if (active) {
			layoutRoot.querySelectorAll('.flowbie-wp-dashboard-section__title').forEach(function (el) {
				el.hidden = true;
			});
			updateRemoveButtons();
		} else {
			syncTitlesFromInputs();
			layoutRoot.querySelectorAll('.flowbie-wp-dashboard-section__title').forEach(function (el) {
				if (el.classList.contains('flowbie-wp-dashboard-section__title--empty') || !el.textContent.trim()) {
					el.hidden = true;
				} else {
					el.hidden = false;
				}
			});
			clearDragState();
		}
	}

	customizeBtn.addEventListener('click', function () {
		if (isCustomizing) {
			syncTitlesFromInputs();
		}
		setCustomizing(!isCustomizing);
	});

	if (addSectionBtn) {
		addSectionBtn.addEventListener('click', function () {
			if (!isCustomizing) {
				return;
			}
			addSection();
		});
	}

	layoutRoot.addEventListener('input', function (e) {
		if (!isCustomizing) {
			return;
		}
		var input = e.target.closest('.flowbie-wp-dashboard-section__title-input');
		if (!input) {
			return;
		}
		var section = input.closest('.flowbie-wp-dashboard-section');
		if (!section) {
			return;
		}
		var gid = section.getAttribute('data-group-id');
		var group = layoutGroups.find(function (g) {
			return g.id === gid;
		});
		if (group) {
			group.title = input.value.trim();
			scheduleSave();
		}
	});

	layoutRoot.addEventListener('click', function (e) {
		if (e.target.closest('.flowbie-wp-dashboard-section__remove')) {
			if (!isCustomizing) {
				return;
			}
			e.preventDefault();
			var gid = e.target.getAttribute('data-group-id');
			if (gid) {
				removeSection(gid);
			}
			return;
		}

		if (!isCustomizing) {
			return;
		}
		var tile = e.target.closest('.flowbie-wp-dashboard-tile');
		if (tile) {
			e.preventDefault();
			e.stopPropagation();
		}
	}, true);

	layoutRoot.addEventListener('dragstart', function (e) {
		if (!isCustomizing) {
			return;
		}
		var tile = e.target.closest('.flowbie-wp-dashboard-tile');
		if (!tile) {
			return;
		}
		var handle = e.target.closest('.flowbie-wp-dashboard-tile__drag');
		if (!handle) {
			e.preventDefault();
			return;
		}
		dragSlug = tile.getAttribute('data-slug') || '';
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', dragSlug);
		}
		tile.classList.add('flowbie-wp-dashboard-tile--dragging');
	});

	layoutRoot.addEventListener('dragend', function () {
		if (!isCustomizing) {
			return;
		}
		clearDragState();
		updateRemoveButtons();
	});

	layoutRoot.addEventListener('dragover', function (e) {
		if (!isCustomizing || !dragSlug) {
			return;
		}
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		updateDropTarget(e.clientX, e.clientY);
	});

	layoutRoot.addEventListener('dragleave', function (e) {
		if (!isCustomizing || !dragSlug) {
			return;
		}
		var tile = e.target.closest('.flowbie-wp-dashboard-tile');
		if (!tile) {
			return;
		}
		if (!tile.contains(e.relatedTarget)) {
			tile.classList.remove('flowbie-wp-dashboard-tile--drop-target');
		}
	});

	layoutRoot.addEventListener('drop', function (e) {
		if (!isCustomizing) {
			return;
		}
		e.preventDefault();
		var el = document.elementFromPoint(e.clientX, e.clientY);
		var tile = el
			? el.closest('.flowbie-wp-dashboard-tile')
			: e.target.closest('.flowbie-wp-dashboard-tile');
		if (!tile || !layoutRoot.contains(tile)) {
			clearDragState();
			return;
		}
		var toSlug = tile.getAttribute('data-slug') || '';
		var fromSlug = dragSlug;
		if (e.dataTransfer) {
			var dt = e.dataTransfer.getData('text/plain');
			if (dt) {
				fromSlug = dt;
			}
		}
		clearDragState();
		if (!fromSlug || !toSlug || fromSlug === toSlug) {
			return;
		}
		swapModules(fromSlug, toSlug);
		applyDomFromLayout();
		updateRemoveButtons();
		scheduleSave();
	});

	layoutGroups = parseInitialLayout();
	if (!layoutGroups.length) {
		layoutGroups = [{ id: 'default', title: '', modules: [] }];
		layoutRoot.querySelectorAll('.flowbie-wp-dashboard-tile[data-slug]').forEach(function (tile) {
			var slug = tile.getAttribute('data-slug');
			if (slug) {
				layoutGroups[0].modules.push(slug);
			}
		});
	}
	applyDomFromLayout();
	setCustomizing(false);
})();
