// Shared pointer gestures for Soraine's two 3D stages: the planet (globe.mjs)
// and the material specimen (material-model.mjs).
//
//   one pointer  -> rotate, then glide to a stop when released (inertia)
//   two pointers -> pinch to zoom
//
// Works the same for touch, pen and mouse. The host stops scrolling the page
// while it is being touched (touch-action: none); the margins around it scroll.

const DAMPING = .07;      // share of spin lost per 60 fps frame, as in OrbitControls
const MIN_SPEED = .012;   // px/ms: the glide ends below this
const MAX_SPEED = 3.2;    // px/ms: cap for very hard flicks
const FLICK_WINDOW = 90;  // ms: holding still at least this long before release cancels the glide
const FRAME = 1000 / 60;

/**
 * @param {HTMLElement} host element that receives the gestures
 * @param {object} handlers
 * @param {(dx:number, dy:number, pointerType:string)=>void} handlers.rotate pixel deltas
 * @param {(logRatio:number)=>void} [handlers.zoom] negative = fingers spreading (zoom in)
 * @param {()=>void} [handlers.start] a gesture began
 * @param {()=>void} [handlers.end] the gesture and its glide are over
 * @param {()=>boolean} [handlers.reducedMotion] true disables the glide
 * @param {AbortSignal} [handlers.signal] aborting disposes the gestures
 */
export function attachOrbitGestures(host, {rotate, zoom, start, end, reducedMotion, signal} = {}) {
  const controller = new AbortController();
  const listen = (event, callback, options = {}) =>
    host.addEventListener(event, callback, {...options, signal: controller.signal});
  const pointers = new Map();
  let type = 'mouse', active = false, vx = 0, vy = 0, lastMove = 0, interval = 0, pinch = 0, frame = null, previous = 0;

  host.style.touchAction = 'none';
  host.style.userSelect = 'none';
  host.style.webkitUserSelect = 'none';

  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  function stopGlide() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; previous = 0;
  }
  function finish() {
    stopGlide(); vx = vy = 0;
    if (active) { active = false; end?.(); }
  }
  function glide(time) {
    frame = null;
    const dt = previous ? Math.min(time - previous, 48) : FRAME;
    previous = time;
    rotate?.(vx * dt, vy * dt, type);
    const decay = Math.pow(1 - DAMPING, dt / FRAME);
    vx *= decay; vy *= decay;
    if (Math.hypot(vx, vy) < MIN_SPEED) { finish(); return; }
    frame = requestAnimationFrame(glide);
  }

  function down(event) {
    if (event.button !== 0 || pointers.size >= 2) return;
    stopGlide();
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    type = event.pointerType || 'mouse';
    // Synthetic or already-released pointers cannot be captured; dragging still works.
    try { host.setPointerCapture(event.pointerId); } catch {}
    vx = vy = 0; interval = 0; lastMove = performance.now();
    pinch = pointers.size === 2 ? spread() : 0;
    if (!active) { active = true; start?.(); }
  }
  function move(event) {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    point.x = event.clientX; point.y = event.clientY;
    if (pointers.size === 2) {
      const next = spread();
      if (pinch > 0 && next > 0) zoom?.(Math.log(pinch / next));
      pinch = next; vx = vy = 0;
      return;
    }
    if (!dx && !dy) return;
    const now = performance.now(), dt = Math.max(now - lastMove, 1);
    lastMove = now; interval = dt;
    // Ease toward the newest finger speed so one noisy sample cannot set the flick.
    const blend = 1 - Math.exp(-dt / 40);
    vx += (dx / dt - vx) * blend; vy += (dy / dt - vy) * blend;
    rotate?.(dx, dy, type);
  }
  function up(event) {
    if (!pointers.delete(event.pointerId)) return;
    try { if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId); } catch {}
    pinch = 0;
    if (pointers.size) { vx = vy = 0; lastMove = performance.now(); return; }
    const speed = Math.hypot(vx, vy), idle = performance.now() - lastMove;
    // On a slow frame rate moves arrive far apart, so the pause that cancels a glide scales with them.
    const held = idle > Math.max(FLICK_WINDOW, interval * 2.5);
    if (event.type === 'pointercancel' || held || speed < MIN_SPEED * 4 || reducedMotion?.()) { finish(); return; }
    if (speed > MAX_SPEED) { vx *= MAX_SPEED / speed; vy *= MAX_SPEED / speed; }
    previous = 0; frame = requestAnimationFrame(glide);
  }

  listen('pointerdown', down);
  listen('pointermove', move);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(event, up);
  // Engines that ignore touch-action still must not scroll the page mid-gesture.
  listen('touchmove', event => { if (event.cancelable) event.preventDefault(); }, {passive: false});

  function stop() { pointers.clear(); pinch = 0; finish(); }
  function dispose() { controller.abort(); stopGlide(); pointers.clear(); active = false; }
  signal?.addEventListener('abort', dispose, {once: true});
  return {stop, dispose};
}
