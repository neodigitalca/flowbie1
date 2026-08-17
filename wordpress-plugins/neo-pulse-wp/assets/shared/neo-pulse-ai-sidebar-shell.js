(function () {
  'use strict';

  var BODY_LOCK_CLASS = 'fai-sidebar-scroll-lock';
  var scrollLockCount = 0;

  function lockPageScroll() {
    scrollLockCount += 1;
    if (scrollLockCount === 1) {
      document.documentElement.classList.add(BODY_LOCK_CLASS);
      document.body.classList.add(BODY_LOCK_CLASS);
    }
  }

  function unlockPageScroll() {
    if (scrollLockCount <= 0) {
      return;
    }
    scrollLockCount -= 1;
    if (scrollLockCount === 0) {
      document.documentElement.classList.remove(BODY_LOCK_CLASS);
      document.body.classList.remove(BODY_LOCK_CLASS);
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width:767px)').matches;
  }

  function revealChatMobileRoot(root) {
    if (!root || root.id !== 'neo-pulse-chat-widget-root' || !isMobileViewport()) {
      return;
    }
    if (typeof window.NeoPulseChatMountShell === 'function') {
      window.NeoPulseChatMountShell();
    }
    root.hidden = false;
    root.removeAttribute('aria-hidden');
    root.classList.remove('fcw-mobile-root-closed');
    root.style.cssText = 'display:block!important;visibility:visible!important;position:fixed!important;inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:100%!important;height:100%!important;max-width:none!important;overflow:visible!important;z-index:999950!important;pointer-events:none!important';
  }

  function hideChatMobileRoot(root) {
    if (!root || root.id !== 'neo-pulse-chat-widget-root' || !isMobileViewport()) {
      return;
    }
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.classList.add('fcw-mobile-root-closed');
    root.style.cssText = 'display:none!important;visibility:hidden!important;position:absolute!important;left:-9999px!important;top:auto!important;width:0!important;height:0!important;max-width:0!important;overflow:hidden!important;pointer-events:none!important;margin:0!important;padding:0!important;border:0!important';
  }

  function applyMobileFullscreenPanel(panel) {
    if (!panel || !isMobileViewport()) {
      return;
    }
    panel.classList.add('fai-sidebar-panel--mobile-fullscreen');
  }

  function clearMobileFullscreenPanel(panel) {
    if (!panel) {
      return;
    }
    panel.classList.remove('fai-sidebar-panel--mobile-fullscreen');
  }

  function getFocusable(panel) {
    if (!panel) return [];
    return Array.prototype.slice.call(
      panel.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function NeoPulseAiSidebarShell(root, opts) {
    this.root = root;
    this.opts = opts || {};
    this.isOpen = false;
    this.isModal = root.classList.contains('fbs-modal-root');
    this.openClass = this.isModal ? 'fbs-modal-root--open' : 'fai-sidebar-root--open';
    this.launcher = this.opts.launcher || root.querySelector('.fai-sidebar-launcher, .fbs__icon-launcher');
    this.backdrop = this.opts.backdrop || root.querySelector('.fai-sidebar-backdrop, .fbs-modal-backdrop');
    this.panel = this.opts.panel || root.querySelector('.fai-sidebar-panel, .fbs-modal-panel');
    this.closeBtn = this.panel ? this.panel.querySelector('.fai-sidebar-close') : null;
    this.extraLaunchers = [];
    this.onKeyDown = this.onKeyDown.bind(this);
    this.bind();
  }

  NeoPulseAiSidebarShell.prototype.registerLauncher = function (el, opts) {
    if (!el) return;
    var self = this;
    var entry = { el: el, opts: opts || {} };
    this.extraLaunchers.push(entry);
    el.addEventListener('click', function () {
      if (typeof entry.opts.onBeforeOpen === 'function') {
        entry.opts.onBeforeOpen();
      } else if (typeof self.opts.onBeforeOpen === 'function') {
        self.opts.onBeforeOpen();
      }
      self.toggle(true);
    });
  };

  NeoPulseAiSidebarShell.prototype.bind = function () {
    var self = this;
    if (this.launcher) {
      this.launcher.addEventListener('click', function () {
        if (typeof self.opts.onBeforeOpen === 'function') {
          self.opts.onBeforeOpen();
        }
        self.toggle(true);
      });
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', function () {
        self.toggle(false);
      });
    }
    if (this.backdrop) {
      this.backdrop.addEventListener('click', function () {
        self.toggle(false);
      });
    }
  };

  NeoPulseAiSidebarShell.prototype.onKeyDown = function (e) {
    if (e.key === 'Escape') {
      this.toggle(false);
      return;
    }
    if (e.key !== 'Tab' || !this.panel) return;
    var focusable = getFocusable(this.panel);
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  NeoPulseAiSidebarShell.prototype.setLauncherExpanded = function (expanded) {
    var seen = [];
    var list = [this.launcher];
    (this.extraLaunchers || []).forEach(function (entry) {
      list.push(entry.el);
    });
    list.forEach(function (launcher) {
      if (!launcher || seen.indexOf(launcher) !== -1) return;
      seen.push(launcher);
      launcher.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  };

  NeoPulseAiSidebarShell.prototype.open = function () {
    if (this.isOpen) return;
    this.isOpen = true;
    if (isMobileViewport()) {
      revealChatMobileRoot(this.root);
    }
    this.root.classList.add(this.openClass);
    if (!this.isModal) {
      this.root.classList.add('fai-sidebar-root--open');
    }
    if (this.backdrop) {
      this.backdrop.removeAttribute('hidden');
      this.backdrop.classList.add('fai-sidebar-backdrop--visible');
    }
    if (this.panel) {
      this.panel.removeAttribute('hidden');
      this.panel.classList.add('fai-sidebar-panel--visible');
      applyMobileFullscreenPanel(this.panel);
    }
    lockPageScroll();
    document.addEventListener('keydown', this.onKeyDown);
    this.setLauncherExpanded(true);
    if (typeof this.opts.onOpen === 'function') {
      this.opts.onOpen();
    }
    var focusTarget = this.panel && this.panel.querySelector('input, textarea, button');
    if (focusTarget) {
      setTimeout(function () { focusTarget.focus(); }, prefersReducedMotion() ? 0 : 50);
    }
  };

  NeoPulseAiSidebarShell.prototype.close = function () {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove(this.openClass);
    this.root.classList.remove('fai-sidebar-root--open');
    if (this.backdrop) {
      this.backdrop.setAttribute('hidden', '');
      this.backdrop.classList.remove('fai-sidebar-backdrop--visible');
    }
    if (this.panel) {
      this.panel.setAttribute('hidden', '');
      this.panel.classList.remove('fai-sidebar-panel--visible');
      clearMobileFullscreenPanel(this.panel);
    }
    unlockPageScroll();
    document.removeEventListener('keydown', this.onKeyDown);
    this.setLauncherExpanded(false);
    if (typeof this.opts.onClose === 'function') {
      this.opts.onClose();
    }
    if (isMobileViewport()) {
      hideChatMobileRoot(this.root);
    }
    if (this.launcher) {
      this.launcher.focus();
    }
  };

  NeoPulseAiSidebarShell.prototype.toggle = function (open) {
    if (typeof open === 'boolean') {
      open ? this.open() : this.close();
    } else {
      this.isOpen ? this.close() : this.open();
    }
  };

  window.NeoPulseAiSidebarShell = NeoPulseAiSidebarShell;

  window.NeoPulseAiSidebarShell.init = function (root, opts) {
    if (!root || root.getAttribute('data-fai-sidebar-bound') === '1') {
      return root && root._faiSidebarShell ? root._faiSidebarShell : null;
    }
    root.setAttribute('data-fai-sidebar-bound', '1');
    var shell = new NeoPulseAiSidebarShell(root, opts);
    root._faiSidebarShell = shell;
    return shell;
  };
})();
