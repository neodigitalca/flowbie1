const bust = Date.now();
const url = `https://neodigital.ca/blog/seo-specialist/?flowbie_faq=${bust}`;
const res = await fetch(url, {
  headers: { "Cache-Control": "no-cache", Pragma: "no-cache", "User-Agent": "Mozilla/5.0 FlowbieAudit" },
});
const html = await res.text();
const headEnd = html.toLowerCase().indexOf("</head>");
const head = headEnd > 0 ? html.slice(0, headEnd) : "";
const body = headEnd > 0 ? html.slice(headEnd) : html;
const headNoScripts = head.replace(/<script\b[\s\S]*?<\/script>/gi, "");
const bodyUntilHeader = body.slice(0, Math.max(body.indexOf("neo digital"), body.indexOf("site-header"), 8000));
const q = "What exactly defines Local SEO";
console.log(
  JSON.stringify(
    {
      status: res.status,
      bytes: html.length,
      faqPageInHead: /FAQPage/.test(head),
      questionOutsideScriptsInHead: headNoScripts.includes(q),
      questionBeforeHeaderInBody: bodyUntilHeader.includes(q),
      floFaq: html.includes("flo-faq"),
      headNoScriptsSnippet: headNoScripts.slice(-400).replace(/\s+/g, " "),
    },
    null,
    2,
  ),
);
