(function () {
	'use strict';

	var S = function () { return window.NeoPulseAiShared; };
	var D = function () { return window.NeoPulseAiDom; };
	var Snip = function () { return window.NeoPulseAiSnippet; };

	function renderGroup(extraClass) {
		return D().el('section', 'neo-pulse-wp-ai-sidebar__group' + (extraClass ? ' ' + extraClass : ''));
	}

	function renderLabel(text) {
		return D().el('h3', 'neo-pulse-wp-ai-sidebar__label', text);
	}

	function renderUsageGroup(ctrl) {
		var el = D().el;
		var str = S().str;
		var status = ctrl.status || {};
		var group = renderGroup('neo-pulse-wp-ai-sidebar__group--usage');

		if (status.cap === null || status.cap === undefined) {
			return group;
		}

		var row = el('div', 'neo-pulse-wp-ai-sidebar__usage-row');
		row.appendChild(el('span', 'neo-pulse-wp-ai-sidebar__usage-label', str('usageLabel', 'Optimizations this period')));

		var used = Number(status.used || 0);
		var cap = Number(status.cap || 0);
		var capEnforced = status.capEnforced !== false;
		var over = capEnforced && cap > 0 && used >= cap;
		var countClass = 'neo-pulse-wp-ai-sidebar__count';
		if (!capEnforced) countClass += ' neo-pulse-wp-ai-sidebar__count--muted';
		else if (over) countClass += ' neo-pulse-wp-ai-sidebar__count--over';
		row.appendChild(el('span', countClass, used + '/' + cap));
		group.appendChild(row);

		if (!capEnforced) {
			group.appendChild(el('p', 'neo-pulse-wp-ai-sidebar__cap-paused', status.capNotice || str('capPaused', 'Optimization cap is temporarily disabled.')));
		}

		return group;
	}

	function renderSidebar(ctrl, root) {
		var el = D().el;
		var str = S().str;
		var self = ctrl;

		var sidebar = el('section', 'neo-pulse-wp-ai-sidebar');
		sidebar.setAttribute('aria-label', str('title', 'NEO Pulse AI'));

		sidebar.appendChild(renderUsageGroup(ctrl));

		var preview = renderGroup('neo-pulse-wp-ai-sidebar__group--preview');
		preview.appendChild(renderLabel(str('previewLabel', 'Preview')));
		var snippetInner = Snip().renderSnippetCard(ctrl, { compact: true, showHeading: false });
		preview.appendChild(snippetInner.querySelector('.neo-pulse-wp-ai-snippet__box'));
		sidebar.appendChild(preview);

		var focus = renderGroup('neo-pulse-wp-ai-sidebar__group--focus');
		focus.appendChild(renderLabel(str('focusKeyword', 'Focus keyword')));
		var kw = (ctrl.draft.focusKeyword || ctrl.saved.focusKeyword || '').trim();
		focus.appendChild(el(
			'p',
			'neo-pulse-wp-ai-keyword-value' + (kw ? '' : ' neo-pulse-wp-ai-keyword-value--empty'),
			kw ? D().truncate(kw, 80) : str('focusKeywordEmpty', 'Not set')
		));
		var status = ctrl.status || {};
		if (status.gscAvailable) {
			S().renderGscChips(ctrl, focus, 2);
		}
		sidebar.appendChild(focus);

		var cta = el('button', 'neo-pulse-wp-ai-edit-snippet neo-pulse-wp-ai-edit-snippet--body');
		cta.type = 'button';
		cta.textContent = str('contentOptimizer', 'Content Optimizer');
		if (S().isAnyDirty(ctrl)) {
			cta.classList.add('neo-pulse-wp-ai-edit-snippet--dirty');
			cta.appendChild(el('span', 'neo-pulse-wp-ai-sidebar__dot', ''));
		}
		cta.addEventListener('click', function () {
			if (window.NeoPulseBodyModal) {
				window.NeoPulseBodyModal.open(self);
			}
		});
		sidebar.appendChild(cta);

		/* ── Social Media Module ── */
		var socialGroup = renderGroup('neo-pulse-wp-ai-sidebar__group--gmb');
		socialGroup.appendChild(renderLabel(str('gmbLabel', 'Social Media')));

		var socialBtn = el('button', 'neo-pulse-wp-ai-edit-snippet neo-pulse-wp-ai-edit-snippet--gmb');
		socialBtn.type = 'button';
		socialBtn.textContent = str('gmbCreate', 'Create Social Post');

		socialBtn.addEventListener('click', function () {
			var postId = ctrl.postId || 0;
			if (!postId && typeof wp !== 'undefined' && wp.data) {
				var store = wp.data.select('core/editor');
				if (store) postId = store.getCurrentPostId();
			}
			if (window.NeoPulseSocialMediaModal) {
				window.NeoPulseSocialMediaModal.open(postId);
			}
		});
		socialGroup.appendChild(socialBtn);
		sidebar.appendChild(socialGroup);

		ctrl.launcherEl = sidebar;
		root.appendChild(sidebar);
	}

	function renderToast(root, message) {
		if (!message) return;
		var note = D().el('p', 'neo-pulse-wp-ai__success neo-pulse-wp-ai-sidebar__toast');
		note.setAttribute('role', 'status');
		note.textContent = message;
		root.insertBefore(note, root.firstChild);
	}

	window.NeoPulseAiSidebar = {
		render: function (ctrl, root) {
			renderToast(root, ctrl.toastMessage);
			ctrl.toastMessage = '';
			renderSidebar(ctrl, root);
		},
	};
})();
