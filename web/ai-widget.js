/**
 * AI Voice Widget — Drop-in voice assistant for any webpage.
 *
 * Usage:
 *   <script src="ai-widget.js"></script>
 *   <script>
 *     AIWidget.init({ server: 'ws://localhost:8000' });
 *   </script>
 *
 * Options:
 *   server    — WebSocket server URL (required)
 *   assistant — Preset name defined on the server (default: 'receptionist')
 *   mode      — 'standard' | 'realtime' (default: 'standard')
 *   title     — Widget title (default: 'AI Receptionist')
 *   subtitle  — Idle text (default: 'Talk to AI Receptionist')
 *   position  — 'bottom-right' | 'bottom-left' (default: 'bottom-right')
 *   style     — Object of CSS variable overrides (see CSS Variables below)
 *
 * CSS Variables (override via style option or your own CSS on .aiw-wrap):
 *   --aiw-width          Widget pill width           (default: 250px)
 *   --aiw-radius         Pill border radius          (default: 60px)
 *   --aiw-padding        Pill padding                (default: 4px 14px 4px 8px)
 *   --aiw-gap            Gap between orb and text    (default: 14px)
 *   --aiw-bottom         Distance from bottom        (default: 24px)
 *   --aiw-side           Distance from left/right    (default: 24px)
 *   --aiw-bg             Pill background             (default: linear-gradient(...))
 *   --aiw-border         Pill border color           (default: rgba(200,140,60,.2))
 *   --aiw-shadow         Pill box shadow             (default: 0 4px 30px ...)
 *   --aiw-height         Pill/circle height          (default: calc(52px + 8px))
 *   --aiw-collapsed-size Collapsed button diameter   (default: var(--aiw-height))
 *   --aiw-orb-size       Orb diameter                (default: 52px)
 *   --aiw-orb-idle       Orb idle background         (default: linear-gradient(...))
 *   --aiw-orb-listen     Orb listening background    (default: linear-gradient(...))
 *   --aiw-orb-think      Orb thinking background     (default: same as idle)
 *   --aiw-orb-speak      Orb speaking background     (default: same as idle)
 *   --aiw-title-size     Title font size             (default: .95rem)
 *   --aiw-title-color    Title color                 (default: #fff)
 *   --aiw-status-size    Status font size            (default: .82rem)
 *   --aiw-color-idle     Idle status text color      (default: #e88c14)
 *   --aiw-color-listen   Listening status text color (default: #4ade80)
 *   --aiw-font           Font family                 (default: system fonts)
 *   --aiw-zindex         z-index                     (default: 9999)
 */
