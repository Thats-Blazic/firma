// Dev helper: search Wikimedia Commons for openly licensed images.
// Usage: node scripts/commons-search.mjs "query one" "query two"
const queries = process.argv.slice(2);

for (const q of queries) {
  await new Promise((r) => setTimeout(r, 2500));
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=" +
    encodeURIComponent(q + " filetype:bitmap") +
    "&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=400";
  const res = await fetch(url, {
    headers: { "User-Agent": "adriatic-trans-site/1.0 (dev)" },
  });
  const json = await res.json();
  console.log("== " + q);
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const i = p.imageinfo?.[0];
    if (!i) continue;
    console.log(p.title, `${i.width}x${i.height}`, i.extmetadata?.LicenseShortName?.value);
  }
}

