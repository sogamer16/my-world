// Make the link-preview picture (assets/og.jpg, 1200×630) shown when the site is shared on LinkedIn, WhatsApp, Slack etc.
// It is the real title screen with the world behind it, minus the buttons and hints, so it never drifts from the site.
// Run it after changing the name, role or pitch in js/data.js (same set-up as make-cv-pdf.mjs):
//   python3 -m http.server 8000      (in the repository folder)
//   node tools/make-share-image.mjs
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:8000/';
const out = new URL('../assets/og.jpg', import.meta.url).pathname;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.evaluate(() => document.fonts.ready);
// wait for the loading bar to finish and the models to settle
await page.waitForFunction(() => { const l = document.getElementById('loading'); return !l || l.classList.contains('done') || getComputedStyle(l).opacity === '0' || l.hidden; }, null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(6000);
await page.addStyleTag({ content: `
  .title-actions, .contact-strip, .hint, .juha, #hud-top, #panel, #panel-toggle, #hotbar, #hint, #loading, #tip, #slow { display: none !important; }
  #title-screen { padding-bottom: 0 !important; }
  #title-screen .pitch { margin-top: 0.5rem; }
` });
await page.waitForTimeout(500);
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
await browser.close();
console.log('wrote', out);
