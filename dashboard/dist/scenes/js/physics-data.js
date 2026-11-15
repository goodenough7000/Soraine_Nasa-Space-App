/* World data from Tony's repository (github.com/TonySama-BoiledCabbage/Soraine_Nasa-Space-App, data/scenarios.json),
 * copied unchanged: gravity g in m/s2, the flame-shape numbers and the facts with their sources.
 * Tony's note: "g values: NASA planetary fact sheets (Earth 9.81, Mars 3.71, Moon 1.62). ISS: effective microgravity ~1e-6 g,
 * quoted as ~0 for display. Flame shape fields are schematic heuristics for the visual, not measurements."
 * A fact's src is a named source, or 'schematic' (illustrative), or 'unverified'. The page shows those labels.
 * To update: paste the new scenarios here. STOP_TO_SLUG maps this site's stops to Tony's slugs.
 */
window.SORAINE_SCENARIOS = [
 {
  "slug": "earth",
  "label": "Earth",
  "g": 9.81,
  "flame": {
   "height": 1.0,
   "width": 1.0,
   "blue": 0.0,
   "sphere": 0.0,
   "flicker": 1.0
  },
  "facts": [
   {
    "k": "Gravity",
    "v": "9.81 m/s²",
    "src": "NASA fact sheet"
   },
   {
    "k": "Flame shape",
    "v": "teardrop, buoyant plume",
    "src": "schematic"
   },
   {
    "k": "Hot gas rises",
    "v": "yes, fast convection",
    "src": "schematic"
   }
  ]
 },
 {
  "slug": "mars",
  "label": "Mars",
  "g": 3.71,
  "flame": {
   "height": 0.68,
   "width": 1.25,
   "blue": 0.15,
   "sphere": 0.12,
   "flicker": 0.6
  },
  "facts": [
   {
    "k": "Gravity",
    "v": "3.71 m/s²",
    "src": "NASA fact sheet"
   },
   {
    "k": "Flame shape",
    "v": "shorter, wider plume",
    "src": "schematic"
   },
   {
    "k": "Buoyant velocity",
    "v": "~0.6× Earth",
    "src": "unverified"
   }
  ]
 },
 {
  "slug": "moon",
  "label": "Moon",
  "g": 1.62,
  "flame": {
   "height": 0.48,
   "width": 1.5,
   "blue": 0.35,
   "sphere": 0.35,
   "flicker": 0.35
  },
  "facts": [
   {
    "k": "Gravity",
    "v": "1.62 m/s²",
    "src": "NASA fact sheet"
   },
   {
    "k": "Flame shape",
    "v": "squat dome",
    "src": "schematic"
   },
   {
    "k": "Buoyant velocity",
    "v": "~0.4× Earth",
    "src": "unverified"
   }
  ]
 },
 {
  "slug": "iss",
  "label": "ISS",
  "g": 0.0,
  "flame": {
   "height": 0.3,
   "width": 1.9,
   "blue": 0.85,
   "sphere": 1.0,
   "flicker": 0.08
  },
  "facts": [
   {
    "k": "Gravity",
    "v": "≈ 0 (microgravity)",
    "src": "NASA"
   },
   {
    "k": "Flame shape",
    "v": "spherical, dim blue",
    "src": "NASA FLEX/ACME"
   },
   {
    "k": "Hot gas rises",
    "v": "no — diffusion only",
    "src": "NASA FLEX/ACME"
   }
  ]
 }
];
window.SORAINE_STOP_TO_SLUG = { earth: 'earth', moon: 'moon', mars: 'mars', orbit: 'iss' };