(function(global) {
  'use strict';

  // ====== CSS with custom properties ======
  var CSS = '\
.aiw-wrap{\
position:fixed;\
bottom:var(--aiw-bottom,24px);\
z-index:var(--aiw-zindex,9999);\
display:flex;flex-direction:column;align-items:flex-end;\
font-family:var(--aiw-font,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}\
.aiw-wrap.aiw-left{left:var(--aiw-side,24px);align-items:flex-start}\
.aiw-wrap.aiw-right{right:var(--aiw-side,24px)}\
.aiw-pill{\
background:var(--aiw-bg,linear-gradient(135deg,#2a1a08 0%,#1a1008 50%,#221408 100%));\
border:1px solid var(--aiw-border,rgba(200,140,60,.2));\
border-radius:var(--aiw-radius,60px);\
padding:var(--aiw-padding,4px 14px 4px 8px);\
min-height:var(--aiw-height,calc(var(--aiw-orb-size,52px) + 8px));\
display:flex;align-items:center;\
gap:var(--aiw-gap,14px);\
box-shadow:var(--aiw-shadow,0 4px 30px rgba(0,0,0,.5),0 0 60px rgba(200,120,0,.06));\
cursor:default;\
transition:width .3s ease,border-radius .3s ease,padding .3s ease,background .3s ease,border-color .3s ease,box-shadow .3s ease}\
.aiw-pill.aiw-collapsed{\
width:var(--aiw-collapsed-size,var(--aiw-height,calc(var(--aiw-orb-size,52px) + 8px)));height:var(--aiw-collapsed-size,var(--aiw-height,calc(var(--aiw-orb-size,52px) + 8px)));\
border-radius:50%;padding:0;\
background:transparent;\
border:none;\
box-shadow:none;\
justify-content:center;position:relative}\
.aiw-pill.aiw-expanded{\
width:var(--aiw-width,250px)}\
.aiw-orb{\
width:var(--aiw-orb-size,52px);height:var(--aiw-orb-size,52px);\
border-radius:50%;border:none;cursor:pointer;flex-shrink:0;\
display:flex;align-items:center;justify-content:center;\
transition:transform .15s;position:relative}\
.aiw-orb:hover{transform:scale(1.06)}.aiw-orb:active{transform:scale(.97)}\
.aiw-orb::before{content:"";position:absolute;inset:-4px;border-radius:50%;z-index:0}\
.aiw-pill.aiw-collapsed .aiw-orb:not(.active){\
width:100%;height:100%;\
background:radial-gradient(circle at 50% 38%,#3b2108 0%,#1a0e00 62%,#0b0500 100%) !important;\
border:4px solid rgba(255,140,20,.95);\
box-shadow:0 0 28px rgba(255,140,20,.18),0 0 60px rgba(255,140,20,.10)}\
.aiw-pill.aiw-collapsed .aiw-orb::before{\
content:"";position:absolute;inset:0;border-radius:50%;z-index:0;\
background:radial-gradient(circle at 50% 35%,rgba(255,140,20,.14) 0%,transparent 62%)}\
.aiw-pill.aiw-collapsed .aiw-orb.active{\
width:100%;height:100%;\
background:radial-gradient(circle at 50% 35%,#ef4444 0%,#b91c1c 55%,#7f1d1d 100%) !important;\
border:none;\
box-shadow:0 0 0 10px rgba(220,38,38,.18),0 0 34px rgba(220,38,38,.22),0 0 70px rgba(220,38,38,.14)}\
.aiw-pill.aiw-collapsed .aiw-ic svg{fill:rgba(255,140,20,.95);width:32px;height:32px}\
.aiw-orb.idle{\
background:var(--aiw-orb-idle,linear-gradient(145deg,#e88c14,#c06a08));\
box-shadow:0 0 20px rgba(230,140,20,.3)}\
.aiw-orb.idle::before{background:radial-gradient(circle,rgba(230,140,20,.25) 0%,transparent 70%)}\
.aiw-orb.active{\
background:var(--aiw-orb-listen,linear-gradient(145deg,#dc2626,#991b1b));\
box-shadow:0 0 25px rgba(220,38,38,.35);animation:aiw-pr 1.2s ease-in-out infinite}\
.aiw-orb.active::before{background:radial-gradient(circle,rgba(220,38,38,.2) 0%,transparent 70%)}\
.aiw-orb.listening{\
background:var(--aiw-orb-listen,linear-gradient(145deg,#dc2626,#991b1b));\
box-shadow:0 0 25px rgba(220,38,38,.35);animation:aiw-pr 1.2s ease-in-out infinite}\
.aiw-orb.listening::before{background:radial-gradient(circle,rgba(220,38,38,.2) 0%,transparent 70%)}\
@keyframes aiw-pr{0%,100%{box-shadow:0 0 20px rgba(220,38,38,.3)}50%{box-shadow:0 0 35px rgba(220,38,38,.5)}}\
.aiw-orb.thinking{\
background:var(--aiw-orb-think,var(--aiw-orb-idle,linear-gradient(145deg,#e88c14,#c06a08)));\
box-shadow:0 0 20px rgba(230,140,20,.3)}\
.aiw-orb.speaking{\
background:var(--aiw-orb-speak,var(--aiw-orb-idle,linear-gradient(145deg,#e88c14,#c06a08)));\
animation:aiw-po 1.5s ease-in-out infinite}\
@keyframes aiw-po{0%,100%{box-shadow:0 0 15px rgba(230,140,20,.25)}50%{box-shadow:0 0 35px rgba(230,140,20,.5)}}\
.aiw-ic{position:relative;z-index:1;display:flex;align-items:center;justify-content:center}\
.aiw-ic svg{fill:#fff;width:20px;height:20px}\
.aiw-ic-stop{width:18px;height:18px;background:#fff;border-radius:4px}\
.aiw-ic-spin{width:22px;height:22px;border:2.5px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:aiw-sp .8s linear infinite}\
@keyframes aiw-sp{to{transform:rotate(360deg)}}\
.aiw-ic-wave{display:flex;align-items:center;gap:2px;height:20px}\
.aiw-ic-wave span{display:block;width:3px;background:#fff;border-radius:2px;animation:aiw-wv .8s ease-in-out infinite}\
.aiw-ic-wave span:nth-child(1){height:8px;animation-delay:0s}\
.aiw-ic-wave span:nth-child(2){height:16px;animation-delay:.15s}\
.aiw-ic-wave span:nth-child(3){height:12px;animation-delay:.3s}\
.aiw-ic-wave span:nth-child(4){height:16px;animation-delay:.45s}\
.aiw-ic-wave span:nth-child(5){height:8px;animation-delay:.6s}\
@keyframes aiw-wv{0%,100%{transform:scaleY(.5)}50%{transform:scaleY(1)}}\
.aiw-txt{flex:1;min-width:0;overflow:hidden;\
transition:opacity .2s ease}\
.aiw-pill.aiw-collapsed .aiw-txt{display:none}\
.aiw-pill.aiw-collapsed .aiw-chev{display:none}\
.aiw-title{font-size:var(--aiw-title-size,.95rem);font-weight:600;color:var(--aiw-title-color,#fff);line-height:1.2}\
.aiw-status{font-size:var(--aiw-status-size,.82rem);margin-top:2px;line-height:1.2;display:flex;align-items:center;gap:6px}\
.aiw-status.s-idle{color:var(--aiw-color-idle,#e88c14)}\
.aiw-status.s-listen{color:var(--aiw-color-listen,#4ade80)}\
.aiw-status.s-think,.aiw-status.s-speak{color:var(--aiw-color-idle,#e88c14)}\
.aiw-dot{width:7px;height:7px;background:var(--aiw-color-listen,#4ade80);border-radius:50%;flex-shrink:0}\
.aiw-chev{width:36px;height:36px;border-radius:50%;background:#2a2a2a;border:1px solid #444;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .15s}\
.aiw-chev:hover{background:#3a3a3a}.aiw-chev svg{fill:#999;width:14px;height:14px}\
.aiw-chev.aiw-x svg{transform:rotate(180deg)}\
@media(max-width:768px){\
.aiw-pill.aiw-expanded{width:calc(100vw - 48px);max-width:320px}\
.aiw-wrap{--aiw-bottom:16px;--aiw-side:16px}\
}\
@media(max-width:480px){\
.aiw-pill.aiw-expanded{width:calc(100vw - 32px);max-width:none;border-radius:50px}\
.aiw-wrap{--aiw-bottom:12px;--aiw-side:12px}\
.aiw-title{font-size:.88rem}\
.aiw-status{font-size:.78rem}\
.aiw-chev{width:32px;height:32px}\
}\
@media(max-width:360px){\
.aiw-pill.aiw-expanded{width:calc(100vw - 24px)}\
.aiw-wrap{--aiw-bottom:10px;--aiw-side:10px;--aiw-orb-size:44px;--aiw-padding:4px 10px 4px 6px;--aiw-gap:10px}\
.aiw-title{font-size:.82rem}\
.aiw-status{font-size:.72rem}\
}\
@media(max-height:500px) and (orientation:landscape){\
.aiw-wrap{--aiw-bottom:8px;--aiw-side:12px;--aiw-orb-size:40px}\
.aiw-pill.aiw-expanded{width:auto;min-width:220px;max-width:280px}\
.aiw-title{font-size:.82rem}\
.aiw-status{font-size:.72rem}\
}';

  // ====== HTML templates ======
  var MIC_SVG = '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
  var STOP_HTML = '<div class="aiw-ic-stop"></div>';
  var SPIN_HTML = '<div class="aiw-ic-spin"></div>';
  var WAVE_HTML = '<div class="aiw-ic-wave"><span></span><span></span><span></span><span></span><span></span></div>';
  var CHEV_SVG = '<svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';

  // ====== Audio constants ======
  var SR = 24000, CS = 1024;
  var VAD_TH = 0.045, VAD_SIL = 800, VAD_PRE = 200;
  var RDY = 'RDY', EOS = 'EOS', INT = 'INT', CLR = 'CLR';
  var SPEECH_STARTED = 'SPEECH_STARTED', SPEECH_STOPPED = 'SPEECH_STOPPED';

  function isRealtime() { return opts && opts.mode === 'realtime'; }

  // ====== Widget state ======
  var opts, wrap, orbBtn, iconEl, statusEl, chevBtn;
  var ws = null, rec = false;
  var userCollapsed = true;
  var micStr = null, micCtx = null, micProc = null;
  var vadOn = false, spk = false, silStart = null, preBuf = [];
  var pbCtx = null, pbNode = null, pbSamples = [];
  var lastSil = true, lastEOS = null;

  function rms(b) { var s = 0; for (var i = 0; i < b.length; i++) s += b[i]*b[i]; return Math.sqrt(s/b.length); }

  var pillEl;
  function applyLayout() {
    if (!pillEl) return;
    if (userCollapsed) {
      pillEl.classList.remove('aiw-expanded');
      pillEl.classList.add('aiw-collapsed');
    } else {
      pillEl.classList.remove('aiw-collapsed');
      pillEl.classList.add('aiw-expanded');
    }
  }
  function setState(s) {
    var active = !!(s && s !== '');
    orbBtn.className = 'aiw-orb ' + (active ? 'active' : 'idle');
    if (s === 'connecting') {
      iconEl.innerHTML = STOP_HTML;
      statusEl.className = 'aiw-status s-think';
      statusEl.textContent = 'Connecting...';
    } else if (s === 'listening') {
      iconEl.innerHTML = STOP_HTML;
      statusEl.className = 'aiw-status s-listen';
      statusEl.innerHTML = '<span class="aiw-dot"></span> Listening... speak now';
    } else if (s === 'thinking') {
      iconEl.innerHTML = STOP_HTML;
      statusEl.className = 'aiw-status s-think';
      statusEl.textContent = 'AI is thinking...';
    } else if (s === 'speaking') {
      iconEl.innerHTML = STOP_HTML;
      statusEl.className = 'aiw-status s-speak';
      statusEl.textContent = 'AI is speaking...';
    } else {
      iconEl.innerHTML = MIC_SVG;
      statusEl.className = 'aiw-status s-idle';
      statusEl.textContent = opts.subtitle;
    }
    applyLayout();
  }

  // ---- Playback ----
  function initPB() {
    pbCtx = new AudioContext({ sampleRate: SR });
    pbNode = pbCtx.createScriptProcessor(CS, 1, 1);
    pbNode.onaudioprocess = function(e) {
      var o = e.outputBuffer.getChannelData(0);
      if (pbSamples.length > 0) {
        if (lastSil) lastSil = false;
        o.set(pbSamples.shift());
      } else {
        if (!lastSil) { lastSil = true; if (rec && !isRealtime()) setState('listening'); }
        for (var i = 0; i < CS; i++) o[i] = 0;
      }
    };
    var g = pbCtx.createGain(); g.gain.value = 0.5;
    pbNode.connect(g); g.connect(pbCtx.destination);
  }

  function clearPB() { var h = pbSamples.length > 0; pbSamples = []; lastSil = true; return h; }

  // ---- Mic + VAD ----
  function startMic() {
    navigator.mediaDevices.getUserMedia({ audio: { sampleRate: SR, echoCancellation: true, autoGainControl: true, noiseSuppression: true, channelCount: 1 } })
    .then(function(stream) {
      micStr = stream;
      micCtx = new AudioContext({ sampleRate: SR });
      var src = micCtx.createMediaStreamSource(stream);
      micProc = micCtx.createScriptProcessor(CS, 1, 1);
      micProc.onaudioprocess = function(e) {
        if (!rec || !ws || ws.readyState !== WebSocket.OPEN) return;
        var ch = new Float32Array(e.inputBuffer.getChannelData(0));

        // Realtime mode: stream all audio continuously, server VAD handles turn detection
        if (isRealtime()) {
          ws.send(ch);
          return;
        }

        // Standard mode: client-side VAD
        if (!vadOn) return;
        var en = rms(ch), isSp = en > VAD_TH;
        if (isSp) {
          if (!spk) {
            spk = true; silStart = null;
            var wp = clearPB(); if (wp && ws) ws.send(INT);
            setState('listening');
            for (var i = 0; i < preBuf.length; i++) ws.send(preBuf[i]);
            preBuf = [];
          }
          ws.send(ch); silStart = null;
        } else if (spk) {
          if (!silStart) silStart = Date.now();
          else if (Date.now() - silStart > VAD_SIL) {
            spk = false; silStart = null;
            ws.send(EOS); lastEOS = Date.now(); setState('thinking');
          }
          ws.send(ch);
        } else {
          preBuf.push(ch);
          var mx = Math.ceil((VAD_PRE/1000)*SR/CS);
          while (preBuf.length > mx) preBuf.shift();
        }
      };
      src.connect(micProc); micProc.connect(micCtx.destination);
    });
  }

  function stopMic() {
    if (micProc) { micProc.onaudioprocess = null; micProc = null; }
    if (micCtx) { micCtx.close(); micCtx = null; }
    if (micStr) { micStr.getTracks().forEach(function(t){ t.stop(); }); micStr = null; }
  }

  // ---- WebSocket ----
  function connect() {
    ws = new WebSocket(opts.server + '?assistant=' + encodeURIComponent(opts.assistant) + '&mode=' + encodeURIComponent(opts.mode));
    ws.binaryType = 'arraybuffer';
    ws.onopen = function() { rec = true; initPB(); startMic(); };
    ws.onmessage = function(e) {
      if (e.data instanceof ArrayBuffer) {
        pbSamples.push(new Float32Array(e.data));
        if (lastSil) setState('speaking');
      } else if (e.data === CLR) {
        clearPB();
        if (!isRealtime() && ws) ws.send(INT);
      } else if (e.data === SPEECH_STARTED) {
        // Realtime mode: server VAD detected user speech
        clearPB();
        setState('listening');
      } else if (e.data === SPEECH_STOPPED) {
        // Realtime mode: server VAD detected user stopped speaking
        setState('thinking');
      } else if (e.data === RDY) {
        if (isRealtime()) {
          // In realtime mode, just wait for playback to finish then show listening
          var w = function() {
            if (pbSamples.length > 0) { setTimeout(w, 100); return; }
            setState('listening');
          }; w();
        } else {
          var w = function() {
            if (pbSamples.length > 0) { setTimeout(w, 100); return; }
            vadOn = true; spk = false; silStart = null; preBuf = [];
            setState('listening');
          }; w();
        }
      }
    };
    ws.onclose = function() { hangup(true); };
    ws.onerror = function() { hangup(true); };
  }

  function hangup(fromSrv) {
    rec = false; vadOn = false; spk = false;
    stopMic(); clearPB();
    if (pbCtx) { pbCtx.close(); pbCtx = null; pbNode = null; }
    if (!fromSrv && ws) { ws.close(); ws = null; }
    userCollapsed = true;
    setState('');
  }

  // ---- Apply CSS variables from style option ----
  function applyStyle(el, styleObj) {
    if (!styleObj) return;
    for (var key in styleObj) {
      if (styleObj.hasOwnProperty(key)) {
        var prop = key.indexOf('--') === 0 ? key : '--aiw-' + key;
        el.style.setProperty(prop, styleObj[key]);
      }
    }
  }

  // ---- Build DOM ----
  function buildWidget() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var posClass = opts.position === 'bottom-left' ? 'aiw-left' : 'aiw-right';
    wrap = document.createElement('div');
    wrap.className = 'aiw-wrap ' + posClass;
    wrap.innerHTML =
      '<div class="aiw-pill aiw-collapsed">' +
        '<button class="aiw-orb idle" id="__aiw_orb"><div class="aiw-ic" id="__aiw_icon">' + MIC_SVG + '</div></button>' +
        '<div class="aiw-txt">' +
          '<div class="aiw-title">' + opts.title + '</div>' +
          '<div class="aiw-status s-idle" id="__aiw_status">' + opts.subtitle + '</div>' +
        '</div>' +
        '<button class="aiw-chev" id="__aiw_chev">' + CHEV_SVG + '</button>' +
      '</div>';
    document.body.appendChild(wrap);

    // Apply custom style variables
    applyStyle(wrap, opts.style);

    pillEl = wrap.querySelector('.aiw-pill');
    orbBtn = document.getElementById('__aiw_orb');
    iconEl = document.getElementById('__aiw_icon');
    statusEl = document.getElementById('__aiw_status');
    chevBtn = document.getElementById('__aiw_chev');

    orbBtn.onclick = function() {
      if (userCollapsed) {
        userCollapsed = false;
        applyLayout();
        return;
      }
      if (rec || ws) { hangup(false); }
      else { setState('connecting'); connect(); }
    };
    chevBtn.onclick = function() {
      userCollapsed = true;
      applyLayout();
    };
  }

  // ====== Public API ======
  global.AIWidget = {
    init: function(userOpts) {
      opts = {
        server: userOpts.server || 'ws://localhost:8000',
        assistant: userOpts.assistant || 'receptionist',
        mode: userOpts.mode || 'standard',
        title: userOpts.title || 'AI Receptionist',
        subtitle: userOpts.subtitle || 'Talk to AI Receptionist',
        position: userOpts.position || 'bottom-right',
        style: userOpts.style || null,
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildWidget);
      } else {
        buildWidget();
      }
    },
    setOptions: function(newOpts) {
      if (newOpts.server !== undefined) opts.server = newOpts.server;
      if (newOpts.assistant !== undefined) opts.assistant = newOpts.assistant;
      if (newOpts.mode !== undefined) opts.mode = newOpts.mode;
    },
    setStyle: function(styleObj) {
      if (wrap) applyStyle(wrap, styleObj);
    },
    destroy: function() {
      hangup(false);
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
  };
})(window);
