# Holmstead in 3D

A walkable, low-poly 3D version of **Holmstead**, the town from our D&D campaign, built from the
campaign map. It runs in the browser: plain HTML + JavaScript with [Three.js](https://threejs.org/)
loaded from a CDN, so there is no build step, no Node.js, and it works on any web host (GitHub Pages too).

Every building, the walls and gates, the castle, the river, the harbour basins, the fields and the
roads come straight from the map image (`data/holmstead/source-map.jpg`). On top of that, a handful
of places are built by hand with walkable interiors:

| Map | Place | What's there |
| --- | --- | --- |
| T7 | The Laughing Lantern | Tavern: bar, tables, fireplace, owlbear head |
| M13 | The Bubbling Flask | Alchemist: potion shelves, bubbling cauldron, glassware |
| R1 | The Morninghall | Temple of Lathander: nave, pews, sun-disc altar, stained glass |
| R2 | Shrine of the Anchor | Seafaring shrine to Valkur with the bronze anchor statue |
| B5 | Hammerfall Forge | Blacksmith: forge, anvil, bellows, weapon racks |
| R4 | Brightfurrow Farm | Farmhouse and barn, animals, fields |
| – | Kelemvor's Rest | Graveyard by the Monastery Road: common graves and a section of crypts (the big one is open) |
| S2/S3/H3/H4 | Holmstead Harbour | Docks, and the carrack *Wandering Gull*: deck, captain's cabin and hold |

North follows the map's compass: **west is the top of the map**, so the readout in the corner
says "N" when you face what is the right-hand side of the map.

## Running it

Browsers won't load the 3D modules from a file you double-click, so start a tiny local web server
in this folder. Any one of these works:

```bash
php -S localhost:8000
```

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

| Key | Action |
| --- | --- |
| Mouse | Look around (click the page first) |
| W A S D / arrows | Walk |
| Shift | Run |
| Space | Jump (or swim up) |
| E, or click a building | Read about a place |
| M, or click the minimap | Big map |
| Esc | Pause / travel menu |

**Phones and tablets** get on-screen controls automatically:

| Touch | Action |
| --- | --- |
| Left side: drag | Walk (a joystick appears under your thumb); drag past the ring to run |
| Right side: drag | Look around |
| Tap a building, or the "Read about…" button | Read about a place |
| Jump button | Jump |
| Tap the minimap | Big map |
| ☰ | Pause / travel menu |

A device counts as touch when its main pointer is a finger. Laptops with touchscreens use the
keyboard and mouse controls, but switch to touch controls as soon as you touch the screen.
To force a mode, add `?touch` or `?desktop` to the address.

You can link straight to a place by adding its id, e.g. `http://localhost:8000/#laughing-lantern`.

## Changing names and descriptions

Everything you'd want to edit as a DM is in [`data/holmstead/places.json`](data/holmstead/places.json):

- `places`: the hand-built locations. Change `name`, `kind` and `description` freely
  (a blank line, `\n\n`, starts a new paragraph). `x`/`z` are positions in metres; the corner of
  the screen shows your current `x`/`z`, so you can walk somewhere and copy the numbers.
- `districts`: the floating district names and their descriptions.
- `spawn`: where you start.

Watch the commas: a missing or extra comma makes the whole file invalid, and the page will say so.

## How it's built

```
index.html                 page shell, HUD and menus
css/style.css              styling
data/holmstead/            the town
  source-map.jpg           the campaign map everything is made from
  places.json              hand-built places, districts, spawn (edit this)
  world.json, buildings.json, heights.bin, ground.jpg, landuse.png, minimap.jpg
                           generated from the map by tools/extract_map.py
js/main.js                 loads everything, runs the game loop
js/engine/physics.js       walls, floors, stairs, decks (what you can walk on and bump into)
js/engine/kit.js           building kit used by the places (walls with doors, rooms, stairs, lights…)
js/engine/lights.js        the few real lights follow you to the nearest fires and lanterns
js/world/terrain.js        ground, river and water
js/world/city.js           map buildings, walls, gates, castle, quays, bridges, trees
js/places/*.js             the hand-built places
js/player.js, touch.js, ui.js   walking, touch controls, HUD and minimap
tools/extract_map.py       turns the map image into the generated data files
```

### Rebuilding from a changed map

If the map image changes, regenerate the data (needs Python with numpy and OpenCV):

```bash
pip install numpy opencv-python-headless
```

```bash
python3 tools/extract_map.py
```

The tool recognises the map by its colours (grey buildings, dark river, black walls). Roads outside
the walls and the bridges are traced by hand at the top of the script, so adjust those if they move.

### Adding a new hand-built place

1. Copy one of the files in `js/places/` (the smaller ones like `alchemist.js` are a good start).
2. Add an entry to `places` in `places.json` with `"module"` set to your file's name, its position,
   and `"footprint": true` if it should replace the building drawn on the map at that spot.
3. In the module, build with the kit in local coordinates: the origin is the building's centre
   on the ground and `+z` is the front, facing the street.

## Putting it online

It's a static site: copy the files to any web host, or use **GitHub Pages**
(Settings → Pages → deploy from `main`, folder `/`).
