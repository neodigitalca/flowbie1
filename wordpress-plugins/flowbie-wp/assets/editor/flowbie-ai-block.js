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
		return window.flowbieWpAi || {};
	}

	function str(key, fallback) {
		var strings = cfg().strings || {};
		return strings[key] || fallback;
	}

	function FlowbieAiSidebar() {
		var ref = useRef(null);
		var controllerRef = useRef(null);

		useEffect(function () {
			if (!ref.current || !window.FlowbieAiController) {
				return undefined;
			}
			var controller = new window.FlowbieAiController(ref.current, {
				postId: cfg().postId,
				layout: 'sidebar',
			});
			controllerRef.current = controller;
			window.flowbieWpAiController = controller;
			controller.mount();
			return function () {
				if (controllerRef.current && controllerRef.current.destroy) {
					controllerRef.current.destroy();
				}
				if (window.flowbieWpAiController === controllerRef.current) {
					window.flowbieWpAiController = null;
				}
				controllerRef.current = null;
				if (ref.current) {
					ref.current.innerHTML = '';
				}
			};
		}, []);

		return createElement(
			'div',
			{ className: 'flowbie-wp-ai-sidebar-wrap' },
			createElement('div', { ref: ref, className: 'flowbie-wp-ai-root' })
		);
	}

	registerPlugin('flowbie-wp-ai-sidebar', {
		render: function () {
			return createElement(
				Fragment,
				null,
				createElement(PluginSidebarMoreMenuItem, { target: 'flowbie-wp-ai-sidebar' }, str('title', 'Flowbie AI')),
				createElement(
					PluginSidebar,
					{
						name: 'flowbie-wp-ai-sidebar',
						title: str('title', 'Flowbie AI'),
						isPinnable: false,
					},
					createElement(FlowbieAiSidebar)
				)
			);
		},
	});
})(window.wp);
