(function () {
	'use strict';

	var cfg = window.neoPulseWpWelcome || {};
	var modal = document.getElementById('neo-pulse-welcome-modal');

	if (!modal) {
		return;
	}

	var backdrop = modal.querySelector('.neo-pulse-welcome-modal__backdrop');
	var closeBtn = document.getElementById('neo-pulse-welcome-modal-close');
	var exploreBtn = document.getElementById('neo-pulse-welcome-modal-explore');
	var laterBtn = document.getElementById('neo-pulse-welcome-modal-later');
	var ctaBtn = document.getElementById('neo-pulse-welcome-modal-cta');
	var dismissing = false;

	function openModal() {
		modal.removeAttribute('hidden');
		modal.classList.add('is-open');
		document.body.classList.add('neo-pulse-welcome-modal-open');
		if (closeBtn) {
			closeBtn.focus();
		}
	}

	function closeModal() {
		modal.setAttribute('hidden', 'hidden');
		modal.classList.remove('is-open');
		document.body.classList.remove('neo-pulse-welcome-modal-open');
	}

	function dismissWelcome(callback) {
		if (dismissing) {
			return;
		}
		dismissing = true;

		var form = new FormData();
		form.append('action', cfg.dismissAction || 'neo_pulse_wp_dismiss_welcome');
		form.append('nonce', cfg.nonce || '');

		fetch(cfg.ajaxUrl || '', {
			method: 'POST',
			body: form,
			credentials: 'same-origin',
		})
			.then(function () {
				closeModal();
				if (typeof callback === 'function') {
					callback();
				}
			})
			.catch(function () {
				closeModal();
				if (typeof callback === 'function') {
					callback();
				}
			})
			.finally(function () {
				dismissing = false;
			});
	}

	function onDismissOnly() {
		dismissWelcome();
	}

	function onCtaClick(event) {
		event.preventDefault();
		var url = (ctaBtn && ctaBtn.getAttribute('href')) || cfg.superImportUrl || '';
		dismissWelcome(function () {
			if (url) {
				window.location.href = url;
			}
		});
	}

	if (closeBtn) {
		closeBtn.addEventListener('click', onDismissOnly);
	}
	if (exploreBtn) {
		exploreBtn.addEventListener('click', onDismissOnly);
	}
	if (laterBtn) {
		laterBtn.addEventListener('click', onDismissOnly);
	}
	if (backdrop) {
		backdrop.addEventListener('click', onDismissOnly);
	}
	if (ctaBtn) {
		ctaBtn.addEventListener('click', onCtaClick);
	}

	document.addEventListener('keydown', function (event) {
		if (event.key === 'Escape' && modal.classList.contains('is-open')) {
			onDismissOnly();
		}
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', openModal);
	} else {
		openModal();
	}
})();
