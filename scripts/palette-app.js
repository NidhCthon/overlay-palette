// The Overlay Palette window: browse the effect folders as cards, preview a
// loop on hover, pick a colour and intensity, and click to cover the scene or
// drag to place. The "In this scene" tab fades, dims and removes what is up.
import { DEFAULT_ROOT, DEFAULT_THUMB_ROOT, MODULE_ID } from "./constants.js";
import {
  COLORS, buildCatalog, intensitiesFor, isVideo, matchesSearch, pickVariant, thumbFor, variantLabels
} from "./catalog.js";
import { addOverlay, overlayDragData, removeOverlay, sceneOverlays, setOpacity, setShown } from "./overlays.js";

const { ApplicationV2 } = foundry.applications.api;
const SCENE_TAB = "__scene";
const INTENSITY_LABEL = { "-": "Light", "": "Normal", "+": "Heavy" };

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** List every file under a Data folder, one level of subfolders deep, as {folder, src}. */
async function scanFolder(root) {
  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  const top = await FilePicker.browse("data", root);
  const out = top.files.map((src) => ({ folder: "Loose", src }));
  for (const dir of top.dirs) {
    const folder = decodeURIComponent(dir.split("/").pop());
    const inner = await FilePicker.browse("data", dir);
    for (const src of inner.files) out.push({ folder, src });
  }
  return out;
}

