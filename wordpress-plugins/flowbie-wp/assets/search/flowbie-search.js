(function () {
  'use strict';

  var DEBOUNCE_MS = 300;

  document.addEventListener('DOMContentLoaded', function () {
    var wraps = document.querySelectorAll('.flowbie-search-wrap');
    for (var i = 0; i < wraps.length; i++) {
      initSearch(wraps[i]);
    }
  });

  function initSearch(wrap) {
    if (wrap.getAttribute('data-fbs-bound') === '1') {
      return;
    }
    wrap.setAttribute('data-fbs-bound', '1');

    var restUrl     = wrap.getAttribute('data-rest-url');
    var nonce       = wrap.getAttribute('data-nonce');
    var maxResults  = parseInt(wrap.getAttribute('data-max-results'), 10) || 8;
    var minQuery    = parseInt(wrap.getAttribute('data-min-query'), 10) || 2;
    var hideAi      = wrap.getAttribute('data-hide-ai-banner') === '1';
    var hideScores  = wrap.getAttribute('data-hide-scores') === '1';
    var hidePowered = wrap.getAttribute('data-hide-powered') === '1';

    var container = wrap.querySelector('.fbs');
    var form      = wrap.querySelector('.fbs__form');
    var input     = wrap.querySelector('.fbs__input');
    var dropdown  = wrap.querySelector('.fbs__dropdown');
    var statusEl  = wrap.querySelector('.fbs__status');
    var poweredEl = wrap.querySelector('.fbs__powered');

    if (!container || !form || !input || !dropdown || !statusEl) {
      return;
    }

    if (hidePowered && poweredEl) {
      poweredEl.style.display = 'none';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      doSearch();
    });

    var timer      = null;
    var controller = null;
    var lastQuery  = '';

    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < minQuery) {
        closeDropdown();
        return;
      }
      timer = setTimeout(doSearch, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeDropdown();
        input.blur();
      }
    });

    document.addEventListener('click', function (e) {
      if (!container.contains(e.target)) {
        closeDropdown();
      }
    });

    function doSearch() {
      var q = input.value.trim();
      if (q.length < minQuery || q === lastQuery) return;
      lastQuery = q;

      if (controller) {
        try { controller.abort(); } catch (_) {}
      }
      controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

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
            closeDropdown();
            return;
          }
          renderResults(results, analysis);
          hideStatus();
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          showStatus('error');
          closeDropdown();
        });
    }

    function setSuggestionsOpen(open) {
      if (open) {
        wrap.classList.add('flowbie-search-wrap--open');
      } else {
        wrap.classList.remove('flowbie-search-wrap--open');
      }
    }

    function renderResults(results, analysis) {
      dropdown.innerHTML = '';
      dropdown.removeAttribute('hidden');
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
        var pct = maxScore > 0 && typeof item.score === 'number'
          ? Math.round((item.score / maxScore) * 100)
          : 0;

        var a = document.createElement('a');
        a.href = item.url;
        a.className = 'fbs__result';
        a.setAttribute('role', 'option');

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
      dropdown.style.display = 'block';
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
      footer.setAttribute('href', poweredEl.href || 'https://flowbie.ca');
      footer.setAttribute('target', '_blank');
      footer.setAttribute('rel', 'noopener noreferrer');
      parent.appendChild(footer);
    }

    function closeDropdown() {
      dropdown.style.display = 'none';
      dropdown.setAttribute('hidden', '');
      dropdown.innerHTML = '';
      lastQuery = '';
      setSuggestionsOpen(false);
    }

    function showStatus(type) {
      setSuggestionsOpen(true);
      statusEl.style.display = 'flex';
      dropdown.style.display = 'none';
      dropdown.setAttribute('hidden', '');
      if (type === 'searching') {
        statusEl.innerHTML = '<span class="fbs__spinner"></span> Searching…';
      } else if (type === 'no-results') {
        statusEl.textContent = 'No results found.';
      } else {
        statusEl.textContent = 'Search failed. Please try again.';
      }
    }

    function hideStatus() {
      statusEl.style.display = 'none';
      statusEl.textContent = '';
      if (dropdown.style.display === 'none' || dropdown.hasAttribute('hidden')) {
        setSuggestionsOpen(false);
      }
    }
  }
})();
