(function () {
  'use strict';

  function findWrap() {
    return document.querySelector('.neo-pulse-search-wrap[data-header-search-trigger="1"]');
  }

  function findShell(wrap) {
    if (!wrap) {
      return null;
    }
    if (wrap._faiSidebarShell) {
      return wrap._faiSidebarShell;
    }
    if (window.NeoPulseAiSidebarUnify && window.NeoPulseAiSidebarUnify.getShell) {
      return window.NeoPulseAiSidebarUnify.getShell();
    }
    return null;
  }

  function isHeaderSearch(el) {
    if (!el || !el.closest) {
      return false;
    }
    if (el.closest('.neo-pulse-search-wrap, .fai-sidebar-panel, .fai-sidebar-root')) {
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

  function bind() {
    if (document.documentElement.getAttribute('data-neo-pulse-header-search-bound') === '1') {
      return;
    }
    if (!findWrap()) {
      return;
    }
    document.documentElement.setAttribute('data-neo-pulse-header-search-bound', '1');
    document.addEventListener('click', function (e) {
      if (!isHeaderSearch(e.target)) {
        return;
      }
      var shell = findShell(findWrap());
      if (!shell) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (typeof shell.open === 'function') {
        shell.open();
      }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', bind);
  document.addEventListener('neo-pulse-ai-sidebar-merged', bind);
})();
