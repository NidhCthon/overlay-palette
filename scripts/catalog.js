// Turn a folder of effect files into palette cards. Pure: plain strings in,
// plain objects out, so it runs under node's test runner.
//
// The packs name variants of one effect in the filename:
//   "Fire + blue"                 Fire, heavier, blue
//   "Electricity - green"         Electricity, lighter, green
//   "Beam Torch stressed 2 blue"  Beam Torch 2, "stressed blue"
//   "Forest Dry  night fireflies" Forest Dry, "night fireflies" (a double space
//                                 marks the variant in the Temperate pack)
// The first word and every capitalised or numbered word belong to the effect's
// name. Later lowercase words describe the variant, and a lone "+" or "-" is the
// intensity. Cards group by folder and name, ignoring case.

export const COLORS = Object.freeze({
  black: "#1b1b1f", blood: "#8a0f12", blue: "#3d7bff", brown: "#8b5a2b",
  gold: "#d9a520", green: "#3fbf5a", orange: "#f08a24", purple: "#9b5de5",
  red: "#e5383b", white: "#f2f2f2", yellow: "#f5d90a"
});

export const INTENSITIES = Object.freeze(["-", "", "+"]);

const VIDEO = /\.(webm|mp4|m4v|ogv)$/i;

/** The file name without its folder or extension. */
export function stem(path) {
  return decodeURIComponent(path.split("/").pop()).replace(/\.[^.]+$/, "");
}

/**
 * Split one effect file name into the card it belongs to and its variant.
 * @param {string} name  a file stem, e.g. "Fire + blue"
 * @returns {{base: string, variant: string, intensity: "-"|""|"+", color: string|null}}
 */
export function parseEffectName(name) {
  const [head, ...tail] = name.split(/ {2,}/);
  const words = head.trim().split(/\s+/).filter(Boolean);
  const extra = tail.join(" ").trim().split(/\s+/).filter(Boolean);

  const base = [];
  const variant = [];
  let intensity = "";
  words.forEach((word, i) => {
    if (word === "+" || word === "-") intensity = word;
    else if (i === 0 || /^[^a-z]/.test(word)) base.push(word);
    else variant.push(word);
  });
  for (const word of extra) {
    if (word === "+" || word === "-") intensity = word;
    else variant.push(word);
  }
  if (!base.length) base.push(name.trim());
  const color = variant.find((w) => w.toLowerCase() in COLORS)?.toLowerCase() ?? null;
  return { base: base.join(" "), variant: variant.join(" "), intensity, color };
}

/**
 * Group files into cards.
 * @param {{folder: string, src: string}[]} files  src is the path Foundry serves
 * @returns {Card[]} cards sorted by folder then name; each card's variants are
 *   sorted plain first, then by label, then lighter to heavier
 *
 * @typedef {{id: string, folder: string, name: string, title: string, variants: Variant[]}} Card
 * @typedef {{label: string, color: string|null, intensity: string, src: string, file: string}} Variant
 */
export function buildCatalog(files) {
  const cards = new Map();
  for (const { folder, src } of files) {
    if (!VIDEO.test(src) && !/\.(webp|png|jpe?g|gif|svg|avif)$/i.test(src)) continue;
    const file = stem(src);
    const { base, variant, intensity, color } = parseEffectName(file);
    const id = `${folder}/${base}`.toLowerCase();
    let card = cards.get(id);
    if (!card) cards.set(id, card = { id, folder, name: base, title: "", variants: [] });
    card.variants.push({ label: variant, color, intensity, src, file });
  }
  for (const card of cards.values()) {
    // "Rocking chair" and "Rocking chair still": a word every variant starts
    // with belongs to the name.
    for (;;) {
      const first = card.variants[0].label.split(" ")[0];
      if (!first || !card.variants.every((v) => v.label.split(" ")[0] === first)) break;
      card.name += ` ${first}`;
      for (const v of card.variants) v.label = v.label.slice(first.length).trim();
    }
    card.title = card.name;
    card.variants.sort((a, b) =>
      (a.label === "" ? 0 : 1) - (b.label === "" ? 0 : 1)
      || a.label.localeCompare(b.label)
      || INTENSITIES.indexOf(a.intensity) - INTENSITIES.indexOf(b.intensity));
    // A card with one file is named after the file, so "Trees with crows" keeps its words.
    if (card.variants.length === 1) card.title = card.variants[0].file;
  }
  return [...cards.values()].sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
}

/** The distinct variant labels on a card, in display order. */
export function variantLabels(card) {
  return [...new Set(card.variants.map((v) => v.label))];
}

/** The intensities a card offers for one label, lighter to heavier. */
export function intensitiesFor(card, label) {
  return INTENSITIES.filter((i) => card.variants.some((v) => v.label === label && v.intensity === i));
}

/**
 * The variant for a label and intensity. Falls back to the label's middle
 * intensity, then to the card's first variant, so a stale choice still resolves.
 */
export function pickVariant(card, label = "", intensity = "") {
  const sameLabel = card.variants.filter((v) => v.label === label);
  return sameLabel.find((v) => v.intensity === intensity)
    ?? sameLabel.find((v) => v.intensity === "")
    ?? sameLabel[0]
    ?? card.variants[0];
}

/** Does a card match a search? Every word must appear in its name, a variant or its folder. */
export function matchesSearch(card, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [card.folder, card.name, ...card.variants.map((v) => v.label)].join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Where a file's thumbnail lives: assets/effects/X/Y.webm -> assets/effects-thumbs/X/Y.webp */
export function thumbFor(src, root, thumbRoot) {
  if (!src.startsWith(`${root}/`)) return null;
  return `${thumbRoot}/${src.slice(root.length + 1)}`.replace(/\.[^./]+$/, ".webp");
}

export function isVideo(src) {
  return VIDEO.test(src);
}
