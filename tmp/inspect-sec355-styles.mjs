import { readFileSync } from "fs";

const settings = JSON.parse(readFileSync("tmp/edmonton-seo-elements-settings.json", "utf8"));
const sec355Ids = [
  "3553037", "a48b7dc", "8141703", "4b39b50", "ba7052d",
  "70e79f8", "1939589", "fb92c02", "20277c5", "1819f4b",
  "a75aad3", "e2ce6fe", "9474c98", "6edfb5a", "f3851d6",
  "859fe91", "7364af0", "8649bae", "b9a6d06", "bbdcc6b",
  "76c6b45", "79b72fd"
];

for (const id of sec355Ids) {
  if (settings[id]) {
    console.log(`=== ${id} ===`);
    const s = settings[id];
    const filtered = {};
    for (const [k, v] of Object.entries(s)) {
      if (k.includes("color") || k.includes("background") || k.includes("typography") || k.includes("width") || k.includes("flex") || k.includes("padding") || k.includes("margin") || k.includes("border") || k === "title" || k === "editor" || k === "custom_css" || k === "__globals__") {
        filtered[k] = v;
      }
    }
    console.log(JSON.stringify(filtered, null, 2));
  }
}
