const definition = (title, description) => Object.freeze({ title, description });

export const definitions = Object.freeze({
  ULOI: definition('Upward Limiting Oxygen Index', 'In Earth tests, the oxygen concentration where about half the samples met the burn-length limit.'),
  MOC: definition('Maximum Oxygen Concentration', 'The highest tested oxygen concentration where the material consistently self-extinguished under the stated test conditions.'),
  'ULOI*': definition('Upward Limiting Oxygen Index (reduced gravity)', 'The lowest tested oxygen concentration where the flame lasted for the whole reduced-gravity drop test. These short-duration criteria differ from Earth tests.'),
  'MOC*': definition('Maximum Oxygen Concentration (reduced gravity)', 'The highest tested oxygen concentration where the flame went out during the drop test. These short-duration criteria differ from Earth tests.'),
  asterisk: definition('Reduced-gravity test limits', 'The asterisk marks a limit from a short-duration reduced-gravity test. Its survival or extinction criteria differ from those used in Earth tests.'),
  oxygen: definition('Oxygen molar percent', 'Oxygen as a percentage of the gas molecules in the test atmosphere. This describes the gas mixture, not the total pressure or oxygen partial pressure.'),
  pp: definition('Percentage points', 'The difference between two percentages. A change from 20% oxygen to 21% oxygen is an increase of 1 percentage point.'),
  oxygenDelta: definition('Change in mean limiting oxygen concentration', 'The paper compares the midpoint of ULOI and MOC at each gravity with the Earth midpoint. This is not the change in ULOI alone or a probability of fire.'),
  airflow: definition('Airflow', 'The speed of gas flowing past the test sample. Flow can carry fresh oxygen toward a flame and move heat and combustion products away.'),
  cmps: definition('Centimetres per second', 'A unit of speed. An airflow of 30 cm/s means gas moves 30 centimetres in one second.'),
  kPa: definition('Kilopascals, absolute pressure', 'A unit of gas pressure. These values are measured relative to a vacuum, rather than relative to the surrounding atmosphere.'),
  psia: definition('Pounds per square inch absolute', 'Gas pressure measured relative to a vacuum. The “a” distinguishes absolute pressure from pressure measured above the surrounding atmosphere.'),
  g: definition('Nominal gravity relative to Earth', 'Gravity expressed as a multiple of Earth’s surface gravity. The dataset’s gravity labels are nominal categories, not a measured acceleration trace for each test.'),
  microgravity: definition('Microgravity', 'A condition of very small apparent weight during free fall, as in orbit or a drop tower. Gravity is still present. This differs from the surface gravity of the Moon or Mars.'),
  PSI: definition('NASA Physical Sciences Informatics', 'NASA’s research data repository. PSI here names the database; lowercase psi is a unit of pressure: pounds per square inch.'),
  NTRS: definition('NASA Technical Reports Server', 'NASA’s public research repository. Source links open the original report, paper or presentation so you can read the test methods and results.'),
  PMMA: definition('Poly(methyl methacrylate)', 'An acrylic plastic. The lunar combustion study in this dataset tested a 4 mm diameter PMMA rod; its results describe that specimen and test setup.'),
  PEI: definition('Polyetherimide', 'The polymer family used for Ultem 1000. The oxygen-limit comparison tested a 10 mil PEI film, so the results describe that material and specimen geometry.'),
  PET: definition('Polyethylene terephthalate', 'The polymer in Mylar G and the related Melinex 515 film used for the Earth comparison. These are similar but distinct film products.'),
  fitted: definition('Fitted result', 'A value obtained by fitting a mathematical relationship to experimental observations. It summarizes measurements and is not an independent trial.'),
  model: definition('Model-derived result', 'A value calculated using a model and stated assumptions. It is not a direct measurement under the condition the model describes.'),
  published: definition('Published experimental limit', 'A flammability limit reported by the source for its stated test conditions. It is not a general fire-risk score or a material safety certification.'),
  derived: definition('Derived summary', 'A number calculated from already reported results, such as a difference between oxygen limits. It does not represent a new experiment.'),
  summary: definition('Reported experimental summary', 'An experimental value summarized by the source, rather than a complete record of an individual raw trial.')
});

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

