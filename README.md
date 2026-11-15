# my-world

An explorable 3D character sheet for Sohaib Qutub — a fantasy-RPG take on a portfolio.
Seven floating realms (Character, Quests, Skills, Trophies, Pursuits, Guilds, Portal) built with three.js.

## Run

No build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

To publish, enable GitHub Pages for the repository (Settings → Pages → deploy from branch, root).

## Edit

All content lives in `js/data.js`. The scene and navigation are in `js/main.js`, styling in `css/style.css`.
three.js r170 is vendored in `vendor/three` (MIT).
The 3D props in `assets/models` were generated with Meshy and compressed with gltf-transform.

The islands are grouped by the places I have lived, in order: Makkah (Hejaz courtyard, date palms, roshan house, the farm), Swansea (lighthouse, castle ruin, red dragon, drizzle) and Melbourne (tram, sandstone arch, gum trees, laneway lamps). Each land sets its own sky, fog and light; see `lands` in `js/data.js`.

Controls: scroll, swipe, arrow keys, `1`–`7`, the hotbar, or click an island. On the Archery Range, click the target (or press space) to shoot.
Each realm has a link, e.g. `#quests`. `#summary` opens the plain one-page version, which also prints cleanly to PDF and is shown automatically when WebGL is unavailable.

After changing any file in `js/` or `css/`, bump the `?v=` number in `index.html` and in the `data.js` imports at the top of `js/main.js` and `js/summary.js`, so browsers fetch the new version instead of a cached one.

Logos in `assets/logos` belong to their organisations and are shown only to identify where I study and take part: University of Melbourne (Wikimedia), Trinity College, Olchfa School and CISSA (their own websites). The Saudi Students Association in Melbourne (SSAM) logo is the club's official logo, supplied by me. The leavers-hoodie print is redrawn in code (`hoodiePrint` in `js/main.js`).

The hero figure (`assets/models/me.glb`) was generated with Meshy from a photo of me; the lower thobe and trainers are added in code.

The car at the camp (`assets/models/car.glb`) is my silver 2005 Holden Astra CD hatchback, generated with Meshy; its number plates are left blank.

Saudi touches: the Saudi flag (Wikimedia Commons) flies over the Makkah island with a camel, a falcon, a majlis with dallah and dates (Meshy models); Al Sadu weave is drawn in code for the rugs and the panel trim; the Melbourne camp is a kashta; every place has its Arabic name; a crescent replaces the full moon.
