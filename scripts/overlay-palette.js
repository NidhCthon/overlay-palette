// Overlay Palette: a GM menu for full-scene animated overlays (rain, fog,
// moonlight, bats...). It reads the effect folders under Data/, groups each
// effect's colour and intensity files into one card, and places them as tiles
// above the tokens. The tool sits in the Tiles controls.
import { DEFAULT_ROOT, DEFAULT_THUMB_ROOT, MODULE_ID } from "./constants.js";
import { OverlayPalette } from "./palette-app.js";
import { viewedLevelBand } from "./overlays.js";
import { overlayElevation } from "./placement.js";

export * from "./constants.js";
export * from "./catalog.js";
export * from "./placement.js";
export { OverlayPalette };

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "root", {
    name: "Effects folder",
    hint: "The folder under Data/ that holds the effects. Each subfolder becomes a tab.",
    scope: "world", config: true, type: String, default: DEFAULT_ROOT,
    filePicker: "folder"
  });
  game.settings.register(MODULE_ID, "thumbRoot", {
    name: "Thumbnails folder",
    hint: "Optional posters, mirroring the effects folder (Horror/Bats.webm -> Horror/Bats.webp). Cards without one show the video's first frame.",
    scope: "world", config: true, type: String, default: DEFAULT_THUMB_ROOT,
    filePicker: "folder"
  });
  // The last tab and add options, per GM browser.
  game.settings.register(MODULE_ID, "ui", { scope: "client", config: false, type: Object, default: {} });

  game.keybindings.register(MODULE_ID, "open", {
    name: "Open the Overlay Palette",
    editable: [],
    restricted: true,
    onDown: () => { OverlayPalette.open(); return true; }
  });
});

// A card dragged onto the map goes through core's Tile drop, which merges the
// Tiles palette defaults over our data and so resets the elevation. Lift every
// palette overlay above the tokens however it was created.
Hooks.on("preCreateTile", (tile, data) => {
  if (!foundry.utils.getProperty(data, `flags.${MODULE_ID}.overlay`)) return;
  if (tile.parent !== canvas?.scene) return;
  tile.updateSource({ elevation: overlayElevation(viewedLevelBand()) });
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = { open: () => OverlayPalette.open() };
});

Hooks.on("getSceneControlButtons", (controls) => {
  const tiles = controls.tiles;
  if (!tiles || !game.user.isGM) return;
  tiles.tools.overlayPalette = {
    name: "overlayPalette",
    title: "Overlay Palette",
    icon: "fa-solid fa-cloud-showers-heavy",
    order: Object.keys(tiles.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => OverlayPalette.open()
  };
});
