/**
 * Debounced typing prefetch (server ack + RAG) + full response prefetch for chips.
 */
(function (global) {
  'use strict';

  var DEBOUNCE_MS = 250;
  var ACK_DEBOUNCE_MS = 150;
  var MIN_CHARS = 6;
  var MIN_TERMS = 2;
  var ACK_MIN_CHARS = 4;
  var ACK_MIN_TERMS = 2;
  var WORD_BOUNDARY_MS = 50;
  var RESPONSE_MAX_CONCURRENT = 2;
  var HISTORY_API_MAX_TURNS = 6;
  var HISTORY_BODY_MAX = 200;
  var HISTORY_CONTENT_MAX = 160;

  function minifyHistoryForApi(history) {
    if (!Array.isArray(history)) {
      return [];
    }
    return history.slice(-HISTORY_API_MAX_TURNS).map(function (turn) {
      if (!turn || !turn.role) {
        return null;
      }
      var role = turn.role === 'assistant' ? 'assistant' : 'user';
      var content = String(turn.content || '').trim();
      var maxContent = role === 'user' ? 280 : HISTORY_CONTENT_MAX;
      if (content.length > maxContent) {
        content = content.slice(0, maxContent);
      }
      var out = { role: role, content: content };
      if (role !== 'assistant' || !turn.card || typeof turn.card !== 'object') {
        return out;
      }
      var card = turn.card;
      var snap = {};
      if (card.title) {
        snap.title = String(card.title).slice(0, 120);
      }
      if (card.body) {
        snap.body = String(card.body).slice(0, HISTORY_BODY_MAX);
      }
      if (card.cta && card.cta.url) {
        snap.cta = {
          label: String(card.cta.label || '').slice(0, 60),
          url: String(card.cta.url)
        };
      }
      if (Array.isArray(card.links) && card.links.length) {
        snap.links = card.links.slice(0, 4).map(function (link) {
          return {
            label: String((link && link.label) || '').slice(0, 60),
            url: String((link && link.url) || '')
          };
        }).filter(function (link) {
          return link.url !== '';
        });
      }
      if (Array.isArray(card.relatedTopics) && card.relatedTopics.length) {
        snap.relatedTopics = card.relatedTopics.slice(0, 5).map(function (topic) {
          return String(topic || '').slice(0, 80);
        }).filter(Boolean);
      }
      if (Object.keys(snap).length) {
        out.card = snap;
      }
      return out;
    }).filter(Boolean);
  }

  var STOP_WORDS = {
    a: 1, an: 1, the: 1, is: 1, it: 1, in: 1, on: 1, at: 1, to: 1, for: 1,
    of: 1, and: 1, or: 1, but: 1, not: 1, with: 1, this: 1, that: 1, from: 1,
    by: 1, are: 1, was: 1, were: 1, be: 1, been: 1, being: 1, have: 1, has: 1,
    had: 1, do: 1, does: 1, did: 1, will: 1, would: 1, could: 1, should: 1,
    may: 1, might: 1, can: 1, i: 1, you: 1, we: 1, they: 1, he: 1, she: 1,
    me: 1, my: 1, your: 1, what: 1, where: 1, when: 1, how: 1, which: 1,
    who: 1, whom: 1, about: 1, up: 1, out: 1, so: 1, if: 1, then: 1, than: 1,
    too: 1, very: 1, just: 1, more: 1, also: 1, any: 1, each: 1, all: 1,
    tell: 1, please: 1
  };

  var cache = {
    message: '',
    prefetch_key: '',
    ack: null,
    serverAck: null,
    serverAckMessage: ''
  };

  var debounceTimer = null;
  var ackDebounceTimer = null;
  var abortController = null;
  var ackAbortController = null;
  var boundOptions = null;

  var responseCache = {};
  var responseQueue = [];
  var responseActive = 0;
  var responseControllers = {};
  var pageContextKey = '';

  function pageContextPayload(options) {
    options = options || {};
    var payload = {
      page_url: options.pageUrl || '',
      post_id: options.postId != null ? options.postId : 0,
      page_title: options.pageTitle || '',
      page_context_key: options.pageContextKey || pageContextKey || ''
    };
    if (options.targetScope) {
      payload.target_scope = options.targetScope;
    }
    return payload;
  }

  function normalizeRetrievalQuery(query) {
    var q = String(query || '').trim().toLowerCase();
    if (q.indexOf('tell me about ') === 0) {
      q = q.slice(14).trim();
    }
    return q;
  }

  function extractTerms(query) {
    var q = normalizeRetrievalQuery(query);
    q = q.replace(/[^\w\s]/g, ' ');
    var words = q.split(/\s+/);
    var terms = [];
    words.forEach(function (w) {
      if (w.length >= 2 && !STOP_WORDS[w]) {
        terms.push(w);
      }
    });
    var seen = {};
    return terms.filter(function (t) {
      if (seen[t]) return false;
      seen[t] = true;
      return true;
    });
  }

  function draftEligible(text, minChars, minTerms) {
    var trimmed = String(text || '').trim();
    var chars = typeof minChars === 'number' ? minChars : MIN_CHARS;
    var terms = typeof minTerms === 'number' ? minTerms : MIN_TERMS;
    if (trimmed.length < chars && extractTerms(trimmed).length < terms) {
      return false;
    }
    return trimmed.length >= chars || extractTerms(trimmed).length >= terms;
  }

  function atWordBoundary(text) {
    return /[\s,.!?;:]$/.test(String(text || ''));
  }

  function clearCacheIfMismatch(message) {
    if (cache.message && cache.message !== message) {
      cache.message = '';
      cache.prefetch_key = '';
      cache.ack = null;
      cache.serverAck = null;
      cache.serverAckMessage = '';
    }
  }

  function getForMessage(message) {
    var trimmed = String(message || '').trim();
    if (!trimmed || cache.message !== trimmed || !cache.prefetch_key) {
      return null;
    }
    return {
      message: cache.message,
      prefetch_key: cache.prefetch_key,
      ack: cache.ack
    };
  }

  function historyKey(history) {
    try {
      return JSON.stringify(minifyHistoryForApi(history));
    } catch (_) {
      return '';
    }
  }

  /**
   * Match stream submit: history sent to the server includes the pending user turn.
   */
  function historyIncludingMessage(message, history) {
    var base = minifyHistoryForApi(history);
    var trimmed = String(message || '').trim();
    if (!trimmed) {
      return base;
    }
    var last = base.length ? base[base.length - 1] : null;
    if (last && last.role === 'user' && String(last.content || '').trim() === trimmed) {
      return base;
    }
    return base.concat([{ role: 'user', content: trimmed }]);
  }

  function responseCacheKey(message, history) {
    return historyKey(historyIncludingMessage(message, history)) + '|' + String(message || '').trim();
  }

  function getResponsePrefetch(message, history) {
    var key = responseCacheKey(message, history);
    var entry = responseCache[key];
    if (entry && entry.ready && entry.prefetch_key) {
      return {
        message: String(message || '').trim(),
        prefetch_key: entry.prefetch_key,
        ack: entry.ack || null,
        ready: true
      };
    }
    return null;
  }

  function consumeResponsePrefetch(message, history) {
    var hit = getResponsePrefetch(message, history);
    if (!hit) {
      return null;
    }
    delete responseCache[responseCacheKey(message, history)];
    return hit;
  }

  function abortResponsePrefetch(message, history) {
    var key = responseCacheKey(message, history);
    if (responseControllers[key]) {
      responseControllers[key].abort();
      delete responseControllers[key];
    }
    delete responseCache[key];
  }

  function runResponsePrefetch(message, history, options) {
    if (!options || !options.ajaxUrl || !options.streamNonce) {
      return;
    }
    var trimmed = String(message || '').trim();
    if (!trimmed) {
      return;
    }

    var key = responseCacheKey(trimmed, history);
    var existing = responseCache[key];
    if (existing && (existing.pending || existing.ready)) {
      return;
    }

    if (typeof options.isLoading === 'function' && options.isLoading()) {
      responseQueue.unshift({ message: trimmed, history: history, options: options });
      return;
    }

    responseActive += 1;

    responseCache[key] = { pending: true };

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) {
      responseControllers[key] = controller;
    }

    var url = options.ajaxUrl + '?action=flowbie_chat_response_prefetch&_nonce=' + encodeURIComponent(options.streamNonce);
    var payload = {
      message: trimmed,
      history: historyIncludingMessage(trimmed, history),
      session_id: options.sessionId || '',
      source: options.source || 'frontend'
    };
    Object.assign(payload, pageContextPayload(options));

    var fetchOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (controller) {
      fetchOpts.signal = controller.signal;
    }

    fetch(url, fetchOpts)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        delete responseControllers[key];
        if (!data || !data.success || !data.data) {
          delete responseCache[key];
          return;
        }
        var body = data.data;
        if (body.message !== trimmed) {
          delete responseCache[key];
          return;
        }
        responseCache[key] = {
          ready: true,
          prefetch_key: body.prefetch_key || '',
          ack: body.ack || null
        };
      })
      .catch(function (err) {
        delete responseControllers[key];
        if (err && err.name === 'AbortError') {
          return;
        }
        delete responseCache[key];
      })
      .then(function () {
        responseActive = Math.max(0, responseActive - 1);
        drainResponseQueue();
      });
  }

  function drainResponseQueue() {
    while (responseActive < RESPONSE_MAX_CONCURRENT && responseQueue.length) {
      var job = responseQueue.shift();
      if (!job || !job.message) {
        continue;
      }
      var key = responseCacheKey(job.message, job.history);
      var existing = responseCache[key];
      if (existing && (existing.pending || existing.ready)) {
        continue;
      }
      if (typeof job.options.isLoading === 'function' && job.options.isLoading()) {
        responseQueue.unshift(job);
        break;
      }
      runResponsePrefetch(job.message, job.history, job.options);
    }
  }

  function enqueueResponsePrefetch(message, history, options) {
    var trimmed = String(message || '').trim();
    if (!trimmed || !options) {
      return;
    }
    var key = responseCacheKey(trimmed, history);
    if (responseCache[key] && (responseCache[key].pending || responseCache[key].ready)) {
      return;
    }
    responseQueue.push({
      message: trimmed,
      history: historyIncludingMessage(trimmed, history),
      options: options
    });
    drainResponseQueue();
  }

  function prefetchSuggestions(messages, options) {
    if (!Array.isArray(messages) || !messages.length || !options) {
      return;
    }
    messages.forEach(function (msg) {
      enqueueResponsePrefetch(msg, options.history || [], options);
    });
  }

  function clearResponseCache() {
    Object.keys(responseControllers).forEach(function (key) {
      if (responseControllers[key]) {
        responseControllers[key].abort();
      }
    });
    responseControllers = {};
    responseCache = {};
    responseQueue = [];
    responseActive = 0;
  }

  function getPrefetchAck(message, prefetchHit) {
    if (prefetchHit && prefetchHit.ack && prefetchHit.ack.text) {
      return String(prefetchHit.ack.text);
    }
    var trimmed = String(message || '').trim();
    if (
      cache.serverAck
      && cache.serverAck.text
      && cache.serverAckMessage === trimmed
    ) {
      return String(cache.serverAck.text);
    }
    return '';
  }

  function runAckPrefetch(text, options) {
    if (!options || !options.ajaxUrl || !options.streamNonce) {
      return;
    }
    var trimmed = String(text || '').trim();
    if (!draftEligible(trimmed, ACK_MIN_CHARS, ACK_MIN_TERMS)) {
      return;
    }
    if (typeof options.isLoading === 'function' && options.isLoading()) {
      return;
    }

    if (ackAbortController) {
      ackAbortController.abort();
    }
    ackAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

    var url = options.ajaxUrl + '?action=flowbie_chat_ack_prefetch&_nonce=' + encodeURIComponent(options.streamNonce);
    var payload = {
      message: trimmed,
      history: minifyHistoryForApi(options.history),
      session_id: options.sessionId || '',
      source: options.source || 'frontend'
    };
    Object.assign(payload, pageContextPayload(options));

    var fetchOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (ackAbortController) {
      fetchOpts.signal = ackAbortController.signal;
    }

    fetch(url, fetchOpts)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.success || !data.data) return;
        var body = data.data;
        if (body.message !== trimmed) return;
        cache.serverAckMessage = trimmed;
        cache.serverAck = body.ack || null;
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
      });
  }

  function runPrefetch(text, options) {
    if (!options || !options.ajaxUrl || !options.streamNonce) {
      return;
    }
    var trimmed = String(text || '').trim();
    if (!draftEligible(trimmed)) {
      return;
    }
    if (typeof options.isLoading === 'function' && options.isLoading()) {
      return;
    }

    if (abortController) {
      abortController.abort();
    }
    abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

    var url = options.ajaxUrl + '?action=flowbie_chat_prefetch&_nonce=' + encodeURIComponent(options.streamNonce);
    var payload = {
      message: trimmed,
      history: minifyHistoryForApi(options.history),
      session_id: options.sessionId || '',
      source: options.source || 'frontend'
    };
    Object.assign(payload, pageContextPayload(options));

    var fetchOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (abortController) {
      fetchOpts.signal = abortController.signal;
    }

    fetch(url, fetchOpts)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.success || !data.data) return;
        var body = data.data;
        if (body.message !== trimmed) return;
        cache.message = trimmed;
        cache.prefetch_key = body.prefetch_key || '';
        cache.ack = body.ack || null;
        if (body.ack) {
          cache.serverAckMessage = trimmed;
          cache.serverAck = body.ack;
        }
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
      });
  }

  function scheduleAckPrefetch(text, options) {
    if (ackDebounceTimer) {
      clearTimeout(ackDebounceTimer);
    }
    var trimmed = String(text || '').trim();
    if (!draftEligible(trimmed, ACK_MIN_CHARS, ACK_MIN_TERMS)) {
      return;
    }

    ackDebounceTimer = setTimeout(function () {
      ackDebounceTimer = null;
      runAckPrefetch(trimmed, options);
    }, ACK_DEBOUNCE_MS);
  }

  function schedulePrefetch(text, options) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    var trimmed = String(text || '').trim();
    clearCacheIfMismatch(trimmed);
    scheduleAckPrefetch(trimmed, options);
    if (!draftEligible(trimmed)) {
      return;
    }

    var delay = atWordBoundary(trimmed) ? WORD_BOUNDARY_MS : DEBOUNCE_MS;
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      runPrefetch(trimmed, options);
    }, delay);
  }

  function bindComposer(textarea, options) {
    if (!textarea) return;
    boundOptions = options || null;
    textarea.addEventListener('input', function () {
      if (!boundOptions) return;
      schedulePrefetch(textarea.value, boundOptions);
    });
  }

  function warmPageContext(pageContext, options) {
    if (!pageContext || !options || !options.ajaxUrl || !options.streamNonce) {
      return;
    }
    if (options.targetScope === 'site') {
      return;
    }
    var url = options.ajaxUrl + '?action=flowbie_chat_page_context&_nonce=' + encodeURIComponent(options.streamNonce);
    var payload = {
      page_url: pageContext.url || options.pageUrl || (typeof window !== 'undefined' ? window.location.href : ''),
      post_id: options.postId != null ? options.postId : (pageContext.postId || 0),
      page_title: options.pageTitle || (typeof document !== 'undefined' ? document.title : '') || pageContext.title || '',
      session_id: options.sessionId || '',
      source: options.source || 'frontend'
    };
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.success || !data.data) return;
        if (data.data.page_context_key) {
          pageContextKey = data.data.page_context_key;
        }
      })
      .catch(function () {});
  }

  function refreshOptions(options) {
    boundOptions = options || boundOptions;
    if (options && options.pageContextKey) {
      pageContextKey = options.pageContextKey;
    }
  }

  function consumeForSubmit(message, history) {
    var responseHit = history ? consumeResponsePrefetch(message, history) : null;
    if (responseHit) {
      return responseHit;
    }
    var hit = getForMessage(message);
    if (hit) {
      cache.message = '';
      cache.prefetch_key = '';
      cache.ack = null;
    }
    return hit;
  }

  function prefetchOnSendIntent(textarea) {
    if (!boundOptions || !textarea) return;
    var trimmed = String(textarea.value || '').trim();
    if (!trimmed) return;
    clearCacheIfMismatch(trimmed);
    if (getForMessage(trimmed)) return;
    scheduleAckPrefetch(trimmed, boundOptions);
    if (draftEligible(trimmed)) {
      runPrefetch(trimmed, boundOptions);
    }
  }

  global.FlowbieChatPrefetch = {
    minifyHistoryForApi: minifyHistoryForApi,
    getPrefetchAck: getPrefetchAck,
    getForMessage: getForMessage,
    getResponsePrefetch: getResponsePrefetch,
    consumeForSubmit: consumeForSubmit,
    prefetchSuggestions: prefetchSuggestions,
    warmPageContext: warmPageContext,
    bindComposer: bindComposer,
    refreshOptions: refreshOptions,
    prefetchOnSendIntent: prefetchOnSendIntent,
    getPageContextKey: function () { return pageContextKey; },
    clearCache: function () {
      cache.message = '';
      cache.prefetch_key = '';
      cache.ack = null;
      cache.serverAck = null;
      cache.serverAckMessage = '';
      pageContextKey = '';
      clearResponseCache();
    }
  };
})(typeof window !== 'undefined' ? window : this);
