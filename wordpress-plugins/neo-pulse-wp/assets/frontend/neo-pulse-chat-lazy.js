/**
 * Loads Pulse chat CSS/JS on first launcher tap or after idle.
 */
(function () {
  "use strict";

  var pack = window.neoPulseChatLazy || {};
  var loaded = false;
  var inflight = null;

  function injectStyle(href) {
    return new Promise(function (resolve) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  function injectScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function revealLauncher() {
    var btn = document.getElementById("neo-pulse-chat-mobile-launcher");
    if (!btn) return;
    btn.removeAttribute("hidden");
    btn.classList.remove("fcw-launcher--pending");
  }

  function load() {
    if (loaded) return Promise.resolve();
    if (inflight) return inflight;
    window.neoPulseChatConfig = pack.config || window.neoPulseChatConfig || {};
    if (pack.voiceConfig) {
      window.neoPulseVoiceConfig = pack.voiceConfig;
    }
    inflight = (pack.styles || [])
      .reduce(function (chain, href) {
        return chain.then(function () {
          return injectStyle(href);
        });
      }, Promise.resolve())
      .then(function () {
        return (pack.scripts || []).reduce(function (chain, src) {
          return chain.then(function () {
            return injectScript(src);
          });
        }, Promise.resolve());
      })
      .then(function () {
        loaded = true;
        revealLauncher();
      });
    return inflight;
  }

  function isLauncher(node) {
    if (!node || !node.closest) return null;
    return node.closest("[data-fcw-chat-launcher], #neo-pulse-chat-mobile-launcher");
  }

  document.addEventListener(
    "click",
    function (event) {
      var btn = isLauncher(event.target);
      if (!btn || loaded) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      load().then(function () {
        btn.click();
      });
    },
    true
  );

  var idle = window.requestIdleCallback || function (cb) {
    return window.setTimeout(cb, 2000);
  };
  idle(function () {
    load();
  }, { timeout: 4000 });
})();
