// فحص صفحات التطبيق بمتصفح حقيقي والتقاط أخطاء الكونسول
//
//   npm i -D puppeteer && npx puppeteer browsers install chrome
//   npm run build && npm start &
//   node scripts/check-pages.mjs /day /settings "/settings?section=cloud"
//
// puppeteer ليست ضمن تبعيات المشروع عمدًا (أداة تشخيص عند الحاجة فقط).
import puppeteer from "puppeteer";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/day", "/settings", "/settings?section=cloud"];

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
let failures = 0;

for (const p of paths) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url().replace(BASE, "")} — ${r.failure()?.errorText}`));

  const res = await page.goto(BASE + p, { waitUntil: "networkidle2", timeout: 45000 }).catch((e) => ({ err: e.message }));
  await new Promise((r) => setTimeout(r, 1500));
  const text = await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => "");
  const broken = /couldn.t load|Application error|Something went wrong/i.test(text);

  console.log(`\n=== ${p} — HTTP ${res?.status?.() ?? res?.err ?? "?"} ${broken ? "❌ الصفحة معطّلة" : "✅"}`);
  console.log("  محتوى:", JSON.stringify(text.replace(/\s+/g, " ").slice(0, 160)));
  for (const e of [...new Set(errors)].slice(0, 12)) console.log("  •", e.slice(0, 300));
  if (broken || errors.some((e) => e.startsWith("pageerror"))) failures++;
  await page.close();
}

await browser.close();
console.log(`\nصفحات معطّلة: ${failures}/${paths.length}`);
process.exit(failures ? 1 : 0);
