// Dev helper: download a Wikimedia Commons image at a given width.
// Usage: node scripts/commons-download.mjs "File Title.jpg" out/path.jpg 1600
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const [title, out, width = "1600"] = process.argv.slice(2);
const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
  title.replace(/ /g, "_"),
)}?width=${width}`;

for (let attempt = 0; attempt < 5; attempt++) {
  const res = await fetch(url, {
    headers: { "User-Agent": "adriatic-trans-site/1.0 (dev)" },
    redirect: "follow",
  });
  if (res.ok) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, Buffer.from(await res.arrayBuffer()));
    console.log("saved", out);
    process.exit(0);
  }
  console.log("retry", res.status);
  await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
}
process.exit(1);
