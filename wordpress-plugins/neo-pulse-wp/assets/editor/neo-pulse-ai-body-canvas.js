(function (wp) {
	'use strict';

	if (!wp || !wp.plugins || !wp.element || !wp.compose || !wp.blockEditor || !wp.data) {
		return;
	}

	var createElement = wp.element.createElement;
	var useEffect = wp.element.useEffect;
	var useState = wp.element.useState;
	var registerPlugin = wp.plugins.registerPlugin;
	var PluginDocumentSettingPanel = wp.editor.PluginDocumentSettingPanel;
	var createHigherOrderComponent = wp.compose.createHigherOrderComponent;
	var BlockEdit = wp.blockEditor.BlockEdit;

	function cfg() {
		return window.neoPulseWpAi || {};
	}

	function str(key, fallback) {
		var s = cfg().strings || {};
		return s[key] || fallback;
	}

	function badgeForSection(sec, activeIndex) {
		if (!sec) return null;
		var status = sec.status || 'waiting';
		var cls = 'neo-pulse-body-canvas__badge neo-pulse-body-canvas__badge--' + status;
		if (sec.index === activeIndex) cls += ' neo-pulse-body-canvas__badge--active';
		return createElement('span', { className: cls }, str('bodyStatus' + status.charAt(0).toUpperCase() + status.slice(1), status));
	}

	function StickyHarnessPanel() {
		var _useState = useState(window.NeoPulseBodyHarnessStore.state);
		var state = _useState[0];
		var setState = _useState[1];

		useEffect(function () {
			return window.NeoPulseBodyHarnessStore.subscribe(function (st) {
				setState(Object.assign({}, st));
			});
		}, []);

		if (!state.sessionId && state.phase === 'idle') {
			return null;
		}

		var planned = state.plannedCount || 0;
		var done = state.doneCount || 0;
		var pct = planned > 0 ? Math.round((done / planned) * 100) : 0;

		return createElement(
			PluginDocumentSettingPanel,
			{
				name: 'neo-pulse-body-harness-progress',
				title: str('bodyHarnessTitle', 'Body harness'),
				className: 'neo-pulse-body-canvas__panel',
			},
			createElement('p', { className: 'neo-pulse-body-canvas__phase' }, state.phase === 'planning' ? str('bodyPhasePlanning', 'Planning blueprint…') : str('bodyPhaseReady', 'Section progress')),
			createElement('div', { className: 'neo-pulse-body-canvas__track' },
				createElement('div', { className: 'neo-pulse-body-canvas__fill', style: { width: pct + '%' } })
			),
			createElement('p', { className: 'neo-pulse-body-canvas__counts' }, done + '/' + planned)
		);
	}

	var withHarnessBadge = createHigherOrderComponent(function (BlockListBlock) {
		return function (props) {
			if (props.name !== 'core/heading' || !props.attributes || Number(props.attributes.level) !== 2) {
				return createElement(BlockListBlock, props);
			}
			var store = window.NeoPulseBodyHarnessStore.state;
			if (!store.sessionId) {
				return createElement(BlockListBlock, props);
			}
			var title = String(props.attributes.content || '').replace(/<[^>]+>/g, '').trim();
			var sec = (store.sections || []).find(function (s) {
				var t = String(s.title || '').toLowerCase();
				var h = title.toLowerCase();
				return t === h || t.indexOf(h) >= 0 || h.indexOf(t) >= 0;
			});
			return createElement(
				'div',
				{ className: 'neo-pulse-body-canvas__block-wrap' + (store.activeIndex === (sec ? sec.index : -1) ? ' neo-pulse-body-canvas__block-wrap--active' : '') },
				createElement(BlockListBlock, props),
				sec ? badgeForSection(sec, store.activeIndex) : null
			);
		};
	}, 'withNeoPulseHarnessBadge');

	registerPlugin('neo-pulse-body-harness-panel', { render: StickyHarnessPanel });
	wp.hooks.addFilter('editor.BlockListBlock', 'neo-pulse-wp/body-harness-badge', withHarnessBadge);

	window.NeoPulseBodyHarnessCanvas = {
		scrollToSection: function (index) {
			var sec = (window.NeoPulseBodyHarnessStore.state.sections || []).find(function (s) {
				return s.index === index;
			});
			if (sec && window.NeoPulseBodyHarnessApply) {
				window.NeoPulseBodyHarnessApply.scrollToSectionByTitle(sec.title);
			}
		},
	};
})(window.wp);
