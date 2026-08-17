(function () {
	'use strict';

	var actions = { ready: [], append: [] };

	function doAction(name) {
		var list = actions[name] || [];
		list.forEach(function (fn) {
			try { fn(); } catch (e) { /* noop */ }
		});
	}

	function addAction(name, fn) {
		if (!actions[name]) actions[name] = [];
		actions[name].push(fn);
	}

	window.neoPulseAcfShim = {
		triggerReady: function () { doAction('ready'); doAction('append'); }
	};

	if (!window.acf) {
		window.acf = {
			addAction: addAction,
			doAction: doAction
		};
	}

	document.addEventListener('DOMContentLoaded', function () {
		doAction('ready');
	});

	if (window.jQuery) {
		window.jQuery(document).on('neo-pulse-fields-ready', function () {
			doAction('append');
		});
	}
})();
