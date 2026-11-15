# Soraine shared information layer

Ethan builds Moon. Johnson builds Mars. Hogan supplies the reusable facts, result panels and source links. Both scenes use the same information file and object IDs. The information layer does not control scene art, camera movement or flame animation.

## Files to give both scene builders

- `soraine-information.json`: object catalogue, ready-to-use copy, scene/atmosphere presets, 22 selectable test cases, 89 retained evidence records, findings and source links.
- `info-adapter.mjs`: a small lookup function that returns panel content. It has no rendering dependencies and does not change a scene.
- `information-types.d.ts`: the shared selection contract.
- `examples/`: resolved Moon, Mars and missing-data panels.

Use the existing master research bundle as the full contributor archive. This file keeps the current canonical evidence and its original Hogan/Ethan/Tony attribution. Do not import archived, superseded values into the panel.

## What clicking each object shows

| Click target | Main information | Numeric research | Scope |
|---|---|---|---|
| Stove / burner | Fuel + oxygen + ignition energy; why ventilation matters | Current cabin settings only | Explains the mechanism; does not calculate ignition |
| Pan / egg | Familiar introduction; links to tested materials | No invented pan temperature, cooking time or risk score | The actual pan coating and food are not tested specimens in this collection |
| Fuel canister | Fuel supply versus cabin air; distinction between tank and cabin pressure | No tank pressure or fuel level without a dataset | Cabin pressure is absolute pressure, not tank pressure |
| Plant | Visual context and links to material samples | No flammability score | No matching plant/soil/pot study in this collection |
| Utensils / crumbs / water droplets | Partial-gravity motion | Scene gravity only | Free water droplets are not the molten polymer droplets observed on wires |
| **Ultem 1000 sample** | Oxygen-limit result, exact film thickness, test method | Earth, microgravity, lunar and Martian endpoints | An identified PEI sample, not an assumed pan-handle material |
| **Nomex HT90-40 sample** | Fabric result, pressure and method | Earth, microgravity, lunar and Martian endpoints | An identified fabric sample, not every kitchen towel |
| **LDPE-coated wire sample** | Flame-spread rate, outcome, oxygen, pressure and airflow | Martian-gravity Table 1 cases | Exact NiCr core / LDPE coating configuration |
| PET film sample | PET evidence with product-grade labels | Mylar G low-g and Melinex 515 Earth endpoints | Grades differ; show this in comparisons |
| PMMA rod sample | BASS-II finding and related LUCI records | Separate reported endpoints and flame-motion fits | Do not mix different rod diameters or motion metrics |
| Smoke detector | SAME finding and relevance to detection | Reported smoke statistics when opened | No fabricated live smoke reading or alarm timer |
| Water-mist research | What published equipment tests investigated | Source-specific findings | No universal Moon/Mars extinguishing time |

The three bold material samples are the shortest useful build. They can sit in a sample tray, appear as labelled hotspots, or open through the pan panel. Their mesh shape is up to the scene owner. Keep the exact sample name visible.

## One panel layout in every scene

1. **Identity:** object name, exact material grade and geometry where applicable.
2. **Explanation:** one sentence about why this object matters.
3. **Scene conditions:** destination gravity, cabin oxygen, absolute pressure and airflow. Label the atmosphere as illustrative.
4. **Published test:** the main measured result or reported endpoint, unit and evidence label.
5. **Test conditions:** the source's gravity, oxygen, pressure, flow, apparatus and duration. These stay separate from scene settings.
6. **Compare:** compatible published cases, shown side by side with their methods visible.
7. **Source and scope:** paper link, table/page and the qualification needed to interpret the result.

Keep sections 1-4 visible first. Put the detailed conditions, definitions and references behind clear expandable sections. Always show the test pressure beside an oxygen endpoint. Do not conceal a different test method inside a tooltip.

## Concrete panels for the demo

| Selected object and destination | Main result | Necessary context |
|---|---|---|
| Ultem sample, Moon | **21% O2: flame survived the short drop** (ULOI*) | 10.2 psia, about 70.3 kPa; nominal lunar gravity; 10 mil film; drop-tower centrifuge. MOC* = 19.9% O2. |
| Ultem sample, Mars | **22% O2: flame survived the short drop** (ULOI*) | Same reported material/pressure; nominal Martian gravity. MOC* = 21.1% O2. |
| Nomex sample, Moon | **21% O2: flame survived the short drop** (ULOI*) | 14.7 psia, about 101.4 kPa; 12 mil HT90-40 fabric. MOC* = 19.9% O2. |
| Nomex sample, Mars | **19.9% O2: flame survived the short drop** (ULOI*) | 14.7 psia; same fabric grade. MOC* = 19% O2. |
| Coated wire, Mars | **1.38 mm/s measured downward flame spread** | 0.38 g; 19% O2; 101.3 kPa; 150 mm/s opposed airflow; Table 1. One experiment per condition. |
| Coated wire, Moon | **No matching test in this collection** | Offer the related Martian study with its own gravity label. Do not copy its value into the Moon panel. |

