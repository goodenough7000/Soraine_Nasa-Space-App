/* Loaded first, as a plain script, so the page works on older phones (about 2016 onward: iOS 15, Chrome 109 and later).
 *  1. Fills in three small things older browsers lack: Object.hasOwn, Array.prototype.at, and <dialog>.showModal()/close().
 *  2. Marks weak devices with <html data-device="low"> (few cores, little memory, data saver, or an old browser).
 *     CSS uses it to drop blur and long animations; the 3D views use it to draw at a lower resolution.
 */
(function () {
  if (!Object.hasOwn) Object.hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', { value: function (i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return this[i]; }, writable: true, configurable: true });

  var proto = window.HTMLDialogElement ? window.HTMLDialogElement.prototype : (window.HTMLUnknownElement || window.HTMLElement).prototype;
  if (typeof proto.showModal !== 'function') {                      // iOS before 15.4 has no working <dialog>
    document.documentElement.classList.add('no-dialog');
    var show = function () { this.setAttribute('open', ''); this.setAttribute('role', 'dialog'); this.setAttribute('aria-modal', 'true'); this.tabIndex = -1; document.documentElement.classList.add('dialog-open'); try { this.focus(); } catch (e) {} };
    var close = function () { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); document.documentElement.classList.remove('dialog-open'); this.dispatchEvent(new Event('close')); };
    var target = window.HTMLDialogElement ? proto : window.HTMLElement.prototype;
    target.showModal = target.show = show; target.close = close;
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; var d = document.querySelector('dialog[open]'); if (d) d.close(); });
  }

  var nav = navigator, conn = nav.connection || {}, coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var oldEngine = !(window.CSS && CSS.supports && CSS.supports('height', '100dvh'));          // browsers from before 2022
  var low = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4 && coarse) || (nav.deviceMemory && nav.deviceMemory <= 3) || conn.saveData === true || (oldEngine && coarse);
  if (/[?&]quality=full\b/.test(location.search)) low = false; if (/[?&]quality=low\b/.test(location.search)) low = true;
  window.SORAINE_DEVICE = { low: !!low, phone: !!coarse };
  if (low) document.documentElement.setAttribute('data-device', 'low');
})();
