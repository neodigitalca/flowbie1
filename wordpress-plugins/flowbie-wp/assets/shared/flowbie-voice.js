/**
 * Flowbie Voice — push-to-talk, transcribe, parallel ack playback.
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
    format: 'webm',
    ackPlayer: null,
    audioUnlocked: false,
    lastObjectUrl: null
  };

  // Minimal silent WAV to unlock autoplay during the user's press/click gesture.
  var SILENT_WAV =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

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

  function getAckPlayer() {
    if (!state.ackPlayer) {
      state.ackPlayer = new Audio();
      state.ackPlayer.preload = 'auto';
    }
    return state.ackPlayer;
  }

  function unlockAudioPlayback() {
    if (state.audioUnlocked) {
      return Promise.resolve();
    }
    var player = getAckPlayer();
    player.muted = true;
    player.src = SILENT_WAV;
    return player
      .play()
      .then(function () {
        player.pause();
        player.currentTime = 0;
        player.muted = false;
        player.removeAttribute('src');
        state.audioUnlocked = true;
      })
      .catch(function () {
        state.audioUnlocked = true;
      });
  }

  function safeUnlockAudio() {
    try {
      return unlockAudioPlayback();
    } catch (e) {
      return Promise.resolve();
    }
  }

  global.flowbieVoiceUnlock = unlockAudioPlayback;
  global.flowbieVoiceSafeUnlock = function () {
    if (typeof global.flowbieVoiceUnlock === 'function') {
      return global.flowbieVoiceUnlock();
    }
    return Promise.resolve();
  };
  global.flowbieVoiceSafeAckPlayback = function () {};
  global.flowbieVoiceSafePlayAck = global.flowbieVoiceSafeAckPlayback;

  function base64ToBlob(b64, mime) {
    var binary = atob(b64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime || 'audio/mpeg' });
  }

  function playBase64Audio(b64, mime) {
    if (!b64) {
      return Promise.reject(new Error('No audio'));
    }
    return safeUnlockAudio().then(function () {
      var blob = base64ToBlob(b64, mime || 'audio/mpeg');
      if (state.lastObjectUrl) {
        URL.revokeObjectURL(state.lastObjectUrl);
      }
      state.lastObjectUrl = URL.createObjectURL(blob);
      var player = getAckPlayer();
      player.src = state.lastObjectUrl;
      return player.play();
    });
  }

  var speakQueue = Promise.resolve();

  function enqueueSpeak(task) {
    speakQueue = speakQueue
      .then(function () {
        return task();
      })
      .catch(function () {});
    return speakQueue;
  }

  function waitForAudioEnd(player, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) {
          return;
        }
        done = true;
        player.removeEventListener('ended', finish);
        player.removeEventListener('error', finish);
        clearTimeout(timer);
        resolve();
      }
      var timer = setTimeout(finish, timeoutMs || 20000);
      player.addEventListener('ended', finish);
      player.addEventListener('error', finish);
      if (player.paused && player.currentTime > 0 && player.ended) {
        finish();
      }
    });
  }

  function speakAckFallback(text) {
    if (!text || !global.speechSynthesis) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      global.speechSynthesis.cancel();
      var utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1.05;
      var voices = global.speechSynthesis.getVoices();
      for (var i = 0; i < voices.length; i++) {
        if (/female|zira|samantha|google.*english.*female|karen|victoria/i.test(voices[i].name)) {
          utter.voice = voices[i];
          break;
        }
      }
      utter.onend = function () {
        resolve();
      };
      utter.onerror = function () {
        resolve();
      };
      global.speechSynthesis.speak(utter);
      setTimeout(resolve, 12000);
    });
  }

  function playAudioFromResponse(data, options) {
    options = options || {};
    var waitForEnd = options.waitForEnd !== false;
    var text = (data && (data.script || data.ack_text || data.text)) || '';
    if (data && data.audio_base64) {
      var chain = playBase64Audio(data.audio_base64, data.mime || 'audio/mpeg');
      if (waitForEnd) {
        chain = chain.then(function () {
          return waitForAudioEnd(getAckPlayer());
        });
      }
      return chain.catch(function () {
        if (text) {
          return speakAckFallback(text);
        }
      });
    }
    if (text) {
      return speakAckFallback(text);
    }
    return Promise.resolve();
  }

  function narrateCard(card, userMessage) {
    if (!cfg.narrateUrl || !card) {
      return Promise.resolve();
    }
    var payload = {
      message: userMessage || '',
      card: {
        type: card.type || 'answer',
        title: card.title || '',
        body: card.body || ''
      },
      voice_nonce: cfg.voiceNonce || ''
    };
    return enqueueSpeak(function () {
      return postJson(cfg.narrateUrl, payload).then(function (res) {
        if (!res.ok || !res.data) {
          return Promise.resolve();
        }
        return playAudioFromResponse(res.data, { waitForEnd: false });
      });
    });
  }

  function presentCard(card, userMessage, callbacks) {
    callbacks = callbacks || {};
    if (typeof callbacks.append === 'function') {
      callbacks.append();
    }
    if (typeof callbacks.finish === 'function') {
      callbacks.finish();
    }
    return narrateCard(card, userMessage);
  }

  function presentCardNarrateFirst(card, userMessage, callbacks) {
    callbacks = callbacks || {};
    return narrateCard(card, userMessage).then(function () {
      if (typeof callbacks.append === 'function') {
        callbacks.append();
      }
      if (typeof callbacks.finish === 'function') {
        callbacks.finish();
      }
    });
  }

  function playbackAck(message) {
    if (!cfg.ackUrl || !message) {
      return Promise.resolve();
    }
    return enqueueSpeak(function () {
      return postJson(cfg.ackUrl, { message: message, voice_nonce: cfg.voiceNonce || '' }).then(
        function (res) {
          if (!res.ok || !res.data) {
            return Promise.resolve();
          }
          return playAudioFromResponse(res.data);
        }
      );
    });
  }

  function speakText(text) {
    var line = String(text || '').trim();
    if (!line) {
      return Promise.resolve();
    }
    if (!cfg.speakUrl) {
      return enqueueSpeak(function () {
        return speakAckFallback(line);
      });
    }
    return enqueueSpeak(function () {
      return postJson(cfg.speakUrl, { text: line, voice_nonce: cfg.voiceNonce || '' }).then(
        function (res) {
          if (!res.ok || !res.data) {
            return speakAckFallback(line);
          }
          return playAudioFromResponse(res.data);
        }
      );
    });
  }

  function playbackAckParallel(message) {
    playbackAck(message);
  }

  var playAck = playbackAck;
  var playAckParallel = playbackAckParallel;

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
      safeUnlockAudio();
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
      if (global.speechSynthesis) {
        global.speechSynthesis.getVoices();
        global.speechSynthesis.onvoiceschanged = function () {
          global.speechSynthesis.getVoices();
        };
      }
    },
    bindPtt: bindPtt,
    playbackAck: playbackAck,
    playbackAckParallel: playbackAckParallel,
    playAck: playAck,
    playAckParallel: playAckParallel,
    narrateCard: narrateCard,
    presentCard: presentCard,
    presentCardNarrateFirst: presentCardNarrateFirst,
    speakText: speakText,
    unlockAudioPlayback: unlockAudioPlayback,
    updateSendMicVisibility: updateSendMicVisibility,
    micSvg: MIC_SVG,
    isProcessing: function () {
      return state.processing || state.recording;
    }
  };

  global.FlowbieVoice = Object.assign(global.FlowbieVoice || {}, api);
  global.flowbieVoiceUnlock = unlockAudioPlayback;

  global.flowbieVoiceSafeUnlock = function () {
    if (typeof global.flowbieVoiceUnlock === 'function') {
      return global.flowbieVoiceUnlock();
    }
    return Promise.resolve();
  };

  global.flowbieVoiceSafeAckPlayback = function (message) {
    if (typeof playbackAckParallel === 'function' && message) {
      playbackAckParallel(message);
    }
  };
  global.flowbieVoiceSafePlayAck = global.flowbieVoiceSafeAckPlayback;

  global.flowbieVoiceAckPlayback = function (message) {
    if (typeof playbackAck === 'function' && message) {
      return playbackAck(message);
    }
    return Promise.resolve();
  };
  global.flowbieVoicePlayAckAwait = global.flowbieVoiceAckPlayback;

  global.flowbieVoiceSpeak = function (text) {
    if (typeof speakText === 'function' && text) {
      return speakText(text);
    }
    return Promise.resolve();
  };

  global.flowbieVoicePresentCard = function (card, userMessage, callbacks) {
    if (typeof presentCard === 'function') {
      return presentCard(card, userMessage, callbacks);
    }
    if (callbacks && typeof callbacks.append === 'function') {
      callbacks.append();
    }
    if (callbacks && typeof callbacks.finish === 'function') {
      callbacks.finish();
    }
    return Promise.resolve();
  };
})(typeof window !== 'undefined' ? window : this);