The oxygen endpoints describe already ignited material under the study's procedure. They are not oxygen levels that cause spontaneous ignition. Earth ULOI/MOC use different criteria from low-g ULOI*/MOC*. MOC means **maximum oxygen concentration** under the defined extinguishment criterion. It is not a universal minimum oxygen requirement.

Sources: [Olson and Ferkul, Table I and methods](https://ntrs.nasa.gov/api/citations/20130010991/downloads/20130010991.pdf), [Li et al., wire study](https://doi.org/10.1016/j.proci.2024.105255). The source PDF and the existing research extraction were checked against these values. Li Tables 1 and 2 give different rates at an apparently shared condition; keep the tables as distinct series and default the oxygen view to Table 1.

## Shared scene state

```ts
type Selection = {
  objectId: string;             // e.g. "sample-wire"
  sceneId: "earth" | "moon" | "mars" | "microgravity";
  atmosphereId?: string;        // defaults to "illustrative-air"
  caseId?: string;              // a published case belonging to this material/scene
  cabinOverrides?: {
    oxygen_percent?: number | null;
    pressure_kpa_absolute?: number | null;
    airflow_mm_s?: number | null;
  };
};
```

Both Moon and Mars default to the same **illustrative air-filled cabin**: 21% oxygen and 101.325 kPa absolute pressure. This is a design preset, not either planet's outside atmosphere or a measurement from a habitat. Airflow is not set. A separate 30% oxygen / 10.2 psia illustrative preset is available. Changing destination does not change the chosen atmosphere.

The research result always keeps its original conditions. For example, selecting the Moon does not convert the 70.3 kPa Ultem test into a 101.3 kPa test. Sliders update the scene-condition display only. They do not interpolate research values or drive a numerical fire prediction.

## Plug-in example

```js
import { getObjectPanel } from './info-adapter.mjs';

const data = await fetch('/data/soraine-information.json').then(r => r.json());
const panel = getObjectPanel(data, {
  objectId: 'sample-ultem',
  sceneId: 'moon',
  atmosphereId: 'illustrative-air'
});
// Pass panel to the shared InfoPanel component.
// Scene code handles the camera and selected-mesh highlight separately.
```

If separate modules need an event, use one event name:

```js
window.dispatchEvent(new CustomEvent('soraine:inspect', {
  detail: { objectId: 'sample-wire', sceneId: 'mars', atmosphereId: 'illustrative-air' }
}));
```

The application shell listens once, calls `getObjectPanel`, and opens the shared panel. A React scene can call the same handler through a prop instead of using a window event. Store stable IDs in `mesh.userData.infoId`. Do not identify objects by screen coordinates, material colour or array position.

## Combining teammates' modules

| Module | Owns | Passes to the shared layer |
|---|---|---|
| Ethan's Moon | Meshes, lighting, camera anchors, transition and lunar motion | `sceneId: "moon"`, stable clicked `objectId` |
| Johnson's Mars | Meshes, lighting, camera anchors, transition and Martian motion | `sceneId: "mars"`, stable clicked `objectId` |
| Shared app state | Current destination, selected object, cabin settings, open panel | A `Selection` object |
| Hogan's information | Copy, exact materials, research results, case definitions and citations | The same panel data for either renderer |

Before merging, agree on the IDs. Mesh names may differ; use the registry's aliases or attach the canonical `infoId`. Additional objects need their own registry entry and an honest evidence role. A rocket model should link to cabin materials, not imply rocket-engine combustion is covered.

## Display rules

- Use blue for selection, with a text label. Do not colour an object red based only on proximity and call it a computed fire risk.
- Use text badges for **Reported experiment**, **Reported test endpoint**, **Fit to experiment**, **Model estimate** and **Illustrative animation**. Colour alone is insufficient.
- Preserve nulls. Show “Not reported” for missing values and “No experiment reported” for an untested condition. Extinction is an outcome marker, not a spread rate of zero.
- Do not plot unlike metrics on one axis, rank materials tested at different pressures, or average conflicting table entries.
- Expose the distinction between NASA's **Physical Science Informatics (PSI)** database and **psi**, the pressure unit. Display cabin pressure as kPa absolute, optionally followed by psia.
- Keep the source at the point of use. Each measurement returned by the adapter includes its source ID and location.

## What research is still useful

No broad archive scrape is needed for these panels. Further research is only needed if the team chooses a new exact material, wants measured cooking/tank behaviour, builds numerical smoke-alarm timing, or claims continuous fire predictions. The current collection supports a sourced evidence explorer and illustrative scenes.

For mechanism and smoke explanations: [NASA fire-protection brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-008-fire-protection.pdf), [NASA SAME overview](https://www.nasa.gov/wp-content/uploads/2025/07/smoke-aerosol-measurement-experiment-same.pdf).

## Validation

Run `node validate.mjs` from this folder. It checks references, IDs, missing-result behaviour, the checked Moon/Mars values, scene-setting isolation and incompatible comparisons. It also writes resolved panel examples. It does not validate a physical simulation, because this layer does not implement one.
