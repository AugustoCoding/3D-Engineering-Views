# Three.js Industrial Plant — Benzoic Acid

A navigable 3D model of a benzoic acid plant (15,840 t/year), built for an
undergraduate chemical engineering design project. The plant is fictional,
sited in Paulínia, Brazil.

It runs in the browser from a **single HTML file**: no install, no server, no
internet connection. It also opens with a double click.

**Live demo:** the link is in the *About* section of this repository, published
by GitHub Pages on every push to `main`.

## Features

- **First-person camera** with game-style controls. Fly over the site or walk
  on the ground, and use an Xbox controller if you have one.
- **Process area** with the toluene oxidation reactor, flash stripper,
  crystallizers, rotary filters, dissolver, storage tank, pumps, a pipe rack,
  piping, valves and instrumentation.
- **Plant surroundings**: roads, tank farm, utilities, water and wastewater
  treatment, buildings you can walk into, traffic and people with daily
  routines.
- **Guided tour** that plays through the plant on its own.
- **Night mode**, a site plan view, a pipe color legend (NBR 6493) and preset
  viewpoints.

## Controls

| Key | Action |
|---|---|
| Drag / W A S D | Look around / move |
| Shift | Run |
| Space / Ctrl | Up / down |
| Space twice | Switch between flying and walking |
| 1–9 | Preset viewpoints |
| G | Guided tour (Space pauses, ← → skip, Esc stops) |
| P | Site plan view |
| N | Day / night |
| C | Pipe color legend |
| M | Companion who follows you while walking |
| H | Hide the interface |
| ? | Help, including Xbox controller mapping |

## How it is built

Nothing is modeled by hand: **all geometry is computed from the design
data**. Change a vessel diameter in `src/data/` and the shell, heads,
nozzles, liquid level and supports update together. Values that are
estimates rather than design figures are marked `[ESTIMADO]` or
`[VERIFICAR]` in the data files.

| Folder | Contents |
|---|---|
| `src/data/` | Design data: equipment, P&ID topology, layout, piping routes, site |
| `src/lib/` | Reusable parametric primitives (heads, shells, nozzles, pipes, pumps…) |
| `src/equipment/` | Equipment assembled from primitives |
| `src/site/` | Site, buildings, traffic, tour, night mode |
| `src/core/` | Scene, camera, materials, interface |
| `src/dev/` | Consistency checks run from the browser console |

Code and comments are in Portuguese. [`CLAUDE.md`](CLAUDE.md) describes the
architecture and working method in detail.

## Running locally

```bash
npm install
npm run dev          # http://localhost:5180
npm run artifact     # builds the single-file HTML in artifact/
```

## License

[MIT](LICENSE). This is an academic exercise: the process figures serve the
model and are not a substitute for real engineering design.
