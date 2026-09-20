import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const statsData = await page.evaluate(() => {
  const titles = Array.from(document.querySelectorAll("*")).filter(el => 
    el.textContent && (el.textContent.includes("Years of Experience") || el.textContent.includes("Businesses Helped"))
  );
  
  // Find the closest common section / container
  let container = titles[0];
  while (container && !container.classList.contains("elementor-element")) {
    container = container.parentElement;
  }
  // Go up to the section or parent container
  let section = container;
  while (section && !section.classList.contains("e-con-boxed") && !section.classList.contains("elementor-top-section") && section.parentElement) {
    if (section.parentElement.classList.contains("elementor-section-wrap") || section.parentElement.tagName === "MAIN") break;
    section = section.parentElement;
  }

  // Find all elements within section
  const sectionHtml = section ? section.outerHTML : "not found";

  // Also look for buttons on the page
  const allButtons = Array.from(document.querySelectorAll("button, a.elementor-button, .ygency-button, a[class*='btn'], a[class*='button']")).map(b => ({
    text: b.textContent.trim(),
    classes: b.className,
    href: b.getAttribute("href"),
    color: window.getComputedStyle(b).color,
    bgColor: window.getComputedStyle(b).backgroundColor,
    display: window.getComputedStyle(b).display,
    visibility: window.getComputedStyle(b).visibility,
    opacity: window.getComputedStyle(b).opacity,
    rect: b.getBoundingClientRect(),
  }));

  // Also check the counters specifically
  const counters = Array.from(document.querySelectorAll(".qodef-qi-counter")).map(c => {
    const digit = c.querySelector(".qodef-m-digit");
    const title = c.querySelector(".qodef-m-title");
    return {
      titleText: title ? title.textContent.trim() : null,
      digitText: digit ? digit.textContent.trim() : null,
      digitHtml: digit ? digit.outerHTML : null,
      computedDigitColor: digit ? window.getComputedStyle(digit).color : null,
      computedDigitOpacity: digit ? window.getComputedStyle(digit).opacity : null,
      computedDigitDisplay: digit ? window.getComputedStyle(digit).display : null,
      digitRect: digit ? digit.getBoundingClientRect() : null,
      parentRect: c.getBoundingClientRect(),
    };
  });

  return {
    counters,
    allButtons: allButtons.filter(b => b.rect.y < 2000), // top section buttons
    sectionHtmlSnippet: sectionHtml.slice(0, 3000),
  };
});

await browser.close();
console.log(JSON.stringify(statsData, null, 2));
