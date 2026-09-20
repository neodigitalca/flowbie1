(function (wp) {
	'use strict';

	if (!wp || !wp.plugins || !wp.element) {
		return;
	}

	function resolveSidebarApi() {
		var editPostApi = wp.editPost || null;
		var editorApi = wp.editor || null;
		return {
			registerPlugin: wp.plugins.registerPlugin,
			PluginSidebar:
				(editorApi && editorApi.PluginSidebar) ||
				(editPostApi && editPostApi.PluginSidebar) ||
				(wp.plugins && wp.plugins.PluginSidebar),
			PluginSidebarMoreMenuItem:
				(editorApi && editorApi.PluginSidebarMoreMenuItem) ||
				(editPostApi && editPostApi.PluginSidebarMoreMenuItem) ||
				(wp.plugins && wp.plugins.PluginSidebarMoreMenuItem),
		};
	}

	function cfg() {
		return window.neoPulseWpAi || {};
	}

	function str(key, fallback) {
		var strings = cfg().strings || {};
		return strings[key] || fallback;
	}

	var createElement = wp.element.createElement;
	var useEffect = wp.element.useEffect;
	var useRef = wp.element.useRef;
	var Fragment = wp.element.Fragment;

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

	function boot() {
		var api = resolveSidebarApi();
		if (!api.registerPlugin || !api.PluginSidebar) {
			return;
		}
		api.registerPlugin('neo-pulse-wp-ai-sidebar', {
			render: function () {
				var items = [
					createElement(
						api.PluginSidebar,
						{
							name: 'neo-pulse-wp-ai-sidebar',
							title: str('title', 'NEO Pulse AI'),
							isPinnable: false,
						},
						createElement(NeoPulseAiSidebar)
					),
				];
				if (api.PluginSidebarMoreMenuItem) {
					items.unshift(
						createElement(api.PluginSidebarMoreMenuItem, { target: 'neo-pulse-wp-ai-sidebar' }, str('title', 'NEO Pulse AI'))
					);
				}
				return createElement(Fragment, null, items);
			},
		});
	}

	if (wp.domReady) {
		wp.domReady(boot);
	} else {
		boot();
	}
})(window.wp);
