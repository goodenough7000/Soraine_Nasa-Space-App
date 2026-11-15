# Shared scene information

`soraine-information.json` is the runtime source for both scenes and the navigator. It contains 15 objects, 5 material groups, 22 selectable cases, 89 evidence records, 52 sources and metadata for 24 PSI investigations.

The runtime pack is about 339 KiB. [DATA-STORAGE.md](DATA-STORAGE.md) explains why the current demo can use JSON directly and when SQLite would become useful.

Use `info-adapter.mjs` to resolve a clicked object's panel. It has no React or Three.js dependency. The TypeScript selection contract is in `information-types.d.ts`; `examples` contains concrete output for Moon Ultem, Mars wire and the missing lunar wire case.

```sh
node validate.mjs
```

The check covers references, IDs, published values, missing data and separation between scene atmosphere and research conditions. [INTEGRATION.md](INTEGRATION.md) gives the full object-by-object guide.

## Evidence boundaries

Measured results, experimental fits, reported endpoints and model estimates retain their own evidence labels. Partial-gravity findings come from specific experiments and papers; they are not measurements made on a lunar or Martian habitat.

The Ultem comparison uses already ignited 0.254 mm film in a 5.18-second drop-tower experiment at 10.2 psia. Its survival/extinction endpoints are not ignition thresholds or safe cabin limits. See the source and page attached to each record.

Null means a value is absent. Extinction is an outcome, not a numeric spread rate of zero. The Mars wire table is not a substitute for a missing Moon experiment. Different PET grades, pressures, sample geometries or methods remain visible rather than being ranked as equivalent materials.

## Provenance

The runtime JSON is byte-for-byte the shared information pack already handed to the team. SHA-256:

`fabb3723191a685eea9edda152ba9481e3455ca86e075399983f0c14cdd88088`

The [archive](archive/README.md) retains the full merged research, original contributor records, review decisions and earlier storyboard. Use its canonical evidence and the runtime pack for current panels; the contributor archive preserves original inputs and can include values superseded during the merge.

Research attribution stays attached to Hogan, Ethan and Tony. This contribution reorganizes their existing research; it does not claim their work as new research by one person.
