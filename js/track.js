// Visitor counts with GoatCounter (no cookies, no personal data). Off until `analytics` in data.js names a site code.
import { analytics } from './data.js?v=59';

let ready = null;
if (analytics) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${analytics}.goatcounter.com/count`;
  s.dataset.goatcounterSettings = '{"no_onload": true}';
  ready = new Promise((ok) => { s.onload = ok; });
  document.head.append(s);
}

// count a view of one part of the site, e.g. track('quests') or track('summary')
export function track(part) {
  ready?.then(() => window.goatcounter?.count({ path: `${location.pathname}${part ? `#${part}` : ''}` }));
}
