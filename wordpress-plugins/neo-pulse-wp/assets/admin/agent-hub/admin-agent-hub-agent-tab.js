/**
 * Agent Hub — Agent tab, backend assist workflow.
 */
(function ($) {
	'use strict';

	var R = window.NeoPulseAgentHubRuntime;
	var api = R.api;

	api.manifestFromBuilder = function () {
		var payload = api.collectPayload();
		if (!payload.id) delete payload.id;
		return payload;
	}

	api.manifestDownloadFilename = function() {
		var title = String($('#neo-pulse-agent-hub-field-title').val() || 'seo-block')
			.toLowerCase()
			.replace(/[^\w-]+/g, '-')
			.replace(/^-+|-+$/g, '');
		return (title || 'seo-block') + '-manifest.json';
		a.href = url;
		a.download = api.manifestDownloadFilename();
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	api.applyManifestFromCard = function(manifest) {
		if (!manifest || typeof manifest !== 'object') return;
		api.loadBlockIntoBuilder(manifest);
		api.switchTab('layout');
		api.schedulePreview();
	}

	api.agentScrollDown = function() {
		var el = document.getElementById('neo-pulse-builder-agent-messages');
		if (el) el.scrollTop = el.scrollHeight;
	}

	api.renderMd = function(text) {
		var d = document.createElement('div');
		d.textContent = text || '';
		var s = d.innerHTML;
		s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		s = s.replace(/\n/g, '<br>');
		return s;
	}

	api.getJson = function(url) {
		return fetch(url, {
			method: 'GET',
			headers: { 'X-WP-Nonce': R.cfg.nonce || '' },
			credentials: 'same-origin'
		}).then(function (res) {
			return res.json().then(function (data) {
				return { ok: res.ok, status: res.status, data: data };
			});
		});
	}

	api.appendAgentUser = function(text) {
		var $msgs = $('#neo-pulse-builder-agent-messages');
		$('#neo-pulse-builder-agent-center').hide();
		$msgs.append('<div class="neo-pulse-builder-agent-assist__user">' + api.esc(text) + '</div>');
		api.agentScrollDown();
	}

	api.agentBuilderContext = function() {
		return { block: api.collectPayload() };
	}

	api.isAgentExecutableStep = function(step) {
		if (!step) return true;
		if (step.executable === false) return false;
		var t = step.tool || '';
		if (t === 'micro_section' || t === 'plan_outline') return false;
		return true;
	}

	api.isAgentWorkflowStepVisible = function(step) {
		if (!step) return true;
		if (step.visible === false) return false;
		if (step.step_kind === 'internal') return false;
		return true;
	}

	api.agentWorkflowStepIcon = function(status) {
		if (status === 'done') return '✓';
		if (status === 'running') return '…';
		if (status === 'error') return '✗';
		return '○';
	}

	api.buildAgentWorkflowStepsList = function(steps) {
		var $ul = $('<ul class="neo-pulse-builder-agent-assist__workflow-steps"></ul>');
		(steps || []).forEach(function (step, idx) {
			if (!api.isAgentWorkflowStepVisible(step)) return;
			var st = step.status || 'pending';
			var kind = step.step_kind || (step.tool === 'plan_outline' ? 'plan' : (step.tool === 'micro_section' ? 'micro' : ''));
			var $li = $('<li class="neo-pulse-builder-agent-assist__workflow-step neo-pulse-builder-agent-assist__workflow-step--' + api.esc(st) + (kind ? ' neo-pulse-builder-agent-assist__workflow-step--' + api.esc(kind) : '') + '" data-step-index="' + idx + '"></li>');
			$li.append('<span class="neo-pulse-builder-agent-assist__workflow-step-icon">' + api.esc(api.agentWorkflowStepIcon(st)) + '</span>');
			$li.append('<span class="neo-pulse-builder-agent-assist__workflow-step-label">' + api.esc(step.label || ('Step ' + (idx + 1))) + '</span>');
			$ul.append($li);
		});
		return $ul;
	}

	api.appendAgentWorkflowCard = function(card) {
		var $msgs = $('#neo-pulse-builder-agent-messages');
		$('#neo-pulse-builder-agent-center').hide();
		var type = card.type || 'workflow';
		var $root = $('<div class="neo-pulse-builder-agent-assist__card neo-pulse-builder-agent-assist__card--' + api.esc(type) + ' neo-pulse-builder-agent-assist__card--workflow"></div>');
		$root.append('<div class="neo-pulse-builder-agent-assist__card-badge">' + api.esc(type) + '</div>');
		$root.append('<div class="neo-pulse-builder-agent-assist__card-title">' + api.esc(card.title || '') + '</div>');
		var $body = $('<div class="neo-pulse-builder-agent-assist__card-body"></div>');
		if (card.body) $body.html(api.renderMd(card.body));
		$root.append($body);
		var $steps = api.buildAgentWorkflowStepsList(card.steps || []);
		$root.append($steps);
		$msgs.append($root);
		api.agentScrollDown();
		return { root: $root[0], titleEl: $root.find('.neo-pulse-builder-agent-assist__card-title')[0], bodyEl: $body[0], stepsList: $steps[0] };
	}

	api.updateAgentWorkflowCard = function(shell, card) {
		if (!shell || !shell.root) return;
		if (shell.titleEl) $(shell.titleEl).html(api.renderMd(card.title || ''));
		if (shell.bodyEl) {
			if (card.body) {
				$(shell.bodyEl).html(api.renderMd(card.body)).show();
			} else {
				$(shell.bodyEl).hide();
			}
		}
		if (card.steps && shell.stepsList) {
			var $fresh = api.buildAgentWorkflowStepsList(card.steps);
			$(shell.stepsList).replaceWith($fresh);
			shell.stepsList = $fresh[0];
		}
		api.agentScrollDown();
	}

	api.setAgentWorkflowStepStatus = function(shell, idx, status) {
		if (!shell || !shell.stepsList) return;
		var $li = $(shell.stepsList).find('[data-step-index="' + idx + '"]');
		if (!$li.length) return;
		$li.removeClass(function (i, c) {
			return (c.match(/neo-pulse-builder-agent-assist__workflow-step--(?:pending|running|done|error)/g) || []).join(' ');
		}).addClass('neo-pulse-builder-agent-assist__workflow-step--' + status);
		$li.find('.neo-pulse-builder-agent-assist__workflow-step-icon').text(api.agentWorkflowStepIcon(status));
	}

	api.setAgentWorkflowCardActive = function(shell, active) {
		if (!shell || !shell.root) return;
		$(shell.root).toggleClass('neo-pulse-builder-agent-assist__card--workflow-active', !!active);
	}

	api.agentThinkingHost = function() {
		return {
			appendWorkflowCard: appendAgentWorkflowCard,
			setWorkflowStepStatus: setAgentWorkflowStepStatus,
			setWorkflowCardActive: setAgentWorkflowCardActive,
			applyCardBadge: function (badgeEl, t) {
				if (!badgeEl) return;
				badgeEl.textContent = t === 'prompt' ? 'info' : (t || 'answer');
			},
			renderMd: renderMd,
			populateCardExtras: function (shell, card) {
				if (shell && shell.root && card) {
					api.attachManifestActions($(shell.root), card);
				}
			},
			scrollDown: agentScrollDown
		};
	}

	api.attachManifestActions = function($card, card) {
		if (!card.action_result || !card.action_result.block_manifest) return;
		$card.find('.neo-pulse-builder-agent-assist__card-actions').remove();
		$card.find('.neo-pulse-builder-agent-assist__card-body').append(
			'<div class="neo-pulse-builder-agent-assist__card-actions">' +
			'<button type="button" class="button button-primary neo-pulse-builder-agent-apply-manifest">' + api.esc(R.cfg.i18n.applyManifest || 'Apply to R.builder') + '</button></div>'
		);
		$card.data('blockManifest', card.action_result.block_manifest);
	}

	api.appendAgentCard = function(card) {
		var $msgs = $('#neo-pulse-builder-agent-messages');
		$('#neo-pulse-builder-agent-center').hide();
		var type = card.type || 'answer';
		var $card = $('<div class="neo-pulse-builder-agent-assist__card neo-pulse-builder-agent-assist__card--' + api.esc(type) + '">' +
			'<div class="neo-pulse-builder-agent-assist__card-badge">' + api.esc(type) + '</div>' +
			'<div class="neo-pulse-builder-agent-assist__card-title">' + api.esc(card.title || '') + '</div>' +
			'<div class="neo-pulse-builder-agent-assist__card-body">' + api.renderMd(card.body || '') + '</div></div>');
		api.attachManifestActions($card, card);
		$msgs.append($card);
		api.agentScrollDown();
	}

	api.presentAgentCard = function(card, shell) {
		var host = api.agentThinkingHost();
		if (shell && window.NeoPulseThinkingCard) {
			NeoPulseThinkingCard.finalizeToCard(shell, card, host);
			return;
		}
		api.appendAgentCard(card);
	}

	api.finishAgentMessage = function(card) {
		if (card && (card.body || card.title)) {
			R.agent.history.push({ role: 'assistant', content: card.body || card.title || '', ts: Math.floor(Date.now() / 1000) });
		}
	}

	api.runBackendAssistAgent = function(text) {
		R.agent.loading = true;
		$('#neo-pulse-builder-agent-send, #neo-pulse-builder-agent-input').prop('disabled', true);
		var histSlice = R.agent.history.slice(-10);
		var payload = api.collectPayload();
		var stepUrl = R.cfg.backendAssistStepUrl || '';
		var workflowStatusBase = R.cfg.backendAssistWorkflowStatusUrl || '';
		var host = api.agentThinkingHost();
		var thinkingShell = window.NeoPulseThinkingCard
			? NeoPulseThinkingCard.createThinkingCard(host, { includeVoice: false, title: 'Working on your block…' })
			: null;

		return api.ensurePrimaryPageContext(payload.primary_post_id || 0, payload.id || 0).then(function (ctx) {
			var builderContext = api.agentBuilderContext();
			if (ctx) {
				builderContext.page_context = api.formatPrimaryPageContextForPrompt(ctx);
			}
			return api.postJson(R.cfg.backendAssistUrl || '', {
				message: text,
				history: histSlice,
				mode: 'plan',
				builder_context: builderContext
			});
		}).then(function (res) {
			var plan = res.data;
			if (!res.ok || !plan) {
				api.presentAgentCard({
					type: 'error',
					title: 'Error',
					body: (plan && plan.error) || R.cfg.i18n.error
				}, thinkingShell);
				return;
			}

			if (!plan.workflow) {
				if (thinkingShell && window.NeoPulseThinkingCard) {
					NeoPulseThinkingCard.setStep(thinkingShell, host, 0, 'done');
					NeoPulseThinkingCard.setStep(thinkingShell, host, 1, 'done');
				}
				api.presentAgentCard(plan, thinkingShell);
				api.finishAgentMessage(plan);
				return;
			}

			var wfShell = thinkingShell;
			if (!wfShell) {
				wfShell = api.appendAgentWorkflowCard({
					type: 'workflow',
					title: 'Planning…',
					body: 'Breaking down your request…',
					steps: []
				});
				api.setAgentWorkflowCardActive(wfShell, true);
			}
			api.updateAgentWorkflowCard(wfShell, plan);

			var wfId = plan.workflow_id;
			var stepCount = (plan.steps && plan.steps.length) || 0;
			var chain = Promise.resolve();

			for (var i = 0; i < stepCount; i++) {
				(function (stepIndex) {
					chain = chain.then(function () {
						var stepMeta = plan.steps && plan.steps[stepIndex] ? plan.steps[stepIndex] : null;
						if (stepMeta && !api.isAgentExecutableStep(stepMeta)) {
							if (stepMeta.status && api.isAgentWorkflowStepVisible(stepMeta)) {
								api.setAgentWorkflowStepStatus(wfShell, stepIndex, stepMeta.status);
							}
							return;
						}

						var pollTimer = null;
						if (stepMeta && stepMeta.tool === 'write_sections_batch' && workflowStatusBase && wfId) {
							pollTimer = setInterval(function () {
								api.getJson(workflowStatusBase + '/' + encodeURIComponent(wfId) + '/status').then(function (pollRes) {
									if (pollRes.ok && pollRes.data && pollRes.data.steps) {
										pollRes.data.steps.forEach(function (step, idx) {
											if (api.isAgentWorkflowStepVisible(step)) {
												api.setAgentWorkflowStepStatus(wfShell, idx, step.status || 'pending');
											}
										});
									}
								}).catch(function () {});
							}, 600);
						}

						if (api.isAgentWorkflowStepVisible(stepMeta)) {
							api.setAgentWorkflowStepStatus(wfShell, stepIndex, 'running');
						}

						var stepBuilderContext = api.agentBuilderContext();
						if (R.builder.primaryPageContext) {
							stepBuilderContext.page_context = api.formatPrimaryPageContextForPrompt(R.builder.primaryPageContext);
						}
						return api.postJson(stepUrl, {
							workflow_id: wfId,
							step_index: stepIndex,
							message: text,
							history: histSlice,
							builder_context: stepBuilderContext
						}).then(function (stepRes) {
							if (pollTimer) clearInterval(pollTimer);
							var stepData = stepRes.data;
							if (!stepRes.ok || !stepData) {
								if (api.isAgentWorkflowStepVisible(stepMeta)) {
									api.setAgentWorkflowStepStatus(wfShell, stepIndex, 'error');
								}
								api.presentAgentCard({
									type: 'workflow',
									title: 'Step failed',
									body: (stepData && stepData.error) || R.cfg.i18n.error,
									workflow_complete: true,
									steps: plan.steps
								}, wfShell);
								return Promise.reject(new Error('step failed'));
							}
							if (stepData.skipped) {
								if (plan.steps && plan.steps[stepIndex]) {
									plan.steps[stepIndex].status = stepData.status || 'done';
								}
								if (api.isAgentWorkflowStepVisible(stepMeta)) {
									api.setAgentWorkflowStepStatus(wfShell, stepIndex, stepData.status || 'done');
								}
								return;
							}
							if (api.isAgentWorkflowStepVisible(stepMeta)) {
								api.setAgentWorkflowStepStatus(wfShell, stepIndex, stepData.status || 'done');
							}
							if (plan.steps && plan.steps[stepIndex]) {
								plan.steps[stepIndex].status = stepData.status || 'done';
							}
							if (stepData.workflow_complete && stepData.card) {
								api.setAgentWorkflowCardActive(wfShell, false);
								api.presentAgentCard(stepData.card, wfShell);
								api.finishAgentMessage(stepData.card);
								return Promise.reject(new Error('workflow complete'));
							}
							if (stepData.status === 'error' && stepData.card) {
								api.setAgentWorkflowCardActive(wfShell, false);
								api.presentAgentCard(stepData.card, wfShell);
								api.finishAgentMessage(stepData.card);
								return Promise.reject(new Error('workflow error'));
							}
						});
					});
				})(i);
			}

			return chain.catch(function (err) {
				if (err && err.message === 'workflow complete') return;
				if (err && err.message === 'workflow error') return;
				if (err && err.message === 'step failed') return;
				api.presentAgentCard({ type: 'error', title: 'Error', body: R.cfg.i18n.error }, wfShell);
			});
		}).catch(function () {
			api.presentAgentCard({ type: 'error', title: 'Error', body: R.cfg.i18n.error }, thinkingShell);
		}).finally(function () {
			R.agent.loading = false;
			$('#neo-pulse-builder-agent-send, #neo-pulse-builder-agent-input').prop('disabled', false);
			$('#neo-pulse-builder-agent-input').focus();
		});
	}

	api.sendAgentMessage = function () {
		var text = ($('#neo-pulse-builder-agent-input').val() || '').trim();
		if (!text || R.agent.loading) {
			return;
		}
		api.appendAgentUser(text);
		R.agent.history.push({ role: 'user', content: text, ts: Math.floor(Date.now() / 1000) });
		$('#neo-pulse-builder-agent-input').val('');
		api.runBackendAssistAgent(text);
	};

	api.initAgentTab = function () {
		$('#neo-pulse-builder-agent-send').on('click', api.sendAgentMessage);
		$('#neo-pulse-builder-agent-input').on('keydown', function (e) {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				api.sendAgentMessage();
			}
		});
		$('#neo-pulse-builder-agent-suggestions .neo-pulse-builder-agent-assist__chip').on('click', function () {
			var prompt = $(this).data('prompt') || $(this).attr('data-prompt') || '';
			if (prompt) { $('#neo-pulse-builder-agent-input').val(prompt); api.sendAgentMessage(); }
		});
		$('#neo-pulse-agent-hub-modal-download-json').on('click', api.downloadManifestJson);
		R.dom.$modal.on('click', '.neo-pulse-builder-agent-apply-manifest', function () {
			var $card = $(this).closest('.neo-pulse-builder-agent-assist__card');
			api.applyManifestFromCard($card.data('blockManifest'));
		});
	}

})(jQuery);
