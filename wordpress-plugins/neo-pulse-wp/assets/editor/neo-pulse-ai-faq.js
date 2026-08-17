(function () {
	'use strict';

	function decodeEntities(text) {
		var decoded = String(text || '')
			.replace(/&quot;/g, '"')
			.replace(/&#34;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&#39;/g, "'")
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>');
		if (typeof document !== 'undefined') {
			var ta = document.createElement('textarea');
			ta.innerHTML = decoded;
			decoded = ta.value;
		}
		return decoded;
	}

	function isSchemaStorage(raw) {
		var text = String(raw || '').trim();
		if (!text) return false;
		if (/FAQPage/i.test(text) && /mainEntity/i.test(text)) return true;
		if (/<script[^>]*application\/ld\+json/i.test(text)) return true;
		return false;
	}

	function stripHtmlTags(text) {
		return String(text || '').replace(/<[^>]+>/g, '');
	}

	function extractJsonText(raw) {
		var text = String(raw || '').trim();
		var scriptMatch = text.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
		if (scriptMatch && scriptMatch[1]) {
			return decodeEntities(scriptMatch[1].trim());
		}
		scriptMatch = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
		if (scriptMatch && scriptMatch[1]) {
			return decodeEntities(scriptMatch[1].trim());
		}
		var stripped = stripHtmlTags(text).trim();
		if (stripped.charAt(0) === '{' || stripped.charAt(0) === '[') {
			return decodeEntities(stripped);
		}
		return decodeEntities(text);
	}

	function extractBalancedJson(text) {
		var source = String(text || '');
		var start = source.indexOf('{');
		if (start < 0) return '';
		var depth = 0;
		var inString = false;
		var escape = false;
		for (var i = start; i < source.length; i++) {
			var ch = source.charAt(i);
			if (inString) {
				if (escape) {
					escape = false;
				} else if (ch === '\\') {
					escape = true;
				} else if (ch === '"') {
					inString = false;
				}
				continue;
			}
			if (ch === '"') {
				inString = true;
				continue;
			}
			if (ch === '{') depth++;
			if (ch === '}') {
				depth--;
				if (depth === 0) {
					return source.slice(start, i + 1);
				}
			}
		}
		return '';
	}

	function typeIncludesFaqPage(typeValue) {
		var types = Array.isArray(typeValue) ? typeValue : [typeValue];
		return types.some(function (t) {
			return String(t || '').toLowerCase() === 'faqpage';
		});
	}

	function typeIncludesQuestion(typeValue) {
		var types = Array.isArray(typeValue) ? typeValue : [typeValue];
		return types.some(function (t) {
			return String(t || '').toLowerCase() === 'question';
		});
	}

	function readQuestion(node) {
		if (!node || typeof node !== 'object') return '';
		if (typeof node.name === 'string') return node.name.trim();
		if (typeof node.question === 'string') return node.question.trim();
		if (typeof node.headline === 'string') return node.headline.trim();
		return '';
	}

	function readAnswer(node) {
		if (!node || typeof node !== 'object') return '';
		var accepted = node.acceptedAnswer;
		if (accepted && typeof accepted === 'object') {
			if (typeof accepted.text === 'string') return accepted.text.trim();
			if (typeof accepted.description === 'string') return accepted.description.trim();
		}
		if (typeof node.answer === 'string') return node.answer.trim();
		return '';
	}

	function pushEntry(entries, question, answer) {
		var q = String(question || '').trim();
		var a = String(answer || '').trim();
		if (!q && !a) return;
		entries.push({ question: q, answer: a });
	}

	function collectFromMainEntity(mainEntity, entries) {
		if (!Array.isArray(mainEntity)) return;
		mainEntity.forEach(function (q) {
			var question = readQuestion(q);
			var answer = readAnswer(q);
			if (question || answer) {
				pushEntry(entries, question, answer);
			}
		});
	}

	function collectFaqNodes(node, entries) {
		if (!node || typeof node !== 'object') return;
		if (typeIncludesQuestion(node['@type'])) {
			pushEntry(entries, readQuestion(node), readAnswer(node));
			return;
		}
		if (typeIncludesFaqPage(node['@type']) && Array.isArray(node.mainEntity)) {
			collectFromMainEntity(node.mainEntity, entries);
		}
		if (Array.isArray(node.mainEntity) && !typeIncludesFaqPage(node['@type'])) {
			collectFromMainEntity(node.mainEntity, entries);
		}
		if (Array.isArray(node['@graph'])) {
			node['@graph'].forEach(function (child) {
				collectFaqNodes(child, entries);
			});
		}
	}

	function parseFaqEntriesFromLineObjects(rawFaq) {
		var entries = [];
		String(rawFaq || '').split(/\r?\n/).forEach(function (line) {
			var trimmed = line.trim();
			if (!trimmed || trimmed.charAt(0) !== '{') return;
			try {
				var obj = JSON.parse(trimmed);
				if (typeIncludesQuestion(obj['@type'])) {
					pushEntry(entries, readQuestion(obj), readAnswer(obj));
					return;
				}
				collectFaqNodes(obj, entries);
			} catch (e) { /* skip line */ }
		});
		return entries;
	}

	function parseFaqEntriesFromJson(parsed) {
		var entries = [];
		var nodes = Array.isArray(parsed) ? parsed : [parsed];
		nodes.forEach(function (node) {
			collectFaqNodes(node, entries);
		});
		return entries;
	}

	function unescapeJsonString(value) {
		return String(value || '')
			.replace(/\\n/g, '\n')
			.replace(/\\r/g, '\r')
			.replace(/\\t/g, '\t')
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, '\\');
	}

	function parseFaqEntriesFromRegex(rawFaq) {
		var text = decodeEntities(stripHtmlTags(String(rawFaq || '')));
		var entries = [];
		var blockRe = /"name"\s*:\s*"((?:\\.|[^"\\])*)"\s*,[\s\S]*?"acceptedAnswer"\s*:\s*\{[\s\S]*?"text"\s*:\s*"((?:\\.|[^"\\])*)"/gi;
		var match;
		while ((match = blockRe.exec(text))) {
			pushEntry(entries, unescapeJsonString(match[1]), unescapeJsonString(match[2]));
		}
		return entries;
	}

	function parseFaqEntries(rawFaq) {
		if (!rawFaq || !String(rawFaq).trim()) {
			return [];
		}

		var schemaLike = isSchemaStorage(rawFaq);
		var candidates = [
			extractJsonText(rawFaq),
			extractBalancedJson(stripHtmlTags(rawFaq)),
			extractBalancedJson(String(rawFaq)),
		];

		for (var i = 0; i < candidates.length; i++) {
			var candidate = candidates[i];
			if (!candidate) continue;
			try {
				var parsed = JSON.parse(candidate);
				var entries = parseFaqEntriesFromJson(parsed);
				if (entries.length) return entries;
			} catch (e) { /* try next */ }
		}

		if (schemaLike) {
			var lineObjects = parseFaqEntriesFromLineObjects(rawFaq);
			if (lineObjects.length) return lineObjects;
			var regexEntries = parseFaqEntriesFromRegex(rawFaq);
			if (regexEntries.length) return regexEntries;
			return [];
		}

		var lineObjects = parseFaqEntriesFromLineObjects(rawFaq);
		if (lineObjects.length) return lineObjects;

		var lines = String(rawFaq).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
		var out = [];
		var current = null;

		lines.forEach(function (line) {
			if (/^Q[:\-]/i.test(line)) {
				if (current) out.push(current);
				current = { question: line.replace(/^Q[:\-]\s*/i, '').trim(), answer: '' };
			} else if (/^A[:\-]/i.test(line)) {
				if (!current) {
					current = { question: '', answer: line.replace(/^A[:\-]\s*/i, '').trim() };
				} else {
					current.answer = line.replace(/^A[:\-]\s*/i, '').trim();
				}
			} else if (current && current.question && !current.answer) {
				current.question = (current.question + ' ' + line).trim();
			} else if (current && current.answer) {
				current.answer = (current.answer + ' ' + line).trim();
			} else {
				current = { question: line, answer: '' };
			}
		});
		if (current) out.push(current);

		return out.filter(function (e) {
			return e.question || e.answer;
		});
	}

	function getFaqSource(ctrl) {
		return ctrl._faqStorageBase || ctrl.saved.faq || ctrl.draft.faq || '';
	}

	function serializeFaqEntries(entries) {
		var lines = [];
		(entries || []).forEach(function (e) {
			if (!e.question && !e.answer) return;
			lines.push('Q: ' + (e.question || ''));
			lines.push('A: ' + (e.answer || ''));
		});
		return lines.join('\n');
	}

	function entriesToStorage(entries, originalRaw) {
		var cleaned = (entries || []).map(function (e) {
			return {
				question: String(e.question || '').trim(),
				answer: String(e.answer || '').trim(),
			};
		}).filter(function (e) {
			return e.question || e.answer;
		});

		if (!cleaned.length) {
			return isSchemaStorage(originalRaw) ? String(originalRaw || '').trim() : '';
		}

		if (!isSchemaStorage(originalRaw)) {
			return serializeFaqEntries(cleaned);
		}

		try {
			var jsonText = extractJsonText(originalRaw) || extractBalancedJson(originalRaw);
			var parsed = JSON.parse(jsonText);
			var root = parsed;
			if (Array.isArray(parsed)) {
				root = parsed.find(function (n) {
					return n && typeIncludesFaqPage(n['@type']);
				}) || parsed[0];
			}
			if (!root || typeof root !== 'object') {
				return serializeFaqEntries(cleaned);
			}
			root['@context'] = root['@context'] || 'https://schema.org';
			root['@type'] = root['@type'] || 'FAQPage';
			root.mainEntity = cleaned.map(function (e) {
				return {
					'@type': 'Question',
					name: e.question,
					acceptedAnswer: {
						'@type': 'Answer',
						text: e.answer,
					},
				};
			});
			var jsonString = JSON.stringify(root);
			if (/<script[^>]*application\/ld\+json/i.test(String(originalRaw))) {
				return '<script type="application/ld+json">' + jsonString + '</script>';
			}
			return jsonString;
		} catch (e) {
			return serializeFaqEntries(cleaned);
		}
	}

	function mergeAiFaqIntoStorage(aiText, originalRaw) {
		var entries = parseFaqEntries(aiText);
		if (!entries.length) {
			return String(aiText || '').trim();
		}
		return entriesToStorage(entries, originalRaw);
	}

	function readEntriesFromRow(row) {
		var entries = [];
		row.querySelectorAll('.neo-pulse-wp-ai-faq-item').forEach(function (item) {
			var q = item.querySelector('[data-faq-q]');
			var a = item.querySelector('[data-faq-a]');
			entries.push({
				question: q ? q.value : '',
				answer: a ? a.value : '',
			});
		});
		return entries;
	}

	function syncRowToDraft(ctrl, row) {
		var base = ctrl._faqStorageBase != null ? ctrl._faqStorageBase : (ctrl.saved.faq || '');
		ctrl.draft.faq = entriesToStorage(readEntriesFromRow(row), base);
		row.classList.toggle('is-dirty', window.NeoPulseAiShared.isFieldDirty(ctrl, 'faq'));
		var applyLink = row.querySelector('.neo-pulse-wp-ai-editor-row__apply');
		if (applyLink) {
			applyLink.style.display = window.NeoPulseAiShared.isFieldDirty(ctrl, 'faq') && ctrl.status && ctrl.status.canApply ? '' : 'none';
		}
		if (window.NeoPulseAiModal && window.NeoPulseAiModal.updateModalFooter) {
			window.NeoPulseAiModal.updateModalFooter(ctrl);
		}
	}

	function faqContextPayload(ctrl) {
		return {
			seoResearch: ctrl.draft.seoResearch || ctrl.saved.seoResearch || '',
			focusKeyword: ctrl.draft.focusKeyword || ctrl.saved.focusKeyword || '',
			seoTitle: ctrl.draft.seoTitle || ctrl.saved.seoTitle || '',
			metaDescription: ctrl.draft.metaDescription || ctrl.saved.metaDescription || '',
			faq: ctrl.draft.faq || ctrl.saved.faq || '',
		};
	}

	function apiFaqStep(ctrl, step, extra) {
		var S = window.NeoPulseAiShared;
		var payload = {
			post_id: ctrl.postId,
			field: 'faq',
			faqStep: step,
			context: faqContextPayload(ctrl),
		};
		if (extra) {
			Object.keys(extra).forEach(function (key) {
				payload[key] = extra[key];
			});
		}
		return S.api('/neo-pulse/v1/ai/preview', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	}

	function setFaqWandLoading(row, loading, label) {
		if (!row) return;
		var btn = row.querySelector('.neo-pulse-wp-ai-spark-btn');
		if (!btn) return;
		btn.disabled = !!loading;
		btn.classList.toggle('is-loading', !!loading);
		if (label) {
			btn.setAttribute('aria-label', label);
			btn.title = label;
		}
	}

	function mountFaqAccordion(ctrl, row, entries, openIndex) {
		var D = window.NeoPulseAiDom;
		var S = window.NeoPulseAiShared;
		var str = S.str;
		var el = D.el;
		var accordion = row.querySelector('.neo-pulse-wp-ai-faq-accordion');
		if (!accordion) return;

		accordion.innerHTML = '';
		(entries || []).forEach(function (entry, index) {
			var item = el('div', 'neo-pulse-wp-ai-faq-item' + (index === openIndex ? ' is-open' : ''));
			var triggerLabel = entry.question || (str('faqQuestion', 'Question') + ' ' + (index + 1));
			var trigger = el('button', 'neo-pulse-wp-ai-faq-item__trigger', triggerLabel);
			trigger.type = 'button';
			trigger.setAttribute('aria-expanded', index === openIndex ? 'true' : 'false');
			trigger.title = triggerLabel;

			var panel = el('div', 'neo-pulse-wp-ai-faq-item__panel');
			panel.appendChild(el('label', 'neo-pulse-wp-ai-faq-item__label', str('faqQuestion', 'Question')));
			var qInput = document.createElement('input');
			qInput.type = 'text';
			qInput.className = 'neo-pulse-wp-ai-editor-row__input widefat';
			qInput.setAttribute('data-faq-q', '1');
			qInput.value = entry.question || '';
			panel.appendChild(qInput);

			panel.appendChild(el('label', 'neo-pulse-wp-ai-faq-item__label', str('faqAnswer', 'Answer')));
			var aInput = document.createElement('textarea');
			aInput.className = 'neo-pulse-wp-ai-editor-row__input widefat';
			aInput.rows = 5;
			aInput.setAttribute('data-faq-a', '1');
			aInput.value = entry.answer || '';
			panel.appendChild(aInput);

			function refreshTriggerLabel() {
				var labelText = qInput.value.trim() || (str('faqQuestion', 'Question') + ' ' + (index + 1));
				trigger.textContent = labelText;
				trigger.title = labelText;
			}

			function onEdit() {
				refreshTriggerLabel();
				syncRowToDraft(ctrl, row);
			}

			qInput.addEventListener('input', onEdit);
			aInput.addEventListener('input', onEdit);

			trigger.addEventListener('click', function () {
				var open = item.classList.toggle('is-open');
				trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
			});

			item.appendChild(trigger);
			item.appendChild(panel);
			accordion.appendChild(item);
		});
	}

	function runFaqWand(ctrl) {
		var S = window.NeoPulseAiShared;
		var str = S.str;
		var brief = (ctrl.draft.seoResearch || ctrl.saved.seoResearch || '').trim();
		if (!brief) {
			window.alert(str('faqWandNeedResearch', 'Run SEO research first or paste a research brief.'));
			return Promise.resolve();
		}
		if (!ctrl.metaEditorOverlay) return Promise.resolve();
		var row = ctrl.metaEditorOverlay.querySelector('[data-content-row="faq"]');
		if (!row) return Promise.resolve();
		if (ctrl.faqWandRunning) return Promise.resolve();

		ctrl.faqWandRunning = true;
		syncRowToDraft(ctrl, row);
		setFaqWandLoading(row, true, str('faqWandRunning', 'Generating FAQs from research…'));

		var entries = parseFaqEntries(getFaqSource(ctrl));
		var chain = Promise.resolve();

		chain = chain.then(function () {
			setFaqWandLoading(row, true, str('faqWandSeeding', 'Creating FAQ pairs…'));
			return apiFaqStep(ctrl, 'seed', { pairCount: 4 }).then(function (body) {
				entries = parseFaqEntries(body.value || '');
				if (!entries.length) {
					throw new Error(str('faqWandParseFailed', 'Could not parse generated FAQ pairs.'));
				}
				mountFaqAccordion(ctrl, row, entries, 0);
				syncRowToDraft(ctrl, row);
			});
		});

		chain = chain.then(function () {
			var stepChain = Promise.resolve();
			for (var i = 0; i < entries.length; i++) {
				(function (faqIndex) {
					stepChain = stepChain.then(function () {
						var entry = entries[faqIndex];
						if (!entry) return;
						setFaqWandLoading(
							row,
							true,
							str('faqWandStep', 'Optimizing FAQ') + ' ' + (faqIndex + 1) + '/' + entries.length
						);
						mountFaqAccordion(ctrl, row, entries, faqIndex);
						var block = serializeFaqEntries(entries);
						return apiFaqStep(ctrl, 'question', {
							faqQuestion: entry.question,
							faqAnswer: entry.answer,
							faqBlock: block,
						}).then(function (body) {
							entry.question = String(body.value || entry.question || '').trim();
							entries[faqIndex] = entry;
							mountFaqAccordion(ctrl, row, entries, faqIndex);
							syncRowToDraft(ctrl, row);
							return apiFaqStep(ctrl, 'answer', {
								faqQuestion: entry.question,
								faqAnswer: entry.answer,
								faqBlock: serializeFaqEntries(entries),
							});
						}).then(function (body) {
							entry.answer = String(body.value || entry.answer || '').trim();
							entries[faqIndex] = entry;
							mountFaqAccordion(ctrl, row, entries, faqIndex);
							syncRowToDraft(ctrl, row);
						});
					});
				})(i);
			}
			return stepChain;
		});

		return chain.then(function () {
			ctrl.faqWandRunning = false;
			setFaqWandLoading(row, false, str('wandTitle', 'Enhance with NEO Pulse AI'));
		}).catch(function (err) {
			ctrl.faqWandRunning = false;
			setFaqWandLoading(row, false, str('wandTitle', 'Enhance with NEO Pulse AI'));
			window.alert(err.message || str('faqWandFailed', 'FAQ generation failed.'));
		});
	}

	function renderModalRow(ctrl, label) {
		var D = window.NeoPulseAiDom;
		var S = window.NeoPulseAiShared;
		var str = S.str;
		var el = D.el;
		var self = ctrl;
		var status = ctrl.status || {};
		var draftKey = 'faq';

		if (ctrl._faqStorageBase == null) {
			ctrl._faqStorageBase = ctrl.saved.faq || ctrl.draft.faq || '';
		}

		var source = getFaqSource(ctrl);
		var entries = parseFaqEntries(source);
		if (!entries.length) {
			entries = [{ question: '', answer: '' }];
		}

		var row = el('div', 'neo-pulse-wp-ai-editor-row neo-pulse-wp-ai-faq-editor' + (S.isFieldDirty(ctrl, draftKey) ? ' is-dirty' : ''));
		row.setAttribute('data-content-row', 'faq');

		var head = el('div', 'neo-pulse-wp-ai-editor-row__head');
		head.appendChild(el('label', 'neo-pulse-wp-ai-editor-row__label', label));

		var actions = el('div', 'neo-pulse-wp-ai-editor-row__actions');
		var copyBtn = el('button', 'neo-pulse-wp-ai-faq-copy button-link', str('copyFaqSchema', 'Copy all schema'));
		copyBtn.type = 'button';
		copyBtn.addEventListener('click', function () {
			syncRowToDraft(ctrl, row);
			var text = ctrl.draft.faq || ctrl._faqStorageBase || source || '';
			if (!text.trim()) return;
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(function () {
					copyBtn.textContent = str('copied', 'Copied!');
					setTimeout(function () {
						copyBtn.textContent = str('copyFaqSchema', 'Copy all schema');
					}, 1600);
				});
			}
		});
		actions.appendChild(copyBtn);

		var applyLink = el('button', 'neo-pulse-wp-ai-editor-row__apply button-link', str('applyField', 'Apply'));
		applyLink.type = 'button';
		applyLink.style.display = S.isFieldDirty(ctrl, draftKey) && status.canApply ? '' : 'none';
		applyLink.addEventListener('click', function () {
			window.NeoPulseAiModal.runApplyContentField(self, 'faq', draftKey);
		});
		actions.appendChild(applyLink);

		actions.appendChild(D.createSparkButton({
			bare: true,
			size: 28,
			label: str('wandTitle', 'Enhance with NEO Pulse AI'),
			loading: ctrl.loadingField === 'faq' || ctrl.faqWandRunning,
			onClick: function () {
				window.NeoPulseAiFaq.runFaqWand(self);
			},
		}));
		head.appendChild(actions);
		row.appendChild(head);

		var accordion = el('div', 'neo-pulse-wp-ai-faq-accordion');
		row.appendChild(accordion);
		mountFaqAccordion(ctrl, row, entries, 0);
		return row;
	}

	window.NeoPulseAiFaq = {
		isSchemaStorage: isSchemaStorage,
		parseFaqEntries: parseFaqEntries,
		serializeFaqEntries: serializeFaqEntries,
		entriesToStorage: entriesToStorage,
		mergeAiFaqIntoStorage: mergeAiFaqIntoStorage,
		renderModalRow: renderModalRow,
		runFaqWand: runFaqWand,
		mountFaqAccordion: mountFaqAccordion,
		syncRowToDraft: syncRowToDraft,
		syncDraftFromDom: function (ctrl) {
			if (!ctrl.metaEditorOverlay) return;
			var row = ctrl.metaEditorOverlay.querySelector('[data-content-row="faq"]');
			if (row) syncRowToDraft(ctrl, row);
		},
		resetStorageBase: function (ctrl) {
			ctrl._faqStorageBase = ctrl.saved.faq || ctrl.draft.faq || '';
		},
	};
})();
