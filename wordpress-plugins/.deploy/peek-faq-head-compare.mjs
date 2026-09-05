async function peek(label, url) {
  const res = await fetch(url, {
    headers: { "Cache-Control": "no-cache", "User-Agent": "Mozilla/5.0 FlowbieAudit" },
  });
  const html = await res.text();
  const headEnd = html.toLowerCase().indexOf("</head>");
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 25000);
  const faqScripts = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1],
  );
  const faqPageScript = faqScripts.find((s) => s.includes("FAQPage"));
  const gtag = head.lastIndexOf("gtag");
  const dateMod = head.indexOf("dateModified");
  const between =
    gtag >= 0 && dateMod > gtag
      ? head.slice(gtag, dateMod).replace(/\s+/g, " ").slice(-600)
      : head.slice(-600).replace(/\s+/g, " ");
  const visibleFaqBlob = /What exactly defines Local SEO|What benefits does Edmonton/i.test(head);
  const rawTextBeforeScript = between.includes("<script") === false && between.length > 80;
  console.log(
    JSON.stringify(
      {
        label,
        status: res.status,
        bytes: html.length,
        floFaq: html.includes("flo-faq"),
        faqPageInHtml: html.includes("FAQPage"),
        faqPageInHeadScript: Boolean(faqPageScript),
        visibleFaqBlobInHead: visibleFaqBlob,
        betweenGtagAndDateModified: between,
      },
      null,
      2,
    ),
  );
}

await peek("nd-seo-specialist", "https://neodigital.ca/blog/seo-specialist/");
await peek("nd-hire-elementor", "https://neodigital.ca/blog/hire-elementor-experts/");
await peek("bm-sample", "https://blindmagic.com/roller-shades/");
await peek("its-sample", "https://intheshadeflorida.com/motorized-blinds/");
await peek("ibl-sample", "https://interiorsbylaura.com/");
