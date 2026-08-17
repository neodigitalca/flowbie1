(function () {
  'use strict';

  if (typeof neoPulseSuperMigrate === 'undefined') {
    return;
  }

  var cfg = neoPulseSuperMigrate;
  var jobId = null;
  var pollTimer = null;
  var running = false;
  var conflictsDismissed = false;
  var microRows = {};

  var elImport = document.getElementById('neo-pulse-sm-import');
  var elProgressWrap = document.getElementById('neo-pulse-sm-progress-wrap');
  var elProgressFill = document.getElementById('neo-pulse-sm-progress-fill');
  var elProgressBar = document.getElementById('neo-pulse-sm-progress-bar');
  var elStatus = document.getElementById('neo-pulse-sm-status');
  var elHudHeadline = document.getElementById('neo-pulse-sm-hud-headline');
  var elMacroRow = document.getElementById('neo-pulse-sm-macro-row');
  var elOverallPct = document.getElementById('neo-pulse-sm-overall-pct');
  var elMicroGrid = document.getElementById('neo-pulse-sm-micro-grid');
  var elConflicts = document.getElementById('neo-pulse-sm-conflicts');
  var elConflictList = document.getElementById('neo-pulse-sm-conflict-list');
  var elDeactivate = document.getElementById('neo-pulse-sm-deactivate');
  var elSkipConflicts = document.getElementById('neo-pulse-sm-skip-conflicts');
  var elRestore = document.getElementById('neo-pulse-sm-restore');
  var elRestoreList = document.getElementById('neo-pulse-sm-restore-list');
  var elRestoreBtn = document.getElementById('neo-pulse-sm-restore-btn');
  var elRestoreResult = document.getElementById('neo-pulse-sm-restore-result');
  var elConflictsResult = document.getElementById('neo-pulse-sm-conflicts-result');

  var HEADLINES = {
    idle: cfg.strings.headlineIdle || 'NEURAL SYNC STANDBY',
    running: cfg.strings.headlineRunning || '// PARALLEL UPLINK ACTIVE',
    done: cfg.strings.headlineDone || '// ALL CHANNELS MERGED',
    error: cfg.strings.headlineError || '// SYNC ABORT — SIGNAL LOST',
  };

  function api(path, options) {
    options = options || {};
    var headers = options.headers || {};
    headers['X-WP-Nonce'] = cfg.nonce;
    headers['Content-Type'] = 'application/json';
    return fetch(cfg.restBase + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (err) {
            data = {
              ok: false,
              error: text.slice(0, 240),
            };
          }
        }
        if (!data) {
          data = {
            ok: false,
            error: 'HTTP ' + res.status,
          };
        }
        if (!data.ok && !data.error && data.message) {
          data.error = data.message;
        }
        return data;
      });
    });
  }

  function setBusy(busy) {
    if (elImport) {
      elImport.disabled = !!busy;
    }
  }

  function showProgress(show) {
    if (elProgressWrap) {
      elProgressWrap.classList.toggle('is-hidden', !show);
    }
  }

  function stepKey(step, index) {
    return (step.id || 'step') + '_' + index;
  }

  function stepPercent(step) {
    if (step.status === 'done') {
      return 100;
    }
    if (step.status === 'running') {
      var total = Math.max(1, step.total || 1);
      var completed = Math.min(total, step.completed || 0);
      return Math.max(6, (completed / total) * 100);
    }
    return 0;
  }

  function jobPercent(job) {
    var micro = job.micro || [];
    if (!micro.length) {
      return 0;
    }
    var sum = 0;
    micro.forEach(function (step) {
      sum += stepPercent(step);
    });
    return sum / micro.length;
  }

  function runningCount(job) {
    var n = 0;
    (job.micro || []).forEach(function (step) {
      if (step.status === 'running') {
        n += 1;
      }
    });
    return n;
  }

  function doneCount(job) {
    var n = 0;
    (job.micro || []).forEach(function (step) {
      if (step.status === 'done') {
        n += 1;
      }
    });
    return n;
  }

  function setProgress(pct) {
    var clamped = Math.max(0, Math.min(100, pct));
    if (elProgressFill) {
      elProgressFill.style.width = clamped + '%';
    }
    if (elProgressBar) {
      elProgressBar.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }
    if (elOverallPct) {
      elOverallPct.textContent = Math.round(clamped) + '%';
    }
  }

  function setStatus(msg, tone) {
    if (!elStatus) {
      return;
    }
    elStatus.textContent = msg || '';
    elStatus.classList.remove('is-error', 'is-done');
    if (tone) {
      elStatus.classList.add('is-' + tone);
    }
  }

  function setHeadline(key) {
    if (elHudHeadline && HEADLINES[key]) {
      elHudHeadline.textContent = HEADLINES[key];
      elHudHeadline.classList.toggle('is-live', key === 'running');
    }
  }

  function rowSig(step) {
    var st = step.status || 'pending';
    if (st === 'running') {
      return cfg.strings.badgeRunning || '▶';
    }
    if (st === 'done') {
      return cfg.strings.badgeDone || '✓';
    }
    if (st === 'error') {
      return cfg.strings.badgeError || '✕';
    }
    return cfg.strings.badgeQueued || '·';
  }

  function ensureMicroRow(key, step) {
    if (microRows[key]) {
      return microRows[key];
    }
    if (!elMicroGrid) {
      return null;
    }

    var row = document.createElement('div');
    row.className = 'neo-pulse-sm-stream__row is-pending';
    row.setAttribute('role', 'listitem');
    row.dataset.stepKey = key;

    var head = document.createElement('div');
    head.className = 'neo-pulse-sm-stream__head';

    var label = document.createElement('span');
    label.className = 'neo-pulse-sm-stream__label';
    label.textContent = step.label || step.id || 'Step';

    var sig = document.createElement('span');
    sig.className = 'neo-pulse-sm-stream__sig';
    sig.setAttribute('aria-hidden', 'true');

    head.appendChild(label);
    head.appendChild(sig);

    var track = document.createElement('div');
    track.className = 'neo-pulse-sm-stream__track';
    var fill = document.createElement('span');
    fill.className = 'neo-pulse-sm-stream__fill';
    track.appendChild(fill);

    row.appendChild(head);
    row.appendChild(track);
    elMicroGrid.appendChild(row);

    microRows[key] = {
      root: row,
      fill: fill,
      sig: sig,
    };
    return microRows[key];
  }

  function renderMacroRow(job) {
    if (!elMacroRow) {
      return;
    }
    elMacroRow.innerHTML = '';
    elMacroRow.removeAttribute('aria-hidden');
    (job.macro || []).forEach(function (macro) {
      var chip = document.createElement('span');
      chip.className = 'neo-pulse-sm-hud__macro-chip';
      var total = Math.max(1, macro.total || 1);
      var completed = macro.completed || 0;
      chip.textContent = (macro.label || macro.id) + ' ' + completed + '/' + total;
      if (completed >= total) {
        chip.classList.add('is-done');
      } else if (completed > 0) {
        chip.classList.add('is-active');
      }
      elMacroRow.appendChild(chip);
    });
  }

  function renderMicroStream(job) {
    if (!elMicroGrid) {
      return;
    }
    (job.micro || []).forEach(function (step, index) {
      var key = stepKey(step, index);
      var parts = ensureMicroRow(key, step);
      if (!parts) {
        return;
      }

      var st = step.status || 'pending';
      parts.root.className = 'neo-pulse-sm-stream__row is-' + st;
      parts.sig.textContent = rowSig(step);
      parts.fill.style.width = stepPercent(step) + '%';
    });
  }

  function sublineForJob(job) {
    if (job.status === 'done') {
      return cfg.strings.done;
    }
    if (job.status === 'error') {
      return (job.errors && job.errors[0]) || cfg.strings.error;
    }
    var live = runningCount(job);
    var micro = job.micro || [];
    var done = doneCount(job);
    if (live > 0) {
      return (cfg.strings.parallelActive || '%d lanes live · %d/%d ops merged')
        .replace('%d', String(live))
        .replace('%d', String(done))
        .replace('%d', String(micro.length));
    }
    return (cfg.strings.opsQueued || '%d/%d ops armed')
      .replace('%d', String(done))
      .replace('%d', String(micro.length));
  }

  function hideConflicts() {
    if (elConflicts) {
      elConflicts.classList.add('is-hidden');
    }
  }

  function showConflictsResult(msg, isError) {
    if (!elConflictsResult) {
      return;
    }
    elConflictsResult.textContent = msg || '';
    elConflictsResult.classList.remove('is-hidden', 'is-error');
    if (isError) {
      elConflictsResult.classList.add('is-error');
    }
  }

  function refreshPageAfterDeactivate() {
    var delay = typeof cfg.strings.refreshDelayMs === 'number' ? cfg.strings.refreshDelayMs : 1200;
    var refreshMsgDelay = Math.max(0, delay - 400);
    setTimeout(function () {
      showConflictsResult(cfg.strings.refreshing || 'Refreshing page…', false);
      showRestoreResult(cfg.strings.refreshing || 'Refreshing page…', false);
    }, refreshMsgDelay);
    setTimeout(function () {
      window.location.reload();
    }, delay);
  }

  function refreshAfterRestore() {
    var delay = typeof cfg.strings.refreshDelayMs === 'number' ? cfg.strings.refreshDelayMs : 1200;
    var refreshMsgDelay = Math.max(0, delay - 400);
    setTimeout(function () {
      showRestoreResult(cfg.strings.refreshing || 'Refreshing page…', false);
    }, refreshMsgDelay);
    setTimeout(function () {
      window.location.href = cfg.pluginsUrl || window.location.href;
    }, delay);
  }

  function showRestoreResult(msg, isError) {
    if (!elRestoreResult) {
      return;
    }
    elRestoreResult.textContent = msg || '';
    elRestoreResult.classList.remove('is-hidden', 'is-error');
    if (isError) {
      elRestoreResult.classList.add('is-error');
    }
  }

  function renderRestorePlugins(plugins) {
    if (!elRestore || !elRestoreList) {
      return;
    }
    elRestoreList.innerHTML = '';
    if (!plugins || !plugins.length) {
      elRestore.classList.add('is-hidden');
      return;
    }
    plugins.forEach(function (plugin) {
      var li = document.createElement('li');
      li.className = 'neo-pulse-wp-super-migrate__restore-item';
      li.textContent = plugin.label || plugin.file || '';
      elRestoreList.appendChild(li);
    });
    elRestore.classList.remove('is-hidden');
    if (elRestoreResult) {
      elRestoreResult.classList.add('is-hidden');
      elRestoreResult.textContent = '';
    }
  }

  function restoreDeactivatedPlugins() {
    if (!elRestoreBtn) {
      return;
    }
    elRestoreBtn.disabled = true;
    showRestoreResult(cfg.strings.restoring, false);

    api('/restore-plugins', {
      method: 'POST',
      body: {},
    })
      .then(function (data) {
        if (data && data.ok) {
          var msg = cfg.strings.restored;
          if (data.warning) {
            msg = msg + ' ' + data.warning;
          }
          showRestoreResult(msg, !!data.warning);
          refreshAfterRestore();
          return;
        }
        showRestoreResult((data && data.error) || cfg.strings.restoreFailed, true);
        elRestoreBtn.disabled = false;
      })
      .catch(function (err) {
        showRestoreResult((err && err.message) || cfg.strings.restoreFailed, true);
        elRestoreBtn.disabled = false;
      });
  }

  function renderConflictPlugins(plugins) {
    if (!elConflicts || !elConflictList || conflictsDismissed) {
      return;
    }

    elConflictList.innerHTML = '';
    if (!plugins || !plugins.length) {
      hideConflicts();
      return;
    }

    plugins.forEach(function (plugin) {
      var li = document.createElement('li');
      li.className = 'neo-pulse-wp-super-migrate__conflict-item';

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'neo-pulse-sm-conflict-checkbox';
      input.value = plugin.file;
      input.checked = true;
      input.id = 'neo-pulse-sm-conflict-' + plugin.file.replace(/[^a-z0-9_-]/gi, '-');

      var label = document.createElement('label');
      label.setAttribute('for', input.id);
      label.textContent = plugin.label;

      li.appendChild(input);
      li.appendChild(label);
      elConflictList.appendChild(li);
    });

    if (elConflictsResult) {
      elConflictsResult.classList.add('is-hidden');
      elConflictsResult.textContent = '';
    }
    elConflicts.classList.remove('is-hidden');
  }

  function selectedConflictFiles() {
    if (!elConflictList) {
      return [];
    }
    var boxes = elConflictList.querySelectorAll('.neo-pulse-sm-conflict-checkbox:checked');
    var files = [];
    boxes.forEach(function (box) {
      if (box.value) {
        files.push(box.value);
      }
    });
    return files;
  }

  function deactivateSelectedConflicts() {
    if (!jobId) {
      return;
    }

    var files = selectedConflictFiles();
    if (!files.length) {
      showConflictsResult(cfg.strings.selectPluginsToDisable, true);
      return;
    }

    if (elDeactivate) {
      elDeactivate.disabled = true;
    }
    showConflictsResult(cfg.strings.deactivating, false);

    api('/deactivate-conflicts', {
      method: 'POST',
      body: {
        job_id: jobId,
        plugin_files: files,
      },
    })
      .then(function (data) {
        if (data && data.ok) {
          showConflictsResult(cfg.strings.deactivated, false);
          if (data.deactivated_files && data.deactivated_files.length) {
            var restoreRows = (data.deactivated || []).map(function (label, index) {
              return {
                file: data.deactivated_files[index] || '',
                label: label,
              };
            });
            renderRestorePlugins(restoreRows.length ? restoreRows : cfg.deactivatedPlugins || []);
          } else {
            renderRestorePlugins(cfg.deactivatedPlugins || []);
          }
          if (elConflictList) {
            elConflictList.innerHTML = '';
          }
          if (elDeactivate) {
            elDeactivate.disabled = true;
          }
          if (elSkipConflicts) {
            elSkipConflicts.style.display = 'none';
          }
          refreshPageAfterDeactivate();
          return;
        }
        showConflictsResult((data && data.error) || cfg.strings.deactivateFailed, true);
        if (elDeactivate) {
          elDeactivate.disabled = false;
        }
      })
      .catch(function () {
        showConflictsResult(cfg.strings.deactivateFailed, true);
        if (elDeactivate) {
          elDeactivate.disabled = false;
        }
      });
  }

  function renderJob(job) {
    if (!job) {
      return;
    }
    showProgress(true);
    renderMacroRow(job);
    renderMicroStream(job);
    setProgress(jobPercent(job));
    setStatus(sublineForJob(job));

    if (job.status === 'done') {
      setHeadline('done');
      setStatus(cfg.strings.done, 'done');
      setProgress(100);
      stopPolling();
      setBusy(false);
      renderConflictPlugins(job.conflict_plugins || []);
    } else if (job.status === 'error') {
      setHeadline('error');
      setStatus((job.errors && job.errors[0]) || cfg.strings.error, 'error');
      stopPolling();
      setBusy(false);
      hideConflicts();
    } else {
      setHeadline('running');
    }
  }

  function stopPolling() {
    running = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function pollStatus() {
    if (!jobId) {
      return;
    }
    api('/status/' + encodeURIComponent(jobId)).then(function (data) {
      if (!data || !data.job) {
        return;
      }
      renderJob(data.job);
      if (data.job.status === 'running' && !running) {
        runNextStep();
      }
    });
  }

  function runNextStep() {
    if (!jobId || running) {
      return;
    }
    running = true;
    api('/step', {
      method: 'POST',
      body: {
        job_id: jobId,
        parallel: true,
      },
    })
      .then(function (data) {
        running = false;
        if (data && data.job) {
          renderJob(data.job);
          if (data.job.status === 'running') {
            setTimeout(runNextStep, 0);
          }
        } else if (data && data.error) {
          setHeadline('error');
          setStatus(data.error, 'error');
          setBusy(false);
        }
      })
      .catch(function () {
        running = false;
        setHeadline('error');
        setStatus(cfg.strings.error, 'error');
        setBusy(false);
      });
  }

  function resetHud() {
    microRows = {};
    if (elMicroGrid) {
      elMicroGrid.innerHTML = '';
    }
    if (elMacroRow) {
      elMacroRow.innerHTML = '';
    }
    setHeadline('idle');
    setProgress(0);
  }

  function startImport() {
    stopPolling();
    conflictsDismissed = false;
    hideConflicts();
    resetHud();
    setBusy(true);
    showProgress(true);
    setStatus(cfg.strings.running);

    api('/start', {
      method: 'POST',
      body: {
        phases: ['crawl', 'apply'],
        dry_run: false,
      },
    }).then(function (data) {
      if (!data || !data.ok || !data.job_id) {
        setHeadline('error');
        setStatus((data && data.error) || cfg.strings.error, 'error');
        setBusy(false);
        return;
      }
      jobId = data.job_id;
      renderJob(data.job);
      runNextStep();
      pollTimer = setInterval(pollStatus, 800);
    });
  }

  if (elImport) {
    elImport.addEventListener('click', startImport);
  }

  if (elDeactivate) {
    elDeactivate.addEventListener('click', deactivateSelectedConflicts);
  }

  if (elSkipConflicts) {
    elSkipConflicts.addEventListener('click', function () {
      conflictsDismissed = true;
      hideConflicts();
    });
  }

  if (elRestoreBtn) {
    elRestoreBtn.addEventListener('click', restoreDeactivatedPlugins);
  }

  renderRestorePlugins(cfg.deactivatedPlugins || []);

  var resumeJob = cfg.resumeJobId || '';
  if (resumeJob) {
    jobId = resumeJob;
    setBusy(true);
    showProgress(true);
    api('/status/' + encodeURIComponent(resumeJob)).then(function (data) {
      if (data && data.job) {
        renderJob(data.job);
        if (data.job.status === 'running') {
          runNextStep();
          pollTimer = setInterval(pollStatus, 800);
        } else {
          setBusy(false);
        }
      }
    });
  }
})();
