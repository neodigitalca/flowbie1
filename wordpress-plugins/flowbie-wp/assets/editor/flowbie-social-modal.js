(function () {
	'use strict';

	var PLATFORMS = {
		gmb:       { label: 'Google Business Profile', maxChars: 1500,  maxWords: 150, hashtags: false, cta: true },
		facebook:  { label: 'Facebook',                maxChars: 2000,  maxWords: 200, hashtags: true,  cta: true },
		instagram: { label: 'Instagram',               maxChars: 2200,  maxWords: 200, hashtags: true,  cta: true },
		linkedin:  { label: 'LinkedIn',                maxChars: 3000,  maxWords: 250, hashtags: true,  cta: true },
		x:         { label: 'X (Twitter)',             maxChars: 280,   maxWords: 40,  hashtags: true,  cta: false },
	};

	var state = {
		open: false,
		postId: 0,
		platform: 'gmb',
		postTitle: '',
		postExcerpt: '',
		postUrl: '',
		imageUrl: null,
		summary: '',
		generating: false,
		publishing: false,
		published: false,
		error: '',
	};

	var overlayEl = null;

	function el(tag, cls, text) {
		var node = document.createElement(tag);
		if (cls) node.className = cls;
		if (text !== undefined && text !== null) node.textContent = text;
		return node;
	}

	function buildOverlay() {
		var overlay = el('div', 'flowbie-social-modal');
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) close();
		});

		var panel = el('div', 'flowbie-social-modal__panel');

		/* header */
		var header = el('div', 'flowbie-social-modal__header');
		header.appendChild(el('h2', 'flowbie-social-modal__title', 'Social Media Module'));
		var closeBtn = el('button', 'flowbie-social-modal__close', '\u00D7');
		closeBtn.type = 'button';
		closeBtn.addEventListener('click', close);
		header.appendChild(closeBtn);
		panel.appendChild(header);

		/* body */
		var body = el('div', 'flowbie-social-modal__body');
		body.setAttribute('id', 'flowbie-social-modal-body');
		panel.appendChild(body);

		overlay.appendChild(panel);
		return overlay;
	}

	function renderBody() {
		var body = document.getElementById('flowbie-social-modal-body');
		if (!body) return;
		body.innerHTML = '';

		/* platform selector */
		var platformSection = el('div', 'flowbie-social-modal__section');
		platformSection.appendChild(el('label', 'flowbie-social-modal__label', 'Platform'));
		var select = document.createElement('select');
		select.className = 'flowbie-social-modal__select';
		Object.keys(PLATFORMS).forEach(function (key) {
			var opt = document.createElement('option');
			opt.value = key;
			opt.textContent = PLATFORMS[key].label;
			if (key === state.platform) opt.selected = true;
			select.appendChild(opt);
		});
		select.addEventListener('change', function () {
			state.platform = select.value;
			state.summary = '';
			state.published = false;
			state.error = '';
			renderBody();
		});
		platformSection.appendChild(select);

		var pc = PLATFORMS[state.platform];
		var constraintLine = 'Max ' + pc.maxChars + ' chars / ' + pc.maxWords + ' words';
		if (pc.hashtags) constraintLine += ' · hashtags OK';
		if (pc.cta) constraintLine += ' · CTA included';
		platformSection.appendChild(el('p', 'flowbie-social-modal__hint', constraintLine));
		body.appendChild(platformSection);

		/* image preview */
		if (state.imageUrl) {
			var imgSection = el('div', 'flowbie-social-modal__section');
			imgSection.appendChild(el('label', 'flowbie-social-modal__label', 'Featured Image'));
			var img = document.createElement('img');
			img.src = state.imageUrl;
			img.className = 'flowbie-social-modal__image-preview';
			img.alt = 'Featured image';
			imgSection.appendChild(img);
			body.appendChild(imgSection);
		}

		/* post info */
		var infoSection = el('div', 'flowbie-social-modal__section');
		infoSection.appendChild(el('label', 'flowbie-social-modal__label', 'Source Post'));
		infoSection.appendChild(el('p', 'flowbie-social-modal__post-title', state.postTitle));
		if (state.postUrl) {
			var link = el('a', 'flowbie-social-modal__post-url', state.postUrl.replace(/^https?:\/\//, ''));
			link.href = state.postUrl;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			infoSection.appendChild(link);
		}
		body.appendChild(infoSection);

		/* generated copy */
		var copySection = el('div', 'flowbie-social-modal__section');
		copySection.appendChild(el('label', 'flowbie-social-modal__label', pc.label + ' Copy'));

		var textarea = document.createElement('textarea');
		textarea.className = 'flowbie-social-modal__textarea';
		textarea.rows = 6;
		textarea.value = state.summary;
		textarea.placeholder = state.generating ? 'Generating…' : 'Click "Generate" to create optimized copy for ' + pc.label;
		textarea.disabled = state.generating;
		textarea.addEventListener('input', function () {
			state.summary = textarea.value;
			updateCounter();
		});
		copySection.appendChild(textarea);

		var counter = el('div', 'flowbie-social-modal__counter');
		counter.setAttribute('id', 'flowbie-social-counter');
		copySection.appendChild(counter);
		body.appendChild(copySection);

		/* error */
		if (state.error) {
			body.appendChild(el('p', 'flowbie-social-modal__error', state.error));
		}

		/* success */
		if (state.published) {
			body.appendChild(el('p', 'flowbie-social-modal__success', 'Published to ' + pc.label + '!'));
		}

		/* actions */
		var actions = el('div', 'flowbie-social-modal__actions');

		var genBtn = el('button', 'flowbie-social-modal__btn flowbie-social-modal__btn--generate');
		genBtn.type = 'button';
		genBtn.textContent = state.generating ? 'Generating…' : 'Generate';
		genBtn.disabled = state.generating || state.publishing;
		genBtn.addEventListener('click', handleGenerate);
		actions.appendChild(genBtn);

		if (state.platform === 'gmb') {
			var pubBtn = el('button', 'flowbie-social-modal__btn flowbie-social-modal__btn--publish');
			pubBtn.type = 'button';
			pubBtn.textContent = state.publishing ? 'Publishing…' : 'Publish to GBP';
			pubBtn.disabled = !state.summary || state.generating || state.publishing || state.published;
			pubBtn.addEventListener('click', handlePublish);
			actions.appendChild(pubBtn);
		}

		body.appendChild(actions);

		updateCounter();
	}

	function updateCounter() {
		var counterEl = document.getElementById('flowbie-social-counter');
		if (!counterEl) return;
		var pc = PLATFORMS[state.platform];
		var len = (state.summary || '').length;
		var over = len > pc.maxChars;
		counterEl.textContent = len + ' / ' + pc.maxChars + ' characters';
		counterEl.className = 'flowbie-social-modal__counter' + (over ? ' flowbie-social-modal__counter--over' : '');
	}

	function handleGenerate() {
		state.generating = true;
		state.error = '';
		state.published = false;
		renderBody();

		wp.apiFetch({
			path: '/flowbie/v1/ai/social-generate',
			method: 'POST',
			data: { post_id: state.postId, platform: state.platform },
		}).then(function (res) {
			state.generating = false;
			if (res && res.ok) {
				state.summary = res.summary || '';
			} else {
				state.error = (res && res.error) || 'Generation failed.';
			}
			renderBody();
		}).catch(function (err) {
			state.generating = false;
			state.error = (err && err.message) || 'Generation failed.';
			renderBody();
		});
	}

	function handlePublish() {
		state.publishing = true;
		state.error = '';
		renderBody();

		wp.apiFetch({
			path: '/flowbie/v1/ai/gmb-post',
			method: 'POST',
			data: { post_id: state.postId, summary: state.summary },
		}).then(function (res) {
			state.publishing = false;
			if (res && res.ok) {
				state.published = true;
			} else {
				state.error = (res && res.error) || 'Publish failed.';
			}
			renderBody();
		}).catch(function (err) {
			state.publishing = false;
			state.error = (err && err.message) || 'Publish failed.';
			renderBody();
		});
	}

	function open(postId) {
		state.postId = postId;
		state.platform = 'gmb';
		state.summary = '';
		state.generating = false;
		state.publishing = false;
		state.published = false;
		state.error = '';
		state.postTitle = '';
		state.postExcerpt = '';
		state.postUrl = '';
		state.imageUrl = null;
		state.open = true;

		if (!overlayEl) {
			overlayEl = buildOverlay();
		}
		document.body.appendChild(overlayEl);

		/* Fetch post preview data */
		wp.apiFetch({
			path: '/flowbie/v1/ai/social-preview',
			method: 'POST',
			data: { post_id: postId },
		}).then(function (res) {
			if (res && res.ok && res.post) {
				state.postTitle = res.post.title || '';
				state.postExcerpt = res.post.excerpt || '';
				state.postUrl = res.post.url || '';
				state.imageUrl = res.post.image_url || null;
			}
			renderBody();
		}).catch(function () {
			renderBody();
		});

		renderBody();
	}

	function close() {
		state.open = false;
		if (overlayEl && overlayEl.parentNode) {
			overlayEl.parentNode.removeChild(overlayEl);
		}
	}

	window.FlowbieSocialMediaModal = {
		open: open,
		close: close,
	};
})();