export class OverlayPalette extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "overlay-palette",
    classes: ["overlay-palette"],
    window: { title: "Overlay Palette", icon: "fa-solid fa-cloud-showers-heavy", resizable: true },
    position: { width: 940, height: 760 },
    actions: {
      folder: OverlayPalette.#onFolder,
      variant: OverlayPalette.#onVariant,
      intensity: OverlayPalette.#onIntensity,
      add: OverlayPalette.#onAdd,
      toggle: OverlayPalette.#onToggle,
      remove: OverlayPalette.#onRemove,
      hideAll: OverlayPalette.#onHideAll,
      removeAll: OverlayPalette.#onRemoveAll,
      rescan: OverlayPalette.#onRescan
    }
  };

  /** Open the palette, or bring it to the front. */
  static open() {
    const app = foundry.applications.instances.get("overlay-palette") ?? new OverlayPalette();
    return app.render({ force: true });
  }

  /** @type {import("./catalog.js").Card[]|null} */
  #cards = null;
  #thumbs = new Set();
  #choice = new Map();
  #query = "";
  #ui = { tab: null, fit: "fill", hidden: false, fade: true };
  #hooks = [];

  get root() { return game.settings.get(MODULE_ID, "root") || DEFAULT_ROOT; }
  get thumbRoot() { return game.settings.get(MODULE_ID, "thumbRoot") || DEFAULT_THUMB_ROOT; }

  async _prepareContext() {
    // Saved options are read once: saving is async, so reading them on every
    // render could undo a tab the GM just clicked.
    if (!this.#cards) {
      this.#ui = { ...this.#ui, ...(game.settings.get(MODULE_ID, "ui") ?? {}) };
      await this.#load();
    }
    return {};
  }

  async #load() {
    try {
      const [files, thumbs] = await Promise.all([scanFolder(this.root), scanFolder(this.thumbRoot).catch(() => [])]);
      this.#cards = buildCatalog(files);
      this.#thumbs = new Set(thumbs.map((t) => t.src));
    } catch (err) {
      console.error(`${MODULE_ID} | could not read ${this.root}`, err);
      ui.notifications.error(`Overlay Palette could not read "${this.root}". Check the folder in the module settings.`);
      this.#cards = [];
    }
  }

  get #folders() {
    return [...new Set(this.#cards.map((c) => c.folder))];
  }

  async _renderHTML() {
    const folders = this.#folders;
    if (!this.#ui.tab || (this.#ui.tab !== SCENE_TAB && !folders.includes(this.#ui.tab))) this.#ui.tab = folders[0] ?? SCENE_TAB;
    const tab = this.#ui.tab;
    const overlays = sceneOverlays();

    const el = document.createElement("div");
    el.className = "op-root";
    el.innerHTML = `
      <nav class="op-tabs">
        ${folders.map((f) => `<button type="button" class="op-tab ${f === tab ? "active" : ""}" data-action="folder" data-tab="${escapeHtml(f)}">
          ${escapeHtml(f)} <span class="op-count">${this.#cards.filter((c) => c.folder === f).length}</span></button>`).join("")}
        <button type="button" class="op-tab op-tab-scene ${tab === SCENE_TAB ? "active" : ""}" data-action="folder" data-tab="${SCENE_TAB}">
          <i class="fa-solid fa-layer-group"></i> In this scene <span class="op-count">${overlays.length}</span></button>
      </nav>
      ${tab === SCENE_TAB ? this.#sceneHtml(overlays) : this.#browseHtml(tab)}`;
    return el;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector(".op-grid, .op-list")?.scrollTop ?? 0;
    content.replaceChildren(result);
    const list = content.querySelector(".op-grid, .op-list");
    if (list && this.#keepScroll) list.scrollTop = scroll;
    this.#keepScroll = false;
  }
  #keepScroll = false;

  #browseHtml(folder) {
    const cards = this.#cards.filter((c) => c.folder === folder);
    return `
      <div class="op-bar">
        <input type="search" class="op-search" placeholder="Search ${escapeHtml(folder)}: fire, night, blue…" value="${escapeHtml(this.#query)}">
        <label title="Place it hidden, then reveal it from In this scene"><input type="checkbox" data-ui="hidden" ${this.#ui.hidden ? "checked" : ""}> Add hidden</label>
        <label title="Fade in and out instead of popping"><input type="checkbox" data-ui="fade" ${this.#ui.fade ? "checked" : ""}> Fade</label>
        <select data-ui="fit" title="How a 16:9 loop meets a scene of another shape">
          <option value="fill" ${this.#ui.fit === "fill" ? "selected" : ""}>Stretch to scene</option>
          <option value="cover" ${this.#ui.fit === "cover" ? "selected" : ""}>Keep shape (spills past edges)</option>
        </select>
        <button type="button" class="op-icon" data-action="rescan" title="Look for new files"><i class="fa-solid fa-rotate"></i></button>
      </div>
      <p class="op-hint">Hover to preview. Click a card to cover the scene, or drag it onto the map to drop it at its own size (hold Alt to drop it hidden).</p>
      <div class="op-grid">
        ${cards.map((c) => this.#cardHtml(c)).join("")}
        <p class="op-empty" hidden>Nothing matches.</p>
      </div>`;
  }

  #selected(card) {
    const c = this.#choice.get(card.id) ?? {};
    return pickVariant(card, c.label ?? card.variants[0].label, c.intensity ?? "");
  }

  #posterHtml(src) {
    const thumb = thumbFor(src, this.root, this.thumbRoot);
    if (thumb && this.#thumbs.has(thumb)) return `<img class="op-poster" src="${escapeHtml(thumb)}" loading="lazy" alt="">`;
    if (isVideo(src)) return `<video class="op-poster" src="${escapeHtml(src)}#t=1" preload="metadata" muted></video>`;
    return `<img class="op-poster" src="${escapeHtml(src)}" loading="lazy" alt="">`;
  }

  #cardHtml(card) {
    const v = this.#selected(card);
    const labels = variantLabels(card);
    const intensities = intensitiesFor(card, v.label);
    const hidden = matchesSearch(card, this.#query) ? "" : "hidden";
    return `
      <article class="op-card" data-card="${escapeHtml(card.id)}" draggable="true" ${hidden}>
        <div class="op-thumb" data-action="add" title="Cover the scene with ${escapeHtml(v.file)}">
          ${this.#posterHtml(v.src)}
          <video class="op-preview" muted loop playsinline preload="none"></video>
          <span class="op-add"><i class="fa-solid fa-plus"></i></span>
        </div>
        <h3 title="${escapeHtml(v.file)}">${escapeHtml(card.title)}</h3>
        ${labels.length > 1 ? `<div class="op-variants">${labels.map((l) => this.#chipHtml(l, l === v.label, card)).join("")}</div>` : ""}
        ${intensities.length > 1 ? `<div class="op-intensity">${intensities.map((i) => `
          <button type="button" class="${i === v.intensity ? "active" : ""}" data-action="intensity" data-value="${i}">${INTENSITY_LABEL[i]}</button>`).join("")}</div>` : ""}
      </article>`;
  }

  #chipHtml(label, active, card) {
    const color = card.variants.find((x) => x.label === label)?.color;
    const dot = color ? `<span class="op-dot" style="--dot:${COLORS[color]}"></span>` : "";
    return `<button type="button" class="op-chip ${active ? "active" : ""}" data-action="variant" data-value="${escapeHtml(label)}">${dot}${escapeHtml(label || "standard")}</button>`;
  }

  #sceneHtml(overlays) {
    if (!canvas?.scene) return `<p class="op-empty-scene">No scene is being viewed.</p>`;
    if (!overlays.length) return `<p class="op-empty-scene">No overlays in <b>${escapeHtml(canvas.scene.name)}</b> yet. Add one from a folder tab.</p>`;
    return `
      <div class="op-bar">
        <span class="op-scene-name">${escapeHtml(canvas.scene.name)}</span>
        <label><input type="checkbox" data-ui="fade" ${this.#ui.fade ? "checked" : ""}> Fade</label>
        <button type="button" data-action="hideAll"><i class="fa-solid fa-eye-slash"></i> Hide all</button>
        <button type="button" data-action="removeAll"><i class="fa-solid fa-trash"></i> Remove all</button>
      </div>
      <div class="op-list">
        ${overlays.map((t) => `
          <div class="op-row ${t.hidden ? "is-hidden" : ""}" data-tile="${t.id}">
            <div class="op-row-thumb">${this.#posterHtml(t.texture.src)}</div>
            <div class="op-row-name">${escapeHtml(t.name || t.texture.src.split("/").pop())}
              <small>${t.hidden ? "hidden from players" : "showing"}</small></div>
            <label class="op-opacity" title="Opacity">
              <i class="fa-solid fa-circle-half-stroke"></i>
              <input type="range" min="0.05" max="1" step="0.05" value="${t.getFlag(MODULE_ID, "alpha") ?? t.alpha}">
            </label>
            <button type="button" class="op-icon" data-action="toggle" title="${t.hidden ? "Show" : "Hide"}">
              <i class="fa-solid ${t.hidden ? "fa-eye" : "fa-eye-slash"}"></i></button>
            <button type="button" class="op-icon" data-action="remove" title="Remove"><i class="fa-solid fa-trash"></i></button>
          </div>`).join("")}
      </div>`;
  }

  _onFirstRender() {
    const rerender = (doc) => {
      if (doc.parent === canvas?.scene) this.#rerender();
    };
    this.#hooks = [
      ["createTile", rerender], ["updateTile", rerender], ["deleteTile", rerender],
      ["canvasReady", () => this.#rerender()]
    ].map(([name, fn]) => [name, Hooks.on(name, fn)]);
  }

  _onClose() {
    for (const [name, id] of this.#hooks) Hooks.off(name, id);
    this.#hooks = [];
  }

  #pending = null;
  /** Coalesce bursts (a fade is several updates) into one render, keeping the scroll position. */
  #rerender() {
    if (!this.rendered) return;
    clearTimeout(this.#pending);
    this.#pending = setTimeout(() => {
      this.#keepScroll = true;
      if (this.#ui.tab === SCENE_TAB) this.render();
      else {
        const count = this.element?.querySelector(".op-tab-scene .op-count");
        if (count) count.textContent = String(sceneOverlays().length);
      }
    }, 150);
  }

  _onRender() {
    const root = this.element;
    root.querySelector(".op-search")?.addEventListener("input", (ev) => {
      this.#query = ev.target.value;
      let shown = 0;
      for (const el of root.querySelectorAll(".op-card")) {
        const card = this.#card(el);
        const match = matchesSearch(card, this.#query);
        el.hidden = !match;
        if (match) shown++;
      }
      root.querySelector(".op-empty").hidden = shown > 0;
    });
    root.querySelector(".op-search")?.dispatchEvent(new Event("input"));

    for (const input of root.querySelectorAll("[data-ui]")) {
      input.addEventListener("change", () => {
        this.#ui[input.dataset.ui] = input.type === "checkbox" ? input.checked : input.value;
        game.settings.set(MODULE_ID, "ui", { ...this.#ui });
      });
    }

    for (const range of root.querySelectorAll(".op-opacity input")) {
      range.addEventListener("change", () => {
        const tile = this.#tile(range);
        if (tile) setOpacity(tile, Number(range.value));
      });
    }

    const grid = root.querySelector(".op-grid");
    if (!grid) return;
    grid.addEventListener("pointerover", (ev) => {
      const thumb = ev.target.closest(".op-thumb");
      if (!thumb || thumb.contains(ev.relatedTarget)) return;
      const video = thumb.querySelector(".op-preview");
      const v = this.#selected(this.#card(thumb));
      if (!isVideo(v.src)) return;
      video.src = v.src;
      video.play().then(() => thumb.classList.add("playing")).catch(() => {});
    });
    grid.addEventListener("pointerout", (ev) => {
      const thumb = ev.target.closest(".op-thumb");
      if (!thumb || thumb.contains(ev.relatedTarget)) return;
      const video = thumb.querySelector(".op-preview");
      thumb.classList.remove("playing");
      video.pause();
      video.removeAttribute("src");
      video.load();
    });
    grid.addEventListener("dragstart", (ev) => {
      const el = ev.target.closest(".op-card");
      if (!el) return;
      const card = this.#card(el);
      const v = this.#selected(card);
      ev.dataTransfer.setData("text/plain", JSON.stringify(overlayDragData({ src: v.src, name: v.file, cardId: card.id })));
    });
  }

  #card(el) {
    const id = el.closest(".op-card")?.dataset.card;
    return this.#cards.find((c) => c.id === id);
  }

  #tile(el) {
    const id = el.closest(".op-row")?.dataset.tile;
    return canvas?.scene?.tiles.get(id);
  }

  /** Redraw one card in place after a variant change, so the grid doesn't jump. */
  #refreshCard(card) {
    const el = this.element.querySelector(`.op-card[data-card="${CSS.escape(card.id)}"]`);
    if (!el) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = this.#cardHtml(card);
    el.replaceWith(tmp.firstElementChild);
  }

  static #onFolder(event, target) {
    this.#ui.tab = target.dataset.tab;
    game.settings.set(MODULE_ID, "ui", { ...this.#ui });
    this.render();
  }

  static #onVariant(event, target) {
    const card = this.#card(target);
    const prev = this.#choice.get(card.id) ?? {};
    this.#choice.set(card.id, { label: target.dataset.value, intensity: prev.intensity ?? "" });
    this.#refreshCard(card);
  }

  static #onIntensity(event, target) {
    const card = this.#card(target);
    const v = this.#selected(card);
    this.#choice.set(card.id, { label: v.label, intensity: target.dataset.value });
    this.#refreshCard(card);
  }

  static async #onAdd(event, target) {
    if (!canvas?.scene) return ui.notifications.warn("View a scene first.");
    const card = this.#card(target);
    const v = this.#selected(card);
    target.classList.add("added");
    setTimeout(() => target.classList.remove("added"), 600);
    await addOverlay({ src: v.src, name: v.file, cardId: card.id }, this.#ui);
    ui.notifications.info(`${v.file} added to ${canvas.scene.name}${this.#ui.hidden ? " (hidden)" : ""}.`);
  }

  static #onToggle(event, target) {
    const tile = this.#tile(target);
    if (tile) setShown(tile, tile.hidden, { fade: this.#ui.fade });
  }

  static #onRemove(event, target) {
    const tile = this.#tile(target);
    if (tile) removeOverlay(tile, { fade: this.#ui.fade });
  }

  static #onHideAll() {
    for (const tile of sceneOverlays()) if (!tile.hidden) setShown(tile, false, { fade: this.#ui.fade });
  }

  static async #onRemoveAll() {
    const overlays = sceneOverlays();
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Remove all overlays" },
      content: `<p>Remove all ${overlays.length} overlays from ${escapeHtml(canvas.scene.name)}?</p>`
    });
    if (ok) await Promise.all(overlays.map((t) => removeOverlay(t, { fade: this.#ui.fade })));
  }

  static async #onRescan() {
    this.#cards = null;
    await this.render();
    ui.notifications.info(`Overlay Palette found ${this.#cards.length} effects.`);
  }
}
