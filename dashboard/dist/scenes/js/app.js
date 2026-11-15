/* Soraine: Flame in Freefall. Page controller.
 * Flow (from the team storyboard): close shot of the pan -> kitchen -> scan from
 * the sun -> the lunar surface galley -> click an object for a close shot with text.
 * Text is in content.js; scenes are in js/scenes/; this file only wires buttons to the engine.
 */
(function () {
  var C = window.SORAINE_CONTENT, STOPS = C.STOPS, INFO = C.INFO, NOTE = C.NOTE;   // all text lives in content.js

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), canvas = $('scene'), wipe = $('wipe'), ring = $('ring'), current = C.first, busy = true, inspecting = false, queued = null;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function show(id) {
    var s = STOPS[id]; current = id;
    stage.setAttribute('data-scene', id);
    $('title').textContent = s.title; $('line').textContent = s.line;
    $('gravity').textContent = s.gravity; $('go').textContent = SoraineScene.isTop && SoraineScene.isTop() ? C.BEGIN : s.go;
    SoraineScene.setState(id);
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    window.dispatchEvent(new CustomEvent('soraine:scene', { detail: { to: id } }));
  }

  /* The scan: freeze the old scene as a picture, switch the live scene underneath,
     then open a growing circle in the picture, centred on the sun. */
  function goTo(id) {
    if (busy && STOPS[id]) { queued = id; return false; }       // a world picked while the scan is still running goes next
    if (!STOPS[id] || busy || inspecting || id === current) return false;
    if (!reduced.matches && SoraineScene.scanCapture()) {       // Tony's scan: a front runs out from the stove flame and uncovers the new world
      busy = true; stage.classList.add('is-cut'); show(id);
      SoraineScene.scanFire(function () { stage.classList.remove('is-cut'); busy = false; $('go').focus({ preventScroll: true }); if (queued && queued !== current) { var q = queued; queued = null; goTo(q); } queued = null; });
      return true;
    }
    busy = true; stage.classList.add('is-cut');                 // fallback (reduced motion, or no depth textures): the older wipe from the sun
    SoraineScene.edges(reduced.matches ? 0 : 0.9);
    wipe.style.backgroundImage = 'url(' + SoraineScene.snapshot() + ')'; wipe.style.display = 'block';
    show(id);
    var o = SoraineScene.sunPoint(), vw = window.innerWidth, vh = window.innerHeight;
    var R = Math.hypot(Math.max(o.x, vw - o.x), Math.max(o.y, vh - o.y)) + 40, t0 = performance.now(), D = reduced.matches ? 1 : 1800;
    ring.style.left = o.x + 'px'; ring.style.top = o.y + 'px'; ring.style.display = reduced.matches ? 'none' : 'block';
    function step(now) {
      var p = Math.min(1, (now - t0) / D), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, r = e * R;
      var mask = 'radial-gradient(circle at ' + o.x + 'px ' + o.y + 'px, transparent ' + r + 'px, #000 ' + (r + 3) + 'px)';
      wipe.style.webkitMaskImage = mask; wipe.style.maskImage = mask;
      ring.style.width = ring.style.height = 2 * r + 'px'; ring.style.opacity = String(1 - p * 0.7);
      SoraineScene.edges(reduced.matches ? 0 : 0.9 * (1 - p));
      if (p < 1) { requestAnimationFrame(step); return; }
      wipe.style.display = 'none'; ring.style.display = 'none'; SoraineScene.edges(0);
      stage.classList.remove('is-cut'); busy = false; $('go').focus({ preventScroll: true });
    }
    requestAnimationFrame(step);
    return true;
  }

  /* Close shot: blurred picture of the scene behind, the object alone in front, text beside it. */
  function inspect(name) {
    if (!INFO[name] || busy || inspecting) return;
    $('backdrop').style.backgroundImage = 'url(' + SoraineScene.snapshot() + ')';
    if (!SoraineScene.inspect(name)) return;
    inspecting = true; stage.classList.add('is-inspect'); canvas.classList.remove('can-pick');
    $('info-name').textContent = INFO[name].name; $('info-text').textContent = INFO[name].text; $('info-note').textContent = NOTE;
    $('info').hidden = false; $('cube').hidden = false; $('info-back').focus({ preventScroll: true }); requestAnimationFrame(spinCube);
    window.dispatchEvent(new CustomEvent('soraine:inspect', { detail: { object: name } }));
  }
  function release() {
    if (!inspecting) return;
    SoraineScene.release(); inspecting = false; stage.classList.remove('is-inspect'); $('info').hidden = true; $('cube').hidden = true; $('go').focus({ preventScroll: true });
  }

  /* The cube mirrors the camera: it turns as you turn the object. */
  function spinCube() {
    if (!inspecting) return;
    var a = SoraineScene.angles();
    $('cube-box').style.transform = 'rotateX(' + (-(90 - a.ph * 57.2958)) + 'deg) rotateY(' + (-a.th * 57.2958) + 'deg)';
    requestAnimationFrame(spinCube);
  }
  var VIEWS = { top: [null, 0.08], front: [0, 1.42], right: [1.5708, 1.42], back: [3.1416, 1.42], left: [-1.5708, 1.42] };

  var ok = true;
  var why = '';
  var assetsLoading = false;
  THREE.DefaultLoadingManager.onStart = function () { assetsLoading = true; };
  THREE.DefaultLoadingManager.onLoad = function () { assetsLoading = false; };
  window.SoraineWaitForAssets = function () { return new Promise(function (resolve, reject) { var start = performance.now(); function check() { if (!assetsLoading) return resolve(); if (performance.now() - start > 30000) return reject(new Error('Images took too long to load. Please retry.')); setTimeout(check, 30); } check(); }); };
  function progress(value, label) { $('loading-progress').value = value; $('loading-percent').textContent = value + '%'; $('loading-label').textContent = label; }
  requestAnimationFrame(function () { setTimeout(async function () {
    try {
      SoraineScene.setStill(reduced.matches); SoraineScene.init(canvas, 'earth');
      stage.classList.add('is-on'); show('earth'); setTop(true);
      if (window.SORAINE_LITE) progress(100, 'Ready');           // phones: do not pre-build and warm every world (too much memory); each is built when opened
      else { await SoraineScene.prepareAll(progress); show('earth'); setTop(true); }
      $('scene-loading').hidden = true; document.querySelector('.ui').inert = false; busy = false;
    } catch (e) { ok = false; progress($('loading-progress').value, 'Could not finish preparing: ' + e.message); $('loading-retry').hidden = false; }
  }, 0); });

  // The page opens looking straight down on the pan. The first click pulls back to the whole scene; after that the button moves on.
  function setTop(on) { SoraineScene.topView(on, on ? 'pan' : null); stage.classList.toggle('is-top', !!on); $('go').textContent = on ? C.BEGIN : STOPS[current].go; var b = $('lab-top'); if (b) b.textContent = on ? 'Back to the scene view' : 'Top view of the pan'; }

  stage.classList.add('is-top');
  function controls(open, restoreFocus) {
    stage.classList.toggle('controls-open', open);
    $('controls-toggle').setAttribute('aria-expanded', String(open));
    $('scene-controls').inert = !open;
    if (!open && restoreFocus) $('controls-toggle').focus({ preventScroll: true });
  }
  $('controls-toggle').addEventListener('click', function () { controls(!stage.classList.contains('controls-open'), false); });
  $('controls-close').addEventListener('click', function () { controls(false, true); });
  // Let the panel finish moving away before a short animation begins.
  var replayingAction = false, actionTimer = null;
  $('scene-controls').addEventListener('click', function (e) {
    var button = e.target.closest('button[data-scene-action]');
    if (!button || replayingAction || !stage.classList.contains('controls-open')) return;
    e.preventDefault(); e.stopImmediatePropagation(); controls(false, true);
    clearTimeout(actionTimer);
    actionTimer = setTimeout(function () {
      actionTimer = null;
      if (busy || inspecting) return;
      replayingAction = true;
      try { button.click(); } finally { replayingAction = false; }
    }, reduced.matches ? 0 : 200);
  }, true);
  $('lab-valve').addEventListener('change', function () { controls(false, true); });
  canvas.addEventListener('pointerdown', function () { controls(false, false); });
  document.querySelectorAll('[data-world], [data-page]').forEach(function (button) { button.addEventListener('click', function () { controls(false, false); }); });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') controls(false, stage.classList.contains('controls-open')); });
  $('go').addEventListener('click', function () { if (SoraineScene.isTop()) { setTop(false); return; } goTo(STOPS[current].next); });
  if ($('lab-top')) $('lab-top').addEventListener('click', function () { setTop(!SoraineScene.isTop()); });
  window.addEventListener('keydown', function (e) { if ((e.key === 't' || e.key === 'T') && !inspecting && !/input|textarea/i.test(e.target.tagName)) setTop(!SoraineScene.isTop()); });
  $('info-back').addEventListener('click', release);
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') release(); });
  window.addEventListener('hashchange', function () { goTo(location.hash.slice(1) || C.first); });
  if (reduced.addEventListener) reduced.addEventListener('change', function () { SoraineScene.setStill(reduced.matches); });

  if (ok) {
    var down = null, moved = 0, lastMove = 0, touches = {}, pinch = 0;
    function dragStart(e) { down = [e.clientX, e.clientY]; moved = 0; touches[e.pointerId] = [e.clientX, e.clientY]; pinch = 0; if (inspecting && e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId); }
    function dragMove(e) {
      if (!inspecting || !touches[e.pointerId]) return;
      var ids = Object.keys(touches), prev = touches[e.pointerId]; touches[e.pointerId] = [e.clientX, e.clientY];
      if (ids.length >= 2) {                                   // two fingers: pinch to zoom
        var a2 = touches[ids[0]], b2 = touches[ids[1]], dist = Math.hypot(a2[0] - b2[0], a2[1] - b2[1]);
        if (pinch) SoraineScene.zoom(pinch / dist); pinch = dist; return;
      }
      var dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy);
      SoraineScene.turn(-dx * 0.008, -dy * 0.008);
    }
    function dragEnd(e) { delete touches[e.pointerId]; pinch = 0; }
    [canvas, $('cube')].forEach(function (el) {
      el.addEventListener('pointerdown', dragStart); el.addEventListener('pointermove', dragMove);
      el.addEventListener('pointerup', dragEnd); el.addEventListener('pointercancel', dragEnd);
    });
    canvas.addEventListener('pointerup', function (e) {
      if (window.SoraineDrag) return;                           // a loose prop was being dragged (js/tony-props.js): not a click
      if (inspecting || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return;
      var name = SoraineScene.pick(e.clientX, e.clientY); if (name) inspect(name);
    });
    canvas.addEventListener('pointermove', function (e) {
      var now = performance.now(); if (now - lastMove < 90 || busy || inspecting) return; lastMove = now;
      canvas.classList.toggle('can-pick', !!SoraineScene.pick(e.clientX, e.clientY));
    });
    canvas.addEventListener('wheel', function (e) { if (!inspecting) return; e.preventDefault(); SoraineScene.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
    $('cube').addEventListener('click', function (e) {
      var v = VIEWS[e.target.getAttribute('data-view')]; if (!v || moved > 6) return;
      SoraineScene.lookFrom(v[0] === null ? SoraineScene.angles().th : v[0], v[1]);
    });
    window.addEventListener('keydown', function (e) {
      if (!inspecting) return;
      var step = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
      if (step) { SoraineScene.turn(step[0], step[1]); e.preventDefault(); }
      if (e.key === '+' || e.key === '=') SoraineScene.zoom(0.9); if (e.key === '-') SoraineScene.zoom(1.1);
    });
  }

  window.Soraine = { goTo: goTo, inspect: inspect, release: release, stops: STOPS, info: INFO, objects: ok ? SoraineScene.objects : {}, current: function () { return current; } };
})();
