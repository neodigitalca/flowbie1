(function () {
	'use strict';

	function getConfig(formId) {
		var key = 'flowbieFormsConfig_' + formId;
		return window[key] || null;
	}

	function showMessage(wrap, text, isError) {
		var box = wrap.querySelector('.flowbie-form__messages');
		if (!box) return;
		box.hidden = false;
		box.textContent = text;
		box.classList.remove('is-success', 'is-error');
		box.classList.add(isError ? 'is-error' : 'is-success');
	}

	function clearErrors(form) {
		form.querySelectorAll('.flowbie-form__field').forEach(function (el) {
			el.classList.remove('has-error');
			var err = el.querySelector('.flowbie-form__error');
			if (err) {
				err.hidden = true;
				err.textContent = '';
			}
		});
	}

	function showFieldErrors(form, errors) {
		if (!errors) return;
		Object.keys(errors).forEach(function (name) {
			var field = form.querySelector('[data-field="' + name + '"]');
			if (!field) return;
			field.classList.add('has-error');
			var err = field.querySelector('.flowbie-form__error');
			if (err) {
				err.hidden = false;
				err.textContent = errors[name];
			}
		});
	}

	function readOverseerSessionId() {
		try {
			return localStorage.getItem('flowbie_overseer_session') || '';
		} catch (e) {
			return '';
		}
	}

	function readOverseerVisitUid() {
		var key = 'flowbie_overseer_visit:' + window.location.pathname;
		try {
			return sessionStorage.getItem(key) || '';
		} catch (e2) {
			return '';
		}
	}

	function appendOverseerTracking(fd) {
		var sessionId = readOverseerSessionId();
		var visitUid = readOverseerVisitUid();
		if (sessionId) {
			fd.append('overseer_session_id', sessionId);
		}
		if (visitUid) {
			fd.append('overseer_visit_uid', visitUid);
		}
	}

	document.querySelectorAll('.flowbie-form').forEach(function (wrap) {
		var formId = parseInt(wrap.getAttribute('data-form-id'), 10);
		var cfg = getConfig(formId);
		var form = wrap.querySelector('.flowbie-form__form');
		if (!form || !cfg) return;

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			clearErrors(form);

			var btn = form.querySelector('.flowbie-form__button');
			if (btn) btn.disabled = true;

			var fd = new FormData(form);
			fd.append('source_url', window.location.href);
			appendOverseerTracking(fd);

			fetch(cfg.restUrl, {
				method: 'POST',
				headers: {
					'X-Flowbie-Form-Nonce': cfg.nonce
				},
				body: fd,
				credentials: 'same-origin'
			})
				.then(function (res) {
					return res.json().then(function (data) {
						return { ok: res.ok, data: data };
					});
				})
				.then(function (result) {
					var data = result.data || {};
					if (data.success) {
						showMessage(wrap, data.message || 'Thank you.', false);
						form.reset();
						if (data.redirect_url) {
							window.setTimeout(function () {
								window.location.href = data.redirect_url;
							}, 800);
						}
					} else {
						showMessage(wrap, data.message || 'Submission failed.', true);
						showFieldErrors(form, data.errors);
					}
				})
				.catch(function () {
					showMessage(wrap, 'Network error. Please try again.', true);
				})
				.finally(function () {
					if (btn) btn.disabled = false;
				});
		});
	});
})();
