(function () {
	'use strict';

	function initAccordion(root) {
		if (!root || root.getAttribute('data-neo-pulse-faq-layout') !== 'accordion') {
			return;
		}

		var allowMultiple = root.getAttribute('data-neo-pulse-faq-allow-multiple') === '1';
		var items = root.querySelectorAll('[data-neo-pulse-faq-item]');

		items.forEach(function (item) {
			var trigger = item.querySelector('.neo-pulse-faq__trigger');
			var panel = item.querySelector('.neo-pulse-faq__panel');
			if (!trigger || !panel) {
				return;
			}

			trigger.addEventListener('click', function () {
				var isOpen = item.classList.contains('neo-pulse-faq__item--open');

				if (!allowMultiple && !isOpen) {
					items.forEach(function (other) {
						if (other === item) {
							return;
						}
						other.classList.remove('neo-pulse-faq__item--open');
						var otherTrigger = other.querySelector('.neo-pulse-faq__trigger');
						var otherPanel = other.querySelector('.neo-pulse-faq__panel');
						if (otherTrigger) {
							otherTrigger.setAttribute('aria-expanded', 'false');
						}
						if (otherPanel) {
							otherPanel.hidden = true;
						}
					});
				}

				if (isOpen) {
					item.classList.remove('neo-pulse-faq__item--open');
					trigger.setAttribute('aria-expanded', 'false');
					panel.hidden = true;
				} else {
					item.classList.add('neo-pulse-faq__item--open');
					trigger.setAttribute('aria-expanded', 'true');
					panel.hidden = false;
				}
			});
		});
	}

	function initAll(scope) {
		var context = scope && scope.querySelectorAll ? scope : document;
		context.querySelectorAll('[data-neo-pulse-faq]').forEach(initAccordion);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () {
			initAll(document);
		});
	} else {
		initAll(document);
	}

	if (typeof window.elementorFrontend !== 'undefined' && window.elementorFrontend.hooks) {
		window.elementorFrontend.hooks.addAction('frontend/element_ready/neo-pulse_faq.default', function ($scope) {
			var el = $scope && $scope[0] ? $scope[0] : null;
			if (el) {
				initAll(el);
			}
		});
	}
})();
