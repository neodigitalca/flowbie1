import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const session = await openEmcp("neo-pulse-fix-home-section40");
let id = 2;

// 1. Update Section Title
const updatedTitle = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "6001906",
    settings: {
      subtitle: "What We Do",
      title: "Websites built to grow your business.",
    },
  },
  id++,
);

// 2. Update Text Editor
const newCopy =
  '<p>We build fast, modern websites tailored to your business goals. Whether you need a custom build on <a href="https://neodigital.ca/website-design/">Website Design</a>, specialized support from our <a href="https://neodigital.ca/elementor-help/">Elementor Experts</a>, an online store with <a href="https://neodigital.ca/shopify-development/">Shopify Development</a>, or an agile site on <a href="https://neodigital.ca/webflow-development/">Webflow Development</a>, we have you covered. Plus, our <a href="https://neodigital.ca/graphic-design/">Graphic Design</a> keeps your brand sharp across every touchpoint.</p>';

const updatedCopy = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "2881168",
    settings: {
      editor: newCopy,
    },
  },
  id++,
);

process.stdout.write(
  `${JSON.stringify(
    {
      titleSuccess: updatedTitle.data?.success,
      copySuccess: updatedCopy.data?.success,
    },
    null,
    2,
  )}\n`,
);
