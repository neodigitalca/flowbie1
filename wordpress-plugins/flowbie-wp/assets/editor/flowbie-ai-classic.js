(function () {
	'use strict';

	document.addEventListener('DOMContentLoaded', function () {
		var root = document.getElementById('flowbie-wp-ai-classic-root');
		if (!root || !window.FlowbieAiController) {
			return;
		}
		var controller = new window.FlowbieAiController(root, {
			postId: root.getAttribute('data-post-id') || (window.flowbieWpAi && flowbieWpAi.postId),
			layout: 'sidebar',
		});
		window.flowbieWpAiController = controller;
		controller.mount();
	});
})();
