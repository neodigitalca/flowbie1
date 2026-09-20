import fs from "fs";
const data = JSON.parse(fs.readFileSync("tmp/f51d2a0-live.json", "utf8"));

for (const [i, row] of (data.elements || []).entries()) {
  const kids = row.elements || [];
  console.log(`Row ${i + 1} id=${row.id} dir=${row.settings_summary?.flex_direction}`);
  for (const k of kids) {
    const widgets = (k.elements || []).flatMap(sub => sub.elements || sub);
    console.log(`  col ${k.id}:`, widgets.map(w => `${w.widgetType}:${w.settings_summary?.title || w.id}`).join(", "));
  }
}
