import { test } from "node:test";
import assert from "node:assert/strict";
import { OVERLAY_HEIGHT, fadeSteps, overlayElevation, overlayTileData } from "../scripts/placement.js";

test("an overlay covers the rect, loops silently and never occludes", () => {
  const d = overlayTileData({ src: "a.webm", name: "Rain", rect: { x: 100.4, y: 200, width: 3000, height: 2000 }, sort: 7, cardId: "ambient/rain" });
  // v14 places a tile by its anchor, which is the centre.
  assert.deepEqual([d.texture.anchorX, d.texture.anchorY], [0.5, 0.5]);
  assert.deepEqual([d.x, d.y, d.width, d.height, d.sort], [1600, 1200, 3000, 2000, 7]);
  assert.equal(d.texture.fit, "fill");
  assert.deepEqual(d.occlusion.modes, []);
  assert.deepEqual(d.video, { loop: true, autoplay: true, volume: 0 });
  assert.deepEqual(d.flags["overlay-palette"], { overlay: true, card: "ambient/rain", alpha: 1 });
});

test("elevation sits above the level floor and inside its ceiling", () => {
  assert.equal(overlayElevation(undefined), OVERLAY_HEIGHT);
  assert.equal(overlayElevation({ bottom: 0, top: null }), OVERLAY_HEIGHT);
  assert.equal(overlayElevation({ bottom: 20, top: null }), 20 + OVERLAY_HEIGHT);
  assert.equal(overlayElevation({ bottom: 0, top: 10 }), 9);
  assert.equal(overlayElevation({ bottom: 5, top: 5 }), 5);
});

test("a fade ends exactly on its target", () => {
  assert.deepEqual(fadeSteps(0, 1, 4), [0.25, 0.5, 0.75, 1]);
  assert.equal(fadeSteps(0.7, 0).at(-1), 0);
  assert.equal(fadeSteps(0, 0.35).at(-1), 0.35);
});
