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

  function getFocusable(panel) {
    if (!panel) return [];
    return Array.prototype.slice.call(
      panel.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function FlowbieAiSidebarShell(root, opts) {
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

  FlowbieAiSidebarShell.prototype.registerLauncher = function (el, opts) {
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

  FlowbieAiSidebarShell.prototype.bind = function () {
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

  FlowbieAiSidebarShell.prototype.onKeyDown = function (e) {
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

  FlowbieAiSidebarShell.prototype.setLauncherExpanded = function (expanded) {
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

  FlowbieAiSidebarShell.prototype.open = function () {
    if (this.isOpen) return;
    this.isOpen = true;
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

  FlowbieAiSidebarShell.prototype.close = function () {
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
    }
    unlockPageScroll();
    document.removeEventListener('keydown', this.onKeyDown);
    this.setLauncherExpanded(false);
    if (typeof this.opts.onClose === 'function') {
      this.opts.onClose();
    }
    if (this.launcher) {
      this.launcher.focus();
    }
  };

  FlowbieAiSidebarShell.prototype.toggle = function (open) {
    if (typeof open === 'boolean') {
      open ? this.open() : this.close();
    } else {
      this.isOpen ? this.close() : this.open();
    }
  };

  window.FlowbieAiSidebarShell = FlowbieAiSidebarShell;

  window.FlowbieAiSidebarShell.init = function (root, opts) {
    if (!root || root.getAttribute('data-fai-sidebar-bound') === '1') {
      return root && root._faiSidebarShell ? root._faiSidebarShell : null;
    }
    root.setAttribute('data-fai-sidebar-bound', '1');
    var shell = new FlowbieAiSidebarShell(root, opts);
    root._faiSidebarShell = shell;
    return shell;
  };
})();
