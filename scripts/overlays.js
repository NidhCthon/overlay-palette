// Placing, fading and removing overlay tiles on the viewed scene.
import { MODULE_ID } from "./constants.js";
import { fadeSteps, overlayTileData } from "./placement.js";

const STEP_MS = 110;
const running = new Map();

/** Overlay tiles on a scene, in stacking order. */
export function sceneOverlays(scene = canvas?.scene) {
  if (!scene) return [];
  return scene.tiles.filter((t) => t.getFlag(MODULE_ID, "overlay")).sort((a, b) => a.sort - b.sort);
}

/** The elevation band of the level being viewed, as plain numbers. */
export function viewedLevelBand() {
  const e = canvas?.level?.elevation ?? {};
  return { bottom: e.bottom ?? e.base ?? 0, top: e.top ?? null };
}

/**
 * Cover the viewed scene with an effect.
 * @param {{src: string, name: string, cardId: string}} effect
 * @param {{fit: "cover"|"fill", hidden: boolean, fade: boolean}} options
 */
export async function addOverlay(effect, { fit, hidden, fade }) {
  const scene = canvas?.scene;
  if (!scene) return null;
  const data = overlayTileData({
    ...effect,
    rect: canvas.dimensions.sceneRect,
    fit,
    level: viewedLevelBand(),
    hidden,
    sort: Math.max(canvas.tiles.getMaxSort() + 1, 0)
  });
  const fadeIn = fade && !hidden;
  if (fadeIn) data.alpha = 0;
  const [tile] = await scene.createEmbeddedDocuments("Tile", [data]);
  if (fadeIn) await fadeTo(tile, 1);
  return tile;
}

/** Drag data for core's Tile drop: the effect at its own size where it lands, with overlay settings. */
export function overlayDragData(effect) {
  const data = overlayTileData({ ...effect, rect: { x: 0, y: 0, width: 0, height: 0 }, level: viewedLevelBand() });
  delete data.x; delete data.y; delete data.width; delete data.height;
  data.texture = { src: effect.src };
  return { type: "Tile", tileSize: canvas?.dimensions?.size, ...data };
}

/** Show or hide an overlay, fading if asked. A hidden tile keeps its opacity for next time. */
export async function setShown(tile, show, { fade = true } = {}) {
  const target = tile.getFlag(MODULE_ID, "alpha") ?? 1;
  if (show) {
    if (!fade) return tile.update({ hidden: false, alpha: target });
    await tile.update({ hidden: false, alpha: 0 });
    return fadeTo(tile, target);
  }
  if (fade && !tile.hidden) await fadeTo(tile, 0);
  if (!tile.parent?.tiles.has(tile.id)) return;
  return tile.update({ hidden: true, alpha: target });
}

/** Set an overlay's opacity and remember it for when it is shown again. */
export function setOpacity(tile, alpha) {
  return tile.update({ alpha, [`flags.${MODULE_ID}.alpha`]: alpha });
}

export async function removeOverlay(tile, { fade = true } = {}) {
  if (fade && !tile.hidden) await fadeTo(tile, 0);
  if (tile.parent?.tiles.has(tile.id)) await tile.delete();
}

/** Step a tile's alpha to a value. A newer fade on the same tile cancels this one. */
export async function fadeTo(tile, to) {
  const token = {};
  running.set(tile.id, token);
  for (const alpha of fadeSteps(tile.alpha, to)) {
    if (running.get(tile.id) !== token || !tile.parent?.tiles.has(tile.id)) return;
    await tile.update({ alpha }, { animate: false });
    await new Promise((r) => setTimeout(r, STEP_MS));
  }
  if (running.get(tile.id) === token) running.delete(tile.id);
}
