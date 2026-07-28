/**
 * Shared thinking / loading card helpers (checklist + finalize to answer card).
 */
(function (global) {
  'use strict';

  function hasVoiceNarrate() {
    var cfg = global.flowbieVoiceConfig || {};
    return !!(cfg.narrateUrl && String(cfg.narrateUrl).length > 0);
  }

  function defaultQaSteps(includeVoice) {
    var steps = [
      { label: 'Understanding your request', status: 'running', step_kind: 'plan' },
      { label: 'Composing your answer', status: 'pending' }
    ];
    if (includeVoice) {
      steps.push({ label: 'Sharing aloud', status: 'pending' });
    }
    return steps;
  }

  function streamSteps(includeVoice) {
    var steps = [
      { label: 'Searching content…', status: 'running' },
      { label: 'Thinking…', status: 'pending' },
      { label: 'Formatting response…', status: 'pending' }
    ];
    if (includeVoice) {
      steps.push({ label: 'Sharing aloud', status: 'pending' });
    }
    return steps;
  }

  function streamLabelToStepIndex(label) {
    var l = String(label || '').toLowerCase();
    if (l.indexOf('search') !== -1) {
      return 0;
    }
    if (l.indexOf('think') !== -1) {
      return 1;
    }
    if (l.indexOf('format') !== -1) {
      return 2;
    }
    return -1;
  }

  function createThinkingCard(host, opts) {
    opts = opts || {};
    var includeVoice = opts.includeVoice !== false && hasVoiceNarrate();
    var steps = opts.stream ? streamSteps(includeVoice) : defaultQaSteps(includeVoice);
    var card = {
      type: 'workflow',
      title: opts.title || 'Working on it…',
      body: opts.body || '',
      steps: steps
    };
    var shell = host.appendWorkflowCard(card);
    if (host.setWorkflowCardActive) {
      host.setWorkflowCardActive(shell, true);
    }
    shell._thinkingVoiceStep = includeVoice ? steps.length - 1 : -1;
    return shell;
  }

  function setStep(shell, host, index, status) {
    if (host && typeof host.setWorkflowStepStatus === 'function') {
      host.setWorkflowStepStatus(shell, index, status);
    }
  }

  function advanceStreamLabel(shell, host, label) {
    if (!shell || !host) {
      return;
    }
    var idx = streamLabelToStepIndex(label);
    if (idx < 0) {
      return;
    }
    var i;
    for (i = 0; i < idx; i++) {
      setStep(shell, host, i, 'done');
    }
    setStep(shell, host, idx, 'running');
  }

  function finalizeToCard(shell, card, host) {
    if (!shell || !host) {
      return;
    }
    if (host.setWorkflowCardActive) {
      host.setWorkflowCardActive(shell, false);
    }
    if (shell.stepsList && shell.stepsList.parentNode) {
      shell.stepsList.parentNode.removeChild(shell.stepsList);
      shell.stepsList = null;
    }
    var t = card.type || 'answer';
    if (shell.badgeEl && typeof host.applyCardBadge === 'function') {
      host.applyCardBadge(shell.badgeEl, t);
    }
    if (shell.titleEl && typeof host.renderMd === 'function') {
      shell.titleEl.innerHTML = host.renderMd(card.title || '');
    }
    if (shell.bodyEl) {
      if (card.body && typeof host.renderMd === 'function') {
        shell.bodyEl.innerHTML = host.renderMd(card.body);
        shell.bodyEl.style.display = '';
      } else {
        shell.bodyEl.style.display = 'none';
      }
    }
    if (typeof host.populateCardExtras === 'function') {
      host.populateCardExtras(shell, card);
    }
    if (typeof host.scrollDown === 'function') {
      host.scrollDown();
    }
  }

  function markVoiceStep(shell, host, status) {
    if (!shell || shell._thinkingVoiceStep < 0) {
      return;
    }
    setStep(shell, host, shell._thinkingVoiceStep, status);
  }

  function narrateAndVoiceStep(card, userMessage, shell, host) {
    if (!hasVoiceNarrate()) {
      return Promise.resolve();
    }
    if (shell && host) {
      markVoiceStep(shell, host, 'running');
    }
    var narrate =
      global.FlowbieVoice && typeof global.FlowbieVoice.narrateCard === 'function'
        ? global.FlowbieVoice.narrateCard(card, userMessage)
        : Promise.resolve();
    return Promise.resolve(narrate).then(function () {
      if (shell && host) {
        markVoiceStep(shell, host, 'done');
      }
    });
  }

  global.FlowbieThinkingCard = {
    hasVoiceNarrate: hasVoiceNarrate,
    defaultQaSteps: defaultQaSteps,
    streamSteps: streamSteps,
    createThinkingCard: createThinkingCard,
    setStep: setStep,
    advanceStreamLabel: advanceStreamLabel,
    finalizeToCard: finalizeToCard,
    markVoiceStep: markVoiceStep,
    narrateAndVoiceStep: narrateAndVoiceStep
  };
})(typeof window !== 'undefined' ? window : this);
