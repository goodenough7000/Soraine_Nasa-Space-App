/* Physics and interactions, driven by Tony's world data (js/physics-data.js).
 *
 * What is real here and what is not:
 *   - Gravity g per world comes from Tony's data (NASA planetary fact sheets). The drop test and the falling
 *     debris use it directly: y = h - g t^2 / 2, with no air resistance.
 *   - The flame's shape per world (height, width, flicker) uses Tony's flame numbers. He marks them "schematic":
 *     a visual guide, not combustion data. The rising heat shimmer climbs at sqrt(g / g_Earth) of its Earth speed,
 *     also schematic.
 *   - The valve only scales the drawn flame. There is no sourced fuel pressure or flow rate, so none is shown.
 *   - The egg setting is an illustration with the same timing in every world. It is not a cooking model.
 *
 * Public: window.SoraineLab = { world(), g(), setValve(0..1), ignite(), drop(), resetEgg() }
 * Other modules can read K.g(stopId) for a world's gravity.
 */
(function () {
  var T = THREE, K = SoraineKit, DATA = window.SORAINE_SCENARIOS || [], MAP = window.SORAINE_STOP_TO_SLUG || {}, G_EARTH = 9.81, DROP_H = 1.0;
  function scenario(stop) { var slug = MAP[stop] || stop; for (var i = 0; i < DATA.length; i++) if (DATA[i].slug === slug) return DATA[i]; return null; }
  K.g = function (stop) { var s = scenario(stop); return s ? s.g : G_EARTH; };

  var stop = 'earth', valve = 1, flare = 0, cooked = 0, fl = { height: 1, width: 1, flicker: 1, blue: 0, sphere: 0 }, target = { height: 1, width: 1, flicker: 1, blue: 0, sphere: 0 }, warmLight = new T.Color(1, 0.63, 0.25), blueLight = new T.Color(0.45, 0.6, 1), fire = { sphere: 0, blue: 0 };
  var drop = null, spoon, puffs = [], last = 0, parts, burner, $ = function (id) { return document.getElementById(id); };

  K.props.push(function (E) {
    parts = E.parts; burner = E.burner;
    // the spoon for the drop test
    spoon = new T.Group(); spoon.visible = false; E.scene.add(spoon);
    var bowl = new T.Mesh(new T.SphereGeometry(0.03, 20, 12), K.mat.chrome); bowl.scale.set(1, 0.3, 0.7); bowl.position.x = 0.09; spoon.add(bowl);
    var stem = new T.Mesh(new T.CylinderGeometry(0.005, 0.007, 0.15, 10), K.mat.chrome); stem.rotation.z = Math.PI / 2; spoon.add(stem);
    // heat shimmer above the pan
    for (var i = 0; i < 6; i++) { var p = K.halo(0xffd2a0, 0.16, 0, 0, 0, E.scene, 0); puffs.push({ o: p, ph: i / 6, dx: (i % 3 - 1) * 0.035, dz: ((i * 2) % 3 - 1) * 0.03 }); }
    var rawW = new T.Color(0xcfc9b4), setW = new T.Color(0xfbf7ec), rawY = new T.Color(0xf59a14), setY = new T.Color(0xf3bd58);

    E.onFrame(function (t, f) {
      var dt = Math.min(0.1, Math.max(0, t - last)); last = t; var g = K.g(stop), k = 1 - Math.exp(-dt * 2.2), key;
      for (key in fl) fl[key] += (target[key] - fl[key]) * k;                     // the flame eases to the new world's shape
      flare = Math.max(0, flare - dt * 1.1);
      var on = valve > 0.02, size = on ? 0.35 + 0.65 * valve : 0, burst = 1 + 0.9 * flare * flare, jit = f.still ? 0 : 0.06 * fl.flicker * Math.sin(t * 13);
      if (parts.jets) {
        if (!on) parts.jets.visible = false;
        parts.jets.scale.set(fl.width * (0.8 + 0.2 * size) * (1 + 0.25 * flare), Math.max(0.01, fl.height * size * burst * (1 + jit)), fl.width * (0.8 + 0.2 * size) * (1 + 0.25 * flare));
      }
      // The fire itself: Tony's cone-to-sphere morph and yellow-to-blue shift, sized by the valve and the ignition flare
      if (parts.fire) {
        var U = parts.fire.uniforms, sph = f.free ? 1 : fl.sphere, blu = f.free ? 1 : fl.blue; fire.sphere += (sph - fire.sphere) * k; fire.blue += (blu - fire.blue) * k;
        U.uTime.value = f.still ? 0 : t; U.uSphere.value = fire.sphere; U.uBlue.value = fire.blue; U.uFlicker.value = fl.flicker;
        parts.fire.group.visible = on && !(f.focus && false); var fw = fl.width * (0.7 + 0.3 * size) * (1 + 0.2 * flare), fh = fl.height * size * burst * 0.74 /* the Earth flame just licks the pan */; fh += (fw * 0.78 - fh) * fire.sphere * fire.sphere;   // a full sphere is as tall as it is wide
        parts.fire.group.scale.set(fw, Math.max(0.01, fh), fw);
        if (parts.ball) parts.ball.visible = false;
        if (parts.light) { parts.light.color.copy(warmLight).lerp(blueLight, fire.blue); parts.light.intensity = (1.5 + (f.still ? 0 : 0.5 * Math.sin(t * 17) * fl.flicker + 0.25 * Math.sin(t * 5.1) * fl.flicker)) * (0.45 + 0.55 * fl.height); parts.light.distance = 3.2; }
        if (parts.halo) parts.halo.material.color.copy(warmLight).lerp(blueLight, fire.blue);
      }
      if (parts.light) parts.light.intensity *= (on ? size * burst : 0);
      if (parts.halo) { parts.halo.material.opacity *= (on ? 0.3 + 0.7 * size : 0); parts.halo.scale.setScalar(0.5 * (0.6 + 0.4 * size) * fl.width * (1 + 0.6 * flare)); }

      // heat shimmer: rises more slowly where gravity is weaker (schematic); none in free fall
      var rise = 0.5 * Math.sqrt(g / G_EARTH), show = on && !f.free && !f.focus && g > 0;
      puffs.forEach(function (p) {
        var u = f.still ? p.ph : (t * rise / 0.7 + p.ph) % 1;
        p.o.visible = show; p.o.position.set(burner.x + p.dx * (1 + u), burner.y + 0.12 + u * 0.7, burner.z + p.dz * (1 + u));
        p.o.scale.setScalar(0.1 + 0.22 * u); p.o.material.opacity = 0.16 * size * (1 + flare) * Math.sin(Math.PI * u);
      });

      // the egg sets while the burner is lit (illustration only)
      if (on && cooked < 1) { cooked = Math.min(1, cooked + dt * valve / 22); paint(); }
      if (parts.eggWhite) { parts.eggWhite.color.copy(rawW).lerp(setW, cooked); parts.yolk.material.color.copy(rawY).lerp(setY, cooked * 0.7); }

      // dial pointer and canister wheel follow the valve
      var dial = K.objects.dialPivot; if (dial) dial.rotation.z += (-valve * 2.4 - dial.rotation.z) * Math.min(1, dt * 8);
      if (parts.wheel) parts.wheel.rotation.z += (valve * 4.7 - parts.wheel.rotation.z) * Math.min(1, dt * 8);

      // drop test: free fall from DROP_H with this world's g, then two small bounces
      if (drop) {
        drop.t += dt; var y, tf = drop.tf;
        if (g <= 0) { y = DROP_H; if (drop.t > 3) end(); }
        else if (drop.t < tf) y = DROP_H - 0.5 * g * drop.t * drop.t;
        else { var v = g * tf * 0.32, tb = drop.t - tf, t1 = 2 * v / g, v2 = v * 0.4, t2 = 2 * v2 / g;
          if (!drop.hit) { drop.hit = true; $('lab-fall').textContent = tf.toFixed(2) + ' s'; }
          y = tb < t1 ? v * tb - 0.5 * g * tb * tb : tb < t1 + t2 ? v2 * (tb - t1) - 0.5 * g * (tb - t1) * (tb - t1) : 0; if (tb > t1 + t2 + 1.5) end(); }
        spoon.position.set(0.5, 0.045 + y, -0.8); spoon.rotation.set(0, 0.6, drop.t < tf ? drop.t * 2 : 0);
        if (!drop.hit && g > 0) $('lab-fall').textContent = Math.min(drop.t, tf).toFixed(2) + ' s';
      }
    });
  });
  function end() { drop = null; spoon.visible = false; fallText(); }

  // ---- side card and world buttons ----
  function tag(src) { return src === 'schematic' ? 'schematic' : src === 'unverified' ? 'unverified' : src; }
  function fallText() { var g = K.g(stop); $('lab-fall').textContent = g > 0 ? Math.sqrt(2 * DROP_H / g).toFixed(2) + ' s' : 'does not fall'; }
  function paint() { var e = $('lab-egg'); if (e) e.textContent = cooked >= 1 ? 'set' : cooked > 0.02 ? 'setting, ' + Math.round(cooked * 100) + '%' : 'raw'; }
  function render() {
    var s = scenario(stop); if (!s || !$('lab')) return;
    $('lab-world').textContent = s.label;
    var rows = $('lab-facts'); rows.innerHTML = '';
    s.facts.forEach(function (fc) {
      var dt = document.createElement('dt'), dd = document.createElement('dd'), sm = document.createElement('small');
      dt.textContent = fc.k; dd.textContent = fc.v + ' '; sm.textContent = tag(fc.src); sm.className = fc.src === 'schematic' || fc.src === 'unverified' ? 'src warn' : 'src'; dd.appendChild(sm); rows.appendChild(dt); rows.appendChild(dd);
    });
    $('lab-ratio').textContent = s.g > 0 ? (s.g / G_EARTH).toFixed(2) + ' g' : 'about 0 g';
    fallText(); paint();
    Array.prototype.forEach.call(document.querySelectorAll('.worlds button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-world') === stop)); });
    var card = $('detail-card');                                // Tony's detail page: what the flame is doing in this world, each fact with its source label
    if (card) {
      card.innerHTML = ''; var h = document.createElement('h2'); h.textContent = s.label; card.appendChild(h);
      var lead = document.createElement('p'); lead.className = 'muted'; lead.textContent = 'What the flame is doing under ' + (s.g === 0 ? 'microgravity' : s.g.toFixed(2) + ' m/s\u00B2') + '.'; card.appendChild(lead);
      var dl = document.createElement('dl');
      s.facts.forEach(function (fc) { var dt = document.createElement('dt'), dd = document.createElement('dd'), sm = document.createElement('small'); dt.textContent = fc.k + ' '; sm.textContent = tag(fc.src); sm.className = fc.src === 'schematic' || fc.src === 'unverified' ? 'src warn' : 'src'; dt.appendChild(sm); dd.textContent = fc.v; dl.appendChild(dt); dl.appendChild(dd); });
      card.appendChild(dl);
      var note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Evidence case and material comparison (Mylar G vs Ultem 1000) to be wired in here.'; card.appendChild(note);
    }
  }

  // ---- Tony's pages: observe (the scene), detail (close on the pan, facts card), about ----
  var page = 'observe', ORDER = ['observe', 'detail', 'about'];
  function setPage(pg) {
    if (ORDER.indexOf(pg) < 0 || !window.SoraineScene) return; page = pg;
    var stage = $('stage'); stage.classList.toggle('is-detail', pg === 'detail'); stage.classList.toggle('is-about', pg === 'about');
    $('detail-card').hidden = pg !== 'detail'; $('about-card').hidden = pg !== 'about';
    SoraineScene.setRig(pg === 'observe' ? null : pg);
    Array.prototype.forEach.call(document.querySelectorAll('.pages button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-page') === pg)); });
  }
  function setWorld(id) {
    stop = id; var s = scenario(id); if (s) { target.height = s.flame.height; target.width = s.flame.width; target.flicker = s.flame.flicker; target.blue = s.flame.blue; target.sphere = s.flame.sphere; }
    if (drop) end(); render();
  }
  function setValve(v) { valve = Math.max(0, Math.min(1, v)); var r = $('lab-valve'), o = $('lab-valve-out'); if (r) r.value = Math.round(valve * 100); if (o) o.textContent = valve <= 0.02 ? 'closed' : Math.round(valve * 100) + '% open'; }
  function ignite() { if (valve <= 0.02) setValve(0.6); flare = 1; }
  function startDrop() { var g = K.g(stop); drop = { t: 0, tf: g > 0 ? Math.sqrt(2 * DROP_H / g) : Infinity, hit: false }; spoon.visible = true; }

  window.addEventListener('soraine:scene', function (ev) { setWorld(ev.detail.to); });
  window.addEventListener('soraine:inspect', function (ev) {                      // clicking the pan or egg flares the burner; the canister or stove nudges the valve
    var o = ev.detail.object; if (o === 'pan' || o === 'egg') ignite();
    if (o === 'canister' || o === 'stove') { var was = valve; setValve(Math.min(1, was + 0.25)); setTimeout(function () { setValve(was); }, 450); }
  });
  if ($('lab')) {
    $('lab-valve').addEventListener('input', function () { setValve(this.value / 100); });
    $('lab-ignite').addEventListener('click', ignite);
    $('lab-drop').addEventListener('click', startDrop);
    $('lab-egg-reset').addEventListener('click', function () { cooked = 0; paint(); });
    Array.prototype.forEach.call(document.querySelectorAll('.worlds button'), function (b) {
      var sc = scenario(b.getAttribute('data-world')); if (sc) { var sm = document.createElement('small'); sm.textContent = sc.g.toFixed(2) + ' m/s\u00B2'; b.appendChild(sm); }   // each world with its gravity, as in Tony's bar
      b.addEventListener('click', function () { if (window.Soraine) window.Soraine.goTo(b.getAttribute('data-world')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.pages button'), function (b) { b.addEventListener('click', function () { setPage(b.getAttribute('data-page')); }); });
    window.addEventListener('keydown', function (e) {             // left and right arrows step through the pages (not while a close shot is open)
      if ($('stage').classList.contains('is-inspect') || /input|textarea/i.test(e.target.tagName)) return; var i = ORDER.indexOf(page);
      if (e.key === 'ArrowRight') setPage(ORDER[(i + 1) % 3]); if (e.key === 'ArrowLeft') setPage(ORDER[(i + 2) % 3]);
    });

    setValve(1);
  }
  window.SoraineLab = { page: function () { return page; }, setPage: setPage, world: function () { return stop; }, g: function () { return K.g(stop); }, setValve: setValve, ignite: ignite, drop: startDrop, resetEgg: function () { cooked = 0; paint(); } };
})();
