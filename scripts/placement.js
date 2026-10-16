// What a palette overlay looks like as a Tile. Pure, so it is testable in node.
import { MODULE_ID } from "./constants.js";

// How far above the viewed level's floor an overlay sits. Tokens stand on the
// floor (or a little above it when flying), and tiles sort by elevation, so
// this keeps rain and fog drawn over the party.
export const OVERLAY_HEIGHT = 50;

/**
 * Creation data for an overlay tile.
 * @param {object} o
 * @param {string} o.src            the effect file
 * @param {string} o.name           shown in the tile list and the palette's scene tab
 * @param {{x:number,y:number,width:number,height:number}} o.rect  the area to cover (the scene rect)
 * @param {"cover"|"fill"} o.fit    fill stretches the loop to the rect; cover keeps its shape,
 *                                  and since core never crops a tile, it spills past the rect
 * @param {{bottom:number|null, top:number|null}} [o.level]  the elevation band of the viewed level
 * @param {boolean} [o.hidden]      start hidden, to reveal later
 * @param {number} [o.alpha]
 * @param {number} [o.sort]
 * @param {string} [o.cardId]       the palette card it came from
 */
export function overlayTileData({ src, name, rect, fit = "fill", level, hidden = false, alpha = 1, sort = 0, cardId = null }) {
  return {
    name,
    texture: { src, fit, anchorX: 0.5, anchorY: 0.5 },
    // In v14 a tile's x and y are where its anchor sits, so the centre here.
    x: Math.round(rect.x + rect.width / 2),
    y: Math.round(rect.y + rect.height / 2),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    elevation: overlayElevation(level),
    sort,
    alpha,
    hidden,
    // No occlusion modes: the overlay never fades when a token walks under it.
    occlusion: { modes: [], alpha: 0 },
    video: { loop: true, autoplay: true, volume: 0 },
    flags: { [MODULE_ID]: { overlay: true, card: cardId, alpha } }
  };
}

/** Above the tokens on the viewed level, but inside the level when it has a ceiling. */
export function overlayElevation(level) {
  const bottom = level?.bottom ?? 0;
  const top = level?.top ?? null;
  const want = bottom + OVERLAY_HEIGHT;
  if (top === null || top === undefined) return want;
  return Math.min(want, Math.max(bottom, top - 1));
}

/**
 * The alpha values a fade passes through, ending exactly on `to`.
 * Each step is one document update, so a fade is a handful of updates, not a frame-rate animation.
 */
export function fadeSteps(from, to, steps = 6) {
  const out = [];
  for (let i = 1; i <= steps; i++) out.push(Math.round((from + (to - from) * (i / steps)) * 1000) / 1000);
  return out;
}
