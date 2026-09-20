import fs from "fs";

const data = JSON.parse(fs.readFileSync("tmp/f51d2a0-structure.json", "utf8"));

const summary = data.elements.map((el, i) => {
  const getSub = (node) => {
    if (node.elements) {
      return node.elements.map(getSub);
    }
    return `${node.widgetType} (${node.settings_summary?.title || node.settings_summary?.image?.alt?.slice(0, 30) || node.id})`;
  };
  return {
    index: i,
    id: el.id,
    type: el.elType,
    direction: el.settings_summary?.flex_direction,
    children: el.elements?.map(c => ({
      id: c.id,
      type: c.elType,
      direction: c.settings_summary?.flex_direction,
      subs: getSub(c)
    }))
  };
});

console.log(JSON.stringify(summary, null, 2));
