// Make the downloadable CV (assets/Sohaib-Qutub-CV.pdf) from the site's plain view, using its print styles.
// Run it after changing js/data.js:
//   python3 -m http.server 8000            (in the repository folder, in one terminal)
//   npx -y playwright@1.49.1 install chromium   (once, if you have no Playwright browser yet)
//   node tools/make-cv-pdf.mjs              (in another terminal; needs `npm i playwright` or a global install)
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:8000/#summary';
const out = new URL('../assets/Sohaib-Qutub-CV.pdf', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => !document.getElementById('summary').classList.contains('wait-font'));
await page.emulateMedia({ media: 'print' });
const updated = await page.$eval('.s-updated', (e) => e.textContent.trim()); // e.g. 'Updated November 2026', shown in the footer
await page.pdf({ path: out, format: 'A4', margin: { top: '11mm', bottom: '12mm', left: '15mm', right: '15mm' }, printBackground: false,
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#666;text-align:center;font-family:serif">Sohaib Qutub · CV · ${updated} · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>` });
await browser.close();
console.log('wrote', out);
