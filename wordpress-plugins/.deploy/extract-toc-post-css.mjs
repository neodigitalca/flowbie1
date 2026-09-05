import { readFileSync } from "fs";
const css = readFileSync(
  "wordpress-plugins/.deploy/neodigital-toc-pull/wp-content__uploads__elementor__css__post-7745.css",
  "utf8",
);
const parts = css.split(/(?=\.elementor-7745)/);
for (const p of parts) {
  if (p.includes("e72d2ab") || p.includes("toc")) {
    console.log(p.slice(0, 800));
    console.log("---");
  }
}
