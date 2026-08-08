(function ($) {
  'use strict';

  var reconcileTimer = null;

  function normalizeWidgetId(id) {
    return String(id || '').replace(/^elementor-element-/, '');
  }

  function getElementorWidgetIdFromElement(el) {
    if (!el || !el.className) {
      return '';
    }
    var classes = el.className.split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
      if (classes[i].indexOf('elementor-element-') === 0) {
        return classes[i].slice('elementor-element-'.length);
      }
    }
    return '';
  }

  function getElementorWidgetId(wrap) {
    return getElementorWidgetIdFromElement(wrap ? wrap.closest('.elementor-element') : null);
  }

  function isFlowbieSearchModel(model) {
    return model && typeof model.get === 'function' && model.get('widgetType') === 'flowbie_search';
  }

  function readPreviewPanelFromSettings(settings) {
    if (!settings) {
      return false;
    }
    if (typeof settings.get === 'function') {
      return settings.get('preview_panel') === 'yes';
    }
    return settings.preview_panel === 'yes';
  }

  function readPreviewPanelFromModel(model) {
    if (!model || typeof model.get !== 'function') {
      return false;
    }
    return readPreviewPanelFromSettings(model.get('settings'));
  }

  function getParentElementor() {
    try {
      var parentWin = window.parent;
      if (!parentWin || parentWin === window) {
        return null;
      }
      return parentWin.elementor || null;
    } catch (err) {
      return null;
    }
  }

  function getPanelEditingFlowbieSearchModel() {
    try {
      var elementor = getParentElementor();
      if (!elementor || !elementor.getPanelView) {
        return null;
      }
      var panel = elementor.getPanelView();
      if (!panel || !panel.getCurrentPageView) {
        return null;
      }
      var page = panel.getCurrentPageView();
      if (!page || !page.model || !isFlowbieSearchModel(page.model)) {
        return null;
      }
      return page.model;
    } catch (err) {
      return null;
    }
  }

  function getSelectedModelsFromParent() {
    try {
      var parentWin = window.parent;
      if (!parentWin || parentWin === window) {
        return [];
      }

      if (parentWin.$e && typeof parentWin.$e.run === 'function') {
        var selected = parentWin.$e.run('document/elements/get-selected');
        if (selected && selected.length) {
          return selected;
        }
      }

      var elementor = parentWin.elementor;
      if (elementor && elementor.selection && typeof elementor.selection.getElements === 'function') {
        var elements = elementor.selection.getElements();
        if (elements && elements.length) {
          var models = [];
          for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            models.push(el.model || el);
          }
          return models;
        }
      }
    } catch (err) {
      return [];
    }

    return [];
  }

  function readPreviewPanelFromFrontendConfig(widgetId) {
    if (!widgetId || typeof elementorFrontend === 'undefined') {
      return null;
    }

    var elements = elementorFrontend.config && elementorFrontend.config.elements;
    if (!elements || !elements.data) {
      return null;
    }

    var data = elements.data;
    var entry = data[widgetId];
    if (entry && entry.settings) {
      return entry.settings.preview_panel === 'yes';
    }

    var key;
    for (key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      var item = data[key];
      if (!item || !item.settings) {
        continue;
      }
      if (normalizeWidgetId(key) === widgetId || normalizeWidgetId(item.id) === widgetId) {
        return item.settings.preview_panel === 'yes';
      }
    }

    return null;
  }

  function isWrapSelected(wrap) {
    var widgetId = normalizeWidgetId(getElementorWidgetId(wrap));
    if (!widgetId) {
      return false;
    }

    var models = getSelectedModelsFromParent();
    for (var i = 0; i < models.length; i++) {
      var model = models[i];
      if (typeof model.get === 'function' && normalizeWidgetId(model.get('id')) === widgetId) {
        return true;
      }
    }

    var panelModel = getPanelEditingFlowbieSearchModel();
    if (panelModel && normalizeWidgetId(panelModel.get('id')) === widgetId) {
      return true;
    }

    return false;
  }

  function resolveShowPreview(wrap) {
    if (!isWrapSelected(wrap)) {
      return false;
    }

    var widgetId = normalizeWidgetId(getElementorWidgetId(wrap));

    var panelModel = getPanelEditingFlowbieSearchModel();
    if (panelModel && normalizeWidgetId(panelModel.get('id')) === widgetId) {
      return readPreviewPanelFromModel(panelModel) === true;
    }

    var fromConfig = readPreviewPanelFromFrontendConfig(widgetId);
    if (fromConfig !== null) {
      return fromConfig === true;
    }

    var models = getSelectedModelsFromParent();
    for (var i = 0; i < models.length; i++) {
      var model = models[i];
      if (isFlowbieSearchModel(model) && normalizeWidgetId(model.get('id')) === widgetId) {
        return readPreviewPanelFromModel(model) === true;
      }
    }

    return false;
  }

  function bindSearchWrap(wrap) {
    if (!wrap || wrap.getAttribute('data-elementor-edit-preview') !== '1') {
      return;
    }
    if (wrap.getAttribute('data-fbs-bound') === '1') {
      return;
    }
    if (window.FlowbieSearch && typeof window.FlowbieSearch.initWrap === 'function') {
      window.FlowbieSearch.initWrap(wrap);
    }
  }

  function findPanelForWrap(wrap) {
    if (!wrap) {
      return null;
    }

    if (wrap._fbsPreviewPanel && wrap._fbsPreviewPanel.isConnected) {
      return wrap._fbsPreviewPanel;
    }

    var panel = wrap.querySelector(':scope > .fai-sidebar-panel, :scope > .fbs-modal-panel');
    if (panel) {
      return panel;
    }

    var widgetId = normalizeWidgetId(getElementorWidgetId(wrap));
    if (!widgetId) {
      return null;
    }

    return document.body.querySelector(
      '.fai-sidebar-panel[data-flowbie-el="' + widgetId + '"], .fbs-modal-panel[data-flowbie-el="' + widgetId + '"]'
    );
  }

  function restorePanelToWrap(wrap, panel) {
    if (!wrap || !panel) {
      return;
    }
    var home = wrap._fbsPanelHome;
    if (home && panel.parentNode !== home) {
      home.appendChild(panel);
    }
    panel.classList.remove('fai-sidebar-panel--elementor-editor-preview');
    panel.removeAttribute('data-flowbie-el');
    panel.style.cssText = '';
    wrap._fbsPreviewPanel = null;
  }

  function copyPreviewVars(wrap, panel) {
    if (!wrap || !panel) {
      return;
    }
    var computed = window.getComputedStyle(wrap);
    var vars = [
      '--fai-sidebar-width', '--fai-sidebar-z-index', '--fbs-panel-bg', '--fai-sidebar-bg',
      '--fbs-panel-text', '--fai-sidebar-text', '--fbs-panel-text-muted', '--fai-sidebar-text-muted',
      '--fbs-panel-offset-top', '--fbs-radius', '--fbs-modal-max-width', '--fbs-backdrop-color', '--fbs-backdrop-opacity'
    ];
    for (var i = 0; i < vars.length; i++) {
      var name = vars[i];
      var value = computed.getPropertyValue(name);
      if (value && value.trim() !== '') {
        panel.style.setProperty(name, value.trim());
      }
    }
  }

  function mountPanelForPreview(wrap, panel) {
    if (!wrap || !panel) {
      return;
    }

    if (!wrap._fbsPanelHome) {
      wrap._fbsPanelHome = panel.parentNode;
    }

    var widgetId = getElementorWidgetId(wrap);
    var isModal = wrap.classList.contains('fbs-modal-root');
    var isLeft = wrap.classList.contains('fai-sidebar-root--left');

    if (panel.parentNode !== document.body) {
      document.body.appendChild(panel);
    }

    panel.classList.add('fai-sidebar-panel--elementor-editor-preview');
    panel.setAttribute('data-flowbie-el', widgetId);
    panel.removeAttribute('hidden');
    panel.removeAttribute('aria-hidden');
    panel.classList.remove('fai-sidebar-panel--editor-preview-left', 'fai-sidebar-panel--editor-preview-right');

    if (isModal) {
      panel.classList.add('fbs-modal-panel');
    } else if (isLeft) {
      panel.classList.add('fai-sidebar-panel--editor-preview-left');
    } else {
      panel.classList.add('fai-sidebar-panel--editor-preview-right');
    }

    copyPreviewVars(wrap, panel);

    if (!isModal && wrap.classList.contains('flowbie-search-wrap--icon-only')) {
      panel.style.transform = 'translateX(0)';
    }

    wrap._fbsPreviewPanel = panel;
  }

  function applyEditorPreviewState(wrap, show) {
    if (!wrap) {
      return;
    }

    var backdrop = wrap.querySelector('.fai-sidebar-backdrop, .fbs-modal-backdrop');
    var panel = findPanelForWrap(wrap);
    var iconPanel = wrap.querySelector('.fbs__icon-panel--expand');
    var isModal = wrap.classList.contains('fbs-modal-root');
    var isExpand = wrap.classList.contains('flowbie-search-wrap--icon-expand');

    if (show) {
      wrap.setAttribute('data-elementor-panel-preview', '1');
      wrap.classList.add('flowbie-search-wrap--panel-preview');
      wrap.classList.add(isModal ? 'fbs-modal-root--open' : 'fai-sidebar-root--open');

      if (isExpand) {
        wrap.classList.add('fbs--open', 'flowbie-search-wrap--open');
        if (iconPanel) {
          iconPanel.removeAttribute('hidden');
          iconPanel.removeAttribute('aria-hidden');
        }
      } else if (panel) {
        mountPanelForPreview(wrap, panel);
      }

      if (backdrop) {
        backdrop.setAttribute('hidden', '');
        backdrop.setAttribute('aria-hidden', 'true');
      }
      return;
    }

    wrap.removeAttribute('data-elementor-panel-preview');
    wrap.classList.remove(
      'flowbie-search-wrap--panel-preview',
      'fbs--open',
      'flowbie-search-wrap--open',
      'fai-sidebar-root--open',
      'fbs-modal-root--open'
    );

    if (panel) {
      restorePanelToWrap(wrap, panel);
      panel.classList.remove(
        'fai-sidebar-panel--editor-preview-left',
        'fai-sidebar-panel--editor-preview-right'
      );
      panel.setAttribute('hidden', '');
      panel.setAttribute('aria-hidden', 'true');
    }

    if (iconPanel) {
      iconPanel.setAttribute('hidden', '');
      iconPanel.setAttribute('aria-hidden', 'true');
    }

    if (backdrop) {
      backdrop.setAttribute('hidden', '');
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function reconcileActivePreviews() {
    document.querySelectorAll('.flowbie-search-wrap[data-elementor-edit-preview="1"]:not(.flowbie-search-wrap--panel-inner)').forEach(function (wrap) {
      var show = resolveShowPreview(wrap);
      applyEditorPreviewState(wrap, show);
      if (!show) {
        bindSearchWrap(wrap);
      }
    });
  }

  function scheduleReconcile() {
    if (reconcileTimer) {
      clearTimeout(reconcileTimer);
    }
    reconcileTimer = setTimeout(function () {
      reconcileTimer = null;
      reconcileActivePreviews();
    }, 0);
  }

  function scheduleReconcileDelayed() {
    scheduleReconcile();
    setTimeout(scheduleReconcile, 80);
    setTimeout(scheduleReconcile, 250);
  }

  function bindElementorEditorEvents() {
    var elementor = getParentElementor();
    if (!elementor) {
      return;
    }

    if (elementor.hooks && typeof elementor.hooks.addAction === 'function') {
      elementor.hooks.addAction('panel/open_editor/widget/flowbie_search', scheduleReconcileDelayed);
    }

    if (elementor.channels && elementor.channels.editor) {
      var editor = elementor.channels.editor;
      if (typeof editor.on === 'function') {
        editor.on('element:selected', scheduleReconcileDelayed);
        editor.on('change', scheduleReconcileDelayed);
        editor.on('element:change', scheduleReconcileDelayed);
      }
    }
  }

  function initScope(scope) {
    if (!scope || !scope.querySelectorAll) {
      return;
    }

    var wraps = scope.querySelectorAll('.flowbie-search-wrap[data-elementor-edit-preview="1"]:not(.flowbie-search-wrap--panel-inner)');
    for (var i = 0; i < wraps.length; i++) {
      bindSearchWrap(wraps[i]);
    }

    scheduleReconcileDelayed();
  }

  function bindElementorPreview() {
    if (typeof elementorFrontend === 'undefined') {
      return;
    }

    elementorFrontend.hooks.addAction('frontend/element_ready/flowbie_search.default', function ($scope) {
      initScope($scope[0]);
    });

    bindElementorEditorEvents();
    scheduleReconcileDelayed();

    $(window).on('elementor/element/activate elementor/element/deactivate', scheduleReconcileDelayed);
  }

  $(window).on('elementor/frontend/init', bindElementorPreview);
  $(function () {
    bindElementorEditorEvents();
    document.querySelectorAll('.flowbie-search-wrap[data-elementor-edit-preview="1"]:not(.flowbie-search-wrap--panel-inner)').forEach(function (wrap) {
      bindSearchWrap(wrap);
    });
    scheduleReconcileDelayed();
  });
})(jQuery);
