(function () {
	'use strict';

	function initAccordion(root) {
		if (!root || root.getAttribute('data-flowbie-faq-layout') !== 'accordion') {
			return;
		}

		var allowMultiple = root.getAttribute('data-flowbie-faq-allow-multiple') === '1';
		var items = root.querySelectorAll('[data-flowbie-faq-item]');

		items.forEach(function (item) {
			var trigger = item.querySelector('.flowbie-faq__trigger');
			var panel = item.querySelector('.flowbie-faq__panel');
			if (!trigger || !panel) {
				return;
			}

			trigger.addEventListener('click', function () {
				var isOpen = item.classList.contains('flowbie-faq__item--open');

				if (!allowMultiple && !isOpen) {
					items.forEach(function (other) {
						if (other === item) {
							return;
						}
						other.classList.remove('flowbie-faq__item--open');
						var otherTrigger = other.querySelector('.flowbie-faq__trigger');
						var otherPanel = other.querySelector('.flowbie-faq__panel');
						if (otherTrigger) {
							otherTrigger.setAttribute('aria-expanded', 'false');
						}
						if (otherPanel) {
							otherPanel.hidden = true;
						}
					});
				}

				if (isOpen) {
					item.classList.remove('flowbie-faq__item--open');
					trigger.setAttribute('aria-expanded', 'false');
					panel.hidden = true;
				} else {
					item.classList.add('flowbie-faq__item--open');
					trigger.setAttribute('aria-expanded', 'true');
					panel.hidden = false;
				}
			});
		});
	}

	function initAll(scope) {
		var context = scope && scope.querySelectorAll ? scope : document;
		context.querySelectorAll('[data-flowbie-faq]').forEach(initAccordion);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () {
			initAll(document);
		});
	} else {
		initAll(document);
	}

	if (typeof window.elementorFrontend !== 'undefined' && window.elementorFrontend.hooks) {
		window.elementorFrontend.hooks.addAction('frontend/element_ready/flowbie_faq.default', function ($scope) {
			var el = $scope && $scope[0] ? $scope[0] : null;
			if (el) {
				initAll(el);
			}
		});
	}
})();
