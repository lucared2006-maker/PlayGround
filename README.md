# Europa 1444

A complete, offline-playable grand strategy sandbox for mobile browsers. Begin on **1 January 1444** as any of **147 historical realms** on a **322-province** world map, then trade, marry, colonise, reform, rebel and conquer through to 1821.

No accounts, no servers, no build step. The whole game is vanilla JavaScript, Canvas and CSS.

## Play

```bash
npm start
# open http://localhost:3002
```

Any static file server works. On a phone, open the same URL over your local network and use **Add to Home Screen** for a full-screen offline app.

## What is in the game

- **Historical world map** — Natural Earth coastlines, rivers and lakes, with Voronoi provinces covering Europe, the Mediterranean, North Africa, the Middle East, Africa, Asia and the Americas. Political, terrain, religion, culture, development, military and trade map modes.
- **147 playable realms** with rulers, heirs, regencies, governments, religions, cultures, technologies, armies, fleets, treasuries and AI personalities.
- **Economy** — tax, production, trade nodes, dynamic goods, buildings, development, inflation, loans and debt.
- **Diplomacy** — relations, royal marriages, alliances, guarantees, military access, trade agreements, claims, vassals, personal unions, wars, peace negotiations, annexation, independence and aggressive-expansion coalitions.
- **War** — infantry, cavalry, archers, artillery and mercenaries, plus galleys, cogs and caravels. Morale, discipline, commanders, terrain, sieges, attrition, supply, recruitment, maintenance, blockades and war exhaustion.
- **Internal politics** — seven government types, reforms, laws, estates, centralisation, stability, legitimacy, republican tradition, unrest, rebels, succession crises and civil war.
- **Culture and faith** — conversion, accepted cultures, tolerance, assimilation and religious unrest.
- **Technology and institutions** — administrative, diplomatic and military branches, Renaissance, Printing Press, Colonialism and Enlightenment.
- **Dynamic history** — the Fall of Constantinople, the Reformation, the Age of Discovery, the Italian Wars, the Thirty Years' War, the French Revolution, Napoleon, and emergent alternate history.
- **AI** — realms budget, research, build, develop, convert, marry, ally, fabricate claims, declare wars, siege, colonise and make peace with their own interests.
- **Mobile-first controls** — drag to pan, pinch or wheel to zoom, tap to select, double-tap to zoom. Pause and four speeds. Touch-sized panels and bottom sheets.
- **Offline saves** — autosave twice a year, three manual slots, export/import JSON, and a service worker that caches the whole game.

## Controls

| Action | Control |
| --- | --- |
| Pan | Drag the map |
| Zoom | Pinch, mouse wheel, or double-tap |
| Select province | Tap it |
| Switch map mode | Button below the date bar |
| Pause / speed | `❚❚` and `▶` controls |
| March an army | Military tab → **March**, then tap a destination |
| Sail a fleet | Military tab → **Sail**, then tap a port |
| Save | Menu → Saves & Settings, or More tab |

## Project layout

```
index.html                 DOM skeleton and start screen
css/style.css              mobile-first UI
js/main.js                 bootstrap, campaign lifecycle, save/load, game loop
js/ui.js                   HUD, province sheet, panels, modals
js/map.js                  Canvas map renderer and touch controls
js/geo.js                  coastline loading, Voronoi cells, adjacency, hit-testing
js/data/                   countries, provinces, religions, units, events, constants
js/engine/state.js         core state, economy, politics, provinces
js/engine/sim.js           daily/monthly/yearly tick and player actions
js/engine/military.js      armies, battles, sieges, navies
js/engine/diplomacy.js     relations, wars, peace, coalitions
js/engine/events.js        historical and random events
js/engine/ai.js            strategic AI
tests/                     Node tests
scripts/serve.mjs          dependency-free static server
assets/geo.json            processed Natural Earth geometry
sw.js                      offline cache
```

## Tests

```bash
npm test
```

The suite covers economy, battles, peace treaties, coalitions, AI ticks and save/load round-trips.

## Packaging as a mobile app

The game is a plain static site, so it can be wrapped without changes:

1. Install [Capacitor](https://capacitorjs.com/) in a copy of the project.
2. Point `webDir` at the repository root (or copy the static files into `www/`).
3. Add Android/iOS and run the native build.

The service worker is ignored by native WebViews; all assets are local anyway.

## Notes

- The map is a stylised historical strategy map, not a survey-grade atlas. Province borders are generated from 322 historical centres.
- All data and balance are tuned for a playable mobile campaign, not exact historiography.
- Runs best in current Chrome, Safari and Firefox.

---

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/lucared2006-maker/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/lucared2006-maker/PlayGround)

- 🎮 [Open the project](https://omgithub.com/lucared2006-maker/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=lucared2006-maker%2FPlayGround).
- 💻 [Explore the source](https://github.com/lucared2006-maker/PlayGround).
- 🛠️ [Check build runs](https://github.com/lucared2006-maker/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/lucared2006-maker/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/lucared2006-maker).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
