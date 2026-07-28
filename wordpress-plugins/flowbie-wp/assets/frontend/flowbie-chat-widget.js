/**
 * Flowbie Chat Widget – Dark Glassmorphism Edition
 *
 * Reads config from the global `flowbieChatConfig` object injected by
 * wp_localize_script (restUrl, nonce, siteName, welcomeMessage, color, position, assistantName).
 */
(function () {
  'use strict';

  var cfg = window.flowbieChatConfig || {};
  if (!cfg.restUrl) return;

  var root = document.getElementById('flowbie-chat-widget-root');
  if (!root) return;

  var POS = cfg.position || 'bottom-right';
  var ASSISTANT = cfg.assistantName || 'Flow Assist';
  var UI = cfg.ui || {};
  var isOpen = false;
  var history = [];
  var isLoading = false;

  function uiOn(key) {
    return UI[key] !== false;
  }

  function getChatSessionId() {
    var key = 'flowbie_chat_session_id';
    var id = sessionStorage.getItem(key);
    if (!id) {
      id = 'csess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  // ── DOM scaffold ──────────────────────────────────────────────

  root.innerHTML = '';
  root.className = 'flowbie-chat-widget flowbie-chat--' + POS;
  if (cfg.cssVars) {
    root.setAttribute('style', cfg.cssVars);
  }
  var hideMap = {
    launcher: 'fcw-hide-launcher',
    header: 'fcw-hide-header',
    assistant_name: 'fcw-hide-assistant-name',
    close_button: 'fcw-hide-close-button',
    thinking_card: 'fcw-hide-thinking-card',
    source_pills: 'fcw-hide-source-pills',
    cta_buttons: 'fcw-hide-cta-buttons',
    suggestion_chips: 'fcw-hide-suggestion-chips',
    confidence: 'fcw-hide-confidence',
    send_button: 'fcw-hide-send-button'
  };
  Object.keys(hideMap).forEach(function (k) {
    if (!uiOn(k)) root.classList.add(hideMap[k]);
  });

  var bubble = el('button', {
    className: 'fcw-bubble',
    'aria-label': 'Open chat',
    innerHTML: SVG_CHAT
  });

  var panel = el('div', { className: 'fcw-panel fcw-panel--hidden' });

  var header = el('div', { className: 'fcw-header' });
  if (uiOn('assistant_name')) {
    header.innerHTML =
      '<span class="fcw-header__title">' + esc(ASSISTANT) + '</span>';
  }
  var closeBtn = el('button', {
    className: 'fcw-header__close',
    'aria-label': 'Close chat',
    innerHTML: SVG_CLOSE
  });
  if (uiOn('close_button')) {
    header.appendChild(closeBtn);
  }
  if (!uiOn('header')) {
    header.style.display = 'none';
  }

  var messages = el('div', { className: 'fcw-messages' });
  var inputRow = el('form', { className: 'fcw-input-row' });
  var textarea = el('textarea', {
    className: 'fcw-textarea',
    placeholder: 'Type a message\u2026',
    rows: 1
  });
  var sendBtn = el('button', {
    className: 'fcw-send',
    type: 'button',
    'aria-label': 'Hold to speak',
    innerHTML: '<span class="fcw-send__icon fcw-send__icon--send" aria-hidden="true">' + SVG_SEND + '</span>'
  });

  inputRow.appendChild(textarea);
  inputRow.appendChild(sendBtn);
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(inputRow);
  root.appendChild(bubble);
  root.appendChild(panel);

  // ── Events ────────────────────────────────────────────────────

  bubble.addEventListener('click', function () { toggle(true); });
  if (uiOn('close_button')) {
    closeBtn.addEventListener('click', function () { toggle(false); });
  }
  inputRow.addEventListener('submit', onSubmit);
  function voiceUnlock() {
    if (typeof window.flowbieVoiceSafeUnlock === 'function') {
      return window.flowbieVoiceSafeUnlock();
    }
    return Promise.resolve();
  }

  function voiceAckPlaybackParallel(text) {
    if (cfg.voiceAck === false) return;
    if (typeof window.flowbieVoiceSafeAckPlayback === 'function') {
      window.flowbieVoiceSafeAckPlayback(text);
      return;
    }
    if (typeof window.flowbieVoiceSafePlayAck === 'function') {
      window.flowbieVoiceSafePlayAck(text);
      return;
    }
    if (window.FlowbieVoice && typeof window.FlowbieVoice.playbackAckParallel === 'function') {
      window.FlowbieVoice.playbackAckParallel(text);
    }
  }

  var SVG_BRAIN =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" style="color:var(--fcw-highlight,#06b6d4)">' +
    '<path d="M12 2c-2 0-3.5 1.5-4 3.5C6 5 4 6 4 9c0 2 1 3.5 2.5 4.5-.5 1.5 0 3 1.5 4 1 1.5 2.5 2 4 2s3-.5 4-2c1.5-1 2-2.5 1.5-4C20 12.5 21 11 21 9c0-3-2-4-4-3.5C15.5 3.5 14 2 12 2z"/>' +
    '</svg>';

  function fcwStepIcon(status) {
    if (status === 'done') return '\u2713';
    if (status === 'error') return '\u2717';
    return '\u25cb';
  }

  function fcwApplyStepIcon(iconEl, status) {
    iconEl.className = 'fcw-thinking-step-icon';
    if (status === 'running') {
      iconEl.className += ' fcw-thinking-step-icon--brain';
      iconEl.innerHTML = SVG_BRAIN;
    } else {
      iconEl.textContent = fcwStepIcon(status);
    }
  }

  function fcwBuildStepsList(steps) {
    var ul = el('ul', { className: 'fcw-thinking-steps' });
    (steps || []).forEach(function (step, idx) {
      var st = step.status || 'pending';
      var li = el('li', { className: 'fcw-thinking-step fcw-thinking-step--' + st });
      li.setAttribute('data-step-index', String(idx));
      var icon = el('span');
      fcwApplyStepIcon(icon, st);
      var lbl = el('span', { className: 'fcw-thinking-step-label' });
      lbl.textContent = step.label || 'Step ' + (idx + 1);
      li.appendChild(icon);
      li.appendChild(lbl);
      ul.appendChild(li);
    });
    return ul;
  }

  function fcwAppendWorkflowCard(card) {
    var row = el('div', { className: 'fcw-msg fcw-msg--assistant' });
    var cardEl = el('div', { className: 'fcw-card fcw-card--thinking-active' });
    var titleRow = el('div', { className: 'fcw-card__title-row' });
    var badge = el('span', { className: 'fcw-card__type-badge' });
    badge.textContent = 'working';
    var title = el('span', { className: 'fcw-card__title' });
    title.innerHTML = renderMarkdown(card.title || 'Working on it\u2026');
    titleRow.appendChild(badge);
    titleRow.appendChild(title);
    cardEl.appendChild(titleRow);
    var bodyEl = el('div', { className: 'fcw-card__body' });
    if (card.body) {
      bodyEl.innerHTML = renderMarkdown(card.body);
    } else {
      bodyEl.style.display = 'none';
    }
    cardEl.appendChild(bodyEl);
    var stepsList = fcwBuildStepsList(card.steps || []);
    cardEl.appendChild(stepsList);
    row.appendChild(cardEl);
    messages.appendChild(row);
    scrollDown();
    return { root: row, cardEl: cardEl, badgeEl: badge, titleEl: title, bodyEl: bodyEl, stepsList: stepsList };
  }

  function fcwSetWorkflowStepStatus(shell, idx, status) {
    if (!shell || !shell.stepsList) return;
    var li = shell.stepsList.querySelector('[data-step-index="' + idx + '"]');
    if (!li) return;
    li.className = 'fcw-thinking-step fcw-thinking-step--' + status;
    var icon = li.children[0];
    if (icon) fcwApplyStepIcon(icon, status);
  }

  function fcwSetWorkflowCardActive(shell, active) {
    if (shell && shell.cardEl) {
      shell.cardEl.classList.toggle('fcw-card--thinking-active', !!active);
    }
  }

  function fcwApplyCardBadge(badgeEl, t) {
    badgeEl.textContent = t || 'answer';
  }

  function fcwPopulateCardExtras(shell, card) {
    if (!shell || !shell.cardEl) return;
    var cardEl = shell.cardEl;
    var old = cardEl.querySelectorAll('.fcw-card__confidence, .fcw-card__links, .fcw-card__cta-wrap, .fcw-card__topics');
    old.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    var confMap = { high: 'High confidence', medium: 'Based on site content', low: 'Limited information' };
    var conf = el('div', { className: 'fcw-card__confidence' });
    conf.textContent = confMap[card.confidence] || confMap.medium;
    cardEl.appendChild(conf);
    if (card.links && card.links.length) {
      var linksWrap = el('div', { className: 'fcw-card__links' });
      card.links.forEach(function (link) {
        var a = el('a', { className: 'fcw-link-pill', href: link.url, target: '_blank', rel: 'noopener noreferrer' });
        a.textContent = link.label;
        linksWrap.appendChild(a);
      });
      cardEl.appendChild(linksWrap);
    }
    if (card.cta && card.cta.url) {
      var ctaWrap = el('div', { className: 'fcw-card__cta-wrap' });
      var cta = el('a', { className: 'fcw-cta-btn', href: card.cta.url, target: '_blank', rel: 'noopener noreferrer' });
      cta.textContent = card.cta.label || 'Learn more';
      ctaWrap.appendChild(cta);
      cardEl.appendChild(ctaWrap);
    }
  }

  function fcwThinkingHost() {
    return {
      appendWorkflowCard: fcwAppendWorkflowCard,
      setWorkflowStepStatus: fcwSetWorkflowStepStatus,
      setWorkflowCardActive: fcwSetWorkflowCardActive,
      applyCardBadge: fcwApplyCardBadge,
      renderMd: renderMarkdown,
      populateCardExtras: fcwPopulateCardExtras,
      scrollDown: scrollDown
    };
  }

  function presentCardWithVoice(card, userMessage, opts) {
    opts = opts || {};
    var shell = opts.shell;
    var host = fcwThinkingHost();
    var done = function () {
      history.push({ role: 'assistant', content: card.body || card.title });
      if (typeof opts.onDone === 'function') {
        opts.onDone();
      }
    };
    if (shell && window.FlowbieThinkingCard) {
      FlowbieThinkingCard.finalizeToCard(shell, card, host);
      done();
      return FlowbieThinkingCard.narrateAndVoiceStep(card, userMessage, shell, host);
    }
    if (typeof window.flowbieVoicePresentCard === 'function') {
      return window.flowbieVoicePresentCard(card, userMessage, {
        append: function () { appendCard(card); },
        finish: done
      });
    }
    appendCard(card);
    done();
    return Promise.resolve();
  }

  sendBtn.addEventListener('click', function () {
    voiceUnlock();
    if (textarea.value.trim()) {
      inputRow.dispatchEvent(new Event('submit'));
    }
  });
  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      voiceUnlock();
      e.preventDefault();
      inputRow.dispatchEvent(new Event('submit'));
    }
  });

  if (cfg.voiceEnabled && window.FlowbieVoice && uiOn('mic_button')) {
    FlowbieVoice.init({
      transcribeUrl: cfg.transcribeUrl,
      ackUrl: cfg.ackUrl,
      narrateUrl: cfg.narrateUrl,
      voiceNonce: cfg.streamNonce,
      voiceAck: cfg.voiceAck !== false,
      voiceNarrate: cfg.voiceNarrate !== false,
      micReplacesSend: cfg.micReplacesSend !== false
    });
    if (cfg.voicePtt !== false) {
      FlowbieVoice.bindPtt(sendBtn, textarea, {
        isLoading: function () { return isLoading; },
        onTranscript: function (text) { deliverMessage(text); },
        onError: function (msg) {
          if (uiOn('voice_toast')) showVoiceToast(msg);
        }
      });
    }
  }

  function toggle(open) {
    isOpen = open;
    panel.classList.toggle('fcw-panel--hidden', !open);
    bubble.classList.toggle('fcw-bubble--hidden', open);
    if (open && messages.children.length === 0) {
      if (uiOn('welcome_message')) {
        appendWelcome();
      }
      textarea.focus();
    }
  }

  function appendWelcome() {
    var card = {
      type: 'answer',
      title: ASSISTANT,
      body: cfg.welcomeMessage || 'Hi! Ask me anything about this website.',
      confidence: 'high'
    };
    appendCard(card);
  }

  function onSubmit(e) {
    e.preventDefault();
    var text = textarea.value.trim();
    if (!text || isLoading) return;
    deliverMessage(text);
  }

  function deliverMessage(text) {
    if (!text || isLoading) return;
    voiceUnlock();
    textarea.value = '';
    autoResize(textarea);
    if (window.FlowbieVoice && typeof window.FlowbieVoice.updateSendMicVisibility === 'function') {
      FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
    }
    voiceAckPlaybackParallel(text);
    appendUserBubble(text);
    history.push({ role: 'user', content: text });
    sendMessage(text);
  }

  function showVoiceToast(msg) {
    var row = el('div', { className: 'fcw-msg fcw-msg--assistant' });
    var t = el('div', { className: 'flowbie-voice-toast' });
    t.textContent = msg;
    row.appendChild(t);
    messages.appendChild(row);
    scrollDown();
    setTimeout(function () {
      if (row.parentNode) row.parentNode.removeChild(row);
    }, 4500);
  }

  // ── API (streaming via admin-ajax) ────────────────────────────

  function sendMessage(text) {
    isLoading = true;
    sendBtn.disabled = true;
    if (window.FlowbieVoice) {
      FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
    }
    var host = fcwThinkingHost();
    var thinkingShell = window.FlowbieThinkingCard
      ? FlowbieThinkingCard.createThinkingCard(host, { stream: true })
      : null;

    var url = (cfg.ajaxUrl || cfg.restUrl) +
      '?action=flowbie_chat_stream&_nonce=' + encodeURIComponent(cfg.streamNonce || '');

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: history.slice(-10),
        session_id: getChatSessionId(),
        source: 'frontend',
        page_url: window.location.href || ''
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) return;
          buf += decoder.decode(result.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          lines.forEach(function (line) {
            line = line.trim();
            if (!line) return;
            var evt;
            try { evt = JSON.parse(line); } catch (_) { return; }
            if (evt.status === 'done' && evt.card) {
              presentCardWithVoice(evt.card, text, {
                shell: thinkingShell,
                onDone: function () {
                  isLoading = false;
                  sendBtn.disabled = false;
                  if (window.FlowbieVoice) {
                    FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
                  }
                }
              });
            } else if (evt.label && thinkingShell && window.FlowbieThinkingCard) {
              FlowbieThinkingCard.advanceStreamLabel(thinkingShell, host, evt.label);
            }
          });
          return pump();
        });
      }
      return pump();
    }).catch(function () {
      isLoading = false;
      sendBtn.disabled = false;
      if (window.FlowbieVoice) {
        FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
      }
      presentCardWithVoice({
        type: 'not-found',
        title: 'Connection error',
        body: 'Could not reach the server. Please check your internet connection.',
        confidence: 'low'
      }, text, { shell: thinkingShell });
    });
  }

  // ── Rendering ─────────────────────────────────────────────────

  function appendUserBubble(text) {
    var row = el('div', { className: 'fcw-msg fcw-msg--user' });
    var bub = el('div', { className: 'fcw-user-bubble' });
    bub.textContent = text;
    row.appendChild(bub);
    messages.appendChild(row);
    scrollDown();
  }

  function appendCard(card) {
    var row = el('div', { className: 'fcw-msg fcw-msg--assistant' });
    var cardEl = el('div', { className: 'fcw-card' });

    var titleRow = el('div', { className: 'fcw-card__title-row' });

    var badge = el('span', {
      className: 'fcw-card__type-badge'
    });
    badge.textContent = card.type || 'answer';
    titleRow.appendChild(badge);

    var title = el('span', { className: 'fcw-card__title' });
    title.innerHTML = renderMarkdown(card.title || '');
    titleRow.appendChild(title);
    cardEl.appendChild(titleRow);

    if (card.body) {
      var body = el('div', { className: 'fcw-card__body' });
      body.innerHTML = renderMarkdown(card.body);
      cardEl.appendChild(body);
    }

    var confMap = {
      high: 'High confidence',
      medium: 'Based on site content',
      low: 'Limited information'
    };
    var conf = el('div', { className: 'fcw-card__confidence' });
    conf.textContent = confMap[card.confidence] || confMap.medium;
    cardEl.appendChild(conf);

    if (card.links && card.links.length) {
      var linksWrap = el('div', { className: 'fcw-card__links' });
      card.links.forEach(function (link) {
        var a = el('a', {
          className: 'fcw-link-pill',
          href: link.url,
          target: '_blank',
          rel: 'noopener noreferrer'
        });
        var icon = linkIcon(link.icon);
        if (icon) {
          var iconSpan = el('span', { className: 'fcw-link-pill__icon', innerHTML: icon });
          a.appendChild(iconSpan);
        }
        var lbl = el('span', {});
        lbl.textContent = link.label;
        a.appendChild(lbl);
        linksWrap.appendChild(a);
      });
      cardEl.appendChild(linksWrap);
    }

    if (card.cta && card.cta.url) {
      var ctaWrap = el('div', { className: 'fcw-card__cta-wrap' });
      var cta = el('a', {
        className: 'fcw-cta-btn',
        href: card.cta.url,
        target: '_blank',
        rel: 'noopener noreferrer'
      });
      cta.textContent = card.cta.label || 'Learn more';
      ctaWrap.appendChild(cta);
      cardEl.appendChild(ctaWrap);
    }

    if (card.relatedTopics && card.relatedTopics.length) {
      var topics = el('div', { className: 'fcw-card__topics' });
      card.relatedTopics.forEach(function (topic) {
        var chip = el('button', { className: 'fcw-topic-chip', type: 'button' });
        chip.textContent = topic;
        chip.addEventListener('click', function () {
          textarea.value = topic;
          inputRow.dispatchEvent(new Event('submit'));
        });
        topics.appendChild(chip);
      });
      cardEl.appendChild(topics);
    }

    row.appendChild(cardEl);
    messages.appendChild(row);
    scrollDown();
  }

  function appendStatus(label) {
    var row = el('div', { className: 'fcw-msg fcw-msg--assistant' });
    var s = el('div', { className: 'fcw-status' });
    s.textContent = label;
    row.appendChild(s);
    messages.appendChild(row);
    scrollDown();
    return row;
  }

  function updateStatus(row, label) {
    var s = row && row.querySelector('.fcw-status');
    if (s) s.textContent = label;
    scrollDown();
  }

  function removeStatus(row) {
    if (row && row.parentNode) {
      row.parentNode.removeChild(row);
    }
  }

  function scrollDown() {
    requestAnimationFrame(function () {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') node.className = attrs[k];
        else if (k === 'innerHTML') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderMarkdown(text) {
    var s = esc(text);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  function linkIcon(type) {
    if (type === 'post') return SVG_ICON_POST;
    if (type === 'page') return SVG_ICON_PAGE;
    if (type === 'external') return SVG_ICON_EXT;
    return SVG_ICON_PAGE;
  }

  function autoResize(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }
  textarea.addEventListener('input', function () { autoResize(textarea); });

  // ── SVG icons ─────────────────────────────────────────────────

  var SVG_CHAT = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var SVG_CLOSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var SVG_SEND = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  var SVG_ICON_PAGE = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 1h5.5L13 4.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><polyline points="9 1 9 5 13 5"/></svg>';

  var SVG_ICON_POST = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="5" x2="11" y2="5"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="5" y1="11" x2="8" y2="11"/></svg>';

  var SVG_ICON_EXT = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4"/><polyline points="8 2 14 2 14 8"/><line x1="14" y1="2" x2="7" y2="9"/></svg>';
})();
