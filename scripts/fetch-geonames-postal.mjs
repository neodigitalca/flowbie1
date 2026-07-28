/**
 * Download GeoNames postal code files (same source as pgeocode).
 * Writes server/data/geonames/CA.txt and US.txt
 */
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "server", "data", "geonames");

const COUNTRIES = ["CA", "US"];
const URLS = [
  (c) => `https://download.geonames.org/export/zip/${c}.zip`,
  (c) => `https://symerio.github.io/postal-codes-data/data/geonames/${c}.txt`,
];

async function downloadTxt(country) {
  const txtUrl = URLS[1](country);
  const res = await fetch(txtUrl);
  if (res.ok) {
    const text = await res.text();
    if (text.includes("\t") && text.length > 1000) return text;
  }

  const zipUrl = URLS[0](country);
  const zipRes = await fetch(zipUrl);
  if (!zipRes.ok) throw new Error(`Failed to download ${country} postal data`);
  const buf = Buffer.from(await zipRes.arrayBuffer());
  const { default: AdmZip } = await import("adm-zip");
  const zip = new AdmZip(buf);
  const entry =
    zip.getEntry(`${country}.txt`) ?? zip.getEntries().find((e) => e.entryName.endsWith(".txt"));
  if (!entry) throw new Error(`No txt in ${country}.zip`);
  return entry.getData().toString("utf8");
}

mkdirSync(outDir, { recursive: true });

for (const c of COUNTRIES) {
  const outPath = join(outDir, `${c}.txt`);
  if (existsSync(outPath)) {
    console.log(`Skip ${c}.txt (exists)`);
    continue;
  }
  const content = await downloadTxt(c);
  writeFileSync(outPath, content, "utf8");
  console.log(`Wrote ${outPath} (${content.length} bytes)`);
}
