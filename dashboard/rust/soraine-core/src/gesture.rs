//! Port of `dist/touch-orbit.mjs`: one pointer rotates and glides to a stop,
//! two pointers pinch to zoom. This is the state machine only; the caller feeds
//! it pointer events and animation frames and applies what comes back.

const DAMPING: f64 = 0.07; // share of spin lost per 60 fps frame
const MIN_SPEED: f64 = 0.012; // px/ms: the glide ends below this
const MAX_SPEED: f64 = 3.2; // px/ms: cap for very hard flicks
const FLICK_WINDOW: f64 = 90.0; // ms: holding still at least this long cancels the glide
const FRAME: f64 = 1000.0 / 60.0;

/// What the caller must do after an event or a frame.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Step {
    /// Rotate by these pixel deltas.
    pub rotate: Option<(f64, f64)>,
    /// Zoom by this log ratio; negative means the fingers are spreading.
    pub zoom: Option<f64>,
    /// A gesture began.
    pub started: bool,
    /// The gesture and its glide are over.
    pub ended: bool,
    /// Call [`Orbit::frame`] on the next animation frame.
    pub wants_frame: bool,
}

#[derive(Debug, Clone, Default)]
pub struct Orbit {
    pointers: Vec<(i32, f64, f64)>,
    active: bool,
    gliding: bool,
    vx: f64,
    vy: f64,
    last_move: f64,
    interval: f64,
    pinch: f64,
    previous: f64,
}

impl Orbit {
    pub fn new() -> Self { Self::default() }
    pub fn is_gliding(&self) -> bool { self.gliding }

    fn spread(&self) -> f64 {
        let (a, b) = (self.pointers[0], self.pointers[1]);
        (a.1 - b.1).hypot(a.2 - b.2)
    }
    fn finish(&mut self, step: &mut Step) {
        self.gliding = false;
        self.previous = 0.0;
        self.vx = 0.0;
        self.vy = 0.0;
        if self.active { self.active = false; step.ended = true; }
    }

    /// `button` is the DOM `PointerEvent.button`; only the primary button starts a gesture.
    pub fn down(&mut self, id: i32, x: f64, y: f64, button: i16, now: f64) -> Step {
        let mut step = Step::default();
        if button != 0 || self.pointers.len() >= 2 { return step; }
        self.gliding = false;
        self.previous = 0.0;
        self.pointers.retain(|p| p.0 != id);
        self.pointers.push((id, x, y));
        self.vx = 0.0;
        self.vy = 0.0;
        self.interval = 0.0;
        self.last_move = now;
        self.pinch = if self.pointers.len() == 2 { self.spread() } else { 0.0 };
        if !self.active { self.active = true; step.started = true; }
        step
    }

    pub fn moved(&mut self, id: i32, x: f64, y: f64, now: f64) -> Step {
        let mut step = Step::default();
        let Some(point) = self.pointers.iter_mut().find(|p| p.0 == id) else { return step };
        let (dx, dy) = (x - point.1, y - point.2);
        point.1 = x;
        point.2 = y;
        if self.pointers.len() == 2 {
            let next = self.spread();
            if self.pinch > 0.0 && next > 0.0 { step.zoom = Some((self.pinch / next).ln()); }
            self.pinch = next;
            self.vx = 0.0;
            self.vy = 0.0;
            return step;
        }
        if dx == 0.0 && dy == 0.0 { return step; }
        let dt = (now - self.last_move).max(1.0);
        self.last_move = now;
        self.interval = dt;
        // Ease toward the newest finger speed so one noisy sample cannot set the flick.
        let blend = 1.0 - (-dt / 40.0).exp();
        self.vx += (dx / dt - self.vx) * blend;
        self.vy += (dy / dt - self.vy) * blend;
        step.rotate = Some((dx, dy));
        step
    }

    /// `cancelled` is true for `pointercancel`; `reduced_motion` disables the glide.
    pub fn up(&mut self, id: i32, cancelled: bool, reduced_motion: bool, now: f64) -> Step {
        let mut step = Step::default();
        let before = self.pointers.len();
        self.pointers.retain(|p| p.0 != id);
        if self.pointers.len() == before { return step; }
        self.pinch = 0.0;
        if !self.pointers.is_empty() {
            self.vx = 0.0;
            self.vy = 0.0;
            self.last_move = now;
            return step;
        }
        let speed = self.vx.hypot(self.vy);
        // On a slow frame rate moves arrive far apart, so the pause that cancels a glide scales with them.
        let held = now - self.last_move > FLICK_WINDOW.max(self.interval * 2.5);
        if cancelled || held || speed < MIN_SPEED * 4.0 || reduced_motion { self.finish(&mut step); return step; }
        if speed > MAX_SPEED { self.vx *= MAX_SPEED / speed; self.vy *= MAX_SPEED / speed; }
        self.previous = 0.0;
        self.gliding = true;
        step.wants_frame = true;
        step
    }

    /// One animation frame of the glide. `time` is the frame timestamp in ms.
    pub fn frame(&mut self, time: f64) -> Step {
        let mut step = Step::default();
        if !self.gliding { return step; }
        let dt = if self.previous != 0.0 { (time - self.previous).min(48.0) } else { FRAME };
        self.previous = time;
        step.rotate = Some((self.vx * dt, self.vy * dt));
        let decay = (1.0 - DAMPING).powf(dt / FRAME);
        self.vx *= decay;
        self.vy *= decay;
        if self.vx.hypot(self.vy) < MIN_SPEED { self.finish(&mut step); } else { step.wants_frame = true; }
        step
    }

