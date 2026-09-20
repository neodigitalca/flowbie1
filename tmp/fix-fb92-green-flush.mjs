import { callTool, openEmcp } from "./emcp-http.mjs";
import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-fix-fb92-green");
let seq = 1;

// Restore green column background on fb92c02 (flatten removed it)
await callTool(session, "emcp-tools-update-element", {
  post_id: POST_ID,
  element_id: "fb92c02",
  settings: {
    background_background: "classic",
    background_color: "#84BD00",
    border_radius: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
    width: { unit: "%", size: 100, sizes: [] },
    flex_direction: "column",
    flex_align_items: "flex-start",
    flex_justify_content: "flex-start",
    padding: { unit: "px", top: "40", right: "40", bottom: "40", left: "40", isLinked: true },
    custom_css: `selector {
  border-radius: 0 !important;
  background-image: none !important;
}
selector, selector p, selector h1, selector h2, selector h3, selector span {
  color: #FFFFFF !important;
}`
  }
}, seq++);

await callTool(session, "emcp-tools-update-element", {
  post_id: POST_ID,
  element_id: "f3851d6",
  settings: {
    background_background: "classic",
    background_color: "#02050A",
    border_radius: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
    width: { unit: "%", size: 100, sizes: [] },
    padding: { unit: "px", top: "40", right: "40", bottom: "40", left: "40", isLinked: true },
    custom_css: `selector {
  border-radius: 0 !important;
  background-image: none !important;
}
selector, selector p, selector h1, selector h2, selector h3, selector span {
  color: #FFFFFF !important;
}`
  }
}, seq++);

// Ensure row has gap and columns stay 50/50
await callTool(session, "emcp-tools-update-element", {
  post_id: POST_ID,
  element_id: "70e79f8",
  settings: {
    flex_direction: "row",
    flex_align_items: "stretch",
    flex_gap: { unit: "px", size: 24, column: "24", row: "24", isLinked: true },
    content_width: "full",
    width: { unit: "%", size: 100, sizes: [] },
  }
}, seq++);

await callTool(session, "emcp-tools-update-element", {
  post_id: POST_ID,
  element_id: "1939589",
  settings: { width: { unit: "%", size: 50, sizes: [] } }
}, seq++);

await callTool(session, "emcp-tools-update-element", {
  post_id: POST_ID,
  element_id: "6edfb5a",
  settings: { width: { unit: "%", size: 50, sizes: [] } }
}, seq++);

const php = `
if ( class_exists( '\\Elementor\\Plugin' ) ) {
    \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}
echo wp_json_encode(array('ok' => true));
`;
await runNeodigitalPhp(php, "oneshot-flush-after-fix");
console.log("Fixed fb92/f385 columns and flushed cache");
