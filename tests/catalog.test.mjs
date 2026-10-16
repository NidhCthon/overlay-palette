import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCatalog, intensitiesFor, matchesSearch, parseEffectName, pickVariant, stem, thumbFor, variantLabels
} from "../scripts/catalog.js";

// The real file list from the three packs on the server (folder/name.webm).
const names = readFileSync(new URL("./effect-names.txt", import.meta.url), "utf8").trim().split("\n");
const files = names.map((n) => ({
  folder: n.split("/")[0],
  src: `assets/effects/${n.split("/").map(encodeURIComponent).join("/")}`
}));
const catalog = buildCatalog(files);
const card = (folder, name) => catalog.find((c) => c.folder === folder && c.name === name);

test("parses colour, intensity and lowercase variant words", () => {
  assert.deepEqual(parseEffectName("Fire + blue"), { base: "Fire", variant: "blue", intensity: "+", color: "blue" });
  assert.deepEqual(parseEffectName("Electricity - green"), { base: "Electricity", variant: "green", intensity: "-", color: "green" });
  assert.deepEqual(parseEffectName("Beam Torch stressed 2 blue"), { base: "Beam Torch 2", variant: "stressed blue", intensity: "", color: "blue" });
  assert.deepEqual(parseEffectName("Rain"), { base: "Rain", variant: "", intensity: "", color: null });
});

test("a double space marks the variant", () => {
  assert.deepEqual(parseEffectName("Forest Dry  night fireflies"), { base: "Forest Dry", variant: "night fireflies", intensity: "", color: null });
  assert.deepEqual(parseEffectName("Waterfall left  fae"), { base: "Waterfall", variant: "left fae", intensity: "", color: null });
});

test("every file lands on exactly one card", () => {
  assert.equal(names.length, 531);
  assert.equal(catalog.reduce((n, c) => n + c.variants.length, 0), 531);
  const srcs = new Set(catalog.flatMap((c) => c.variants.map((v) => v.src)));
  assert.equal(srcs.size, 531);
});

test("531 files make 135 cards across the three folders", () => {
  assert.equal(catalog.length, 135);
  assert.deepEqual([...new Set(catalog.map((c) => c.folder))], ["Ambient", "Horror", "Temperate Region"]);
});

test("no card has two files for the same variant and intensity", () => {
  for (const c of catalog) {
    const keys = c.variants.map((v) => `${v.label}|${v.intensity}`);
    assert.equal(new Set(keys).size, keys.length, c.id);
  }
});

test("variants list plain first, then by name, lighter to heavier", () => {
  const dust = card("Ambient", "Dust");
  assert.deepEqual(dust.variants.slice(0, 4).map((v) => v.label + v.intensity), ["-", "", "+", "blue"]);
  assert.deepEqual(intensitiesFor(dust, ""), ["-", "", "+"]);
  assert.deepEqual(intensitiesFor(dust, "blue"), ["", "+"]);
  assert.deepEqual(variantLabels(card("Horror", "Candles")), ["off", "on"]);
});

test("a word every variant shares moves into the name", () => {
  const chair = card("Horror", "Rocking chair");
  assert.ok(chair, "Rocking chair is one card");
  assert.deepEqual(variantLabels(chair), ["", "still"]);
  assert.equal(card("Horror", "Trees with crows").title, "Trees with crows");
});

test("pickVariant falls back to the label's normal intensity, then the first variant", () => {
  const fire = card("Ambient", "Fire");
  assert.equal(pickVariant(fire, "blue", "+").file, "Fire + blue");
  assert.equal(pickVariant(fire, "blue", "-").file, "Fire blue");
  assert.equal(pickVariant(fire, "nope", "").file, "Fire");
});

test("search matches every word across folder, name and variants", () => {
  assert.ok(matchesSearch(card("Temperate Region", "Forest Dry"), "forest fireflies"));
  assert.ok(!matchesSearch(card("Temperate Region", "Forest Dry"), "forest autumn"));
  assert.ok(matchesSearch(card("Ambient", "Fire"), "  "));
});

test("thumbnails mirror the effects folder as webp", () => {
  assert.equal(thumbFor("assets/effects/Horror/Bats.webm", "assets/effects", "assets/effects-thumbs"), "assets/effects-thumbs/Horror/Bats.webp");
  assert.equal(thumbFor("elsewhere/Bats.webm", "assets/effects", "assets/effects-thumbs"), null);
  assert.equal(stem("assets/effects/Temperate%20Region/Plain%20Ta%C3%AFga.webm"), "Plain Taïga");
});
