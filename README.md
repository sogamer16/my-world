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

All content lives in `js/data.js`. `hero.seeking` is the line about what I'm looking for (Portal and CV); `hero.updated` is the date shown on the CV; `email` is stored in two parts. Quests with `featured: true` are marked "Start here". A quest can list links to its code, demo or photos: `links: [{ label: 'Code', href: 'https://…' }]`; they show on the Quests panel and in the plain view. A line in a quest's `objectives` can be a game, `{ game, play, text }`: its name becomes a ▶ link that opens the game straight to its menu (`play` is itch.io's direct game address, which changes when a new build is uploaded, so update it after re-uploading). The scene and navigation are in `js/main.js`, styling in `css/style.css`.
Type and colour: the page loads three font families, Cinzel (headings), Spectral (body) and Aref Ruqaa (Arabic). Oswald and Graduate are used only for the CISSA banner and the hoodie print and load after the page (`textureFonts` in `js/main.js`). Panels are 90% opaque and realm colours used as text go through `--accent-ink` (the colour lightened), so text passes WCAG AA contrast even in front of a bright sky. Nothing hides the keyboard focus ring; use `:focus-visible` and leave the outline on.
three.js r170 is vendored in `vendor/three` (MIT).
The 3D props in `assets/models` were generated with Meshy and compressed with gltf-transform (`gltf-transform draco in.glb out.glb`; WebP textures). The Draco decoder is vendored in `vendor/three/addons/libs/draco`. Models load a few at a time, the island in view and its neighbours first, with a progress bar on the title screen.

The islands are grouped by the places I have lived, in order: Makkah (Hejaz courtyard, date palms, roshan house, the farm), Swansea (lighthouse, castle ruin, red dragon, drizzle, and the Duke of Edinburgh Bronze Award medal, which carries the award's badge via `medalLogo` on that trophy in `js/data.js`) and Melbourne (tram, sandstone arch, gum trees, laneway lamps, and Wadi Abqar, where the skill tree grows). Each land sets its own sky, fog and light; see `lands` in `js/data.js`.

Plain names come first: each realm in `realms` (`js/data.js`) has `short` (the hotbar label, e.g. Projects) and `heading` (the panel title, e.g. Experience & projects); its fantasy `name` (Quests) stays on the island, in the hotbar tooltip and as a small italic line under the heading. Section titles, trophies (`plain`) and quest types work the same way: plain label, fantasy name after it. The Strengths radar shows the shape and the evidence, no scores.

Controls: scroll, swipe, arrow keys, `1`–`7`, the hotbar, or click an island. On the Archery Range, click the target (or press space) to shoot.
The title screen leads with the plain facts: name, role, a one-line pitch (`hero.pitch`), what I'm open to (the part of `hero.seeking` before the colon), two equal buttons (**Explore the world** and **View CV & projects**) and Email · LinkedIn · GitHub links. The fantasy title and the route sit below. A returning visitor sees **Continue · <realm>** and picks up at the realm they last read (remembered in the browser). The header has **CV** (the plain one-page version, printable to PDF) and **Contact**, a menu with email, LinkedIn, GitHub and a copy-email button, reachable from every realm. A one-time hint explains the Archery Range on first visit.
Each realm has a link, e.g. `#quests`, and so does each quest or pursuit, e.g. `#quests/sentinel` (opening one puts its link in the address bar). Every panel ends with a "Next chapter" button. `#summary` opens the plain one-page version, which also prints cleanly to PDF and is shown automatically when WebGL is unavailable.

After changing any file in `js/` or `css/`, bump the `?v=` number in `index.html` and in the `data.js` imports at the top of `js/main.js` and `js/summary.js`, so browsers fetch the new version instead of a cached one.

Logos in `assets/logos` belong to their organisations and are shown only to identify where I study and take part: University of Melbourne (Wikimedia), Trinity College, Olchfa School and CISSA (their own websites). The Saudi Students Association in Melbourne (SSAM) logo is the club's official logo, supplied by me. The Duke of Edinburgh's Award badge (`dofe.webp`, cropped to the oval) was supplied by me and is shown only to mark the Bronze Award I hold. The leavers-hoodie print is redrawn in code (`hoodiePrint` in `js/main.js`).

The hero figure (`assets/models/me.glb`) was generated with Meshy from a full-length photo of me.

The car at the camp (`assets/models/car.glb`) is my silver 2005 Holden Astra CD hatchback, generated with Meshy; its number plates are left blank.

Saudi touches: the Makkah island has a camel, a falcon, a majlis with dallah and dates (Meshy models); Al Sadu weave is drawn in code for the rugs and the panel trim; the Melbourne camp is a kashta; every place has its Arabic name; a crescent replaces the full moon.

Arab folklore: the Quests stones are the pillars of Iram (إرم ذات العماد); Sinbad's Rukh circles the islands, flapping its wings; a verse attributed to Antarah ibn Shaddad is carved by the archery range; the skill tree grows in Wadi Abqar (وادي عبقر), the valley of the jinn who inspired poets, where the word for genius comes from, and its jinn drift round the tree as wisps; tales of Juha rotate on the title screen. Content is in `folklore` in `js/data.js`.

The journey is told as one story in seven chapters. Short lines in Arabic and English on the Quests and Guilds panels (`mottos` in `js/data.js`); a Córdoba-style arch and a chess table on the archery island.
