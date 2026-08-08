/**
 * Shared NDJSON stream handler for Flow Assist chat (frontend + admin demo).
 */
(function (global) {
  'use strict';

  var ACK_TO_CARD_MIN_MS = 400;
  var ACK_TO_CARD_INSTANT_MS = 100;
  var PREFETCHED_REVEAL_MS = 450;
  var TYPING_FRAMES = ['.', '..', '...'];
  var TYPING_INTERVAL_MS = 400;

  function ensureThinkingShell(ctx) {
    if (!ctx) {
      return null;
    }
    removeTypingIndicator(ctx);
    if (ctx.thinkingShell) {
      return ctx.thinkingShell;
    }
    if (ctx.host && global.FlowbieThinkingCard) {
      ctx.thinkingShell = global.FlowbieThinkingCard.createThinkingCard(ctx.host, { stream: true });
      if (ctx.ackEl && ctx.messagesEl && ctx.thinkingShell.root) {
        if (ctx.ackEl.nextSibling) {
          ctx.messagesEl.insertBefore(ctx.thinkingShell.root, ctx.ackEl.nextSibling);
        } else {
          ctx.messagesEl.appendChild(ctx.thinkingShell.root);
        }
      }
    }
    return ctx.thinkingShell;
  }

  function appendAckBubble(messagesEl, text, scrollDown) {
    if (!messagesEl || !text) {
      return null;
    }
    var row = document.createElement('div');
    row.className = 'fcw-msg fcw-msg--assistant fcw-msg--ack';
    var bub = document.createElement('div');
    bub.className = 'fcw-ack-bubble';
    bub.textContent = text;
    row.appendChild(bub);
    messagesEl.appendChild(row);
    if (typeof scrollDown === 'function') {
      scrollDown();
    }
    return row;
  }

  function showInstantAck(ctx, text) {
    if (!ctx || !text || ctx.ackShown) {
      return;
    }
    removeTypingIndicator(ctx);
    ctx.ackShown = true;
    ctx.ackShownAt = Date.now();
    ctx.instantAck = true;
    ctx.ackText = text;
    ctx.ackEl = appendAckBubble(ctx.messagesEl, text, ctx.scrollDown);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        if (typeof ctx.scrollDown === 'function') {
          ctx.scrollDown();
        }
      });
    }
  }

  function updateAckText(ctx, text) {
    if (!ctx || !text) {
      return;
    }
    text = String(text).trim();
    if (!text) {
      return;
    }
    if (ctx.ackText === text) {
      return;
    }
    ctx.ackText = text;
    if (ctx.ackEl) {
      var bub = ctx.ackEl.querySelector('.fcw-ack-bubble');
      if (bub) {
        bub.textContent = text;
        return;
      }
    }
    if (!ctx.ackShown) {
      showInstantAck(ctx, text);
    }
  }

  function showTypingIndicator(messagesEl, scrollDown) {
    if (!messagesEl) {
      return null;
    }
    var row = document.createElement('div');
    row.className = 'fcw-msg fcw-msg--assistant fcw-msg--typing';
    var bub = document.createElement('div');
    bub.className = 'fcw-typing-bubble';
    bub.setAttribute('aria-live', 'polite');
    bub.setAttribute('aria-label', 'Assistant is typing');
    var dots = document.createElement('span');
    dots.className = 'fcw-typing-dots';
    dots.textContent = TYPING_FRAMES[0];
    bub.appendChild(dots);
    row.appendChild(bub);
    messagesEl.appendChild(row);
    if (typeof scrollDown === 'function') {
      scrollDown();
    }
    var frame = 0;
    var timer = setInterval(function () {
      frame = (frame + 1) % TYPING_FRAMES.length;
      dots.textContent = TYPING_FRAMES[frame];
    }, TYPING_INTERVAL_MS);
    return { row: row, timer: timer };
  }

  function setTypingIndicator(ctx, messagesEl, scrollDown) {
    if (ctx) {
      removeTypingIndicator(ctx);
    }
    var typingEl = showTypingIndicator(messagesEl, scrollDown);
    if (ctx) {
      ctx.typingEl = typingEl;
    }
    return typingEl;
  }

  function removeTypingIndicator(ctx) {
    if (!ctx || !ctx.typingEl) {
      return;
    }
    if (ctx.typingEl.timer) {
      clearInterval(ctx.typingEl.timer);
    }
    if (ctx.typingEl.row && ctx.typingEl.row.parentNode) {
      ctx.typingEl.row.parentNode.removeChild(ctx.typingEl.row);
    }
    ctx.typingEl = null;
  }

  function clearDoneTimer(ctx) {
    if (ctx && ctx.doneTimer) {
      clearTimeout(ctx.doneTimer);
      ctx.doneTimer = null;
    }
  }

  function flushPendingChips(ctx) {
    if (!ctx || !ctx.pendingChips || typeof ctx.appendFollowUpChips !== 'function') {
      return;
    }
    var pending = ctx.pendingChips;
    ctx.pendingChips = null;
    ctx.appendFollowUpChips(pending);
  }

  function presentDoneCard(evt, ctx) {
    clearDoneTimer(ctx);
    removeTypingIndicator(ctx);
    if (typeof ctx.onStreamEvent === 'function') {
      ctx.onStreamEvent(evt);
    }
    if (typeof ctx.presentCard !== 'function') {
      return;
    }

    var card = evt.card;
    var onDone = ctx.onDone;

    function finish() {
      var shell = ctx.thinkingShell || null;
      ctx.presentCard(card, {
        shell: shell,
        onDone: function () {
          if (typeof onDone === 'function') {
            onDone();
          }
          flushPendingChips(ctx);
        }
      });
    }

    var ackMin = ctx.prefetchedReveal
      ? PREFETCHED_REVEAL_MS
      : (ctx.instantAck ? ACK_TO_CARD_INSTANT_MS : ACK_TO_CARD_MIN_MS);
    var ackElapsed = ctx.ackShownAt ? Date.now() - ctx.ackShownAt : ackMin;
    var ackWait = Math.max(0, ackMin - ackElapsed);

    ensureThinkingShell(ctx);
    if (ackWait > 0) {
      ctx.doneTimer = setTimeout(finish, ackWait);
      return;
    }
    finish();
  }

  function handleEvent(evt, ctx) {
    if (!evt || !ctx) {
      return;
    }

    if (evt.status === 'ack') {
      if (evt.text) {
        if (!ctx.ackShown) {
          showInstantAck(ctx, evt.text);
        } else {
          updateAckText(ctx, evt.text);
        }
        setTypingIndicator(ctx, ctx.messagesEl, ctx.scrollDown);
      }
      if (typeof ctx.onStreamEvent === 'function') {
        ctx.onStreamEvent(evt);
      }
      return;
    }

    if (evt.status === 'done' && evt.card) {
      if (evt.prefetched) {
        ctx.prefetchedReveal = true;
      }
      presentDoneCard(evt, ctx);
      return;
    }

    if (evt.status === 'chips' && evt.relatedTopics && evt.relatedTopics.length) {
      if (typeof ctx.onStreamEvent === 'function') {
        ctx.onStreamEvent(evt);
      }
      ctx.pendingChips = evt;
      if (!ctx.doneTimer) {
        flushPendingChips(ctx);
      }
      return;
    }

    if (evt.label && !ctx.thinkingShell) {
      var thinkingShell = ensureThinkingShell(ctx);
      if (thinkingShell && global.FlowbieThinkingCard) {
        global.FlowbieThinkingCard.advanceStreamLabel(
          thinkingShell,
          ctx.host,
          evt.label
        );
      }
    } else if (evt.label && ctx.thinkingShell && global.FlowbieThinkingCard) {
      global.FlowbieThinkingCard.advanceStreamLabel(
        ctx.thinkingShell,
        ctx.host,
        evt.label
      );
    }

    if (typeof ctx.onStreamEvent === 'function') {
      ctx.onStreamEvent(evt);
    }
  }

  function createContext(base) {
    base = base || {};
    return {
      thinkingShell: base.thinkingShell || null,
      host: base.host || null,
      presentCard: base.presentCard || null,
      messagesEl: base.messagesEl || null,
      scrollDown: base.scrollDown || null,
      onDone: base.onDone || null,
      onStreamEvent: base.onStreamEvent || null,
      appendFollowUpChips: base.appendFollowUpChips || null,
      ackShown: false,
      ackShownAt: 0,
      instantAck: false,
      prefetchedReveal: false,
      ackText: '',
      ackEl: null,
      typingEl: null,
      doneTimer: null,
      pendingChips: null
    };
  }

  global.FlowbieChatStream = {
    ACK_TO_CARD_MIN_MS: ACK_TO_CARD_MIN_MS,
    ACK_TO_CARD_INSTANT_MS: ACK_TO_CARD_INSTANT_MS,
    ensureThinkingShell: ensureThinkingShell,
    appendAckBubble: appendAckBubble,
    showInstantAck: showInstantAck,
    updateAckText: updateAckText,
    showTypingIndicator: showTypingIndicator,
    setTypingIndicator: setTypingIndicator,
    removeTypingIndicator: removeTypingIndicator,
    handleEvent: handleEvent,
    createContext: createContext,
    clearDoneTimer: clearDoneTimer
  };
})(typeof window !== 'undefined' ? window : this);