/** Use passive text inside an existing button; the default creates a button. */
export function term(key, label = key, { passive = false } = {}) {
  if (!Object.hasOwn(definitions, key)) return escapeHtml(label);
  const attributes = `class="science-term" data-termkey="${escapeHtml(key)}" data-term="${escapeHtml(key)}"`;
  if (passive) return `<span ${attributes}>${escapeHtml(label)}</span>`;
  return `<button type="button" ${attributes} aria-label="${escapeHtml(label)}: definition">${escapeHtml(label)}</button>`;
}

let disposeGlossary;

/** One delegated controller supports terms inserted by later view renders. */
export function initGlossary() {
  if (disposeGlossary) return disposeGlossary;

  const tooltip = document.createElement('div');
  tooltip.id = 'science-glossary-tooltip';
  tooltip.className = 'science-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  // A top-layer portal also stays above native modal dialogs and clipped tables.
  const usesPopover = typeof tooltip.showPopover === 'function';
  if (usesPopover) tooltip.setAttribute('popover', 'manual');
  document.body.append(tooltip);

  let active = null;
  let pinned = false;
  let priorDescription = null;
  let hideTimer = 0;
  let frame = 0;
  let dismissed = null;
  const controller = new AbortController();
  const { signal } = controller;
  const listen = (target, name, handler, options = {}) => target.addEventListener(name, handler, { ...options, signal });
  const triggerAt = target => target instanceof Element ? target.closest('.science-term[data-termkey]') : null;
  const cancelHide = () => { window.clearTimeout(hideTimer); hideTimer = 0; };
  const within = (element, target) => target instanceof Node && element?.contains(target);

  function hide() {
    cancelHide();
    window.cancelAnimationFrame(frame);
    frame = 0;
    if (active) {
      if (priorDescription === null) active.removeAttribute('aria-describedby');
      else active.setAttribute('aria-describedby', priorDescription);
      active.classList.remove('science-term-open');
    }
    active = null;
    pinned = false;
    if (usesPopover && tooltip.matches(':popover-open')) tooltip.hidePopover();
    tooltip.hidden = true;
  }

  function position() {
    frame = 0;
    if (!active) return;
    if (!active.isConnected || !active.getClientRects().length) { hide(); return; }
    const viewport = window.visualViewport;
    const bounds = {
      left: viewport?.offsetLeft ?? 0,
      top: viewport?.offsetTop ?? 0,
      width: viewport?.width ?? window.innerWidth,
      height: viewport?.height ?? window.innerHeight
    };
    const gap = 9;
    const margin = 12;
    tooltip.style.maxWidth = `${Math.max(1, bounds.width - margin * 2)}px`;
    tooltip.style.maxHeight = `${Math.max(1, bounds.height - margin * 2)}px`;
    const rect = active.getBoundingClientRect();
    const size = tooltip.getBoundingClientRect();
    if (rect.bottom < bounds.top || rect.top > bounds.top + bounds.height || rect.right < bounds.left || rect.left > bounds.left + bounds.width) { hide(); return; }
    let left = rect.left + rect.width / 2 - size.width / 2;
    left = Math.max(bounds.left + margin, Math.min(left, bounds.left + bounds.width - size.width - margin));
    let top = rect.bottom + gap;
    if (top + size.height > bounds.top + bounds.height - margin) top = rect.top - size.height - gap;
    top = Math.max(bounds.top + margin, Math.min(top, bounds.top + bounds.height - size.height - margin));
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function requestPosition() {
    if (active && !frame) frame = window.requestAnimationFrame(position);
  }

  function show(trigger, pin = false) {
    const entry = definitions[trigger.dataset.termkey];
    if (!entry) return;
    cancelHide();
    if (active !== trigger) {
      hide();
      active = trigger;
      priorDescription = trigger.getAttribute('aria-describedby');
      const descriptions = new Set((priorDescription ?? '').split(/\s+/).filter(Boolean));
      descriptions.add(tooltip.id);
      trigger.setAttribute('aria-describedby', [...descriptions].join(' '));
      tooltip.innerHTML = `<strong class="science-tooltip-title">${escapeHtml(entry.title)}</strong><span class="science-tooltip-body">${escapeHtml(entry.description)}</span>`;
      (trigger.closest('dialog[open]') ?? document.body).append(tooltip);
      tooltip.hidden = false;
      if (usesPopover) tooltip.showPopover();
      trigger.classList.add('science-term-open');
    }
    pinned = pin || pinned;
    position();
  }

  function queueHide() {
    cancelHide();
    if (pinned) return;
    hideTimer = window.setTimeout(() => {
      if (!active || document.activeElement === active || active.matches(':hover') || tooltip.matches(':hover')) return;
      hide();
    }, 170);
  }

  listen(document, 'pointerover', event => {
    if (event.pointerType === 'touch') return;
    const trigger = triggerAt(event.target);
    if (!trigger || within(trigger, event.relatedTarget) || (pinned && active !== trigger) || dismissed === trigger) return;
    show(trigger);
  });
  listen(document, 'pointerout', event => {
    const trigger = triggerAt(event.target);
    if (!trigger || within(trigger, event.relatedTarget)) return;
    if (dismissed === trigger) dismissed = null;
    if (active === trigger && !within(tooltip, event.relatedTarget)) queueHide();
  });
  listen(tooltip, 'pointerenter', cancelHide);
  listen(tooltip, 'pointerleave', queueHide);
  listen(document, 'focusin', event => {
    const trigger = triggerAt(event.target);
    if (trigger && dismissed !== trigger) show(trigger);
  });
  listen(document, 'focusout', event => {
    const trigger = triggerAt(event.target);
    if (dismissed === trigger) dismissed = null;
    if (active === trigger && !within(tooltip, event.relatedTarget)) {
      pinned = false;
      queueHide();
    }
  });
  listen(document, 'click', event => {
    const trigger = triggerAt(event.target);
    if (!trigger) return;
    // Prevent a term from triggering the dashboard's delegated row actions.
    event.preventDefault();
    event.stopPropagation();
    if (active === trigger && pinned) {
      dismissed = trigger;
      hide();
    } else {
      dismissed = null;
      show(trigger, true);
    }
  }, { capture: true });
  listen(document, 'pointerdown', event => {
    if (active && !within(active, event.target) && !within(tooltip, event.target)) {
      dismissed = active;
      hide();
    }
  }, { capture: true });
  listen(document, 'keydown', event => {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      event.stopPropagation();
      dismissed = active;
      hide();
    }
  }, { capture: true });
  listen(document, 'scroll', requestPosition, { capture: true, passive: true });
  listen(window, 'resize', requestPosition, { passive: true });
  listen(window, 'blur', hide);
  listen(document, 'close', event => {
    if (active && event.target instanceof HTMLDialogElement && event.target.contains(active)) hide();
  }, { capture: true });
  if (window.visualViewport) {
    listen(window.visualViewport, 'resize', requestPosition, { passive: true });
    listen(window.visualViewport, 'scroll', requestPosition, { passive: true });
  }
  // A view can replace its markup without a focus or scroll event.
  const observer = new MutationObserver(() => { if (active && !active.isConnected) hide(); });
  observer.observe(document.body, { childList: true, subtree: true });

  disposeGlossary = () => {
    hide();
    controller.abort();
    observer.disconnect();
    tooltip.remove();
    disposeGlossary = undefined;
  };
  return disposeGlossary;
}
