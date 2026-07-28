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
		return window.flowbieWpAi || {};
	}

	function str(key, fallback) {
		var s = cfg().strings || {};
		return s[key] || fallback;
	}

	function badgeForSection(sec, activeIndex) {
		if (!sec) return null;
		var status = sec.status || 'waiting';
		var cls = 'flowbie-body-canvas__badge flowbie-body-canvas__badge--' + status;
		if (sec.index === activeIndex) cls += ' flowbie-body-canvas__badge--active';
		return createElement('span', { className: cls }, str('bodyStatus' + status.charAt(0).toUpperCase() + status.slice(1), status));
	}

	function StickyHarnessPanel() {
		var _useState = useState(window.FlowbieBodyHarnessStore.state);
		var state = _useState[0];
		var setState = _useState[1];

		useEffect(function () {
			return window.FlowbieBodyHarnessStore.subscribe(function (st) {
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
				name: 'flowbie-body-harness-progress',
				title: str('bodyHarnessTitle', 'Body harness'),
				className: 'flowbie-body-canvas__panel',
			},
			createElement('p', { className: 'flowbie-body-canvas__phase' }, state.phase === 'planning' ? str('bodyPhasePlanning', 'Planning blueprint…') : str('bodyPhaseReady', 'Section progress')),
			createElement('div', { className: 'flowbie-body-canvas__track' },
				createElement('div', { className: 'flowbie-body-canvas__fill', style: { width: pct + '%' } })
			),
			createElement('p', { className: 'flowbie-body-canvas__counts' }, done + '/' + planned)
		);
	}

	var withHarnessBadge = createHigherOrderComponent(function (BlockListBlock) {
		return function (props) {
			if (props.name !== 'core/heading' || !props.attributes || Number(props.attributes.level) !== 2) {
				return createElement(BlockListBlock, props);
			}
			var store = window.FlowbieBodyHarnessStore.state;
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
				{ className: 'flowbie-body-canvas__block-wrap' + (store.activeIndex === (sec ? sec.index : -1) ? ' flowbie-body-canvas__block-wrap--active' : '') },
				createElement(BlockListBlock, props),
				sec ? badgeForSection(sec, store.activeIndex) : null
			);
		};
	}, 'withFlowbieHarnessBadge');

	registerPlugin('flowbie-body-harness-panel', { render: StickyHarnessPanel });
	wp.hooks.addFilter('editor.BlockListBlock', 'flowbie-wp/body-harness-badge', withHarnessBadge);

	window.FlowbieBodyHarnessCanvas = {
		scrollToSection: function (index) {
			var sec = (window.FlowbieBodyHarnessStore.state.sections || []).find(function (s) {
				return s.index === index;
			});
			if (sec && window.FlowbieBodyHarnessApply) {
				window.FlowbieBodyHarnessApply.scrollToSectionByTitle(sec.title);
			}
		},
	};
})(window.wp);
