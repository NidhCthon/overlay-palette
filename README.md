# Overlay Palette

A GM menu for full-scene animated overlays in Foundry VTT v14: rain, fog, moonlight through a window, bats, fireflies and the like.

Open it from the **Tiles** controls (the cloud-and-rain button), or bind a key under *Configure Controls*.

- **One tab per folder** under the effects folder (default `assets/effects`), plus **In this scene**.
- **One card per effect.** Files that differ only by colour or intensity are grouped: `Fire`, `Fire + blue` and `Fire red` become one *Fire* card with colour chips and a Light/Normal/Heavy switch. Lowercase words after the name are variants (`Forest Dry  night fireflies`), and a lone `+` or `-` is the intensity.
- **Hover** a card to play the loop. **Click** to cover the whole scene with it, above the tokens and never fading when a token walks under it. **Drag** it onto the map to drop it at its own size (Alt drops it hidden).
- **Add hidden** places it so you can reveal it later; **Fade** fades it in and out instead of popping.
- **In this scene** lists the overlays on the viewed scene: show or hide (with a fade), set opacity, remove.

Stretch to scene is the default fit. *Keep shape* preserves a 16:9 loop's proportions, but Foundry never crops a tile, so on a scene of another shape it spills past the scene's edges.

Hidden only means hidden from view. Foundry sends every tile and every file under `Data/` to every client.

## Thumbnails

Cards use a WebP poster from the thumbnails folder (default `assets/effects-thumbs`), which mirrors the effects folder. Make them with ffmpeg:

```
node tools/make-thumbs.mjs <effects dir> <thumbs dir>
```

It skips posters that already exist. Without a poster, a card shows the video's first frame.

## Development

```
node --test tests/*.test.mjs
node tools/deploy.mjs              # install and restart Foundry (refuses while people are connected)
node tools/deploy.mjs --no-restart # scripts/styles only; players reload
```
