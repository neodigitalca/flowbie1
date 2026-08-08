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

  function storageKey() {
    return session && session.sessionId
      ? 'flowbie_chat_debug_log_' + session.sessionId
      : '';
  }

  function persist() {
    var key = storageKey();
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(turns));
    } catch (_) {}
  }

  function loadStored(sessionId) {
    if (!sessionId) return;
    try {
      var raw = sessionStorage.getItem('flowbie_chat_debug_log_' + sessionId);
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
    return {
      type: card.type || '',
      title: card.title || '',
      body: card.body || '',
      confidence: card.confidence || '',
      message_uid: card.message_uid || '',
      links: card.links || [],
      relatedTopics: card.relatedTopics || [],
      cta: card.cta || null,
      conversion: conversion
    };
  }

  function createSession(options) {
    options = options || {};
    session = {
      sessionId: options.sessionId || '',
      source: options.source || 'frontend',
      pageUrl: options.pageUrl || '',
      siteName: options.siteName || ''
    };
    pendingStreamEvents = [];
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

  function buildExportPayload() {
    var stamp = nowStamp();
    return {
      exported_at: stamp.timestamp,
      exported_at_local: stamp.local_time,
      session_id: session ? session.sessionId : '',
      source: session ? session.source : '',
      page_url: session ? session.pageUrl : '',
      site_name: session ? session.siteName : '',
      turns: turns.slice()
    };
  }

  function copyToClipboard(buttonEl) {
    var text = JSON.stringify(buildExportPayload(), null, 2);

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
        sessionStorage.removeItem(key);
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

  global.FlowbieChatDebugLog = {
    createSession: createSession,
    beginAssistantTurn: beginAssistantTurn,
    appendStreamEvent: appendStreamEvent,
    appendTurn: appendTurn,
    patchLastAssistantRelatedTopics: patchLastAssistantRelatedTopics,
    buildExportPayload: buildExportPayload,
    copyToClipboard: copyToClipboard,
    clear: clear
  };
})(typeof window !== 'undefined' ? window : this);
