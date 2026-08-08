/**
 * Flowbie Chat Widget – Dark Glassmorphism Edition
 *
 * Reads config from the global `flowbieChatConfig` object injected by
 * wp_localize_script (restUrl, nonce, siteName, welcomeMessage, color, assistantName).
 */
(function () {
  'use strict';

  var cfg = window.flowbieChatConfig || {};
  if (!cfg.restUrl) return;

  var root = document.getElementById('flowbie-chat-widget-root');
  if (!root) return;

  var ASSISTANT = cfg.assistantName || 'Flow Assist';
  var UI = cfg.ui || {};
  var SIDEBAR_SIDE = cfg.sidebarSide === 'left' ? 'left' : 'right';
  var SIDEBAR_TRANSITION = cfg.sidebarTransition || 'slide';
  var SIDEBAR_LAYOUT = Array.isArray(cfg.sidebarLayout) ? cfg.sidebarLayout : ['chat'];
  var SHOW_SIDEBAR_HEADING = SIDEBAR_LAYOUT.indexOf('heading') !== -1 && cfg.sidebarHeading;
  var SHOW_CONTACT_HUMAN = cfg.chekkitEnabled !== false && !!cfg.chekkitSubmitUrl;
  var CAN_COPY_LOG = cfg.canCopyLog === true;
  var CAN_BACKEND_MODE = cfg.canBackendMode === true;
  var SHOW_CHAT_BODY = SIDEBAR_LAYOUT.indexOf('chat') !== -1 || SIDEBAR_LAYOUT.length === 0;
  var sidebarShell = null;
  var isOpen = false;
  var history = [];
  var isLoading = false;
  var shellNodesMounted = false;

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width:767px)').matches;
  }

  function lockMobileRootClosed() {
    if (!isMobileViewport()) return;
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.classList.add('fcw-mobile-root-closed');
    root.style.cssText = (cfg.cssVars || '') + ';display:none!important;visibility:hidden!important;position:absolute!important;left:-9999px!important;top:auto!important;width:0!important;height:0!important;max-width:0!important;overflow:hidden!important;pointer-events:none!important;margin:0!important;padding:0!important;border:0!important';
  }

  function showMobileRootForPanel() {
    if (!isMobileViewport()) return;
    root.hidden = false;
    root.removeAttribute('aria-hidden');
    root.classList.remove('fcw-mobile-root-closed');
    root.style.display = 'block';
    root.style.visibility = 'visible';
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.left = '0';
    root.style.right = '0';
    root.style.top = '0';
    root.style.bottom = '0';
    root.style.width = 'auto';
    root.style.height = 'auto';
    root.style.maxWidth = 'none';
    root.style.overflow = 'visible';
    root.style.zIndex = '999950';
    root.style.pointerEvents = 'none';
    if (cfg.cssVars) {
      root.setAttribute('style', cfg.cssVars + ';display:block!important;visibility:visible!important;position:fixed!important;inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:auto!important;height:auto!important;max-width:none!important;overflow:visible!important;z-index:999950!important;pointer-events:none!important');
    }
  }

  lockMobileRootClosed();

  function applyLauncherChrome() {
    var launcher = document.getElementById('flowbie-chat-mobile-launcher') || root.querySelector('.fcw-launcher');
    if (!launcher) return;
    launcher.id = 'flowbie-chat-mobile-launcher';
    launcher.classList.add('fcw-mobile-launcher', 'fai-sidebar-launcher', 'fcw-launcher');
    launcher.setAttribute('data-fcw-chat-launcher', '1');
    launcher.setAttribute('aria-controls', 'flowbie-chat-widget-root');
    if (isMobileViewport()) {
      launcher.style.position = 'fixed';
      launcher.style.bottom = '20px';
      launcher.style.right = '16px';
      launcher.style.width = '56px';
      launcher.style.height = '56px';
      launcher.style.zIndex = '999900';
      launcher.style.pointerEvents = 'auto';
    }
  }

  applyLauncherChrome();

  var SVG_DISMISS_RIGHT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M9 6l7 6-7 6V6z"/></svg>';
  var SVG_DISMISS_LEFT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M15 6l-7 6 7 6V6z"/></svg>';
  var SVG_TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  var SVG_CLIPBOARD = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="1"/><rect x="4" y="4" width="11" height="11" rx="1"/></svg>';
  var SVG_SEND = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  var SVG_ICON_PAGE = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 1h5.5L13 4.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><polyline points="9 1 9 5 13 5"/></svg>';
  var SVG_ICON_POST = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="5" x2="11" y2="5"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="5" y1="11" x2="8" y2="11"/></svg>';
  var SVG_ICON_EXT = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4"/><polyline points="8 2 14 2 14 8"/><line x1="14" y1="2" x2="7" y2="9"/></svg>';
  var SVG_CHAT_LAUNCHER = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var SVG_PHONE_LAUNCHER = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M17 1H7C5.9 1 5 1.9 5 3v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm-5 20c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm5-4H7V4h10v13z"/></svg>';
  var SVG_AI_SPARK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/></svg>';
  var SVG_MORE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>';
  var STARTERS = Array.isArray(cfg.conversationStarters) ? cfg.conversationStarters : [];
  var BACKEND_STARTERS = Array.isArray(cfg.backendStarters) ? cfg.backendStarters : [];
  var VISITOR_GREETING_LINE = cfg.greetingLine || 'Hello';
  var VISITOR_GREETING_SUB = cfg.greetingSubline || 'How can I help you today?';
  var adminMode = 'visitor';
  var ADMIN_SUBMODES = ['ask', 'plan', 'build'];
  var ADMIN_SUBMODE_LABELS = { ask: 'Ask', plan: 'Plan', build: 'Build' };
  var adminSubmode = 'ask';
  var adminSubmodeBtn = null;

  function loadAdminMode() {
    if (!CAN_BACKEND_MODE) return;
    try {
      var stored = sessionStorage.getItem('flowbie_chat_admin_mode');
      if (stored === 'backend' || stored === 'visitor') {
        adminMode = stored;
      }
    } catch (_) {}
  }

  function saveAdminMode(mode) {
    adminMode = mode === 'backend' ? 'backend' : 'visitor';
    try {
      sessionStorage.setItem('flowbie_chat_admin_mode', adminMode);
    } catch (_) {}
  }

  function isBackendMode() {
    return CAN_BACKEND_MODE && adminMode === 'backend';
  }

  function getActiveStarters() {
    return isBackendMode() ? BACKEND_STARTERS : STARTERS;
  }

  function getGreetingLine() {
    return VISITOR_GREETING_LINE;
  }

  function getGreetingSubline() {
    if (!isBackendMode()) {
      return VISITOR_GREETING_SUB;
    }
    if (adminSubmode === 'plan') {
      return 'Plan mode: review proposed changes before building.';
    }
    if (adminSubmode === 'build') {
      return 'Build mode: can edit posts, pages, and SEO blocks.';
    }
    return 'Ask mode: analytics, SEO, and read-only site insights.';
  }

  function getAdminModeForApi() {
    return isBackendMode() ? 'backend' : 'visitor';
  }

  function loadAdminSubmode() {
    if (!CAN_BACKEND_MODE) return;
    try {
      var stored = sessionStorage.getItem('flowbie_chat_admin_submode');
      if (stored === 'ask' || stored === 'plan' || stored === 'build') {
        adminSubmode = stored;
      }
    } catch (_) {}
  }

  function saveAdminSubmode(mode) {
    if (ADMIN_SUBMODES.indexOf(mode) < 0) {
      mode = 'ask';
    }
    adminSubmode = mode;
    try {
      sessionStorage.setItem('flowbie_chat_admin_submode', adminSubmode);
    } catch (_) {}
  }

  function getAdminSubmodeForApi() {
    return isBackendMode() ? adminSubmode : '';
  }

  function updateAdminSubmodeUi() {
    if (!adminSubmodeBtn) return;
    adminSubmodeBtn.hidden = !isBackendMode();
    ADMIN_SUBMODES.forEach(function (m) {
      adminSubmodeBtn.classList.toggle('fcw-admin-submode--' + m, adminSubmode === m);
    });
    var labelEl = adminSubmodeBtn.querySelector('.fcw-admin-submode__label');
    if (labelEl) {
      labelEl.textContent = ADMIN_SUBMODE_LABELS[adminSubmode] || 'Ask';
    }
    adminSubmodeBtn.setAttribute(
      'aria-label',
      'God Mode: ' + (ADMIN_SUBMODE_LABELS[adminSubmode] || 'Ask') + '. Shift+Tab to change.'
    );
    if (sendBtn) {
      sendBtn.classList.toggle('fcw-send--build', isBackendMode() && adminSubmode === 'build');
    }
  }

  function setAdminSubmode(mode) {
    saveAdminSubmode(mode);
    updateAdminSubmodeUi();
    refreshEmptyState();
  }

  function cycleAdminSubmode() {
    var idx = ADMIN_SUBMODES.indexOf(adminSubmode);
    var next = ADMIN_SUBMODES[(idx + 1) % ADMIN_SUBMODES.length];
    setAdminSubmode(next);
  }

  loadAdminMode();
  loadAdminSubmode();

  var GREETING_LINE = getGreetingLine();
  var GREETING_SUB = getGreetingSubline();
  var COMPOSER_PLACEHOLDER = cfg.composerPlaceholder || ('Ask about ' + (cfg.siteName || 'this site') + '\u2026');

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

  function historyStorageKey() {
    return 'flowbie_chat_history_' + getChatSessionId();
  }

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(historyStorageKey());
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          history = parsed;
        }
      }
    } catch (_) {}
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(historyStorageKey(), JSON.stringify(history.slice(-10)));
    } catch (_) {}
  }

  function pushHistoryTurn(role, content, card) {
    var turn = { role: role, content: content || '' };
    if (role === 'assistant' && card) {
      var summary = card.title || (card.body ? String(card.body).slice(0, 160) : '');
      turn.content = summary;
      turn.card = {
        title: card.title ? String(card.title).slice(0, 120) : '',
        body: card.body ? String(card.body).slice(0, 200) : '',
        cta: card.cta,
        links: Array.isArray(card.links) ? card.links.slice(0, 4) : undefined,
        relatedTopics: Array.isArray(card.relatedTopics) ? card.relatedTopics.slice(0, 5) : undefined
      };
    }
    history.push(turn);
    saveHistory();
  }

  function historyForApi() {
    if (window.FlowbieChatPrefetch && typeof window.FlowbieChatPrefetch.minifyHistoryForApi === 'function') {
      return FlowbieChatPrefetch.minifyHistoryForApi(history);
    }
    return history.slice(-6);
  }

  loadHistory();

  function buildContactHumanModule() {
    var ctaLabel = cfg.chekkitCtaLabel || 'Send Us A Text';
    var formTitle = ctaLabel;
    var expanded = false;
    var submitting = false;

    var toggleBtn = el('button', {
      type: 'button',
      className: 'fcw-contact-human__cta fcw-composer-human-cta',
      'aria-expanded': 'false',
      'aria-haspopup': 'dialog'
    });
    toggleBtn.textContent = 'Talk to a human';

    var overlay = el('div', {
      className: 'fcw-contact-human__overlay',
      hidden: ''
    });
    var card = el('div', {
      className: 'fcw-contact-human__card',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': formTitle
    });
    var closeBtn = el('button', {
      type: 'button',
      className: 'fcw-contact-human__close',
      'aria-label': 'Close'
    });
    closeBtn.innerHTML = '&times;';

    var formHeading = el('h3', { className: 'fcw-contact-human__form-heading' });
    formHeading.textContent = formTitle;

    var formIntro = el('p', { className: 'fcw-contact-human__form-intro' });
    formIntro.textContent = 'Submit your information and one of our specialists will get back to you as soon as possible.';

    var form = el('form', { className: 'fcw-contact-human__form' });
    var noticeSlot = el('div', { className: 'fcw-contact-human__notice-slot' });
    var statusEl = el('p', { className: 'fcw-contact-human__status', role: 'status', 'aria-live': 'polite' });

    function fieldWrap(name) {
      return el('div', { className: 'fcw-contact-human__field', 'data-field': name });
    }

    function addField(wrap, input, name, label, example) {
      input.setAttribute('placeholder', example);
      input.setAttribute('aria-label', label);
      wrap.appendChild(input);
      var labelEl = el('label', { className: 'fcw-contact-human__label', for: input.id });
      labelEl.textContent = label;
      wrap.appendChild(labelEl);
      wrap.appendChild(el('p', { className: 'fcw-contact-human__error', 'data-field': name, hidden: '' }));
    }

    function clearErrors() {
      form.querySelectorAll('.fcw-contact-human__error').forEach(function (node) {
        node.hidden = true;
        node.textContent = '';
      });
      statusEl.textContent = '';
      statusEl.classList.remove(
        'fcw-contact-human__status--error',
        'fcw-contact-human__status--success',
        'fcw-contact-human__status--visible'
      );
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }

    function fieldError(name) {
      return form.querySelector('.fcw-contact-human__error[data-field="' + name + '"]');
    }

    var nameWrap = fieldWrap('name');
    var nameInput = el('input', {
      type: 'text',
      className: 'fcw-contact-human__input',
      id: 'fcw-contact-name',
      name: 'name',
      required: true,
      autocomplete: 'name'
    });
    addField(nameWrap, nameInput, 'name', 'Name', 'Jane Smith');

    var phoneWrap = fieldWrap('phone');
    var phoneInput = el('input', {
      type: 'tel',
      className: 'fcw-contact-human__input',
      id: 'fcw-contact-phone',
      name: 'phone',
      required: true,
      autocomplete: 'tel'
    });
    addField(phoneWrap, phoneInput, 'phone', 'Phone', '555-123-4567');

    var emailWrap = fieldWrap('email');
    var emailInput = el('input', {
      type: 'email',
      className: 'fcw-contact-human__input',
      id: 'fcw-contact-email',
      name: 'email',
      autocomplete: 'email'
    });
    addField(emailWrap, emailInput, 'email', 'Email', 'jane@example.com');

    var messageWrap = fieldWrap('message');
    messageWrap.classList.add('fcw-contact-human__field--message');
    var messageInput = el('textarea', {
      className: 'fcw-contact-human__textarea',
      id: 'fcw-contact-message',
      name: 'message',
      rows: 3
    });
    addField(messageWrap, messageInput, 'message', 'Message', 'How can we help?');

    var honeypot = el('input', {
      type: 'text',
      className: 'fcw-contact-human__hp',
      name: 'flowbie_hp',
      tabindex: '-1',
      autocomplete: 'off',
      'aria-hidden': 'true'
    });

    var submitBtn = el('button', {
      type: 'submit',
      className: 'fcw-contact-human__submit'
    });
    submitBtn.textContent = 'Send Message';

    var siteLabel = (cfg.siteName && String(cfg.siteName).trim()) ? String(cfg.siteName).trim() : 'us';
    var termsUrl = ((window.location && window.location.origin) ? window.location.origin : '').replace(/\/$/, '') + '/terms';
    var disclaimer = el('p', { className: 'fcw-contact-human__disclaimer' });
    disclaimer.appendChild(document.createTextNode(
      'By submitting, you authorize ' + siteLabel + ' to text/call the number above with offers & other information. Msg/data rates apply, msg frequency varies. Consent is not a condition of purchase. See '
    ));
    var termsLink = el('a', { href: termsUrl });
    termsLink.textContent = 'terms';
    disclaimer.appendChild(termsLink);
    disclaimer.appendChild(document.createTextNode('. Text HELP for help and STOP to unsubscribe.'));

    form.appendChild(nameWrap);
    form.appendChild(phoneWrap);
    form.appendChild(emailWrap);
    form.appendChild(messageWrap);
    form.appendChild(honeypot);
    form.appendChild(disclaimer);
    form.appendChild(submitBtn);

    card.appendChild(closeBtn);
    card.appendChild(formHeading);
    card.appendChild(formIntro);
    card.appendChild(form);
    noticeSlot.appendChild(statusEl);
    card.appendChild(noticeSlot);
    overlay.appendChild(card);

    function setExpanded(next) {
      expanded = next;
      toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggleBtn.classList.toggle('fcw-contact-human__cta--open', expanded);
      overlay.hidden = !expanded;
      if (expanded) {
        nameInput.focus();
      } else {
        clearErrors();
        toggleBtn.focus();
      }
    }

    function closeModal() {
      if (expanded) setExpanded(false);
    }

    toggleBtn.addEventListener('click', function () {
      setExpanded(!expanded);
    });

    closeBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', function (evt) {
      if (!expanded) return;
      if (evt.key === 'Escape') {
        evt.preventDefault();
        closeModal();
      }
    });

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      if (submitting || !cfg.chekkitSubmitUrl) return;
      clearErrors();
      submitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      fetch(cfg.chekkitSubmitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': cfg.nonce
        },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          phone: phoneInput.value.trim(),
          email: emailInput.value.trim(),
          message: messageInput.value.trim(),
          flowbie_hp: honeypot.value,
          source_url: window.location.href || ''
        })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data || {} };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.success) {
            form.reset();
            statusEl.textContent = result.data.message || "Thanks! We'll be in touch soon.";
            statusEl.classList.add('fcw-contact-human__status--success', 'fcw-contact-human__status--visible');
            return;
          }
          if (result.data.errors && typeof result.data.errors === 'object') {
            Object.keys(result.data.errors).forEach(function (key) {
              var errNode = fieldError(key);
              if (errNode) {
                errNode.textContent = result.data.errors[key];
                errNode.hidden = false;
              }
            });
          }
          statusEl.textContent = result.data.message || 'Unable to send your request. Please try again.';
          statusEl.classList.add('fcw-contact-human__status--error', 'fcw-contact-human__status--visible');
        })
        .catch(function () {
          statusEl.textContent = 'Unable to send your request. Please try again.';
          statusEl.classList.add('fcw-contact-human__status--error', 'fcw-contact-human__status--visible');
        })
        .finally(function () {
          submitting = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Message';
        });
    });

    document.body.appendChild(overlay);

    return {
      toolbarBtn: toggleBtn,
      overlay: overlay,
      open: function () {
        setExpanded(true);
      }
    };
  }

  if (window.FlowbieChatDebugLog && CAN_COPY_LOG) {
    FlowbieChatDebugLog.createSession({
      sessionId: getChatSessionId(),
      source: 'frontend',
      pageUrl: window.location.href || '',
      siteName: cfg.siteName || ''
    });
  }

  function recordChatAccept(messageId, url, label, type) {
    if (!messageId || !cfg.acceptUrl) return;
    fetch(cfg.acceptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': cfg.nonce
      },
      body: JSON.stringify({
        messageId: messageId,
        url: url,
        label: label,
        type: type
      }),
      keepalive: true
    }).catch(function () {});
  }

  function bindAcceptClick(anchor, card, type, label) {
    if (!card || !card.message_uid) return;
    anchor.addEventListener('click', function () {
      recordChatAccept(
        card.message_uid,
        anchor.href || '',
        label || anchor.textContent || '',
        type
      );
    });
  }

  function appendCardCtas(cardEl, card) {
    if (!uiOn('cta_buttons') || !cardEl || !card) return;
    var hasPageCta = !!(card.cta && card.cta.url);
    var humanCta = card.contactHumanCta;
    var hasHumanCta = !!(humanCta && humanCta.action === 'contact_human' && contactHuman);
    if (!hasPageCta && !hasHumanCta) return;

    var ctaWrap = el('div', { className: 'fcw-card__cta-wrap' });
    if (hasHumanCta) {
      var humanLabel = (humanCta.label && String(humanCta.label).trim()) ? String(humanCta.label).trim() : 'Send Us A Text';
      var humanBtn = el('a', {
        className: 'fcw-cta-btn',
        href: '#',
        role: 'button'
      });
      humanBtn.textContent = humanLabel;
      humanBtn.addEventListener('click', function (evt) {
        evt.preventDefault();
        contactHuman.open();
      });
      bindAcceptClick(humanBtn, card, 'cta', humanLabel);
      ctaWrap.appendChild(humanBtn);
    } else if (hasPageCta) {
      var pageCta = el('a', {
        className: 'fcw-cta-btn',
        href: card.cta.url
      });
      pageCta.textContent = (card.cta.label && String(card.cta.label).trim()) ? String(card.cta.label).trim() : 'Learn more';
      pageCta.addEventListener('click', function () {
        if (sidebarShell && typeof sidebarShell.close === 'function') {
          sidebarShell.close();
        } else {
          closeStandalonePanel();
        }
      });
      bindAcceptClick(pageCta, card, 'cta', pageCta.textContent);
      ctaWrap.appendChild(pageCta);
    }
    cardEl.appendChild(ctaWrap);
  }

  // ── DOM scaffold ──────────────────────────────────────────────

  var savedLauncher = document.getElementById('flowbie-chat-mobile-launcher') || root.querySelector('.fcw-launcher');
  var child = root.firstChild;
  while (child) {
    var next = child.nextSibling;
    if (child !== savedLauncher) {
      root.removeChild(child);
    }
    child = next;
  }
  var hideMap = {
    header: 'fcw-hide-header',
    assistant_name: 'fcw-hide-assistant-name',
    close_button: 'fcw-hide-close-button',
    thinking_card: 'fcw-hide-thinking-card',
    source_pills: 'fcw-hide-source-pills',
    cta_buttons: 'fcw-hide-cta-buttons',
    suggestion_chips: 'fcw-hide-suggestion-chips',
    confidence: 'fcw-hide-confidence',
    type_badge: 'fcw-hide-type-badge',
    send_button: 'fcw-hide-send-button'
  };

  function syncRootShellState(panelOpen) {
    var hideClasses = '';
    Object.keys(hideMap).forEach(function (k) {
      if (!uiOn(k)) hideClasses += ' ' + hideMap[k];
    });
    if (isMobileViewport() && !panelOpen) {
      root.className = ('flowbie-chat-widget flowbie-chat--standalone-launcher' + hideClasses).trim();
      lockMobileRootClosed();
      return;
    }
    root.className = (
      'flowbie-chat-widget flowbie-chat--sidebar flowbie-chat--standalone-launcher fai-sidebar-root fai-sidebar-root--' +
      SIDEBAR_SIDE + ' fai-sidebar-root--transition-' + SIDEBAR_TRANSITION + hideClasses
    ).trim();
    if (cfg.cssVars) {
      root.setAttribute('style', cfg.cssVars);
    }
  }

  function mountShellNodes() {
    if (shellNodesMounted) return;
    shellNodesMounted = true;
    if (backdrop && !backdrop.parentNode) root.appendChild(backdrop);
    if (panel && !panel.parentNode) root.appendChild(panel);
  }

  function unmountShellNodes() {
    if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    shellNodesMounted = false;
  }

  function teardownShellIfMobile() {
    if (!isMobileViewport()) return;
    unmountShellNodes();
    syncRootShellState(false);
    lockMobileRootClosed();
  }

  syncRootShellState(false);

  var backdrop = el('div', { className: 'fai-sidebar-backdrop', 'aria-hidden': 'true', hidden: '' });

  var panel = el('div', {
    className: 'fai-sidebar-panel fcw-panel fcw-panel--sidebar'
  });

  var closeBtn = el('button', {
    type: 'button',
    className: 'fai-sidebar-close fai-sidebar-menu-trigger',
    'aria-label': 'Close chat',
    innerHTML: SIDEBAR_SIDE === 'left' ? SVG_DISMISS_LEFT : SVG_DISMISS_RIGHT
  });
  var clearBtn = el('button', {
    type: 'button',
    className: 'fai-sidebar-clear fcw-header__clear fcw-toolbar-hidden',
    'aria-label': 'Clear chat',
    innerHTML: SVG_TRASH
  });
  var copyLogBtn = null;
  if (CAN_COPY_LOG) {
    copyLogBtn = el('button', {
      type: 'button',
      className: 'fai-sidebar-clear fcw-header__clear fcw-toolbar-hidden',
      'aria-label': 'Copy log',
      innerHTML: SVG_CLIPBOARD
    });
  }
  var menuBtn = el('button', {
    type: 'button',
    className: 'fai-sidebar-menu-trigger',
    'aria-label': 'More actions',
    'aria-expanded': 'false',
    'aria-haspopup': 'true',
    innerHTML: SVG_MORE
  });
  var menuPanel = el('div', { className: 'fai-sidebar-menu-panel', hidden: '', role: 'menu' });
  var menuCopy = null;
  if (CAN_COPY_LOG) {
    menuCopy = el('button', { type: 'button', className: 'fai-sidebar-menu-item', role: 'menuitem' });
    menuCopy.textContent = 'Copy log';
  }
  var menuClear = el('button', { type: 'button', className: 'fai-sidebar-menu-item', role: 'menuitem' });
  menuClear.textContent = 'Clear chat';
  if (menuCopy) menuPanel.appendChild(menuCopy);
  menuPanel.appendChild(menuClear);
  var menuWrap = el('div', { className: 'fai-sidebar-toolbar-menu' });
  menuWrap.appendChild(menuBtn);
  menuWrap.appendChild(menuPanel);
  var toolbarActions = el('div', { className: 'fai-sidebar-toolbar-actions' });
  var modeToggleWrap = null;
  var startersWrapEl = null;
  var greetingEl = null;
  var greetingSubEl = null;

  function refreshEmptyState() {
    GREETING_LINE = getGreetingLine();
    GREETING_SUB = getGreetingSubline();
    if (greetingEl) greetingEl.textContent = GREETING_LINE;
    if (greetingSubEl) greetingSubEl.textContent = GREETING_SUB;
    if (root) {
      root.classList.toggle('fcw--super-admin-mode', isBackendMode());
    }
    if (!startersWrapEl || !uiOn('suggestion_chips')) return;
    while (startersWrapEl.firstChild) {
      startersWrapEl.removeChild(startersWrapEl.firstChild);
    }
    getActiveStarters().forEach(function (prompt) {
      var chip = el('button', {
        type: 'button',
        className: 'fcw-starter',
        'data-prompt': prompt
      });
      chip.textContent = prompt;
      chip.addEventListener('click', function () {
        var text = chip.getAttribute('data-prompt') || chip.textContent || '';
        if (text.trim()) deliverMessage(text.trim(), 'starter');
      });
      startersWrapEl.appendChild(chip);
    });
    if (window.FlowbieChatPrefetch && !isBackendMode()) {
      FlowbieChatPrefetch.prefetchSuggestions(getActiveStarters(), prefetchOptions());
    }
  }

  function setAdminMode(mode) {
    saveAdminMode(mode);
    refreshEmptyState();
    updateAdminSubmodeUi();
    if (modeToggleWrap) {
      var btns = modeToggleWrap.querySelectorAll('.fcw-mode-btn');
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute('data-mode') === adminMode;
        btns[i].classList.toggle('fcw-mode-btn--active', on);
        btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
  }

  if (CAN_BACKEND_MODE) {
    modeToggleWrap = el('div', {
      className: 'fcw-mode-toggle',
      role: 'group',
      'aria-label': 'God Mode'
    });
    var visitorModeBtn = el('button', {
      type: 'button',
      className: 'fcw-mode-btn fcw-mode-btn--active',
      'data-mode': 'visitor',
      'aria-pressed': 'true'
    });
    visitorModeBtn.textContent = 'Visitor';
    var backendModeBtn = el('button', {
      type: 'button',
      className: 'fcw-mode-btn',
      'data-mode': 'backend',
      'aria-pressed': 'false'
    });
    backendModeBtn.textContent = 'God Mode';
    modeToggleWrap.appendChild(visitorModeBtn);
    modeToggleWrap.appendChild(backendModeBtn);
    visitorModeBtn.addEventListener('click', function () { setAdminMode('visitor'); });
    backendModeBtn.addEventListener('click', function () { setAdminMode('backend'); });
  }

  toolbarActions.appendChild(closeBtn);
  toolbarActions.appendChild(menuWrap);
  var contactHuman = SHOW_CONTACT_HUMAN ? buildContactHumanModule() : null;
  var toolbar = el('div', { className: 'fai-sidebar-panel__toolbar' });
  toolbar.appendChild(toolbarActions);

  var emptyEl = null;
  var messages = el('div', { className: 'fcw-messages' });
  messages.addEventListener('click', function (evt) {
    var anchor = evt.target && evt.target.closest ? evt.target.closest('a') : null;
    if (!anchor || !anchor.href) return;
    var href = anchor.getAttribute('href') || '';
    if (href === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
    if (sidebarShell && typeof sidebarShell.close === 'function') {
      sidebarShell.close();
    } else {
      closeStandalonePanel();
    }
  });
  if (uiOn('welcome_message')) {
    emptyEl = el('div', { className: 'fcw-empty' });
    var greetingBlock = el('div');
    var greeting = el('p', { className: 'fcw-greeting' });
    greeting.textContent = GREETING_LINE;
    greetingEl = greeting;
    var sub = el('p', { className: 'fcw-sub' });
    sub.textContent = GREETING_SUB;
    greetingSubEl = sub;
    greetingBlock.appendChild(greeting);
    greetingBlock.appendChild(sub);
    emptyEl.appendChild(greetingBlock);
    if (uiOn('suggestion_chips')) {
      var startersWrap = el('div', { className: 'fcw-starters' });
      startersWrapEl = startersWrap;
      getActiveStarters().forEach(function (prompt) {
        var chip = el('button', {
          type: 'button',
          className: 'fcw-starter',
          'data-prompt': prompt
        });
        chip.textContent = prompt;
        chip.addEventListener('click', function () {
          var text = chip.getAttribute('data-prompt') || chip.textContent || '';
          if (text.trim()) deliverMessage(text.trim(), 'starter');
        });
        startersWrap.appendChild(chip);
      });
      emptyEl.appendChild(startersWrap);
    }
    messages.setAttribute('hidden', '');
  }

  var inputRow = el('form', { className: 'fcw-input-row fcw-composer' });
  var composerShell = el('div', { className: 'fcw-composer-shell' });
  var composerActions = el('div', { className: 'fcw-composer-actions' });
  var composerPlaceholder = COMPOSER_PLACEHOLDER;
  if (SHOW_CONTACT_HUMAN) {
    composerPlaceholder = COMPOSER_PLACEHOLDER.replace(/\u2026$/, ', or send us a text to reach a person.');
    if (composerPlaceholder === COMPOSER_PLACEHOLDER) {
      composerPlaceholder = 'Ask anything, or send us a text to reach a person.';
    }
  }
  var textarea = el('textarea', {
    className: 'fcw-textarea',
    placeholder: composerPlaceholder,
    rows: 1
  });
  var sendBtn = el('button', {
    className: 'fcw-send',
    type: 'button',
    'aria-label': 'Send message',
    innerHTML: '<span class="fcw-send__icon fcw-send__icon--send" aria-hidden="true">' + SVG_SEND + '</span>'
  });

  composerShell.appendChild(textarea);
  if (CAN_BACKEND_MODE) {
    adminSubmodeBtn = el('button', {
      type: 'button',
      className: 'fcw-admin-submode fcw-admin-submode--ask',
      hidden: ''
    });
    adminSubmodeBtn.appendChild(el('span', { className: 'fcw-admin-submode__dot', 'aria-hidden': 'true' }));
    var submodeLabelEl = el('span', { className: 'fcw-admin-submode__label' });
    submodeLabelEl.textContent = 'Ask';
    adminSubmodeBtn.appendChild(submodeLabelEl);
    adminSubmodeBtn.addEventListener('click', function () {
      cycleAdminSubmode();
    });
  }
  if (contactHuman) {
    composerActions.classList.add('fcw-composer-actions--with-human');
    composerActions.appendChild(contactHuman.toolbarBtn);
  }
  if (adminSubmodeBtn) {
    composerActions.appendChild(adminSubmodeBtn);
  }
  composerActions.appendChild(sendBtn);
  composerShell.appendChild(composerActions);
  inputRow.appendChild(composerShell);

  var panelBody = el('div', { className: 'fai-sidebar-panel__body' });
  if (modeToggleWrap) {
    var adminModeBar = el('div', { className: 'fcw-admin-mode-bar' });
    adminModeBar.appendChild(modeToggleWrap);
    panelBody.appendChild(adminModeBar);
  }
  if (SHOW_SIDEBAR_HEADING) {
    var headingEl = el('h2', { className: 'fai-sidebar-heading fcw-sidebar-heading' });
    headingEl.textContent = cfg.sidebarHeading;
    panelBody.appendChild(headingEl);
  }

  var chatMain = el('div', { className: 'fcw-sidebar-main' });
  if (SHOW_CHAT_BODY) {
    if (emptyEl) chatMain.appendChild(emptyEl);
    chatMain.appendChild(messages);
    chatMain.appendChild(inputRow);
  }
  panelBody.appendChild(chatMain);
  panel.appendChild(toolbar);
  panel.appendChild(panelBody);
  var toolbarHidden = el('div', { className: 'fcw-toolbar-hidden' });
  if (copyLogBtn) toolbarHidden.appendChild(copyLogBtn);
  toolbarHidden.appendChild(clearBtn);
  panel.appendChild(toolbarHidden);
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', ASSISTANT);
  panel.setAttribute('hidden', '');
  if (CAN_BACKEND_MODE) {
    setAdminMode(adminMode);
    updateAdminSubmodeUi();
  }
  if (savedLauncher) {
    if (!savedLauncher.innerHTML || !savedLauncher.innerHTML.trim()) {
      savedLauncher.innerHTML = SVG_CHAT_LAUNCHER;
    }
    if (!isMobileViewport() && savedLauncher.parentNode !== root) {
      root.appendChild(savedLauncher);
    }
  }
  bindStandaloneLauncher();

  function hideEmpty() {
    if (emptyEl) emptyEl.hidden = true;
    messages.hidden = false;
  }

  function clearChat() {
    if (isLoading) return;
    history = [];
    saveHistory();
    messages.innerHTML = '';
    if (emptyEl) {
      emptyEl.hidden = false;
      messages.hidden = true;
    }
    textarea.value = '';
    autoResize(textarea);
    if (window.FlowbieChatPrefetch) {
      FlowbieChatPrefetch.clearCache();
    }
    if (window.FlowbieChatDebugLog) {
      FlowbieChatDebugLog.clear();
    }
    if (window.FlowbieVoice && typeof window.FlowbieVoice.updateSendMicVisibility === 'function') {
      FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
    }
  }

  clearBtn.addEventListener('click', clearChat);
  if (copyLogBtn) {
    copyLogBtn.addEventListener('click', function () {
      if (window.FlowbieChatDebugLog) {
        FlowbieChatDebugLog.copyToClipboard(copyLogBtn);
      }
    });
  }

  function closeToolbarMenu() {
    menuPanel.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleToolbarMenu() {
    var open = menuPanel.hidden;
    menuPanel.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  menuBtn.addEventListener('click', function (evt) {
    evt.stopPropagation();
    toggleToolbarMenu();
  });

  if (menuCopy) {
    menuCopy.addEventListener('click', function () {
      if (copyLogBtn) copyLogBtn.click();
      closeToolbarMenu();
    });
  }

  menuClear.addEventListener('click', function () {
    clearChat();
    closeToolbarMenu();
  });

  document.addEventListener('click', function (evt) {
    if (!menuWrap.contains(evt.target)) {
      closeToolbarMenu();
    }
  });

  // ── Events ────────────────────────────────────────────────────

  inputRow.addEventListener('submit', onSubmit);

  function fcwBuildStepsList(steps) {
    var ul = el('ul', { className: 'fcw-thinking-steps' });
    (steps || []).forEach(function (step, idx) {
      var st = step.status || 'pending';
      var li = el('li', { className: 'fcw-thinking-step fcw-thinking-step--' + st });
      li.setAttribute('data-step-index', String(idx));
      var lbl = el('span', { className: 'fcw-thinking-step-label' });
      lbl.textContent = step.label || 'Step ' + (idx + 1);
      li.appendChild(lbl);
      ul.appendChild(li);
    });
    return ul;
  }

  function fcwAppendWorkflowCard(card) {
    var row = el('div', { className: 'fcw-msg fcw-msg--assistant' });
    var cardEl = el('div', { className: 'fcw-card fcw-card--thinking-active' });
    var titleRow = el('div', { className: 'fcw-card__title-row' });
    var badge = null;
    if (uiOn('type_badge')) {
      badge = el('span', { className: 'fcw-card__type-badge' });
      badge.textContent = 'working';
      titleRow.appendChild(badge);
    }
    var title = el('span', { className: 'fcw-card__title' });
    title.innerHTML = renderMarkdown(card.title || 'Working on it\u2026');
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
    scrollDown(row);
    return { root: row, cardEl: cardEl, badgeEl: badge, titleEl: title, bodyEl: bodyEl, stepsList: stepsList };
  }

  function fcwSetWorkflowStepStatus(shell, idx, status) {
    if (!shell || !shell.stepsList) return;
    var li = shell.stepsList.querySelector('[data-step-index="' + idx + '"]');
    if (!li) return;
    li.className = 'fcw-thinking-step fcw-thinking-step--' + status;
  }

  function fcwSetWorkflowCardActive(shell, active) {
    if (shell && shell.cardEl) {
      shell.cardEl.classList.toggle('fcw-card--thinking-active', !!active);
    }
  }

  function fcwTypeBadgeLabel(type) {
    if (type === 'lead') return 'Lead';
    if (type === 'plan') return 'plan';
    return type || 'answer';
  }

  function appendPlanCard(card) {
    var shell = fcwAppendWorkflowCard(card);
    fcwSetWorkflowCardActive(shell, false);
    if (shell.badgeEl && typeof fcwApplyCardBadge === 'function') {
      fcwApplyCardBadge(shell.badgeEl, 'plan');
    }
    fcwPopulateCardExtras(shell, card);
    return shell;
  }

  function fcwParseLegacyFlatContact(contact) {
    var normalized = { email: contact.email ? String(contact.email) : '', phones: [], locations: [] };

    if (contact.phone) {
      String(contact.phone).split(',').forEach(function (part) {
        var number = part.trim();
        if (number) normalized.phones.push({ label: '', number: number });
      });
    }

    var address = contact.address ? String(contact.address).trim() : '';
    var hours = [];
    if (contact.hours) {
      String(contact.hours).split(';').forEach(function (line) {
        line = line.trim();
        if (line) hours.push(line);
      });
    }
    if (address || hours.length) {
      normalized.locations.push({ name: '', address: address, hours: hours });
    }

    return normalized;
  }

  function fcwNormalizeConversionContact(contact) {
    contact = contact || {};
    if (Array.isArray(contact.phones) || Array.isArray(contact.locations)) {
      return {
        email: contact.email ? String(contact.email) : '',
        phones: Array.isArray(contact.phones) ? contact.phones : [],
        locations: Array.isArray(contact.locations) ? contact.locations : []
      };
    }
    if (contact.phone || contact.address || contact.hours) {
      return fcwParseLegacyFlatContact(contact);
    }
    return { email: contact.email ? String(contact.email) : '', phones: [], locations: [] };
  }

  function fcwAppendConversionContact(contactWrap, contact) {
    var data = fcwNormalizeConversionContact(contact);
    if (data.email) {
      var email = el('a', {
        className: 'fcw-card__conversion-item fcw-card__conversion-email',
        href: 'mailto:' + data.email
      });
      email.textContent = data.email;
      contactWrap.appendChild(email);
    }
    if (data.phones.length) {
      var phoneList = el('ul', { className: 'fcw-card__conversion-list fcw-card__conversion-phones' });
      data.phones.forEach(function (entry) {
        var number = entry && entry.number ? String(entry.number).trim() : '';
        if (!number) return;
        var li = el('li', { className: 'fcw-card__conversion-phone-row' });
        if (entry.label && String(entry.label).trim()) {
          var label = el('span', { className: 'fcw-card__conversion-phone-label' });
          label.textContent = String(entry.label).trim() + ': ';
          li.appendChild(label);
        }
        var phone = el('a', {
          className: 'fcw-card__conversion-item fcw-card__conversion-phone',
          href: 'tel:' + number.replace(/[^\d+]/g, '')
        });
        phone.textContent = number;
        li.appendChild(phone);
        phoneList.appendChild(li);
      });
      contactWrap.appendChild(phoneList);
    }
    data.locations.forEach(function (location) {
      if (!location) return;
      var name = location.name ? String(location.name).trim() : '';
      var address = location.address ? String(location.address).trim() : '';
      var hours = Array.isArray(location.hours) ? location.hours : [];
      if (!name && !address && !hours.length) return;
      var locBlock = el('div', { className: 'fcw-card__conversion-location' });
      if (name) {
        var nameEl = el('div', { className: 'fcw-card__conversion-location-name' });
        nameEl.textContent = name;
        locBlock.appendChild(nameEl);
      }
      if (address) {
        var addressEl = el('div', { className: 'fcw-card__conversion-item fcw-card__conversion-address' });
        addressEl.textContent = address;
        locBlock.appendChild(addressEl);
      }
      if (hours.length) {
        var hoursList = el('ul', { className: 'fcw-card__conversion-hours-list' });
        hours.forEach(function (line) {
          line = line ? String(line).trim() : '';
          if (!line) return;
          var hoursItem = el('li');
          hoursItem.textContent = line;
          hoursList.appendChild(hoursItem);
        });
        locBlock.appendChild(hoursList);
      }
      contactWrap.appendChild(locBlock);
    });
  }

  function fcwAppendConversionBlock(cardEl, card) {
    if (!cardEl || !card || !card.conversion) return;
    var conv = card.conversion;
    var block = el('div', { className: 'fcw-card__conversion' });
    if (conv.headline) {
      var headline = el('div', { className: 'fcw-card__conversion-headline' });
      headline.textContent = conv.headline;
      block.appendChild(headline);
    }
    var contact = conv.contact || {};
    var hasContact = contact.email || contact.phone || contact.address || contact.hours
      || (Array.isArray(contact.phones) && contact.phones.length)
      || (Array.isArray(contact.locations) && contact.locations.length);
    if (hasContact) {
      var contactWrap = el('div', { className: 'fcw-card__conversion-contact' });
      fcwAppendConversionContact(contactWrap, contact);
      block.appendChild(contactWrap);
    }
    if (conv.formHtml) {
      var formWrap = el('div', { className: 'fcw-card__conversion-form' });
      formWrap.innerHTML = conv.formHtml;
      block.appendChild(formWrap);
      var formEl = formWrap.querySelector('.flowbie-form');
      if (formEl && window.FlowbieForms && typeof window.FlowbieForms.mount === 'function') {
        window.FlowbieForms.mount(formEl, conv.formConfig || null);
      }
    }
    cardEl.appendChild(block);
  }

  function fcwApplyCardBadge(badgeEl, t) {
    badgeEl.textContent = fcwTypeBadgeLabel(t);
  }

  function appendTopicChips(cardEl, topics) {
    if (!uiOn('suggestion_chips') || !cardEl || !topics || !topics.length) return;
    if (cardEl.querySelector('.fcw-card__topics')) return;
    var topicsWrap = el('div', { className: 'fcw-card__topics' });
    topics.forEach(function (topic) {
      var chip = el('button', { className: 'fcw-topic-chip', type: 'button' });
      chip.textContent = topic;
      chip.addEventListener('click', function () {
        deliverMessage(topic, 'topic_chip');
      });
      topicsWrap.appendChild(chip);
    });
    cardEl.appendChild(topicsWrap);
  }

  function appendFollowUpChips(evt) {
    var topics = evt && evt.relatedTopics ? evt.relatedTopics : [];
    if (!topics.length) return;
    var cards = messages.querySelectorAll('.fcw-card');
    if (!cards.length) return;
    var cardEl = cards[cards.length - 1];
    appendTopicChips(cardEl, topics);
    if (history.length && history[history.length - 1].role === 'assistant') {
      var last = history[history.length - 1];
      if (!last.card) last.card = {};
      last.card.relatedTopics = topics.slice();
    }
    prefetchFollowUpChips({ relatedTopics: topics });
    var msgRow = cardEl.closest('.fcw-msg');
    scrollDown(msgRow || null);
  }

  function fcwPopulateCardExtras(shell, card) {
    if (!shell || !shell.cardEl) return;
    var cardEl = shell.cardEl;
    var old = cardEl.querySelectorAll('.fcw-card__conversion, .fcw-card__confidence, .fcw-card__links, .fcw-card__cta-wrap, .fcw-card__topics');
    old.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    fcwAppendConversionBlock(cardEl, card);
    if (uiOn('confidence')) {
      var confMap = { high: 'High confidence', medium: 'Based on site content', low: 'Limited information' };
      var conf = el('div', { className: 'fcw-card__confidence' });
      conf.textContent = confMap[card.confidence] || confMap.medium;
      cardEl.appendChild(conf);
    }
    if (uiOn('source_pills') && card.links && card.links.length) {
      var linksWrap = el('div', { className: 'fcw-card__links' });
      card.links.forEach(function (link) {
        var a = el('a', { className: 'fcw-link-pill', href: link.url });
        a.textContent = link.label;
        bindAcceptClick(a, card, 'source', link.label);
        linksWrap.appendChild(a);
      });
      cardEl.appendChild(linksWrap);
    }
    appendCardCtas(cardEl, card);
    if (uiOn('suggestion_chips') && card.relatedTopics && card.relatedTopics.length) {
      appendTopicChips(cardEl, card.relatedTopics);
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

  function prefetchFollowUpChips(card) {
    if (!window.FlowbieChatPrefetch || !uiOn('suggestion_chips')) return;
    if (!card || !card.relatedTopics || !card.relatedTopics.length) return;
    FlowbieChatPrefetch.prefetchSuggestions(card.relatedTopics, prefetchOptions());
  }

  function presentCard(card, opts) {
    opts = opts || {};
    if (window.FlowbieDisplayText && typeof window.FlowbieDisplayText.decodeCard === 'function') {
      card = window.FlowbieDisplayText.decodeCard(card || {});
    }
    var shell = opts.shell;
    var host = fcwThinkingHost();
    var done = function () {
      pushHistoryTurn('assistant', card.title || (card.body ? String(card.body).slice(0, 160) : ''), card);
      if (typeof opts.onDone === 'function') {
        opts.onDone();
      }
    };
    if (card.type === 'plan' && card.steps && card.steps.length) {
      if (shell && shell.stepsList) {
        fcwSetWorkflowCardActive(shell, false);
        if (shell.badgeEl) {
          fcwApplyCardBadge(shell.badgeEl, 'plan');
        }
        if (shell.titleEl) {
          shell.titleEl.innerHTML = renderMarkdown(card.title || '');
        }
        if (shell.bodyEl) {
          if (card.body) {
            shell.bodyEl.innerHTML = renderMarkdown(card.body);
            shell.bodyEl.style.display = '';
          } else {
            shell.bodyEl.style.display = 'none';
          }
        }
        fcwPopulateCardExtras(shell, card);
      } else {
        appendPlanCard(card);
      }
      done();
      prefetchFollowUpChips(card);
      return Promise.resolve();
    }
    if (shell && window.FlowbieThinkingCard) {
      FlowbieThinkingCard.finalizeToCard(shell, card, host);
    } else {
      appendCard(card);
    }
    done();
    prefetchFollowUpChips(card);
    return Promise.resolve();
  }

  sendBtn.addEventListener('mousedown', function () {
    if (window.FlowbieChatPrefetch && textarea.value.trim()) {
      FlowbieChatPrefetch.prefetchOnSendIntent(textarea);
    }
  });
  sendBtn.addEventListener('click', function () {
    if (textarea.value.trim()) {
      inputRow.dispatchEvent(new Event('submit'));
    }
  });
  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' && e.shiftKey && isBackendMode()) {
      e.preventDefault();
      cycleAdminSubmode();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      inputRow.dispatchEvent(new Event('submit'));
    }
  });

  function getUnifiedShell() {
    if (window.FlowbieAiSidebarUnify && window.FlowbieAiSidebarUnify.isMerged()) {
      return window.FlowbieAiSidebarUnify.getShell();
    }
    return null;
  }

  function setLauncherVisible(visible) {
    var launcher = getStandaloneLauncher();
    if (!launcher) return;
    if (visible) {
      launcher.removeAttribute('hidden');
      launcher.style.display = '';
      launcher.style.visibility = '';
      launcher.style.pointerEvents = '';
      launcher.setAttribute('aria-expanded', 'false');
    } else {
      launcher.setAttribute('hidden', '');
      launcher.style.display = 'none';
      launcher.style.visibility = 'hidden';
      launcher.style.pointerEvents = 'none';
      launcher.setAttribute('aria-expanded', 'true');
    }
  }

  var chekkitTeaser = null;

  function onSidebarOpen() {
    isOpen = true;
    setLauncherVisible(false);
    if (chekkitTeaser) chekkitTeaser.onChatOpen();
    textarea.focus();
  }

  function onSidebarClose() {
    isOpen = false;
    setLauncherVisible(true);
    if (chekkitTeaser) chekkitTeaser.onChatClose();
  }

  function removeStandaloneLauncher() {
    var launcher = root.querySelector('.fcw-launcher');
    if (launcher && launcher.parentNode) {
      launcher.parentNode.removeChild(launcher);
    }
    root.classList.remove('flowbie-chat--standalone-launcher');
  }

  function getStandaloneLauncher() {
    var mobileBtn = document.getElementById('flowbie-chat-mobile-launcher');
    if (mobileBtn) return mobileBtn;
    return ensureStandaloneLauncher();
  }

  function ensureStandaloneLauncher() {
    var existing = root.querySelector('.fai-sidebar-launcher, .fbs__icon-launcher');
    if (existing) {
      return existing;
    }
    root.classList.add('flowbie-chat--standalone-launcher');
    var launcher = el('button', {
      type: 'button',
      className: 'fai-sidebar-launcher fcw-launcher',
      'aria-label': cfg.launcherLabel || ('Open ' + ASSISTANT),
      'aria-expanded': 'false',
      innerHTML: SVG_CHAT_LAUNCHER
    });
    root.appendChild(launcher);
    return launcher;
  }

  function bindShellCallbacks(shell) {
    if (!shell || shell._fcwBound) {
      return;
    }
    shell._fcwBound = true;
    var prevOnOpen = shell.opts.onOpen;
    var prevOnClose = shell.opts.onClose;
    shell.opts.onOpen = function () {
      if (typeof prevOnOpen === 'function') prevOnOpen();
      onSidebarOpen();
    };
    shell.opts.onClose = function () {
      if (typeof prevOnClose === 'function') prevOnClose();
      onSidebarClose();
      teardownShellIfMobile();
    };
  }

  function openStandalonePanel() {
    showMobileRootForPanel();
    mountShellNodes();
    syncRootShellState(true);
    root.classList.add('fai-sidebar-root--open');
    if (backdrop) backdrop.removeAttribute('hidden');
    if (panel) panel.removeAttribute('hidden');
    var launcher = getStandaloneLauncher();
    if (launcher) launcher.setAttribute('aria-expanded', 'true');
    onSidebarOpen();
  }

  function closeStandalonePanel() {
    root.classList.remove('fai-sidebar-root--open');
    if (backdrop) backdrop.setAttribute('hidden', '');
    if (panel) panel.setAttribute('hidden', '');
    onSidebarClose();
    teardownShellIfMobile();
  }

  function openChatFromLauncher() {
    showMobileRootForPanel();
    mountShellNodes();
    syncRootShellState(true);
    if (sidebarShell && typeof sidebarShell.toggle === 'function') {
      sidebarShell.toggle(true);
      return;
    }
    var shell = ensureStandaloneShell();
    if (shell && typeof shell.toggle === 'function') {
      shell.toggle(true);
      return;
    }
    openStandalonePanel();
  }

  function bindStandaloneLauncher() {
    var launcher = getStandaloneLauncher();
    if (!launcher || launcher._fcwBound) return;
    launcher._fcwBound = true;
    launcher.addEventListener('click', openChatFromLauncher);
    if (backdrop && !backdrop._fcwBound) {
      backdrop._fcwBound = true;
      backdrop.addEventListener('click', function () {
        if (sidebarShell && typeof sidebarShell.close === 'function') {
          sidebarShell.close();
          return;
        }
        closeStandalonePanel();
      });
    }
    if (closeBtn && !closeBtn._fcwStandaloneBound) {
      closeBtn._fcwStandaloneBound = true;
      closeBtn.addEventListener('click', function () {
        if (sidebarShell && typeof sidebarShell.toggle === 'function') {
          sidebarShell.toggle(false);
          return;
        }
        closeStandalonePanel();
      });
    }
  }

  function ensureStandaloneShell() {
    if (sidebarShell) {
      return sidebarShell;
    }
    if (getUnifiedShell()) {
      return null;
    }
    if (!window.FlowbieAiSidebarShell) {
      return null;
    }
    mountShellNodes();
    syncRootShellState(true);
    sidebarShell = window.FlowbieAiSidebarShell.init(root, {
      backdrop: backdrop,
      panel: panel,
      launcher: getStandaloneLauncher(),
      onOpen: onSidebarOpen,
      onClose: function () {
        onSidebarClose();
        teardownShellIfMobile();
      }
    });
    sidebarShell._fcwBound = true;
    return sidebarShell;
  }

  function initStandaloneShell() {
    if (sidebarShell || getUnifiedShell()) {
      return;
    }
    bindStandaloneLauncher();
    if (!window.FlowbieAiSidebarShell) {
      return;
    }
    if (isMobileViewport()) {
      return;
    }
    ensureStandaloneShell();
  }

  function bindUnifiedShell() {
    if (window.FlowbieAiSidebarUnify) {
      window.FlowbieAiSidebarUnify.tryMerge();
    }
    var shell = getUnifiedShell();
    if (shell) {
      removeStandaloneLauncher();
      bindShellCallbacks(shell);
      sidebarShell = shell;
      return;
    }
    bindStandaloneLauncher();
    if (document.readyState === 'loading') {
      return;
    }
    initStandaloneShell();
  }

  function applyChekkitLauncherChrome() {
    if (!SHOW_CONTACT_HUMAN || cfg.chekkitTeaserEnabled === false) return;
    var launcher = getStandaloneLauncher();
    if (!launcher) return;
    launcher.classList.add('fcw-launcher--chekkit');
    launcher.innerHTML = SVG_PHONE_LAUNCHER;
    launcher.style.setProperty('background', '#d8005f', 'important');
    launcher.style.setProperty('color', '#ffffff', 'important');
    launcher.style.setProperty('border', 'none', 'important');
  }

  function initChekkitTeaser() {
    if (!SHOW_CONTACT_HUMAN || cfg.chekkitTeaserEnabled === false) return null;
    if (typeof Element === 'undefined' || !Element.prototype.attachShadow) return null;

    var SESSION_KEY = 'flowbie_chekkit_teaser_dismissed';
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return null;
    } catch (_) {
      return null;
    }

    var launcher = getStandaloneLauncher();
    if (!launcher || isOpen) return null;

    var dismissed = false;
    var visible = false;
    var hiddenByChat = false;
    var delayTimer = null;

    var host = document.createElement('div');
    host.id = 'flowbie-chekkit-teaser-host';
    host.hidden = true;
    if (SIDEBAR_SIDE === 'left') {
      host.classList.add('left');
    }

    var shadow = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent =
      ':host{position:fixed;z-index:999899;display:block;opacity:0;transform:translateY(8px);transition:opacity .2s ease,transform .2s ease;pointer-events:none;font-family:Lato,ui-sans-serif,system-ui,sans-serif}'
      + ':host(.visible){opacity:1;transform:translateY(0);pointer-events:auto}'
      + '.card{position:relative;display:flex;align-items:center;gap:12px;box-sizing:border-box;margin:0;padding:12px 32px 12px 12px;border:none;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.14);color:#111;cursor:pointer;width:max-content;min-width:268px;max-width:320px}'
      + '.card:hover{box-shadow:0 6px 28px rgba(0,0,0,.16)}'
      + '.avatar{width:48px;height:48px;min-width:48px;border-radius:50%;flex-shrink:0;overflow:hidden;background:#f5f5f5;display:block}'
      + '.avatar img{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%}'
      + '.copy{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}'
      + '.line{display:block;font-size:1rem;line-height:1.35;color:#111;white-space:normal}'
      + '.dismiss{position:absolute;top:6px;right:6px;width:22px;height:22px;margin:0;padding:0;border:none;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15);color:#666;font-size:1rem;line-height:1;cursor:pointer}'
      + '.dismiss:hover{background:#f3f4f6;color:#374151}'
      + '.card::after{content:"";position:absolute;bottom:-8px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #fff;filter:drop-shadow(0 2px 2px rgba(0,0,0,.06))}'
      + ':host(.left) .card::after{left:20px;right:auto}'
      + ':host(:not(.left)) .card::after{right:20px;left:auto}';

    var card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('aria-label', 'Questions? Send us a text message!');

    var avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    var avatarImg = document.createElement('img');
    avatarImg.src = cfg.chekkitTeaserAvatarUrl || '';
    avatarImg.alt = '';
    avatarImg.width = 48;
    avatarImg.height = 48;
    avatarImg.loading = 'lazy';
    avatarImg.decoding = 'async';
    avatar.appendChild(avatarImg);

    var copy = document.createElement('div');
    copy.className = 'copy';
    var line1 = document.createElement('span');
    line1.className = 'line';
    line1.textContent = 'Questions?';
    var line2 = document.createElement('span');
    line2.className = 'line';
    line2.textContent = 'Send us a text message!';
    copy.appendChild(line1);
    copy.appendChild(line2);

    var dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.textContent = '\u00d7';

    card.appendChild(avatar);
    card.appendChild(copy);
    card.appendChild(dismissBtn);
    shadow.appendChild(style);
    shadow.appendChild(card);
    document.body.appendChild(host);

    function positionTeaser() {
      if (dismissed || !launcher) return;
      var rect = launcher.getBoundingClientRect();
      var gap = 14;
      host.style.bottom = (window.innerHeight - rect.top + gap) + 'px';
      if (SIDEBAR_SIDE === 'left') {
        host.style.left = Math.max(16, rect.left) + 'px';
        host.style.right = 'auto';
      } else {
        var rightOffset = Math.max(16, window.innerWidth - rect.right);
        host.style.right = rightOffset + 'px';
        host.style.left = 'auto';
      }
    }

    function setVisible(next) {
      visible = next;
      if (next) {
        positionTeaser();
        host.hidden = false;
        requestAnimationFrame(function () {
          host.classList.add('visible');
        });
        return;
      }
      host.classList.remove('visible');
      host.hidden = true;
    }

    function clearTriggers() {
      if (delayTimer) {
        clearTimeout(delayTimer);
        delayTimer = null;
      }
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', positionTeaser);
    }

    function dismissTeaser(persist) {
      if (dismissed) return;
      dismissed = true;
      clearTriggers();
      setVisible(false);
      if (persist) {
        try {
          sessionStorage.setItem(SESSION_KEY, '1');
        } catch (_) {}
      }
    }

    function showTeaser() {
      if (dismissed || visible || isOpen || hiddenByChat) return;
      clearTriggers();
      setVisible(true);
    }

    function onScroll() {
      var y = window.scrollY || window.pageYOffset || 0;
      if (y > 50) showTeaser();
    }

    function openFromTeaser() {
      setVisible(false);
      openChatFromLauncher();
    }

    dismissBtn.addEventListener('click', function (evt) {
      evt.stopPropagation();
      dismissTeaser(true);
    });

    card.addEventListener('click', openFromTeaser);

    delayTimer = setTimeout(showTeaser, 2000);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', positionTeaser);

    return {
      onChatOpen: function () {
        if (!visible || dismissed) return;
        hiddenByChat = true;
        setVisible(false);
      },
      onChatClose: function () {
        if (dismissed || !hiddenByChat) return;
        hiddenByChat = false;
        if (!isOpen) setVisible(true);
      }
    };
  }

  bindUnifiedShell();
  if (!isMobileViewport()) {
    root.hidden = false;
    root.removeAttribute('aria-hidden');
    root.classList.remove('fcw-mobile-root-closed');
    if (cfg.cssVars) {
      root.setAttribute('style', cfg.cssVars);
    }
  } else {
    lockMobileRootClosed();
  }
  applyLauncherChrome();
  chekkitTeaser = initChekkitTeaser();
  if (window.matchMedia) {
    window.matchMedia('(max-width:767px)').addEventListener('change', function () {
      applyLauncherChrome();
      if (isMobileViewport()) {
        if (!isOpen) lockMobileRootClosed();
      } else {
        root.hidden = false;
        root.removeAttribute('aria-hidden');
        root.classList.remove('fcw-mobile-root-closed');
        if (cfg.cssVars) root.setAttribute('style', cfg.cssVars);
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUnifiedShell);
  }
  window.addEventListener('load', bindUnifiedShell);
  document.addEventListener('flowbie-ai-sidebar-merged', bindUnifiedShell);

  function onSubmit(e) {
    e.preventDefault();
    var text = textarea.value.trim();
    if (!text || isLoading) return;
    deliverMessage(text, 'typed');
  }

  function deliverMessage(text, origin) {
    if (!text || isLoading) return;
    var inputOrigin = origin || 'typed';
    hideEmpty();
    textarea.value = '';
    autoResize(textarea);
    if (window.FlowbieVoice && typeof window.FlowbieVoice.updateSendMicVisibility === 'function') {
      FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
    }
    appendUserBubble(text);
    pushHistoryTurn('user', text);
    if (window.FlowbieChatDebugLog) {
      FlowbieChatDebugLog.appendTurn({ role: 'user', content: text });
    }
    sendMessage(text, inputOrigin);
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

  function prefetchOptions() {
    var pageCtx = cfg.pageContext || {};
    var pageContextKey = window.FlowbieChatPrefetch && typeof window.FlowbieChatPrefetch.getPageContextKey === 'function'
      ? window.FlowbieChatPrefetch.getPageContextKey()
      : '';
    return {
      ajaxUrl: cfg.ajaxUrl || cfg.restUrl,
      streamNonce: cfg.streamNonce || '',
      history: historyForApi(),
      sessionId: getChatSessionId(),
      source: 'frontend',
      adminMode: getAdminModeForApi(),
      adminSubmode: getAdminSubmodeForApi(),
      pageUrl: window.location.href || pageCtx.url || '',
      postId: pageCtx.postId || 0,
      pageTitle: typeof document !== 'undefined' ? document.title || '' : '',
      pageContextKey: pageContextKey,
      isLoading: function () { return isLoading; }
    };
  }

  if (window.FlowbieChatPrefetch) {
    FlowbieChatPrefetch.bindComposer(textarea, prefetchOptions());
    if (cfg.pageContext) {
      FlowbieChatPrefetch.warmPageContext(cfg.pageContext, prefetchOptions());
    }
    if (STARTERS.length && uiOn('suggestion_chips') && !isBackendMode()) {
      FlowbieChatPrefetch.prefetchSuggestions(STARTERS, prefetchOptions());
    }
  }

  function sendMessage(text, inputOrigin) {
    inputOrigin = inputOrigin || 'typed';
    isLoading = true;
    sendBtn.disabled = true;
    if (window.FlowbieVoice) {
      FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
    }
    if (window.FlowbieChatPrefetch) {
      FlowbieChatPrefetch.refreshOptions(prefetchOptions());
    }
    var prefetchHit = null;
    if (window.FlowbieChatPrefetch && !isBackendMode()) {
      prefetchHit = FlowbieChatPrefetch.consumeForSubmit(text, historyForApi());
    }
    if (window.FlowbieChatDebugLog) {
      FlowbieChatDebugLog.beginAssistantTurn();
    }
    var host = fcwThinkingHost();
    var streamCtx = window.FlowbieChatStream
      ? FlowbieChatStream.createContext({
          host: host,
          messagesEl: messages,
          scrollDown: scrollDown,
          presentCard: presentCard,
          appendFollowUpChips: appendFollowUpChips,
          onDone: function () {
            isLoading = false;
            sendBtn.disabled = false;
            if (window.FlowbieVoice) {
              FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
            }
            if (window.FlowbieChatPrefetch) {
              FlowbieChatPrefetch.refreshOptions(prefetchOptions());
            }
          },
          onStreamEvent: function (evt) {
            if (evt.status === 'done' && evt.card) {
              isLoading = false;
              sendBtn.disabled = false;
              if (window.FlowbieVoice) {
                FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
              }
            }
            if (!window.FlowbieChatDebugLog) return;
            if (evt.status === 'done' && evt.card) {
              var logMeta = {
                prefetch_key: prefetchHit && prefetchHit.prefetch_key ? prefetchHit.prefetch_key : ''
              };
              if (evt.template_intent) {
                logMeta.template_intent = evt.template_intent;
              }
              if (cfg.pageContext) {
                logMeta.page_context = {
                  title: cfg.pageContext.title || '',
                  url: cfg.pageContext.url || window.location.href || '',
                  type_label: cfg.pageContext.typeLabel || '',
                  has_body: !!(cfg.pageContext.postId),
                  path_hint: cfg.pageContext.pathHint || ''
                };
              }
              FlowbieChatDebugLog.appendTurn({
                role: 'assistant',
                card: evt.card,
                meta: logMeta
              });
            } else if (evt.status === 'chips' && evt.relatedTopics && evt.relatedTopics.length) {
              FlowbieChatDebugLog.appendStreamEvent('chips', '', { relatedTopics: evt.relatedTopics });
              FlowbieChatDebugLog.patchLastAssistantRelatedTopics(evt.relatedTopics);
            } else if (evt.status) {
              if (evt.status === 'ack' && evt.text) {
                FlowbieChatDebugLog.appendStreamEvent('ack', evt.text);
              } else if (evt.status !== 'ack') {
                FlowbieChatDebugLog.appendStreamEvent(evt.status, evt.label || '');
              }
            }
          }
        })
      : null;
    if (streamCtx && window.FlowbieChatStream) {
      FlowbieChatStream.setTypingIndicator(streamCtx, messages, scrollDown);
      var ackText = window.FlowbieChatPrefetch
        ? FlowbieChatPrefetch.getPrefetchAck(text, prefetchHit)
        : '';
      if (ackText) {
        FlowbieChatStream.showInstantAck(streamCtx, ackText);
        FlowbieChatStream.setTypingIndicator(streamCtx, messages, scrollDown);
      }
    }
    var thinkingShell = null;

    var url = (cfg.ajaxUrl || cfg.restUrl) +
      '?action=flowbie_chat_stream&_nonce=' + encodeURIComponent(cfg.streamNonce || '');

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: historyForApi(),
        prefetch_key: prefetchHit && prefetchHit.prefetch_key ? prefetchHit.prefetch_key : '',
        session_id: getChatSessionId(),
        source: 'frontend',
        admin_mode: getAdminModeForApi(),
        admin_submode: getAdminSubmodeForApi(),
        page_url: window.location.href || (cfg.pageContext && cfg.pageContext.url) || '',
        post_id: cfg.pageContext && cfg.pageContext.postId ? cfg.pageContext.postId : 0,
        page_title: typeof document !== 'undefined' ? document.title || '' : '',
        page_context_key: window.FlowbieChatPrefetch && typeof window.FlowbieChatPrefetch.getPageContextKey === 'function'
          ? FlowbieChatPrefetch.getPageContextKey()
          : '',
        input_origin: inputOrigin
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            if (streamCtx && window.FlowbieChatStream) {
              FlowbieChatStream.removeTypingIndicator(streamCtx);
            }
            isLoading = false;
            sendBtn.disabled = false;
            if (window.FlowbieVoice) {
              FlowbieVoice.updateSendMicVisibility(textarea, sendBtn);
            }
            return;
          }
          buf += decoder.decode(result.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          lines.forEach(function (line) {
            line = line.trim();
            if (!line) return;
            var evt;
            try { evt = JSON.parse(line); } catch (_) { return; }
            if (streamCtx && window.FlowbieChatStream) {
              FlowbieChatStream.handleEvent(evt, streamCtx);
              thinkingShell = streamCtx.thinkingShell || thinkingShell;
            } else if (evt.status === 'done' && evt.card) {
              presentCard(evt.card, {
                shell: thinkingShell,
                onDone: streamCtx ? streamCtx.onDone : undefined
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
      if (streamCtx && window.FlowbieChatStream) {
        FlowbieChatStream.removeTypingIndicator(streamCtx);
        thinkingShell = FlowbieChatStream.ensureThinkingShell(streamCtx);
      }
      presentCard({
        type: 'not-found',
        title: 'Connection error',
        body: 'Could not reach the server. Please check your internet connection.',
        confidence: 'low'
      }, { shell: thinkingShell });
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
    if (card.type === 'plan' && card.steps && card.steps.length) {
      appendPlanCard(card);
      return;
    }
    var row = el('div', { className: 'fcw-msg fcw-msg--assistant' });
    var cardEl = el('div', { className: 'fcw-card' });

    var titleRow = el('div', { className: 'fcw-card__title-row' });

    if (uiOn('type_badge')) {
      var badge = el('span', {
        className: 'fcw-card__type-badge'
      });
      badge.textContent = fcwTypeBadgeLabel(card.type);
      titleRow.appendChild(badge);
    }

    var title = el('span', { className: 'fcw-card__title' });
    title.innerHTML = renderMarkdown(card.title || '');
    titleRow.appendChild(title);
    cardEl.appendChild(titleRow);

    if (card.body) {
      var body = el('div', { className: 'fcw-card__body' });
      body.innerHTML = renderMarkdown(card.body);
      cardEl.appendChild(body);
    }

    fcwAppendConversionBlock(cardEl, card);

    var confMap = {
      high: 'High confidence',
      medium: 'Based on site content',
      low: 'Limited information'
    };
    if (uiOn('confidence')) {
      var conf = el('div', { className: 'fcw-card__confidence' });
      conf.textContent = confMap[card.confidence] || confMap.medium;
      cardEl.appendChild(conf);
    }

    if (uiOn('source_pills') && card.links && card.links.length) {
      var linksWrap = el('div', { className: 'fcw-card__links' });
      card.links.forEach(function (link) {
        var a = el('a', {
          className: 'fcw-link-pill',
          href: link.url
        });
        var icon = linkIcon(link.icon);
        if (icon) {
          var iconSpan = el('span', { className: 'fcw-link-pill__icon', innerHTML: icon });
          a.appendChild(iconSpan);
        }
        var lbl = el('span', {});
        lbl.textContent = link.label;
        a.appendChild(lbl);
        bindAcceptClick(a, card, 'source', link.label);
        linksWrap.appendChild(a);
      });
      cardEl.appendChild(linksWrap);
    }

    appendCardCtas(cardEl, card);

    if (uiOn('suggestion_chips') && card.relatedTopics && card.relatedTopics.length) {
      appendTopicChips(cardEl, card.relatedTopics);
    }

    row.appendChild(cardEl);
    messages.appendChild(row);
    scrollDown(row);
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

  function scrollDown(target) {
    requestAnimationFrame(function () {
      if (target && target.nodeType === 1 && messages) {
        var messagesRect = messages.getBoundingClientRect();
        var rowRect = target.getBoundingClientRect();
        messages.scrollTop += rowRect.top - messagesRect.top;
        return;
      }
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
    if (window.FlowbieMarkdown && typeof window.FlowbieMarkdown.render === 'function') {
      return FlowbieMarkdown.render(text);
    }
    var s = esc(text);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
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
})();
