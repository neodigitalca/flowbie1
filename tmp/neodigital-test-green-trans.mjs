import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/website-design/?nonitro=1", { waitUntil: "networkidle2" });

const ctaCon = await page.$(".elementor-element-13b99946");
if (ctaCon) {
  await ctaCon.scrollIntoView();
  await new Promise(r => setTimeout(r, 600));

  const tests = [
    {
      name: "green-trans-55",
      bg: "rgba(132, 189, 0, 0.55)",
      border: "2px solid #84BD00",
      textColor: "#02050A",
      iconColor: "#02050A",
      blur: "6px",
    },
    {
      name: "green-trans-70",
      bg: "rgba(132, 189, 0, 0.70)",
      border: "2px solid #84BD00",
      textColor: "#02050A",
      iconColor: "#02050A",
      blur: "4px",
    },
    {
      name: "green-glass-black-tint",
      // Translucent black with strong lime glow and lime border
      bg: "rgba(2, 5, 10, 0.65)",
      border: "2px solid #84BD00",
      textColor: "#84BD00",
      iconColor: "#84BD00",
      blur: "10px",
    },
    {
      name: "green-glass-white-text",
      // Translucent green 30% with white bold text and green border
      bg: "rgba(132, 189, 0, 0.30)",
      border: "2px solid #84BD00",
      textColor: "#FFFFFF",
      iconColor: "#84BD00",
      blur: "12px",
    }
  ];

  for (const t of tests) {
    await page.evaluate((t) => {
      const btn = document.querySelector(".elementor-element-6eb27dc1 a.ygency-button");
      if (!btn) return;
      btn.style.setProperty("background-color", t.bg, "important");
      btn.style.setProperty("border", t.border, "important");
      btn.style.setProperty("backdrop-filter", `blur(${t.blur})`, "important");
      btn.style.setProperty("-webkit-backdrop-filter", `blur(${t.blur})`, "important");
      btn.style.setProperty("box-shadow", "0 0 20px rgba(132, 189, 0, 0.25)", "important");
      const text = btn.querySelector(".button-text");
      const icon = btn.querySelector(".button-icon i");
      if (text) {
        text.style.setProperty("color", t.textColor, "important");
        text.style.setProperty("font-weight", "700", "important");
      }
      if (icon) {
        icon.style.setProperty("color", t.iconColor, "important");
        icon.style.setProperty("font-weight", "700", "important");
      }
    }, t);

    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `b:/Neo Pulse/tmp/${t.name}.png` });
  }
}

await browser.close();
console.log("Tests generated!");
