/* Interactive planning-boundary map: zoom, pan, and spotlight one boundary at a time. No dependencies. */
(function () {
  'use strict';
  var root = document.getElementById('mapx');
  if (!root) return;

  var IMG_W = 2306, IMG_H = 2696;
  // Bounding boxes (fractions of the image) used to zoom to each boundary.
  var LAYERS = {
    regional:    { box: [0.13, 0.119, 0.872, 0.879], name: 'Regional planning boundary', text: 'The overall planning area for the study.' },
    thayne:      { box: [0.152, 0.243, 0.356, 0.435], name: 'Thayne municipal boundary', text: 'The Town of Thayne.' },
    bedford:     { box: [0.331, 0.168, 0.783, 0.659], name: 'Bedford system boundary', text: 'The area served by the Bedford water system.' },
    turnerville: { box: [0.700, 0.704, 0.859, 0.866], name: 'Turnerville system boundary', text: 'The area served by the Turnerville water system.' }
  };

  var view = root.querySelector('.mapx-view');
  var stage = root.querySelector('.mapx-stage');
  var status = root.querySelector('.mapx-status');
  var hint = root.querySelector('.mapx-hint');
  var buttons = Array.prototype.slice.call(root.querySelectorAll('[data-layer]'));
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var s = 0, x = 0, y = 0, fit = 1, cw = 0, ch = 0, current = null;
  var pointers = {}, pinch = null, dragStart = null;

  function measure() {
    cw = view.clientWidth; ch = view.clientHeight;
    var f = Math.min(cw / IMG_W, ch / IMG_H);
    var wasFit = s && Math.abs(s - fit) < 1e-6;
    fit = f;
    if (!s || wasFit || s < fit) { s = fit; center(); }
    clamp(); apply(false);
  }
  function center() { x = (cw - IMG_W * s) / 2; y = (ch - IMG_H * s) / 2; }
  function clamp() {
    var w = IMG_W * s, h = IMG_H * s, slack = 80;
    x = w <= cw ? (cw - w) / 2 : Math.min(slack, Math.max(cw - w - slack, x));
    y = h <= ch ? (ch - h) / 2 : Math.min(slack, Math.max(ch - h - slack, y));
  }
  function apply(animate) {
    stage.classList.toggle('anim', !!animate && !reduce);
    stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
    view.style.touchAction = s > fit * 1.05 ? 'none' : 'pan-y';
    view.classList.toggle('is-zoomed', s > fit * 1.05);
  }
  function zoomAt(factor, px, py, animate) {
    var ns = Math.min(fit * 8, Math.max(fit, s * factor));
    var k = ns / s;
    x = px - (px - x) * k; y = py - (py - y) * k; s = ns;
    clamp(); apply(animate);
  }
  function zoomBox(b, animate) {
    var bw = (b[2] - b[0]) * IMG_W, bh = (b[3] - b[1]) * IMG_H, pad = 0.12;
    var ns = Math.min(cw / (bw * (1 + pad * 2)), ch / (bh * (1 + pad * 2)));
    s = Math.min(fit * 8, Math.max(fit, ns));
    x = cw / 2 - ((b[0] + b[2]) / 2) * IMG_W * s;
    y = ch / 2 - ((b[1] + b[3]) / 2) * IMG_H * s;
    clamp(); apply(animate);
  }
  function resetView(animate) { s = fit; center(); apply(animate); }

  function select(name, instant) {
    current = name;
    stage.classList.toggle('dim', !!name);
    Array.prototype.forEach.call(stage.querySelectorAll('.ov'), function (el) {
      el.classList.toggle('on', el.getAttribute('data-ov') === name);
    });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-layer') === name ? 'true' : 'false'); });
    if (name) {
      zoomBox(LAYERS[name].box, !instant);
      status.textContent = LAYERS[name].name + ': ' + LAYERS[name].text;
    } else {
      resetView(!instant);
      status.textContent = 'Showing the full map.';
    }
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      var n = b.getAttribute('data-layer');
      select(current === n ? null : n);
    });
  });
  root.querySelector('[data-act="all"]').addEventListener('click', function () { select(null); });
  root.querySelector('[data-act="in"]').addEventListener('click', function () { zoomAt(1.6, cw / 2, ch / 2, true); });
  root.querySelector('[data-act="out"]').addEventListener('click', function () { zoomAt(1 / 1.6, cw / 2, ch / 2, true); });
  root.querySelector('[data-act="reset"]').addEventListener('click', function () { select(null); });
  var fsBtn = root.querySelector('[data-act="full"]');
  var fsTarget = root.querySelector('.mapx-frame');
  if (fsBtn) {
    if (!fsTarget.requestFullscreen) { fsBtn.hidden = true; }
    else fsBtn.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen(); else fsTarget.requestFullscreen();
    });
    document.addEventListener('fullscreenchange', function () { setTimeout(measure, 60); });
  }

  /* pointer: drag to pan, two fingers to pinch */
  view.addEventListener('pointerdown', function (e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    view.setPointerCapture(e.pointerId);
    var ids = Object.keys(pointers);
    if (ids.length === 1) { dragStart = { px: e.clientX, py: e.clientY, x: x, y: y }; }
    if (ids.length === 2) { pinch = { d: dist(), s: s }; dragStart = null; }
    stage.classList.remove('anim');
  });
  view.addEventListener('pointermove', function (e) {
    if (!pointers[e.pointerId]) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length >= 2 && pinch) {
      var r = view.getBoundingClientRect(), a = pointers[ids[0]], b = pointers[ids[1]];
      var mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      var target = Math.min(fit * 8, Math.max(fit, pinch.s * dist() / pinch.d));
      zoomAt(target / s, mx, my, false);
    } else if (dragStart && s > fit * 1.02) {
      x = dragStart.x + (e.clientX - dragStart.px);
      y = dragStart.y + (e.clientY - dragStart.py);
      clamp(); apply(false);
    }
  });
  function end(e) {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    dragStart = null;
  }
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  function dist() {
    var ids = Object.keys(pointers), a = pointers[ids[0]], b = pointers[ids[1]];
    return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  }

  /* wheel: Ctrl/Cmd + scroll zooms, so normal page scrolling is never hijacked */
  var hintTimer;
  view.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      var r = view.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top, false);
    } else if (hint) {
      hint.classList.add('show'); clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { hint.classList.remove('show'); }, 1600);
    }
  }, { passive: false });
  view.addEventListener('dblclick', function (e) {
    var r = view.getBoundingClientRect();
    zoomAt(2, e.clientX - r.left, e.clientY - r.top, true);
  });
  view.addEventListener('keydown', function (e) {
    var step = 70, k = e.key;
    if (k === 'ArrowLeft') x += step; else if (k === 'ArrowRight') x -= step;
    else if (k === 'ArrowUp') y += step; else if (k === 'ArrowDown') y -= step;
    else if (k === '+' || k === '=') { zoomAt(1.4, cw / 2, ch / 2, true); e.preventDefault(); return; }
    else if (k === '-' || k === '_') { zoomAt(1 / 1.4, cw / 2, ch / 2, true); e.preventDefault(); return; }
    else if (k === '0') { select(null); e.preventDefault(); return; }
    else return;
    e.preventDefault(); clamp(); apply(true);
  });

  if (window.ResizeObserver) new ResizeObserver(measure).observe(view); else window.addEventListener('resize', measure);
  var baseImg = stage.querySelector('.base');
  measure();
  var q = new URLSearchParams(location.search).get('layer');
  if (q && LAYERS[q]) select(q, true);
})();
