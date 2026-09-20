import { callTool, openEmcp } from "./emcp-http.mjs";
import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const POST_ID = 10203;

/** row container, text inner col, image inner col (image col omitted on step 10) */
const STEPS = [
  { row: "4c1e062", text: "24ec0fe", img: "d591166", imageId: "61debcc" },
  { row: "f7b6948", text: "4f9bac2", img: "9021707", imageId: "3a00fb0" },
  { row: "e997763", text: "3c009fc", img: "93db3db", imageId: "ba18a21" },
  { row: "2d20944", text: "fdceaa1", img: "a3353db", imageId: "a0adeba" },
  { row: "c8ba8a3", text: "49c25b6", img: "7c91a11", imageId: "7c91a12" },
  { row: "b79ecfb", text: "2409146", img: "2020c5d", imageId: "eb020ed" },
  { row: "d65ad74", text: "8d301b1", img: "7c91a13", imageId: "7c91a14" },
  { row: "e0a0811", text: "31301ab", img: "65f6b22", imageId: "0299b5a" },
  { row: "069484a", text: "d3312a6", img: "3aaf097", imageId: "8e67bb9" },
  { row: "46f0e3c", text: "0d8301d", img: null, imageId: null },
];

const ROW_BOX = {
  content_width: "full",
  width: { unit: "%", size: 100, sizes: [] },
  flex_direction: "row",
  flex_align_items: "center",
  flex_justify_content: "space-between",
  flex_gap: { unit: "px", size: 32, column: "32", row: "32", isLinked: true },
  margin: { unit: "px", top: "0", right: "0", bottom: "48", left: "0", isLinked: false },
  padding: { unit: "px", top: "32", right: "32", bottom: "32", left: "32", isLinked: true },
  background_background: "classic",
  background_color: "#0A0A0A",
  border_radius: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
};

const TEXT_COL = {
  content_width: "full",
  width: { unit: "%", size: 52, sizes: [] },
  flex_direction: "column",
  flex_align_items: "flex-start",
  flex_gap: { unit: "px", size: 12, column: "12", row: "12", isLinked: true },
};

const IMAGE_COL = {
  width: { unit: "%", size: 42, sizes: [] },
  flex_align_items: "center",
  flex_justify_content: "center",
};

async function run() {
  const session = await openEmcp("neo-flatten-f51");
  let seq = 1;

  console.log("=== Parent f51d2a0: stack steps vertically ===");
  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "f51d2a0",
      settings: {
        content_width: "full",
        width: { unit: "%", size: 100, sizes: [] },
        flex_direction: "column",
        flex_align_items: "stretch",
        flex_wrap: "nowrap",
        flex_gap: { unit: "px", size: 0, column: "0", row: "0", isLinked: true },
        margin: { unit: "px", top: "48", right: "0", bottom: "0", left: "0", isLinked: false },
      },
    },
    seq++,
  );

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const odd = i % 2 === 0;
    const rowSettings = {
      ...ROW_BOX,
      flex_direction: odd ? "row" : "row-reverse",
      _title: `Step ${String(i + 1).padStart(2, "0")}`,
    };
    if (i === STEPS.length - 1) {
      rowSettings.flex_direction = "column";
      rowSettings.width = { unit: "%", size: 100, sizes: [] };
    }

    console.log(`=== Step ${i + 1}: flatten ${step.row} (${odd ? "text|image" : "image|text"}) ===`);

    if (step.imageId && step.img) {
      // Move image widget up to row (after text column)
      await callTool(
        session,
        "emcp-tools-move-element",
        {
          post_id: POST_ID,
          element_id: step.imageId,
          target_parent_id: step.row,
          position: -1,
        },
        seq++,
      );

      const removeImgWrap = await callTool(
        session,
        "emcp-tools-remove-element",
        { post_id: POST_ID, element_id: step.img },
        seq++,
      );
      console.log("  removed img wrap:", removeImgWrap.data?.success ?? removeImgWrap.data);

      await callTool(
        session,
        "emcp-tools-update-element",
        {
          post_id: POST_ID,
          element_id: step.imageId,
          settings: {
            width: { unit: "%", size: 100, sizes: [] },
            image_border_radius: { unit: "px", top: "8", right: "8", bottom: "8", left: "8", isLinked: true },
          },
        },
        seq++,
      );
    }

    await callTool(
      session,
      "emcp-tools-update-element",
      {
        post_id: POST_ID,
        element_id: step.text,
        settings: TEXT_COL,
      },
      seq++,
    );

    await callTool(
      session,
      "emcp-tools-update-element",
      {
        post_id: POST_ID,
        element_id: step.row,
        settings: rowSettings,
      },
      seq++,
    );
  }

  console.log("=== Flush Elementor CSS ===");
  await runNeodigitalPhp(
    `if ( class_exists( '\\Elementor\\Plugin' ) ) {
  \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}
echo wp_json_encode(array('ok'=>true));`,
    "oneshot-flush-f51",
  );

  console.log("Done flattening f51d2a0 steps.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
