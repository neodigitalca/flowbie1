/**
 * Timestamped chat debug log for Copy log (frontend + admin demo).
 */
(function (global) {
  'use strict';

  var session = null;
  var turns = [];
  var pendingStreamEvents = [];

  function nowStamp() {
    var d = new Date();
    return {
      timestamp: d.toISOString(),
      local_time: d.toLocaleString()
    };
  }

  function useGodModePersist() {
    return !!(session && session.godModePersist);
  }

  function storageKey() {
    if (useGodModePersist()) {
      var uid = session.persistUserId ? String(session.persistUserId) : '0';
      var conv = session.conversationId ? String(session.conversationId) : '';
      if (!conv) return '';
      return 'neo-pulse_godmode_debug_log_' + uid + '_' + conv;
    }
    return session && session.sessionId
      ? 'neo_pulse_chat_debug_log_' + session.sessionId
      : '';
  }

  function activeStorage() {
    return useGodModePersist() ? localStorage : sessionStorage;
  }

  function persist() {
    var key = storageKey();
    if (!key) return;
    try {
      activeStorage().setItem(key, JSON.stringify(turns));
    } catch (_) {}
  }

  function loadStored(sessionId) {
    var key = storageKey();
    if (!key) return;
    try {
      var raw = activeStorage().getItem(key);
      if (!raw && !useGodModePersist() && sessionId) {
        raw = sessionStorage.getItem('neo_pulse_chat_debug_log_' + sessionId);
      }
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        turns = parsed;
      }
    } catch (_) {}
  }

  function sanitizeCard(card) {
    if (!card || typeof card !== 'object') return null;
    var conversion = null;
    if (card.conversion && typeof card.conversion === 'object') {
      conversion = {
        headline: card.conversion.headline || '',
        contact: card.conversion.contact || {},
        formId: card.conversion.formId || 0
      };
    }
    var steps = [];
    if (Array.isArray(card.steps)) {
      card.steps.forEach(function (step) {
        if (!step || typeof step !== 'object') return;
        var label = step.label || '';
        var tool = step.tool || '';
        if (!label && !tool) return;
        steps.push({
          label: label,
          tool: tool,
          status: step.status || ''
        });
      });
    }
    return {
      type: card.type || '',
      title: card.title || '',
      body: card.body || '',
      confidence: card.confidence || '',
      message_uid: card.message_uid || '',
      links: card.links || [],
      relatedTopics: card.relatedTopics || [],
      cta: card.cta || null,
      conversion: conversion,
      steps: steps
    };
  }

  function createSession(options) {
    options = options || {};
    session = {
      sessionId: options.sessionId || '',
      conversationId: options.conversationId || '',
      source: options.source || 'frontend',
      pageUrl: options.pageUrl || '',
      siteName: options.siteName || '',
      godModePersist: !!options.godModePersist,
      persistUserId: options.persistUserId || 0
    };
    turns = [];
    pendingStreamEvents = [];
    if (useGodModePersist()) {
      try {
        var legacy = 'neo-pulse_godmode_debug_log_' + (session.persistUserId ? String(session.persistUserId) : '0');
        localStorage.removeItem(legacy);
      } catch (_) {}
    }
    loadStored(session.sessionId);
    return session;
  }

  function beginAssistantTurn() {
    pendingStreamEvents = [];
  }

  function appendStreamEvent(status, label, extra) {
    if (!status) return;
    var evt = { status: status };
    if (label) evt.label = label;
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (key) {
        evt[key] = extra[key];
      });
    }
    var stamp = nowStamp();
    evt.timestamp = stamp.timestamp;
    evt.local_time = stamp.local_time;
    pendingStreamEvents.push(evt);
  }

  function appendTurn(turn) {
    if (!turn || !turn.role) return;
    var stamp = nowStamp();
    var entry = {
      timestamp: stamp.timestamp,
      local_time: stamp.local_time,
      role: turn.role,
      content: turn.content || ''
    };
    if (turn.role === 'assistant') {
      if (turn.card) entry.card = sanitizeCard(turn.card);
      if (turn.debug) entry.debug = turn.debug;
      if (pendingStreamEvents.length) {
        entry.stream_events = pendingStreamEvents.slice();
      } else if (turn.streamEvents && turn.streamEvents.length) {
        entry.stream_events = turn.streamEvents.slice();
      }
      if (turn.meta && typeof turn.meta === 'object') {
        entry.meta = turn.meta;
      }
      pendingStreamEvents = [];
    }
    turns.push(entry);
    persist();
  }

  function historyToExportTurns(visibleTurns) {
    if (!Array.isArray(visibleTurns)) {
      return turns.slice();
    }
    var out = [];
    visibleTurns.forEach(function (turn) {
      if (!turn || !turn.role) return;
      var entry = {
        role: turn.role,
        content: turn.content || ''
      };
      if (turn.card) {
        entry.card = sanitizeCard(turn.card);
      }
      out.push(entry);
    });
    return out;
  }

  function buildExportPayload(visibleTurns) {
    var stamp = nowStamp();
    return {
      exported_at: stamp.timestamp,
      exported_at_local: stamp.local_time,
      session_id: session ? session.sessionId : '',
      conversation_id: session ? session.conversationId : '',
      source: session ? session.source : '',
      page_url: session ? session.pageUrl : '',
      site_name: session ? session.siteName : '',
      turns: historyToExportTurns(visibleTurns)
    };
  }

  function downloadFile(buttonEl, visibleTurns) {
    var payload = buildExportPayload(visibleTurns);
    var text = JSON.stringify(payload, null, 2);
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var id = payload.conversation_id || payload.session_id || 'chat';
    a.href = url;
    a.download = 'neo-pulse-conversation-' + id + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (buttonEl) {
      var prevLabel = buttonEl.getAttribute('aria-label') || 'Download conversation log';
      buttonEl.setAttribute('aria-label', 'Downloaded');
      setTimeout(function () {
        buttonEl.setAttribute('aria-label', prevLabel);
      }, 2000);
    }
    return true;
  }

  function copyToClipboard(buttonEl, visibleTurns) {
    var text = JSON.stringify(buildExportPayload(visibleTurns), null, 2);

    function markCopied() {
      if (!buttonEl) return;
      var hasIcon = buttonEl.querySelector('svg');
      if (hasIcon) {
        var prevLabel = buttonEl.getAttribute('aria-label') || 'Copy log';
        buttonEl.setAttribute('aria-label', 'Copied');
        setTimeout(function () {
          buttonEl.setAttribute('aria-label', prevLabel);
        }, 2000);
        return;
      }
      var prev = buttonEl.textContent;
      buttonEl.textContent = 'Copied';
      setTimeout(function () {
        buttonEl.textContent = prev;
      }, 2000);
    }

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      return Promise.resolve(false);
    }

    return navigator.clipboard.writeText(text).then(function () {
      markCopied();
      return true;
    });
  }

  function clear() {
    turns = [];
    pendingStreamEvents = [];
    var key = storageKey();
    if (key) {
      try {
        activeStorage().removeItem(key);
      } catch (_) {}
    }
  }

  function patchLastAssistantRelatedTopics(topics) {
    if (!topics || !topics.length) return;
    for (var i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role !== 'assistant') continue;
      if (!turns[i].card) turns[i].card = {};
      turns[i].card.relatedTopics = topics.slice();
      persist();
      return;
    }
  }

  global.NeoPulseChatDebugLog = {
    createSession: createSession,
    beginAssistantTurn: beginAssistantTurn,
    appendStreamEvent: appendStreamEvent,
    appendTurn: appendTurn,
    patchLastAssistantRelatedTopics: patchLastAssistantRelatedTopics,
    buildExportPayload: buildExportPayload,
    copyToClipboard: copyToClipboard,
    downloadFile: downloadFile,
    clear: clear
  };
})(typeof window !== 'undefined' ? window : this);
