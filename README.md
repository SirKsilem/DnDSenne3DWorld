# DnD 3D World

A walkable 3D map of our campaign world that runs in the browser. Plain HTML + JavaScript with
[Three.js](https://threejs.org/) loaded from a CDN: no build step, no Node.js, works on any web host.

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
| Space | Jump |
| E, or click a building | Read about a place |
| M | Toggle the big map |
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
To force a mode, add `?touch` or `?desktop` to the address, e.g. `http://localhost:8000/?touch`.

The bottom-right corner shows your `x` / `z` position, which is handy for deciding where to put a new location.

## Adding your own locations

Everything about the world lives in [`data/locations.json`](data/locations.json). Edit it and refresh the page.

```json
{
  "id": "thornwick",
  "name": "Thornwick",
  "type": "town",
  "x": 0,
  "z": 0,
  "rotation": 0,
  "description": "First paragraph.\n\nSecond paragraph."
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Shown on the label, map and info panel. |
| `x`, `z` | yes | Position in metres. The map runs from -300 to 300 on both axes; keep places within about ±190 so they don't end up in the mountains. `-z` is north. |
| `type` | no | Which placeholder to build: `town`, `tavern`, `tower`, `castle`, `ruins`, `cave`, `camp`, `shrine`, `landmark` (default). |
| `id` | no | Short name used by roads and links. Generated from `name` if left out. |
| `description` | no | Text for the info panel. A blank line (`\n\n`) starts a new paragraph. |
| `subtitle` | no | Replaces the small heading above the name (e.g. `"Capital of Eastmarch"`). |
| `rotation` | no | Turn the building, in degrees. Entrances face south (`+z`) at 0. |
| `scale` | no | Make the placeholder bigger or smaller (e.g. `1.5`). |
| `radius` | no | Size of the flattened, tree-free area and the "Press E" range. |
| `labelHeight` | no | How high the floating name sits. |
| `model` | no | Path to your own `.glb` model (see below). |
| `collisionRadius` | no | With `model`: how big an area (in metres) blocks walking. |

Watch the commas: a missing or extra comma makes the whole file invalid. If the page shows
"The world failed to load", the message tells you roughly where the mistake is.

### Lakes and roads

```json
"lakes": [
  { "name": "Mirrormere", "x": -65, "z": 65, "radius": 45 }
],
"roads": [
  ["greywatch-keep", "thornwick", "gilded-flagon"],
  ["thornwick", [90, -40], "spire-of-aldren"]
]
```

A road is a list of stops: location `id`s or `[x, z]` points to bend around things.

### Start position

`"spawn": { "x": 0, "z": 45, "lookAt": [0, 0] }` sets where visitors start.
You can also link straight to a place by adding its id to the URL, e.g. `http://localhost:8000/#rotfang-cave`.

## Using real 3D models

Placeholders are built from simple shapes. To use a proper model, export or download a `.glb` file
(from Blender, or free sites like [Poly Pizza](https://poly.pizza), [Kenney](https://kenney.nl/assets) or
[Sketchfab](https://sketchfab.com)), put it in the `models/` folder and point to it:

```json
{ "name": "Thornwick", "x": 0, "z": 0, "model": "models/thornwick.glb", "scale": 2, "collisionRadius": 8 }
```

If the model fails to load, the placeholder for `type` is used instead and the browser console says why.

## Putting it online

It's a static site, so any host works: copy the files to a regular PHP/Apache web host, or turn on
**GitHub Pages** for this repository (Settings → Pages → deploy from branch).

## Project layout

```
index.html            page shell, HUD and menus
css/style.css         styling
data/locations.json   your world: locations, lakes, roads, spawn
js/main.js            sets up the scene and runs the game loop
js/terrain.js         landscape, lakes, roads, trees and rocks
js/locations.js       placeholder buildings and model loading
js/player.js          walking, jumping and collisions
js/ui.js              info panel, prompts and minimap
js/touch.js           phone/tablet detection and on-screen controls
models/               your .glb files
```

Terrain shape (hills, mountain ring, map size) is tweaked at the top of `js/terrain.js`.
