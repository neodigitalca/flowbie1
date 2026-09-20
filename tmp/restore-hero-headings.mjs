import { callTool, openEmcp } from "./emcp-http.mjs";
import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-restore-hero-h");
let seq = 1;

const h1 = await callTool(
  session,
  "emcp-tools-add-free-widget",
  {
    post_id: POST_ID,
    parent_id: "9806fc2",
    position: 0,
    widget_type: "heading",
    settings: {
      title: "Edmonton SEO built for local search.",
      header_size: "h1",
      align: "center",
      title_color: "#FFFFFF",
      __globals__: { title_color: "" },
    },
  },
  seq++,
);
console.log("Added H1:", h1.data);

const agency = await callTool(
  session,
  "emcp-tools-add-free-widget",
  {
    post_id: POST_ID,
    parent_id: "e8af43f",
    position: -1,
    widget_type: "heading",
    settings: {
      title: "Edmonton<br>Agency",
      header_size: "p",
      align: "left",
      title_color: "#FFFFFF",
      __globals__: { title_color: "" },
    },
  },
  seq++,
);
console.log("Added agency:", agency.data);

await runNeodigitalPhp(
  `if ( class_exists( '\\Elementor\\Plugin' ) ) {
  \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}
echo wp_json_encode(array('ok'=>true));`,
  "oneshot-flush-hero-restore",
);
