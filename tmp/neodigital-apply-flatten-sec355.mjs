import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;

async function run() {
  const session = await openEmcp("neo-pulse-flatten-sec355");
  let seq = 2;

  console.log("=== STEP 1: Inspect current tree of section 3553037 ===");
  const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 8 }, seq++);
  const sec355 = struct.data?.structure?.find(s => s.id === "3553037");
  console.log("Section 3553037 structure:", JSON.stringify(sec355, null, 2));

  console.log("=== STEP 2: Flatten Left Column (fb92c02) ===");
  // Check if 20277c5 (guy image) exists, remove it
  const removeGuy = await callTool(session, "emcp-tools-remove-element", {
    post_id: POST_ID,
    element_id: "20277c5"
  }, seq++);
  console.log("Removed 20277c5 (guy image):", removeGuy.data);

  // Move widgets a75aad3 (150+), e2ce6fe (Local campaigns launched), 9474c98 (paragraph) into fb92c02
  const move150 = await callTool(session, "emcp-tools-move-element", {
    post_id: POST_ID,
    element_id: "a75aad3",
    target_parent_id: "fb92c02",
    position: 0
  }, seq++);
  console.log("Moved a75aad3 into fb92c02:", move150.data);

  const moveE2ce = await callTool(session, "emcp-tools-move-element", {
    post_id: POST_ID,
    element_id: "e2ce6fe",
    target_parent_id: "fb92c02",
    position: 1
  }, seq++);
  console.log("Moved e2ce6fe into fb92c02:", moveE2ce.data);

  const move9474 = await callTool(session, "emcp-tools-move-element", {
    post_id: POST_ID,
    element_id: "9474c98",
    target_parent_id: "fb92c02",
    position: 2
  }, seq++);
  console.log("Moved 9474c98 into fb92c02:", move9474.data);

  // Remove wrapper container 1819f4b
  const remove1819 = await callTool(session, "emcp-tools-remove-element", {
    post_id: POST_ID,
    element_id: "1819f4b"
  }, seq++);
  console.log("Removed 1819f4b wrapper:", remove1819.data);

  // Flatten fb92c02: remove wavy background image, remove border-radius (set to 0), set flex direction column
  const updateFb92 = await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "fb92c02",
    settings: {
      flex_direction: "column",
      flex_justify_content: "flex-start",
      flex_align_items: "flex-start",
      background_image: { url: "", id: "" },
      border_radius: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
      padding: { unit: "px", top: "40", right: "40", bottom: "40", left: "40", isLinked: true },
      custom_css: `selector {
  border-radius: 0px !important;
  background-image: none !important;
}
selector, selector p, selector h1, selector h2, selector h3, selector span {
  color: #FFFFFF !important;
}`
    }
  }, seq++);
  console.log("Updated fb92c02 (flat green container):", updateFb92.data);

  console.log("=== STEP 3: Flatten Right Column (f3851d6) ===");
  // Move bbdcc6b (+) and 79b72fd (Custom campaigns...) into 8649bae directly
  const movePlus = await callTool(session, "emcp-tools-move-element", {
    post_id: POST_ID,
    element_id: "bbdcc6b",
    target_parent_id: "8649bae",
    position: 0
  }, seq++);
  console.log("Moved bbdcc6b into 8649bae:", movePlus.data);

  const moveCustom = await callTool(session, "emcp-tools-move-element", {
    post_id: POST_ID,
    element_id: "79b72fd",
    target_parent_id: "8649bae",
    position: 1
  }, seq++);
  console.log("Moved 79b72fd into 8649bae:", moveCustom.data);

  // Remove empty containers b9a6d06 and 76c6b45
  const removeB9 = await callTool(session, "emcp-tools-remove-element", {
    post_id: POST_ID,
    element_id: "b9a6d06"
  }, seq++);
  console.log("Removed b9a6d06:", removeB9.data);

  const remove76 = await callTool(session, "emcp-tools-remove-element", {
    post_id: POST_ID,
    element_id: "76c6b45"
  }, seq++);
  console.log("Removed 76c6b45:", remove76.data);

  // Update 8649bae: align left (flex-start), natural row layout with gap
  const update8649 = await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "8649bae",
    settings: {
      flex_direction: "row",
      flex_align_items: "center",
      _flex_align_self: "flex-start",
      flex_justify_content: "flex-start",
      flex_gap: { unit: "px", size: 12, column: "12", row: "12", isLinked: true },
      margin: { unit: "px", top: "24", right: "0", bottom: "0", left: "0", isLinked: false }
    }
  }, seq++);
  console.log("Updated 8649bae (aligned left):", update8649.data);

  // Flatten f3851d6: remove star background image, remove border-radius (set to 0), transparent/flat background
  const updateF385 = await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "f3851d6",
    settings: {
      flex_direction: "column",
      flex_align_items: "flex-start",
      background_image: { url: "", id: "" },
      border_radius: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
      padding: { unit: "px", top: "40", right: "40", bottom: "40", left: "40", isLinked: true },
      custom_css: `selector {
  border-radius: 0px !important;
  background-image: none !important;
}
selector, selector p, selector h1, selector h2, selector h3, selector span {
  color: #FFFFFF !important;
}`
    }
  }, seq++);
  console.log("Updated f3851d6 (flat dark container):", updateF385.data);

  console.log("=== STEP 4: White fonts and clean styling on all widgets ===");
  // a75aad3 (150+)
  await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "a75aad3",
    settings: {
      title_color: "#FFFFFF",
      __globals__: { title_color: "" },
      custom_css: "selector, selector .elementor-heading-title { color: #FFFFFF !important; }"
    }
  }, seq++);

  // e2ce6fe (Local campaigns launched)
  await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "e2ce6fe",
    settings: {
      text_color: "#FFFFFF",
      _border_color: "#FFFFFF",
      __globals__: { text_color: "", _border_color: "" },
      custom_css: "selector, selector p { color: #FFFFFF !important; }"
    }
  }, seq++);

  // 9474c98 (We keep Google Business Profile...)
  await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "9474c98",
    settings: {
      text_color: "#FFFFFF",
      __globals__: { text_color: "" },
      custom_css: "selector, selector p { color: #FFFFFF !important; }"
    }
  }, seq++);

  // 859fe91 (Edmonton SEO strategies that win the local pack)
  await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "859fe91",
    settings: {
      title_color: "#FFFFFF",
      _border_border: "none",
      __globals__: { title_color: "", _border_color: "" },
      custom_css: "selector, selector .elementor-heading-title { color: #FFFFFF !important; }"
    }
  }, seq++);

  // 7364af0 (With current local ranking factors...)
  await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "7364af0",
    settings: {
      text_color: "#FFFFFF",
      __globals__: { text_color: "" },
      custom_css: "selector, selector p { color: #FFFFFF !important; }"
    }
  }, seq++);

  // bbdcc6b (+)
  await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "bbdcc6b",
    settings: {
      title_color: "#FFFFFF",
      __globals__: { title_color: "" },
      custom_css: "selector, selector .elementor-heading-title { color: #FFFFFF !important; }"
    }
  }, seq++);

  // 79b72fd (Custom campaigns for Edmonton service businesses)
  await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "79b72fd",
    settings: {
      title_color: "#FFFFFF",
      __globals__: { title_color: "" },
      custom_css: "selector, selector .elementor-heading-title { color: #FFFFFF !important; }"
    }
  }, seq++);

  // Section title 4b39b50 ("We rank the searches that book jobs.")
  await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "4b39b50",
    settings: {
      title_color: "#FFFFFF",
      subtitle_color: "#99CF15",
      __globals__: { title_color: "", subtitle_color: "" },
      custom_css: "selector, selector .title { color: #FFFFFF !important; }"
    }
  }, seq++);

  // Section description ba7052d ("We know how Edmonton searches...")
  await callTool(session, "emcp-tools-update-element", {
    post_id: POST_ID,
    element_id: "ba7052d",
    settings: {
      text_color: "#FFFFFF",
      __globals__: { text_color: "" },
      custom_css: "selector, selector p { color: #FFFFFF !important; }"
    }
  }, seq++);

  console.log("=== STEP 5: Verify new tree structure ===");
  const afterStruct = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 8 }, seq++);
  const afterSec355 = afterStruct.data?.structure?.find(s => s.id === "3553037");
  console.log("Section 3553037 after flatten:", JSON.stringify(afterSec355, null, 2));

  console.log("Flattening complete via EMCP tools!");
}

run().catch(console.error);
