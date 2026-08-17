(function (wp) {
	'use strict';

	if (!wp || !wp.plugins || !wp.element) {
		return;
	}

	var editPostApi = wp.editPost || null;
	var editorApi = wp.editor || null;
	if (!editPostApi && !editorApi) {
		return;
	}

	var registerPlugin = wp.plugins.registerPlugin;
	var PluginSidebar = (editorApi && editorApi.PluginSidebar) || (editPostApi && editPostApi.PluginSidebar);
	var PluginSidebarMoreMenuItem = (editorApi && editorApi.PluginSidebarMoreMenuItem) || (editPostApi && editPostApi.PluginSidebarMoreMenuItem);
	var createElement = wp.element.createElement;
	var useEffect = wp.element.useEffect;
	var useRef = wp.element.useRef;
	var Fragment = wp.element.Fragment;

	if (!PluginSidebar || !PluginSidebarMoreMenuItem) {
		return;
	}

	function cfg() {
		return window.neoPulseWpAi || {};
	}

	function str(key, fallback) {
		var strings = cfg().strings || {};
		return strings[key] || fallback;
	}

	function NeoPulseAiSidebar() {
		var ref = useRef(null);
		var controllerRef = useRef(null);

		useEffect(function () {
			if (!ref.current || !window.NeoPulseAiController) {
				return undefined;
			}
			var controller = new window.NeoPulseAiController(ref.current, {
				postId: cfg().postId,
				layout: 'sidebar',
			});
			controllerRef.current = controller;
			window.neoPulseWpAiController = controller;
			controller.mount();
			return function () {
				if (controllerRef.current && controllerRef.current.destroy) {
					controllerRef.current.destroy();
				}
				if (window.neoPulseWpAiController === controllerRef.current) {
					window.neoPulseWpAiController = null;
				}
				controllerRef.current = null;
				if (ref.current) {
					ref.current.innerHTML = '';
				}
			};
		}, []);

		return createElement(
			'div',
			{ className: 'neo-pulse-wp-ai-sidebar-wrap' },
			createElement('div', { ref: ref, className: 'neo-pulse-wp-ai-root' })
		);
	}

	registerPlugin('neo-pulse-wp-ai-sidebar', {
		render: function () {
			return createElement(
				Fragment,
				null,
				createElement(PluginSidebarMoreMenuItem, { target: 'neo-pulse-wp-ai-sidebar' }, str('title', 'NEO Pulse AI')),
				createElement(
					PluginSidebar,
					{
						name: 'neo-pulse-wp-ai-sidebar',
						title: str('title', 'NEO Pulse AI'),
						isPinnable: false,
					},
					createElement(NeoPulseAiSidebar)
				)
			);
		},
	});
})(window.wp);
