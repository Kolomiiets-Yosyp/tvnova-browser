/* TVNova Remote Navigation v0.4 — loaded after player.js. */
(function () {
  'use strict';
  var style = document.createElement('style');
  style.textContent = [
    'button.tvn-remote-focused, input.tvn-remote-focused{outline:4px solid #e6b85d!important;outline-offset:3px!important;box-shadow:0 0 0 7px rgba(230,184,93,.20)!important;z-index:3;position:relative}',
    '.channel-item.tvn-remote-focused{background:#244839!important;border-color:#e6b85d!important}',
    '.cat-item.tvn-remote-focused{background:#244839!important;border-color:#e6b85d!important}',
    'body.tvn-remote-active .tipline{color:#d1ddca}',
    'body.tvn-css-fullscreen .video-frame{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-height:none!important;aspect-ratio:auto!important;border:0!important;border-radius:0!important;z-index:10000!important}',
    'body.tvn-css-fullscreen .video-frame video{width:100%!important;height:100%!important}',
    'body.tvn-css-fullscreen #tvn-remote-help{display:none}',
    '#tvn-remote-help{position:fixed;bottom:49px;right:20px;background:#142521e6;border:1px solid #577366;border-radius:8px;padding:6px 10px;font-size:12px;color:#d7e7dd;z-index:12;pointer-events:none}',
    '@media(max-width:720px){#tvn-remote-help{display:none}}'
  ].join('');
  document.head.appendChild(style);

  var current = null;
  var lastMain = null;
  var lastModal = null;
  var remoteStarted = false;
  var observer = null;
  var modalPrev = false;
  var focusTimer = 0;
  var help = document.createElement('div');
  help.id = 'tvn-remote-help';
  help.textContent = '\u2190 \u2191 \u2192 \u2193 Navigate  \u00b7  OK Play / Fullscreen  \u00b7  CH+/- Change  \u00b7  Back';
  help.hidden = true;
  document.body.appendChild(help);

  function settingsOpen() {
    var m = document.getElementById('settingsModal');
    return !!m && !m.hidden;
  }
  function isVisible(el) {
    if (!el || !el.isConnected || el.hidden || el.disabled) return false;
    var p = el;
    while (p && p !== document.body) {
      if (p.hidden) return false;
      p = p.parentElement;
    }
    var css = getComputedStyle(el);
    if (css.display === 'none' || css.visibility === 'hidden') return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function eligible() {
    var root = settingsOpen() ? document.getElementById('settingsModal') : document.querySelector('.shell');
    if (!root) return [];
    return Array.prototype.filter.call(root.querySelectorAll('button:not([disabled]),input:not([type="file"]):not([type="hidden"])'), isVisible);
  }
  function clearHighlight() {
    if (current) current.classList.remove('tvn-remote-focused');
  }
  function moveFocus(target, opts) {
    if (!target || !isVisible(target)) return false;
    clearHighlight();
    current = target;
    current.classList.add('tvn-remote-focused');
    if (settingsOpen()) lastModal = target;
    else lastMain = target;
    try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    if (!opts || !opts.noScroll) {
      try { target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); }
      catch (e) { target.scrollIntoView(false); }
    }
    return true;
  }
  function defaultTarget() {
    var items = eligible();
    if (!items.length) return null;
    if (settingsOpen()) return document.getElementById('closeSettings') || items[0];
    var chosen = document.querySelector('.channel-item.selected');
    return (chosen && isVisible(chosen) ? chosen : document.querySelector('.channel-item')) ||
      document.getElementById('emptyImport') || items[0];
  }
  function prepare() {
    if (!remoteStarted) {
      remoteStarted = true;
      document.body.classList.add('tvn-remote-active');
      help.hidden = false;
    }
    if (!isVisible(current) || (settingsOpen() && !document.getElementById('settingsModal').contains(current)) ||
       (!settingsOpen() && document.getElementById('settingsModal').contains(current))) {
      var saved = settingsOpen() ? lastModal : lastMain;
      moveFocus(isVisible(saved) ? saved : defaultTarget());
    }
  }
  function rectCenter(el) {
    var r = el.getBoundingClientRect();
    return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, r: r };
  }
  function findNext(dir) {
    var items = eligible();
    if (!items.length) return null;
    if (!current || items.indexOf(current) === -1) return defaultTarget();
    var a = rectCenter(current), best = null, bestScore = Infinity;
    var vertical = dir === 'ArrowUp' || dir === 'ArrowDown';
    var forward = dir === 'ArrowRight' || dir === 'ArrowDown';
    var SIGN = forward ? 1 : -1;
    for (var i = 0; i < items.length; i++) {
      var cand = items[i];
      if (cand === current) continue;
      var b = rectCenter(cand), dx = b.x - a.x, dy = b.y - a.y;
      var primary = (vertical ? dy : dx) * SIGN;
      if (primary <= 3) continue;
      var secondary = Math.abs(vertical ? dx : dy);
      var overlap = vertical ? Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)) :
        Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
      var score = primary + secondary * 2.2 + (overlap > 0 ? -Math.min(overlap, 35) : 0);
      if (score < bestScore) { best = cand; bestScore = score; }
    }
    return best;
  }
  function restoreAfterClick(target) {
    var wasChannel = target.classList.contains('channel-item');
    var name = wasChannel ? target.title : '';
    clearTimeout(focusTimer);
    focusTimer = setTimeout(function () {
      if (wasChannel) {
        var list = document.querySelectorAll('.channel-item');
        for (var i = 0; i < list.length; i++) {
          if (list[i].title === name && list[i].classList.contains('selected')) {
            moveFocus(list[i]); return;
          }
        }
        var selected = document.querySelector('.channel-item.selected');
        if (selected) { moveFocus(selected); return; }
      }
      if (settingsOpen()) moveFocus(isVisible(lastModal) ? lastModal : defaultTarget());
      else moveFocus(isVisible(lastMain) ? lastMain : defaultTarget());
    }, 60);
  }
  function leaveModal() {
    var close = document.getElementById('closeSettings');
    if (close) close.click();
    setTimeout(function () { moveFocus(isVisible(lastMain) ? lastMain : defaultTarget()); }, 20);
  }
  // Prefer native element fullscreen (keeps keyboard events within the web page).
  // CSS fallback allows TV browser remote commands even if Fullscreen API is unavailable.
  function fullscreenActive() {
    var frame = document.querySelector('.video-frame');
    var video = document.getElementById('videoPlayer');
    return document.body.classList.contains('tvn-css-fullscreen') ||
      !!document.fullscreenElement || !!document.webkitFullscreenElement ||
      !!(video && video.webkitDisplayingFullscreen);
  }
  function enterFullscreen() {
    var frame = document.querySelector('.video-frame');
    if (!frame || !document.querySelector('.channel-item.selected')) return;
    function fallback() { document.body.classList.add('tvn-css-fullscreen'); }
    try {
      var request = frame.requestFullscreen || frame.webkitRequestFullscreen;
      if (!request) { fallback(); return; }
      var pending = request.call(frame);
      if (pending && typeof pending.catch === 'function') pending.catch(fallback);
    } catch (err) { fallback(); }
  }
  function exitFullscreen() {
    document.body.classList.remove('tvn-css-fullscreen');
    if (document.fullscreenElement && document.exitFullscreen) {
      var pending = document.exitFullscreen();
      if (pending && typeof pending.catch === 'function') pending.catch(function () {});
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    var video = document.getElementById('videoPlayer');
    if (video && video.webkitDisplayingFullscreen && video.webkitExitFullscreen) video.webkitExitFullscreen();
  }
  function changeChannel(direction) {
    // Follow the current category/search order. Fallback to all channels if no channels are shown.
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.channel-item'));
    if (!buttons.length || settingsOpen()) return;
    var active = document.querySelector('.channel-item.selected');
    var index = buttons.indexOf(active);
    var next = index < 0 ? (direction > 0 ? 0 : buttons.length - 1) :
      (index + direction + buttons.length) % buttons.length;
    buttons[next].click();
    // The player redraws buttons on every channel change.
    var updated = document.querySelector('.channel-item.selected');
    if (!fullscreenActive() && updated) moveFocus(updated);
    else if (updated) { clearHighlight(); current = updated; lastMain = updated; }
  }
  function handleBack() {
    var video = document.getElementById('videoPlayer');
    if (fullscreenActive()) { exitFullscreen(); return; }
    if (settingsOpen()) { leaveModal(); return; }
    var selected = document.querySelector('.channel-item.selected');
    if (selected && current !== selected) { moveFocus(selected); return; }
    var cats = document.querySelector('.cat-item.is-active');
    if (cats && current !== cats) { moveFocus(cats); return; }
    var settings = document.getElementById('settingsButton');
    if (settings) moveFocus(settings);
  }
  function isTextEditing(el) {
    return el && (el.tagName === 'INPUT' && el.type !== 'button' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  function keyName(e) {
    var key = e.key || '';
    if (key === 'Up' || e.keyCode === 38) return 'ArrowUp';
    if (key === 'Down' || e.keyCode === 40) return 'ArrowDown';
    if (key === 'Left' || e.keyCode === 37) return 'ArrowLeft';
    if (key === 'Right' || e.keyCode === 39) return 'ArrowRight';
    if (key === 'OK' || key === 'Select' || key === 'NumpadEnter' || e.keyCode === 13) return 'Enter';
    if (key === 'BrowserBack' || key === 'GoBack' || key === 'Escape' || key === 'Backspace' || e.keyCode === 461 || e.keyCode === 10009) return 'Back';
    // Browser mappings differ by TV model; some buttons are reserved by the OS.
    if (key === 'ChannelUp' || key === 'Channel+' || key === 'PageUp' || key === 'Prior' || e.keyCode === 33 || e.keyCode === 427) return 'ChannelUp';
    if (key === 'ChannelDown' || key === 'Channel-' || key === 'PageDown' || key === 'Next' || e.keyCode === 34 || e.keyCode === 428) return 'ChannelDown';
    if (key === 'MediaPlayPause' || key === 'PlayPause') return 'MediaPlayPause';
    return key;
  }
  window.addEventListener('keydown', function (e) {
    var key = keyName(e);
    var isNav = key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
    if (!isNav && key !== 'Enter' && key !== 'Back' && key !== 'MediaPlayPause' && key !== 'ChannelUp' && key !== 'ChannelDown') return;
    // Do not hijack input typing and the TV browser's built-in soft keyboard.
    if (isTextEditing(document.activeElement)) {
      if (key === 'Back' && document.activeElement.tagName !== 'TEXTAREA') {
        document.activeElement.blur();
      } else { return; }
    }
    e.preventDefault(); e.stopImmediatePropagation();
    if (key === 'MediaPlayPause') {
      var v = document.getElementById('videoPlayer');
      if (v) { if (v.paused) v.play().catch(function () {}); else v.pause(); }
      return;
    }
    if (key === 'ChannelUp' || key === 'ChannelDown') {
      if (!settingsOpen()) changeChannel(key === 'ChannelUp' ? 1 : -1);
      return;
    }
    if (fullscreenActive() && key === 'Enter') { exitFullscreen(); return; }
    if (fullscreenActive() && isNav) return;
    prepare();
    if (key === 'Back') { handleBack(); return; }
    if (isNav) {
      var next = findNext(key);
      if (next) moveFocus(next);
      return;
    }
    if (key === 'Enter' && current) {
      var target = current;
      if (isTextEditing(target)) { target.focus(); return; }
      target.click();
      if (target.classList.contains('channel-item')) {
        enterFullscreen();
        return;
      }
      if (target.id === 'fullScreen') return;
      restoreAfterClick(target);
    }
  }, true); // Capture: existing player.js keyboard listener won't intercept remote keys.

  document.addEventListener('focusin', function (e) {
    if (isVisible(e.target) && eligible().indexOf(e.target) !== -1 && remoteStarted) {
      clearHighlight(); current = e.target; current.classList.add('tvn-remote-focused');
      if (settingsOpen()) lastModal = current; else lastMain = current;
    }
  });
  // Watch modal changes, and keep focus within the current view.
  var modal = document.getElementById('settingsModal');
  if (modal && window.MutationObserver) {
    observer = new MutationObserver(function () {
      var now = settingsOpen();
      if (now !== modalPrev) {
        modalPrev = now;
        if (remoteStarted) setTimeout(function () {
          moveFocus(now ? (isVisible(lastModal) ? lastModal : defaultTarget()) :
                    (isVisible(lastMain) ? lastMain : defaultTarget()));
        }, 10);
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  }
})();
