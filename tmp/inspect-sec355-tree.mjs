import { readFileSync } from "fs";

const struct = JSON.parse(readFileSync("tmp/edmonton-seo-structure.json", "utf8"));
const sec355 = struct.data.structure.find(s => s.id === "3553037");

console.log(JSON.stringify(sec355, null, 2));
