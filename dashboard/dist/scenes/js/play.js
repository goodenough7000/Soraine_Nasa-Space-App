/* Things to try at the stove (one module; remove this file and its three buttons and nothing else breaks):
 *   flip  - toss the egg off the pan. It leaves at TOSS m/s (an assumed value) and falls under the world's sourced g,
 *           so air time = 2 * TOSS / g and peak height = TOSS^2 / (2 g). Both are computed, not measured.
 *   salt  - a pinch of grains released above the pan; they fall under the same g, or drift in free fall.
 *   blow  - lean the flame with a puff of air. How quickly it stands back up is a schematic illustration.
 * Keys: F flip, S salt, B blow.  API: window.SorainePlay = { flip, salt, blow }.
 */
(function () {
  var T = THREE, K = SoraineKit, TOSS = 1.7, GRAINS = 90, $ = function (id) { return document.getElementById(id); };
  var parts, flip = null, lost = false, lean = 0, leanV = 0, last = 0, salt = null, pts, pos, vel, burner;

  function g() { return window.SoraineLab ? window.SoraineLab.g() : 9.81; }
  function say(s) { var o = $('play-out'); if (o) o.textContent = s; }
  function doFlip() {
    if (flip || lost) { if (lost) say('The egg is gone. Press New egg.'); return; }
    var gg = g(); flip = { t: 0, g: gg, tf: gg > 0.01 ? 2 * TOSS / gg : Infinity };
    say(gg > 0.01 ? 'Flip: ' + flip.tf.toFixed(2) + ' s in the air, peak ' + (TOSS * TOSS / (2 * gg)).toFixed(2) + ' m' : 'Flip: no gravity to bring it back');
  }
  function doSalt() {
    salt = { t: 0 }; pts.visible = true;
    for (var i = 0; i < GRAINS; i++) {
      pos[i * 3] = burner.x + (Math.random() - 0.5) * 0.06; pos[i * 3 + 1] = burner.y + 0.75 + Math.random() * 0.05; pos[i * 3 + 2] = burner.z + (Math.random() - 0.5) * 0.06;
      vel[i * 3] = (Math.random() - 0.5) * 0.22; vel[i * 3 + 1] = -0.15 - Math.random() * 0.2; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.22;
    }
    var gg = g(), h = 0.45; say(gg > 0.01 ? 'Salt: lands after about ' + ((-0.25 + Math.sqrt(0.0625 + 2 * gg * h)) / gg).toFixed(2) + ' s' : 'Salt: the grains drift and never land');
  }
  function doBlow() { leanV += 5.5; say('Blow: the flame leans, then recovers (schematic)'); }

  K.props.push(function (E) {
    parts = E.parts; burner = E.burner;
    pos = new Float32Array(GRAINS * 3); vel = new Float32Array(GRAINS * 3);
    var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    pts = new T.Points(geo, new T.PointsMaterial({ color: 0xffffff, size: 0.012, sizeAttenuation: true })); pts.frustumCulled = false; pts.visible = false; E.scene.add(pts);

    E.onFrame(function (t, f) {
      var dt = Math.min(0.1, Math.max(0, t - last)); last = t; if (f.still) return;
      var pan = K.objects.pan, egg = K.objects.egg, i;
      // the flip: the pan kicks up and tilts, the egg flies, turns over once and lands (or never comes back)
      if (flip) {
        flip.t += dt; var ft = flip.t, y = TOSS * ft - 0.5 * flip.g * ft * ft, kick = ft < 0.3 ? Math.sin(ft / 0.3 * Math.PI) : 0;
        if (pan) { pan.position.y += kick * 0.06; pan.rotation.z += kick * 0.3; }
        if (flip.tf === Infinity) { if (egg) { egg.position.y += y; egg.rotation.x += ft * 2.2; } if (y > 3) { flip = null; lost = true; if (egg) egg.visible = false; } }
        else if (ft >= flip.tf) flip = null;
        else if (egg) { egg.position.y += Math.max(0, y); egg.rotation.x += ft / flip.tf * Math.PI * 2; }
      }
      if (lost && egg) egg.visible = false;
      // the salt
      if (salt) {
        salt.t += dt; var gg = g(), alive = 0, floor = burner.y + 0.3;
        for (i = 0; i < GRAINS; i++) {
          if (pos[i * 3 + 1] <= floor && gg > 0.01) continue; alive++;
          vel[i * 3 + 1] -= gg * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        }
        pts.geometry.attributes.position.needsUpdate = true; if (!alive || salt.t > 9) { salt = null; pts.visible = false; }
      }
      // the puff of air: a damped spring; a stronger buoyant draught (higher g) stands the flame up sooner
      if (parts.fire) {
        var stiff = 14 + 60 * Math.sqrt(g() / 9.81); leanV += (-stiff * lean - 5 * leanV) * dt; lean += leanV * dt;
        parts.fire.group.rotation.z = -lean * 0.9;
      }
    });
  });

  window.addEventListener('soraine:scene', function () { flip = null; salt = null; if (pts) pts.visible = false; say(''); });
  if ($('play-flip')) {
    $('play-flip').addEventListener('click', doFlip); $('play-salt').addEventListener('click', doSalt); $('play-blow').addEventListener('click', doBlow);
    var re = $('lab-egg-reset'); if (re) re.addEventListener('click', function () { lost = false; flip = null; if (K.objects.egg) K.objects.egg.visible = true; say(''); });
  }
  window.addEventListener('keydown', function (e) {
    if (/input|textarea/i.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return; var k = e.key.toLowerCase();
    if (k === 'f') doFlip(); if (k === 's') doSalt(); if (k === 'b') doBlow();
  });
  window.SorainePlay = { flip: doFlip, salt: doSalt, blow: doBlow };
})();
