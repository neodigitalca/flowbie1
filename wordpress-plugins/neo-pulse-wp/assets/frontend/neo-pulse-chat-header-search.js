(function () {
  'use strict';

  function isHeaderSearch(el) {
    if (!el || !el.closest) {
      return false;
    }
    if (el.closest('#neo-pulse-chat-widget-root, .fai-sidebar-panel, .fcw-launcher')) {
      return false;
    }
    var node = el.closest('a, button, [role="button"], .elementor-search-form__toggle');
    if (!node) {
      return false;
    }
    if (!node.closest('header, .elementor-location-header, .site-header, #masthead')) {
      return false;
    }
    var hay = [
      node.className || '',
      node.id || '',
      node.getAttribute('aria-label') || '',
      node.getAttribute('title') || '',
      node.getAttribute('href') || ''
    ].join(' ').toLowerCase();
    return hay.indexOf('search') !== -1;
  }

  function openChat() {
    if (typeof window.NeoPulseChatOpen === 'function') {
      window.NeoPulseChatOpen();
      return;
    }
    var launcher = document.querySelector('[data-fcw-chat-launcher="1"]');
    if (launcher) {
      launcher.click();
    }
  }

  function bind() {
    if (document.documentElement.getAttribute('data-neo-pulse-chat-header-search-bound') === '1') {
      return;
    }
    document.documentElement.setAttribute('data-neo-pulse-chat-header-search-bound', '1');
    document.addEventListener('click', function (e) {
      if (!isHeaderSearch(e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      openChat();
    }, true);
  }

  document.addEventListener('DOMContentLoaded', bind);
  if (document.readyState !== 'loading') {
    bind();
  }
})();
