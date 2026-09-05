const token = "0cced5e9bbbdab140f32ffc0dfc81fd8";
const flushUrl = `https://neodigital.ca/wp-content/plugins/flowbie-wp/nd-faq-flush-once.php?key=${token}`;
const flushRes = await fetch(flushUrl, { headers: { "User-Agent": "Mozilla/5.0 FlowbieAudit" } });
const flushText = await flushRes.text();
console.log("flush_status", flushRes.status);
console.log("flush_body", flushText.slice(0, 500));

const bust = Date.now();
const url = `https://neodigital.ca/blog/seo-specialist/?flowbie_faq=${bust}`;
const res = await fetch(url, {
  headers: { "Cache-Control": "no-cache", Pragma: "no-cache", "User-Agent": "Mozilla/5.0 FlowbieAudit" },
});
const html = await res.text();
const headEnd = html.toLowerCase().indexOf("</head>");
const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 40000);
const blob = /What exactly defines Local SEO|What benefits does Edmonton/i.test(head);
const faqPage = /"@type":"FAQPage"/.test(head) || /"@type": "FAQPage"/.test(head);
const flo = html.includes("flo-faq");
const fatal = /Fatal error|allowed memory|agentmail/i.test(html);
console.log(
  JSON.stringify(
    {
      post_status: res.status,
      bytes: html.length,
      visibleFaqBlobInHead: blob,
      faqPageJsonLdInHead: faqPage,
      floFaqInBody: flo,
      phpFatal: fatal,
      headHasQuestionPlain: /What exactly defines Local SEO tailored/.test(head),
    },
    null,
    2,
  ),
);
if (faqPage) {
  const i = head.indexOf("FAQPage");
  console.log("faqpage_context", head.slice(Math.max(0, i - 80), i + 120).replace(/\s+/g, " "));
}
