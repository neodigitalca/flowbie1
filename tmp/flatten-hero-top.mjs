import { callTool, openEmcp } from "./emcp-http.mjs";
import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const POST_ID = 10203;

async function run() {
  const session = await openEmcp("neo-flatten-hero");
  let seq = 1;

  console.log("Remove decorative arrow 9076ddc");
  await callTool(session, "emcp-tools-remove-element", { post_id: POST_ID, element_id: "9076ddc" }, seq++);

  console.log("Move Edmonton Agency heading out of wrapper 6a4365c");
  await callTool(
    session,
    "emcp-tools-move-element",
    { post_id: POST_ID, element_id: "4f337d2", target_parent_id: "e8af43f", position: -1 },
    seq++,
  );
  await callTool(session, "emcp-tools-remove-element", { post_id: POST_ID, element_id: "6a4365c" }, seq++);

  console.log("Move CTA into image column, remove f7d4e39 wrapper");
  await callTool(
    session,
    "emcp-tools-move-element",
    { post_id: POST_ID, element_id: "249a4df", target_parent_id: "bb9c5ef", position: -1 },
    seq++,
  );
  await callTool(session, "emcp-tools-remove-element", { post_id: POST_ID, element_id: "f7d4e39" }, seq++);

  console.log("Move H1 out of 21b3884 wrapper");
  await callTool(
    session,
    "emcp-tools-move-element",
    { post_id: POST_ID, element_id: "2bbef65", target_parent_id: "9806fc2", position: 0 },
    seq++,
  );
  await callTool(session, "emcp-tools-remove-element", { post_id: POST_ID, element_id: "21b3884" }, seq++);

  const heroCss = `selector .elementor-widget-image img {
  max-width: 100%;
  height: auto;
  max-height: 320px;
  object-fit: cover;
  border-radius: 8px;
}
selector .elementor-element-355952b img {
  max-height: 56px;
  width: auto;
  object-fit: contain;
}`;

  console.log("Apply layout settings");
  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "afa170d",
      settings: {
        margin: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
        padding: { unit: "px", top: "120", right: "0", bottom: "60", left: "0", isLinked: false },
        flex_direction: "column",
        content_width: "full",
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "9806fc2",
      settings: {
        content_width: "boxed",
        width: { unit: "px", size: 1140, sizes: [] },
        flex_direction: "column",
        flex_align_items: "stretch",
        flex_gap: { unit: "px", size: 32, column: "32", row: "32", isLinked: true },
        padding: { unit: "px", top: "0", right: "24", bottom: "0", left: "24", isLinked: false },
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "2bbef65",
      settings: {
        align: "center",
        title_color: "#FFFFFF",
        __globals__: { title_color: "" },
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "4101a06",
      settings: {
        content_width: "full",
        width: { unit: "%", size: 100, sizes: [] },
        flex_direction: "row",
        flex_align_items: "flex-start",
        flex_justify_content: "space-between",
        flex_gap: { unit: "px", size: 40, column: "40", row: "40", isLinked: true },
        flex_wrap: "nowrap",
        custom_css: heroCss,
        _title: "Hero two-column",
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "e8af43f",
      settings: {
        content_width: "full",
        width: { unit: "%", size: 50, sizes: [] },
        flex_direction: "column",
        flex_align_items: "flex-start",
        flex_gap: { unit: "px", size: 20, column: "20", row: "20", isLinked: true },
        padding: { unit: "px", top: "0", right: "16", bottom: "0", left: "0", isLinked: false },
        _title: "Hero copy",
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "bb9c5ef",
      settings: {
        content_width: "full",
        width: { unit: "%", size: 46, sizes: [] },
        flex_direction: "column",
        flex_align_items: "center",
        flex_justify_content: "flex-start",
        flex_gap: { unit: "px", size: 24, column: "24", row: "24", isLinked: true },
        padding: { unit: "px", top: "0", right: "0", bottom: "0", left: "16", isLinked: false },
        _title: "Hero media",
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "355952b",
      settings: {
        width: { unit: "px", size: 180, sizes: [] },
        align: "left",
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "15117cd",
      settings: {
        image_size: "large",
        width: { unit: "%", size: 100, sizes: [] },
        align: "center",
      },
    },
    seq++,
  );

  await runNeodigitalPhp(
    `if ( class_exists( '\\Elementor\\Plugin' ) ) {
  \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}
echo wp_json_encode(array('ok'=>true));`,
    "oneshot-flush-hero",
  );

  const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 6 }, seq++);
  function findNode(nodes, id) {
    for (const n of nodes || []) {
      if (n.id === id) return n;
      const f = findNode(n.elements, id);
      if (f) return f;
    }
    return null;
  }
  const hero = findNode(struct.data?.structure, "9806fc2");
  console.log("Flattened hero tree:", JSON.stringify(hero, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
