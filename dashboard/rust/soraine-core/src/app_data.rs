// Written from the icon paths and world captions in dist/app.mjs; parity.rs checks every entry.
/// (name, SVG path data)
pub const ICON_PATHS: [(&str, &str); 18] = [
    ("polymer", "M5 7 12 3l7 4v10l-7 4-7-4V7m0 0 7 4 7-4m-7 4v10"),
    ("film", "M6 3h9l4 4v14H6V3m9 0v5h4M3 7v14"),
    ("fabric", "M4 4h16v16H4V4m4 0v16m4-16v16m4-16v16M4 8h16M4 12h16M4 16h16"),
    ("orbit", "M21 12a9 9 0 1 1-9-9M3 20 20 3M16 3h5v5"),
    ("grid", "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"),
    ("chart", "M4 19V5m0 14h17M8 15v-4m5 4V7m5 8V3"),
    ("layers", "m12 3 9 5-9 5-9-5 9-5m-9 9 9 5 9-5M3 16l9 5 9-5"),
    ("book", "M3 4h6q3 0 3 3v14q0-3-3-3H3V4m18 0h-6q-3 0-3 3v14q0-3 3-3h6V4"),
    ("info", "M12 10v7m0-10v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"),
    ("download", "M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"),
    ("search", "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"),
    ("arrow", "M4 12h16m-6-6 6 6-6 6"),
    ("external", "M14 3h7v7m-10 3L21 3M10 3H3v18h18v-7"),
    ("flame", "M13 2c1 8-8 7-8 14a7 7 0 0 0 14 0c0-4-2-7-5-9 1 5-4 5-1-5"),
    ("pause", "M8 5v14M16 5v14"),
    ("play", "m8 4 12 8-12 8V4"),
    ("reset", "M3 10a9 9 0 1 1 1 8M3 4v6h6"),
    ("database", "M21 5c0 2-4 3-9 3S3 7 3 5s4-3 9-3 9 1 9 3M3 5v14c0 2 4 3 9 3s9-1 9-3V5M3 12c0 2 4 3 9 3s9-1 9-3"),
];

/// What the stage shows for each gravity environment.
pub struct WorldInfo {
    pub world: &'static str,
    pub title: &'static str,
    pub g: &'static str,
    pub sub: &'static str,
    pub name: &'static str,
    pub caption: &'static str,
}

pub const WORLD_INFO: [WorldInfo; 4] = [
    WorldInfo { world: "Moon", title: "Lunar gravity", g: "0.16", sub: "Nominal lunar category", name: "The Moon", caption: "A different gravity. A different combustion story." },
    WorldInfo { world: "Mars", title: "Martian gravity", g: "0.38", sub: "Nominal Martian category", name: "Mars", caption: "Compare the evidence before the next frontier." },
    WorldInfo { world: "Earth", title: "Earth gravity", g: "1.00", sub: "Normal-gravity reference", name: "Earth", caption: "The familiar baseline. Not the whole picture." },
    WorldInfo { world: "Microgravity", title: "Orbital laboratory", g: "≈ 0", sub: "Free-fall environment", name: "Microgravity", caption: "Inside an orbiting habitat, objects fall together." },
];
