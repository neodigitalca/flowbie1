import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/website-design/?nonitro=1", { waitUntil: "networkidle2" });

const ctaInfo = await page.evaluate(() => {
  // Find element containing "Have Any Projects In Mind"
  const all = Array.from(document.querySelectorAll("*")).filter(el => 
    el.textContent && el.textContent.includes("Have Any Projects In Mind")
  );
  
  const heading = all[all.length - 1];
  const section = heading ? heading.closest(".elementor-element") : null;
  const parentCon = section ? section.closest(".e-con, .elementor-section") : null;
  
  // Find any buttons in this container
  const btns = parentCon ? Array.from(parentCon.querySelectorAll("a, button")).map(b => ({
    text: b.textContent.trim(),
    classes: b.className,
    outerHtml: b.outerHTML,
    color: window.getComputedStyle(b).color,
    bgColor: window.getComputedStyle(b).backgroundColor,
    border: window.getComputedStyle(b).border,
  })) : [];

  return {
    sectionId: section ? section.getAttribute("data-id") : null,
    parentConId: parentCon ? parentCon.getAttribute("data-id") : null,
    parentConHtml: parentCon ? parentCon.outerHTML.slice(0, 3000) : null,
    btns,
  };
});

// Scroll to CTA and screenshot
const ctaHandle = await page.evaluateHandle(() => {
  const el = Array.from(document.querySelectorAll("*")).find(e => 
    e.textContent && e.textContent.includes("Have Any Projects In Mind")
  );
  return el ? el.closest(".e-con, .elementor-section") : document.body;
});

if (ctaHandle) {
  await ctaHandle.asElement()?.scrollIntoView();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: "b:/Neo Pulse/tmp/website-design-cta.png" });
}

await browser.close();
console.log(JSON.stringify(ctaInfo, null, 2));
