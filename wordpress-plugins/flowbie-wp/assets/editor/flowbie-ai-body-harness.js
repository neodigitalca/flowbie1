(function () {
	'use strict';

	var S = function () {
		return window.FlowbieAiShared;
	};
	var D = function () {
		return window.FlowbieAiDom;
	};

	function defaultState() {
		return {
			sessionId: '',
			phase: 'idle',
			plannedCount: 0,
			doneCount: 0,
			activeIndex: -1,
			sections: [],
			loading: false,
			stopRequested: false,
			error: '',
		};
	}

	window.FlowbieBodyHarnessStore = {
		state: defaultState(),
		listeners: [],
		subscribe: function (fn) {
			this.listeners.push(fn);
			return function () {
				window.FlowbieBodyHarnessStore.listeners = window.FlowbieBodyHarnessStore.listeners.filter(function (f) {
					return f !== fn;
				});
			};
		},
		setState: function (patch) {
			var st = window.FlowbieBodyHarnessStore.state;
			Object.keys(patch).forEach(function (k) {
				st[k] = patch[k];
			});
			window.FlowbieBodyHarnessStore.listeners.forEach(function (fn) {
				fn(st);
			});
		},
		applySession: function (session) {
			if (!session) return;
			var existing = window.FlowbieBodyHarnessStore.state.sections || [];
			var incoming = session.sections || [];
			var merged = incoming.map(function (sec) {
				var prev = null;
				existing.forEach(function (e) { if (e.index === sec.index) prev = e; });
				var out = Object.assign({}, sec);
				if (prev) {
					if (prev.title) out.title = prev.title;
					if (prev.currentHtml) out.currentHtml = prev.currentHtml;
					if (prev.previewHtml && !out.previewHtml) out.previewHtml = prev.previewHtml;
					if (typeof prev.expanded === 'boolean' && typeof out.expanded === 'undefined') out.expanded = prev.expanded;
				}
				return out;
			});
			window.FlowbieBodyHarnessStore.setState({
				sessionId: session.sessionId || '',
				phase: session.phase || 'idle',
				plannedCount: session.plannedCount || 0,
				doneCount: session.doneCount || 0,
				activeIndex: typeof session.activeIndex === 'number' ? session.activeIndex : -1,
				sections: merged,
			});
		},
		patchSection: function (index, patch) {
			var sections = window.FlowbieBodyHarnessStore.state.sections.map(function (s) {
				if (s.index === index) return Object.assign({}, s, patch);
				return s;
			});
			window.FlowbieBodyHarnessStore.setState({ sections: sections });
		},
		reset: function () {
			window.FlowbieBodyHarnessStore.state = defaultState();
			window.FlowbieBodyHarnessStore.listeners.forEach(function (fn) {
				fn(window.FlowbieBodyHarnessStore.state);
			});
		},
		deleteSection: function (index) {
			var sections = window.FlowbieBodyHarnessStore.state.sections.filter(function (s) { return s.index !== index; });
			sections.forEach(function (s, i) { s.index = i; });
			window.FlowbieBodyHarnessStore.setState({ sections: sections, plannedCount: sections.length, structureDirty: true });
		},
		addSection: function (title) {
			var sections = window.FlowbieBodyHarnessStore.state.sections.slice();
			sections.push({
				index: sections.length,
				title: title || 'New Section',
				status: 'waiting',
				currentHtml: '',
				previewHtml: '',
				expanded: false,
			});
			window.FlowbieBodyHarnessStore.setState({ sections: sections, plannedCount: sections.length, structureDirty: true });
		},
		renameSection: function (index, newTitle) {
			window.FlowbieBodyHarnessStore.patchSection(index, { title: newTitle });
			window.FlowbieBodyHarnessStore.setState({ structureDirty: true });
		},
		moveSection: function (fromIndex, toIndex) {
			var sections = window.FlowbieBodyHarnessStore.state.sections.slice();
			var item = null;
			var fromPos = -1;
			for (var i = 0; i < sections.length; i++) {
				if (sections[i].index === fromIndex) { item = sections[i]; fromPos = i; break; }
			}
			if (!item || fromPos < 0) return;
			var toPos = -1;
			for (var j = 0; j < sections.length; j++) {
				if (sections[j].index === toIndex) { toPos = j; break; }
			}
			if (toPos < 0) return;
			sections.splice(fromPos, 1);
			sections.splice(toPos, 0, item);
			sections.forEach(function (s, i) { s.index = i; });
			window.FlowbieBodyHarnessStore.setState({ sections: sections, structureDirty: true });
		},
	};

	function scrollToSection(index) {
		if (window.FlowbieBodyHarnessCanvas && window.FlowbieBodyHarnessCanvas.scrollToSection) {
			window.FlowbieBodyHarnessCanvas.scrollToSection(index);
		}
	}

	function previewSection(postId, index, sessionId) {
		var store = window.FlowbieBodyHarnessStore;
		store.setState({ loading: true, activeIndex: index, error: '' });
		store.patchSection(index, { status: 'generating' });
		scrollToSection(index);
		return S()
			.api('/flowbie/v1/ai/body/section/preview', {
				method: 'POST',
				body: JSON.stringify({
					post_id: postId,
					sectionIndex: index,
					sessionId: sessionId,
				}),
			})
			.then(function (body) {
				store.applySession(body.session);
				var patch = {
					status: 'done',
					previewHtml: body.html || '',
					expanded: true,
				};
				if (body.currentHtml) patch.currentHtml = body.currentHtml;
				store.patchSection(index, patch);
				store.setState({ loading: false });
				return body;
			})
			.catch(function (err) {
				store.patchSection(index, { status: 'error', error: err.message || 'Preview failed.' });
				store.setState({ loading: false, error: err.message || 'Preview failed.' });
				throw err;
			});
	}

	function applySection(postId, index, sessionId, html, ctrl) {
		var store = window.FlowbieBodyHarnessStore;
		store.setState({ loading: true, error: '' });
		var sec = (store.state.sections || []).find(function (s) { return s.index === index; });
		var sectionTitle = sec ? sec.title : '';

		return S()
			.api('/flowbie/v1/ai/body/section/apply', {
				method: 'POST',
				body: JSON.stringify({
					post_id: postId,
					sectionIndex: index,
					sessionId: sessionId,
					html: html,
					sectionTitle: sectionTitle,
				}),
			})
			.then(function (body) {
				store.applySession(body.session);
				store.patchSection(index, { status: 'waiting', previewHtml: '', expanded: false });
				store.setState({ loading: false });
				if (body.optimization && ctrl && ctrl.status) {
					ctrl.status.used = body.optimization.used;
					ctrl.status.cap = body.optimization.cap;
					ctrl.status.remaining = body.optimization.remaining;
					ctrl.status.canApply = (body.optimization.remaining || 0) > 0;
				}
				if (window.wp && window.wp.apiFetch) {
					window.wp.apiFetch({ path: '/wp/v2/posts/' + postId + '?context=edit' }).then(function (post) {
						if (post && post.content && post.content.raw && window.wp.blocks && window.wp.data) {
							var fresh = window.wp.blocks.parse(post.content.raw);
							window.wp.data.dispatch('core/block-editor').resetBlocks(fresh);
						}
					});
				}
				return body;
			})
			.catch(function (err) {
				store.setState({ loading: false, error: err.message || 'Apply failed.' });
				throw err;
			});
	}

	function runAllPreviews(postId, ctrl) {
		var store = window.FlowbieBodyHarnessStore;
		var sections = store.state.sections || [];
		store.setState({ stopRequested: false, phase: 'running' });
		var chain = Promise.resolve();
		sections.forEach(function (sec) {
			chain = chain.then(function () {
				if (store.state.stopRequested) return;
				return previewSection(postId, sec.index, store.state.sessionId);
			});
		});
		return chain.finally(function () {
			store.setState({ phase: 'ready', loading: false });
			if (ctrl && ctrl.refreshUI) ctrl.refreshUI();
		});
	}

	function saveStructure(postId) {
		var store = window.FlowbieBodyHarnessStore;
		var sections = store.state.sections.map(function (s) {
			return { title: s.title, html: s.currentHtml || '' };
		});
		store.setState({ loading: true, error: '' });
		return S()
			.api('/flowbie/v1/ai/body/save-structure', {
				method: 'POST',
				body: JSON.stringify({ post_id: postId, sections: sections }),
			})
			.then(function (resp) {
				store.setState({
					loading: false,
					sections: resp.sections || [],
					plannedCount: (resp.sections || []).length,
					doneCount: 0,
					sessionId: '',
					structureDirty: false,
				});
				if (window.wp && window.wp.apiFetch) {
					window.wp.apiFetch({ path: '/wp/v2/posts/' + postId + '?context=edit' }).then(function (post) {
						if (post && post.content && post.content.raw && window.wp.blocks && window.wp.data) {
							var fresh = window.wp.blocks.parse(post.content.raw);
							window.wp.data.dispatch('core/block-editor').resetBlocks(fresh);
						}
					});
				}
				return resp;
			})
			.catch(function (err) {
				store.setState({ loading: false, error: err.message || 'Save structure failed.' });
				throw err;
			});
	}

	window.FlowbieBodyHarness = {
		loadSession: function (postId, skipApply) {
			return S()
				.api('/flowbie/v1/ai/body/session?post_id=' + encodeURIComponent(String(postId)), { method: 'GET' })
				.then(function (body) {
					if (body.hasSession && !skipApply) {
						window.FlowbieBodyHarnessStore.applySession(body);
					}
					return body;
				});
		},
		plan: function (postId, ctrl) {
			var store = window.FlowbieBodyHarnessStore;
			store.setState({ loading: true, phase: 'planning', error: '' });
			return S()
				.api('/flowbie/v1/ai/body/plan', {
					method: 'POST',
					body: JSON.stringify({ post_id: postId }),
				})
				.then(function (body) {
					store.applySession(body);
					store.setState({ loading: false, phase: body.phase || 'ready' });
					if (ctrl && ctrl.refreshUI) ctrl.refreshUI();
					return body;
				})
				.catch(function (err) {
					store.setState({ loading: false, phase: 'idle', error: err.message || 'Plan failed.' });
					throw err;
				});
		},
		previewSection: previewSection,
		applySection: applySection,
		runAllPreviews: runAllPreviews,
		saveStructure: saveStructure,
		clearSession: function (postId) {
			return S()
				.api('/flowbie/v1/ai/body/session?post_id=' + encodeURIComponent(String(postId)), { method: 'DELETE' })
				.then(function () {
					window.FlowbieBodyHarnessStore.reset();
				});
		},
	};
})();
