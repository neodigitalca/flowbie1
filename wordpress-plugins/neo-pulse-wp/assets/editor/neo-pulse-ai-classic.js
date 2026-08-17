(function () {
	'use strict';

	document.addEventListener('DOMContentLoaded', function () {
		var root = document.getElementById('neo-pulse-wp-ai-classic-root');
		if (!root || !window.NeoPulseAiController) {
			return;
		}
		var controller = new window.NeoPulseAiController(root, {
			postId: root.getAttribute('data-post-id') || (window.neoPulseWpAi && neoPulseWpAi.postId),
			layout: 'sidebar',
		});
		window.neoPulseWpAiController = controller;
		controller.mount();
	});
})();
