/**
 * Shared thinking / loading card helpers (checklist + finalize to answer card).
 */
(function (global) {
  'use strict';

  function defaultQaSteps() {
    return [
      { label: 'Understanding your request', status: 'running', step_kind: 'plan' },
      { label: 'Composing your answer', status: 'pending' }
    ];
  }

  function streamSteps() {
    return [
      { label: 'Searching content…', status: 'running' },
      { label: 'Thinking…', status: 'pending' },
      { label: 'Formatting response…', status: 'pending' }
    ];
  }

  function streamLabelToStepIndex(label) {
    var l = String(label || '').toLowerCase();
    if (l.indexOf('search') !== -1 || l.indexOf('fetch') !== -1 || l.indexOf('analytics') !== -1) {
      return 0;
    }
    if (l.indexOf('think') !== -1 || l.indexOf('analyz') !== -1) {
      return 1;
    }
    if (l.indexOf('format') !== -1) {
      return 2;
    }
    return -1;
  }

  function createThinkingCard(host, opts) {
    opts = opts || {};
    var steps = opts.steps && opts.steps.length
      ? opts.steps
      : (opts.stream ? streamSteps() : defaultQaSteps());
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
      host.scrollDown(shell.root);
    }
  }

  global.NeoPulseThinkingCard = {
    defaultQaSteps: defaultQaSteps,
    streamSteps: streamSteps,
    createThinkingCard: createThinkingCard,
    setStep: setStep,
    advanceStreamLabel: advanceStreamLabel,
    finalizeToCard: finalizeToCard
  };
})(typeof window !== 'undefined' ? window : this);
