/**
 * Live preview: sync design form tokens + show/hide to Search/Chat demos.
 */
(function ($) {
  'use strict';

  var CHAT_MAP = {
    bg: '--fcw-bg',
    bg_elevated: '--fcw-bg-elevated',
    card_bg: '--fcw-card-bg',
    input_bg: '--fcw-input-bg',
    header_bg: '--fcw-header-bg',
    launcher_bg: '--fcw-launcher-bg',
    text: '--fcw-text',
    text_secondary: '--fcw-text-secondary',
    text_muted: '--fcw-text-muted',
    input_text: '--fcw-input-text',
    link: '--fcw-link',
    placeholder: '--fcw-placeholder',
    border: '--fcw-border',
    border_hover: '--fcw-border-hover',
    form_border: '--fcw-form-border',
    button_border: '--fcw-button-border',
    focus_ring: '--fcw-focus-ring',
    accent: '--fcw-accent',
    accent_text: '--fcw-accent-text',
    highlight: '--fcw-highlight',
    button_bg: '--fcw-button-bg',
    button_text: '--fcw-button-text',
    button_hover: '--fcw-button-hover',
    icon_color: '--fcw-icon',
    user_bubble_bg: '--fcw-user-bubble-bg',
    user_bubble_text: '--fcw-user-bubble-text',
    assistant_bubble_bg: '--fcw-assistant-bubble-bg',
    assistant_bubble_text: '--fcw-assistant-bubble-text',
    thinking_border: '--fcw-thinking-border',
    mic_idle: '--fcw-mic-idle',
    mic_recording: '--fcw-mic-recording',
    send_bg: '--fcw-send-bg',
    powered_text: '--fcw-powered',
    powered_icon: '--fcw-powered-icon',
    shadow: '--fcw-shadow'
  };

  var SEARCH_MAP = {
    accent: '--fbs-primary',
    bg: '--fbs-bg',
    text: '--fbs-text',
    text_muted: '--fbs-text-muted',
    text_secondary: '--fbs-text-secondary',
    input_text: '--fbs-input-text',
    border: '--fbs-border',
    form_border: '--fbs-form-border',
    button_border: '--fbs-button-border',
    icon_color: '--fbs-icon',
    powered_text: '--fbs-powered',
    powered_icon: '--fbs-powered-icon',
    result_hover: '--fbs-hover',
    dropdown_bg: '--fbs-dropdown-bg',
    input_bg: '--fbs-input-bg',
    placeholder: '--fbs-placeholder',
    button_bg: '--fbs-button-bg',
    button_text: '--fbs-button-text',
    button_hover: '--fbs-button-hover',
    focus_ring: '--fbs-focus-ring',
    link: '--fbs-link',
    score_color: '--fbs-score',
    banner_bg: '--fbs-banner-bg',
    banner_text: '--fbs-banner-text',
    shadow: '--fbs-shadow'
  };

  var SEARCH_UI_CLASS = {
    search_icon: 'fbs--no-icon',
    submit_button: 'fbs--no-submit',
    clear_button: 'fbs--no-clear',
    powered_by: 'fbs--no-powered',
    dropdown_shadow: 'fbs--no-shadow',
    empty_state: 'fbs--no-empty'
  };

  var SEARCH_UI_ATTR = {
    ai_banner: 'data-hide-ai-banner',
    relevance_scores: 'data-hide-scores',
    powered_by: 'data-hide-powered',
    clear_button: 'data-hide-clear'
  };

  var CHAT_UI_CLASS = {
    header: 'fcw-hide-header',
    avatar: 'fcw-hide-avatar',
    assistant_name: 'fcw-hide-assistant-name',
    close_button: 'fcw-hide-close-button',
    welcome_message: 'fcw-hide-welcome-message',
    thinking_card: 'fcw-hide-thinking-card',
    source_pills: 'fcw-hide-source-pills',
    cta_buttons: 'fcw-hide-cta-buttons',
    suggestion_chips: 'fcw-hide-suggestion-chips',
    confidence: 'fcw-hide-confidence',
    type_badge: 'fcw-hide-type-badge',
    powered_by: 'fcw-hide-powered-by',
    send_button: 'fcw-hide-send-button',
    mic_button: 'fcw-hide-mic-button',
    voice_toast: 'fcw-hide-voice-toast'
  };

  var SHAPE_KEYS = {
    radius: true,
    font_size: true,
    launcher_size: true,
    panel_width: true,
    offset_x: true,
    offset_y: true
  };

  function collectTokens($root) {
    var tokens = {};
    var source = $root.find('[data-neo-pulse-color-source]:checked').val() || 'site_branding';
    var widget = $root.data('neo-pulse-design-widget') || 'search';
    var resolved = (typeof neoPulseDesignPreview !== 'undefined' && neoPulseDesignPreview)
      ? (widget === 'chat' ? neoPulseDesignPreview.chatTokens : neoPulseDesignPreview.searchTokens)
      : null;

    if (source === 'site_branding' && resolved) {
      tokens = $.extend({}, resolved);
    }

    $root.find('[name^="neo-pulse_design[tokens]"]').each(function () {
      var name = this.name;
      var m = name.match(/neo-pulse_design\[tokens\]\[([^\]]+)\]/);
      if (!m) return;
      if (source === 'custom' || SHAPE_KEYS[m[1]]) {
        tokens[m[1]] = $(this).val();
      }
    });
    return tokens;
  }

  function collectUi($root) {
    var ui = {};
    $root.find('[name^="neo-pulse_design[ui]"]').each(function () {
      var name = this.name;
      var m = name.match(/neo-pulse_design\[ui\]\[([^\]]+)\]/);
      if (!m) return;
      ui[m[1]] = this.type === 'checkbox' ? this.checked : !!$(this).val();
    });
    return ui;
  }

  function collectSidebar($root) {
    var sidebar = {};
    $root.find('[name^="neo-pulse_design[sidebar]"]').each(function () {
      var name = this.name;
      var m = name.match(/neo-pulse_design\[sidebar\]\[([^\]]+)\]/);
      if (!m) return;
      if (m[1] === 'sidebar_layout') return;
      sidebar[m[1]] = $(this).val();
    });
    return sidebar;
  }

  function applySidebar(el, sidebar) {
    if (!el || !sidebar) return;
    var isChat = el.classList.contains('neo-pulse-chat-widget')
      || el.classList.contains('neo-pulse-chat-design-preview')
      || el.id === 'neo-pulse-chat-widget-root';
    el.classList.remove(
      'fai-sidebar-root--left',
      'fai-sidebar-root--right',
      'fai-sidebar-root--transition-slide',
      'fai-sidebar-root--transition-fade',
      'fai-sidebar-root--transition-none',
      'neo-pulse-search-wrap--sidebar-mode'
    );
    if (isChat || sidebar.display_mode === 'sidebar') {
      if (!isChat) {
        el.classList.add('neo-pulse-search-wrap--sidebar-mode');
      }
      el.classList.add('fai-sidebar-root');
      el.classList.add('fai-sidebar-root--' + (sidebar.sidebar_side === 'left' ? 'left' : 'right'));
      el.classList.add('fai-sidebar-root--transition-' + (sidebar.sidebar_transition || 'slide'));
    }
    if (sidebar.sidebar_width) {
      el.style.setProperty('--fai-sidebar-width', sidebar.sidebar_width + 'px');
    }
    var heading = el.querySelector('.fbs__heading, .fcw-sidebar-heading');
    if (heading && sidebar.sidebar_heading !== undefined) {
      heading.textContent = sidebar.sidebar_heading;
    }
  }

  function applyVars(el, map, tokens) {
    if (!el) return;
    Object.keys(map).forEach(function (key) {
      if (tokens[key]) {
        el.style.setProperty(map[key], tokens[key]);
      }
    });
    if (tokens.radius) {
      el.style.setProperty('--fcw-radius', tokens.radius + 'px');
      el.style.setProperty('--fbs-radius', tokens.radius + 'px');
      el.style.setProperty('--fbs-dropdown-radius', tokens.radius + 'px');
    }
    if (tokens.font_size) {
      el.style.setProperty('--fcw-font-size', tokens.font_size + 'px');
      el.style.setProperty('--fbs-font-size', tokens.font_size + 'px');
    }
    if (tokens.launcher_size) {
      el.style.setProperty('--fcw-bubble-size', tokens.launcher_size + 'px');
    }
    if (tokens.panel_width) {
      el.style.setProperty('--fcw-panel-width', tokens.panel_width + 'px');
    }
  }

  function applySearchUi(el, ui) {
    if (!el) return;
    Object.keys(SEARCH_UI_CLASS).forEach(function (key) {
      var cls = SEARCH_UI_CLASS[key];
      var on = ui[key] === undefined ? true : !!ui[key];
      el.classList.toggle(cls, !on);
    });
    Object.keys(SEARCH_UI_ATTR).forEach(function (key) {
      var attr = SEARCH_UI_ATTR[key];
      var on = ui[key] === undefined ? true : !!ui[key];
      if (on) {
        el.removeAttribute(attr);
      } else {
        el.setAttribute(attr, '1');
      }
    });
  }

  function applyChatUi(el, ui) {
    if (!el) return;
    Object.keys(CHAT_UI_CLASS).forEach(function (key) {
      var cls = CHAT_UI_CLASS[key];
      var on = ui[key] === undefined ? true : !!ui[key];
      el.classList.toggle(cls, !on);
    });
  }

  function refresh() {
    var $root = $('.neo-pulse-ai-widget-design').first();
    if (!$root.length) return;
    var tokens = collectTokens($root);
    var ui = collectUi($root);
    var sidebar = collectSidebar($root);
    var chatDemo = document.querySelector(
      '.neo-pulse-chat-design-preview, #neo-pulse-chat-widget-root, .neo-pulse-chat-widget, .fcwd'
    );
    var searchDemo = document.querySelector('.neo-pulse-wp-search-demo .neo-pulse-search-wrap');
    if (!searchDemo) {
      searchDemo = document.querySelector('.neo-pulse-search-wrap');
    }
    if (searchDemo) {
      applyVars(searchDemo, SEARCH_MAP, tokens);
      applySearchUi(searchDemo, ui);
      applySidebar(searchDemo, sidebar);
    }
    if (chatDemo) {
      applyVars(chatDemo, CHAT_MAP, tokens);
      applyChatUi(chatDemo, ui);
      applySidebar(chatDemo, sidebar);
    }
  }

  $(document).on('neo-pulse-design-color-change', refresh);
  $(document).on('input change', '.neo-pulse-ai-widget-design', refresh);
  $(function () {
    refresh();
  });
})(jQuery);
