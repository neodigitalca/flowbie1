/**
 * Flowbie Voice — push-to-talk input and transcription only (no spoken replies).
 */
(function (global) {
  'use strict';

  var cfg = global.flowbieVoiceConfig || {};
  var state = {
    recorder: null,
    stream: null,
    chunks: [],
    recording: false,
    processing: false,
    mimeType: 'audio/webm',
    format: 'webm'
  };

  var MIC_SVG =
    '<svg class="flowbie-voice__svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>' +
    '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
    '<line x1="12" y1="19" x2="12" y2="23"/>' +
    '<line x1="8" y1="23" x2="16" y2="23"/>' +
    '</svg>';

  function pickMimeType() {
    var types = [
      { mime: 'audio/webm;codecs=opus', format: 'webm' },
      { mime: 'audio/webm', format: 'webm' },
      { mime: 'audio/ogg;codecs=opus', format: 'ogg' },
      { mime: 'audio/mp4', format: 'm4a' }
    ];
    if (!global.MediaRecorder) {
      return null;
    }
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i].mime)) {
        return types[i];
      }
    }
    return { mime: '', format: 'webm' };
  }

  function getAuthHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.nonce) {
      headers['X-WP-Nonce'] = cfg.nonce;
    }
    if (cfg.voiceNonce) {
      headers['X-Flowbie-Voice-Nonce'] = cfg.voiceNonce;
    }
    return headers;
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function () {
        var result = reader.result || '';
        var idx = String(result).indexOf(',');
        resolve(idx >= 0 ? String(result).slice(idx + 1) : String(result));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function postJson(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function stopTracks() {
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) {
        t.stop();
      });
      state.stream = null;
    }
  }

  function setRecordingUi(btn, on) {
    if (!btn) {
      return;
    }
    btn.classList.toggle('flowbie-voice--recording', on);
    var wrap = btn.closest('.flowbie-voice-ptt');
    if (wrap) {
      wrap.classList.toggle('flowbie-voice-ptt--recording', on);
    }
  }

  function startRecording(btn) {
    if (state.recording || state.processing) {
      return Promise.resolve();
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Microphone is not available in this browser.'));
    }
    var picked = pickMimeType();
    if (!picked) {
      return Promise.reject(new Error('Audio recording is not supported in this browser.'));
    }
    state.mimeType = picked.mime;
    state.format = picked.format;

    return navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        state.stream = stream;
        state.chunks = [];
        var options = picked.mime ? { mimeType: picked.mime } : undefined;
        state.recorder = new MediaRecorder(stream, options);
        state.recorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) {
            state.chunks.push(e.data);
          }
        };
        state.recorder.start();
        state.recording = true;
        setRecordingUi(btn, true);
      });
  }

  function stopRecording(btn) {
    if (!state.recording || !state.recorder) {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      state.recorder.onstop = function () {
        state.recording = false;
        setRecordingUi(btn, false);
        stopTracks();
        var blob =
          state.chunks.length > 0
            ? new Blob(state.chunks, { type: state.mimeType || 'audio/webm' })
            : null;
        state.recorder = null;
        state.chunks = [];
        resolve(blob);
      };
      try {
        state.recorder.stop();
      } catch (_) {
        state.recording = false;
        setRecordingUi(btn, false);
        stopTracks();
        resolve(null);
      }
    });
  }

  function transcribeBlob(blob) {
    if (!cfg.transcribeUrl || !blob) {
      return Promise.reject(new Error('No audio to transcribe.'));
    }
    return blobToBase64(blob).then(function (b64) {
      return postJson(cfg.transcribeUrl, {
        audio_base64: b64,
        format: state.format,
        voice_nonce: cfg.voiceNonce || ''
      });
    });
  }

  function updateSendMicVisibility(inputEl, btn) {
    if (!btn || !inputEl) {
      return;
    }
    var hasText = !!inputEl.value.trim();
    btn.classList.toggle('flowbie-voice-ptt--has-text', hasText);
    btn.setAttribute('aria-label', hasText ? 'Send message' : 'Hold to speak');
  }

  function bindPtt(btn, inputEl, options) {
    options = options || {};
    if (!btn) {
      return;
    }

    btn.classList.add('flowbie-voice-ptt');
    if (!btn.querySelector('.flowbie-voice__icon--mic')) {
      var micSpan = document.createElement('span');
      micSpan.className = 'flowbie-voice__icon flowbie-voice__icon--mic';
      micSpan.innerHTML = MIC_SVG;
      btn.insertBefore(micSpan, btn.firstChild);
    }

    if (inputEl) {
      inputEl.addEventListener('input', function () {
        updateSendMicVisibility(inputEl, btn);
      });
      updateSendMicVisibility(inputEl, btn);
    }

    function canRecord() {
      return !state.processing && !(options.isLoading && options.isLoading());
    }

    btn.addEventListener('pointerdown', function (e) {
      if (inputEl && inputEl.value.trim()) {
        return;
      }
      if (!canRecord()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      startRecording(btn).catch(function (err) {
        if (options.onError) {
          options.onError(err.message || String(err));
        }
      });
    });

    btn.addEventListener('pointerup', function (e) {
      if (inputEl && inputEl.value.trim()) {
        return;
      }
      if (!state.recording && !state.processing) {
        return;
      }
      e.preventDefault();
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (!state.recording) {
        return;
      }

      state.processing = true;
      btn.disabled = true;

      stopRecording(btn)
        .then(function (blob) {
          if (!blob || blob.size < 200) {
            throw new Error("Didn't catch that—try again.");
          }
          return transcribeBlob(blob);
        })
        .then(function (res) {
          if (!res.ok || !res.data || !res.data.text) {
            var msg =
              (res.data && res.data.error) ||
              "Didn't catch that—try again.";
            throw new Error(msg);
          }
          var text = String(res.data.text).trim();
          if (!text) {
            throw new Error("Didn't catch that—try again.");
          }
          if (options.onTranscript) {
            options.onTranscript(text);
          }
        })
        .catch(function (err) {
          if (options.onError) {
            options.onError(err.message || String(err));
          }
        })
        .finally(function () {
          state.processing = false;
          if (!(options.isLoading && options.isLoading())) {
            btn.disabled = false;
          }
        });
    });

    btn.addEventListener('pointercancel', function () {
      if (state.recording) {
        stopRecording(btn).finally(function () {
          state.processing = false;
          if (!(options.isLoading && options.isLoading())) {
            btn.disabled = false;
          }
        });
      }
    });
  }

  var api = {
    init: function (overrides) {
      if (overrides) {
        Object.keys(overrides).forEach(function (k) {
          cfg[k] = overrides[k];
        });
      }
    },
    bindPtt: bindPtt,
    updateSendMicVisibility: updateSendMicVisibility,
    micSvg: MIC_SVG,
    isProcessing: function () {
      return state.processing || state.recording;
    }
  };

  global.FlowbieVoice = Object.assign(global.FlowbieVoice || {}, api);
})(typeof window !== 'undefined' ? window : this);
