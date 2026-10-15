// Dev helper: downloads the site's photography into public/images and prints
// attribution metadata from Wikimedia Commons. Run once: node scripts/fetch-images.mjs
import { writeFile, mkdir } from "node:fs/promises";

const UA = { "User-Agent": "adriatic-trans-site/1.0 (dev)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const files = {
  zlatibor: "Zlatibor chilling in the sun.jpg",
  ostrog: "Monasterio de Ostrog, Montenegro, 2014-04-14, DD 14.JPG",
  budva: "View of Budva Old Town.jpg",
  kotor: "Bay of Kotor 3.jpg",
  tivat: "Tivat, Montenegro, Boko Kotor Bay and Porto Montenegro at sunset.jpg",
  podgorica: "Millenium Bridge 2023.jpg",
  "herceg-novi": "Widok na miasto z portu w Herceg Novi 01.jpg",
  zabljak: "Crno jezero 2020.jpg",
};

await mkdir("public/images/destinations", { recursive: true });

const credits = {};
for (const [slug, title] of Object.entries(files)) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    title.replace(/ /g, "_"),
  )}?width=1200`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: UA, redirect: "follow" });
    if (res.ok) {
      await writeFile(`public/images/destinations/${slug}.jpg`, Buffer.from(await res.arrayBuffer()));
      break;
    }
    await sleep(4000 * (attempt + 1));
  }
  await sleep(1500);

  const api =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=" +
    encodeURIComponent("File:" + title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(api, { headers: UA });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const page = Object.values(json.query.pages)[0];
      const m = page.imageinfo[0].extmetadata;
      credits[slug] = {
        title,
        artist: String(m.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim(),
        license: m.LicenseShortName?.value,
        licenseUrl: m.LicenseUrl?.value,
      };
      break;
    } catch {
      await sleep(4000 * (attempt + 1));
    }
  }
  console.log("done", slug);
  await sleep(1500);
}
console.log(JSON.stringify(credits, null, 2));
