import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const deep = await page.evaluate(() => {
  const elements = Array.from(document.querySelectorAll("*")).filter(el => {
    return el.children.length === 0 && (
      (el.textContent && el.textContent.includes("Satisfaction")) ||
      (el.textContent && el.textContent.includes("Experience")) ||
      (el.textContent && el.textContent.includes("Helped"))
    );
  });

  return elements.map(el => {
    const parentContainer = el.closest(".elementor-element");
    return {
      text: el.textContent.trim(),
      tag: el.tagName,
      parentContainerId: parentContainer ? parentContainer.getAttribute("data-id") : null,
      parentContainerClass: parentContainer ? parentContainer.className : null,
      outerHtml: parentContainer ? parentContainer.outerHTML : el.outerHTML,
    };
  });
});

await browser.close();
console.log(JSON.stringify(deep, null, 2));