    /// Drop every pointer and end any glide (used by "reset view").
    pub fn stop(&mut self) -> Step {
        let mut step = Step::default();
        self.pointers.clear();
        self.pinch = 0.0;
        self.finish(&mut step);
        step
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Runs glide frames 16.7 ms apart; returns (frames, total dx, ended).
    fn glide(orbit: &mut Orbit, mut clock: f64) -> (usize, f64, bool) {
        let (mut frames, mut distance, mut ended) = (0, 0.0, false);
        while orbit.is_gliding() && frames < 400 {
            clock += 16.7;
            let step = orbit.frame(clock);
            distance += step.rotate.map_or(0.0, |r| r.0);
            ended |= step.ended;
            frames += 1;
        }
        (frames, distance, ended)
    }

    #[test]
    fn one_finger_drag_rotates_then_glides_and_stops() {
        let (mut orbit, mut clock) = (Orbit::new(), 1000.0);
        assert!(orbit.down(1, 100.0, 100.0, 0, clock).started);
        for i in 1..=8 {
            clock += 12.0;
            let step = orbit.moved(1, 100.0 + f64::from(i) * 10.0, 100.0 + f64::from(i) * 3.0, clock);
            assert_eq!(step.rotate, Some((10.0, 3.0)));
        }
        clock += 8.0;
        let release = orbit.up(1, false, false, clock);
        assert!(release.wants_frame && !release.ended, "the glide keeps the gesture active");
        let (frames, distance, ended) = glide(&mut orbit, clock);
        // Same figures as the JavaScript unit test: 58 frames, 177.8 px.
        assert_eq!(frames, 58);
        assert!((distance - 177.8).abs() < 0.05, "{distance}");
        assert!(ended && !orbit.is_gliding());
    }

    #[test]
    fn a_pause_or_reduced_motion_means_no_glide() {
        let mut orbit = Orbit::new();
        orbit.down(1, 0.0, 0.0, 0, 0.0);
        orbit.moved(1, 30.0, 0.0, 10.0);
        let step = orbit.up(1, false, false, 210.0);
        assert!(step.ended && !step.wants_frame);
        orbit.down(1, 0.0, 0.0, 0, 300.0);
        orbit.moved(1, 30.0, 0.0, 310.0);
        let step = orbit.up(1, false, true, 315.0);
        assert!(step.ended && !step.wants_frame);
    }

    #[test]
    fn pinch_zooms_without_rotating_and_lifting_one_finger_does_not_jump() {
        let mut orbit = Orbit::new();
        orbit.down(1, 100.0, 100.0, 0, 0.0);
        assert!(!orbit.down(2, 200.0, 100.0, 0, 0.0).started);
        let step = orbit.moved(2, 300.0, 100.0, 10.0);
        assert_eq!(step.rotate, None);
        assert!((step.zoom.unwrap() - (100.0f64 / 200.0).ln()).abs() < 1e-12);
        assert!(orbit.moved(2, 150.0, 100.0, 20.0).zoom.unwrap() > 0.0, "pinching in zooms out");
        orbit.up(2, false, false, 20.0);
        assert_eq!(orbit.moved(1, 104.0, 100.0, 30.0).rotate, Some((4.0, 0.0)));
    }

    #[test]
    fn lifecycle_edges() {
        let mut orbit = Orbit::new();
        assert_eq!(orbit.down(5, 0.0, 0.0, 2, 0.0), Step::default(), "secondary buttons are ignored");
        assert_eq!(orbit.moved(5, 9.0, 0.0, 5.0), Step::default());
        orbit.down(1, 0.0, 0.0, 0, 10.0);
        orbit.moved(1, 40.0, 0.0, 20.0);
        assert!(orbit.up(1, false, false, 25.0).wants_frame);
        let again = orbit.down(2, 0.0, 0.0, 0, 30.0);
        assert!(!orbit.is_gliding() && !again.started, "a new touch takes over a glide");
        assert!(orbit.stop().ended);
        orbit.down(3, 0.0, 0.0, 0, 40.0);
        orbit.moved(3, 40.0, 0.0, 50.0);
        assert!(orbit.up(3, true, false, 52.0).ended, "pointercancel never glides");
    }

    #[test]
    fn slow_frame_rates_still_flick_but_a_real_hold_cancels() {
        let (mut orbit, mut clock) = (Orbit::new(), 0.0);
        orbit.down(1, 0.0, 0.0, 0, clock);
        for i in 1..=8 { clock += 110.0; orbit.moved(1, f64::from(i) * 10.0, f64::from(i) * 5.0, clock); }
        clock += 111.0;
        assert!(orbit.up(1, false, false, clock).wants_frame);
        let (frames, _, ended) = glide(&mut orbit, clock);
        assert!(frames > 10 && ended);
        orbit.down(1, 0.0, 0.0, 0, clock);
        for i in 1..=4 { clock += 110.0; orbit.moved(1, f64::from(i) * 10.0, 0.0, clock); }
        assert!(orbit.up(1, false, false, clock + 400.0).ended);
    }
}
