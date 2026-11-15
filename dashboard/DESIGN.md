# Soraine visual direction

SORAINE is the brand. Flame in Freefall is the project. “Fire safety beyond Earth” connects the planetary setting to the research purpose.

## Layout

Use open sections, generous space and thin dividers. Avoid grids of rounded cards. Let the planet establish the environment while the adjacent material comparison explains why it matters. Keep source links and test conditions beside the results.

The research interface is one part of Soraine. Moon and Mars scenes can open a relevant comparison or evidence record through `dist/scene-link.mjs`. The research module does not own scene cameras, physics or transitions.

## Typography and colour

- DM Sans for controls, data and body text; Instrument Serif italic for the main brand phrase.
- Background: `#05070d`; primary text: `#f1f2f4`; secondary text: `#a1a5af`.
- Electric blue: `#168bff`; cyan highlight: `#00b7ff`. Hogan's illuminated black-and-blue keyboard is the palette reference.
- Fine static blue glows mark active underlines, material icons and the main action. Keep body text neutral and preserve NASA image colours.
- Reserve strong colour for the active selection, comparison series and important actions.
- Material icons use the same inline SVG stroke style: polymer block for Ultem, layered film for Mylar, weave for Nomex. Always keep the written material name.
- Use a restrained scientific-instrument feel: thin blue corner marks, short label connectors and one small circular accent. Avoid dense HUD widgets, fake telemetry, or decorative readings. Static blue-to-black gradients provide depth without a heavy animated background.

## Motion and devices

Transitions use opacity and translation. Do not add full-screen blur or continuous layout animation. The planet pauses when hidden or outside the viewport. Reduced-motion preferences disable automatic rotation and decorative transitions. Material selection preserves the existing renderer and camera. The camera automatically fits the planet to the available canvas aspect ratio, including narrow desktop panels.

The material specimen has a separate Three.js renderer that draws on demand, with no automatic rotation. Keep it mounted when changing materials; release its resources when leaving the overview. Support pointer dragging, arrow-key rotation, zoom and reset. On touch screens, horizontal dragging rotates the sample while vertical swipes remain available for page scrolling. Keep the SVG fallback if 3D setup fails.

Small screens use a bottom research navigation, stacked sections, larger controls and labelled evidence rows. Horizontal drags rotate the planet; vertical swipes scroll. Small screens load smaller WebP maps; desktop retains the detailed NASA assets. Normal-map vectors are renormalized after resizing.

## Sound

The optional original soundtrack, **Quiet Orbit**, is a calm 3/4 ambient waltz. The header music icon opens play/pause, mute and volume controls. Music starts only on a Play gesture; opening the site does not download or play the audio. Volume and mute preferences persist locally, but playback never resumes automatically on reload. The player remains mounted during research navigation.

## Research presentation

Distinguish published limits, fitted results, reported summaries, derived summaries and model-derived values. Show pressure as absolute pressure and retain source units. Lunar and Martian gravity describe the experiments, not outdoor atmospheres. The globe is visual context. It does not calculate flame behaviour.

Material selection changes an original procedural 3D specimen and its two reported oxygen-limit markers. Physical shading distinguishes the amber Ultem sheet, clear Mylar film and woven Nomex fabric. Shapes, colours and surface shading are illustrative; they are not measured optical properties or reconstructions of individual test samples. Keep the reported oxygen markers separate from the model and do not animate predicted burning. Low-gravity limits retain their asterisks. Hover, focus or tap scientific terms to read their definitions.

The microgravity environment is an illustrative orbital laboratory with Earth beyond its window. Its floating props communicate free fall, rather than implying that Earth has disappeared or that the Moon has zero gravity.

Original data opens a focused record explorer. Keep source strings, headers, notes and blanks intact; offer a raw table as a secondary view. Source file links and provenance belong beside these records. Do not turn initial/final oxygen readings into extinction thresholds or count all CSV rows as independent trials.

Ethan's standalone prototype informed direct research navigation and plain-language material explanations. Retain the modular data connection and Three.js renderer. Avoid interpreting published oxygen limits as a general-purpose fire simulator.

## References and implementation

The layout study used [The Bluejack Group Dashboard on Awwwards](https://www.awwwards.com/sites/the-bluejack-group-dashboard), particularly its open metric columns and fine rules. [Anthropic’s frontend design article](https://claude.com/resources/articles/improving-frontend-design-through-skills) informed the emphasis on intentional typography, hierarchy and restrained motion. No reference artwork was copied.

The site remains JavaScript, Three.js, HTML and CSS with a Node backend. This pass reduces texture transfer, renderer churn and unnecessary animation. A Rust/Wasm module should be considered only for a measured CPU bottleneck, with a benchmark and an explicit data contract. It would not replace Three.js rendering or improve texture downloads by itself.
## Compact desktop overview

The overview uses a 60/40 composition on desktop windows at least 1100px wide and 760px tall. The planet, headline and archive counts occupy the open left stage. The right column keeps material inspection, oxygen limits, test conditions, gravity comparison and source records together. At 1080p, the core overview fits without page scrolling. Shorter or narrower windows retain normal scrolling; the analysis column can also scroll when needed for larger text.

The HUD reference informs the blue orbit guides, thin connectors and aligned labels. It does not add simulated telemetry, glass-card grids or extra animation. Counts retain their database meanings: reported results, experiment contexts, sources and file catalogue entries.

`dist/command-deck.css` scopes the compact layout to the overview. The complete Compare, Evidence, Original data and Sources views remain available. Earth first loads the existing lightweight NASA texture and then upgrades its detail; loading and retry states keep missing imagery from appearing as a finished globe.
