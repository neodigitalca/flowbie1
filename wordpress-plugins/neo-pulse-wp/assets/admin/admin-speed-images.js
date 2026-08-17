(function () {
	'use strict';

	var cfg = window.neoPulseWpSpeedImages;
	if (!cfg || !cfg.root) {
		return;
	}

	var startBtn = document.getElementById('neo-pulse-speed-images-bulk-start');
	var forceEl = document.getElementById('neo-pulse-speed-images-bulk-force');
	var box = document.getElementById('neo-pulse-speed-images-bulk');
	if (!startBtn || !box) {
		return;
	}

	var statusEl = box.querySelector('.neo-pulse-speed-images-bulk__status');
	var bar = box.querySelector('.neo-pulse-speed-images-bulk__bar');
	var running = false;
	var page = 1;
	var initialPending = parseInt(box.getAttribute('data-pending') || '0', 10);
	var totalEstimate = initialPending > 0 ? initialPending : 1;
	var processedTotal = 0;

	function setStatus(text) {
		if (statusEl) {
			statusEl.textContent = text;
		}
	}

	function setProgress() {
		if (!bar) {
			return;
		}
		var pct = totalEstimate > 0 ? Math.min(100, Math.round((processedTotal / totalEstimate) * 100)) : 0;
		bar.value = pct;
	}

	function postBatch(force) {
		return fetch(cfg.root + '/batch', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': cfg.nonce,
			},
			body: JSON.stringify({
				page: page,
				per_page: cfg.perPage || 5,
				force: !!force,
			}),
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('batch failed');
			}
			return res.json();
		});
	}

	function runLoop(force) {
		if (!running) {
			return;
		}
		setStatus(cfg.strings.running || 'Optimizing…');
		postBatch(force)
			.then(function (data) {
				var batch = data.batch || {};
				var count = batch.processed || 0;
				processedTotal += count;
				if (typeof data.pending === 'number') {
					totalEstimate = processedTotal + data.pending;
				}
				setProgress();

				if (batch.done || count === 0) {
					running = false;
					startBtn.disabled = false;
					setStatus(cfg.strings.done || 'Complete.');
					if (bar) {
						bar.value = 100;
					}
					return;
				}
				page += 1;
				runLoop(force);
			})
			.catch(function () {
				running = false;
				startBtn.disabled = false;
				setStatus(cfg.strings.error || 'Error.');
			});
	}

	startBtn.addEventListener('click', function () {
		if (running) {
			return;
		}
		var force = forceEl && forceEl.checked;
		running = true;
		page = 1;
		processedTotal = 0;
		totalEstimate = initialPending > 0 ? initialPending : 1;
		startBtn.disabled = true;
		setProgress();
		runLoop(force);
	});
})();
