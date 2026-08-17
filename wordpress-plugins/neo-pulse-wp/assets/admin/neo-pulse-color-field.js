/**
 * NEO Pulse design colors — native color input + hex sync, Elementor swatches.
 */
(function ($) {
  'use strict';

  var KIT_BRAND_MAP = {
    primary: [
      'accent', 'button_bg', 'launcher_bg', 'send_bg', 'mic_idle',
      'focus_ring', 'link', 'user_bubble_bg', 'icon_color', 'powered_icon'
    ],
    secondary: [
      'bg_elevated', 'header_bg', 'assistant_bubble_bg', 'result_hover'
    ],
    accent: ['highlight', 'thinking_border'],
    text: ['text', 'assistant_bubble_text', 'input_text', 'powered_text']
  };

  function normalizeHex(value) {
    if (!value) return '';
    var v = String(value).trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      return v.toLowerCase();
    }
    if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
      return (
        '#' +
        v[1] + v[1] +
        v[2] + v[2] +
        v[3] + v[3]
      ).toLowerCase();
    }
    return '';
  }

  function setRowColor($row, color) {
    var hex = normalizeHex(color);
    if (!hex) return;
    $row.find('.neo-pulse-design-color-row__pick').val(hex);
    $row.find('.neo-pulse-design-color-row__hex').val(hex);
  }

  function bindRow($row) {
    var $pick = $row.find('.neo-pulse-design-color-row__pick');
    var $hex = $row.find('.neo-pulse-design-color-row__hex');

    $pick.on('input change', function () {
      $hex.val($pick.val()).trigger('change');
      $(document).trigger('neo-pulse-design-color-change');
    });

    $hex.on('input change', function () {
      var normalized = normalizeHex($hex.val());
      if (normalized) {
        $pick.val(normalized);
        if ($hex.val() !== normalized) {
          $hex.val(normalized);
        }
      }
      $(document).trigger('neo-pulse-design-color-change');
    });

    $hex.on('focusin', function () {
      $row.addClass('is-focused');
    });

    $hex.on('focusout', function () {
      $row.removeClass('is-focused');
    });
  }

  function setTokenColor($root, token, color) {
    var $row = $root.find('.neo-pulse-design-color-row[data-token="' + token + '"]');
    if (!$row.length) return;
    setRowColor($row, color);
    $(document).trigger('neo-pulse-design-color-change');
  }

  function applyKitToBrand($root) {
    $root.find('.neo-pulse-elementor-swatch').each(function () {
      var kitId = String($(this).data('kit-id') || '');
      var color = $(this).data('color');
      if (!color || !KIT_BRAND_MAP[kitId]) return;
      KIT_BRAND_MAP[kitId].forEach(function (token) {
        setTokenColor($root, token, color);
      });
    });
  }

  function targetRow($root) {
    var $focused = $root.find('.neo-pulse-design-color-row.is-focused').first();
    if ($focused.length) return $focused;
    return $root.find('.neo-pulse-design-color-row').first();
  }

  function bindSwatches(root) {
    var $root = $(root);
    $root.find('.neo-pulse-elementor-swatch').on('click', function (e) {
      e.preventDefault();
      var color = $(this).data('color');
      if (!color) return;
      setRowColor(targetRow($root), color);
      $(document).trigger('neo-pulse-design-color-change');
    });

    $root.find('[data-neo-pulse-apply-kit]').on('click', function (e) {
      e.preventDefault();
      applyKitToBrand($root);
    });
  }

  function initRoot(root) {
    var $root = $(root);
    $root.find('.neo-pulse-design-color-row').each(function () {
      bindRow($(this));
    });
    bindSwatches(root);

    $root.find('[data-neo-pulse-color-source]').on('change', function () {
      var src = $root.find('[data-neo-pulse-color-source]:checked').val();
      $root.toggleClass('neo-pulse-design--site-branding', src === 'site_branding');
      $root.toggleClass('neo-pulse-design--custom', src === 'custom');
      $(document).trigger('neo-pulse-design-color-change');
    });

    $root.find('[data-neo-pulse-style-scope]').on('change', function () {
      var scope = $root.find('[data-neo-pulse-style-scope]:checked').val();
      $root.find('.neo-pulse-design-apply-both').prop('hidden', scope !== 'individual');
    });
  }

  $(function () {
    $('.neo-pulse-ai-widget-design').each(function () {
      initRoot(this);
    });
  });
})(jQuery);
