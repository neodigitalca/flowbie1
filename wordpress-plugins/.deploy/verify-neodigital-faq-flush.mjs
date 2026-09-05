const token = "e91505cfb9c22b31e6725277a4f296f0";
const flushRes = await fetch(
  `https://neodigital.ca/wp-content/plugins/flowbie-wp/nd-faq-flush-full.php?key=${token}`,
  { headers: { "User-Agent": "Mozilla/5.0 FlowbieAudit" } },
);
console.log("flush_status", flushRes.status);
console.log("flush_body", (await flushRes.text()).slice(0, 400));

async function check(label, url) {
  const res = await fetch(url, {
    headers: { "Cache-Control": "no-cache", "User-Agent": "Mozilla/5.0 FlowbieAudit" },
  });
  const html = await res.text();
  const headEnd = html.toLowerCase().indexOf("</head>");
  const head = headEnd > 0 ? html.slice(0, headEnd) : "";
  const headNoScripts = head.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const q = "What exactly defines Local SEO";
  console.log(
    JSON.stringify({
      label,
      status: res.status,
      faqPageInHead: /FAQPage/.test(head),
      questionOutsideScriptsInHead: headNoScripts.includes(q),
      floFaq: html.includes("flo-faq"),
    }),
  );
}
await check("canonical", "https://neodigital.ca/blog/seo-specialist/");
await check("hire", "https://neodigital.ca/blog/hire-elementor-experts/");
