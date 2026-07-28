/**
 * Script Manager — meta fields + display rules.
 */
(function () {
	'use strict';

	var form = document.getElementById('flowbie-script-manager-form');
	if (!form) {
		return;
	}

	var panel = document.getElementById('flowbie-script-rules-panel');
	var hidden = document.getElementById('script_display_rules');

	function toggleTextFilled(input) {
		var field = input.closest('.flowbie-field');
		if (!field) {
			return;
		}
		if (input.value && String(input.value).trim() !== '') {
			field.classList.add('flowbie-field--filled');
		} else {
			field.classList.remove('flowbie-field--filled');
		}
	}

	function initFloatingTextFields(root) {
		if (!root) {
			return;
		}
		root.querySelectorAll('.flowbie-field--text .flowbie-field__control, .flowbie-field--textarea .flowbie-field__control').forEach(function (input) {
			toggleTextFilled(input);
			input.addEventListener('input', function () {
				toggleTextFilled(input);
			});
		});
	}

	if (!panel || !hidden) {
		return;
	}

	function emptyTargets() {
		return {
			posts: [],
			post_types: [],
			taxonomies: [],
			archives: [],
			special: []
		};
	}

	function parseIds(value) {
		if (!value || typeof value !== 'string') {
			return [];
		}
		return value
			.split(/[,\s]+/)
			.map(function (s) {
				return parseInt(s.trim(), 10);
			})
			.filter(function (n) {
				return n > 0;
			});
	}

	function parseTaxonomiesField(value) {
		var out = [];
		if (!value || typeof value !== 'string' || value.trim() === '') {
			return out;
		}
		value.split(/\s+/).forEach(function (part) {
			var idx = part.indexOf(':');
			if (idx < 1) {
				return;
			}
			var tax = part.slice(0, idx).trim();
			var terms = parseIds(part.slice(idx + 1).replace(/,/g, ' '));
			if (tax && terms.length) {
				out.push({ taxonomy: tax, terms: terms });
			}
		});
		return out;
	}

	function formatTaxonomiesField(rows) {
		if (!rows || !rows.length) {
			return '';
		}
		return rows
			.map(function (row) {
				return row.taxonomy + ':' + (row.terms || []).join(',');
			})
			.join(' ');
	}

	function selectedValues(selectEl) {
		if (!selectEl) {
			return [];
		}
		return Array.prototype.map.call(selectEl.selectedOptions, function (opt) {
			return opt.value;
		});
	}

	function readTargets(group) {
		var col = panel.querySelector('[data-rules-group="' + group + '"]');
		if (!col) {
			return emptyTargets();
		}

		var targets = emptyTargets();

		var postsInput = col.querySelector('[data-target="posts"]');
		if (postsInput) {
			targets.posts = parseIds(postsInput.value);
		}

		['post_types', 'archives', 'special'].forEach(function (key) {
			var sel = col.querySelector('select[data-target="' + key + '"]');
			targets[key] = selectedValues(sel);
		});

		var taxInput = col.querySelector('[data-target="taxonomies"]');
		if (taxInput) {
			targets.taxonomies = parseTaxonomiesField(taxInput.value);
		}

		return targets;
	}

	function buildRules() {
		return {
			mode: (document.getElementById('rules_mode') || {}).value || 'all',
			include: readTargets('include'),
			exclude: readTargets('exclude'),
			device: (document.getElementById('rules_device') || {}).value || 'all',
			logged_in: (document.getElementById('rules_logged_in') || {}).value || 'all'
		};
	}

	function syncHidden() {
		hidden.value = JSON.stringify(buildRules());
	}

	function setMultiSelect(group, target, values) {
		var col = panel.querySelector('[data-rules-group="' + group + '"]');
		if (!col) {
			return;
		}
		var sel = col.querySelector('select[data-target="' + target + '"]');
		if (!sel) {
			return;
		}
		var map = {};
		(values || []).forEach(function (v) {
			map[String(v)] = true;
		});
		Array.prototype.forEach.call(sel.options, function (opt) {
			opt.selected = !!map[opt.value];
		});
		var wrap = sel.closest('[data-flowbie-ms]');
		if (wrap) {
			updateMultiselectSummary(wrap);
		}
	}

	function setTaxonomies(group, taxonomies) {
		var col = panel.querySelector('[data-rules-group="' + group + '"]');
		if (!col) {
			return;
		}
		var input = col.querySelector('[data-target="taxonomies"]');
		if (!input) {
			return;
		}
		input.value = formatTaxonomiesField(taxonomies);
		toggleTextFilled(input);
	}

	function applyRules(rules) {
		rules = rules || {};
		var modeEl = document.getElementById('rules_mode');
		var deviceEl = document.getElementById('rules_device');
		var loggedEl = document.getElementById('rules_logged_in');

		if (modeEl) {
			modeEl.value = rules.mode || 'all';
		}
		if (deviceEl) {
			deviceEl.value = rules.device || 'all';
		}
		if (loggedEl) {
			loggedEl.value = rules.logged_in || 'all';
		}

		['include', 'exclude'].forEach(function (group) {
			var t = rules[group] || emptyTargets();
			var col = panel.querySelector('[data-rules-group="' + group + '"]');
			if (!col) {
				return;
			}
			var postsInput = col.querySelector('[data-target="posts"]');
			if (postsInput) {
				postsInput.value = (t.posts || []).join(',');
				toggleTextFilled(postsInput);
			}
			setMultiSelect(group, 'post_types', t.post_types);
			setMultiSelect(group, 'archives', t.archives);
			setMultiSelect(group, 'special', t.special);
			setTaxonomies(group, t.taxonomies);
		});

		syncHidden();
	}

	function updateMultiselectSummary(wrap) {
		var sel = wrap.querySelector('.flowbie-ms__native');
		var summary = wrap.querySelector('.flowbie-ms__summary');
		if (!sel || !summary) {
			return;
		}
		var labels = Array.prototype.map.call(sel.selectedOptions, function (opt) {
			return opt.textContent.trim();
		});
		summary.textContent = '';
		labels.forEach(function (label) {
			var tag = document.createElement('span');
			tag.className = 'flowbie-ms__tag';
			tag.textContent = label;
			summary.appendChild(tag);
		});
		wrap.classList.toggle('flowbie-field--filled', labels.length > 0);
		wrap.classList.toggle('flowbie-field--multiselect-has-tags', labels.length > 0);

		wrap.querySelectorAll('.flowbie-ms__option').forEach(function (btn) {
			var selected = Array.prototype.some.call(sel.selectedOptions, function (opt) {
				return opt.value === btn.getAttribute('data-value');
			});
			btn.classList.toggle('is-selected', selected);
			btn.setAttribute('aria-selected', selected ? 'true' : 'false');
		});
	}

	function closeAllMenus(except) {
		panel.querySelectorAll('[data-flowbie-ms]').forEach(function (wrap) {
			if (except && wrap === except) {
				return;
			}
			var menu = wrap.querySelector('.flowbie-ms__menu');
			var trigger = wrap.querySelector('.flowbie-ms__trigger');
			if (menu) {
				menu.hidden = true;
			}
			if (trigger) {
				trigger.setAttribute('aria-expanded', 'false');
			}
		});
	}

	function initMultiselect(wrap) {
		var trigger = wrap.querySelector('.flowbie-ms__trigger');
		var menu = wrap.querySelector('.flowbie-ms__menu');
		var sel = wrap.querySelector('.flowbie-ms__native');
		if (!trigger || !menu || !sel) {
			return;
		}

		trigger.addEventListener('click', function (e) {
			e.preventDefault();
			var open = menu.hidden;
			closeAllMenus(open ? wrap : null);
			menu.hidden = !open;
			trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
		});

		menu.querySelectorAll('.flowbie-ms__option').forEach(function (btn) {
			btn.addEventListener('click', function (e) {
				e.preventDefault();
				var value = btn.getAttribute('data-value');
				var opt = null;
				Array.prototype.forEach.call(sel.options, function (option) {
					if (option.value === value) {
						opt = option;
					}
				});
				if (opt) {
					opt.selected = !opt.selected;
				}
				updateMultiselectSummary(wrap);
				syncHidden();
			});
		});

		updateMultiselectSummary(wrap);
	}

	function initTabs() {
		var root = panel.querySelector('[data-flowbie-rules-tabs]');
		if (!root) {
			return;
		}
		var tabs = root.querySelectorAll('.flowbie-rules__tab');
		var panels = root.querySelectorAll('.flowbie-rules__panel');

		tabs.forEach(function (tab) {
			tab.addEventListener('click', function () {
				var target = tab.getAttribute('data-rules-tab');
				tabs.forEach(function (t) {
					var active = t === tab;
					t.classList.toggle('is-active', active);
					t.setAttribute('aria-selected', active ? 'true' : 'false');
				});
				panels.forEach(function (p) {
					var show = p.getAttribute('data-rules-group') === target;
					p.classList.toggle('is-active', show);
					p.hidden = !show;
				});
				closeAllMenus(null);
			});
		});
	}

	panel.querySelectorAll('[data-flowbie-ms]').forEach(initMultiselect);
	initTabs();

	document.addEventListener('click', function (e) {
		if (!panel.contains(e.target)) {
			return;
		}
		if (!e.target.closest('[data-flowbie-ms]')) {
			closeAllMenus(null);
		}
	});

	panel.querySelectorAll('.flowbie-field--text .flowbie-field__control').forEach(function (input) {
		input.addEventListener('input', syncHidden);
	});

	var initial = {};
	try {
		initial = JSON.parse(panel.getAttribute('data-rules') || hidden.value || '{}');
	} catch (e) {
		initial = {};
	}
	applyRules(initial);

	panel.addEventListener('change', syncHidden);
	panel.addEventListener('input', syncHidden);
	form.addEventListener('submit', syncHidden);
})();
