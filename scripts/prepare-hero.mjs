// Dev helper: obscures the licence plate in the hero photograph (privacy + cleaner art direction).
// Keeps an untouched copy in .scratch/hero-original.jpg and is safe to re-run.
import sharp from "sharp";
import { copyFile, mkdir, access } from "node:fs/promises";

const target = "public/images/hero-cinematic.jpg";
const backup = ".scratch/hero-original.jpg";

await mkdir(".scratch", { recursive: true });
try {
  await access(backup);
} catch {
  await copyFile(target, backup);
}

// Plate region (with margin) in the 2400x1600 original.
const region = { left: 1250, top: 1120, width: 270, height: 210 };

// Feathered mask so the patch melts into the bumper instead of reading as a box.
const mask = await sharp(
  Buffer.from(
    `<svg width="${region.width}" height="${region.height}"><rect x="38" y="34" width="${region.width - 76}" height="${region.height - 68}" rx="18" fill="white"/></svg>`,
  ),
)
  .blur(14)
  .toColourspace("b-w")
  .toBuffer();

const patch = await sharp(backup)
  .extract(region)
  .blur(26)
  .modulate({ brightness: 0.32, saturation: 0.25 })
  .ensureAlpha()
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toBuffer();

await sharp(backup)
  .composite([{ input: patch, left: region.left, top: region.top }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(".scratch/hero-processed.jpg");

await copyFile(".scratch/hero-processed.jpg", target);
console.log("hero-cinematic.jpg updated");
