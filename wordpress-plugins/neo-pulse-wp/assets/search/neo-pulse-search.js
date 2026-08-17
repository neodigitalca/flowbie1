(function () {
  'use strict';

  var DEBOUNCE_MS = 300;
  var SESSION_KEY = 'neo-pulse_search_session_id';

  document.addEventListener('DOMContentLoaded', function () {
    var wraps = document.querySelectorAll('.neo-pulse-search-wrap:not(.neo-pulse-search-wrap--panel-inner)');
    for (var i = 0; i < wraps.length; i++) {
      initSearch(wraps[i]);
    }
  });

  function initSearch(wrap) {
    if (wrap.getAttribute('data-fbs-bound') === '1') {
      return;
    }
    if (wrap.classList.contains('neo-pulse-search-wrap--panel-inner')) {
      return;
    }
    if (!wrap.getAttribute('data-rest-url')) {
      return;
    }
    wrap.setAttribute('data-fbs-bound', '1');

    var isSidebar   = wrap.getAttribute('data-sidebar-mode') === '1';
    var isIconMode  = wrap.getAttribute('data-icon-mode') === '1';
    var iconOpenAs  = wrap.getAttribute('data-icon-open-as') || '';
    var sidebarShell = null;
    var shellPanel   = null;

    if (isIconMode && iconOpenAs === 'expand_inline') {
      var iconLauncher = wrap.querySelector('.fbs__icon-launcher');
      var iconPanel = wrap.querySelector('.fbs__icon-panel--expand');
      if (iconLauncher && iconPanel) {
        iconLauncher.addEventListener('click', function () {
          var open = !wrap.classList.contains('fbs--open');
          wrap.classList.toggle('fbs--open', open);
          iconLauncher.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (open) {
            iconPanel.removeAttribute('hidden');
            var focusInput = iconPanel.querySelector('.fbs__input');
            if (focusInput) focusInput.focus();
          } else {
            iconPanel.setAttribute('hidden', '');
          }
        });
      }
    }

    var isElementorEdit = wrap.getAttribute('data-elementor-edit-preview') === '1';
    var isElementorPanelPreview = wrap.getAttribute('data-elementor-panel-preview') === '1';

    function copyWrapSurfaceVars(source, panel, backdrop) {
      if (!source) {
        return;
      }
      var computed = window.getComputedStyle(source);
      var vars = [
        '--fai-sidebar-width', '--fai-sidebar-z-index', '--fbs-panel-bg', '--fai-sidebar-bg',
        '--fbs-panel-text', '--fai-sidebar-text', '--fbs-panel-text-muted', '--fai-sidebar-text-muted',
        '--fbs-panel-offset-top', '--fbs-radius', '--fbs-modal-max-width', '--fbs-backdrop-color', '--fbs-backdrop-opacity'
      ];
      for (var i = 0; i < vars.length; i++) {
        var name = vars[i];
        var value = computed.getPropertyValue(name);
        if (!value || value.trim() === '') {
          continue;
        }
        if (panel) {
          panel.style.setProperty(name, value.trim());
        }
        if (backdrop && (name === '--fbs-backdrop-color' || name === '--fbs-backdrop-opacity')) {
          backdrop.style.setProperty(name, value.trim());
        }
      }
    }

    if (isSidebar && window.NeoPulseAiSidebarShell && !isElementorEdit) {
      var shellBackdrop = wrap.querySelector('.fai-sidebar-backdrop, .fbs-modal-backdrop');
      shellPanel = wrap.querySelector('.fai-sidebar-panel, .fbs-modal-panel');
      if (isIconMode && iconOpenAs !== 'expand_inline' && shellBackdrop && shellPanel && shellPanel.parentNode === wrap) {
        document.body.appendChild(shellBackdrop);
        document.body.appendChild(shellPanel);
        shellBackdrop.classList.add('fai-sidebar-backdrop--portaled');
        shellPanel.classList.add('fai-sidebar-panel--portaled');
        if (wrap.classList.contains('fai-sidebar-root--left')) {
          shellPanel.classList.add('fai-sidebar-panel--portaled-left');
        } else {
          shellPanel.classList.add('fai-sidebar-panel--portaled-right');
        }
        if (wrap.classList.contains('fbs-modal-root')) {
          shellPanel.classList.add('fbs-modal-panel--portaled');
          shellBackdrop.classList.add('fbs-modal-backdrop--portaled');
        }
        copyWrapSurfaceVars(wrap, shellPanel, shellBackdrop);
      }
      if (window.NeoPulseAiSidebarUnify) {
        window.NeoPulseAiSidebarUnify.tryMerge();
      }
      if (window.NeoPulseAiSidebarUnify && window.NeoPulseAiSidebarUnify.isMerged()) {
        sidebarShell = window.NeoPulseAiSidebarUnify.getShell();
      } else {
        sidebarShell = window.NeoPulseAiSidebarShell.init(wrap, {
          backdrop: shellBackdrop,
          panel: shellPanel,
          onOpen: function () {
            wrap.classList.add('neo-pulse-search-wrap--open');
          },
          onClose: function () {
            wrap.classList.remove('neo-pulse-search-wrap--open');
          }
        });
      }
    }

    var restUrl      = wrap.getAttribute('data-rest-url');
    var logUrl       = wrap.getAttribute('data-log-url') || '';
    var acceptUrl    = wrap.getAttribute('data-accept-url') || '';
    var insightsUrl  = wrap.getAttribute('data-insights-url') || '';
    var wordReadyUrl = wrap.getAttribute('data-word-ready-url') || '';
    var nonce        = wrap.getAttribute('data-nonce');
    var maxResults   = parseInt(wrap.getAttribute('data-max-results'), 10) || 8;
    var hideAi       = wrap.getAttribute('data-hide-ai-banner') === '1';
    var hideScores   = wrap.getAttribute('data-hide-scores') === '1';
    var hidePowered  = wrap.getAttribute('data-hide-powered') === '1';
    var loggingOn    = wrap.getAttribute('data-logging-enabled') === '1';
    var insightsDays = parseInt(wrap.getAttribute('data-insights-days'), 10) || 30;
    var termsLimit   = parseInt(wrap.getAttribute('data-popular-terms-limit'), 10) || 5;
    var showTerms    = wrap.getAttribute('data-show-popular-terms') === '1';
    var showOverseer = wrap.getAttribute('data-show-popular-pages-overseer') === '1';
    var showSearchPg = wrap.getAttribute('data-show-popular-pages-search') === '1';
    var panelLayout  = wrap.getAttribute('data-panel-layout') || 'compact';
    var isDiscovery  = panelLayout === 'discovery';
    var topicsLimit  = parseInt(wrap.getAttribute('data-topics-limit'), 10) || 4;
    var iconIds      = (wrap.getAttribute('data-fbs-icon-ids') || 'search').split(',');

    var searchScope = wrap;
    if (shellPanel) {
      var panelInner = shellPanel.querySelector('.neo-pulse-search-wrap--panel-inner');
      if (panelInner) {
        searchScope = panelInner;
      } else if (isIconMode && iconOpenAs !== 'expand_inline') {
        searchScope = shellPanel;
      }
    }
    var container = searchScope.querySelector('.fbs');
    var form      = searchScope.querySelector('.fbs__form');
    var input     = searchScope.querySelector('.fbs__input');
    var dropdown  = searchScope.querySelector('.fbs__dropdown');
    var statusEl  = searchScope.querySelector('.fbs__status');
    var poweredEl = searchScope.querySelector('.fbs__powered');

    if (!container || !input || !dropdown || !statusEl) {
      return;
    }

    if (hidePowered && poweredEl) {
      poweredEl.style.display = 'none';
    }

    var timer       = null;
    var controller  = null;
    var readyController = null;
    var readyRequestId = 0;
    var lastQuery   = '';
    var lastEventUid = '';
    var insightsLoaded = false;
    var resultsSlot = searchScope.querySelector('.fbs__results-slot');
    var hasResultsSlot = !!resultsSlot;
    var resultsSlotEmpty = searchScope.querySelector('.fbs__results-slot-empty');

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        doSearch();
      });
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q === '') {
        closeDropdown();
        return;
      }
      timer = setTimeout(checkWordReadyThenSearch, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (isSidebar && sidebarShell && sidebarShell.isOpen) {
          sidebarShell.close();
        } else if (isIconMode && iconOpenAs === 'expand_inline' && wrap.classList.contains('fbs--open')) {
          wrap.classList.remove('fbs--open');
          var panel = wrap.querySelector('.fbs__icon-panel--expand');
          if (panel) panel.setAttribute('hidden', '');
          var launcher = wrap.querySelector('.fbs__icon-launcher');
          if (launcher) {
            launcher.setAttribute('aria-expanded', 'false');
            launcher.focus();
          }
        } else {
          closeDropdown();
        }
        input.blur();
      }
    });

    if (!isSidebar && !(isIconMode && iconOpenAs === 'expand_inline')) {
      document.addEventListener('click', function (e) {
        if (!searchScope.contains(e.target) && !(isIconMode && wrap.querySelector('.fbs__icon-launcher') === e.target)) {
          closeDropdown();
        }
      });
    }

    if (!isElementorPanelPreview && (showTerms || showOverseer || showSearchPg || searchScope.querySelector('.fbs__insights-block--slot') || searchScope.querySelector('.fbs__insights-block[data-insight="popular_topics"]'))) {
      loadInsights();
    }

    function getSessionId() {
      try {
        var id = sessionStorage.getItem(SESSION_KEY);
        if (!id) {
          id = 'csess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          sessionStorage.setItem(SESSION_KEY, id);
        }
        return id;
      } catch (_) {
        return 'csess_' + Date.now() + '_fallback';
      }
    }

    function checkWordReadyThenSearch() {
      var q = input.value.trim();
      if (q === '' || q === lastQuery) return;
      if (!wordReadyUrl) {
        closeDropdown();
        return;
      }

      var requestId = ++readyRequestId;
      if (readyController) {
        try { readyController.abort(); } catch (_) {}
      }
      readyController = typeof AbortController !== 'undefined' ? new AbortController() : null;

      var opts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce
        },
        body: JSON.stringify({ query: q })
      };
      if (readyController) opts.signal = readyController.signal;

      fetch(wordReadyUrl, opts)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (requestId !== readyRequestId) return;
          if (input.value.trim() !== q) return;
          if (data && data.ready) {
            doSearch();
          } else {
            closeDropdown();
          }
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
        });
    }

    function doSearch() {
      var q = input.value.trim();
      if (q === '' || q === lastQuery) return;
      lastQuery = q;

      if (controller) {
        try { controller.abort(); } catch (_) {}
      }
      controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

      if (isSidebar && sidebarShell && !sidebarShell.isOpen) {
        if (window.NeoPulseAiSidebarUnify && window.NeoPulseAiSidebarUnify.isMerged()) {
          window.NeoPulseAiSidebarUnify.openTab('search');
        } else {
          sidebarShell.open();
        }
      }

      showStatus('searching');

      var opts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce
        },
        body: JSON.stringify({ query: q, per_page: maxResults })
      };
      if (controller) opts.signal = controller.signal;

      fetch(restUrl, opts)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          var results  = data && data.results ? data.results : [];
          var analysis = data && data.analysis ? data.analysis : null;
          if (results.length === 0) {
            showStatus('no-results');
            logSearch(q, 0, analysis, results);
            if (!isSidebar) closeDropdown();
            return;
          }
          renderResults(results, analysis);
          logSearch(q, results.length, analysis, results);
          hideStatus();
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          showStatus('error');
          if (!isSidebar) closeDropdown();
        });
    }

    function logSearch(query, resultCount, analysis, results) {
      if (!loggingOn || !logUrl) return;

      fetch(logUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce
        },
        body: JSON.stringify({
          session_id: getSessionId(),
          page_url: window.location.href || '',
          query: query,
          result_count: resultCount,
          intent: analysis && analysis.intent ? analysis.intent : '',
          sentiment: analysis && analysis.sentiment ? analysis.sentiment : '',
          results: results
        })
      }).then(function (res) {
        return res.json();
      }).then(function (data) {
        if (data && data.eventUid) {
          lastEventUid = data.eventUid;
        }
      }).catch(function () {});
    }

    function recordAccept(url, title, rank) {
      if (!loggingOn || !acceptUrl || !lastEventUid) return;
      fetch(acceptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce
        },
        body: JSON.stringify({
          eventUid: lastEventUid,
          url: url,
          title: title,
          rank: rank
        }),
        keepalive: true
      }).catch(function () {});
    }

    function loadInsights() {
      if (insightsLoaded || !insightsUrl) return;
      insightsLoaded = true;

      var url = insightsUrl + '?days=' + encodeURIComponent(insightsDays) + '&limit=' + encodeURIComponent(termsLimit);
      fetch(url, {
        headers: { 'X-WP-Nonce': nonce }
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (data) {
        var overseerPages = data.popularPagesOverseer || [];
        if (showTerms && data.popularTerms) {
          renderInsightBlock('popular_terms', data.popularTerms, 'term');
        }
        if (showOverseer && overseerPages.length) {
          var linkPages = overseerPages;
          if (isDiscovery && searchScope.querySelector('.fbs__insights-block[data-insight="popular_topics"]')) {
            linkPages = overseerPages.slice(topicsLimit);
          }
          if (linkPages.length) {
            renderInsightBlock('popular_pages_overseer', linkPages, 'page');
          }
        }
        if (isDiscovery && showOverseer && overseerPages.length) {
          var topicsBlock = searchScope.querySelector('.fbs__insights-block[data-insight="popular_topics"]');
          if (topicsBlock) {
            renderTopicsGrid(overseerPages.slice(0, topicsLimit), topicsBlock);
          }
        }
        if (showSearchPg && data.popularPagesFromSearch) {
          renderInsightBlock('popular_pages_search', data.popularPagesFromSearch, 'page');
        }
      }).catch(function () {});
    }

    function iconIdForIndex(index) {
      return iconIds[index % iconIds.length] || 'search';
    }

    function cloneIconSvg(iconId) {
      var sprite = wrap.querySelector('.fbs__icon-sprite[data-icon="' + iconId + '"]');
      if (!sprite) return null;
      var svg = sprite.content ? sprite.content.querySelector('svg') : sprite.querySelector('svg');
      return svg ? svg.cloneNode(true) : null;
    }

    function renderTopicsGrid(items, block) {
      if (!block || !items || !items.length) return;

      var list = block.querySelector('.fbs__insights-list');
      if (!list) return;

      list.innerHTML = '';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var tile = document.createElement('a');
        tile.className = 'fbs__topic-tile';
        tile.href = item.url;

        var iconWrap = document.createElement('span');
        iconWrap.className = 'fbs__topic-icon';
        var svg = cloneIconSvg(iconIdForIndex(i));
        if (svg) iconWrap.appendChild(svg);

        var label = document.createElement('span');
        label.className = 'fbs__topic-label';
        label.textContent = item.title || item.url;

        tile.appendChild(iconWrap);
        tile.appendChild(label);
        list.appendChild(tile);
      }

      if (!isInsightSlotBlock(block)) {
        block.removeAttribute('hidden');
      }
    }

    function isInsightSlotBlock(block) {
      return block && block.classList.contains('fbs__insights-block--slot');
    }

    function popularTermLabel(query) {
      var words = String(query || '').trim().split(/\s+/).filter(Boolean);
      var maxWords = window.matchMedia('(max-width: 782px)').matches ? 2 : 3;
      if (words.length <= maxWords) {
        return words.join(' ');
      }
      return words.slice(0, maxWords).join(' ');
    }

    function renderInsightBlock(key, items, mode) {
      var block = searchScope.querySelector('.fbs__insights-block[data-insight="' + key + '"]');
      if (!block || !items || !items.length) return;

      var list = block.querySelector('.fbs__insights-list');
      if (!list) return;

      if (mode === 'page') {
        list.classList.add('fbs__insights-list--links');
      }
      if (mode === 'term') {
        list.classList.add('fbs__insights-list--terms');
      }

      list.innerHTML = '';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (mode === 'term') {
          var chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'fbs__insight-chip';
          chip.textContent = popularTermLabel(item.query);
          if (item.query && item.query !== chip.textContent) {
            chip.title = item.query;
          }
          chip.addEventListener('click', function (term) {
            return function () {
              input.value = term;
              lastQuery = '';
              doSearch();
            };
          }(item.query));
          list.appendChild(chip);
        } else {
          var link = document.createElement('a');
          link.className = 'fbs__insight-link';
          link.href = item.url;
          link.textContent = item.title || item.url;
          list.appendChild(link);
        }
      }

      if (!isInsightSlotBlock(block)) {
        block.removeAttribute('hidden');
      }
    }

    function setSuggestionsOpen(open) {
      if (open) {
        wrap.classList.add('neo-pulse-search-wrap--open');
      } else {
        wrap.classList.remove('neo-pulse-search-wrap--open');
      }
    }

    function showSlotEmpty() {
      if (resultsSlotEmpty) {
        resultsSlotEmpty.removeAttribute('hidden');
      }
    }

    function hideSlotEmpty() {
      if (resultsSlotEmpty) {
        resultsSlotEmpty.setAttribute('hidden', '');
      }
    }

    function showSlotDropdown() {
      dropdown.removeAttribute('hidden');
      if (!hasResultsSlot) {
        dropdown.style.display = 'block';
      }
    }

    function hideSlotDropdown() {
      dropdown.setAttribute('hidden', '');
      if (!hasResultsSlot) {
        dropdown.style.display = 'none';
      }
    }

    function showSlotStatus() {
      statusEl.removeAttribute('hidden');
      if (!hasResultsSlot) {
        statusEl.style.display = 'flex';
      }
    }

    function hideSlotStatus() {
      statusEl.setAttribute('hidden', '');
      if (!hasResultsSlot) {
        statusEl.style.display = 'none';
      }
    }

    function renderResults(results, analysis) {
      hideSlotEmpty();
      hideSlotStatus();
      dropdown.innerHTML = '';
      showSlotDropdown();
      setSuggestionsOpen(true);

      if (analysis && !hideAi && (analysis.intent || (analysis.keywords && analysis.keywords.length))) {
        var banner = document.createElement('div');
        banner.className = 'fbs__ai-banner';

        var label = document.createElement('span');
        label.className = 'fbs__ai-label';
        label.textContent = 'AI';
        banner.appendChild(label);

        if (analysis.intent && analysis.intent !== 'unknown') {
          var intentTag = document.createElement('span');
          intentTag.className = 'fbs__ai-tag fbs__ai-tag--intent';
          intentTag.textContent = analysis.intent;
          banner.appendChild(intentTag);
        }

        if (analysis.sentiment && analysis.sentiment !== 'neutral') {
          var sentTag = document.createElement('span');
          sentTag.className = 'fbs__ai-tag fbs__ai-tag--sentiment' +
            (analysis.sentiment === 'negative' ? ' fbs__ai-tag--negative' : '');
          sentTag.textContent = analysis.sentiment;
          banner.appendChild(sentTag);
        }

        if (analysis.keywords && analysis.keywords.length) {
          var kw = document.createElement('span');
          kw.className = 'fbs__ai-keywords';
          kw.textContent = analysis.keywords.join(' · ');
          banner.appendChild(kw);
        }

        dropdown.appendChild(banner);
      }

      var maxScore = 0;
      for (var j = 0; j < results.length; j++) {
        if (typeof results[j].score === 'number' && results[j].score > maxScore) {
          maxScore = results[j].score;
        }
      }

      for (var i = 0; i < results.length; i++) {
        var item = results[i];
        var rank = i + 1;
        var pct = maxScore > 0 && typeof item.score === 'number'
          ? Math.round((item.score / maxScore) * 100)
          : 0;

        var a = document.createElement('a');
        a.href = item.url;
        a.className = 'fbs__result';
        a.setAttribute('role', 'option');

        a.addEventListener('click', function (url, title, r) {
          return function () {
            recordAccept(url, title, r);
          };
        }(item.url, item.title, rank));

        var row = document.createElement('div');
        row.className = 'fbs__result-row';

        var body = document.createElement('div');
        body.className = 'fbs__result-body';

        var title = document.createElement('span');
        title.className = 'fbs__result-title';
        title.textContent = item.title;

        var excerpt = document.createElement('span');
        excerpt.className = 'fbs__result-excerpt';
        excerpt.textContent = item.excerpt;

        var meta = document.createElement('span');
        meta.className = 'fbs__result-meta';
        meta.textContent = item.type_label || item.type;

        body.appendChild(title);
        body.appendChild(excerpt);
        body.appendChild(meta);

        var badge = document.createElement('div');
        badge.className = 'fbs__relevance';
        var gradeClass = pct >= 80 ? 'fbs__relevance--high'
          : pct >= 50 ? 'fbs__relevance--mid'
          : 'fbs__relevance--low';
        badge.classList.add(gradeClass);

        var ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ring.setAttribute('class', 'fbs__relevance-ring');
        ring.setAttribute('viewBox', '0 0 36 36');
        var circumference = 100;
        var dashOffset = circumference - pct;
        ring.innerHTML =
          '<circle class="fbs__relevance-track" cx="18" cy="18" r="16" />' +
          '<circle class="fbs__relevance-fill" cx="18" cy="18" r="16"' +
          ' stroke-dasharray="' + circumference + '"' +
          ' stroke-dashoffset="' + dashOffset + '" />';

        var pctLabel = document.createElement('span');
        pctLabel.className = 'fbs__relevance-pct';
        pctLabel.textContent = pct + '%';

        badge.appendChild(ring);
        badge.appendChild(pctLabel);

        row.appendChild(body);
        if (!hideScores) {
          row.appendChild(badge);
        }
        a.appendChild(row);
        dropdown.appendChild(a);
      }

      appendPoweredFooter(dropdown);
      if (!hasResultsSlot) {
        dropdown.style.display = 'block';
      }
    }

    function appendPoweredFooter(parent) {
      if (hidePowered) {
        return;
      }
      var existing = parent.querySelector('.fbs__dropdown-footer');
      if (existing) {
        existing.remove();
      }
      if (!poweredEl) {
        return;
      }
      var footer = poweredEl.cloneNode(true);
      footer.className = 'fbs__dropdown-footer';
      footer.setAttribute('href', poweredEl.href || 'https://neodigital.ca');
      footer.setAttribute('target', '_blank');
      footer.setAttribute('rel', 'noopener noreferrer');
      parent.appendChild(footer);
    }

    function closeDropdown() {
      dropdown.innerHTML = '';
      hideSlotDropdown();
      hideSlotStatus();
      lastQuery = '';
      if (hasResultsSlot) {
        showSlotEmpty();
      }
      setSuggestionsOpen(false);
    }

    function showStatus(type) {
      hideSlotEmpty();
      hideSlotDropdown();
      setSuggestionsOpen(true);
      showSlotStatus();
      if (type === 'searching') {
        statusEl.innerHTML = '<span class="fbs__spinner"></span> Searching…';
      } else if (type === 'no-results') {
        statusEl.textContent = 'No results found.';
      } else {
        statusEl.textContent = 'Search failed. Please try again.';
      }
    }

    function hideStatus() {
      hideSlotStatus();
      statusEl.textContent = '';
      if (dropdown.hasAttribute('hidden')) {
        if (!isSidebar) setSuggestionsOpen(false);
      }
    }
  }

  window.NeoPulseSearch = window.NeoPulseSearch || {};
  window.NeoPulseSearch.initWrap = function (wrap) {
    if (wrap) {
      initSearch(wrap);
    }
  };
  window.NeoPulseSearch.initAll = function (root) {
    var scope = root || document;
    var wraps = scope.querySelectorAll('.neo-pulse-search-wrap:not(.neo-pulse-search-wrap--panel-inner)');
    for (var i = 0; i < wraps.length; i++) {
      initSearch(wraps[i]);
    }
  };
})();
