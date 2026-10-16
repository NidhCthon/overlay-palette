import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { hooks } from "./foundry.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("module.json", root), "utf8"));

test("the manifest's scripts and styles exist", () => {
  assert.equal(manifest.id, "overlay-palette");
  for (const f of [...manifest.esmodules, ...manifest.styles]) assert.ok(existsSync(new URL(f, root)), f);
});

test("the entry script loads and adds a GM tool to the Tiles controls", async () => {
  await import(new URL(manifest.esmodules[0], root));
  Hooks.callAll("init");
  const controls = { tiles: { tools: { select: {} } } };
  Hooks.callAll("getSceneControlButtons", controls);
  assert.equal(controls.tiles.tools.overlayPalette.button, true);
  assert.equal(controls.tiles.tools.overlayPalette.order, 1);
  assert.ok(hooks.has("ready"));
});
