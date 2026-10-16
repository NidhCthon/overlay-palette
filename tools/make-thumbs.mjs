// Make a small transparent WebP poster for every webm effect, for the palette's cards.
//
//   node tools/make-thumbs.mjs <effects dir> <thumbs dir>
//
// The thumbs dir mirrors the effects dir: effects/Horror/Bats.webm becomes
// thumbs/Horror/Bats.webp. Existing posters are skipped, so a rerun only does
// new files. The frame comes from a second into the loop, because many loops
// fade in from nothing at frame 0. VP9 alpha only survives the libvpx decoder;
// ffmpeg's native vp9 decoder drops it, so the decoder is named explicitly.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error("usage: node tools/make-thumbs.mjs <effects dir> <thumbs dir>");
  process.exit(1);
}

function* webms(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* webms(path);
    else if (name.toLowerCase().endsWith(".webm")) yield path;
  }
}

let made = 0, skipped = 0, failed = 0;
for (const file of webms(src)) {
  const target = join(out, relative(src, file)).replace(/\.webm$/i, ".webp");
  if (existsSync(target)) { skipped++; continue; }
  mkdirSync(dirname(target), { recursive: true });
  try {
    execFileSync("ffmpeg", [
      "-v", "error", "-y", "-c:v", "libvpx-vp9", "-ss", "1", "-i", file,
      "-frames:v", "1", "-vf", "scale=384:-2", "-c:v", "libwebp", "-quality", "75", target
    ]);
    made++;
  } catch (err) {
    failed++;
    console.error(`failed: ${file}\n${err.stderr ?? err.message}`);
  }
}
console.log(`thumbnails: ${made} made, ${skipped} already there, ${failed} failed`);
